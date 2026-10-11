import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { type Clock, fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import {
  announcementAcks,
  announcements,
  attemptEvents,
  attempts,
  cards,
  complexityNotes,
  conceptAcceptances,
  curriculumLog,
  dailyPlans,
  exams,
  type Outcome,
  patternIntros,
  pauses,
  phaseLog,
  planItems,
} from "../schema.ts";
import { refreshState } from "../state.ts";
import { inTransaction, openStudy, type Study } from "../store.ts";

/** The instant every seed uses unless told otherwise. */
export const SEED_AT = "2026-10-04T10:00:00.000Z";

/** Every progress table, children first, so deleting never trips a foreign key. The profile stays. */
const PROGRESS_TABLES: SQLiteTable[] = [
  announcementAcks,
  announcements,
  planItems,
  dailyPlans,
  complexityNotes,
  attemptEvents,
  attempts,
  exams,
  phaseLog,
  curriculumLog,
  patternIntros,
  conceptAcceptances,
  pauses,
  cards,
];

function withStudy(root: string, fn: (study: Study) => void): void {
  const study = openStudy(root, { clock: fixedClock(SEED_AT) });
  try {
    fn(study);
    refreshState(study);
  } finally {
    study.close();
  }
}

/** Sets up `root`'s study store when needed and empties every progress table in place: a running server keeps its handle. */
export function resetStudy(root: string, clock: Clock = fixedClock(SEED_AT)): void {
  initStudy(root, { clock, timezone: "UTC" });
  withStudy(root, (study) =>
    inTransaction(study, (tx) => {
      for (const table of PROGRESS_TABLES) tx.delete(table).run();
    }),
  );
}

/** A finished attempt: the item reads solved (green) or revealed (gave_up). */
export function seedClosedAttempt(root: string, itemId: string, outcome: Outcome, at: Date = new Date(SEED_AT)): void {
  withStudy(root, (study) => study.db.insert(attempts).values({ itemId, startedAt: at, endedAt: new Date(at.getTime() + 60_000), outcome }).run());
}

/** An open attempt with `hints` hint events: the item reads in progress. */
export function seedOpenAttempt(root: string, itemId: string, options: { hints?: number; at?: Date } = {}): void {
  const at = options.at ?? new Date(SEED_AT);
  withStudy(root, (study) =>
    inTransaction(study, (tx) => {
      const attemptId = tx.insert(attempts).values({ itemId, startedAt: at }).returning({ id: attempts.id }).get().id;
      for (let i = 0; i < (options.hints ?? 0); i++) {
        tx.insert(attemptEvents).values({ attemptId, at, type: "hint", lang: null, runGreen: null, source: "skill" }).run();
      }
    }),
  );
}

/** The `concept` skill accepted the explanation of `slug`. */
export function seedAcceptance(root: string, slug: string): void {
  withStudy(root, (study) => study.db.insert(conceptAcceptances).values({ concept: slug, acceptedAt: new Date(SEED_AT) }).run());
}
