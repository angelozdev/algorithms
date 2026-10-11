import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { type Catalog, listMembers, loadCatalog } from "./catalog.ts";
import { loadPreset, type Preset, PresetError } from "./curriculum.ts";
import { examPassed } from "./exam.ts";
import { announcements, attempts, attemptStats, curriculumLog, type Phase, PHASES, phaseLog, profile } from "./schema.ts";
import { allItemProgress, conceptProgress, type ItemProgress } from "./status.ts";
import { inTransaction, type Study, type StudyQueries } from "./store.ts";

export interface CurriculumRow {
  id: number;
  preset: string;
  at: Date;
}

export interface PhaseRow {
  id: number;
  phase: Phase;
  at: Date;
  reason: "criteria" | "forced" | "switch";
}

/** The preset in force: the last curriculum_log row (spec §4); null before the coach has started. */
export function currentCurriculum(db: StudyQueries): CurriculumRow | null {
  return db.select({ id: curriculumLog.id, preset: curriculumLog.preset, at: curriculumLog.at }).from(curriculumLog).orderBy(desc(curriculumLog.id)).limit(1).get() ?? null;
}

/** The current phase: the last phase_log row (spec §4). */
export function currentPhase(db: StudyQueries): PhaseRow | null {
  return db.select({ id: phaseLog.id, phase: phaseLog.phase, at: phaseLog.at, reason: phaseLog.reason }).from(phaseLog).orderBy(desc(phaseLog.id)).limit(1).get() ?? null;
}

export function nextPhase(phase: Phase): Phase {
  return PHASES[Math.min(PHASES.indexOf(phase) + 1, PHASES.length - 1)];
}

/** Everything the phase criteria and the planner read, loaded once. */
export interface CoachContext {
  root: string;
  preset: Preset;
  catalog: Catalog;
  progress: Map<string, ItemProgress>;
  /** profile.expansion_list: the second list, chosen at the 2 → 3 transition (spec §6.1). */
  expansionList: string | null;
}

export function loadContext(study: Study, root: string, presetId: string): CoachContext {
  const expansion = study.db.select({ list: profile.expansionList }).from(profile).get();
  return { root, preset: loadPreset(root, presetId), catalog: loadCatalog(root), progress: allItemProgress(study), expansionList: expansion?.list ?? null };
}

/** Learned: the note exists, its explanation is accepted, and every exercise is done (spec §6.1). */
export function conceptLearned(study: Study, ctx: CoachContext, slug: string): boolean {
  const concept = ctx.catalog.concepts.get(slug);
  return concept !== undefined && conceptProgress(study, slug, concept.exercises, ctx.progress).learned;
}

/** Successful reviews per problem: review or exam attempts rated Good or Easy (spec §6.1, phase 1). */
export function reviewSuccesses(db: StudyQueries): Map<string, number> {
  const rows = db
    .select({ itemId: attempts.itemId })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .where(and(inArray(attempts.rating, ["good", "easy"]), ne(attemptStats.kind, "new")))
    .all();
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.itemId, (counts.get(row.itemId) ?? 0) + 1);
  return counts;
}

/** Phase 1 is done for a problem once it was solved and then reviewed successfully twice. */
export const REVIEWS_TO_LEARN = 2;

export function learnedProblems(study: Study, ctx: CoachContext): { members: string[]; learned: string[] } {
  const members = listMembers(ctx.catalog, ctx.preset.phases.learn.list).map((problem) => problem.id);
  const successes = reviewSuccesses(study.db);
  const learned = members.filter((id) => ctx.progress.get(id)?.everGreen && (successes.get(id) ?? 0) >= REVIEWS_TO_LEARN);
  return { members, learned };
}

export interface ExpansionWindow {
  list: string | null;
  /** Success of each first try in the window, oldest first. */
  results: boolean[];
  window: number;
}

/**
 * Phase 3 (spec §6.1): the last `window` unseen Mediums of the expansion list: first tries, by when they ended,
 * of its medium problems that are not in the list of phases 1–2 (those were seen there). Solved alone within `medium_minutes`: green, no hints, and active time (wall
 * time when it was not measured) within the limit.
 */
