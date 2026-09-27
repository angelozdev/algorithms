import { afterAll, describe, expect, it } from "vitest";
import { runHarness } from "../src/executor.ts";
import { harnessRequest, removeTemp, tempDir, write } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

function solution(name: string, code: string): string {
  return write(dir, `${name}/solution.ts`, code);
}

describe("typescript harness", () => {
  it("runs cases and captures console.log, console.error and log from 'console'", async () => {
    const file = solution(
      "sum",
      [
        'import { log } from "console";',
        "export default function solve(nums: number[]): number {",
        '  console.log("len", nums.length);',
        '  console.error("err");',
        '  log("via log");',
        "  return nums.reduce((a, b) => a + b, 0);",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, { cases: [{ id: "e1", input: [[1, 2, 3]] }] }),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("e1")).toMatchObject({
      ok: true,
      output: 6,
      stdout: "len 3\nerr\nvia log\n",
    });
  });

  it("resolves `lc` and converts ListNode and TreeNode", async () => {
    const lists = solution(
      "reverse",
      [
        'import { ListNode } from "lc";',
        "export default function solve(head: ListNode | null): ListNode | null {",
        "  let prev: ListNode | null = null;",
        "  while (head) { const next: ListNode | null = head.next; head.next = prev; prev = head; head = next; }",
        "  return prev;",
        "}",
        "",
      ].join("\n"),
    );
    const listOutcome = await runHarness(
      "ts",
      harnessRequest(lists, {
        params: [{ name: "head", type: "ListNode" }],
        returns: "ListNode",
        cases: [
          { id: "a", input: [[1, 2, 3]] },
          { id: "b", input: [[]] },
        ],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(listOutcome.fatal).toBeNull();
    expect(listOutcome.runs.get("a")?.output).toEqual([3, 2, 1]);
    expect(listOutcome.runs.get("b")?.output).toEqual([]);

    const trees = solution(
      "invert",
      [
        'import { TreeNode } from "lc";',
        "export default function solve(root: TreeNode | null): TreeNode | null {",
        "  if (root) { const left = root.left; root.left = solve(root.right); root.right = solve(left); }",
        "  return root;",
        "}",
        "",
      ].join("\n"),
    );
    const treeOutcome = await runHarness(
      "ts",
      harnessRequest(trees, {
        params: [{ name: "root", type: "TreeNode" }],
        returns: "TreeNode",
        cases: [{ id: "t", input: [[4, 2, 7, 1, null, 6, 9]] }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(treeOutcome.runs.get("t")?.output).toEqual([4, 7, 2, 9, 6, null, 1]);
  });

  it("reports in-place results and class-mode results", async () => {
    const dedupe = solution(
      "dedupe",
      [
        "export default function solve(nums: number[]): number {",
        "  let k = 0;",
        "  for (const n of nums) if (k === 0 || nums[k - 1] !== n) nums[k++] = n;",
        "  return k;",
        "}",
        "",
      ].join("\n"),
    );
    const inPlace = await runHarness(
      "ts",
      harnessRequest(dedupe, {
        inPlace: { param: "nums", prefix: "return" },
        cases: [{ id: "a", input: [[1, 1, 2]] }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(inPlace.runs.get("a")?.output).toEqual({ ret: 2, param: [1, 2, 2] });

    const counter = solution(
      "counter",
      [
        "export default class Counter {",
        "  value: number;",
        "  constructor(start: number) { this.value = start; }",
        "  add(n: number): void { this.value += n; }",
        "  get(): number { return this.value; }",
        "}",
        "",
      ].join("\n"),
    );
    const classMode = await runHarness(
      "ts",
      harnessRequest(counter, {
        mode: "class",
        entry: "Counter",
        params: [],
        returns: null,
        cases: [{ id: "c", input: { ops: ["Counter", "add", "get"], args: [[5], [2], []] } }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(classMode.runs.get("c")?.output).toEqual([null, null, 7]);
  });

  it("reports load errors and missing default exports", async () => {
    const broken = solution("broken", "export default function solve(nums: number[] {\n  return 1;\n}\n");
    const load = await runHarness("ts", harnessRequest(broken, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(load.fatal?.kind).toBe("load");

    const named = solution("named", "export function solve(nums: number[]): number {\n  return 1;\n}\n");
    const missing = await runHarness("ts", harnessRequest(named, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(missing.fatal).toEqual({
      kind: "missing-entry",
      message: 'expected default export function "solve"',
      trace: "",
    });
  });

  it("reports runtime errors with frames from the user's file", async () => {
    const file = solution(
      "boom",
      "export default function solve(nums: number[]): number {\n  return (nums as any).missing.length;\n}\n",
    );
    const outcome = await runHarness("ts", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    const run = outcome.runs.get("a");
    expect(run?.error?.kind).toBe("exception");
    expect(run?.error?.message).toMatch(/TypeError/);
    expect(run?.error?.trace).toContain("solution.ts:2");
    expect(run?.error?.trace).not.toContain("harness.ts");
  });

  it("reports Map and NaN return values as serialization errors", async () => {
    const map = solution("map", "export default function solve(nums: number[]): unknown {\n  return new Map();\n}\n");
    const mapOutcome = await runHarness("ts", harnessRequest(map, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(mapOutcome.runs.get("a")?.error?.kind).toBe("serialization");
    expect(mapOutcome.runs.get("a")?.error?.message).toMatch(/Map/);

    const nan = solution("nan", "export default function solve(nums: number[]): number {\n  return 0 / 0;\n}\n");
    const nanOutcome = await runHarness("ts", harnessRequest(nan, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(nanOutcome.runs.get("a")?.error?.kind).toBe("serialization");
  });

  it("round-trips non-ASCII strings", async () => {
    const file = solution(
      "unicode",
      "export default function solve(s: string): string {\n  return [...s].reverse().join('');\n}\n",
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, {
        params: [{ name: "s", type: "string" }],
        returns: "string",
        cases: [{ id: "a", input: ["ñandú 🎵"] }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.runs.get("a")?.output).toBe("🎵 údnañ");
  });

  it("caps runaway prints and still finishes the case", async () => {
    const file = solution(
      "flood",
      "export default function solve(nums: number[]): number {\n  for (let i = 0; i < 200_000; i++) console.log('line', i);\n  return 1;\n}\n",
    );
    const outcome = await runHarness("ts", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 15_000,
    });
    const run = outcome.runs.get("a");
    expect(run?.ok).toBe(true);
    expect(run?.stdout.length).toBeLessThan(70 * 1024);
    expect(run?.stdout).toMatch(/… output truncated\n$/);
  });

  it("kills infinite loops at the wall-clock limit", async () => {
    const file = solution(
      "loop",
      "export default function solve(nums: number[]): number {\n  while (nums[0] === 0) {}\n  return 1;\n}\n",
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, {
        cases: [
          { id: "ok", input: [[1]] },
          { id: "stuck", input: [[0]] },
        ],
      }),
      { wallLimitMs: 3000 },
    );
    expect(outcome.runs.get("ok")?.ok).toBe(true);
    expect(outcome.timedOutCase).toBe("stuck");
  });
});
