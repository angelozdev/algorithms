import { existsSync } from "node:fs";
import path from "node:path";
import { scanRepo, str } from "../../lib/repo.ts";
import type { Target } from "./types.ts";

export class QueryError extends Error {
  constructor(
    message: string,
    readonly candidates: Target[] = [],
  ) {
    super(message);
    this.name = "QueryError";
  }
}

/** Every runnable folder (it has cases.json): problems first, then exercises. */
export function listTargets(root: string): Target[] {
  const repo = scanRepo(root);
  const targets: Target[] = [
    ...repo.problems.map((p) => ({ id: p.folderId, kind: "problem" as const, dir: p.dir, title: str(p.data.title, p.folder) })),
    ...repo.exercises.map((e) => ({ id: e.folderId, kind: "exercise" as const, dir: e.dir, title: str(e.data.title, e.folder) })),
  ];
  return targets.filter((target) => existsSync(path.join(target.dir, "cases.json")));
}

/**
 * Exact id → LeetCode number → substring of id or folder name. Never guesses between several.
 * A digits-only query is a LeetCode number and never falls through to substring matching.
 */
export function resolveQuery(targets: Target[], query: string): Target {
  const q = query.trim().toLowerCase();
  if (!q) {
    throw new QueryError("Give a problem or exercise: an id (lc-0001, greedy/01), a number, or part of the name.");
  }
  const exact = targets.filter((target) => target.id.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const matches = /^\d+$/.test(q)
    ? targets.filter((target) => target.id === `lc-${q.padStart(4, "0")}`)
    : targets.filter(
        (target) => target.id.toLowerCase().includes(q) || path.basename(target.dir).toLowerCase().includes(q),
      );
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new QueryError(`Nothing matches "${query}".`);
  throw new QueryError(`"${query}" matches ${matches.length} problems/exercises — be more specific:`, matches);
}
