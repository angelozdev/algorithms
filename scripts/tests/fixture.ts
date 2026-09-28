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

export function problemReadme(fields: {
  id: string;
  title: string;
  slug: string;
  patterns: string[];
  concepts: string[];
  status: string;
  solvedIn: string[];
}): string {
  return [
    "---",
    `id: ${fields.id}`,
    `title: ${fields.title}`,
    "source: leetcode",
    `url: https://leetcode.com/problems/${fields.slug}/`,
    "difficulty: easy",
    `patterns: [${fields.patterns.join(", ")}]`,
    `concepts: [${fields.concepts.join(", ")}]`,
    `status: ${fields.status}`,
    "hints: 0",
    "solution_revealed: false",
    `solved_in: [${fields.solvedIn.join(", ")}]`,
    "complexity: null",
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
    "## Log",
    "",
  ].join("\n");
}

export function conceptReadme(fields: {
  slug: string;
  title: string;
  status: string;
  requires: string[];
  explanation?: string;
}): string {
  return [
    "---",
    `slug: ${fields.slug}`,
    `title: ${fields.title}`,
    `status: ${fields.status}`,
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
    ...(fields.explanation ? [fields.explanation] : []),
    "",
    "## Problems",
    "",
    "<!-- auto:problems -->",
    "<!-- /auto -->",
    "",
  ].join("\n");
}

export function exerciseReadme(fields: { id: string; title: string; concept: string; status: string; solvedIn: string[] }): string {
  return [
    "---",
    `id: ${fields.id}`,
    `title: ${fields.title}`,
    `concept: ${fields.concept}`,
    `status: ${fields.status}`,
    "hints: 0",
    "solution_revealed: false",
    `solved_in: [${fields.solvedIn.join(", ")}]`,
    "---",
    `# ${fields.title}`,
    "",
    "## Statement",
    "",
    "Short.",
    "",
    "## Log",
    "",
  ].join("\n");
}

/** A small, valid study repo in the OS temp dir. */
export function makeStudyRepo(): string {
  const root = makeTempDir("algo-repo-");
  put(
    root,
    "problems/lc-0001-two-sum/README.md",
    problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved", solvedIn: ["py"] }),
  );
  put(root, "problems/lc-0001-two-sum/cases.json", CASES_JSON);
  put(
    root,
    "problems/lc-0020-valid-parentheses/README.md",
    problemReadme({ id: "lc-0020", title: "Valid Parentheses", slug: "valid-parentheses", patterns: ["stack"], concepts: ["stack"], status: "solving", solvedIn: [] }),
  );
  put(root, "problems/lc-0020-valid-parentheses/cases.json", CASES_JSON);
  put(root, "concepts/arrays/README.md", conceptReadme({ slug: "arrays", title: "Arrays", status: "mastered", requires: [], explanation: "Contiguous memory with O(1) indexing." }));
  put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", status: "learning", requires: ["arrays"] }));
  put(
    root,
    "concepts/hash-map/exercises/01-first-repeat/README.md",
    exerciseReadme({ id: "hash-map/01", title: "First repeat", concept: "hash-map", status: "solved", solvedIn: ["py"] }),
  );
  put(root, "concepts/hash-map/exercises/01-first-repeat/cases.json", CASES_JSON);
  return root;
}
