import { describe, expect, it } from "vitest";
import { explanationIssues, joinExplanation, splitExplanation } from "../../server/explanation.ts";

const BODY =
  "# Hash map\n\n## Intuition\n\nAn analogy.\n\n## My explanation\n\n<!-- USER: in your own words -->\n\n## Problems\n\n- one\n";

describe("splitExplanation", () => {
  it("cuts the body around the section and gives it back unchanged when joined with the same text", () => {
    const split = splitExplanation(BODY)!;
    expect(split).toEqual({
      before: "# Hash map\n\n## Intuition\n\nAn analogy.\n\n",
      heading: "## My explanation",
      comments: ["<!-- USER: in your own words -->"],
      text: "",
      after: "## Problems\n\n- one\n",
    });
    expect(joinExplanation(split, "")).toBe(BODY);
  });

  it("ignores a '## My explanation' line inside a code block", () => {
    const body = "# X\n\n```md\n## My explanation\n```\n\n## Other\n";
    expect(splitExplanation(body)).toBeNull();
  });

  it("keeps a '## ' line inside a code block as part of the text", () => {
    const text = "Example:\n\n```md\n## not a heading\n```";
    const split = splitExplanation(BODY)!;
    const joined = joinExplanation(split, text);
    expect(splitExplanation(joined)!.text).toBe(text);
    expect(splitExplanation(joined)!.after).toBe(split.after);
  });
});

describe("explanationIssues", () => {
  const split = splitExplanation(BODY)!;

  it("accepts prose, lists and ### headings", () => {
    expect(explanationIssues(split, "A hash map turns keys into positions.\n\n### Cost\n\n- O(1) average")).toEqual([]);
  });

  it("rejects headings that would end the section, auto markers and an open code block", () => {
    expect(explanationIssues(split, "## Mine")[0]).toMatch(/### or deeper/);
    expect(explanationIssues(split, "# Mine")[0]).toMatch(/### or deeper/);
    expect(explanationIssues(split, "Title\n---")[0]).toMatch(/### or deeper/);
    expect(explanationIssues(split, "<!-- /auto -->")[0]).toMatch(/auto/);
    expect(explanationIssues(split, "```python\nx = 1")[0]).toMatch(/code block/);
  });
});
