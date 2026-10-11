import { eq, isNull } from "drizzle-orm";
import { attempts, attemptStats } from "./schema.ts";
import type { InProgressItem } from "./state-file.ts";
import type { Study } from "./store.ts";

/**
 * Open attempts, oldest first: state.json's in-progress list, the reminder hook's and `study status`'s.
 * Its own module (it used to live in state.ts) so that state.ts can import the plan's summary without a cycle.
 */
export function openAttemptList(study: Study): InProgressItem[] {
  return study.db
    .select({ id: attempts.itemId, kind: attemptStats.kind, hints: attemptStats.hints, startedAt: attempts.startedAt })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .where(isNull(attempts.endedAt))
    .orderBy(attempts.startedAt, attempts.id)
    .all()
    .map((row) => ({ ...row, startedAt: row.startedAt.toISOString() }));
}
