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

  it("loads solutions that define dataclasses with quoted forward references", async () => {
    const file = solution(
      "dataclass",
      [
        "from dataclasses import dataclass",
        "",
        "",
        "@dataclass",
        "class Node:",
        "    key: int",
        '    next: "Node | None" = None',
        "",
        "",
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        head = None",
        "        for n in nums:",
        "            head = Node(n, head)",
        "        return head.key",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1, 2, 3]] }] }), {
      wallLimitMs: 5000,
    });
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("a")).toMatchObject({ ok: true, output: 3 });
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

describe("python harness: graphs and node values (Grind 75 spec §3.2, §3.3)", () => {
  const graph = (file: string, cases: { id: string; input: unknown }[]) =>
    harnessRequest(file, { params: [{ name: "node", type: "GraphNode" }], returns: "GraphNode", cases });

  it("builds a graph from its adjacency list and reads a returned graph back", async () => {
    const file = solution(
      "graph-fixed",
      [
        "from lc import Node",
        "",
        "",
        "class Solution:",
        "    def solve(self, node):",
        "        if node is None:",
        "            return None",
        "        if not node.neighbors:",
        "            return Node(1)",
        "        one, two = Node(1), Node(2)",
        "        one.neighbors, two.neighbors = [two], [one]",
        "        return one if node.neighbors[0].neighbors[0] is node else None",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      graph(file, [
        { id: "pair", input: [[[2], [1]]] },
        { id: "single", input: [[[]]] },
        { id: "empty", input: [[]] },
      ]),
      { wallLimitMs: 5000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("pair")?.output).toEqual([[2], [1]]);
    expect(outcome.runs.get("single")?.output).toEqual([[]]);
    expect(outcome.runs.get("empty")?.output).toEqual([]);
  });

  it("fails a returned input node, unnumbered nodes and a bad neighbor with readable messages", async () => {
    const same = solution("graph-same", ["class Solution:", "    def solve(self, node):", "        return node", ""].join("\n"));
    const fresh = solution(
      "graph-default",
      ["from lc import Node", "", "", "class Solution:", "    def solve(self, node):", "        return Node()", ""].join("\n"),
    );
    const sameOutcome = await runHarness(
      "py",
      graph(same, [
        { id: "copy", input: [[[2], [1]]] },
        { id: "neighbor", input: [[[3], [1]]] },
      ]),
      { wallLimitMs: 5000 },
    );
    expect(sameOutcome.runs.get("copy")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "returned a node of the input graph: return a copy" },
    });
    expect(sameOutcome.runs.get("neighbor")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "node 1 lists neighbor 3, but the graph has nodes 1..2" },
    });
    const freshOutcome = await runHarness("py", graph(fresh, [{ id: "zero", input: [[[2], [1]]] }]), { wallLimitMs: 5000 });
    expect(freshOutcome.runs.get("zero")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "graph node values must be 1..1, each used once" },
    });
  });

  it("judges a returned tree node by its value", async () => {
    const file = solution(
      "node-value",
      [
        "class Solution:",
        "    def solve(self, root):",
        "        if root is not None and root.val == 7:",
        "            return 7",
        "        return root.left if root else None",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        params: [{ name: "root", type: "TreeNode" }],
        returns: "TreeNode.val",
        cases: [
          { id: "left", input: [[2, 1, 3]] },
          { id: "none", input: [[2]] },
          { id: "number", input: [[7]] },
        ],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("left")?.output).toBe(1);
    expect(outcome.runs.get("none")?.output).toBeNull();
    expect(outcome.runs.get("number")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "expected a TreeNode, got int" },
    });
  });
});

