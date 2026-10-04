import { desc, eq, isNull } from "drizzle-orm";
import { attempts, attemptStats, phaseLog } from "./schema.ts";
import { type InProgressItem, type StudySnapshot, writeStateFile } from "./state-file.ts";
import type { Study } from "./store.ts";

/** Open attempts, oldest first: state.json's in-progress list, the reminder hook's and `study status`'s. */
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

/** What state.json shows. Plan B fills `today` here; Plan A leaves it null. Keep the key order stable. */
export function buildSnapshot(study: Study): StudySnapshot {
  const last = study.db.select({ phase: phaseLog.phase }).from(phaseLog).orderBy(desc(phaseLog.id)).limit(1).get();
  return { phase: last?.phase ?? null, inProgress: openAttemptList(study), today: null };
}

/** Rewrites .study/state.json from the database. Call it after every committed write; it is a no-op in memory. */
export function refreshState(study: Study): { changed: boolean } {
  if (!study.dir) return { changed: false };
  return { changed: writeStateFile(study.dir, buildSnapshot(study)).changed };
}
