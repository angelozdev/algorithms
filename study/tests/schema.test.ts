import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "../schema.ts";

const MIGRATIONS = fileURLToPath(new URL("../migrations", import.meta.url));
const T0 = Date.parse("2026-10-04T10:00:00.000Z");
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

/** A migrated in-memory database (the store module comes in the next task). */
function freshDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

describe("study schema: constraints", () => {
  it("allows one open attempt per item", () => {
    const db = freshDb();
    db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(0) }).run();
    db.insert(schema.attempts).values({ itemId: "lc-0020", startedAt: at(0) }).run();
    expect(() => db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(1) }).run()).toThrow(/UNIQUE constraint failed/);
    db.update(schema.attempts).set({ endedAt: at(2), outcome: "green" }).where(eq(schema.attempts.itemId, "lc-0001")).run();
    expect(() => db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(3) }).run()).not.toThrow();
  });

  it("closes an attempt exactly when it gets an outcome, and never before it started", () => {
    const db = freshDb();
    expect(() => db.insert(schema.attempts).values({ itemId: "a", startedAt: at(0), endedAt: at(1) }).run()).toThrow(/attempts_closed_iff_outcome/);
    expect(() => db.insert(schema.attempts).values({ itemId: "b", startedAt: at(0), outcome: "green" }).run()).toThrow(/attempts_closed_iff_outcome/);
    expect(() => db.insert(schema.attempts).values({ itemId: "c", startedAt: at(5), endedAt: at(1), outcome: "green" }).run()).toThrow(
      /attempts_ends_after_start/,
    );
  });

  it("puts a rating only on closed problem attempts", () => {
    const db = freshDb();
    expect(() => db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(0), rating: "good" }).run()).toThrow(
      /attempts_rating_only_on_closed_problems/,
    );
    expect(() =>
      db.insert(schema.attempts).values({ itemId: "hash-map/01", startedAt: at(0), endedAt: at(1), outcome: "green", rating: "good" }).run(),
    ).toThrow(/attempts_rating_only_on_closed_problems/);
    expect(() =>
      db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(0), endedAt: at(1), outcome: "green", rating: "good" }).run(),
    ).not.toThrow();
  });

  it("gives a run, and only a run, a verdict; a hint, and only a hint, has no language", () => {
    const db = freshDb();
    const attemptId = db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(0) }).returning().get().id;
    const event = (values: Partial<typeof schema.attemptEvents.$inferInsert>) => () =>
      db.insert(schema.attemptEvents).values({ attemptId, at: at(0), type: "edit", lang: "py", source: "cli", ...values }).run();
    expect(event({ type: "run", runGreen: null })).toThrow(/attempt_events_run_iff_verdict/);
    expect(event({ type: "edit", runGreen: true })).toThrow(/attempt_events_run_iff_verdict/);
    expect(event({ type: "hint", lang: "py", source: "skill" })).toThrow(/attempt_events_hint_iff_no_lang/);
    expect(event({ type: "save", lang: null })).toThrow(/attempt_events_hint_iff_no_lang/);
    expect(event({ type: "run", runGreen: false })).not.toThrow();
    expect(event({ type: "hint", lang: null, source: "skill" })).not.toThrow();
    expect(event({ attemptId: 999 })).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("keeps at most one open pause", () => {
    const db = freshDb();
    db.insert(schema.pauses).values({ startedAt: at(0) }).run();
    expect(() => db.insert(schema.pauses).values({ startedAt: at(1) }).run()).toThrow(/pauses_one_open/);
    db.update(schema.pauses).set({ endedAt: at(2) }).run();
    expect(() => db.insert(schema.pauses).values({ startedAt: at(3) }).run()).not.toThrow();
  });

  it("makes each announcement reference exactly what its kind needs", () => {
    const db = freshDb();
    const curriculum = db.insert(schema.curriculumLog).values({ at: at(0), preset: "grind-75", reason: "init" }).returning().get();
    const phase = db.insert(schema.phaseLog).values({ at: at(0), phase: "bases", reason: "criteria" }).returning().get();
    const announce = (values: Partial<typeof schema.announcements.$inferInsert>) => () =>
      db.insert(schema.announcements).values({ at: at(0), kind: "phase", ...values }).run();
    expect(announce({ kind: "phase", phaseLogId: phase.id })).not.toThrow();
    expect(announce({ kind: "phase" })).toThrow(/announcements_reference_matches_kind/);
    expect(announce({ kind: "switch", phaseLogId: phase.id, curriculumLogId: curriculum.id })).not.toThrow();
    expect(announce({ kind: "switch", phaseLogId: phase.id })).toThrow(/announcements_reference_matches_kind/);
    expect(announce({ kind: "return", localDate: "2026-10-04" })).not.toThrow();
    expect(announce({ kind: "return", localDate: "2026-10-04", phaseLogId: phase.id })).toThrow(/announcements_reference_matches_kind/);
  });

  it("checks enum vocabularies, the single profile row, plan dates and problem-only cards", () => {
    const db = freshDb();
    const now = at(0);
    db.insert(schema.profile).values({ id: 1, dailyMinutes: 45, language: "py", timezone: "UTC", createdAt: now }).run();
    expect(() => db.insert(schema.profile).values({ id: 2, dailyMinutes: 45, language: "py", timezone: "UTC", createdAt: now }).run()).toThrow(
      /profile_single_row/,
    );
    expect(() => db.$client.prepare("INSERT INTO phase_log (at, phase, reason) VALUES (1, 'zen', 'criteria')").run()).toThrow(/phase_log_phase/);
    expect(() => db.insert(schema.dailyPlans).values({ localDate: "2026-10-4", mode: "normal", createdAt: now }).run()).toThrow(
      /daily_plans_local_date/,
    );
    expect(() => db.insert(schema.planItems).values({ localDate: "2026-10-04", position: 0, itemId: "lc-0001", slot: "new" }).run()).toThrow(
      /FOREIGN KEY constraint failed/,
    );
    const card = { due: now, stability: 1, difficulty: 5, scheduledDays: 1, learningSteps: 0, reps: 1, lapses: 0, state: 2 };
    expect(() => db.insert(schema.cards).values({ itemId: "hash-map/01", ...card }).run()).toThrow(/cards_problems_only/);
    expect(() => db.insert(schema.cards).values({ itemId: "lc-0001", ...card }).run()).not.toThrow();
  });
});

