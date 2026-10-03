import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CustomInputError, runCustom } from "../src/custom.ts";
import { CaseFileError } from "../src/schema.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const SUM = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [{ input: [[1, 2]], expected: 3 }],
  hidden: [],
};

describe("runCustom", () => {
  it("returns the output and the prints in Python and TypeScript", async () => {
    const target = makeProblem(root, "lc-0101-custom", SUM, {
      "solution.py":
        "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        print('got', nums)\n        return sum(nums)\n",
      "solution.ts":
        "export default function solve(nums: number[]): number {\n  console.log('got', nums.length);\n  return nums.reduce((a, b) => a + b, 0);\n}\n",
    });
    const py = await runCustom(target, "py", [[4, 5, 6]]);
    expect(py).toMatchObject({ fatal: null, output: 15, stdout: "got [4, 5, 6]\n" });
    expect(py.ms).toBeGreaterThanOrEqual(0);
    const ts = await runCustom(target, "ts", [[4, 5, 6]]);
    expect(ts).toMatchObject({ fatal: null, output: 15, stdout: "got 3\n" });
  });

  it("returns the value and the modified parameter for in-place problems", async () => {
    const target = makeProblem(
      root,
      "lc-0102-inplace",
      {
        entry: "removeValue",
        params: [
          { name: "nums", type: "int[]" },
          { name: "val", type: "int" },
        ],
        returns: "int",
        inPlace: { param: "nums", prefix: "return" },
        examples: [{ input: [[3, 2, 2, 3], 3], expected: [2, 2] }],
        hidden: [],
      },
      {
        "solution.py":
          "class Solution:\n    def removeValue(self, nums: list[int], val: int) -> int:\n        nums[:] = [n for n in nums if n != val]\n        return len(nums)\n",
      },
    );
    expect((await runCustom(target, "py", [[1, 3, 1], 3])).output).toEqual({ ret: 2, param: [1, 1] });
  });

  it("runs class problems from ops and args", async () => {
    const target = makeProblem(
      root,
      "lc-0103-class",
      {
        mode: "class",
        entry: "Counter",
        examples: [{ input: { ops: ["Counter", "add", "get"], args: [[], [2], []] }, expected: [null, null, 2] }],
        hidden: [],
      },
      {
        "solution.py":
          "class Counter:\n    def __init__(self) -> None:\n        self.total = 0\n\n    def add(self, n: int) -> None:\n        self.total += n\n\n    def get(self) -> int:\n        return self.total\n",
      },
    );
    const result = await runCustom(target, "py", { ops: ["Counter", "add", "add", "get"], args: [[], [2], [3], []] });
    expect(result.output).toEqual([null, null, null, 5]);
  });

  it("reports an exception with its trace, a load error as fatal, and a loop as a timeout", async () => {
    const target = makeProblem(root, "lc-0104-errors", SUM, {
      "solution.py": "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return nums[10]\n",
    });
    const thrown = await runCustom(target, "py", [[1]]);
    expect(thrown.fatal).toBeNull();
    expect(thrown.error?.kind).toBe("exception");
    expect(thrown.error?.message).toMatch(/IndexError/);
    expect(thrown.error?.trace).toContain("line 3");

    write(target.dir, "solution.py", "class Solution:\n    def solve(self, nums)\n        return 0\n");
    expect((await runCustom(target, "py", [[1]])).fatal?.kind).toBe("load");

    write(target.dir, "solution.py", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        while True:\n            pass\n");
    const loop = await runCustom(target, "py", [[1]], { wallMs: 1500 });
    expect(loop.error?.kind).toBe("timeout");
  });

  it("rejects an input that does not fit the signature before running anything", async () => {
    const target = makeProblem(root, "lc-0105-mismatch", SUM);
    await expect(runCustom(target, "py", [[1], 2])).rejects.toThrow(CustomInputError);
    await expect(runCustom(target, "py", [[1], 2])).rejects.toMatchObject({
      issues: ["custom.input: expected 1 params, got 2"],
    });
    expect(existsSync(path.join(target.dir, "solution.py"))).toBe(false);
    write(target.dir, "cases.json", "{ nope");
    await expect(runCustom(target, "py", [[1]])).rejects.toThrow(CaseFileError);
  });

  it("keeps a print flood to 20 lines", async () => {
    const target = makeProblem(root, "lc-0106-flood", SUM, {
      "solution.py":
        "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        for i in range(100000):\n            print(i)\n        return 0\n",
    });
    const result = await runCustom(target, "py", [[1]]);
    expect(result.output).toBe(0);
    const lines = result.stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(21);
    expect(lines[20]).toMatch(/^… \d+ more lines$/);
  });
});
