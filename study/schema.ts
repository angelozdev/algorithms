/**
 * The study store (study coach spec §4): what happens to the user, never content. Content ids ("lc-0242",
 * "hash-map/01", a concept slug) are plain text pointing at files; there are no foreign keys into content
 * (spec §13: progress whose content disappeared is an orphan, listed by `study status`).
 *
 * Normalized to BCNF: every fact has one source, and derived values come from the two views at the end, so no
 * code repeats them. Deliberate exceptions:
 * 1. `cards` is a cache. ts-fsrs 5.4.2 is deterministic, so a card is rebuilt exactly by replaying the item's
 *    rated attempts in ended_at order, shifting time by overlapping pauses (Plan B: `pnpm study rebuild`).
 * 2. `attempts.ended_at` and `attempts.outcome` partly repeat the closing event (the green run, or the give-up).
 *    The one-open-attempt rule needs a column for SQLite's partial unique index, and "is anything open?" is the
 *    hottest query.
 * Not derived, on purpose: `attempts.rating`, the grade FSRS received under the time-box in force at closing.
 *
 * Every instant is integer epoch milliseconds, read back as a Date.
 *
 * Changing this file: run `pnpm exec drizzle-kit generate --name <what-changed>` and commit the new files in
 * study/migrations/. Only `pnpm study init` and `pnpm study migrate` apply them (study/store.ts).
 */
import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  sqliteView,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const LANG_VALUES = ["py", "ts"] as const;
export const PHASES = ["bases", "learn", "master", "expand", "pro"] as const;
export const CURRICULUM_REASONS = ["init", "switch"] as const;
export const PHASE_REASONS = ["criteria", "forced", "switch"] as const;
export const OUTCOMES = ["green", "gave_up"] as const;
export const RATINGS = ["again", "hard", "good", "easy"] as const;
export const EVENT_TYPES = ["edit", "save", "run", "hint"] as const;
export const EVENT_SOURCES = ["playground", "watch", "cli", "skill"] as const;
export const PLAN_MODES = ["normal", "return", "catch_up"] as const;
export const PLAN_SLOTS = ["continue", "review", "new", "concept"] as const;
export const ANNOUNCEMENT_KINDS = ["phase", "switch", "return"] as const;
export const SURFACES = ["chat", "ui"] as const;
export const ITEM_STATUSES = ["todo", "in_progress", "solved", "revealed"] as const;
export const ATTEMPT_KINDS = ["new", "review", "exam"] as const;
/** Gaps between consecutive events longer than this are idle time (spec §4, attempt_stats.active_ms). */
export const ACTIVE_GAP_MS = 5 * 60_000;
/** An attempt's active time is trusted ("measured") with at least this many edit, save or run events. */
export const MEASURED_MIN_EVENTS = 3;

export type Phase = (typeof PHASES)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type Rating = (typeof RATINGS)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EventSource = (typeof EVENT_SOURCES)[number];
export type ItemStatusValue = (typeof ITEM_STATUSES)[number];
export type AttemptKind = (typeof ATTEMPT_KINDS)[number];

const instant = (name: string) => integer(name, { mode: "timestamp_ms" });
/** CHECK (<column> IN ('a', 'b', …)): the database itself rejects values outside the vocabulary. */
const oneOf = (name: string, column: AnySQLiteColumn, values: readonly string[]) =>
  check(name, sql`${column} IN (${sql.raw(values.map((value) => `'${value}'`).join(", "))})`);

