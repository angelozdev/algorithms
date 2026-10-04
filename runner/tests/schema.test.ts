import { describe, expect, it } from "vitest";
import {
  assertHiddenFilled,
  CaseFileError,
  formatCasesJson,
  parseCaseFile,
  passedParams,
} from "../src/schema.ts";

const valid = {
  entry: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
  examples: [{ input: [[2, 7, 11, 15], 9], expected: [0, 1] }],
  hidden: [{ input: [[3, 3], 6] }],
};

function issuesOf(raw: unknown): string[] {
  try {
    parseCaseFile(raw);
  } catch (error) {
    if (error instanceof CaseFileError) return error.issues;
    throw error;
  }
  return [];
}

describe("parseCaseFile", () => {
  it("applies defaults and keeps unfilled hidden expected values undefined", () => {
    const cf = parseCaseFile(valid);
    expect(cf.mode).toBe("function");
    expect(cf.compare).toBe("exact");
    expect(cf.inPlace).toBeNull();
    expect(cf.hidden[0].expected).toBeUndefined();
  });

  it("keeps null as a real expected value", () => {
    const cf = parseCaseFile({ ...valid, hidden: [{ input: [[3, 3], 6], expected: null }] });
    expect(cf.hidden[0].expected).toBeNull();
  });

  it("points at the exact field when an input has the wrong arity", () => {
    const issues = issuesOf({
      ...valid,
      hidden: [{ input: [[1, 2], 3] }, { input: [[1]] }],
    });
    expect(issues).toEqual(["hidden[1].input: expected 2 params, got 1"]);
  });

  it("rejects unknown types", () => {
    const issues = issuesOf({ ...valid, params: [{ name: "nums", type: "list" }, valid.params[1]] });
    expect(issues[0]).toMatch(/^params\[0\]\.type: unknown type/);
  });

  it("requires expected on every example", () => {
    const issues = issuesOf({ ...valid, examples: [{ input: [[1], 1] }] });
    expect(issues).toContain("examples[0].expected: required");
  });

  it("rejects unknown top-level keys", () => {
    expect(issuesOf({ ...valid, extra: true }).join("\n")).toMatch(/Unrecognized key/);
  });

  it("checks that inPlace.param is a declared param", () => {
    const issues = issuesOf({ ...valid, inPlace: { param: "arr", prefix: "return" } });
    expect(issues).toContain('inPlace.param: "arr" is not a param name');
  });

  it("validates class-mode inputs", () => {
    const issues = issuesOf({
      mode: "class",
      entry: "MinStack",
      examples: [{ input: { ops: ["Stack", "push"], args: [[], [1]] }, expected: [null, null] }],
      hidden: [{ input: { ops: ["MinStack"], args: [] } }],
    });
    expect(issues).toContain('examples[0].input.ops[0]: expected "MinStack"');
    expect(issues).toContain("hidden[0].input: ops and args must be non-empty and the same length");
  });
});

describe("assertHiddenFilled", () => {
  it("lists every hidden case without an expected value", () => {
    const cf = parseCaseFile(valid);
    expect(() => assertHiddenFilled(cf)).toThrow(CaseFileError);
    try {
      assertHiddenFilled(cf);
    } catch (error) {
      expect((error as CaseFileError).issues).toEqual([
        "hidden[0].expected: missing (run pnpm fill-expected)",
      ]);
    }
  });
});

describe("formatCasesJson", () => {
  it("writes one case per line and round-trips", () => {
    const raw = {
      entry: "f",
      params: [{ name: "n", type: "int" }],
      returns: "int",
      examples: [{ input: [1], expected: 2 }],
      hidden: [],
    };
    const text = formatCasesJson(raw);
    expect(text).toBe(
      [
        "{",
        '  "entry": "f",',
        '  "params": [',
        '    {"name":"n","type":"int"}',
        "  ],",
        '  "returns": "int",',
        '  "examples": [',
        '    {"input":[1],"expected":2}',
        "  ],",
        '  "hidden": []',
        "}",
        "",
      ].join("\n"),
    );
    expect(JSON.parse(text)).toEqual(raw);
  });
});

