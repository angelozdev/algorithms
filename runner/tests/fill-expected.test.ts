import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FillError, fillExpected } from "../src/fill-expected.ts";
import { REPO_ROOT, TSX_BIN } from "../src/paths.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
const refs = tempDir();
afterAll(() => {
  removeTemp(root);
  removeTemp(refs);
});

const CASES = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [{ input: [[1, 2]], expected: 3 }],
  hidden: [{ input: [[4, 4]] }, { input: [[]], expected: 0 }],
};
const SUM_REF = write(refs, "sum/ref.py", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n");
const WRONG_REF = write(refs, "wrong/ref.py", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return len(nums)\n");

const casesOf = (dir: string) => JSON.parse(readFileSync(path.join(dir, "cases.json"), "utf8"));

describe("fillExpected", () => {
  it("fills missing hidden values, keeps existing ones, and formats the file", async () => {
    const target = makeProblem(root, "lc-0001-fill", CASES);
    const result = await fillExpected(target, SUM_REF, root);
    expect(result).toEqual({ filled: 1, warnings: [] });
    expect(casesOf(target.dir).hidden).toEqual([{ input: [[4, 4]], expected: 8 }, { input: [[]], expected: 0 }]);
    expect(readFileSync(path.join(target.dir, "cases.json"), "utf8")).toContain('    {"input":[[4,4]],"expected":8},');
  });

  it("refuses a reference that lives inside the repo", async () => {
    const target = makeProblem(root, "lc-0002-inside", CASES);
    const inside = write(root, "ref.py", "class Solution:\n    def solve(self, nums):\n        return sum(nums)\n");
    await expect(fillExpected(target, inside, root)).rejects.toThrow(/outside the repo/);
  });

  it("refuses a reference that disagrees with an example and writes nothing", async () => {
    const target = makeProblem(root, "lc-0003-disagree", CASES);
    const before = readFileSync(path.join(target.dir, "cases.json"), "utf8");
    await expect(fillExpected(target, WRONG_REF, root)).rejects.toThrow(/disagrees with examples\[0\]/);
    expect(readFileSync(path.join(target.dir, "cases.json"), "utf8")).toBe(before);
  });

  it("stores the judged prefix for in-place problems", async () => {
    const target = makeProblem(root, "lc-0004-inplace", {
      entry: "solve",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
      inPlace: { param: "nums", prefix: "return" },
      examples: [{ input: [[1, 1, 2]], expected: [1, 2] }],
      hidden: [{ input: [[3, 3, 3, 4]] }],
    });
    const ref = write(
      refs,
      "dedupe/ref.py",
      [
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        k = 0",
        "        for n in nums:",
        "            if k == 0 or nums[k - 1] != n:",
        "                nums[k] = n",
        "                k += 1",
        "        return k",
        "",
      ].join("\n"),
    );
    await fillExpected(target, ref, root);
    expect(casesOf(target.dir).hidden[0].expected).toEqual([3, 4]);
  });

  it("wraps any-of answers and warns", async () => {
    const target = makeProblem(root, "lc-0005-anyof", {
      ...CASES,
      compare: "any-of",
      examples: [{ input: [[1, 2]], expected: [3] }],
      hidden: [{ input: [[5]] }],
    });
    const result = await fillExpected(target, SUM_REF, root);
    expect(casesOf(target.dir).hidden[0].expected).toEqual([5]);
    expect(result.warnings[0]).toMatch(/any-of/);
  });

  it("is available from the CLI", () => {
    makeProblem(root, "lc-0006-cli", CASES);
    const run = spawnSync(TSX_BIN, ["runner/src/cli.ts", "fill-expected", "lc-0006", "--ref", SUM_REF], {
      cwd: REPO_ROOT,
      env: { ...process.env, ALGO_ROOT: root },
      encoding: "utf8",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Filled 1 hidden expected value(s) in problems/lc-0006-cli/cases.json.");
  });

  it("uses a FillError for reference problems", async () => {
    const target = makeProblem(root, "lc-0007-ext", CASES);
    const bad = write(refs, "ref.rb", "puts 1\n");
    await expect(fillExpected(target, bad, root)).rejects.toBeInstanceOf(FillError);
  });
});
