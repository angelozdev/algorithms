# Study coach (part 1): design

**Status:** approved in conversation on 2026-10-04 (sections 1–3 explicitly; the whole design through plan approval). Pending: the user's review of this written spec.
**Prerequisite:** the Grind 75 import (`docs/superpowers/plans/2026-10-04-grind-75.md`) has finished.

## 1. Goal

A coach that walks the user from zero to an expert level with a science-based system. The user asks "¿qué me toca hoy?" (in chat, or on the playground home) and gets:
- the reviews that are due;
- the next new item;
- an announcement when they change phase.

It runs locally and single-user for now. The design lets other people clone the repo and start clean.

**The system** comes from a research report: `~/me/reports/Cómo estudiar algoritmos según la ciencia.md`.

| Phase | Content |
|---|---|
| 0 · Bases | Big-O, recursion and language essentials |
| 1 · Learn a list | Per pattern: concept, then 3 problems in a block, then mixed practice |
| 2 · Master the list | Exam mode |
| 3 · Expand | A second list |
| 4 · Pro | Interview or competitive track |

Spaced re-solving from scratch with FSRS runs underneath every phase.

**Part 1 of three sub-projects:**
1. This core coach, with the Today section and conversation.
2. The visible timer and "which pattern?" prediction.
3. Multi-user packaging.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | Personal progress is **separate from content**. It lives in a git-ignored `.study/`; README files become pure content. |
| D2 | Progress is stored in `.study/study.db` (SQLite) with **Drizzle ORM** and **better-sqlite3**. Built-in `node:sqlite` is still experimental in Node 24.14, and Drizzle has no driver for it. |
| D3 | Solutions live in `.study/solutions/…`, with `history/` for archived versions. |
| D4 | Phase 1 is ordered **by pattern** (concept → 3-problem block → mixed). The order is data in a curriculum file. |
| D5 | **Start from zero.** Existing progress is not imported. The old frontmatter and `## Log` lines stay in git history, and old solutions are archived under `history/` as `*-legacy.*`. "My explanation" texts move to `.study/explanations/` as current text, not history. |
| D6 | Phase 0 is lean: 5 cross-cutting concepts. Data structures arrive just in time with their pattern. |
| D7 | The 5 phase-0 concept notes are written and reviewed as part of this work. Phase-1 concepts are created on demand by the `concept` skill. |
| D8 | The coach lives in conversation (a new `coach` skill) **and** in a Today section on the playground home. |
| D9 | A deterministic engine in code (`study/`); agents and the playground are thin clients. |
| D10 | Spaced repetition uses **FSRS via `ts-fsrs` 5.4.2**, pinned exactly (6.0 is in beta). |
| D11 | Problems and concepts **stay as versioned files**, never in the DB. Progress rows reference content ids, and the engine joins them in memory through `lib/repo.ts`. |
| D12 | Curricula are **presets**: `grind-75` (default), `grind-169` and `neetcode-150`. The user can switch at any time. |
| D13 | Switching lists **recalculates the phase**, which may move back by the user's choice. "No regression" applies only to absences. |
| D14 | Everything is unified in the **main checkout** (`/Users/angelozdev/me/algorithms`) before migrating, and the `playground` worktree is retired (milestone M0). |

## 3. Layout

```
repo (public, pure content)                 .study/  (personal, git-ignored; path = $ALGO_STUDY or <content root>/.study)
problems/<id>/README.md, cases.json, stress.ts    study.db (+ -wal, -shm)
concepts/<slug>/README.md, exercises/<NN>-<slug>/ state.json                 snapshot for hooks and watchers
curriculum/<preset>.yaml                          tsconfig.json              generated: extends ../tsconfig.json, for VS Code
study/  (engine)                                  solutions/problems/<id>/solution.{ts,py}
                                                  solutions/problems/<id>/history/<iso-timestamp>[-legacy].{ts,py}
                                                  solutions/exercises/<concept>/<NN>/solution.{ts,py} (+ history/)
                                                  explanations/<concept>.md
                                                  exports/
```

