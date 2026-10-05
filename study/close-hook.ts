import type { Clock } from "./clock.ts";
import type { Outcome } from "./schema.ts";
import type { StudyTx } from "./store.ts";

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

/**
 * THE SEAM FOR PLAN B (study coach spec §7 "Closing", §6.3). closeAttempt calls it exactly once per attempt,
 * inside the closing transaction, right after ended_at and outcome are written.
 *
 * Plan B fills it in for problems (item ids without "/"):
 * - set attempts.rating, from the outcome, attempt_stats (hints, active_ms, measured) and the time-box;
 * - then upsert the item's row in the cards cache.
 *
 * Exercises keep rating null. Anything thrown here rolls the close back, so the attempt stays open.
 * Plan A: does nothing, so rating stays null and no card is written.
 */
export function onAttemptClosed(_tx: StudyTx, _attempt: ClosedAttempt, _ctx: CloseContext): void {}
