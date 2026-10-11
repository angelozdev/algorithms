import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { type ConceptEntry, type DocEntry, type ExerciseEntry, type ProblemEntry, type RepoModel, scanRepo, str, strList } from "../../lib/repo.ts";
import { conceptFrontmatter, exerciseFrontmatter, LEGACY_PERSONAL_FIELDS, problemFrontmatter } from "../../lib/schemas.ts";
import { studyRoot } from "../../runner/src/paths.ts";
import { assertHiddenFilled, CaseFileError, formatPath, loadCaseFile } from "../../runner/src/schema.ts";
import { loadStressCases } from "../../runner/src/stress.ts";
import type { CaseFile } from "../../runner/src/types.ts";
import { dbPath } from "../../study/store.ts";
import { StripError, stripReadme } from "../../study/strip.ts";
import { replaceAuto } from "./auto.ts";
import { missingConcepts } from "./render.ts";
import { listPresets, loadPreset, PresetError } from "../../study/curriculum.ts";

export interface Issue {
  file: string;
  message: string;
}

export interface CheckReport {
  errors: Issue[];
  warnings: Issue[];
}

const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** Text of a "## heading" section, HTML comments removed and trimmed. null if the heading is absent. */
export function sectionText(body: string, heading: string): string | null {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
}

function markdownFiles(root: string): string[] {
  const files = ["INDEX.md", "README.md", "CLAUDE.md"].map((name) => path.join(root, name)).filter((file) => existsSync(file));
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".md")) files.push(full);
    }
  };
  walk(path.join(root, "problems"));
  walk(path.join(root, "concepts"));
  return files;
}

