import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CASES_JSON, makeTempDir, put } from "../../scripts/tests/fixture.ts";

// Fictional problems (no real LeetCode statement, so nothing here can spoil one), shaped like the READMEs written
// before the study coach: personal frontmatter fields, a ## Log, and "My explanation" text in the concept.

export const LEGACY_SUM = [
  "---",
  "id: lc-9001",
  "title: Sample Sum",
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-sum/",
  "difficulty: easy",
  "patterns: [arrays-hashing]",
  "concepts: [sample-map]",
  "lists: [grind-75]",
  "status: solved",
  "hints: 1",
  "solution_revealed: false",
  "solved_in: [py]",
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
  "- [Sample map](../../concepts/sample-map/README.md) · learning",
  "<!-- /auto -->",
  "",
  "## Log",
  "",
  "- 2026-09-28 · registered",
  "",
].join("\n");

export const LEGACY_PAIRS = [
  "---",
  "id: lc-9002",
  "title: Sample Pairs",
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-pairs/",
  "difficulty: medium",
  "patterns: [two-pointers]",
  "concepts: [sample-map]",
  "status: solving",
  "hints: 0",
  "solution_revealed: false",
  "solved_in: []",
  "complexity: null",
  "---",
  "# 9002. Sample Pairs",
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
  "- 2026-09-30 · registered",
  "",
].join("\n");

export const EXPLANATION_TEXT = "Keys turn into positions.";

export const LEGACY_CONCEPT = [
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
  "## Exercises",
  "",
  "<!-- auto:exercises -->",
  "<!-- /auto -->",
  "",
  "## My explanation",
  "",
  "<!-- Write this yourself, in your own words. Claude never fills this section. -->",
  "",
  EXPLANATION_TEXT,
  "",
  "## Problems",
  "",
  "<!-- auto:problems -->",
  "<!-- /auto -->",
  "",
].join("\n");

export const LEGACY_EXERCISE = [
  "---",
  "id: sample-map/01",
  "title: First",
  "concept: sample-map",
  "status: solved",
  "hints: 0",
  "solution_revealed: false",
  "solved_in: [py]",
  "---",
  "# First",
  "",
  "## Statement",
  "",
  "Short.",
  "",
  "## Log",
  "",
  "- 2026-09-30 · green in py",
  "",
].join("\n");

/** git with a neutral identity and none of the user's signing or hook settings. */
export function git(root: string, ...args: string[]): string {
  const run = spawnSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "-C", root, ...args],
    { encoding: "utf8" },
  );
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout;
}

/**
 * A git repo shaped like the user's before the study coach:
 * - a tracked solution (lc-9001);
 * - untracked solutions (lc-9002, sample-map/01);
 * - legacy READMEs.
 */
export function makeLegacyRepo(): string {
  const root = makeTempDir("algo-legacy-");
  put(root, ".gitignore", ".study/\n");
  put(root, "problems/lc-9001-sample-sum/README.md", LEGACY_SUM);
  put(root, "problems/lc-9001-sample-sum/cases.json", CASES_JSON);
  put(root, "problems/lc-9001-sample-sum/solution.py", "# tracked work\n");
  put(root, "problems/lc-9002-sample-pairs/README.md", LEGACY_PAIRS);
  put(root, "problems/lc-9002-sample-pairs/cases.json", CASES_JSON);
  put(root, "concepts/sample-map/README.md", LEGACY_CONCEPT);
  put(root, "concepts/sample-map/exercises/01-first/README.md", LEGACY_EXERCISE);
  put(root, "concepts/sample-map/exercises/01-first/cases.json", CASES_JSON);
  git(root, "init", "-q");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "before the study coach");
  put(root, "problems/lc-9002-sample-pairs/solution.ts", "// untracked work\n");
  put(root, "concepts/sample-map/exercises/01-first/solution.py", "# exercise work\n");
  return root;
}

/** Every file under `root` except .git/, with its bytes (base64): a dry run must leave this unchanged. */
export function snapshotTree(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.set(path.relative(root, full).split(path.sep).join("/"), readFileSync(full).toString("base64"));
    }
  };
  walk(root);
  return files;
}
