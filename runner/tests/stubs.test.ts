import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runHarness } from "../src/executor.ts";
import { ensureSolution, pyType, renderStub, solutionPath, tsType } from "../src/stubs.ts";
import type { CaseFile, Target } from "../src/types.ts";
import { removeTemp, tempDir, write } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

const base: CaseFile = {
  mode: "function",
  entry: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
  compare: "exact",
  inPlace: null,
  examples: [],
  hidden: [],
};

describe("type mapping", () => {
  it("maps nested and nullable types", () => {
    expect(pyType("string[][]")).toBe("list[list[str]]");
    expect(pyType("ListNode[]")).toBe("list[ListNode | None]");
    expect(pyType("void")).toBe("None");
    expect(tsType("int[][]")).toBe("number[][]");
    expect(tsType("ListNode[]")).toBe("(ListNode | null)[]");
    expect(tsType("bool")).toBe("boolean");
  });
});

describe("renderStub", () => {
  it("renders LeetCode-shaped function stubs", () => {
    expect(renderStub(base, "py")).toBe(
      "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        raise NotImplementedError\n",
    );
    expect(renderStub(base, "ts")).toBe(
      'export default function twoSum(nums: number[], target: number): number[] {\n  throw new Error("Not implemented");\n}\n',
    );
  });

  it("imports node classes from lc only when the signature uses them", () => {
    const merge: CaseFile = {
      ...base,
      entry: "mergeTwoLists",
      params: [
        { name: "list1", type: "ListNode" },
        { name: "list2", type: "ListNode" },
      ],
      returns: "ListNode",
    };
    expect(renderStub(merge, "py")).toBe(
      "from lc import ListNode  # delete this line when pasting into LeetCode\n\n\n" +
        "class Solution:\n    def mergeTwoLists(self, list1: ListNode | None, list2: ListNode | None) -> ListNode | None:\n        raise NotImplementedError\n",
    );
    expect(renderStub(merge, "ts")).toBe(
      'import { ListNode } from "lc"; // delete this line when pasting into LeetCode\n\n' +
        'export default function mergeTwoLists(list1: ListNode | null, list2: ListNode | null): ListNode | null {\n  throw new Error("Not implemented");\n}\n',
    );
  });

  it("renders empty classes in class mode", () => {
    const design: CaseFile = { ...base, mode: "class", entry: "MinStack", params: [], returns: null };
    expect(renderStub(design, "py")).toBe("class MinStack:\n    def __init__(self) -> None:\n        pass\n");
    expect(renderStub(design, "ts")).toBe("export default class MinStack {\n  constructor() {}\n}\n");
  });
});

describe("ensureSolution and solutionPath", () => {
  it("creates the stub under .study once, never overwrites it, and writes .study/tsconfig.json with it", () => {
    const target: Target = { id: "lc-0301", kind: "problem", dir: path.join(dir, "problems", "lc-0301-stub"), title: "Stub" };
    const first = ensureSolution(target, base, "py");
    expect(first).toEqual({ path: path.join(dir, ".study", "solutions", "problems", "lc-0301", "solution.py"), created: true });
    expect(readFileSync(first.path, "utf8")).toBe(renderStub(base, "py"));
    expect(existsSync(path.join(dir, ".study", "tsconfig.json"))).toBe(true);
    writeFileSync(first.path, "# my work\n");
    expect(ensureSolution(target, { ...base, entry: "other" }, "py")).toEqual({ path: first.path, created: false });
    expect(readFileSync(first.path, "utf8")).toBe("# my work\n");
  });

  it("keeps using a solution that still sits in the content folder (before pnpm study migrate)", () => {
    const target: Target = { id: "lc-0302", kind: "problem", dir: path.join(dir, "problems", "lc-0302-legacy"), title: "Legacy" };
    const legacy = write(target.dir, "solution.ts", "// the user's work\n");
    expect(solutionPath(target, "ts")).toBe(legacy);
    expect(ensureSolution(target, base, "ts")).toEqual({ path: legacy, created: false });
    expect(existsSync(path.join(dir, ".study", "solutions", "problems", "lc-0302"))).toBe(false);
    expect(solutionPath(target, "py")).toBe(path.join(dir, ".study", "solutions", "problems", "lc-0302", "solution.py"));
  });

  it("puts an exercise's solution under .study/solutions/exercises/<concept>/<NN>", () => {
    const target: Target = {
      id: "hash-map/01",
      kind: "exercise",
      dir: path.join(dir, "concepts", "hash-map", "exercises", "01-first-repeat"),
      title: "First repeat",
    };
    expect(ensureSolution(target, base, "py").path).toBe(path.join(dir, ".study", "solutions", "exercises", "hash-map", "01", "solution.py"));
  });
});

