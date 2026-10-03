import type { HomeConcept, ItemStatus } from "../../server/types.ts";

/** Display names of the patterns listed in CLAUDE.md. */
export const PATTERN_LABELS: Readonly<Record<string, string>> = {
  "arrays-hashing": "Arrays & hashing",
  "two-pointers": "Two pointers",
  "sliding-window": "Sliding window",
  stack: "Stack",
  "binary-search": "Binary search",
  "linked-list": "Linked list",
  trees: "Trees",
  tries: "Tries",
  heap: "Heap / priority queue",
  backtracking: "Backtracking",
  graphs: "Graphs",
  "dp-1d": "1-D DP",
  "dp-2d": "2-D DP",
  greedy: "Greedy",
  intervals: "Intervals",
  math: "Math",
  "bit-manipulation": "Bit manipulation",
  strings: "Strings",
};

/** "bit-manipulation" → "Bit manipulation". */
export function prettifySlug(slug: string): string {
  const words = slug.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function patternLabel(slug: string): string {
  return PATTERN_LABELS[slug] ?? prettifySlug(slug);
}

/** A concept's name: the title of its page in concepts/ when it has one, otherwise its slug made readable. */
export function conceptLabel(slug: string, concepts: readonly Pick<HomeConcept, "slug" | "title">[]): string {
  return concepts.find((concept) => concept.slug === slug)?.title ?? prettifySlug(slug);
}

/** LeetCode's problem number from an id like "lc-0035", or null for any other id. */
export function leetcodeNumber(id: string): number | null {
  const match = /^lc-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export function difficultyOf(value: string | null): Difficulty | null {
  const lower = value?.toLowerCase();
  return DIFFICULTIES.find((difficulty) => difficulty === lower) ?? null;
}

export function difficultyLabel(difficulty: Difficulty): string {
  return prettifySlug(difficulty);
}

/** How a status reads to a person. `solving`, and a `todo` with a solution file, both read "In progress". */
export type StatusKind = "in-progress" | "todo" | "revealed" | "solved";

export function statusKind(status: ItemStatus, inProgress: boolean): StatusKind {
  if (status === "solved") return "solved";
  if (status === "revealed") return "revealed";
  if (status === "solving" || inProgress) return "in-progress";
  return "todo";
}

export const STATUS_LABEL: Record<StatusKind, string> = {
  "in-progress": "In progress",
  todo: "To do",
  revealed: "Revealed",
  solved: "Solved",
};
