import { describe, expect, it } from "vitest";
import { canonical, compareValue, judgedValue, matches } from "../src/compare.ts";

describe("compareValue", () => {
  it("exact: deep equality, key order and -0 do not matter", () => {
    expect(compareValue("exact", [1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(compareValue("exact", [1, 2], [2, 1])).toBe(false);
    expect(compareValue("exact", { a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(compareValue("exact", 0, -0)).toBe(true);
    expect(compareValue("exact", null, null)).toBe(true);
    expect(compareValue("exact", true, 1)).toBe(false);
  });

  it("unordered: same multiset at the top level", () => {
    expect(compareValue("unordered", [0, 1], [1, 0])).toBe(true);
    expect(compareValue("unordered", [[1, 2], [3]], [[3], [1, 2]])).toBe(true);
    expect(compareValue("unordered", [1, 1, 2], [1, 2, 2])).toBe(false);
    expect(compareValue("unordered", [1], 1)).toBe(false);
  });

  it("float: tolerance 1e-5, element-wise", () => {
    expect(compareValue("float", 0.1 + 0.2, 0.3)).toBe(true);
    expect(compareValue("float", [1.000001, 2], [1, 2])).toBe(true);
    expect(compareValue("float", 1, 1.001)).toBe(false);
  });

  it("any-of: matches one of the acceptable answers", () => {
    expect(compareValue("any-of", [[0, 1], [1, 0]], [1, 0])).toBe(true);
    expect(compareValue("any-of", [[0, 1]], [1, 0])).toBe(false);
  });
});

describe("in-place judging", () => {
  const prefix = { compare: "exact" as const, inPlace: { param: "nums", prefix: "return" as const } };

  it("judges only the first k elements of the mutated param", () => {
    expect(judgedValue(prefix, { ret: 2, param: [1, 2, 9] })).toEqual({ value: [1, 2] });
    expect(matches(prefix, [1, 2], { ret: 2, param: [1, 2, 9] })).toBe(true);
  });

  it("fails when k does not match the expected length", () => {
    expect(matches(prefix, [1, 2], { ret: 3, param: [1, 2, 9] })).toBe(false);
  });

  it("treats a non-integer k (e.g. returning the array) as malformed", () => {
    expect(judgedValue(prefix, { ret: [1, 2], param: [1, 2] })).toBeNull();
    expect(matches(prefix, [1, 2], { ret: [1, 2], param: [1, 2] })).toBe(false);
  });

  it("compares the whole param when there is no prefix", () => {
    const whole = { compare: "exact" as const, inPlace: { param: "nums" } };
    expect(matches(whole, [3, 2, 1], { ret: null, param: [3, 2, 1] })).toBe(true);
  });

  it("uses the compare mode on the judged prefix", () => {
    const unordered = { compare: "unordered" as const, inPlace: { param: "nums", prefix: "return" as const } };
    expect(matches(unordered, [0, 1, 4], { ret: 3, param: [4, 0, 1, 7] })).toBe(true);
  });
});

describe("canonical", () => {
  it("sorts object keys", () => {
    expect(canonical({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
  });
});
