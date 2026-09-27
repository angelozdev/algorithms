import { describe, expect, it } from "vitest";
import { buildDraft, htmlToText, type LeetCodeQuestion, mapLeetCodeType, parseOutputs, slugFrom } from "../lib/leetcode.ts";

const twoSum: LeetCodeQuestion = {
  questionFrontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum",
  difficulty: "Easy",
  content: [
    "<p>Given an array of integers <code>nums</code>&nbsp;and an integer <code>target</code>, return indices.</p>",
    "<p>You can return the answer in any order.</p>",
    "<pre>",
    "<strong>Input:</strong> nums = [2,7,11,15], target = 9",
    "<strong>Output:</strong> [0,1]",
    "</pre>",
    "<pre>",
    "<strong>Input:</strong> nums = [3,2,4], target = 6",
    "<strong>Output:</strong> [1,2]",
    "</pre>",
    "<ul><li><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li></ul>",
  ].join("\n"),
  exampleTestcases: "[2,7,11,15]\n9\n[3,2,4]\n6",
  metaData: JSON.stringify({
    name: "twoSum",
    params: [
      { name: "nums", type: "integer[]" },
      { name: "target", type: "integer" },
    ],
    return: { type: "integer[]", size: 2 },
  }),
};

const removeElement: LeetCodeQuestion = {
  questionFrontendId: "27",
  title: "Remove Element",
  titleSlug: "remove-element",
  difficulty: "Easy",
  content: "<pre><strong>Output:</strong> 2, nums = [2,2,_,_]</pre><pre><strong>Output:</strong> 5, nums = [0,1,4,0,3,_,_,_]</pre>",
  exampleTestcases: "[3,2,2,3]\n3\n[0,1,2,2,3,0,4,2]\n2",
  metaData: JSON.stringify({
    name: "removeElement",
    params: [
      { name: "nums", type: "integer[]" },
      { name: "val", type: "integer" },
    ],
    return: { type: "integer" },
    output: { paramindex: 0, size: "ret" },
  }),
};

const minStack: LeetCodeQuestion = {
  questionFrontendId: "155",
  title: "Min Stack",
  titleSlug: "min-stack",
  difficulty: "Medium",
  content: '<pre>\n<strong>Input</strong>\n["MinStack","push","getMin"]\n[[],[-2],[]]\n\n<strong>Output</strong>\n[null,null,-2]\n</pre>',
  exampleTestcases: '["MinStack","push","getMin"]\n[[],[-2],[]]',
  metaData: JSON.stringify({ classname: "MinStack", constructor: { params: [] }, methods: [], systemdesign: true }),
};

describe("helpers", () => {
  it("maps LeetCode types to the runner grammar", () => {
    expect(mapLeetCodeType("integer[]")).toBe("int[]");
    expect(mapLeetCodeType("list<list<integer>>")).toBe("int[][]");
    expect(mapLeetCodeType("character[][]")).toBe("string[][]");
    expect(mapLeetCodeType("double")).toBe("float");
    expect(mapLeetCodeType("long[]")).toBe("int[]");
    expect(mapLeetCodeType("ListNode")).toBe("ListNode");
    expect(mapLeetCodeType("Node")).toBeNull();
  });

  it("turns HTML into readable text", () => {
    expect(htmlToText("<p>a&nbsp;&lt;b&gt;</p><ul><li><code>10<sup>4</sup></code></li></ul>")).toBe("a <b>\n- 10^4");
  });

  it("finds outputs with or without a colon", () => {
    expect(parseOutputs("Output: [0,1]\nOutput\n[null,1]")).toEqual(["[0,1]", "[null,1]"]);
  });

  it("extracts slugs from URLs", () => {
    expect(slugFrom("https://leetcode.com/problems/two-sum/description/")).toBe("two-sum");
    expect(slugFrom("Two-Sum")).toBe("two-sum");
  });
});

describe("buildDraft", () => {
  it("drafts a function problem", () => {
    const draft = buildDraft(twoSum);
    expect(draft).toMatchObject({
      id: "lc-0001",
      folder: "lc-0001-two-sum",
      title: "Two Sum",
      difficulty: "easy",
      url: "https://leetcode.com/problems/two-sum/",
    });
    expect(draft.cases).toEqual({
      mode: "function",
      entry: "twoSum",
      params: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
      returns: "int[]",
      compare: "unordered",
      examples: [
        { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { input: [[3, 2, 4], 6], expected: [1, 2] },
      ],
      hidden: [],
    });
    expect(draft.statement).toContain("2 <= nums.length <= 10^4");
    expect(draft.warnings.join("\n")).toMatch(/any order/);
  });

  it("drafts an in-place problem with prefix expectations", () => {
    const draft = buildDraft(removeElement);
    expect(draft.cases.inPlace).toEqual({ param: "nums", prefix: "return" });
    expect(draft.cases.examples).toEqual([
      { input: [[3, 2, 2, 3], 3], expected: [2, 2] },
      { input: [[0, 1, 2, 2, 3, 0, 4, 2], 2], expected: [0, 1, 4, 0, 3] },
    ]);
  });

  it("drafts a class-design problem", () => {
    const draft = buildDraft(minStack);
    expect(draft.cases).toEqual({
      mode: "class",
      entry: "MinStack",
      compare: "exact",
      examples: [{ input: { ops: ["MinStack", "push", "getMin"], args: [[], [-2], []] }, expected: [null, null, -2] }],
      hidden: [],
    });
  });
});