/** Settings with no history. One row, id = 1. */
export const profile = sqliteTable(
  "profile",
  {
    id: integer("id").primaryKey(),
    dailyMinutes: integer("daily_minutes").notNull(),
    language: text("language", { enum: LANG_VALUES }).notNull(),
    timezone: text("timezone").notNull(),
    expansionList: text("expansion_list"),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [
    check("profile_single_row", sql`${t.id} = 1`),
    check("profile_daily_minutes", sql`${t.dailyMinutes} > 0`),
    oneOf("profile_language", t.language, LANG_VALUES),
  ],
);

/** The current preset is the last row. */
export const curriculumLog = sqliteTable(
  "curriculum_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: instant("at").notNull(),
    preset: text("preset").notNull(),
    reason: text("reason", { enum: CURRICULUM_REASONS }).notNull(),
  },
  (t) => [oneOf("curriculum_log_reason", t.reason, CURRICULUM_REASONS)],
);

/** The current phase is the last row; "from" is the previous row. */
export const phaseLog = sqliteTable(
  "phase_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: instant("at").notNull(),
    phase: text("phase", { enum: PHASES }).notNull(),
    reason: text("reason", { enum: PHASE_REASONS }).notNull(),
    curriculumLogId: integer("curriculum_log_id").references(() => curriculumLog.id),
  },
  (t) => [oneOf("phase_log_phase", t.phase, PHASES), oneOf("phase_log_reason", t.reason, PHASE_REASONS)],
);

/** When the engine introduced a pattern (per pattern, never per list). "Block done" is derived. */
export const patternIntros = sqliteTable("pattern_intros", {
  pattern: text("pattern").primaryKey(),
  introducedAt: instant("introduced_at").notNull(),
});

/** Set by the `concept` skill. "Learned" also needs every exercise done (derived, study/status.ts). */
export const conceptAcceptances = sqliteTable("concept_acceptances", {
  concept: text("concept").primaryKey(),
  acceptedAt: instant("accepted_at").notNull(),
});

/** "Finished" is derived from its attempts. */
export const exams = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  list: text("list").notNull(),
  seed: integer("seed").notNull(),
  startedAt: instant("started_at").notNull(),
});

/**
 * One try at an item, from the first real work to the first green or a give-up (spec §7). The item's kind
 * comes from its id (exercise ids contain "/", lib/ids.ts). New vs review comes from earlier rated attempts,
 * and exam membership from exam_id (both in attempt_stats).
 */
export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: text("item_id").notNull(),
    examId: integer("exam_id").references(() => exams.id),
    startedAt: instant("started_at").notNull(),
    endedAt: instant("ended_at"),
    outcome: text("outcome", { enum: OUTCOMES }),
    rating: text("rating", { enum: RATINGS }),
  },
  (t) => [
    check("attempts_closed_iff_outcome", sql`(${t.endedAt} IS NULL) = (${t.outcome} IS NULL)`),
    check(
      "attempts_rating_only_on_closed_problems",
      sql`${t.rating} IS NULL OR (${t.endedAt} IS NOT NULL AND instr(${t.itemId}, '/') = 0)`,
    ),
    check("attempts_ends_after_start", sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
    oneOf("attempts_outcome", t.outcome, OUTCOMES),
    oneOf("attempts_rating", t.rating, RATINGS),
    uniqueIndex("attempts_one_open_per_item").on(t.itemId).where(sql`${t.endedAt} IS NULL`),
    index("attempts_by_item").on(t.itemId, t.startedAt),
  ],
);

/** The single source for hints, active time, `measured` and language. */
export const attemptEvents = sqliteTable(
  "attempt_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => attempts.id),
    at: instant("at").notNull(),
    type: text("type", { enum: EVENT_TYPES }).notNull(),
    lang: text("lang", { enum: LANG_VALUES }),
    runGreen: integer("run_green", { mode: "boolean" }),
    source: text("source", { enum: EVENT_SOURCES }).notNull(),
  },
  (t) => [
    check("attempt_events_run_iff_verdict", sql`(${t.type} = 'run') = (${t.runGreen} IS NOT NULL)`),
    check("attempt_events_hint_iff_no_lang", sql`(${t.type} = 'hint') = (${t.lang} IS NULL)`),
    oneOf("attempt_events_type", t.type, EVENT_TYPES),
    oneOf("attempt_events_lang", t.lang, LANG_VALUES),
    oneOf("attempt_events_source", t.source, EVENT_SOURCES),
    index("attempt_events_by_attempt").on(t.attemptId, t.at),
  ],
);

