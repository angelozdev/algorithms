import { existsSync } from "node:fs";
import { Hono } from "hono";
import { z } from "zod";
import { isInProgress, scanRepo, str, strList, type ConceptEntry, type ExerciseEntry, type ProblemEntry } from "../../lib/repo.ts";
import { listTargets } from "../../runner/src/resolver.ts";
import { assertHiddenFilled, CaseFileError, loadCaseFile } from "../../runner/src/schema.ts";
import { solutionPath } from "../../runner/src/stubs.ts";
import type { Target } from "../../runner/src/types.ts";
import { problemGroups } from "../../scripts/lib/render.ts";
import type { ItemStatusValue } from "../../study/schema.ts";
import { allItemProgress, conceptProgress, emptyProgress, type ItemProgress } from "../../study/status.ts";
import { envClock } from "../../study/clock.ts";
import { startGate } from "../../study/start.ts";
import { cachedStudy, type Study } from "../../study/store.ts";
import type { ConceptStatus, HomeData, ItemStatus, TargetData } from "./types.ts";
import { valid } from "./validate.ts";

const ITEM_STATUSES: readonly ItemStatus[] = ["todo", "solving", "solved", "revealed"];
const CONCEPT_STATUSES: readonly ConceptStatus[] = ["new", "learning", "mastered"];

export function itemStatus(value: unknown): ItemStatus {
  return ITEM_STATUSES.find((status) => status === value) ?? "todo";
}

export function conceptStatus(value: unknown): ConceptStatus {
  return CONCEPT_STATUSES.find((status) => status === value) ?? "new";
}

/** The problem or exercise with exactly this id. Never a fuzzy match: ids come from the app, not from a person. */
export function findTarget(root: string, id: string): Target | null {
  return listTargets(root).find((target) => target.id === id) ?? null;
}

/** The web's status words, kept to limit churn (spec §10), now derived from the study store's item_status view. */
const WEB_STATUS: Record<ItemStatusValue, ItemStatus> = { todo: "todo", in_progress: "solving", solved: "solved", revealed: "revealed" };

/** Recorded progress, or null before `pnpm study init` / `migrate`: until then the old frontmatter fields still speak. */
export interface Progress {
  study: Study;
  items: Map<string, ItemProgress>;
}

export function loadProgress(root: string): Progress | null {
  const study = cachedStudy(root);
  return study ? { study, items: allItemProgress(study) } : null;
}

export interface ItemView {
  status: ItemStatus;
  inProgress: boolean;
  hints: number;
}

export function itemView(entry: ProblemEntry | ExerciseEntry, progress: Progress | null): ItemView {
  if (!progress) {
    // LEGACY: README frontmatter, until `pnpm study migrate` strips it.
    return { status: itemStatus(entry.data.status), inProgress: isInProgress(entry), hints: typeof entry.data.hints === "number" ? entry.data.hints : 0 };
  }
  const item = progress.items.get(entry.folderId) ?? emptyProgress(entry.folderId);
  const status = WEB_STATUS[item.status];
  return { status, inProgress: status === "solving", hints: item.hints };
}

/** mastered once learned; learning once the explanation is accepted or an exercise attempted; new otherwise. */
export function conceptView(concept: ConceptEntry, exercises: readonly ExerciseEntry[], progress: Progress | null): ConceptStatus {
  if (!progress) return conceptStatus(concept.data.status); // LEGACY
  const state = conceptProgress(progress.study, concept.slug, exercises.map((exercise) => exercise.folderId), progress.items);
  if (state.learned) return "mastered";
  return state.accepted || state.exercises.some((exercise) => exercise.status !== "todo") ? "learning" : "new";
}

export function homeData(root: string): HomeData {
  const repo = scanRepo(root);
  const progress = loadProgress(root);
  return {
    problems: repo.problems.map((p) => {
      const view = itemView(p, progress);
      return {
        id: p.folderId,
        title: str(p.data.title, p.folder),
        difficulty: str(p.data.difficulty) || null,
        patterns: strList(p.data.patterns),
        concepts: strList(p.data.concepts),
        lists: strList(p.data.lists),
        status: view.status,
        inProgress: view.inProgress,
        error: p.error,
      };
    }),
    groups: problemGroups(repo).map((group) => ({ pattern: group.pattern, ids: group.problems.map((p) => p.folderId) })),
    concepts: repo.concepts.map((c) => {
      const exercises = repo.exercises.filter((e) => e.concept === c.slug);
      return {
        slug: c.slug,
        title: str(c.data.title, c.slug),
        status: conceptView(c, exercises, progress),
        error: c.error,
        exercises: exercises.map((e) => {
          const view = itemView(e, progress);
          return { id: e.folderId, title: str(e.data.title, e.folder), status: view.status, inProgress: view.inProgress, error: e.error };
        }),
      };
    }),
  };
}

export function targetData(root: string, target: Target): TargetData {
  const repo = scanRepo(root);
  const entry = [...repo.problems, ...repo.exercises].find((e) => e.dir === target.dir);
  const data = entry?.data ?? {};
  const progress = loadProgress(root);
  const view: ItemView = entry ? itemView(entry, progress) : { status: "todo", inProgress: false, hints: 0 };
  const item = progress?.items.get(target.id);
  const gate = progress ? startGate(progress.study, root, target.id, envClock().now()) : null;
  let signature: TargetData["signature"] = null;
  let exampleInput: unknown = null;
  let caseError: string | null = null;
  try {
    const cf = loadCaseFile(target.dir);
    signature = { mode: cf.mode, entry: cf.entry, params: cf.params, returns: cf.returns };
    exampleInput = cf.examples[0]?.input ?? null;
    assertHiddenFilled(cf);
  } catch (error) {
    if (!(error instanceof CaseFileError)) throw error;
    caseError = error.message;
  }
  return {
    id: target.id,
    kind: target.kind,
    title: target.title,
    readme: entry?.rel ?? "",
    markdown: entry && !entry.error ? entry.body : "",
    readmeError: entry ? entry.error : "README.md is missing",
    difficulty: str(data.difficulty) || null,
    url: str(data.url) || null,
    status: view.status,
    inProgress: view.inProgress,
    hints: view.hints,
    signature,
    exampleInput,
    caseError,
    solutions: { py: existsSync(solutionPath(target, "py")), ts: existsSync(solutionPath(target, "ts")) },
    gate: gate ? { kind: gate.kind, minutes: gate.minutes } : null,
    freshStart: item?.open != null && (item.everGreen || item.revealed),
  };
}

export const unknownTarget = (id: string) => ({ error: `There is no problem or exercise with id "${id}".` });

export function targetRoutes(root: string) {
  return new Hono()
    .get("/home", (c) => c.json(homeData(root), 200))
    .get("/target", valid("query", z.object({ id: z.string().min(1) })), (c) => {
      const { id } = c.req.valid("query");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      return c.json(targetData(root, target), 200);
    });
}