describe("Grind 75 grammar: param marks, GraphNode, TreeNode.val, codec, unordered-nested", () => {
  const cycle = {
    entry: "hasCycle",
    params: [
      { name: "head", type: "ListNode" },
      { name: "pos", type: "int", cycle: "head" },
    ],
    returns: "bool",
    examples: [{ input: [[3, 2, 0, -4], 1], expected: true }],
    hidden: [],
  };
  const refs = {
    entry: "lowestCommonAncestor",
    params: [
      { name: "root", type: "TreeNode" },
      { name: "p", type: "TreeNode", ref: "root" },
      { name: "q", type: "TreeNode", ref: "root" },
    ],
    returns: "TreeNode.val",
    examples: [{ input: [[2, 1], 2, 1], expected: 2 }],
    hidden: [],
  };
  const api = {
    entry: "firstBadVersion",
    params: [
      { name: "n", type: "int" },
      { name: "bad", type: "int", api: "isBadVersion" },
    ],
    returns: "int",
    examples: [{ input: [5, 4], expected: 4 }],
    hidden: [],
  };
  const codec = {
    mode: "codec",
    entry: "Codec",
    params: [{ name: "root", type: "TreeNode" }],
    examples: [{ input: [[1, 2]], expected: [1, 2] }],
    hidden: [],
  };

  it("accepts cycle, ref and api params, GraphNode, TreeNode.val, codec mode and unordered-nested", () => {
    expect(issuesOf(cycle)).toEqual([]);
    expect(issuesOf(refs)).toEqual([]);
    expect(issuesOf(api)).toEqual([]);
    expect(issuesOf(codec)).toEqual([]);
    expect(
      issuesOf({
        entry: "cloneGraph",
        params: [{ name: "node", type: "GraphNode" }],
        returns: "GraphNode",
        examples: [{ input: [[[2], [1]]], expected: [[2], [1]] }],
        hidden: [],
      }),
    ).toEqual([]);
    expect(issuesOf({ ...valid, compare: "unordered-nested" })).toEqual([]);
    expect(parseCaseFile(codec)).toMatchObject({ mode: "codec", returns: null, inPlace: null });
  });

  it("checks what a cycle param points at", () => {
    expect(
      issuesOf({ ...cycle, params: [cycle.params[0], { name: "pos", type: "string", cycle: "head" }] }),
    ).toContain("params[1].cycle: the param's type must be int");
    expect(
      issuesOf({
        ...cycle,
        params: [{ name: "pos", type: "int", cycle: "head" }, { name: "head", type: "ListNode" }],
        examples: [{ input: [1, [1, 2]], expected: true }],
      }),
    ).toContain('params[0].cycle: "head" must name an earlier ListNode param');
    expect(
      issuesOf({ ...cycle, params: [{ name: "head", type: "int[]" }, cycle.params[1]] }),
    ).toContain('params[1].cycle: "head" must name an earlier ListNode param');
  });

  it("checks what a ref param points at", () => {
    expect(
      issuesOf({ ...refs, params: [refs.params[0], refs.params[1], { name: "q", type: "TreeNode", ref: "p" }] }),
    ).toContain('params[2].ref: "p" must name an earlier TreeNode param that is not a ref');
    expect(
      issuesOf({ ...refs, params: [refs.params[0], { name: "p", type: "int", ref: "root" }, refs.params[2]] }),
    ).toContain("params[1].ref: the param's type must be TreeNode");
  });

  it("checks api params", () => {
    expect(issuesOf({ ...api, params: [api.params[0], { name: "bad", type: "int", api: "guess" }] })[0]).toMatch(
      /^params\[1\]\.api:/,
    );
    expect(
      issuesOf({
        ...api,
        params: [...api.params, { name: "other", type: "int", api: "isBadVersion" }],
        examples: [{ input: [5, 4, 3], expected: 4 }],
      }),
    ).toContain('params[2].api: "isBadVersion" is used twice');
    expect(
      issuesOf({ ...api, params: [api.params[0], { name: "bad", type: "int", api: "isBadVersion", cycle: "n" }] }),
    ).toContain("params[1]: use only one of cycle, ref and api");
    expect(issuesOf({ ...api, inPlace: { param: "bad" } })).toContain('inPlace.param: "bad" is not passed to the solution');
  });

  it("checks codec mode", () => {
    expect(
      issuesOf({
        ...codec,
        params: [...codec.params, { name: "k", type: "int" }],
        examples: [{ input: [[1], 1], expected: [1] }],
      }),
    ).toContain("params: codec mode takes exactly one param");
    expect(issuesOf({ ...codec, returns: "TreeNode" })).toContain("returns: not allowed in codec mode");
    expect(issuesOf({ ...codec, inPlace: { param: "root" } })).toContain("inPlace: not allowed in codec mode");
    expect(issuesOf({ ...codec, params: undefined })).toContain("params: required in codec mode");
    expect(
      issuesOf({ ...codec, params: [{ name: "root", type: "TreeNode", ref: "root" }] }),
    ).toContain("params: codec mode takes a plain param (no cycle, ref or api)");
  });

  it("lists the params a solution receives as arguments", () => {
    expect(passedParams(parseCaseFile(cycle).params).map((p) => p.name)).toEqual(["head"]);
    expect(passedParams(parseCaseFile(api).params).map((p) => p.name)).toEqual(["n"]);
    expect(passedParams(parseCaseFile(refs).params).map((p) => p.name)).toEqual(["root", "p", "q"]);
  });
});
