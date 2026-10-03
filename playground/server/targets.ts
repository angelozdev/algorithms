import { existsSync } from "node:fs";
import { Hono } from "hono";
import { z } from "zod";
import { isInProgress, scanRepo, str, strList } from "../../lib/repo.ts";
import { listTargets } from "../../runner/src/resolver.ts";
import { assertHiddenFilled, CaseFileError, loadCaseFile } from "../../runner/src/schema.ts";
import { solutionPath } from "../../runner/src/stubs.ts";
import type { Target } from "../../runner/src/types.ts";
import { problemGroups } from "../../scripts/lib/render.ts";
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

export function homeData(root: string): HomeData {
  const repo = scanRepo(root);
  return {
    problems: repo.problems.map((p) => ({
      id: p.folderId,
      title: str(p.data.title, p.folder),
      difficulty: str(p.data.difficulty) || null,
      patterns: strList(p.data.patterns),
      concepts: strList(p.data.concepts),
      status: itemStatus(p.data.status),
      inProgress: isInProgress(p),
      error: p.error,
    })),
    groups: problemGroups(repo).map((group) => ({ pattern: group.pattern, ids: group.problems.map((p) => p.folderId) })),
    concepts: repo.concepts.map((c) => ({
      slug: c.slug,
      title: str(c.data.title, c.slug),
      status: conceptStatus(c.data.status),
      error: c.error,
      exercises: repo.exercises
        .filter((e) => e.concept === c.slug)
        .map((e) => ({
          id: e.folderId,
          title: str(e.data.title, e.folder),
          status: itemStatus(e.data.status),
          inProgress: isInProgress(e),
          error: e.error,
        })),
    })),
  };
}

export function targetData(root: string, target: Target): TargetData {
  const repo = scanRepo(root);
  const entry = [...repo.problems, ...repo.exercises].find((e) => e.dir === target.dir);
  const data = entry?.data ?? {};
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
    status: itemStatus(data.status),
    hints: typeof data.hints === "number" ? data.hints : 0,
    signature,
    exampleInput,
    caseError,
    solutions: { py: existsSync(solutionPath(target.dir, "py")), ts: existsSync(solutionPath(target.dir, "ts")) },
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
