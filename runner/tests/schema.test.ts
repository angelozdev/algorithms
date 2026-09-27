import { describe, expect, it } from "vitest";
import {
  assertHiddenFilled,
  CaseFileError,
  formatCasesJson,
  parseCaseFile,
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