- `studyRoot()` lives in `runner/src/paths.ts`: `$ALGO_STUDY`, falling back to `contentRoot()/.study`. Tests point it under their `ALGO_ROOT`.
- `solutionPath(target, lang)` replaces `solutionPath(dir, lang)`. It takes the `Target` (`lib/ids.ts` / `runner/src/types.ts`) and maps `kind` + `id` to the paths above. Callers: `runner/src/run.ts`, `runner/src/cli.ts`, `runner/src/watcher.ts`, `playground/server/solutions.ts`, `playground/server/targets.ts`.
- TS solutions keep `import … from "lc"`. tsx applies the root `paths` to importers outside `node_modules`, dot-folders included, through `TSX_TSCONFIG_PATH`. `.study/tsconfig.json` exists only for VS Code. The root `tsc` no longer type-checks user solutions, which is wanted.
- `.gitignore` gains `.study/`, `problems/**/solution.*` and `concepts/**/solution.*`. `check` rejects solution files inside content folders.

## 4. Data model (Drizzle, SQLite) — normalized to BCNF

The database stores only what happens to the user. Content ids (`lc-0242`, `hash-map/01`) are plain text that references files. There are no foreign keys into content (see §13, orphans). Every fact has exactly one source. Derived values come from SQL views. There are two deliberate exceptions, listed at the end of this section.

| Table | Key | Columns | Notes |
|---|---|---|---|
| `profile` | `id = 1` | `daily_minutes`, `language`, `timezone`, `expansion_list?`, `created_at` | Settings with no history |
| `curriculum_log` | `id` | `at`, `preset`, `reason` (init, switch) | The current preset is the last row |
| `phase_log` | `id` | `at`, `phase`, `reason` (criteria, forced, switch), `curriculum_log_id?` | The current phase is the last row. No `from`: it is the previous row |
| `pattern_intros` | `pattern` | `introduced_at` | A decision of the engine. Per pattern, never per list. "Block done" is derived |
| `concept_acceptances` | `concept` | `accepted_at` | Set by the `concept` skill. "Learned" also needs every exercise green with no give-up (derived) |
| `exams` | `id` | `list`, `seed`, `started_at` | "Finished" is derived from its attempts |
| `attempts` | `id` | `item_id`, `exam_id?` → exams, `started_at`, `ended_at?`, `outcome?` (green, gave_up), `rating?` (again, hard, good, easy) | `CHECK ((ended_at IS NULL) = (outcome IS NULL))`. Partial unique index on `item_id WHERE ended_at IS NULL`. `rating` only on closed problem attempts (null for exercises). Item kind comes from the id format (`lib/ids.ts`). New vs review is derived from earlier rated attempts; exam membership from `exam_id` |
| `attempt_events` | `id` | `attempt_id` → attempts, `at`, `type` (edit, save, run, hint), `lang?`, `run_green?`, `source` (playground, watch, cli, skill) | `CHECK ((type = 'run') = (run_green IS NOT NULL))`. The single source for hints, active time, `measured` and language |
| `complexity_notes` | `attempt_id` → attempts | `time`, `space`, `optimal` | Written by the `review` skill |
| `pauses` | `id` | `started_at`, `ended_at?` | Unique index on `(1) WHERE ended_at IS NULL` (one open pause) |
| `daily_plans` | `local_date` | `mode` (normal, return, catch_up), `created_at` | Stored so the plan is stable within a day |
| `plan_items` | (`local_date`, `position`) | `item_id`, `slot` (continue, review, new, concept), `pattern?`, `block_index?` | Title and minutes come from content and the curriculum, not stored |
| `announcements` | `id` | `at`, `kind` (phase, switch, return), `phase_log_id?`, `curriculum_log_id?`, `local_date?` | `CHECK`: exactly the reference that matches `kind`. The message is rendered from the referenced row |
| `announcement_acks` | (`announcement_id`, `surface`) | `at`; `surface` is chat or ui | One row per surface that showed it |

