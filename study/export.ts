import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { historyStamp } from "../runner/src/paths.ts";
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
  patternIntros,
  pauses,
  phaseLog,
  planItems,
  profile,
} from "./schema.ts";
import type { Study } from "./store.ts";

/** Every table by its SQL name: what `pnpm study export` writes. */
export const EXPORTED_TABLES: Record<string, SQLiteTable> = {
  profile,
  curriculum_log: curriculumLog,
  phase_log: phaseLog,
  pattern_intros: patternIntros,
  concept_acceptances: conceptAcceptances,
  exams,
  attempts,
  attempt_events: attemptEvents,
  complexity_notes: complexityNotes,
  pauses,
  daily_plans: dailyPlans,
  plan_items: planItems,
  announcements,
  announcement_acks: announcementAcks,
  cards,
};

function exportsDir(study: Study): string {
  if (!study.dir) throw new Error("an in-memory study has nothing to export");
  const dir = path.join(study.dir, "exports");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** `pnpm study export` (spec §12): every row of every table as JSON, instants in ISO 8601. Returns the file. */
export function exportStudy(study: Study, now: Date): string {
  const file = path.join(exportsDir(study), `study-${historyStamp(now)}.json`);
  const tables = Object.fromEntries(Object.entries(EXPORTED_TABLES).map(([name, table]) => [name, study.db.select().from(table).all()]));
  writeFileSync(file, `${JSON.stringify({ version: 1, exportedAt: now.toISOString(), tables }, null, 2)}\n`, { flag: "wx" });
  return file;
}

/** `pnpm study backup` (spec §12): VACUUM INTO, so the live WAL database is never copied file by file. Returns the file. */
export function backupStudy(study: Study, now: Date): string {
  const file = path.join(exportsDir(study), `study-${historyStamp(now)}.db`);
  study.sqlite.prepare("VACUUM INTO ?").run(file);
  return file;
}
