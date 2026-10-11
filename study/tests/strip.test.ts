import { describe, expect, it } from "vitest";
import { removeSection, StripError, stripFrontmatter, stripReadme } from "../strip.ts";

const PROBLEM = [
  "---",
  "id: lc-9001",
  'title: "Sample Sum: a fixture"',
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-sum/",
  "difficulty: easy",
  "patterns: [arrays-hashing]",
  "concepts: [sample-map]",
  "lists: [grind-75]",
  "status: solved",
  "hints: 1",
  "solution_revealed: false",
  "solved_in: [py, ts]",
  "complexity:",
  "  time: O(1)",
  "  space: O(1)",
  "  optimal: true",
  "---",
  "# 9001. Sample Sum",
  "",
  "## Statement",
  "",
  "Short paraphrase.",
  "",
  "## Concepts",
  "",
  "<!-- auto:concepts -->",
  "<!-- /auto -->",
  "",
  "## Log",
  "",
  "- 2026-09-28 · registered",
  "- 2026-09-29 · green in py",
  "",
].join("\n");

const PROBLEM_STRIPPED = [
  "---",
  "id: lc-9001",
  'title: "Sample Sum: a fixture"',
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-sum/",
  "difficulty: easy",
  "patterns: [arrays-hashing]",
  "concepts: [sample-map]",
  "lists: [grind-75]",
  "---",
  "# 9001. Sample Sum",
  "",
  "## Statement",
  "",
  "Short paraphrase.",
  "",
  "## Concepts",
  "",
  "<!-- auto:concepts -->",
  "<!-- /auto -->",
  "",
].join("\n");

const CONCEPT = [
  "---",
  "slug: sample-map",
  "title: Sample map",
  "status: learning",
  "requires: []",
  "related: []",
  "---",
  "# Sample map",
  "",
  "## Intuition",
  "",
  "An analogy.",
  "",
  "## My explanation",
  "",
  "<!-- Write this yourself, in your own words. Claude never fills this section. -->",
  "",
  "Keys turn into positions.",
  "",
  "## Problems",
  "",
  "<!-- auto:problems -->",
  "<!-- /auto -->",
  "",
].join("\n");

describe("stripReadme", () => {
  it("removes a problem's personal fields (block and flow style) and its Log, keeping every other byte", () => {
    expect(stripReadme(PROBLEM, "problem")).toEqual({
      text: PROBLEM_STRIPPED,
      fields: ["status", "hints", "solution_revealed", "solved_in", "complexity"],
      log: true,
      explanation: null,
    });
    const flow = PROBLEM.replace("complexity:\n  time: O(1)\n  space: O(1)\n  optimal: true\n", 'complexity: { time: "O(1)", space: "O(1)", optimal: true }\n');
    expect(stripReadme(flow, "problem").text).toBe(PROBLEM_STRIPPED);
  });

  it("removes an exercise's fields, which have no complexity", () => {
    const exercise = "---\nid: sample-map/01\ntitle: First\nconcept: sample-map\nstatus: todo\nhints: 0\nsolution_revealed: false\nsolved_in: []\n---\n# First\n\n## Statement\n\nShort.\n\n## Log\n\n- 2026-09-30 · created\n";
    expect(stripReadme(exercise, "exercise")).toEqual({
      text: "---\nid: sample-map/01\ntitle: First\nconcept: sample-map\n---\n# First\n\n## Statement\n\nShort.\n",
      fields: ["status", "hints", "solution_revealed", "solved_in"],
      log: true,
      explanation: null,
    });
  });

  it("takes a concept's status and the text of My explanation, keeping the heading and its comment", () => {
    expect(stripReadme(CONCEPT, "concept")).toEqual({
      text: CONCEPT.replace("status: learning\n", "").replace("\n\nKeys turn into positions.", ""),
      fields: ["status"],
      log: false,
      explanation: "Keys turn into positions.",
    });
  });

  it("changes nothing in a README that is already pure content", () => {
    expect(stripReadme(PROBLEM_STRIPPED, "problem")).toEqual({ text: PROBLEM_STRIPPED, fields: [], log: false, explanation: null });
  });
});

describe("removeSection", () => {
  it("removes a section in the middle up to the next ## heading, and ignores a heading inside a code block", () => {
    const body = "# T\n\n## Log\n\n- a\n\n## Notes\n\n```md\n## Log\n```\n";
    expect(removeSection(body, "Log")).toEqual({ body: "# T\n\n## Notes\n\n```md\n## Log\n```\n", removed: true });
    expect(removeSection("# T\n\n```md\n## Log\n```\n", "Log")).toEqual({ body: "# T\n\n```md\n## Log\n```\n", removed: false });
  });
});

describe("stripFrontmatter", () => {
  it("refuses a frontmatter it cannot strip line by line without changing the other fields", () => {
    const aliased = "---\nid: lc-9001\nstatus: &s solved\ntitle: *s\n---\n# T\n";
    expect(() => stripFrontmatter(aliased, ["status"])).toThrow(StripError);
  });
});
