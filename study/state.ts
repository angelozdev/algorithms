import { desc } from "drizzle-orm";
import { openAttemptList } from "./open-attempts.ts";
import { todaySummary } from "./plan-store.ts";
import { phaseLog } from "./schema.ts";
import { type StudySnapshot, writeStateFile } from "./state-file.ts";
import type { Study } from "./store.ts";

export { openAttemptList };

/** What state.json shows: the phase, the open attempts and today's plan at a glance. Keep the key order stable. */
export function buildSnapshot(study: Study): StudySnapshot {
  const last = study.db.select({ phase: phaseLog.phase }).from(phaseLog).orderBy(desc(phaseLog.id)).limit(1).get();
  return { phase: last?.phase ?? null, inProgress: openAttemptList(study), today: todaySummary(study) };
}

/** Rewrites .study/state.json from the database. Call it after every committed write; it is a no-op in memory. */
export function refreshState(study: Study): { changed: boolean } {
  if (!study.dir) return { changed: false };
  return { changed: writeStateFile(study.dir, buildSnapshot(study)).changed };
}
