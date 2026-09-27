import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../runner/src/paths.ts";
import { checkRepo, sectionText } from "../lib/checks.ts";
import { sync } from "../lib/sync.ts";
import { conceptReadme, makeStudyRepo, problemReadme, put } from "./fixture.ts";

const messages = (root: string) => checkRepo(root).errors.map((e) => `${e.file}: ${e.message}`);
const edit = (root: string, rel: string, from: string, to: string) =>
  put(root, rel, readFileSync(path.join(root, rel), "utf8").replace(from, to));

describe("checkRepo", () => {
  it("accepts a synced valid repo and warns about missing concepts", () => {
    const root = makeStudyRepo();
    sync(root);
    const report = checkRepo(root);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([{ file: "concepts", message: '"stack" is referenced but not created (lc-0020)' }]);
  });

  it("reports broken links but ignores links inside code", () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "Short paraphrase.", "See [x](../nowhere.md) and `[y](../code.md)`.\n\n```md\n[z](../fence.md)\n```");
    expect(messages(root)).toEqual(["problems/lc-0001-two-sum/README.md: broken link: ../nowhere.md"]);
  });

  it("validates frontmatter against the schema and the pattern vocabulary", () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "hints: 0", "hints: 5");
    edit(root, "problems/lc-0001-two-sum/README.md", "patterns: [arrays-hashing]", "patterns: [hashing]");
    const errors = messages(root);
    expect(errors.some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter hints:"))).toBe(true);
    expect(errors.some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter patterns[0]:"))).toBe(true);
  });

  it("checks that ids match folders", () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "id: lc-0001", "id: lc-0002");
    expect(messages(root)).toContain('problems/lc-0001-two-sum/README.md: id "lc-0002" does not match the folder id "lc-0001"');
  });

  it("detects requires cycles", () => {
    const root = makeStudyRepo();
    edit(root, "concepts/arrays/README.md", "requires: []", "requires: [hash-map]");
    expect(messages(root)).toContain("concepts: requires has a cycle: arrays → hash-map → arrays");
  });

  it("requires every hidden expected value", () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0001-two-sum/cases.json", JSON.stringify({ entry: "f", params: [{ name: "n", type: "int" }], returns: "int", examples: [{ input: [1], expected: 1 }], hidden: [{ input: [2] }] }));
    expect(messages(root)).toContain("problems/lc-0001-two-sum/cases.json: hidden[0].expected: missing (run pnpm fill-expected)");
  });

  it("checks status consistency", () => {
    const root = makeStudyRepo();
    put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", status: "mastered", requires: ["arrays"] }));
    edit(root, "problems/lc-0001-two-sum/README.md", "solved_in: [py]", "solved_in: []");
    const errors = messages(root);
    expect(errors).toContain('concepts/hash-map/README.md: status is mastered but "My explanation" is empty');
    expect(errors).toContain("problems/lc-0001-two-sum/README.md: status is solved but solved_in is empty");
  });

  it("requires the auto sections", () => {
    const root = makeStudyRepo();
    put(
      root,
      "problems/lc-0001-two-sum/README.md",
      problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: [], status: "todo", solvedIn: [] }).replace("<!-- auto:concepts -->\n<!-- /auto -->\n", ""),
    );
    expect(messages(root)).toContain("problems/lc-0001-two-sum/README.md: missing <!-- auto:concepts --> … <!-- /auto --> section");
  });

  it("requires every auto section to be closed", () => {
    const root = makeStudyRepo();
    edit(root, "concepts/hash-map/README.md", "<!-- auto:exercises -->\n<!-- /auto -->\n", "<!-- auto:exercises -->\n");
    expect(messages(root)).toContain("concepts/hash-map/README.md: missing <!-- auto:exercises --> … <!-- /auto --> section");
  });

  it("exits 1 from the CLI when there are errors", () => {
    const root = makeStudyRepo();
    const run = () => spawnSync(TSX_BIN, ["scripts/check.ts"], { cwd: REPO_ROOT, env: { ...process.env, ALGO_ROOT: root }, encoding: "utf8" });
    const clean = run();
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain("0 error(s), 1 warning(s)");
    edit(root, "problems/lc-0001-two-sum/README.md", "id: lc-0001", "id: nope");
    const broken = run();
    expect(broken.status).toBe(1);
    expect(broken.stdout).toContain('✗ problems/lc-0001-two-sum/README.md: id "nope" does not match');
  });
});

describe("sectionText", () => {
  it("returns a section's text without HTML comments", () => {
    const body = "## A\n\n<!-- hint -->\nhello\n\n## B\nbye\n";
    expect(sectionText(body, "A")).toBe("hello");
    expect(sectionText(body, "B")).toBe("bye");
    expect(sectionText(body, "C")).toBeNull();
  });
});