**Views** (Drizzle `sqliteView`), so no code repeats the derivations:
- `attempt_stats`, per attempt:
  - `hints` is the count of hint events;
  - `active_ms` sums the gaps between consecutive events of at most 5 minutes;
  - `measured` means at least 3 edit, save or run events;
  - `lang` is the language of the last run.
- `item_status`, per item:
  - `in_progress` when an attempt is open;
  - `solved` when an attempt ended green;
  - `revealed` when an attempt ended gave_up and none ended green;
  - otherwise `todo`.

**Deliberate exceptions, documented in the schema file:**
1. **`cards` is a cache.** Columns: `item_id` primary key, `due`, `stability`, `difficulty`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review`.
   - FSRS in `ts-fsrs` 5.4.2 is deterministic: fuzz is seeded from the review time, reps, and difficulty × stability (`DefaultInitSeedStrategy`). So every card is rebuilt exactly by replaying the item's rated attempts in `ended_at` order, shifting time by overlapping `pauses`.
   - `pnpm study rebuild` regenerates the table, and a test asserts that cache equals replay after every scenario.
   - Changing the FSRS parameters later means a rebuild, with no history lost.
2. **`attempts.ended_at` and `outcome` partly repeat the closing event** (the green run, or the give-up recorded by the `give-up` skill). They are kept because the one-open-attempt rule needs a column for SQLite's partial unique index, and because "is anything open?" is the hottest query.

**Not derived, on purpose:** `attempts.rating`. It depends on the time-box in force when the attempt closed, and the curriculum may change later. It is a historical fact: the grade FSRS received.

**`.study/state.json`** is a snapshot file, not a table. After every write the engine rewrites it (atomic rename) with the phase, the items in progress, the counts for today and a `version`. `reminder.mjs` and the playground watcher read it, so neither needs SQLite.

## 5. Curriculum presets

`curriculum/<preset>.yaml`, validated with zod:

```yaml
id: grind-75
phases:
  bases:  { concepts: [big-o, recursion, arrays-and-strings, maps-and-sets, sorting] }
  learn:  { list: grind-75, block: 3, mix_after_block: 3 }
  master: { list: grind-75, first_try_success: 0.8 }
  expand: { choose_from: [grind-169, neetcode-150], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }
  pro:    { tracks: [interview, competitive] }
patterns:            # order and the concept that opens each pattern
  - { pattern: arrays-hashing, concept: hash-map }
  - { pattern: two-pointers,   concept: two-pointers }
  # …
