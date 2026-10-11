import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const created: string[] = [];

/** A new dir in the OS temp dir, removed by cleanupTempDirs(). */
export function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}

/** Removes every dir made by makeTempDir() and makeStudyRepo() so far. Call it from afterEach. */
export function cleanupTempDirs(): void {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function put(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

export const CASES_JSON = JSON.stringify({
  entry: "f",
  params: [{ name: "n", type: "int" }],
  returns: "int",
  examples: [{ input: [1], expected: 1 }],
  hidden: [{ input: [2], expected: 2 }],
});

export function problemReadme(fields: { id: string; title: string; slug: string; patterns: string[]; concepts: string[] }): string {
  return [
    "---",
    `id: ${fields.id}`,
    `title: ${fields.title}`,
    "source: leetcode",
    `url: https://leetcode.com/problems/${fields.slug}/`,
    "difficulty: easy",
    `patterns: [${fields.patterns.join(", ")}]`,
    `concepts: [${fields.concepts.join(", ")}]`,
    "---",
    `# ${fields.title}`,
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
}

export function conceptReadme(fields: { slug: string; title: string; requires: string[] }): string {
  return [
    "---",
    `slug: ${fields.slug}`,
    `title: ${fields.title}`,
    `requires: [${fields.requires.join(", ")}]`,
    "related: []",
    "---",
    `# ${fields.title}`,
    "",
    "## Intuition",
    "",
    "An analogy.",
    "",
    "## Exercises",
    "",
    "<!-- auto:exercises -->",
    "<!-- /auto -->",
    "",
    "## My explanation",
    "",
    "<!-- USER: in your own words -->",
    "",
    "## Problems",
    "",
    "<!-- auto:problems -->",
    "<!-- /auto -->",
    "",
  ].join("\n");
}

export function exerciseReadme(fields: { id: string; title: string; concept: string }): string {
  return ["---", `id: ${fields.id}`, `title: ${fields.title}`, `concept: ${fields.concept}`, "---", `# ${fields.title}`, "", "## Statement", "", "Short.", ""].join("\n");
}

/** A small, valid study repo in the OS temp dir: pure content, no progress (that lives in .study). */
export function makeStudyRepo(): string {
  const root = makeTempDir("algo-repo-");
  put(root, "problems/lc-0001-two-sum/README.md", problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: ["hash-map"] }));
  put(root, "problems/lc-0001-two-sum/cases.json", CASES_JSON);
  put(
    root,
    "problems/lc-0020-valid-parentheses/README.md",
    problemReadme({ id: "lc-0020", title: "Valid Parentheses", slug: "valid-parentheses", patterns: ["stack"], concepts: ["stack"] }),
  );
  put(root, "problems/lc-0020-valid-parentheses/cases.json", CASES_JSON);
  put(root, "concepts/arrays/README.md", conceptReadme({ slug: "arrays", title: "Arrays", requires: [] }));
  put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", requires: ["arrays"] }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", exerciseReadme({ id: "hash-map/01", title: "First repeat", concept: "hash-map" }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/cases.json", CASES_JSON);
  return root;
}
