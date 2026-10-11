import { and, asc, eq, max } from "drizzle-orm";
import { listMembers } from "./catalog.ts";
import { conceptOf, patternOrder, timeboxMinutes } from "./curriculum.ts";
import { addDays, DAY_MS, type LocalDay, localDay } from "./days.ts";
import { createExam, type ExamResult, examResult, openExam, rateReached } from "./exam.ts";
import { type CardValues, pauseSpans, retrievability, storedCards } from "./fsrs.ts";
import { openPause } from "./pause.ts";
import { type CoachContext, conceptLearned, currentCurriculum, currentPhase, loadContext } from "./phase.ts";
import { type PlanMode, type PlanSlot, type ProfileSettings, readProfile, type StoredPlan, storedPlan } from "./plan-store.ts";
import { seedFrom, shuffled } from "./random.ts";
import { announcements, attemptEvents, attempts, attemptStats, type AttemptKind, dailyPlans, type Phase, patternIntros, planItems } from "./schema.ts";
import { learnSequence } from "./sequence.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study, type StudyQueries } from "./store.ts";

/** Reviews fill about this share of the daily budget (spec §6.2). */
export const REVIEW_SHARE = 0.6;
/** A review is estimated at this share of the item's time-box (spec §6.2). */
export const REVIEW_FACTOR = 0.6;
/** A concept slot's estimate: reading the note and its exercises. */
export const CONCEPT_MINUTES = 20;
/** Return mode after this many days with no activity (spec §6.4). */
export const RETURN_AFTER_DAYS = 7;
/** A catch-up day when more than this many days of review capacity are overdue (spec §6.4). */
export const CATCH_UP_DAYS = 3;

/** What the user has done, read once per plan. */
export interface Facts {
  /** Items with any attempt, open or closed. */
  attempted: Set<string>;
  /** When each item's first attempt closed. */
  firstClosed: Map<string, Date>;
  /** Open attempts, oldest first. */
  open: { itemId: string; kind: AttemptKind; examId: number | null; startedAt: Date }[];
  /** The latest attempt start, end or event. */
  lastActivity: Date | null;
}

export function loadFacts(db: StudyQueries): Facts {
  const rows = db
    .select({ itemId: attempts.itemId, startedAt: attempts.startedAt, endedAt: attempts.endedAt, examId: attempts.examId, kind: attemptStats.kind })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .orderBy(asc(attempts.startedAt), asc(attempts.id))
    .all();
  const facts: Facts = { attempted: new Set(), firstClosed: new Map(), open: [], lastActivity: null };
  let last = 0;
  for (const row of rows) {
    facts.attempted.add(row.itemId);
    if (row.endedAt && !facts.firstClosed.has(row.itemId)) facts.firstClosed.set(row.itemId, row.endedAt);
    if (!row.endedAt) facts.open.push({ itemId: row.itemId, kind: row.kind, examId: row.examId, startedAt: row.startedAt });
    last = Math.max(last, row.startedAt.getTime(), row.endedAt?.getTime() ?? 0);
  }
  const event = db.select({ at: max(attemptEvents.at) }).from(attemptEvents).get()?.at;
  if (event) last = Math.max(last, event.getTime());
  facts.lastActivity = last > 0 ? new Date(last) : null;
  return facts;
}

/** A problem's estimate: its time-box, or `factor` of it for a review (spec §6.2). */
export function problemMinutes(ctx: CoachContext, itemId: string, factor = 1): number {
  return Math.round(timeboxMinutes(ctx.preset, ctx.catalog.problems.get(itemId)?.difficulty ?? null) * factor);
}

/** An open attempt's estimate: exercises take an easy problem's time-box; reviews 0.6 of theirs. */
function continueMinutes(ctx: CoachContext, open: Facts["open"][number]): number {
  if (open.itemId.includes("/")) return timeboxMinutes(ctx.preset, "easy");
  return problemMinutes(ctx, open.itemId, open.kind === "review" ? REVIEW_FACTOR : 1);
}

export interface DueCard {
  itemId: string;
  card: CardValues;
}

/** Cards due before `end` (the end of the local day) for problems that still exist and are not open now. */
export function dueCards(db: StudyQueries, ctx: CoachContext, facts: Facts, end: Date): DueCard[] {
  const open = new Set(facts.open.map((attempt) => attempt.itemId));
  return [...storedCards(db)]
    .filter(([itemId, card]) => card.due.getTime() < end.getTime() && ctx.catalog.problems.has(itemId) && !open.has(itemId))
    .map(([itemId, card]) => ({ itemId, card }));
}

