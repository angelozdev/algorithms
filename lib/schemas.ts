import { z } from "zod";

export const PATTERNS = [
  "arrays-hashing",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
  "linked-list",
  "trees",
  "tries",
  "heap",
  "backtracking",
  "graphs",
  "dp-1d",
  "dp-2d",
  "greedy",
  "intervals",
  "math",
  "bit-manipulation",
  "strings",
] as const;

const itemFields = {
  id: z.string().min(1),
  title: z.string().min(1),
};

/** A problem README's frontmatter: content only (study coach spec §10). Progress lives in .study. */
export const problemFrontmatter = z
  .object({
    ...itemFields,
    source: z.string().min(1),
    url: z.string().regex(/^https?:\/\//, "must be an http(s) URL"),
    difficulty: z.enum(["easy", "medium", "hard"]),
    patterns: z.array(z.enum(PATTERNS)),
    concepts: z.array(z.string().min(1)),
    /** Curated lists the problem was imported from, e.g. [grind-75] (Grind 75 spec §5). */
    lists: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case")).optional(),
  })
  .strict();

export const exerciseFrontmatter = z.object({ ...itemFields, concept: z.string().min(1) }).strict();

export const conceptFrontmatter = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    requires: z.array(z.string().min(1)),
    related: z.array(z.string().min(1)),
  })
  .strict();

/**
 * Personal progress READMEs held before the study coach (spec §9.4, §10). `pnpm study migrate` removes these
 * fields (with the README's `## Log` and its "My explanation" text); `pnpm check` reports any left behind.
 */
export const LEGACY_PERSONAL_FIELDS = {
  problem: ["status", "hints", "solution_revealed", "solved_in", "complexity"],
  exercise: ["status", "hints", "solution_revealed", "solved_in"],
  concept: ["status"],
} as const satisfies Record<"problem" | "exercise" | "concept", readonly string[]>;
