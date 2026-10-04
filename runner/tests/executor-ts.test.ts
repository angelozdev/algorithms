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

describe("typescript harness: graphs and node values (Grind 75 spec §3.2, §3.3)", () => {
  const graph = (file: string, cases: { id: string; input: unknown }[]) =>
    harnessRequest(file, { params: [{ name: "node", type: "GraphNode" }], returns: "GraphNode", cases });

  it("builds a graph from its adjacency list and reads a returned graph back", async () => {
    const file = solution(
      "graph-fixed",
      [
        'import { _Node } from "lc";',
        "export default function solve(node: _Node | null): _Node | null {",
        "  if (!node) return null;",
        "  if (node.neighbors.length === 0) return new _Node(1);",
        "  const one = new _Node(1);",
        "  const two = new _Node(2);",
        "  one.neighbors = [two];",
        "  two.neighbors = [one];",
        "  return node.neighbors[0].neighbors[0] === node ? one : null;",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      graph(file, [
        { id: "pair", input: [[[2], [1]]] },
        { id: "single", input: [[[]]] },
        { id: "empty", input: [[]] },
      ]),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("pair")?.output).toEqual([[2], [1]]);
    expect(outcome.runs.get("single")?.output).toEqual([[]]);
    expect(outcome.runs.get("empty")?.output).toEqual([]);
  });

  it("fails a returned input node, unnumbered nodes and a bad neighbor with readable messages", async () => {
    const same = solution(
      "graph-same",
      ['import { _Node } from "lc";', "export default function solve(node: _Node | null): _Node | null {", "  return node;", "}", ""].join("\n"),
    );
    const fresh = solution(
      "graph-default",
      ['import { _Node } from "lc";', "export default function solve(node: _Node | null): _Node | null {", "  return new _Node();", "}", ""].join("\n"),
    );
    const sameOutcome = await runHarness(
      "ts",
      graph(same, [
        { id: "copy", input: [[[2], [1]]] },
        { id: "neighbor", input: [[[3], [1]]] },
      ]),
      { wallLimitMs: 10_000 },
    );
    expect(sameOutcome.runs.get("copy")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "returned a node of the input graph: return a copy" },
    });
    expect(sameOutcome.runs.get("neighbor")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "node 1 lists neighbor 3, but the graph has nodes 1..2" },
    });
    const freshOutcome = await runHarness("ts", graph(fresh, [{ id: "zero", input: [[[2], [1]]] }]), { wallLimitMs: 10_000 });
    expect(freshOutcome.runs.get("zero")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "graph node values must be 1..1, each used once" },
    });
  });

  it("judges a returned tree node by its value", async () => {
    const file = solution(
      "node-value",
      [
        'import { TreeNode } from "lc";',
        "export default function solve(root: TreeNode | null): TreeNode | null {",
        "  if (root && root.val === 7) return 7 as unknown as TreeNode;",
        "  return root?.left ?? null;",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, {
        params: [{ name: "root", type: "TreeNode" }],
        returns: "TreeNode.val",
        cases: [
          { id: "left", input: [[2, 1, 3]] },
          { id: "none", input: [[2]] },
          { id: "number", input: [[7]] },
        ],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.runs.get("left")?.output).toBe(1);
    expect(outcome.runs.get("none")?.output).toBeNull();
    expect(outcome.runs.get("number")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "expected a TreeNode, got number" },
    });
  });
});

describe("typescript harness: cycle and ref params (Grind 75 spec §3.1, §3.2)", () => {
  it("links the tail back to node pos, passes only the list, and keeps pos = -1 a plain list", async () => {
    const file = solution(
      "cycle",
      [
        'import { ListNode } from "lc";',
        "export default function solve(...args: unknown[]): number {",
        "  let node = args[0] as ListNode | null;",
        "  for (let step = 0; step < 4 && node; step++) node = node.next;",
        "  if (args.length !== 1) return -99;",
        "  return node ? node.val : -1;",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, {
        params: [
          { name: "head", type: "ListNode" },
          { name: "pos", type: "int", cycle: "head" },
        ],
        returns: "int",
        cases: [
          { id: "loop", input: [[3, 2, 0, -4], 1] },
          { id: "plain", input: [[3, 2, 0, -4], -1] },
          { id: "far", input: [[3, 2], 5] },
        ],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.runs.get("loop")?.output).toBe(2);
    expect(outcome.runs.get("plain")?.output).toBe(-1);
    expect(outcome.runs.get("far")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "pos = 5 is out of range for head (2 nodes)" },
    });
  });

  it("hands ref params over as the nodes inside the tree", async () => {
    const file = solution(
      "refs",
      [
        'import { TreeNode } from "lc";',
        "export default function solve(root: TreeNode | null, p: TreeNode | null, q: TreeNode | null): TreeNode | null {",
        "  if (root && root.left === p && root.right === q) return root;",
        "  return q;",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, {
        params: [
          { name: "root", type: "TreeNode" },
          { name: "p", type: "TreeNode", ref: "root" },
          { name: "q", type: "TreeNode", ref: "root" },
        ],
        returns: "TreeNode.val",
        cases: [
          { id: "children", input: [[2, 1, 3], 1, 3] },
          { id: "swapped", input: [[2, 1, 3], 3, 1] },
          { id: "null", input: [[2, 1, 3], 1, null] },
          { id: "missing", input: [[2, 1, 3], 9, 1] },
        ],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.runs.get("children")?.output).toBe(2);
    expect(outcome.runs.get("swapped")?.output).toBe(1);
    expect(outcome.runs.get("null")?.output).toBeNull();
    expect(outcome.runs.get("missing")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "p = 9 is not a value in root" },
    });
  });
});

