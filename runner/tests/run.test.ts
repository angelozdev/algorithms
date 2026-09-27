import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runTarget } from "../src/run.ts";
import { CaseFileError } from "../src/schema.ts";
import { makeProblem, removeTemp, tempDir } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const SUM = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [
    { input: [[1, 2, 3]], expected: 6 },
    { input: [[]], expected: 0 },
  ],
  hidden: [
    { input: [[5, 5]], expected: 10 },
    { input: [[-1, 1]], expected: 0 },
    { input: [[100]], expected: 100 },
  ],
};
const SENTINEL = 987654321;
const SUM_WITH_SENTINEL = { ...SUM, hidden: [{ input: [[5, 5]], expected: 10 }, { input: [[-1, 1]], expected: SENTINEL }] };

const PY = {
  correct: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n",
  length: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        print('debug', nums)\n        return len(nums)\n",
  positives: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(n for n in nums if n > 0)\n",
  sleepy: "import time\n\n\nclass Solution:\n    def solve(self, nums: list[int]) -> int:\n        time.sleep(0.2)\n        return sum(nums)\n",
  loop: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        while nums == [1, 2, 3]:\n            pass\n        return sum(nums)\n",
  chatty: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        for i in range(30):\n            print('line', i)\n        return sum(nums)\n",
  broken: "class Solution:\n    def solve(self, nums)\n        return 0\n",
};
const TS_CORRECT = "export default function solve(nums: number[]): number {\n  return nums.reduce((a, b) => a + b, 0);\n}\n";
const STRESS = 'export default () => [{ name: "n=1e5", input: [Array.from({ length: 100000 }, (_, i) => i % 7)], limitMs: 100 }];\n';

describe("runTarget", () => {
  it("is green in both languages when everything passes", async () => {
    const target = makeProblem(root, "lc-0001-green", SUM, { "solution.py": PY.correct, "solution.ts": TS_CORRECT });
    for (const lang of ["py", "ts"] as const) {
      const result = await runTarget(target, lang, { root });
      expect(result.fatal).toBeNull();
      expect(result.examples).toMatchObject({ passed: 2, total: 2 });
      expect(result.hidden).toEqual({ status: "pass", passed: 3, total: 3, firstFailure: null });
      expect(result.stress).toEqual({ status: "none", cases: [] });
      expect(result.green).toBe(true);
      expect(result.readme).toBe("problems/lc-0001-green/README.md");
      expect(result.solution).toBe(`problems/lc-0001-green/solution.${lang}`);
    }
  });

  it("runs stress cases and flags slow solutions", async () => {
    const fast = makeProblem(root, "lc-0002-stress-fast", SUM, { "solution.py": PY.correct, "stress.ts": STRESS });
    const fastResult = await runTarget(fast, "py", { root });
    expect(fastResult.stress.status).toBe("pass");
    expect(fastResult.stress.cases[0]).toMatchObject({ name: "n=1e5", status: "pass", limitMs: 100 });
    expect(fastResult.green).toBe(true);

    const slow = makeProblem(root, "lc-0003-stress-slow", SUM, { "solution.py": PY.sleepy, "stress.ts": STRESS });
    const slowResult = await runTarget(slow, "py", { root });
    expect(slowResult.stress.status).toBe("fail");
    expect(slowResult.stress.cases[0].status).toBe("slow");
    expect(slowResult.green).toBe(false);
  });

  it("skips hidden and stress when an example fails", async () => {
    const target = makeProblem(root, "lc-0004-example-fail", SUM, { "solution.py": PY.length, "stress.ts": STRESS });
    const result = await runTarget(target, "py", { root });
    expect(result.examples.passed).toBe(1);
    expect(result.examples.cases[0]).toMatchObject({ status: "fail", output: 3, expected: 6, stdout: "debug [1, 2, 3]\n" });
    expect(result.hidden).toEqual({ status: "skipped", passed: 0, total: 3, firstFailure: null });
    expect(result.stress.status).toBe("skipped");
    expect(result.green).toBe(false);
  });

  it("reports only the first failing hidden input and the user's output", async () => {
    const target = makeProblem(root, "lc-0005-hidden-fail", SUM, { "solution.py": PY.positives, "stress.ts": STRESS });
    const result = await runTarget(target, "py", { root });
    expect(result.hidden.status).toBe("fail");
    expect(result.hidden.passed).toBe(2);
    expect(result.hidden.firstFailure).toEqual({ input: [[-1, 1]], output: 1, stdout: "" });
    expect(result.stress.status).toBe("skipped");
  });

  it("never leaks hidden expected values", async () => {
    const target = makeProblem(root, "lc-0006-leak", SUM_WITH_SENTINEL, { "solution.py": PY.correct });
    const result = await runTarget(target, "py", { root });
    expect(result.hidden.status).toBe("fail");
    expect(JSON.stringify(result)).not.toContain(String(SENTINEL));
  });

  it("marks the example in flight as timeout and the rest as skipped", async () => {
    const target = makeProblem(root, "lc-0007-loop", SUM, { "solution.py": PY.loop });
    const result = await runTarget(target, "py", { root, examplesWallMs: 1500 });
    expect(result.examples.cases[0].status).toBe("timeout");
    expect(result.examples.cases[0].error?.kind).toBe("timeout");
    expect(result.examples.cases[1].status).toBe("skipped");
    expect(result.green).toBe(false);
  });

  it("reports load errors as fatal", async () => {
    const target = makeProblem(root, "lc-0008-broken", SUM, { "solution.py": PY.broken });
    const result = await runTarget(target, "py", { root });
    expect(result.fatal?.kind).toBe("load");
    expect(result.examples.cases.every((c) => c.status === "skipped")).toBe(true);
    expect(result.green).toBe(false);
  });

  it("creates a stub when the solution file is missing", async () => {
    const target = makeProblem(root, "lc-0009-stub", SUM);
    const result = await runTarget(target, "py", { root });
    const file = path.join(target.dir, "solution.py");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("def solve(self, nums: list[int]) -> int:");
    expect(result.examples.cases[0].status).toBe("error");
    expect(result.examples.cases[0].error?.message).toMatch(/NotImplementedError/);
  });

  it("truncates captured stdout to 20 lines", async () => {
    const target = makeProblem(root, "lc-0010-chatty", SUM, { "solution.py": PY.chatty });
    const result = await runTarget(target, "py", { root });
    const lines = result.examples.cases[0].stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(21);
    expect(lines[19]).toBe("line 19");
    expect(lines[20]).toBe("… 10 more lines");
  });

  it("refuses to run with unfilled hidden expected values", async () => {
    const target = makeProblem(root, "lc-0011-unfilled", { ...SUM, hidden: [{ input: [[1]] }] }, { "solution.py": PY.correct });
    await expect(runTarget(target, "py", { root })).rejects.toBeInstanceOf(CaseFileError);
  });
});