export function expansionWindow(study: Study, ctx: CoachContext): ExpansionWindow {
  const { window, medium_minutes } = ctx.preset.phases.expand;
  const list = ctx.expansionList;
  if (!list) return { list, results: [], window };
  const seen = new Set(listMembers(ctx.catalog, ctx.preset.phases.learn.list).map((p) => p.id));
  const mediums = new Set(listMembers(ctx.catalog, list).filter((p) => p.difficulty === "medium" && !seen.has(p.id)).map((p) => p.id));
  const rows = study.db
    .select({ itemId: attempts.itemId, startedAt: attempts.startedAt, endedAt: attempts.endedAt, outcome: attempts.outcome, hints: attemptStats.hints, activeMs: attemptStats.activeMs, measured: attemptStats.measured })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .where(isNotNull(attempts.endedAt))
    .orderBy(asc(attempts.startedAt), asc(attempts.id))
    .all();
  const first = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (mediums.has(row.itemId) && !first.has(row.itemId)) first.set(row.itemId, row);
  const limit = medium_minutes * 60_000;
  const results = [...first.values()]
    .sort((a, b) => a.endedAt!.getTime() - b.endedAt!.getTime())
    .slice(-window)
    .map((row) => row.outcome === "green" && row.hints === 0 && (row.measured ? row.activeMs : row.endedAt!.getTime() - row.startedAt.getTime()) <= limit);
  return { list, results, window };
}

/** Exit criteria of each phase (spec §6.1). */
export function exitMet(study: Study, ctx: CoachContext, phase: Phase): boolean {
  switch (phase) {
    case "bases":
      return ctx.preset.phases.bases.concepts.every((slug) => conceptLearned(study, ctx, slug));
    case "learn": {
      const { members, learned } = learnedProblems(study, ctx);
      return members.length > 0 && learned.length === members.length;
    }
    case "master": {
      const { list, first_try_success } = ctx.preset.phases.master;
      return examPassed(study.db, list, listMembers(ctx.catalog, list).map((p) => p.id), first_try_success);
    }
    case "expand": {
      const { results, window } = expansionWindow(study, ctx);
      return results.length >= window && results.filter(Boolean).length / window >= ctx.preset.phases.expand.unseen_medium_success;
    }
    case "pro":
      return false;
  }
}

/** The phase from scratch: the first one whose exit criteria are not met (curriculum switches, spec §6.5). */
export function computePhase(study: Study, ctx: CoachContext): Phase {
  let phase: Phase = "bases";
  while (phase !== "pro" && exitMet(study, ctx, phase)) phase = nextPhase(phase);
  return phase;
}

export interface PhaseChange {
  phaseLogId: number;
  announcementId: number;
  from: Phase | null;
  to: Phase;
}

/**
 * Spec §6.1: criteria are evaluated after every recorded attempt and on every `today`. A phase whose criteria are
 * met moves to the next one (possibly several), each with a phase_log row and an announcement that references it.
 * It never moves back: absence never lowers a phase. Throws PresetError when the preset in force is invalid.
 */
export function syncPhase(study: Study, root: string, now: Date): PhaseChange[] {
  return inTransaction(study, (tx) => {
    const curriculum = currentCurriculum(tx);
    const current = currentPhase(tx);
    if (!curriculum || !current) return [];
    const ctx = loadContext(study, root, curriculum.preset);
    const changes: PhaseChange[] = [];
    let phase = current.phase;
    while (phase !== "pro" && exitMet(study, ctx, phase)) {
      const to = nextPhase(phase);
      const row = tx.insert(phaseLog).values({ at: now, phase: to, reason: "criteria", curriculumLogId: curriculum.id }).returning({ id: phaseLog.id }).get();
      const announcement = tx.insert(announcements).values({ at: now, kind: "phase", phaseLogId: row.id }).returning({ id: announcements.id }).get();
      changes.push({ phaseLogId: row.id, announcementId: announcement.id, from: phase, to });
      phase = to;
    }
    return changes;
  });
}

/** After a recorded attempt: evaluate the criteria, but a broken preset must not break the recording (spec §13). */
export function evaluatePhase(study: Study): void {
  if (!study.root) return;
  try {
    syncPhase(study, study.root, study.clock.now());
  } catch (error) {
    if (!(error instanceof PresetError)) throw error;
  }
}