/** Most overdue first; in return mode, highest retrievability first, for a quick win (spec §6.4). */
export function reviewOrder(due: DueCard[], mode: PlanMode, now: Date): DueCard[] {
  const byDue = (a: DueCard, b: DueCard) => a.card.due.getTime() - b.card.due.getTime() || a.itemId.localeCompare(b.itemId);
  if (mode !== "return") return [...due].sort(byDue);
  return [...due].sort((a, b) => retrievability(b.card, now) - retrievability(a.card, now) || byDue(a, b));
}

/** Time with no practice, not counting finished pauses (a pause is not an absence). */
function idleMs(db: StudyQueries, since: Date, now: Date): number {
  let paused = 0;
  for (const span of pauseSpans(db)) paused += Math.max(0, Math.min(span.end, now.getTime()) - Math.max(span.start, since.getTime()));
  return now.getTime() - since.getTime() - paused;
}

/** A new item or a concept, as the plan stores it. */
export interface NewSlot {
  itemId: string;
  slot: Extract<PlanSlot, "new" | "concept">;
  pattern: string | null;
  blockIndex: number | null;
  minutes: number;
  /** A pattern to record in pattern_intros if this slot is planned. */
  introduces: string | null;
}

/** New items for `phase`, in order; the caller takes as many as the budget allows (spec §6.2). `exam` is phase 2's open exam, precomputed by the caller so it is opened at most once. */
export function* newSlots(study: Study, db: StudyQueries, ctx: CoachContext, phase: Phase, facts: Facts, day: LocalDay, now: Date, exam: ExamResult | null): Generator<NewSlot> {
  const unattempted = (ids: string[]) => ids.filter((id) => !facts.attempted.has(id));
  const seeded = (ids: string[]) => shuffled([...ids].sort(), seedFrom(day.date));
  switch (phase) {
    case "bases": {
      const slug = ctx.preset.phases.bases.concepts.find((concept) => !conceptLearned(study, ctx, concept));
      if (slug) yield { itemId: slug, slot: "concept", pattern: null, blockIndex: null, minutes: CONCEPT_MINUTES, introduces: null };
      return;
    }
    case "learn": {
      const learn = ctx.preset.phases.learn;
      const intros = db.select({ pattern: patternIntros.pattern, at: patternIntros.introducedAt }).from(patternIntros).orderBy(asc(patternIntros.introducedAt), asc(patternIntros.pattern)).all();
      for (const { step, introduces } of learnSequence({
        date: day.date,
        now,
        order: patternOrder(ctx.preset, ctx.catalog),
        members: listMembers(ctx.catalog, learn.list),
        block: learn.block,
        mixAfterBlock: learn.mix_after_block,
        intros,
        attempted: facts.attempted,
        firstClosed: facts.firstClosed,
        conceptOf: (pattern) => conceptOf(ctx.preset, pattern),
        conceptLearned: (slug) => conceptLearned(study, ctx, slug),
      })) {
        if (step.kind === "concept") yield { itemId: step.slug, slot: "concept", pattern: step.pattern, blockIndex: null, minutes: CONCEPT_MINUTES, introduces };
        else yield { itemId: step.itemId, slot: "new", pattern: step.pattern, blockIndex: step.kind === "block" ? step.index : null, minutes: problemMinutes(ctx, step.itemId), introduces };
      }
      return;
    }
    case "master": {
      const open = new Set(facts.open.map((attempt) => attempt.itemId));
      for (const itemId of exam?.remaining ?? []) {
        if (!open.has(itemId)) yield { itemId, slot: "new", pattern: null, blockIndex: null, minutes: problemMinutes(ctx, itemId), introduces: null };
      }
      return;
    }
    case "expand": {
      // Until the coach stores the list (2 → 3) and it is imported, only reviews are served (spec §6.1).
      if (!ctx.expansionList) return;
      for (const itemId of seeded(unattempted(listMembers(ctx.catalog, ctx.expansionList).map((p) => p.id)))) {
        yield { itemId, slot: "new", pattern: null, blockIndex: null, minutes: problemMinutes(ctx, itemId), introduces: null };
      }
      return;
    }
    case "pro":
      for (const itemId of seeded(unattempted([...ctx.catalog.problems.keys()]))) {
        yield { itemId, slot: "new", pattern: null, blockIndex: null, minutes: problemMinutes(ctx, itemId), introduces: null };
      }
  }
}

interface PlannedRow {
  itemId: string;
  slot: PlanSlot;
  pattern: string | null;
  blockIndex: number | null;
}

/** Phase 2's exam in progress, opening a new one when the rate is not yet reached (spec §6.1); null once passed. */
function masterExam(db: StudyQueries, ctx: CoachContext, now: Date, day: LocalDay): ExamResult | null {
  const { list, first_try_success } = ctx.preset.phases.master;
  const members = listMembers(ctx.catalog, list).map((problem) => problem.id);
  let exam = openExam(db, list, members);
  if (!exam && !rateReached(db, list, members, first_try_success)) exam = examResult(db, createExam(db, list, now, day.date), members);
  return exam;
}

