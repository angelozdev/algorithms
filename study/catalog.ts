import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseMarkdown } from "../lib/frontmatter.ts";
import { problemIdFromFolder } from "../lib/ids.ts";
import { type ExerciseEntry, type ProblemEntry, scanRepo, str, strList } from "../lib/repo.ts";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** A problem as the engine sees it (spec D11: content stays in files; the engine joins it in memory). */
export interface CatalogProblem {
  id: string;
  title: string;
  difficulty: Difficulty | null;
  /** The first entry of `patterns` (spec §6.2); null when there is none. */
  pattern: string | null;
  lists: string[];
}

export interface CatalogExercise {
  id: string;
  title: string;
  concept: string;
}

export interface CatalogConcept {
  slug: string;
  title: string;
  /** Runnable exercise ids, in folder order. */
  exercises: string[];
}

export interface Catalog {
  problems: Map<string, CatalogProblem>;
  exercises: Map<string, CatalogExercise>;
  concepts: Map<string, CatalogConcept>;
}

const difficultyOf = (value: unknown): Difficulty | null => DIFFICULTIES.find((d) => d === value) ?? null;
/** Runnable, like listTargets(): a README that parses, and a cases.json (spec §5: "load as runnable targets"). */
const runnable = (entry: ProblemEntry | ExerciseEntry): boolean => entry.error === null && existsSync(path.join(entry.dir, "cases.json"));

/** Everything the engine needs from content, read once per command or request. */
export function loadCatalog(root: string): Catalog {
  const repo = scanRepo(root);
  const problems = new Map<string, CatalogProblem>();
  for (const entry of repo.problems.filter(runnable)) {
    problems.set(entry.folderId, {
      id: entry.folderId,
      title: str(entry.data.title, entry.folder),
      difficulty: difficultyOf(entry.data.difficulty),
      pattern: strList(entry.data.patterns)[0] ?? null,
      lists: strList(entry.data.lists),
    });
  }
  const exercises = new Map<string, CatalogExercise>();
  for (const entry of repo.exercises.filter(runnable)) {
    exercises.set(entry.folderId, { id: entry.folderId, title: str(entry.data.title, entry.folder), concept: entry.concept });
  }
  const concepts = new Map<string, CatalogConcept>();
  for (const entry of repo.concepts) {
    concepts.set(entry.slug, {
      slug: entry.slug,
      title: str(entry.data.title, entry.slug),
      exercises: [...exercises.values()].filter((exercise) => exercise.concept === entry.slug).map((exercise) => exercise.id),
    });
  }
  return { problems, exercises, concepts };
}

/** LeetCode's number in "lc-0242"; null for other ids. */
export function problemNumber(id: string): number | null {
  const match = /^[a-z]+-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Easy to hard (spec §6.2), then by number, then by id; a missing difficulty sorts as medium. */
export function easyToHard(a: CatalogProblem, b: CatalogProblem): number {
  return (
    RANK[a.difficulty ?? "medium"] - RANK[b.difficulty ?? "medium"] ||
    (problemNumber(a.id) ?? Number.MAX_SAFE_INTEGER) - (problemNumber(b.id) ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id)
  );
}

/** The problems of a list (frontmatter `lists`, spec §5), by id. */
export function listMembers(catalog: Catalog, list: string): CatalogProblem[] {
  return [...catalog.problems.values()].filter((problem) => problem.lists.includes(list)).sort((a, b) => a.id.localeCompare(b.id));
}

/** The title of a problem, an exercise or a concept; null when the content is gone (an orphan, spec §13). */
export function itemTitle(catalog: Catalog, id: string): string | null {
  return catalog.problems.get(id)?.title ?? catalog.exercises.get(id)?.title ?? catalog.concepts.get(id)?.title ?? null;
}

/**
 * One problem's README, without scanning the repo: the close seam reads the difficulty on every closed attempt.
 * Null when there is no such folder or its README does not parse. Never throws.
 */
export function readProblem(root: string, id: string): CatalogProblem | null {
  try {
    const dir = path.join(root, "problems");
    const folder = readdirSync(dir).find((name) => problemIdFromFolder(name) === id);
    if (!folder) return null;
    const { data } = parseMarkdown(readFileSync(path.join(dir, folder, "README.md"), "utf8"));
    return { id, title: str(data.title, folder), difficulty: difficultyOf(data.difficulty), pattern: strList(data.patterns)[0] ?? null, lists: strList(data.lists) };
  } catch {
    return null;
  }
}