timebox_minutes: { easy: 15, medium: 35, hard: 50 }
```

- **List membership has one source:** the frontmatter `lists` field. The YAML names a list only by its id.
- **"Every problem of the list"** means the problems in the repo tagged with it that load as runnable targets. `today` reports a partially imported list instead of failing.
- **A pattern missing from `patterns`** goes after the listed ones, and `check` warns.

## 6. Engine

### 6.1 Phase criteria

| Phase | Exits when |
|---|---|
| 0 | Every base concept is learned: explanation accepted, plus every exercise green with no give-up |
| 1 | Every list problem has a green attempt and **2 successful reviews** (Good or Easy) |
| 2 | One exam pass (seeded random order, no hints, time-boxed) with **≥ 80% first-try success**, and every failure re-solved later. Exam attempts update FSRS cards like reviews. |
| 3 | Over the last 20 unseen Mediums of the expansion list, **≥ 65% solved alone within 35 minutes** |
| 4 | No exit |

- Criteria are evaluated after every recorded attempt and on every `today`.
- A transition appends to `phase_log` and creates an announcement that references that row.
- `today` returns the announcements with no ack for the asking surface. Chat and the UI each write their own row in `announcement_acks`.
- **At the 2 → 3 transition** the coach asks which list to expand with (`grind-169` or `neetcode-150`) and stores the answer in `profile.expansion_list`.
- If that list is not imported, the coach offers the import, and `today` keeps serving reviews until it is in.

### 6.2 Daily plan

Computed once per local day, stored in `daily_plans` and `plan_items`, and refreshed only by an explicit `pnpm today --refresh`.

The budget is `profile.daily_minutes` (the coach asks on first use; default 45). Estimates are the time-box for new items and 0.6 × the time-box for reviews.

1. **Continue:** the open attempt, if any.
2. **Reviews:** due cards, most overdue first, until about 60% of the budget. If a card is due, at least one review is planned.
3. **New:** at least one new item every day unless it is a catch-up day (see 6.4). One item is always allowed even when its estimate exceeds the budget.
4. **New-item cycle in phase 1:**
   - introduce the next pattern: its concept, if not learned, then 3 problems of that pattern, easy to hard;
   - then `mix_after_block` (3) items drawn at random, seeded by local date, from unattempted problems of already introduced patterns;
   - then the next pattern.

   Once every pattern is introduced, every new item comes from the mix. A problem's pattern is the first entry of its frontmatter `patterns`.

### 6.3 FSRS

```ts
fsrs(generatorParameters({ request_retention: 0.85, maximum_interval: 180, enable_fuzz: true, enable_short_term: false }))
```

**Rating:**

| Outcome | Rating |
|---|---|
| Gave up | Again |
| Hints used, or alone over the time-box | Hard |
| Alone, within the time-box | Good |
| Alone, in under half the time-box, **and `measured`** | Easy |

When active time could not be measured (`measured` is false in `attempt_stats`), the best rating is Good.

- A card is created when a problem's first attempt finishes.
- **The day boundary** is local midnight in `profile.timezone`. Tests fix the time zone and inject the clock.

### 6.4 Returns, backlog and pause

- **Return mode** after 7 or more days with no activity:
  - a welcome announcement;
  - the first reviews of the day are the due cards with the highest retrievability (`get_retrievability`), for a quick win.
- **Spreading the backlog:** due cards beyond about 14 days of review capacity are spread across the coming days. Only the plan is spread; card data is unchanged.
- **Catch-up day:** when more than 3 days of capacity are overdue, new items drop to one every other day, never to zero.
- **Absence never lowers a phase.**
- **Pause:** `pnpm study pause` / `resume` (or a UI button) records a pause. The `cards` replay shifts time by every overlapping pause, which moves **both `due` and `last_review`** by its length. No row is mutated.

### 6.5 Switching curricula

- `pnpm study curriculum set <preset>`, or telling the coach. The skill runs the command only on the user's explicit request.
- **It refuses when the preset's list is not imported**, explains how to import it, and keeps the current preset.
- **On success:**
  - progress (per problem id) is untouched;
  - the phase is **recalculated** against the new list. It may go back, for example from phase 2 of Grind 75 to phase 1 of Grind 169 with 94 problems still to learn;
  - the change appends to `curriculum_log`, the recalculated phase appends to `phase_log` with `reason = switch`, and an announcement references both;
  - `pattern_intros` stays as it is.

## 7. Recording

**Attempt lifecycle:**
- **Start:** the first event that shows real work: the solution content differs from `renderStub(...)`, or the user runs the code. Opening a problem (`readSolution` creates a stub) does not start one.
- **End:** the first green (examples, hidden and stress), or a give-up. Later edits are polishing and open nothing new. Solving the same item in the other language does not open a second attempt.
- **Active time** and **`measured`** come from the `attempt_stats` view (§4).
- **New, review or exam** is derived: review when the item has an earlier rated attempt, exam when `exam_id` is set. Nothing is stored.
- **Closing:** sets `ended_at`, `outcome` and, for problems, `rating`, then updates the `cards` cache, all in one transaction.

**Event sources:**

| Source | Events |
|---|---|
| Playground server | edit and save (through solution sync), run with `run_green` (after each run). "Start review" opens the attempt (`started_at`) |
| `pnpm watch` | edit (a file change under `.study/solutions`), run with `run_green` |
| `pnpm test` (the user's) | run with `run_green` |
| **Claude's runs** (`pnpm -s test … --no-record`, used by `review` and `hint`) | **nothing** |
| `hint` skill | `pnpm -s study record hint <id>` |
| `give-up` skill | `pnpm -s study record give-up <id>` (closes the attempt with `outcome = gave_up`, rating Again) |
| `review` skill | `pnpm -s study record complexity <id> --time … --space … --optimal` (`complexity_notes`) |
| `concept` skill | `pnpm -s study record explanation <slug>` (`concept_acceptances`) |

**Start review, from scratch:**
- For a `review` or `exam` item the playground editor shows "Start review" instead of the old code.
- `POST /api/study/start/<id>`, or the **user's** `pnpm study start <id>`:
  1. archives the current solution to `history/<timestamp>.*`;
  2. writes a fresh stub;
  3. opens the attempt.
- The editor resets its document and undo history, and keep-mine is disabled for that attempt.
- **Claude never archives:** the hook denies `study start` to Claude.

**Exam mode:** the `hint` skill checks `pnpm -s study status <id> --json`. During an exam attempt it declines without counting a hint.

**`pnpm -s study status <id> --json`** is the single source for skills. It returns:
- `everGreen` and `revealed` (a past give-up);
- the open attempt's kind and hints;
- `exam`;
- `conceptLearned`;
- the next due date.

## 8. Anti-spoiler rules (CLAUDE.md update)

- **Rule 1** reads "solved/revealed" from `study status`:
  - `solved` means `everGreen`;
  - `revealed` means `revealed`, which replaces `solution_revealed`.
- **New:** solved problems come back as reviews, so Claude **never volunteers** a solved problem's code or approach. On an explicit request it shows them, and first warns when that problem's next review is less than 14 days away.
- **Concept exercises** must still not be isomorphic to unsolved problems. "Unsolved" now comes from `study status` instead of `INDEX.md` markers.

## 9. Migration (`pnpm study migrate`)

Run **by the user** (it moves solution files; Claude is denied it), once, from the unified main checkout. `--dry-run` prints every action and changes nothing.

1. `study init` (nothing is imported: git history keeps the old frontmatter and logs; see D5):
   - create `.study/`;
   - run the Drizzle migrations (only `init` and `migrate` run them; other processes refuse an outdated schema);
   - write `tsconfig.json`;
   - create the profile.
2. **Move every solution file** (tracked and untracked) to `history/<date>-legacy.*`: copy, verify the bytes, then delete. Tracked ones are deleted with `git rm`, and the user commits that. They stay in git history.
3. **Move each "My explanation"** to `.study/explanations/<slug>.md`.
4. **Strip the content:**
   - the personal frontmatter fields and `## Log` from every problem, exercise and concept README;
   - the auto-sections that `scripts/lib/render.ts` fills with personal state: `mark()`, the concept status in `renderProblemConcepts`, and "By status" in `renderConceptIndex`.

   The user commits this as content.