describe("study schema: views", () => {
  it("attempt_stats counts hints, sums gaps of at most 5 minutes, needs 3 edit/save/run events to be measured, and keeps the last run's language", () => {
    const db = freshDb();
    const id = db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(0) }).returning().get().id;
    const add = (minute: number, type: schema.EventType, lang: "py" | "ts" | null = "py", runGreen: boolean | null = null) =>
      db.insert(schema.attemptEvents).values({ attemptId: id, at: at(minute), type, lang, runGreen, source: "cli" }).run();
    add(0, "edit");
    add(2, "save"); // gap 2
    add(10, "run", "py", false); // gap 8: idle, not counted
    add(11, "hint", null); // gap 1
    add(12, "run", "ts", true); // gap 1
    expect(db.select().from(schema.attemptStats).all()).toEqual([
      { attemptId: id, itemId: "lc-0001", kind: "new", hints: 1, activeMs: 4 * 60_000, measured: true, lang: "ts" },
    ]);
    const lone = db.insert(schema.attempts).values({ itemId: "lc-0002", startedAt: at(0) }).returning().get().id;
    db.insert(schema.attemptEvents).values({ attemptId: lone, at: at(0), type: "edit", lang: "py", source: "watch" }).run();
    expect(db.select().from(schema.attemptStats).where(eq(schema.attemptStats.attemptId, lone)).get()).toEqual({
      attemptId: lone,
      itemId: "lc-0002",
      kind: "new",
      hints: 0,
      activeMs: 0,
      measured: false,
      lang: null,
    });
  });

  it("attempt_stats calls an attempt a review after an earlier rated attempt, and an exam when it belongs to one", () => {
    const db = freshDb();
    db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(0), endedAt: at(10), outcome: "green", rating: "good" }).run();
    const review = db.insert(schema.attempts).values({ itemId: "lc-0001", startedAt: at(100) }).returning().get().id;
    const exam = db.insert(schema.exams).values({ list: "grind-75", seed: 7, startedAt: at(0) }).returning().get().id;
    const inExam = db.insert(schema.attempts).values({ itemId: "lc-0020", examId: exam, startedAt: at(0) }).returning().get().id;
    const kinds = Object.fromEntries(db.select().from(schema.attemptStats).all().map((row) => [row.attemptId, row.kind]));
    expect(kinds[review]).toBe("review");
    expect(kinds[inExam]).toBe("exam");
  });

  it("item_status puts in progress before solved before revealed, and keeps ever-green, ever-gave-up and the last outcome", () => {
    const db = freshDb();
    db.insert(schema.attempts).values({ itemId: "solved-then-open", startedAt: at(0), endedAt: at(1), outcome: "green" }).run();
    db.insert(schema.attempts).values({ itemId: "solved-then-open", startedAt: at(2) }).run();
    db.insert(schema.attempts).values({ itemId: "revealed", startedAt: at(0), endedAt: at(1), outcome: "gave_up" }).run();
    db.insert(schema.attempts).values({ itemId: "gave-up-then-green", startedAt: at(0), endedAt: at(1), outcome: "gave_up" }).run();
    db.insert(schema.attempts).values({ itemId: "gave-up-then-green", startedAt: at(2), endedAt: at(3), outcome: "green" }).run();
    const rows = Object.fromEntries(db.select().from(schema.itemStatusView).all().map((row) => [row.itemId, row]));
    expect(rows["solved-then-open"]).toEqual({ itemId: "solved-then-open", status: "in_progress", everGreen: true, everGaveUp: false, lastOutcome: "green" });
    expect(rows.revealed).toEqual({ itemId: "revealed", status: "revealed", everGreen: false, everGaveUp: true, lastOutcome: "gave_up" });
    expect(rows["gave-up-then-green"]).toEqual({ itemId: "gave-up-then-green", status: "solved", everGreen: true, everGaveUp: true, lastOutcome: "green" });
  });
});
