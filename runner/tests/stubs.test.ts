import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ensureSolution, pyType, renderStub, tsType } from "../src/stubs.ts";
import type { CaseFile } from "../src/types.ts";
import { removeTemp, tempDir } from "./helpers.ts";

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

describe("ensureSolution", () => {
  it("creates the file once and never overwrites it", () => {
    const first = ensureSolution(dir, base, "py");
    expect(first).toEqual({ path: path.join(dir, "solution.py"), created: true });
    writeFileSync(first.path, "# my work\n");
    const second = ensureSolution(dir, { ...base, entry: "other" }, "py");
    expect(second.created).toBe(false);
    expect(readFileSync(first.path, "utf8")).toBe("# my work\n");
  });
});