**M0, before migrating** (with the user's explicit go-ahead at that time):
1. Commit `concepts/two-pointers/` on `restructure` (main checkout).
2. Integrate `playground` into `restructure`, fast-forward and no squash. `restructure` is an ancestor of `playground`; the only overlapping file, `concepts/INDEX.md`, is generated.
3. The user studies only in the main checkout from then on, and the worktree is retired.

## 10. Changes to existing pieces

| Piece | Change |
|---|---|
| `lib/schemas.ts` | Problem: drop `status`, `hints`, `solution_revealed`, `solved_in`, `complexity`. Exercise: drop the same. Concept: drop `status`. |
| `scripts/lib/checks.ts` | Reject the dropped fields and solution files in content; remove `requireSolvedIn` and "mastered needs My explanation"; warn on a pattern missing from a preset. |
| `scripts/lib/render.ts`, `sync` | Content-only `INDEX.md` and auto-sections. |
| `runner/src/paths.ts` | `studyRoot()`. |
| `runner/src/stubs.ts` | `solutionPath(target, lang)`; `ensureSolution` writes under `.study`. |
| `runner/src/run.ts` | Record run and green unless `--no-record`. |
| `runner/src/cli.ts` | The `--no-record` flag. |
| `runner/src/watcher.ts` | Watch the content folder **and** the solution folder (two watchers). |
| `playground/server/solutions.ts`, `targets.ts` | New paths; status derived from attempts (`ItemStatus` is kept as a derived type to limit web churn). |
| `playground/server/concepts.ts` | `PUT` writes the explanation to `.study/explanations/`. |
| `playground/server/events.ts` | Also watch `.study/solutions/**` and `.study/state.json` (excluding `study.db*`, `history/`, `exports/`); emit a `progress` event when `state.json`'s version changes. |
| `playground/server/app.ts` | Routes `GET /api/study/today`, `POST /api/study/start/:id`, `POST /api/study/ack/:announcement`, `POST /api/study/pause`. The DB handle is cached on `globalThis` (the Vite dev server re-evaluates `app.ts`). |
| `playground/web` | Today section (replaces Continue), announcement banner, "Start review" gate in the work view, editor reset for review and exam attempts. |
| `.claude/hooks/guard-solution.mjs` | Protect `.study/**` (solutions, history, `study.db*`). Deny Claude `study migrate\|start\|pause\|resume\|phase\|curriculum set`, `sqlite3 … study.db`, and the start/pause endpoints in `PLAYGROUND_FILES`. |
| `.claude/hooks/reminder.mjs` | Read `.study/state.json`. |
| `.claude/settings.json` | Allow `pnpm -s study:*`, `pnpm -s today:*`. |
| Skills `problem`, `concept`, `hint`, `review`, `give-up` | Templates without personal fields; record through the CLI; read `study status`. New skill: `coach`. |
| `CLAUDE.md`, `README.md` | The new layout, commands and rules. |
| Test fixtures | `scripts/tests/fixture.ts`, `playground/tests/server/helpers.ts`, `playground/e2e/fixture.ts` (`resetRepo` also resets `.study/`). |

## 11. Interfaces

**CLI** (`study/cli.ts`):

| Command | Notes |
|---|---|
| `pnpm today [--json] [--refresh]` | |
| `pnpm study status [<id>] [--json]` | |
| `pnpm study record hint\|give-up\|complexity\|explanation …` | |
| `pnpm study start <id>` | user only |
| `pnpm study pause\|resume` | user only |
| `pnpm study phase [set <phase>]` | user only for `set` |
| `pnpm study curriculum [set <preset>]` | |
| `pnpm study export` | |
| `pnpm study init` | |
| `pnpm study migrate [--dry-run]` | user only |

**`today --json` shape:**

```json
{
  "date": "2026-10-05",
  "phase": { "id": "learn", "progress": { "done": 12, "total": 75 } },
  "announcements": [{ "id": 3, "key": "phase-advanced", "payload": { "from": "bases", "to": "learn" } }],
  "mode": "normal|return|catch-up",
  "items": [
    { "kind": "continue|review|new|concept", "id": "lc-0242", "title": "Valid Anagram", "minutes": 15, "reason": "block 2/3 · arrays-hashing" }
  ],
  "backlog": { "waiting": 12 }
}
```

**The `coach` skill:**
- Triggered by "¿qué me toca hoy?", "¿qué sigue?" or "¿en qué fase voy?".
- Runs `pnpm -s today --json` and renders it in Spanish, in the student-profile tone.
- Acknowledges the chat announcements.
- Asks the onboarding questions on first use: minutes per day, language and preset.
- Never adds hints, approaches or complexity targets.

**Today section:**
- Rows link to items.
- Review and exam rows lead to the "Start review" gate.
- An announcement banner with an acknowledgment.
- A pause button.
- It refreshes on the `progress` event.

## 12. Storage and concurrency

Writers: the Vite server, `pnpm watch`, `pnpm test` and the `study` CLI. The runner's child harnesses never write.

- WAL mode and `busy_timeout = 5000`.
- `.immediate()` transactions for open-attempt read-modify-write.
- The partial unique index on open attempts; closing an attempt is idempotent.
- **Install:** better-sqlite3 v13 ships prebuilt binaries, but pnpm 11 may still treat its `binding.gyp` as a build. Verify in a scratch install, then pin the outcome in `pnpm-workspace.yaml` `allowBuilds` (next to `esbuild`).
- **Backups:**
  - `pnpm study export` writes JSON;
  - `study backup` uses `VACUUM INTO`, so the live WAL database is never copied;
  - `.study/` may be its own private git repo, holding exports, never the live DB.

## 13. Errors

| Situation | Behavior |
|---|---|
| No `.study/` | `today` explains `pnpm study init` (new users) or `migrate` (existing repo) |
| Outdated schema | Refuse with "run `pnpm study init`" |
| Invalid preset YAML | zod issues with paths |
| Progress whose content id no longer exists | Listed as an orphan by `study status`, never fatal |
| List partially imported | Reported in `today` and the phase progress |

## 14. Testing

- **The engine (Vitest):** in-memory SQLite, injected clock, fixed time zone, covering:
  - the daily plan (budget, the at-least-one rules, the stored plan);
  - the block and mix cycle (seeded mix);
  - the FSRS rating mapping, including `measured`;
  - every phase transition, and the exam;
  - return mode, the backlog spread and catch-up days;
  - pause and resume shifting `due` and `last_review`;
  - a curriculum switch in both directions, including a phase that goes back, and the refusal when the list is missing.
- **Concurrency:** two writers opening the same attempt produce one open attempt.
- **Migration:** a fixture repo with tracked and untracked solutions and explanations; the dry-run changes nothing; real runs move and strip.
- **Runner:** solution paths for problems and exercises, `--no-record`, recording run and green, and the watcher on `.study`.
- **Server:** the today, start, ack and pause endpoints, the `progress` event, and explanations in `.study`.
- **Hooks:** the guard denies Claude's writes under `.study` and the user-only commands; `reminder` reads `state.json`.
- **e2e:** the Today section lists items; "Start review" archives to `history/` and opens a blank editor; the announcement banner is acknowledged once.

## 15. Milestones (each leaves the repo green)

| Milestone | Content |
|---|---|
| **M0** | Grind 75 finished; checkouts unified (§9 M0). Needs the user. |
| **M1** | Dependencies (drizzle-orm, drizzle-kit, better-sqlite3, ts-fsrs 5.4.2 exact), `studyRoot`, the store schema and migrations, an injectable clock, `state.json`. Nothing reads it yet. |
| **M2** | The path indirection (`solutionPath(target, lang)`, falling back to the old location while it still exists), both watchers, guard and settings updates, `.study/tsconfig.json`. |
| **M3** | `study init` and `study migrate` (personal data and solution moves) with `--dry-run`, tested on fixtures. |
| **M4** | Recording (runner and server events, `--no-record`), the `study status --json` and `record` commands, the reminder via `state.json`; skills and `CLAUDE.md` read and write the DB. Old frontmatter fields are ignored but still present. |
| **M5** | The content strip: schemas, checks, render and sync, the explanation endpoint, fixtures, `.gitignore`. One content commit. |
| **M6** | Curriculum presets (grind-75 full; grind-169 and neetcode-150 with their pattern order), scheduler, phases, `today`, and the rest of the `study` CLI, with fixed-clock tests. |
| **M7** | The playground: Today section, announcement banner, Start review gate and editor reset, pause button, `progress` event, e2e. |
| **M8** | The `coach` skill, plus the 5 phase-0 concept notes and their exercises (non-isomorphic to any unsolved problem), reviewed like the Grind import. |

After M8, the user runs `pnpm study migrate` in the main checkout, commits the strip, and asks "¿qué me toca hoy?". The coach starts at phase 0 with `big-o`.

## 16. Out of scope (parts 2 and 3)

- The visible timer, the "which pattern?" prediction and its accuracy metric.
- Hosting, accounts and several profiles.
- Importing Grind 169 and NeetCode 150 (done when first needed, as Grind 75 was).
- A UI to edit presets.
