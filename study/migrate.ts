import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scanRepo } from "../lib/repo.ts";
import { historyPath, historyStamp, studyRoot } from "../runner/src/paths.ts";
import { LANGS } from "../runner/src/types.ts";
import type { Clock } from "./clock.ts";
import { initStudy } from "./init.ts";
import { refreshState } from "./state.ts";
import { dbPath, openStudy } from "./store.ts";
import { StripError, stripReadme } from "./strip.ts";

export type MigrationAction =
  | { kind: "init"; dir: string; exists: boolean }
  | { kind: "archive"; from: string; to: string; tracked: boolean }
  | { kind: "explanation"; slug: string; to: string; text: string; keep: "readme" | "same" | "study"; history: string | null }
  | { kind: "strip"; file: string; text: string; fields: string[]; log: boolean; explanation: boolean };

export interface MigrationPlan {
  /** Content root. */
  root: string;
  /** Study root. */
  dir: string;
  at: Date;
  actions: MigrationAction[];
  /** READMEs that cannot be stripped by machine: nothing is applied while there are any. */
  blockers: string[];
}

export class MigrationError extends Error {}

const rel = (root: string, file: string): string => path.relative(root, file).split(path.sep).join("/");

/** Repo-relative paths git tracks under problems/ and concepts/ (empty outside a git work tree). */
export function trackedFiles(root: string): Set<string> {
  const run = spawnSync("git", ["-C", root, "ls-files", "-z", "--", "problems", "concepts"], { encoding: "utf8" });
  return run.status === 0 ? new Set(run.stdout.split("\0").filter(Boolean)) : new Set();
}

function explanationAction(dir: string, slug: string, text: string, at: Date): MigrationAction {
  const to = path.join(dir, "explanations", `${slug}.md`);
  const current = existsSync(to) ? readFileSync(to, "utf8").trim() : null;
  if (current === null) return { kind: "explanation", slug, to, text, keep: "readme", history: null };
  if (current === text.trim()) return { kind: "explanation", slug, to, text, keep: "same", history: null };
  const history = path.join(dir, "explanations", "history", `${slug}-${historyStamp(at)}-legacy.md`);
  return { kind: "explanation", slug, to, text, keep: "study", history };
}

/** Everything `pnpm study migrate` would do (spec §9), computed without changing anything. */
export function planMigration(root: string, at: Date): MigrationPlan {
  const dir = studyRoot(root);
  const repo = scanRepo(root);
  const tracked = trackedFiles(root);
  const actions: MigrationAction[] = [{ kind: "init", dir, exists: existsSync(dbPath(dir)) }];
  const blockers: string[] = [];
  for (const entry of [...repo.problems, ...repo.exercises]) {
    const target = { id: entry.folderId, kind: entry.kind, dir: entry.dir };
    for (const lang of LANGS) {
      const from = path.join(entry.dir, `solution.${lang}`);
      if (!existsSync(from)) continue;
      actions.push({ kind: "archive", from, to: historyPath(target, lang, at, { legacy: true }), tracked: tracked.has(rel(root, from)) });
    }
  }
  for (const entry of [...repo.problems, ...repo.exercises, ...repo.concepts]) {
    if (entry.error) {
      if (existsSync(entry.readme)) blockers.push(`${entry.rel}: ${entry.error}`);
      continue;
    }
    const raw = readFileSync(entry.readme, "utf8");
    let stripped: ReturnType<typeof stripReadme>;
    try {
      stripped = stripReadme(raw, entry.kind);
    } catch (error) {
      if (!(error instanceof StripError)) throw error;
      blockers.push(`${entry.rel}: ${error.message}`);
      continue;
    }
    if (entry.kind === "concept" && stripped.explanation !== null) actions.push(explanationAction(dir, entry.slug, stripped.explanation, at));
    if (stripped.text !== raw) {
      actions.push({ kind: "strip", file: entry.readme, text: stripped.text, fields: stripped.fields, log: stripped.log, explanation: stripped.explanation !== null });
    }
  }
  return { root, dir, at, actions, blockers };
}