describe("stubs for the Grind 75 runner features", () => {
  const cf = (overrides: Partial<CaseFile>): CaseFile => ({ ...base, ...overrides });
  const cycle = cf({
    entry: "hasCycle",
    params: [
      { name: "head", type: "ListNode" },
      { name: "pos", type: "int", cycle: "head" },
    ],
    returns: "bool",
  });
  const refs = cf({
    entry: "lowestCommonAncestor",
    params: [
      { name: "root", type: "TreeNode" },
      { name: "p", type: "TreeNode", ref: "root" },
    ],
    returns: "TreeNode.val",
  });
  const graph = cf({ entry: "cloneGraph", params: [{ name: "node", type: "GraphNode" }], returns: "GraphNode" });
  const api = cf({
    entry: "firstBadVersion",
    params: [
      { name: "n", type: "int" },
      { name: "bad", type: "int", api: "isBadVersion" },
    ],
    returns: "int",
  });
  const codec = cf({ mode: "codec", entry: "Codec", params: [{ name: "root", type: "TreeNode" }], returns: null });

  it("leaves cycle params out of the signature", () => {
    expect(renderStub(cycle, "py")).toBe(
      "from lc import ListNode  # delete this line when pasting into LeetCode\n\n\nclass Solution:\n    def hasCycle(self, head: ListNode | None) -> bool:\n        raise NotImplementedError\n",
    );
    expect(renderStub(cycle, "ts")).toBe(
      'import { ListNode } from "lc"; // delete this line when pasting into LeetCode\n\nexport default function hasCycle(head: ListNode | null): boolean {\n  throw new Error("Not implemented");\n}\n',
    );
  });

  it("types ref params and TreeNode.val returns as tree nodes", () => {
    expect(renderStub(refs, "ts")).toContain(
      "export default function lowestCommonAncestor(root: TreeNode | null, p: TreeNode | null): TreeNode | null {",
    );
    expect(renderStub(refs, "py")).toContain(
      "    def lowestCommonAncestor(self, root: TreeNode | None, p: TreeNode | None) -> TreeNode | None:",
    );
  });

  it("names graph nodes as LeetCode does: _Node in TypeScript, Node in Python", () => {
    expect(renderStub(graph, "ts")).toBe(
      'import { _Node } from "lc"; // delete this line when pasting into LeetCode\n\nexport default function cloneGraph(node: _Node | null): _Node | null {\n  throw new Error("Not implemented");\n}\n',
    );
    expect(renderStub(graph, "py")).toBe(
      "from lc import Node  # delete this line when pasting into LeetCode\n\n\nclass Solution:\n    def cloneGraph(self, node: Node | None) -> Node | None:\n        raise NotImplementedError\n",
    );
  });

  it("writes an api problem as LeetCode's factory in TypeScript and a global in Python", () => {
    expect(renderStub(api, "ts")).toBe(
      'export default function solution(isBadVersion: (version: number) => boolean) {\n  return function firstBadVersion(n: number): number {\n    throw new Error("Not implemented");\n  };\n}\n',
    );
    expect(renderStub(api, "py")).toBe(
      "from lc import isBadVersion  # delete this line when pasting into LeetCode\n\n\nclass Solution:\n    def firstBadVersion(self, n: int) -> int:\n        raise NotImplementedError\n",
    );
  });

  it("writes codec mode as two functions in TypeScript and a class in Python", () => {
    expect(renderStub(codec, "ts")).toBe(
      [
        'import { TreeNode } from "lc"; // delete this line when pasting into LeetCode',
        "",
        "/** Encodes a value to a single string. */",
        "export function serialize(root: TreeNode | null): string {",
        '  throw new Error("Not implemented");',
        "}",
        "",
        "/** Decodes your encoded data back to the value. */",
        "export function deserialize(data: string): TreeNode | null {",
        '  throw new Error("Not implemented");',
        "}",
        "",
      ].join("\n"),
    );
    expect(renderStub(codec, "py")).toBe(
      [
        "from lc import TreeNode  # delete this line when pasting into LeetCode",
        "",
        "",
        "class Codec:",
        "    def serialize(self, root: TreeNode | None) -> str:",
        "        raise NotImplementedError",
        "",
        "    def deserialize(self, data: str) -> TreeNode | None:",
        "        raise NotImplementedError",
        "",
      ].join("\n"),
    );
  });

  it("produces stubs the harnesses load: they reach the solution and raise Not implemented", async () => {
    const stubs = tempDir();
    try {
      const cases = (input: unknown) => [{ id: "e1", input }];
      const request = (file: string, c: CaseFile, input: unknown) => ({
        solutionPath: file,
        mode: c.mode,
        entry: c.entry,
        params: c.params,
        returns: c.returns,
        inPlace: null,
        discardOutput: false,
        cases: cases(input),
      });
      const tsApi = await runHarness("ts", request(write(stubs, "api/solution.ts", renderStub(api, "ts")), api, [5, 4]), { wallLimitMs: 10_000 });
      expect(tsApi.runs.get("e1")).toMatchObject({ ok: false, error: { kind: "exception", message: "Error: Not implemented" } });
      const pyCodec = await runHarness("py", request(write(stubs, "codec/solution.py", renderStub(codec, "py")), codec, [[1]]), { wallLimitMs: 5000 });
      expect(pyCodec.runs.get("e1")).toMatchObject({ ok: false, error: { kind: "exception", message: "NotImplementedError: " } });
      const pyGraph = await runHarness("py", request(write(stubs, "graph/solution.py", renderStub(graph, "py")), graph, [[[2], [1]]]), { wallLimitMs: 5000 });
      expect(pyGraph.runs.get("e1")).toMatchObject({ ok: false, error: { kind: "exception", message: "NotImplementedError: " } });
    } finally {
      removeTemp(stubs);
    }
  });
});
