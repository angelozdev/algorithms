import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_PORT = 4391;
/** Inside the project, so TypeScript solutions resolve "lc" like everywhere else. */
export const E2E_ROOT = fileURLToPath(new URL("./.tmp/repo/", import.meta.url));

export const repoFile = (rel: string): string => path.join(E2E_ROOT, rel);

export const TWO_SUM_PY = [
  "class Solution:",
  "    def twoSum(self, nums: list[int], target: int) -> list[int]:",
  "        seen = {}",
  "        for i, n in enumerate(nums):",
  "            if target - n in seen:",
  "                return [seen[target - n], i]",
  "            seen[n] = i",
  "        return []",
  "",
].join("\n");

const PROBLEM_README = `---
id: lc-0001
title: Two Sum
source: leetcode
url: https://leetcode.com/problems/two-sum/
difficulty: easy
patterns: [arrays-hashing]
concepts: [hash-map]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 1. Two Sum

## Statement

Return the indices of the two numbers in \`nums\` that add up to \`target\`.

## Concepts

<!-- auto:concepts -->
- [Hash map](../../concepts/hash-map/README.md) · learning
<!-- /auto -->

## Log

- 2026-09-28 · created for the end-to-end tests
`;

const CASES = {
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
  hidden: [
    { input: [[3, 3], 6], expected: [0, 1] },
    { input: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
  ],
};

export const EXPLANATION_NOTE = "<!-- Write this yourself, in your own words. Claude never fills this section. -->";

const CONCEPT_README = `---
slug: hash-map
title: Hash map
status: learning
requires: []
related: []
---
# Hash map

## Intuition

A coat check: the ticket number tells you the hook.

## Exercises

<!-- auto:exercises -->
<!-- /auto -->

## My explanation

${EXPLANATION_NOTE}

## Problems

<!-- auto:problems -->
- ○ [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)
<!-- /auto -->
`;

const FILES: Record<string, string> = {
  "problems/lc-0001-two-sum/README.md": PROBLEM_README,
  "problems/lc-0001-two-sum/cases.json": `${JSON.stringify(CASES, null, 2)}\n`,
  "concepts/hash-map/README.md": CONCEPT_README,
};

/** Puts the e2e repo back in its starting state without deleting folders the server is watching. */
export function resetRepo(): void {
  for (const lang of ["py", "ts"]) rmSync(repoFile(`problems/lc-0001-two-sum/solution.${lang}`), { force: true });
  for (const [rel, content] of Object.entries(FILES)) {
    mkdirSync(path.dirname(repoFile(rel)), { recursive: true });
    writeFileSync(repoFile(rel), content);
  }
}
