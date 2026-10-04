CREATE TABLE `announcement_acks` (
	`announcement_id` integer NOT NULL,
	`surface` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`announcement_id`, `surface`),
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "announcement_acks_surface" CHECK("announcement_acks"."surface" IN ('chat', 'ui'))
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`kind` text NOT NULL,
	`phase_log_id` integer,
	`curriculum_log_id` integer,
	`local_date` text,
	FOREIGN KEY (`phase_log_id`) REFERENCES `phase_log`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`curriculum_log_id`) REFERENCES `curriculum_log`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "announcements_kind" CHECK("announcements"."kind" IN ('phase', 'switch', 'return')),
	CONSTRAINT "announcements_reference_matches_kind" CHECK(CASE "announcements"."kind"
        WHEN 'phase' THEN "announcements"."phase_log_id" IS NOT NULL AND "announcements"."curriculum_log_id" IS NULL AND "announcements"."local_date" IS NULL
        WHEN 'switch' THEN "announcements"."phase_log_id" IS NOT NULL AND "announcements"."curriculum_log_id" IS NOT NULL AND "announcements"."local_date" IS NULL
        WHEN 'return' THEN "announcements"."phase_log_id" IS NULL AND "announcements"."curriculum_log_id" IS NULL AND "announcements"."local_date" IS NOT NULL
        ELSE 0
      END)
);
--> statement-breakpoint
CREATE TABLE `attempt_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`at` integer NOT NULL,
	`type` text NOT NULL,
	`lang` text,
	`run_green` integer,
	`source` text NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attempt_events_run_iff_verdict" CHECK(("attempt_events"."type" = 'run') = ("attempt_events"."run_green" IS NOT NULL)),
	CONSTRAINT "attempt_events_hint_iff_no_lang" CHECK(("attempt_events"."type" = 'hint') = ("attempt_events"."lang" IS NULL)),
	CONSTRAINT "attempt_events_type" CHECK("attempt_events"."type" IN ('edit', 'save', 'run', 'hint')),
	CONSTRAINT "attempt_events_lang" CHECK("attempt_events"."lang" IN ('py', 'ts')),
	CONSTRAINT "attempt_events_source" CHECK("attempt_events"."source" IN ('playground', 'watch', 'cli', 'skill'))
);
--> statement-breakpoint
CREATE INDEX `attempt_events_by_attempt` ON `attempt_events` (`attempt_id`,`at`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`exam_id` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`outcome` text,
	`rating` text,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attempts_closed_iff_outcome" CHECK(("attempts"."ended_at" IS NULL) = ("attempts"."outcome" IS NULL)),
	CONSTRAINT "attempts_rating_only_on_closed_problems" CHECK("attempts"."rating" IS NULL OR ("attempts"."ended_at" IS NOT NULL AND instr("attempts"."item_id", '/') = 0)),
	CONSTRAINT "attempts_ends_after_start" CHECK("attempts"."ended_at" IS NULL OR "attempts"."ended_at" >= "attempts"."started_at"),
	CONSTRAINT "attempts_outcome" CHECK("attempts"."outcome" IN ('green', 'gave_up')),
	CONSTRAINT "attempts_rating" CHECK("attempts"."rating" IN ('again', 'hard', 'good', 'easy'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_one_open_per_item` ON `attempts` (`item_id`) WHERE "attempts"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `attempts_by_item` ON `attempts` (`item_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `cards` (
	`item_id` text PRIMARY KEY NOT NULL,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`scheduled_days` integer NOT NULL,
	`learning_steps` integer NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`state` integer NOT NULL,
	`last_review` integer,
	CONSTRAINT "cards_state" CHECK("cards"."state" BETWEEN 0 AND 3),
	CONSTRAINT "cards_problems_only" CHECK(instr("cards"."item_id", '/') = 0)
);
--> statement-breakpoint
CREATE TABLE `complexity_notes` (
	`attempt_id` integer PRIMARY KEY NOT NULL,
	`time` text NOT NULL,
	`space` text NOT NULL,
	`optimal` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `concept_acceptances` (
	`concept` text PRIMARY KEY NOT NULL,
	`accepted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `curriculum_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`preset` text NOT NULL,
	`reason` text NOT NULL,
	CONSTRAINT "curriculum_log_reason" CHECK("curriculum_log"."reason" IN ('init', 'switch'))
);
--> statement-breakpoint
CREATE TABLE `daily_plans` (
	`local_date` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "daily_plans_mode" CHECK("daily_plans"."mode" IN ('normal', 'return', 'catch_up')),
	CONSTRAINT "daily_plans_local_date" CHECK("daily_plans"."local_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list` text NOT NULL,
	`seed` integer NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pattern_intros` (
	`pattern` text PRIMARY KEY NOT NULL,
	`introduced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pauses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	CONSTRAINT "pauses_ends_after_start" CHECK("pauses"."ended_at" IS NULL OR "pauses"."ended_at" >= "pauses"."started_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pauses_one_open` ON `pauses` ((1)) WHERE "pauses"."ended_at" IS NULL;--> statement-breakpoint
CREATE TABLE `phase_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`phase` text NOT NULL,
	`reason` text NOT NULL,
	`curriculum_log_id` integer,
	FOREIGN KEY (`curriculum_log_id`) REFERENCES `curriculum_log`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "phase_log_phase" CHECK("phase_log"."phase" IN ('bases', 'learn', 'master', 'expand', 'pro')),
	CONSTRAINT "phase_log_reason" CHECK("phase_log"."reason" IN ('criteria', 'forced', 'switch'))
);
--> statement-breakpoint
CREATE TABLE `plan_items` (
	`local_date` text NOT NULL,
	`position` integer NOT NULL,
	`item_id` text NOT NULL,
	`slot` text NOT NULL,
	`pattern` text,
	`block_index` integer,
	PRIMARY KEY(`local_date`, `position`),
	FOREIGN KEY (`local_date`) REFERENCES `daily_plans`(`local_date`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "plan_items_slot" CHECK("plan_items"."slot" IN ('continue', 'review', 'new', 'concept'))
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`daily_minutes` integer NOT NULL,
	`language` text NOT NULL,
	`timezone` text NOT NULL,
	`expansion_list` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "profile_single_row" CHECK("profile"."id" = 1),
	CONSTRAINT "profile_daily_minutes" CHECK("profile"."daily_minutes" > 0),
	CONSTRAINT "profile_language" CHECK("profile"."language" IN ('py', 'ts'))
);
--> statement-breakpoint
CREATE VIEW `attempt_stats` AS 
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
  coalesce(sum(CASE WHEN g.gap <= 300000 THEN g.gap END), 0) AS active_ms,
  count(CASE WHEN g.type IN ('edit', 'save', 'run') THEN 1 END) >= 3 AS measured,
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
;--> statement-breakpoint
CREATE VIEW `item_status` AS 
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
;