function findCycle(repo: RepoModel): string[] | null {
  const graph = new Map(repo.concepts.map((concept) => [concept.slug, strList(concept.data.requires)]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (slug: string): string[] | null => {
    if (!graph.has(slug) || state.get(slug) === "done") return null;
    if (state.get(slug) === "visiting") return [...stack.slice(stack.indexOf(slug)), slug];
    state.set(slug, "visiting");
    stack.push(slug);
    for (const next of graph.get(slug)!) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(slug, "done");
    return null;
  };
  for (const slug of [...graph.keys()].sort()) {
    const cycle = visit(slug);
    if (cycle) return cycle;
  }
  return null;
}

export interface CheckOptions {
  /** Time limit for each stress generator (default STRESS_LOAD_TIMEOUT_MS). */
  stressLoadMs?: number;
}

export async function checkRepo(root: string, options: CheckOptions = {}): Promise<CheckReport> {
  const repo = scanRepo(root);
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const rel = (file: string): string => path.relative(root, file).split(path.sep).join("/");
  const error = (file: string, message: string): void => {
    errors.push({ file, message });
  };

  /**
   * Personal progress left in content (spec D1, §10). While the study store does not exist (the user has not
   * migrated yet) it is one warning; once .study/study.db exists, every place is an error that
   * `pnpm study migrate` fixes.
   */
  const migrated = existsSync(dbPath(studyRoot(root)));
  const personal: Issue[] = [];
  const MIGRATE_HINT = "pnpm study migrate moves it to .study/";

  /** Validates the content fields; personal keys are left to findPersonal. */
  const validate = (entry: DocEntry, schema: z.ZodType, personalKeys: readonly string[]): boolean => {
    if (entry.error) {
      error(entry.rel, entry.error);
      return false;
    }
    const data = Object.fromEntries(Object.entries(entry.data).filter(([key]) => !personalKeys.includes(key)));
    const parsed = schema.safeParse(data);
    if (parsed.success) return true;
    for (const issue of parsed.error.issues) error(entry.rel, `frontmatter ${formatPath(issue.path)}: ${issue.message}`);
    return false;
  };

  const findPersonal = (entry: ProblemEntry | ExerciseEntry | ConceptEntry): void => {
    if (entry.error) return;
    try {
      const found = stripReadme(entry.head + entry.body, entry.kind);
      const what = [...found.fields, ...(found.log ? ["## Log"] : []), ...(found.explanation !== null ? ['"My explanation" text'] : [])];
      if (what.length > 0) personal.push({ file: entry.rel, message: `personal progress in content: ${what.join(", ")} (${MIGRATE_HINT})` });
    } catch (caught) {
      if (!(caught instanceof StripError)) throw caught;
      personal.push({ file: entry.rel, message: `${caught.message} (fix it by hand, then run pnpm study migrate)` });
    }
  };

  const findSolutions = (entry: ProblemEntry | ExerciseEntry): void => {
    for (const lang of ["py", "ts"]) {
      const file = path.join(entry.dir, `solution.${lang}`);
      if (existsSync(file)) personal.push({ file: rel(file), message: "solution file in a content folder (pnpm study migrate archives it in .study/solutions)" });
    }
  };

  const requireAuto = (entry: DocEntry, names: string[]): void => {
    if (entry.error) return;
    for (const name of names) {
      if (replaceAuto(entry.body, name, "") === null) error(entry.rel, `missing <!-- auto:${name} --> … <!-- /auto --> section`);
    }
  };

  const requireCases = (entry: DocEntry): CaseFile | undefined => {
    const file = path.join(entry.dir, "cases.json");
    if (!existsSync(file)) {
      error(entry.rel, "cases.json is missing");
      return undefined;
    }
    let cf: CaseFile | undefined;
    try {
      cf = loadCaseFile(entry.dir);
      assertHiddenFilled(cf);
    } catch (caught) {
      if (!(caught instanceof CaseFileError)) throw caught;
      for (const issue of caught.issues) error(rel(file), issue);
    }
    return cf;
  };

  /** Runs the stress generator only (never a solution); inputs are checked against cases.json when it parsed. */
  const checkStress = async (entry: ProblemEntry | ExerciseEntry, cf: CaseFile | undefined): Promise<void> => {
    try {
      await loadStressCases(entry.dir, entry.folderId, cf, { timeoutMs: options.stressLoadMs });
    } catch (caught) {
      if (!(caught instanceof CaseFileError)) throw caught;
      for (const issue of caught.issues) error(rel(path.join(entry.dir, "stress.ts")), issue);
    }
  };

  for (const problem of repo.problems) {
    if (validate(problem, problemFrontmatter, LEGACY_PERSONAL_FIELDS.problem)) {
      if (problem.data.id !== problem.folderId) {
        error(problem.rel, `id "${str(problem.data.id)}" does not match the folder id "${problem.folderId}"`);
      }
    }
    requireAuto(problem, ["concepts"]);
    findPersonal(problem);
    findSolutions(problem);
    await checkStress(problem, requireCases(problem));
  }

  for (const exercise of repo.exercises) {
    if (validate(exercise, exerciseFrontmatter, LEGACY_PERSONAL_FIELDS.exercise)) {
      if (exercise.data.id !== exercise.folderId) {
        error(exercise.rel, `id "${str(exercise.data.id)}" does not match the folder id "${exercise.folderId}"`);
      }
      if (exercise.data.concept !== exercise.concept) {
        error(exercise.rel, `concept "${str(exercise.data.concept)}" does not match the parent folder "${exercise.concept}"`);
      }
    }
    findPersonal(exercise);
    findSolutions(exercise);
    await checkStress(exercise, requireCases(exercise));
  }

  for (const concept of repo.concepts) {
    if (validate(concept, conceptFrontmatter, LEGACY_PERSONAL_FIELDS.concept)) {
      if (concept.data.slug !== concept.slug) {
        error(concept.rel, `slug "${str(concept.data.slug)}" does not match the folder "${concept.slug}"`);
      }
    }
    requireAuto(concept, ["exercises", "problems"]);
    findPersonal(concept);
  }

  const cycle = findCycle(repo);
  if (cycle) error("concepts", `requires has a cycle: ${cycle.join(" → ")}`);

  for (const file of markdownFiles(root)) {
    const text = readFileSync(file, "utf8")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`\n]*`/g, "");
    for (const match of text.matchAll(LINK)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
      const clean = decodeURI(target.split("#")[0]);
      if (!existsSync(path.resolve(path.dirname(file), clean))) error(rel(file), `broken link: ${target}`);
    }
  }

  // Curriculum presets (study coach spec §5, §10): each must be valid, and a pattern of its list's problems that
  // it does not list goes after the listed ones, which deserves a warning.
  for (const id of listPresets(root)) {
    const file = `curriculum/${id}.yaml`;
    try {
      const preset = loadPreset(root, id);
      const listed = new Set<string>(preset.patterns.map((entry) => entry.pattern));
      const missing = new Map<string, string[]>();
      for (const problem of repo.problems) {
        const pattern = strList(problem.data.patterns)[0];
        if (!pattern || listed.has(pattern) || !strList(problem.data.lists).includes(preset.phases.learn.list)) continue;
        missing.set(pattern, [...(missing.get(pattern) ?? []), problem.folderId]);
      }
      for (const [pattern, ids] of missing) {
        warnings.push({ file, message: `pattern "${pattern}" is not in patterns, so phase 1 serves it after the listed ones (${ids.join(", ")})` });
      }
    } catch (caught) {
      if (!(caught instanceof PresetError)) throw caught;
      for (const issue of caught.issues) error(file, issue);
    }
  }

  for (const [slug, by] of missingConcepts(repo)) {
    warnings.push({ file: "concepts", message: `"${slug}" is referenced but not created (${by.join(", ")})` });
  }

  if (migrated) errors.push(...personal);
  else if (personal.length > 0) {
    warnings.push({
      file: ".",
      message: `${personal.length} place(s) still hold personal progress from before the study coach; ${MIGRATE_HINT} (study coach spec §9)`,
    });
  }
  return { errors, warnings };
}
