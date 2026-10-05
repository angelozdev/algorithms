import { and, desc, eq, isNull } from "drizzle-orm";
import type { Lang } from "../runner/src/types.ts";
import { type ClosedAttempt, onAttemptClosed } from "./close-hook.ts";
import { attemptEvents, attempts, attemptStats, complexityNotes, conceptAcceptances, type EventSource, type Outcome } from "./schema.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study, type StudyTx } from "./store.ts";

/** One edit, save or run of the user's code. An edit or save says whether the code differs from the stub. */
export type WorkEvent = { type: "edit" | "save"; lang: Lang; differsFromStub: boolean } | { type: "run"; lang: Lang; green: boolean };

export type WorkResult =
  | { recorded: true; attemptId: number; opened: boolean; closed: boolean }
  | { recorded: false; reason: "stub" | "closed" };
export type HintResult = { recorded: true; attemptId: number; hints: number } | { recorded: false; reason: "closed" | "exam" };
export type GiveUpResult = { recorded: true; attemptId: number } | { recorded: false; reason: "closed" };
export type ComplexityResult = { recorded: true; attemptId: number } | { recorded: false; reason: "not-green" };

export class AttemptAlreadyOpenError extends Error {
  constructor(readonly itemId: string) {
    super(`${itemId} already has an open attempt`);
    this.name = "AttemptAlreadyOpenError";
  }
}

/** The item's open attempt, if any. */
export function openAttemptOf(tx: StudyTx, itemId: string) {
  return tx.select().from(attempts).where(and(eq(attempts.itemId, itemId), isNull(attempts.endedAt))).get();
}

function hasAttempts(tx: StudyTx, itemId: string): boolean {
  return tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.itemId, itemId)).limit(1).get() !== undefined;
}

/** Opens an attempt (spec §7 "Start"). Plan B's `study start` and exams call it too. Throws when one is open. */
export function openAttempt(tx: StudyTx, itemId: string, at: Date, options: { examId?: number } = {}): number {
  if (openAttemptOf(tx, itemId)) throw new AttemptAlreadyOpenError(itemId);
  return tx.insert(attempts).values({ itemId, startedAt: at, examId: options.examId ?? null }).returning({ id: attempts.id }).get().id;
}

/**
 * Closes an attempt (spec §7 "Closing") and runs the close seam in the same transaction. Closing an attempt
 * that is already closed changes nothing and returns null (idempotent, spec §12).
 */
export function closeAttempt(tx: StudyTx, attemptId: number, outcome: Outcome, at: Date, study: Study): ClosedAttempt | null {
  const row = tx.select().from(attempts).where(eq(attempts.id, attemptId)).get();
  if (!row) throw new Error(`there is no attempt ${attemptId}`);
  if (row.endedAt !== null) return null;
  const endedAt = at.getTime() < row.startedAt.getTime() ? row.startedAt : at;
  tx.update(attempts).set({ endedAt, outcome }).where(eq(attempts.id, attemptId)).run();
  const closed: ClosedAttempt = { id: row.id, itemId: row.itemId, examId: row.examId, startedAt: row.startedAt, endedAt, outcome };
  onAttemptClosed(tx, closed, { root: study.root, clock: study.clock });
  return closed;
}

/**
 * One edit, save or run of the user's code (spec §7):
 * - it opens the item's first attempt on real work (content that differs from the stub, or any run);
 * - it joins the open attempt;
 * - it closes the attempt at the first green run.
 * Once an attempt has closed, later work is polishing and nothing is recorded; a review opens a new attempt
 * explicitly (Plan B).
 */
export function recordWork(study: Study, itemId: string, event: WorkEvent, source: EventSource): WorkResult {
  const at = study.clock.now();
  const result = inTransaction(study, (tx): WorkResult => {
    const open = openAttemptOf(tx, itemId);
    let attemptId = open?.id;
    if (attemptId === undefined) {
      if (hasAttempts(tx, itemId)) return { recorded: false, reason: "closed" };
      if (event.type !== "run" && !event.differsFromStub) return { recorded: false, reason: "stub" };
      attemptId = openAttempt(tx, itemId, at);
    }
    tx.insert(attemptEvents)
      .values({ attemptId, at, type: event.type, lang: event.lang, runGreen: event.type === "run" ? event.green : null, source })
      .run();
    const closed = event.type === "run" && event.green && closeAttempt(tx, attemptId, "green", at, study) !== null;
    return { recorded: true, attemptId, opened: open === undefined, closed };
  });
  if (result.recorded) refreshState(study);
  return result;
}

/** `pnpm -s study record hint <id>` (the `hint` skill). Refused during an exam attempt; nothing to count on after the close. */
export function recordHint(study: Study, itemId: string): HintResult {
  const at = study.clock.now();
  const result = inTransaction(study, (tx): HintResult => {
    const open = openAttemptOf(tx, itemId);
    if (open && open.examId !== null) return { recorded: false, reason: "exam" };
    if (!open && hasAttempts(tx, itemId)) return { recorded: false, reason: "closed" };
    const attemptId = open?.id ?? openAttempt(tx, itemId, at);
    tx.insert(attemptEvents).values({ attemptId, at, type: "hint", lang: null, runGreen: null, source: "skill" }).run();
    const hints = tx.select({ hints: attemptStats.hints }).from(attemptStats).where(eq(attemptStats.attemptId, attemptId)).get()?.hints ?? 0;
    return { recorded: true, attemptId, hints };
  });
  if (result.recorded) refreshState(study);
  return result;
}

/** `pnpm -s study record give-up <id>` (the `give-up` skill): closes the open attempt, or opens and closes one, as gave_up. */
export function giveUp(study: Study, itemId: string): GiveUpResult {
  const at = study.clock.now();
  const result = inTransaction(study, (tx): GiveUpResult => {
    const open = openAttemptOf(tx, itemId);
    if (!open && hasAttempts(tx, itemId)) return { recorded: false, reason: "closed" };
    const attemptId = open?.id ?? openAttempt(tx, itemId, at);
    closeAttempt(tx, attemptId, "gave_up", at, study);
    return { recorded: true, attemptId };
  });
  if (result.recorded) refreshState(study);
  return result;
}

/** `pnpm -s study record complexity` (the `review` skill): a note on the item's latest green attempt. */
export function recordComplexity(study: Study, itemId: string, note: { time: string; space: string; optimal: boolean }): ComplexityResult {
  return inTransaction(study, (tx): ComplexityResult => {
    const green = tx
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.itemId, itemId), eq(attempts.outcome, "green")))
      .orderBy(desc(attempts.endedAt), desc(attempts.id))
      .limit(1)
      .get();
    if (!green) return { recorded: false, reason: "not-green" };
    tx.insert(complexityNotes).values({ attemptId: green.id, ...note }).onConflictDoUpdate({ target: complexityNotes.attemptId, set: note }).run();
    return { recorded: true, attemptId: green.id };
  });
}

/** `pnpm -s study record explanation <slug>` (the `concept` skill). The first acceptance is the one kept. */
export function acceptExplanation(study: Study, slug: string): { acceptedAt: Date; already: boolean } {
  const at = study.clock.now();
  return inTransaction(study, (tx) => {
    const inserted = tx.insert(conceptAcceptances).values({ concept: slug, acceptedAt: at }).onConflictDoNothing().returning().get();
    const row = tx.select().from(conceptAcceptances).where(eq(conceptAcceptances.concept, slug)).get()!;
    return { acceptedAt: row.acceptedAt, already: inserted === undefined };
  });
}