describe("python harness: cycle and ref params (Grind 75 spec §3.1, §3.2)", () => {
  it("links the tail back to node pos, passes only the list, and keeps pos = -1 a plain list", async () => {
    const file = solution(
      "cycle",
      [
        "class Solution:",
        "    def solve(self, *args):",
        "        node = args[0]",
        "        for _ in range(4):",
        "            if node is None:",
        "                break",
        "            node = node.next",
        "        if len(args) != 1:",
        "            return -99",
        "        return node.val if node is not None else -1",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
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
      { wallLimitMs: 5000 },
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
        "class Solution:",
        "    def solve(self, root, p, q):",
        "        if root is not None and root.left is p and root.right is q:",
        "            return root",
        "        return q",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
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
      { wallLimitMs: 5000 },
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

describe("python harness: api params (Grind 75 spec §3.4)", () => {
  const api = (file: string, cases: { id: string; input: unknown }[]) =>
    harnessRequest(file, {
      params: [
        { name: "n", type: "int" },
        { name: "bad", type: "int", api: "isBadVersion" },
      ],
      returns: "int",
      cases,
    });
  const body = [
    "class Solution:",
    "    def solve(self, *args):",
    "        if len(args) != 1:",
    "            return -99",
    "        n = args[0]",
    "        if not isBadVersion(n):",
    "            return 0",
    "        return -1 if isBadVersion(n - 1) else n",
    "",
  ];

  it("defines the judge's function as a module global, with or without the stub's lc import", async () => {
    const bare = solution("api-bare", body.join("\n"));
    const withImport = solution("api-with-import", ["from lc import isBadVersion", "", "", ...body].join("\n"));
    for (const file of [bare, withImport]) {
      const outcome = await runHarness(
        "py",
        api(file, [
          { id: "first", input: [5, 5] },
          { id: "earlier", input: [5, 3] },
          { id: "none", input: [5, 6] },
        ]),
        { wallLimitMs: 5000 },
      );
      expect(outcome.fatal).toBeNull();
      expect(outcome.runs.get("first")?.output).toBe(5);
      expect(outcome.runs.get("earlier")?.output).toBe(-1);
      expect(outcome.runs.get("none")?.output).toBe(0);
    }
  });
});

describe("python harness: codec mode (Grind 75 spec §3.5)", () => {
  const codec = (file: string, cases: { id: string; input: unknown }[]) =>
    harnessRequest(file, { mode: "codec", entry: "Codec", params: [{ name: "root", type: "TreeNode" }], returns: null, cases });

  it("runs deserialize(serialize(value)) on two instances and judges the rebuilt value", async () => {
    const file = solution(
      "codec-fixed",
      [
        "from lc import TreeNode",
        "",
        "INSTANCES = []",
        "",
        "",
        "class Codec:",
        "    def __init__(self):",
        "        INSTANCES.append(self)",
        "",
        "    def serialize(self, root):",
        '        return "tree" if root else ""',
        "",
        "    def deserialize(self, data):",
        "        if len(INSTANCES) % 2 != 0:",
        '            return TreeNode(9)',
        "        return TreeNode(1, TreeNode(2)) if data else None",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      codec(file, [
        { id: "tree", input: [[1, 2]] },
        { id: "empty", input: [[]] },
      ]),
      { wallLimitMs: 5000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("tree")?.output).toEqual([1, 2]);
    expect(outcome.runs.get("empty")?.output).toEqual([]);
  });

  it("fails a serialize that returns no string and a deserialize that hands back the input nodes", async () => {
    const file = solution(
      "codec-kept",
      [
        "KEPT = []",
        "",
        "",
        "class Codec:",
        "    def serialize(self, root):",
        "        KEPT.append(root)",
        '        return 42 if root is not None and root.val == 0 else "kept"',
        "",
        "    def deserialize(self, data):",
        "        return KEPT[-1]",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      codec(file, [
        { id: "number", input: [[0]] },
        { id: "kept", input: [[1, 2]] },
      ]),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("number")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "serialize must return a string, got int" },
    });
    expect(outcome.runs.get("kept")).toMatchObject({
      ok: false,
      error: { kind: "serialization", message: "deserialize returned nodes of the input: build new ones from the string" },
    });
  });

  it("needs the codec class", async () => {
    const file = solution("codec-missing", ["class Other:", "    pass", ""].join("\n"));
    const outcome = await runHarness("py", codec(file, [{ id: "e1", input: [[1]] }]), { wallLimitMs: 5000 });
    expect(outcome.fatal).toMatchObject({ kind: "missing-entry", message: 'expected class "Codec"' });
  });
});
