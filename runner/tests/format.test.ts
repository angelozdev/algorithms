import { describe, expect, it } from "vitest";
import { formatInput, formatNamedInput, formatOutput } from "../src/format.ts";

describe("format", () => {
  it("names the arguments when there is one value per name", () => {
    expect(formatNamedInput(["nums", "target"], [[3, 2, 4], 6])).toBe("nums=[3,2,4], target=6");
    expect(formatNamedInput(["nums"], [[1], 2])).toBe("[1], 2");
    expect(formatNamedInput([], { ops: ["A"], args: [[]] })).toBe('{"ops":["A"],"args":[[]]}');
  });

  it("cuts long values at the given length", () => {
    expect(formatOutput("x".repeat(300))).toHaveLength(100);
    expect(formatOutput("x".repeat(300), 2000)).toBe(JSON.stringify("x".repeat(300)));
    expect(formatInput([["y".repeat(500)]], 50)).toHaveLength(50);
    expect(formatInput([["y".repeat(500)]], 50).endsWith("…")).toBe(true);
  });

  it("shows in-place results as the returned value and the array", () => {
    expect(formatOutput({ ret: 2, param: [1, 2, 2] })).toBe("returned 2, array is now [1,2,2]");
  });
});