/** Builds and stores today's plan (spec §6.2, §6.4) in the caller's transaction. */
function buildPlan(study: Study, db: StudyQueries, ctx: CoachContext, phase: Phase, profile: ProfileSettings, day: LocalDay, now: Date): void {
  const facts = loadFacts(db);
  const budget = profile.dailyMinutes;
  const rows: PlannedRow[] = [];
  let used = 0;

  // 1. Continue: every open attempt.
  for (const open of facts.open) {
    rows.push({ itemId: open.itemId, slot: "continue", pattern: null, blockIndex: null });
    used += continueMinutes(ctx, open);
  }

  // Phase 2's open exam serves its remaining items; they are excluded below so they are never also planned as
  // reviews (ruling I1).
  const exam = phase === "master" ? masterExam(db, ctx, now, day) : null;
  const examRemaining = new Set(exam?.remaining ?? []);

  // 2. Reviews: due cards until about 60% of the budget, at least one when any is due.
  let mode: PlanMode = facts.lastActivity && idleMs(db, facts.lastActivity, now) >= RETURN_AFTER_DAYS * DAY_MS ? "return" : "normal";
  const due = dueCards(db, ctx, facts, day.end).filter(({ itemId }) => !examRemaining.has(itemId));
  let reviewMinutes = 0;
  const reviews: string[] = [];
  for (const { itemId } of reviewOrder(due, mode, now)) {
    const minutes = problemMinutes(ctx, itemId, REVIEW_FACTOR);
    if (reviews.length > 0 && reviewMinutes + minutes > REVIEW_SHARE * budget) break;
    reviews.push(itemId);
    reviewMinutes += minutes;
  }
  for (const itemId of reviews) rows.push({ itemId, slot: "review", pattern: null, blockIndex: null });
  used += reviewMinutes;
  const overdue = due.filter(({ card }) => card.due.getTime() < day.start.getTime()).length;
  if (mode === "normal" && reviews.length > 0 && overdue > CATCH_UP_DAYS * reviews.length) mode = "catch_up";

  // 3. New: at least one a day; on catch-up days one every other day (spec §6.4).
  const yesterday = storedPlan(db, addDays(day.date, -1));
  const newToday = mode !== "catch_up" || !yesterday?.items.some((item) => item.slot === "new" || item.slot === "concept");
  if (newToday) {
    for (const next of newSlots(study, db, ctx, phase, facts, day, now, exam)) {
      const first = !rows.some((row) => row.slot === "new" || row.slot === "concept");
      if (mode === "catch_up" && !first) break; // spec §6.4: a catch-up day's allowed day caps new items at one.
      if (!first && used + next.minutes > budget) break;
      rows.push({ itemId: next.itemId, slot: next.slot, pattern: next.pattern, blockIndex: next.blockIndex });
      used += next.minutes;
      if (next.introduces) db.insert(patternIntros).values({ pattern: next.introduces, introducedAt: now }).onConflictDoNothing().run();
    }
  }

  db.insert(dailyPlans).values({ localDate: day.date, mode, createdAt: now }).run();
  rows.forEach((row, position) => db.insert(planItems).values({ localDate: day.date, position, ...row }).run());
  if (mode === "return") {
    const welcomed = db.select({ id: announcements.id }).from(announcements).where(and(eq(announcements.kind, "return"), eq(announcements.localDate, day.date))).get();
    if (!welcomed) db.insert(announcements).values({ at: now, kind: "return", localDate: day.date }).run();
  }
}

/**
 * Today's plan (spec §6.2): computed once per local day and stored; `refresh` (pnpm today --refresh) replaces it.
 * Null before the coach starts and while a pause is open. Throws PresetError for an invalid preset.
 */
export function ensurePlan(study: Study, root: string, now: Date, options: { refresh?: boolean } = {}): StoredPlan | null {
  const profile = readProfile(study.db);
  const day = localDay(now, profile.timezone);
  const result = inTransaction(study, (tx) => {
    const curriculum = currentCurriculum(tx);
    const phase = currentPhase(tx);
    if (!curriculum || !phase || openPause(tx)) return null;
    const existing = storedPlan(tx, day.date);
    if (existing && !options.refresh) return existing;
    if (existing) {
      tx.delete(planItems).where(eq(planItems.localDate, day.date)).run();
      tx.delete(dailyPlans).where(eq(dailyPlans.localDate, day.date)).run();
    }
    buildPlan(study, tx, loadContext(study, root, curriculum.preset), phase.phase, profile, day, now);
    return storedPlan(tx, day.date);
  });
  refreshState(study);
  return result;
}
