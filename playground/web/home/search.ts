import { z } from "zod";
import { DIFFICULTIES, type Difficulty } from "../lib/labels.ts";

export const GROUP_BY = ["none", "pattern", "concept", "list", "difficulty", "status"] as const;
export type GroupBy = (typeof GROUP_BY)[number];
export const SORT_KEYS = ["num", "title", "difficulty"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
const SORT_DIRS = ["asc", "desc"] as const;
export type SortDir = (typeof SORT_DIRS)[number];
export const STATUS_FILTERS = ["all", "pending", "solved"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** A list from the URL: entries that are not allowed are dropped, the rest kept in order. */
function list<T extends string>(keep: (item: unknown) => item is T) {
  return z
    .array(z.unknown())
    .default([])
    .catch([])
    .transform((items) => items.filter(keep));
}
const isString = (item: unknown): item is string => typeof item === "string";
const isDifficulty = (item: unknown): item is Difficulty => DIFFICULTIES.includes(item as Difficulty);

/**
 * The home page's view, kept in the URL (spec §4.3). A value that does not parse falls back to its default, so a
 * stale or hand-edited link still opens the page. `q` is coerced because the router reads `?q=20` as a number.
 */
export const homeSearchSchema = z.object({
  q: z.coerce.string().default("").catch(""),
  group: z.enum(GROUP_BY).default("pattern").catch("pattern"),
  sort: z.enum(SORT_KEYS).default("num").catch("num"),
  dir: z.enum(SORT_DIRS).default("asc").catch("asc"),
  status: z.enum(STATUS_FILTERS).default("all").catch("all"),
  difficulty: list(isDifficulty),
  pattern: list(isString),
  concept: list(isString),
  list: list(isString),
});

export type HomeSearch = z.output<typeof homeSearchSchema>;

export const DEFAULT_SEARCH: HomeSearch = {
  q: "",
  group: "pattern",
  sort: "num",
  dir: "asc",
  status: "all",
  difficulty: [],
  pattern: [],
  concept: [],
  list: [],
};

/** True when the search box or a filter narrows the list. Grouping and sorting do not count. */
export function isFiltered(search: HomeSearch): boolean {
  return (
    search.q.trim() !== "" ||
    search.status !== "all" ||
    search.difficulty.length > 0 ||
    search.pattern.length > 0 ||
    search.concept.length > 0 ||
    search.list.length > 0
  );
}

/** The same view with the search box and every filter cleared. Grouping and sorting stay. */
export function clearFilters(search: HomeSearch): HomeSearch {
  return { ...search, q: "", status: "all", difficulty: [], pattern: [], concept: [], list: [] };
}