/** True when the plan only re-initializes an existing store. */
export function nothingToMigrate(plan: MigrationPlan): boolean {
  return plan.actions.every((action) => action.kind === "init" && action.exists);
}

/** One line per action, paths relative to the content root. */
export function describeAction(plan: MigrationPlan, action: MigrationAction): string {
  const show = (file: string): string => {
    const relative = path.relative(plan.root, file);
    return relative.startsWith("..") || path.isAbsolute(relative) ? file : relative.split(path.sep).join("/");
  };
  const line = (verb: string, rest: string): string => `${verb.padEnd(12)}${rest}`;
  switch (action.kind) {
    case "init":
      return line("init", `${show(action.dir)}/ (${action.exists ? "exists: apply new migrations, rewrite tsconfig.json" : "study.db, tsconfig.json, profile"})`);
    case "archive":
      return line("archive", `${show(action.from)} → ${show(action.to)}${action.tracked ? " (tracked: git rm --cached)" : ""}`);
    case "explanation":
      if (action.keep === "readme") return line("explanation", `${action.slug} → ${show(action.to)}`);
      if (action.keep === "same") return line("explanation", `${action.slug}: ${show(action.to)} already has this text`);
      return line("explanation", `${action.slug}: ${show(action.to)} has newer text; the README's goes to ${show(action.history!)}`);
    case "strip": {
      const what = [...action.fields, ...(action.log ? ["## Log"] : []), ...(action.explanation ? ["My explanation text"] : [])];
      return line("strip", `${show(action.file)} (${what.join(", ")})`);
    }
  }
}

/** A legacy copy with exactly these bytes, left by an earlier run that stopped before deleting the original. */
function sameLegacyCopy(historyDir: string, ext: string, bytes: Buffer): boolean {
  if (!existsSync(historyDir)) return false;
  return readdirSync(historyDir).some((name) => name.endsWith(`-legacy${ext}`) && readFileSync(path.join(historyDir, name)).equals(bytes));
}

/** Copy, verify the bytes, then delete (spec §9.2). A tracked file leaves the index with git rm --cached; the user commits. */
function archive(root: string, action: Extract<MigrationAction, { kind: "archive" }>): void {
  const bytes = readFileSync(action.from);
  if (!sameLegacyCopy(path.dirname(action.to), path.extname(action.to), bytes)) {
    mkdirSync(path.dirname(action.to), { recursive: true });
    copyFileSync(action.from, action.to, constants.COPYFILE_EXCL);
    if (!readFileSync(action.to).equals(bytes)) throw new MigrationError(`the copy of ${rel(root, action.from)} differs from it; nothing was deleted`);
  }
  if (action.tracked) {
    const run = spawnSync("git", ["-C", root, "rm", "--cached", "--quiet", "--", rel(root, action.from)], { encoding: "utf8" });
    if (run.status !== 0) throw new MigrationError(`git rm --cached ${rel(root, action.from)} failed: ${run.stderr.trim()}`);
  }
  unlinkSync(action.from);
}

function writeNew(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, { flag: "wx" });
}

/** Applies a plan in order. It stops at the first error; everything done before it is safe to keep, and a re-run resumes. */
export function applyMigration(plan: MigrationPlan, options: { clock: Clock; timezone?: string }): void {
  if (plan.blockers.length > 0) throw new MigrationError(`Cannot migrate yet. Fix these READMEs first:\n${plan.blockers.map((b) => `  - ${b}`).join("\n")}`);
  for (const action of plan.actions) {
    switch (action.kind) {
      case "init":
        initStudy(plan.root, { clock: options.clock, timezone: options.timezone });
        break;
      case "archive":
        archive(plan.root, action);
        break;
      case "explanation":
        if (action.keep === "readme") writeNew(action.to, `${action.text.trim()}\n`);
        if (action.keep === "study") writeNew(action.history!, `${action.text.trim()}\n`);
        break;
      case "strip":
        writeFileSync(action.file, action.text);
        break;
    }
  }
  const study = openStudy(plan.root, { clock: options.clock });
  try {
    refreshState(study);
  } finally {
    study.close();
  }
}
