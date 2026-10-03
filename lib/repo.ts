import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseMarkdown } from "./frontmatter.ts";
import { exerciseIdFromFolder, problemIdFromFolder } from "./ids.ts";

export { exerciseIdFromFolder, problemIdFromFolder };

export interface DocEntry {
  /** Absolute folder path. */
  dir: string;
  folder: string;
  /** Absolute README.md path. */
  readme: string;
  /** README path relative to the repo root, with "/" separators. */
  rel: string;
  head: string;
  data: Record<string, unknown>;
  body: string;
  /** README missing or unparsable. */
  error: string | null;
}

export interface ProblemEntry extends DocEntry {
  kind: "problem";
  folderId: string;
}

export interface ExerciseEntry extends DocEntry {
  kind: "exercise";
  concept: string;
  folderId: string;
}

export interface ConceptEntry extends DocEntry {
  kind: "concept";
  slug: string;
}

export interface RepoModel {
  root: string;
  problems: ProblemEntry[];
  exercises: ExerciseEntry[];
  concepts: ConceptEntry[];
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function subdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith(".") && statSync(path.join(dir, name)).isDirectory())
    .sort();
}

function readDoc(root: string, dir: string): DocEntry {
  const readme = path.join(dir, "README.md");
  const base = {
    dir,
    folder: path.basename(dir),
    readme,
    rel: path.relative(root, readme).split(path.sep).join("/"),
  };
  if (!existsSync(readme)) return { ...base, head: "", data: {}, body: "", error: "README.md is missing" };
  try {
    return { ...base, ...parseMarkdown(readFileSync(readme, "utf8")), error: null };
  } catch (error) {
    return { ...base, head: "", data: {}, body: "", error: `frontmatter: ${(error as Error).message}` };
  }
}

export function scanRepo(root: string): RepoModel {
  const problems = subdirs(path.join(root, "problems")).map(
    (folder): ProblemEntry => ({
      ...readDoc(root, path.join(root, "problems", folder)),
      kind: "problem",
      folderId: problemIdFromFolder(folder),
    }),
  );
  const concepts: ConceptEntry[] = [];
  const exercises: ExerciseEntry[] = [];
  for (const slug of subdirs(path.join(root, "concepts"))) {
    const conceptDir = path.join(root, "concepts", slug);
    concepts.push({ ...readDoc(root, conceptDir), kind: "concept", slug });
    for (const folder of subdirs(path.join(conceptDir, "exercises"))) {
      exercises.push({
        ...readDoc(root, path.join(conceptDir, "exercises", folder)),
        kind: "exercise",
        concept: slug,
        folderId: exerciseIdFromFolder(slug, folder),
      });
    }
  }
  return { root, problems, exercises, concepts };
}

/**
 * In progress: status solving, or todo with a solution file (created by pnpm watch or the playground).
 * The reminder hook (.claude/hooks/reminder.mjs) applies the same rule in plain JavaScript.
 */
export function isInProgress(entry: Pick<DocEntry, "dir" | "data">): boolean {
  if (entry.data.status === "solving") return true;
  return (
    entry.data.status === "todo" &&
    ["solution.py", "solution.ts"].some((name) => existsSync(path.join(entry.dir, name)))
  );
}
