import { existsSync, utimesSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runHarness } from "../src/executor.ts";
import { harnessRequest, removeTemp, tempDir, write } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

function solution(name: string, code: string): string {
  return write(dir, `${name}/solution.py`, code);
}

describe("python harness", () => {
  it("runs each case and captures prints per case", async () => {
    const file = solution(
      "sum",
      [
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        print('len', len(nums))",
        "        return sum(nums)",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        cases: [
          { id: "e1", input: [[1, 2, 3]] },
          { id: "e2", input: [[]] },
        ],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("e1")).toMatchObject({ ok: true, output: 6, stdout: "len 3\n" });
    expect(outcome.runs.get("e2")).toMatchObject({ ok: true, output: 0, stdout: "len 0\n" });
    expect(outcome.runs.get("e1")!.ms).toBeGreaterThanOrEqual(0);
  });

  it("converts ListNode and TreeNode in both directions", async () => {
    const lists = solution(
      "reverse",
      [
        "from lc import ListNode",
        "",
        "",
        "class Solution:",
        "    def solve(self, head: ListNode | None) -> ListNode | None:",
        "        prev = None",
        "        while head:",
        "            head.next, prev, head = prev, head, head.next",
        "        return prev",
        "",
      ].join("\n"),
    );
    const listOutcome = await runHarness(
      "py",
      harnessRequest(lists, {
        params: [{ name: "head", type: "ListNode" }],
        returns: "ListNode",
        cases: [
          { id: "a", input: [[1, 2, 3]] },
          { id: "b", input: [[]] },
        ],
      }),
      { wallLimitMs: 5000 },
    );
    expect(listOutcome.runs.get("a")?.output).toEqual([3, 2, 1]);
    expect(listOutcome.runs.get("b")?.output).toEqual([]);

    const trees = solution(
      "invert",
      [
        "from lc import TreeNode",
        "",
        "",
        "class Solution:",
        "    def solve(self, root: TreeNode | None) -> TreeNode | None:",
        "        if root:",
        "            root.left, root.right = self.solve(root.right), self.solve(root.left)",
        "        return root",
        "",
      ].join("\n"),
    );
    const treeOutcome = await runHarness(
      "py",
      harnessRequest(trees, {
        params: [{ name: "root", type: "TreeNode" }],
        returns: "TreeNode",
        cases: [{ id: "t", input: [[4, 2, 7, 1, null, 6, 9]] }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(treeOutcome.runs.get("t")?.output).toEqual([4, 7, 2, 9, 6, null, 1]);
  });

  it("reports the return value and the mutated param for in-place problems", async () => {
    const file = solution(
      "dedupe",
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
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        inPlace: { param: "nums", prefix: "return" },
        cases: [{ id: "a", input: [[1, 1, 2]] }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("a")?.output).toEqual({ ret: 2, param: [1, 2, 2] });
  });

  it("drives class-mode problems op by op", async () => {
    const file = solution(
      "counter",
      [
        "class Counter:",
        "    def __init__(self, start: int) -> None:",
        "        self.value = start",
        "",
        "    def add(self, n: int) -> None:",
        "        self.value += n",
        "",
        "    def get(self) -> int:",
        "        return self.value",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        mode: "class",
        entry: "Counter",
        params: [],
        returns: null,
        cases: [{ id: "c", input: { ops: ["Counter", "add", "get"], args: [[5], [2], []] } }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("c")?.output).toEqual([null, null, 7]);
  });

  it("reports syntax errors as a fatal load error", async () => {
    const file = solution("syntax", "class Solution:\n    def solve(self, nums)\n        return 1\n");
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 5000,
    });
    expect(outcome.fatal?.kind).toBe("load");
    expect(outcome.fatal?.message).toMatch(/SyntaxError/);
    expect(outcome.runs.size).toBe(0);
  });

  it("reports a missing entry point", async () => {
    const file = solution("missing", "class Solution:\n    def other(self):\n        return 1\n");
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 5000,
    });
    expect(outcome.fatal).toEqual({
      kind: "missing-entry",
      message: 'expected method "solve" in class Solution',
      trace: "",
    });
  });

  it("reports runtime exceptions with frames from the user's file only", async () => {
    const file = solution(
      "boom",
      "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return nums[10]\n",
    );
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 5000,
    });
    const run = outcome.runs.get("a");
    expect(run?.ok).toBe(false);
    expect(run?.error?.kind).toBe("exception");
    expect(run?.error?.message).toMatch(/IndexError/);
    expect(run?.error?.trace).toContain("line 3, in solve: return nums[10]");
    expect(run?.error?.trace).not.toContain("harness.py");
  });

  it("reports non-JSON return values as serialization errors", async () => {
    const file = solution(
      "set",
      "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return set(nums)\n",
    );
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1, 2]] }] }), {
      wallLimitMs: 5000,
    });
    expect(outcome.runs.get("a")?.error?.kind).toBe("serialization");
    expect(outcome.runs.get("a")?.error?.message).toMatch(/set/);
  });

  it("round-trips non-ASCII strings", async () => {
    const file = solution(
      "unicode",
      "class Solution:\n    def solve(self, s: str) -> str:\n        return s[::-1]\n",
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        params: [{ name: "s", type: "string" }],
        returns: "string",
        cases: [{ id: "a", input: ["ñandú 🎵"] }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("a")?.output).toBe("🎵 údnañ");
  });

  it("caps runaway prints and still finishes the case", async () => {
    const file = solution(
      "flood",
      [
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        for i in range(200_000):",
        "            print('line', i)",
        "        return 1",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    const run = outcome.runs.get("a");
    expect(run?.ok).toBe(true);
    expect(run?.stdout.length).toBeLessThan(70 * 1024);
    expect(run?.stdout).toMatch(/… output truncated\n$/);
  });

  it("kills infinite loops at the wall-clock limit and names the case in flight", async () => {
    const file = solution(
      "loop",
      "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        while nums[0] == 0:\n            pass\n        return 1\n",
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        cases: [
          { id: "ok", input: [[1]] },
          { id: "stuck", input: [[0]] },
          { id: "never", input: [[1]] },
        ],
      }),
      { wallLimitMs: 1500 },
    );
    expect(outcome.runs.get("ok")?.ok).toBe(true);
    expect(outcome.timedOutCase).toBe("stuck");
    expect(outcome.runs.has("never")).toBe(false);
  });

  it("runs the current source after a same-size edit with an unchanged mtime", async () => {
    const code = (value: number): string =>
      `class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return ${value}\n`;
    const stamp = new Date("2026-01-01T00:00:00Z");
    const file = solution("edit", code(1));
    utimesSync(file, stamp, stamp);
    const request = harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] });
    const before = await runHarness("py", request, { wallLimitMs: 5000 });
    expect(before.runs.get("a")?.output).toBe(1);

    write(dir, "edit/solution.py", code(2));
    utimesSync(file, stamp, stamp);
    const after = await runHarness("py", request, { wallLimitMs: 5000 });
    expect(after.runs.get("a")?.output).toBe(2);
    expect(existsSync(path.join(path.dirname(file), "__pycache__"))).toBe(false);
  });

  it("returns null outputs when discardOutput is set", async () => {
    const file = solution("discard", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return 5\n");
    const outcome = await runHarness(
      "py",
      harnessRequest(file, { discardOutput: true, cases: [{ id: "a", input: [[1]] }] }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("a")).toMatchObject({ ok: true, output: null });
  });
});