/** Written by the `review` skill (`pnpm -s study record complexity`). */
export const complexityNotes = sqliteTable("complexity_notes", {
  attemptId: integer("attempt_id")
    .primaryKey()
    .references(() => attempts.id),
  time: text("time").notNull(),
  space: text("space").notNull(),
  optimal: integer("optimal", { mode: "boolean" }).notNull(),
});

export const pauses = sqliteTable(
  "pauses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    startedAt: instant("started_at").notNull(),
    endedAt: instant("ended_at"),
  },
  (t) => [
    check("pauses_ends_after_start", sql`${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`),
    uniqueIndex("pauses_one_open").on(sql`(1)`).where(sql`${t.endedAt} IS NULL`),
  ],
);

/** Stored so the plan is stable within a local day (spec §6.2). */
export const dailyPlans = sqliteTable(
  "daily_plans",
  {
    localDate: text("local_date").primaryKey(),
    mode: text("mode", { enum: PLAN_MODES }).notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (t) => [
    oneOf("daily_plans_mode", t.mode, PLAN_MODES),
    check("daily_plans_local_date", sql`${t.localDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ],
);

/** Title and minutes come from content and the curriculum, never stored. A `concept` slot's item_id is a slug. */
export const planItems = sqliteTable(
  "plan_items",
  {
    localDate: text("local_date")
      .notNull()
      .references(() => dailyPlans.localDate),
    position: integer("position").notNull(),
    itemId: text("item_id").notNull(),
    slot: text("slot", { enum: PLAN_SLOTS }).notNull(),
    pattern: text("pattern"),
    blockIndex: integer("block_index"),
  },
  (t) => [primaryKey({ columns: [t.localDate, t.position] }), oneOf("plan_items_slot", t.slot, PLAN_SLOTS)],
);

/** The message is rendered from the referenced row: phase → phase_log; switch → curriculum_log and phase_log; return → a local date. */
export const announcements = sqliteTable(
  "announcements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    at: instant("at").notNull(),
    kind: text("kind", { enum: ANNOUNCEMENT_KINDS }).notNull(),
    phaseLogId: integer("phase_log_id").references(() => phaseLog.id),
    curriculumLogId: integer("curriculum_log_id").references(() => curriculumLog.id),
    localDate: text("local_date"),
  },
  (t) => [
    oneOf("announcements_kind", t.kind, ANNOUNCEMENT_KINDS),
    check(
      "announcements_reference_matches_kind",
      sql`CASE ${t.kind}
        WHEN 'phase' THEN ${t.phaseLogId} IS NOT NULL AND ${t.curriculumLogId} IS NULL AND ${t.localDate} IS NULL
        WHEN 'switch' THEN ${t.phaseLogId} IS NOT NULL AND ${t.curriculumLogId} IS NOT NULL AND ${t.localDate} IS NULL
        WHEN 'return' THEN ${t.phaseLogId} IS NULL AND ${t.curriculumLogId} IS NULL AND ${t.localDate} IS NOT NULL
        ELSE 0
      END`,
    ),
  ],
);

/** One row per surface (chat, ui) that showed the announcement. */
export const announcementAcks = sqliteTable(
  "announcement_acks",
  {
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id),
    surface: text("surface", { enum: SURFACES }).notNull(),
    at: instant("at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.surface] }), oneOf("announcement_acks_surface", t.surface, SURFACES)],
);

/** Deliberate exception 1: a cache of ts-fsrs Card fields per problem (state: 0 New, 1 Learning, 2 Review, 3 Relearning). Plan B fills it. */
export const cards = sqliteTable(
  "cards",
  {
    itemId: text("item_id").primaryKey(),
    due: instant("due").notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    learningSteps: integer("learning_steps").notNull(),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    state: integer("state").notNull(),
    lastReview: instant("last_review"),
  },
  (t) => [check("cards_state", sql`${t.state} BETWEEN 0 AND 3`), check("cards_problems_only", sql`instr(${t.itemId}, '/') = 0`)],
);

/**
 * Per attempt (spec §4): kind (new, review after an earlier rated attempt, exam), hints, active_ms (gaps of at
 * most ACTIVE_GAP_MS between consecutive events), measured (at least MEASURED_MIN_EVENTS edit/save/run events),
 * and the language of the last run.
 */
export const attemptStats = sqliteView("attempt_stats", {
  attemptId: integer("attempt_id").notNull(),
  itemId: text("item_id").notNull(),
  kind: text("kind", { enum: ATTEMPT_KINDS }).notNull(),
  hints: integer("hints").notNull(),
  activeMs: integer("active_ms").notNull(),
  measured: integer("measured", { mode: "boolean" }).notNull(),
  lang: text("lang", { enum: LANG_VALUES }),
}).as(sql`
SELECT
  a.id AS attempt_id,
  a.item_id AS item_id,
  CASE
    WHEN a.exam_id IS NOT NULL THEN 'exam'
    WHEN EXISTS (
      SELECT 1 FROM attempts p
      WHERE p.item_id = a.item_id AND p.id <> a.id AND p.rating IS NOT NULL AND p.ended_at <= a.started_at
    ) THEN 'review'
    ELSE 'new'
  END AS kind,
  count(CASE WHEN g.type = 'hint' THEN 1 END) AS hints,
  coalesce(sum(CASE WHEN g.gap <= ${sql.raw(String(ACTIVE_GAP_MS))} THEN g.gap END), 0) AS active_ms,
  count(CASE WHEN g.type IN ('edit', 'save', 'run') THEN 1 END) >= ${sql.raw(String(MEASURED_MIN_EVENTS))} AS measured,
  (
    SELECT e.lang FROM attempt_events e
    WHERE e.attempt_id = a.id AND e.type = 'run'
    ORDER BY e.at DESC, e.id DESC LIMIT 1
  ) AS lang
FROM attempts a
LEFT JOIN (
  SELECT attempt_id, type, at - lag(at) OVER (PARTITION BY attempt_id ORDER BY at, id) AS gap
  FROM attempt_events
) g ON g.attempt_id = a.id
GROUP BY a.id
`);

/**
 * Per item with attempts (spec §4): in_progress when one is open, else solved when one ended green, else
 * revealed when one ended gave_up. Items with no attempts are absent: read them as todo.
 */
export const itemStatusView = sqliteView("item_status", {
  itemId: text("item_id").notNull(),
  status: text("status", { enum: ITEM_STATUSES }).notNull(),
  everGreen: integer("ever_green", { mode: "boolean" }).notNull(),
  everGaveUp: integer("ever_gave_up", { mode: "boolean" }).notNull(),
  lastOutcome: text("last_outcome", { enum: OUTCOMES }),
}).as(sql`
SELECT
  a.item_id AS item_id,
  CASE
    WHEN max(a.ended_at IS NULL) = 1 THEN 'in_progress'
    WHEN max(a.outcome = 'green') = 1 THEN 'solved'
    WHEN max(a.outcome = 'gave_up') = 1 THEN 'revealed'
    ELSE 'todo'
  END AS status,
  coalesce(max(a.outcome = 'green'), 0) AS ever_green,
  coalesce(max(a.outcome = 'gave_up'), 0) AS ever_gave_up,
  (
    SELECT c.outcome FROM attempts c
    WHERE c.item_id = a.item_id AND c.ended_at IS NOT NULL
    ORDER BY c.ended_at DESC, c.id DESC LIMIT 1
  ) AS last_outcome
FROM attempts a
GROUP BY a.item_id
`);