describe("typescript harness: api params (Grind 75 spec §3.4)", () => {
  const api = (file: string, cases: { id: string; input: unknown }[]) =>
    harnessRequest(file, {
      params: [
        { name: "n", type: "int" },
        { name: "bad", type: "int", api: "isBadVersion" },
      ],
      returns: "int",
      cases,
    });

  it("calls the default export with the judge's functions, then runs the function it returns", async () => {
    const file = solution(
      "api",
      [
        "export default function solution(isBadVersion: (version: number) => boolean) {",
        "  return function solve(...args: number[]): number {",
        "    if (args.length !== 1) return -99;",
        "    const n = args[0];",
        "    if (!isBadVersion(n)) return 0;",
        "    return isBadVersion(n - 1) ? -1 : n;",
        "  };",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      api(file, [
        { id: "first", input: [5, 5] },
        { id: "earlier", input: [5, 3] },
        { id: "none", input: [5, 6] },
      ]),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("first")?.output).toBe(5);
    expect(outcome.runs.get("earlier")?.output).toBe(-1);
    expect(outcome.runs.get("none")?.output).toBe(0);
  });

  it("fails the case when the default export does not return a function", async () => {
    const file = solution("api-value", ["export default function solution(isBadVersion: unknown) {", "  return 42;", "}", ""].join("\n"));
    const outcome = await runHarness("ts", api(file, [{ id: "e1", input: [5, 4] }]), { wallLimitMs: 10_000 });
    expect(outcome.runs.get("e1")).toMatchObject({
      ok: false,
      error: { kind: "missing-entry", message: "the default export must return the solution function when called with isBadVersion" },
    });
  });
});

describe("typescript harness: codec mode (Grind 75 spec §3.5)", () => {
  const codec = (file: string, cases: { id: string; input: unknown }[]) =>
    harnessRequest(file, { mode: "codec", entry: "Codec", params: [{ name: "root", type: "TreeNode" }], returns: null, cases });

  it("runs deserialize(serialize(value)) and judges the rebuilt value", async () => {
    const file = solution(
      "codec-fixed",
      [
        'import { TreeNode } from "lc";',
        "export function serialize(root: TreeNode | null): string {",
        '  return root ? "tree" : "";',
        "}",
        "export function deserialize(data: string): TreeNode | null {",
        '  return data === "" ? null : new TreeNode(1, new TreeNode(2));',
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      codec(file, [
        { id: "tree", input: [[1, 2]] },
        { id: "empty", input: [[]] },
      ]),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("tree")?.output).toEqual([1, 2]);
    expect(outcome.runs.get("empty")?.output).toEqual([]);
  });

  it("fails a serialize that returns no string and a deserialize that hands back the input nodes", async () => {
    const file = solution(
      "codec-kept",
      [
        'import { TreeNode } from "lc";',
        "let kept: TreeNode | null = null;",
        "export function serialize(root: TreeNode | null): string {",
        "  kept = root;",
        '  return root && root.val === 0 ? (42 as unknown as string) : "kept";',
        "}",
        "export function deserialize(_data: string): TreeNode | null {",
        "  return kept;",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      codec(file, [
        { id: "number", input: [[0]] },
        { id: "kept", input: [[1, 2]] },
      ]),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.runs.get("number")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "serialize must return a string, got number" },
    });
    expect(outcome.runs.get("kept")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "deserialize returned nodes of the input: build new ones from the string" },
    });
  });

  it("needs both named exports", async () => {
    const file = solution("codec-half", ["export function serialize(root: unknown): string {", '  return "";', "}", ""].join("\n"));
    const outcome = await runHarness("ts", codec(file, [{ id: "e1", input: [[1]] }]), { wallLimitMs: 10_000 });
    expect(outcome.fatal).toMatchObject({ kind: "missing-entry", message: 'expected exported functions "serialize" and "deserialize"' });
  });
});
