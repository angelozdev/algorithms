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

const workFields = {
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["todo", "solving", "solved", "revealed"]),
  hints: z.number().int().min(0).max(2),
  solution_revealed: z.boolean(),
  solved_in: z.array(z.enum(["py", "ts"])),
};

export const problemFrontmatter = z
  .object({
    ...workFields,
    source: z.string().min(1),
    url: z.string().regex(/^https?:\/\//, "must be an http(s) URL"),
    difficulty: z.enum(["easy", "medium", "hard"]),
    patterns: z.array(z.enum(PATTERNS)),
    concepts: z.array(z.string().min(1)),
    /** Curated lists the problem was imported from, e.g. [grind-75] (Grind 75 spec §5). */
    lists: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case")).optional(),
    complexity: z
      .object({ time: z.string().min(1), space: z.string().min(1), optimal: z.boolean() })
      .strict()
      .nullable(),
  })
  .strict();

export const exerciseFrontmatter = z.object({ ...workFields, concept: z.string().min(1) }).strict();

export const conceptFrontmatter = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    status: z.enum(["new", "learning", "mastered"]),
    requires: z.array(z.string().min(1)),
    related: z.array(z.string().min(1)),
  })
  .strict();
