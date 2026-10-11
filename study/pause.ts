import { eq, isNull } from "drizzle-orm";
import { rebuildAllCards } from "./fsrs.ts";
import { pauses } from "./schema.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study, type StudyQueries } from "./store.ts";

/** The open pause, if any (at most one, spec §4). */
export function openPause(db: StudyQueries): { id: number; startedAt: Date } | null {
  return db.select({ id: pauses.id, startedAt: pauses.startedAt }).from(pauses).where(isNull(pauses.endedAt)).get() ?? null;
}

/** `pnpm study pause` or the UI's button (spec §6.4): records the start of a pause. Pausing twice changes nothing. */
export function pauseStudy(study: Study, now: Date): { since: Date; already: boolean } {
  const result = inTransaction(study, (tx) => {
    const open = openPause(tx);
    if (open) return { since: open.startedAt, already: true };
    tx.insert(pauses).values({ startedAt: now }).run();
    return { since: now, already: false };
  });
  refreshState(study);
  return result;
}

/**
 * `pnpm study resume`: ends the open pause, then rebuilds every card, so each due date and last review moves by
 * the paused time (spec §6.4). No attempt is changed.
 */
export function resumeStudy(study: Study, now: Date): { resumed: boolean; pausedMs: number } {
  const result = inTransaction(study, (tx) => {
    const open = openPause(tx);
    if (!open) return { resumed: false, pausedMs: 0 };
    const endedAt = now.getTime() < open.startedAt.getTime() ? open.startedAt : now;
    tx.update(pauses).set({ endedAt }).where(eq(pauses.id, open.id)).run();
    rebuildAllCards(tx);
    return { resumed: true, pausedMs: endedAt.getTime() - open.startedAt.getTime() };
  });
  refreshState(study);
  return result;
}
