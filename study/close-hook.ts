import { desc, eq } from "drizzle-orm";
import { readProblem } from "./catalog.ts";
import type { Clock } from "./clock.ts";
import { timeboxMinutes, tryLoadPreset } from "./curriculum.ts";
import { rateAttempt, rebuildCard } from "./fsrs.ts";
import { attempts, attemptStats, curriculumLog, type Outcome, type Rating } from "./schema.ts";
import type { StudyQueries, StudyTx } from "./store.ts";

export interface ClosedAttempt {
  id: number;
  itemId: string;
  examId: number | null;
  startedAt: Date;
  endedAt: Date;
  outcome: Outcome;
}

export interface CloseContext {
  /** Content root, for reading the item's README (its difficulty, for the time-box). Null in memory-only tests. */
  root: string | null;
  clock: Clock;
}

/** The time-box in force for a problem now: the current preset's, by the README's difficulty (spec §5, §6.3). */
export function timeboxNow(db: StudyQueries, root: string | null, itemId: string): number {
  const current = db.select({ preset: curriculumLog.preset }).from(curriculumLog).orderBy(desc(curriculumLog.id)).limit(1).get();
  const difficulty = root ? (readProblem(root, itemId)?.difficulty ?? null) : null;
  return timeboxMinutes(tryLoadPreset(root, current?.preset ?? null), difficulty);
}

/**
 * The close seam (spec §7 "Closing", §6.3). closeAttempt calls it exactly once per attempt, inside the closing
 * transaction, right after ended_at and outcome are written. For a problem (an id without "/") it:
 * - rates the attempt from its outcome, attempt_stats (hints, active_ms, measured) and the time-box in force;
 * - rebuilds the item's card by replaying its rated attempts (the cache always equals the replay).
 * Exercises keep rating null and get no card. A throw rolls the close back, so nothing here may fail on content:
 * a missing README or preset falls back to the default time-boxes.
 */
export function onAttemptClosed(tx: StudyTx, attempt: ClosedAttempt, ctx: CloseContext): Rating | null {
  if (attempt.itemId.includes("/")) return null;
  const stats = tx.select().from(attemptStats).where(eq(attemptStats.attemptId, attempt.id)).get();
  const rating = rateAttempt({
    outcome: attempt.outcome,
    hints: stats?.hints ?? 0,
    activeMs: stats?.activeMs ?? 0,
    measured: stats?.measured ?? false,
    timeboxMinutes: timeboxNow(tx, ctx.root, attempt.itemId),
  });
  tx.update(attempts).set({ rating }).where(eq(attempts.id, attempt.id)).run();
  rebuildCard(tx, attempt.itemId);
  return rating;
}
