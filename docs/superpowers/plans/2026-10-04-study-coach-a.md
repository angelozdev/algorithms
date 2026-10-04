# Study Coach Plan A (store, paths, init/migrate, recording, content strip) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the user's personal progress out of the public content into a git-ignored `.study/` folder, backed by a normalized SQLite store, and record every attempt. This covers milestones M1–M5 of the study coach spec: the store, the solution path indirection and watchers, `study init` / `study migrate`, recording, and the content strip.

**Architecture:**
- **Engine.** A deterministic engine lives in `study/`:
  - `schema.ts`: Drizzle tables and views;
  - `store.ts`: `openStudy`, transactions, the schema gate, a process cache;
  - `state.ts`: the `state.json` snapshot;
  - `record.ts`: the attempt lifecycle;
  - `status.ts`: derived progress and JSON;
  - `init.ts` and `migrate.ts`;
  - a CLI (`commands.ts` / `cli.ts`).
- **Thin clients.** The runner, the playground server, the hooks and the skills only call the engine:
  - `runner/src/paths.ts` maps a `Target` to its `.study` solution path;
  - `runner/src/recording.ts` turns runs and saves into events;
  - the playground derives statuses from the `item_status` view.
- **Order.** Content READMEs stay as they are until the user runs `pnpm study migrate` (after Plans B and C). Until then the code accepts both shapes:
  - `check` warns about personal data while `.study/study.db` does not exist, and errors once it does;
  - the playground falls back to the old frontmatter only while there is no study database.

**Tech Stack:**
- Node 24.14, pnpm 11.3, TypeScript 7.0, Vitest 5, Playwright 1.63, zod 4, chokidar 5, Hono 4, Vite 8.
- New, pinned exactly and verified in a scratch install (see "Verified dependency facts"):
  - `better-sqlite3` 13.0.3, `drizzle-orm` 0.45.3, `ts-fsrs` 5.4.2;
  - dev: `drizzle-kit` 0.31.11, `@types/better-sqlite3` 9.6.0.

**Spec:** `docs/superpowers/specs/2026-10-04-study-coach-design.md` (the approved design). It is the binding authority. Sections used here: §2 (D1–D5, D9, D11), §3, §4, §7, §8, §9, §10, §12–§15.

**Start condition:**
- Milestone M0 (spec §9) is done: `playground` was fast-forwarded into `main` (3a7faf9), and the main checkout `/Users/angelozdev/me/algorithms` is on `main`.
- Before Task 1, the controller creates the feature branch from `main` with `git switch -c study-coach` and records `BASE=$(git rev-parse HEAD)`.
- The switch carries the user's uncommitted work along untouched: three modified `concepts/hash-map/` READMEs and untracked solution files.
- All paths below are relative to the repo root.

**Follow-ups owned by other plans:**
- **Plan B (M6–M7)** adds curriculum presets, the FSRS scheduler, phases, `today`, `study start|pause|resume|phase|curriculum|export|rebuild`, and the playground's Today UI.
- **Plan C (M8)** adds the `coach` skill and the phase-0 concept notes.

Both build on the **Interfaces** section below. Do not implement their parts here: the seams are named explicitly.

## Global Constraints

- **Where:**
  - Work in the main checkout `/Users/angelozdev/me/algorithms`, on the branch `study-coach` created from `main` before Task 1.
  - Never commit to `main` directly.
  - Never touch the retired `playground` worktree.
  - No push, merge, rebase or PR.
- **The user's files:**
  - Never stage, edit, move or delete the user's untracked or modified files. Today these are:
    - the three modified `concepts/hash-map/` READMEs (`README.md`, `exercises/01-first-repeat/README.md`, `exercises/02-most-frequent/README.md`);
    - the `solution.py` / `solution.ts` files under `problems/` and `concepts/` that git does not track.

    New ones may appear while you work.
  - Every file already modified or untracked when a task starts is the user's.
  - Never `git stash`, `git add -A`, `git add .`, `git commit -a`, `git reset --hard`, `git checkout -- <path>` or `git clean`. Stage by explicit path.
  - If `pnpm verify` or `check` fails only because of such a file, report it and do not fix it.
- **The real repo's progress stays put until the user migrates:**
  - Never run `pnpm study migrate` or `pnpm study init` (or their functions) against the real repo. The real repo must have no `.study/study.db` when Plan A ends.
  - Never move, copy or delete a solution file in the real repo.
  - Never run `pnpm sync` on the real repo from Task 17 on: the content-only renderer would strip the user's status marks before the migration does.
  - Every test that needs a study store builds it in a temp repo: `makeTempDir`, `tempDir`, `makeLegacyRepo`, or the e2e repo.
- **Ports and browser:**
  - Port 4173 is the user's running `pnpm play`: never use, stop or restart it.
  - `pnpm e2e` uses 4391/4392, which is fine.
  - No claude-in-chrome; never the user's Chrome.
- **Language:** every repo file, code comment and commit message is in English. Commits follow Conventional Commits, as in `git log`.
- **No spoilers** (CLAUDE.md hard rule 1):
  - No fixture, test, doc or commit may contain code or pseudocode that solves any problem or exercise in the repo.
  - Test solutions exercise the mechanism (sum a list, double a number), as the existing tests do.
  - Legacy fixture "solutions" are placeholder text such as `# tracked work`.
- **Dependencies:** exactly the versions in Task 1, added with `pnpm add <pkg>@<version>` (pnpm 11 then saves the exact version). `pnpm-workspace.yaml` must say `better-sqlite3: false` under `allowBuilds` **before** the install (see "Verified dependency facts").
- **Migrations:**
  - Generate them only with `pnpm exec drizzle-kit generate --name <name>`; never edit files under `study/migrations/` by hand.
  - Only `study init` and `study migrate` apply migrations. Every other process refuses a missing or outdated database (spec §9.1, §13).
- **Verification:**
  - `pnpm verify` runs Vitest, both `tsc` runs and `check`. It must stay green after every task, with 0 errors.
  - From Task 18 on, the real repo shows one extra warning, the "personal progress" one; that is expected.
  - `pnpm e2e` must stay green after every task that touches `playground/` or `runner/src/` solution paths: Tasks 6, 7, 13, 16 and 18.

## Verified dependency facts

These were checked in a scratch project on 2026-10-04 (macOS arm64, Node 24.14.0, pnpm 11.3.0, TypeScript 7.0.2, Vite 8.3.2). The plan relies on them; do not re-litigate them.

1. **better-sqlite3 13.0.3 under pnpm 11:**
   - It has no `install` script, but ships a `binding.gyp`, so pnpm 11 treats it as a build. Without an `allowBuilds` entry, `pnpm install` / `pnpm add` **exit 1** with `ERR_PNPM_IGNORED_BUILDS` and write a placeholder `better-sqlite3: set this to true or false` into `pnpm-workspace.yaml`.
   - The package bundles prebuilt binaries in `prebuilds/<platform>.node` (darwin, linux, linuxmusl and win32, on x64 and arm64), loaded by `lib/<platform>.js`. So the build is not needed. With `allowBuilds: { better-sqlite3: false }` the install exits 0 and `require("better-sqlite3")` works; it reports SQLite 3.53.4.
   - It ships no `.d.ts`, so `@types/better-sqlite3@9.6.0` is needed.
2. **Drizzle ORM 0.45.3 / drizzle-kit 0.31.11, all generated by `drizzle-kit generate` with no hand-written SQL:**
   - `check(name, sql\`…\`)` in the table's extra-config array becomes `CONSTRAINT "<name>" CHECK(...)`;
   - `uniqueIndex(name).on(col).where(sql\`… IS NULL\`)` becomes a partial unique index;
   - `uniqueIndex(name).on(sql\`(1)\`).where(…)` becomes the expression index `ON pauses ((1)) WHERE …`;
   - `sqliteView(name, { …typed columns }).as(sql\`…\`)` becomes `CREATE VIEW`.
   - At runtime SQLite enforces all of them; the CHECKs, the partial unique index, the `(1)` index and the foreign keys (with `PRAGMA foreign_keys = ON`) were each probed.
   - Window functions (`lag() OVER (PARTITION BY …)`) work inside a view.
3. **Drizzle runtime APIs:**
   - `drizzle(betterSqlite3Database, { schema })` from `drizzle-orm/better-sqlite3`;
   - `migrate(db, { migrationsFolder })` from `drizzle-orm/better-sqlite3/migrator` is synchronous and runs in a transaction;
   - `readMigrationFiles({ migrationsFolder })` from `drizzle-orm/migrator` returns `{ hash, folderMillis, sql }[]`.
   - drizzle-kit 0.31 writes `study/migrations/0000_<name>.sql` plus `meta/_journal.json` and `meta/0000_snapshot.json`. The migrator reads the journal and the `.sql` files.
   - Applied migrations are rows of `__drizzle_migrations(created_at = folderMillis)`. Drizzle applies a migration when no row exists or `last.created_at < folderMillis`; `pendingMigrations()` reuses that rule.
   - `db.transaction(fn, { behavior: "immediate" })` emits `BEGIN IMMEDIATE`, is synchronous, returns `fn`'s value and rolls back on throw.
   - `integer(…, { mode: "timestamp_ms" })` round-trips `Date` objects, and `integer(…, { mode: "boolean" })` round-trips booleans.
   - `.returning().get()`, `.onConflictDoNothing()` (returning `undefined` on conflict) and `.onConflictDoUpdate({ target, set })` work, as do joins with a view (`innerJoin(attemptStats, …)`) and `select().from(view).where(…)`.
   - Six processes racing `BEGIN IMMEDIATE` read-then-insert produced exactly one row.
4. **drizzle-kit as a drift check:** a second `drizzle-kit generate --dialect sqlite --schema ./study/schema.ts --out <copy>` prints `No schema changes, nothing to migrate` when the schema matches. A rename it cannot decide becomes an interactive prompt that fails without a TTY. Either way the output lacks that sentence.
5. **TypeScript 7 (`tsc`)** type-checks `drizzle-orm` 0.45.3 and `drizzle.config.ts` with the repo's options (`skipLibCheck: true`). It **does not include files under `.study/`** in `include: ["**/*.ts"]`: dot-folders are skipped.
6. **tsx** with `TSX_TSCONFIG_PATH` resolves `import … from "lc"` for a solution under `.study/solutions/…`, so the runner needs no change.
   - A generated `.study/tsconfig.json` makes `tsc -p .study/tsconfig.json` resolve `lc` and `@types/node`, even from outside the repo, and skips `history/`. It needs `extends` (relative path to the root `tsconfig.json`), `compilerOptions.typeRoots` (relative path to `node_modules/@types`), `include: ["solutions/**/*.ts"]` and `exclude: ["solutions/**/history"]`.
7. **chokidar 5** (polling) notes:
   - Watching the content root picks up a `.study/` created later inside it.
   - An `ignored` filter keeps `.study/solutions/**` and `.study/state.json` and drops `study.db` and `history/`.
   - chokidar 5 **never** reports a watched path that did not exist when watching started. So an `ALGO_STUDY` outside the content root is watched only if it exists when `pnpm play` starts.
8. **Vite 8.3.2's SSR loader** (`ssrLoadModule`, what `@hono/vite-dev-server` uses) imports `better-sqlite3` and `drizzle-orm` with no `ssr.external` config.

## Review Focus

The five failure modes most likely to bite, each pinned by a test in the task named:

1. **The user's existing in-folder solution must remain the file every tool uses until `migrate`.** That covers runner, watch, playground read/write and the stub check. A new stub under `.study` must never shadow work the user already has. Test: Task 6, "keeps using a solution that still sits in the content folder".
2. **A migration that is interrupted, re-run, or meets newer data must never lose bytes:**
   - copies are verified before any delete;
   - a second run does nothing;
   - an existing `.study/explanations/<slug>.md` with different text is kept, and the README's text is saved next to it;
   - an unstrippable README blocks the whole run before anything changes.

   Tests: Task 11.
3. **Recording must never break the user's run or save.** When there is no study database, its schema is outdated, or SQLite throws, the run or save still succeeds and prints at most one `study: …` line on stderr. Test: Task 13, "never breaks a run".
4. **Opening a problem must not start an attempt, and neither may an editor that only reformats the stub (CRLF, trailing blanks) nor `pnpm watch`'s first automatic run.** Otherwise phantom items show as "in progress". Tests: Task 12 (stub-equal save), Task 13 (`sameAsStub` and the watcher's first run).
5. **`pnpm check` on the unmigrated real repo stays green.** The same data is a warning before `.study/study.db` exists and an error after it does. Test: Task 18, "warns about personal progress in content until the study store exists".

## File map

| File | Change | Task |
|---|---|---|
| `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml` | deps; `allowBuilds.better-sqlite3: false`; scripts `study`, `today` | 1, 9 |
| `vitest.config.ts` | `study/tests` in the node project; `env.ALGO_STUDY = ""` | 1 |
| `.gitignore` | `.study/`; later `problems/**/solution.*`, `concepts/**/solution.*` | 1, 18 |
| `runner/src/paths.ts` | `studyRoot`, `targetRoot`, `studySolutionDir/Path`, `legacySolutionPath`, `historyStamp/Path`, `studyTsconfig`, `writeStudyTsconfig` | 1, 5 |
| `study/schema.ts`, `drizzle.config.ts`, `study/migrations/*` | schema, views, first migration | 2 |
| `study/clock.ts`, `study/store.ts` | clock; store API | 3 |
| `study/state-file.ts`, `study/state.ts` | `state.json` | 4 |
| `runner/src/stubs.ts` | `solutionPath(target, lang)`, `ensureSolution(target, …)` | 6 |
| `runner/src/{run,custom,cli,watcher}.ts` | new paths; two watchers; recording; `--no-record` | 6, 13 |
| `playground/server/{solutions,targets,events,concepts,types}.ts` | new paths; `.study` events; `progress`; recording; derived status; explanations in `.study` | 6, 7, 13, 16 |
| `playground/web/events.tsx`, `playground/web/api.ts` | refetch on `progress` | 7 |
| `lib/repo.ts` | `isInProgress` sees `.study` solutions (legacy fallback only) | 6 |
| `.claude/hooks/guard-solution.mjs`, `.claude/hooks/reminder.mjs`, `.claude/settings.json` | protect `.study`; user-only commands; reminder via `state.json` | 8, 15 |
| `study/commands.ts`, `study/cli.ts`, `study/init.ts` | CLI, `init` | 9 |
| `lib/explanation.ts` (moved from `playground/server/`), `study/strip.ts`, `lib/schemas.ts` | README strip helpers; `LEGACY_PERSONAL_FIELDS` | 10 |
| `study/migrate.ts` | `migrate`; regenerates the indexes | 11, 17 |
| `study/record.ts`, `study/close-hook.ts` | recording API; Plan B's close seam | 12 |
| `runner/src/recording.ts` | runner/playground → engine adapter | 13 |
| `study/status.ts` | progress, `status --json` | 14 |
| `.claude/skills/{hint,review,give-up,concept,problem}/SKILL.md`, `CLAUDE.md`, `README.md` | read/write through the CLI; templates; layout | 15, 19 |
| `lib/schemas.ts`, `scripts/lib/checks.ts` | content-only schemas; personal-data transition | 18 |
| `scripts/lib/render.ts` | content-only output (sync writes what it renders) | 17 |
| `scripts/tests/fixture.ts`, `playground/tests/server/helpers.ts`, `playground/e2e/fixture.ts`, `study/tests/{legacy-fixture,seed}.ts` | fixtures | 6, 11, 16, 18 |

## Interfaces for Plans B and C

The contract later plans build on. Every name below is created by the task in brackets, with exactly this signature.

**Schema** (`study/schema.ts`) [Task 2]:
- **Tables:** TS export (SQL name):
  - `profile` (`profile`), `curriculumLog` (`curriculum_log`), `phaseLog` (`phase_log`);
  - `patternIntros` (`pattern_intros`), `conceptAcceptances` (`concept_acceptances`), `exams` (`exams`);
  - `attempts` (`attempts`), `attemptEvents` (`attempt_events`), `complexityNotes` (`complexity_notes`);
  - `pauses` (`pauses`), `dailyPlans` (`daily_plans`), `planItems` (`plan_items`);
  - `announcements` (`announcements`), `announcementAcks` (`announcement_acks`);
  - the cache `cards` (`cards`).
- **Views:** `attemptStats` (`attempt_stats`: `attemptId, itemId, kind, hints, activeMs, measured, lang`) and `itemStatusView` (`item_status`: `itemId, status, everGreen, everGaveUp, lastOutcome`).
- **Vocabularies** (`as const` arrays, each with its type):
  - `LANG_VALUES`;
  - `PHASES` → `Phase`; `CURRICULUM_REASONS`; `PHASE_REASONS`;
  - `OUTCOMES` → `Outcome`; `RATINGS` → `Rating`;
  - `EVENT_TYPES` → `EventType`; `EVENT_SOURCES` → `EventSource`;
  - `PLAN_MODES`; `PLAN_SLOTS`; `ANNOUNCEMENT_KINDS`; `SURFACES`;
  - `ITEM_STATUSES` → `ItemStatusValue`; `ATTEMPT_KINDS` → `AttemptKind`.
- **Constants:** `ACTIVE_GAP_MS = 300000`, `MEASURED_MIN_EVENTS = 3`.
- **Time:** every instant column is `integer` epoch ms read as `Date`.
- **Phase ids:** `bases | learn | master | expand | pro`.
- **Announcement references:**
  - `phase` → `phase_log_id` only;
  - `switch` → `phase_log_id` and `curriculum_log_id`;
  - `return` → `local_date` only.

**Clock** (`study/clock.ts`) [Task 3]:
- `interface Clock { now(): Date }`; `systemClock`;
- `fixedClock(start: Date | string): FixedClock`, with `set(at)` and `advance(ms)`;
- `envClock(env = process.env): Clock`: `ALGO_STUDY_NOW=<ISO>` freezes it.

**Store** (`study/store.ts`) [Task 3]:
- `type StudyDb = BetterSQLite3Database<typeof schema>`; `type StudyTx` is the `db.transaction` callback's argument.
- `interface Study { root: string | null; dir: string | null; db: StudyDb; sqlite: Database.Database; clock: Clock; close(): void }`.
- `openStudy(root: string, options?: { clock?: Clock; migrate?: boolean; migrationsDir?: string }): Study`: `root` is the content root and the database is `<studyRoot(root)>/study.db`.
- `openMemoryStudy(options?: { clock?: Clock; root?: string }): Study`.
- `inTransaction<T>(study: Study, fn: (tx: StudyTx) => T): T` (BEGIN IMMEDIATE).
- `cachedStudy(root: string, clock?: Clock): Study | null`: a `globalThis` cache that returns null until initialized and reopens a replaced file; `closeCachedStudies(): void`.
- `dbPath(dir: string): string`, `pendingMigrations(sqlite, migrationsDir?): number`, `MIGRATIONS_DIR`.
- Errors: `StudyNotInitializedError`, `StudySchemaOutdatedError` (message: "Run `pnpm study init`").

**Paths** (`runner/src/paths.ts`) [Tasks 1, 5] and **stubs** (`runner/src/stubs.ts`) [Task 6]:
- `studyRoot(root: string = contentRoot()): string` returns `$ALGO_STUDY` (absolute) or `<root>/.study`.
- `targetRoot(target): string`.
- `studySolutionDir(target)`: `.study/solutions/problems/<id>` or `.study/solutions/exercises/<concept>/<NN>`.
- `studySolutionPath(target, lang)`, `legacySolutionPath(target, lang)`.
- `historyStamp(at: Date)` → `2026-10-04T10-00-00-000Z`.
- `historyPath(target, lang, at, { legacy?: boolean })` → `…/history/<stamp>[-legacy].<lang>`.
- `writeStudyTsconfig(studyDir, { onlyIfMissing? })`.
- `solutionPath(target: Target, lang: Lang): string` returns the legacy in-folder file while it exists, else the `.study` path.
- `ensureSolution(target: Target, cf: CaseFile, lang: Lang): { path: string; created: boolean }`.

**State** [Task 4]:
- In `study/state-file.ts`, with no DB import:
  - `interface StudyState { version: string; phase: Phase | null; inProgress: InProgressItem[]; today: TodaySummary | null }`;
  - `InProgressItem = { id: string; kind: AttemptKind; hints: number; startedAt: string }` (ISO);
  - `TodaySummary = { date: string; planned: number; done: number }`: Plan B fills it, Plan A writes `null`;
  - `STATE_FILE = "state.json"`, `statePath(dir)`, `readState(dir): StudyState | null`, `writeStateFile(dir, snapshot)`.
  - `version` is a 16-hex hash of the other fields, so it changes exactly when they change.
- In `study/state.ts`: `buildSnapshot(study)`, `openAttemptList(study)`, `refreshState(study): { changed: boolean }`. Call it after every committed write. Plan B adds `today` inside `buildSnapshot`.

**Recording** (`study/record.ts`) [Task 12]:
- `type WorkEvent = { type: "edit" | "save"; lang: Lang; differsFromStub: boolean } | { type: "run"; lang: Lang; green: boolean }`.
- `recordWork(study, itemId, event, source: EventSource)` returns `{ recorded: true; attemptId; opened; closed }` or `{ recorded: false; reason: "stub" | "closed" }`.
- `recordHint(study, itemId)` returns `{ recorded: true; attemptId; hints }` or `{ recorded: false; reason: "closed" | "exam" }`.
- `giveUp(study, itemId)` returns `{ recorded: true; attemptId }` or `{ recorded: false; reason: "closed" }`.
- `recordComplexity(study, itemId, { time, space, optimal })` returns `{ recorded: true; attemptId }` or `{ recorded: false; reason: "not-green" }`.
- `acceptExplanation(study, slug)` returns `{ acceptedAt: Date; already: boolean }`.
- Building blocks for Plan B's `study start` and exams:
  - `openAttemptOf(tx, itemId)`;
  - `openAttempt(tx, itemId, at, { examId? }): number`, which throws `AttemptAlreadyOpenError`;
  - `closeAttempt(tx, attemptId, outcome, at, study): ClosedAttempt | null`, which is idempotent.

**The close seam** (`study/close-hook.ts`) [Task 12]:
- `onAttemptClosed(tx: StudyTx, attempt: ClosedAttempt, ctx: CloseContext): void`.
- `ClosedAttempt = { id; itemId; examId: number | null; startedAt: Date; endedAt: Date; outcome: Outcome }`; `CloseContext = { root: string | null; clock: Clock }`.
- `closeAttempt` calls it exactly once per attempt, inside the closing transaction. A throw rolls the close back.
- Plan A's body is empty, so `rating` stays null and no card is written. **Plan B replaces the body:** it sets `attempts.rating` for problems and upserts `cards`.

**Status** (`study/status.ts`) [Task 14]:
- `ItemProgress = { itemId; status: ItemStatusValue; everGreen; revealed; lastOutcome; open: OpenAttempt | null; hints; nextDue: Date | null }`;
- `OpenAttempt = { attemptId; kind: AttemptKind; hints; startedAt: Date; examId: number | null }`;
- `allItemProgress(study, only?)`, `itemProgress(study, itemId)`, `emptyProgress(itemId)`;
- `conceptProgress(study, slug, exerciseIds, progress?)` → `{ slug; accepted; acceptedAt; learned; exercises: { id; status; done }[] }`;
- `exerciseDone(p) = p.lastOutcome === "green"`;
- `itemStatusJson`, `conceptStatusJson`, `summaryJson` (shapes below).

**`pnpm -s study status <item-id> --json`** [Task 14]:

```json
{ "initialized": true, "id": "lc-0001", "kind": "problem", "status": "in_progress", "everGreen": false, "revealed": false,
  "open": { "kind": "new", "hints": 1, "startedAt": "2026-10-04T10:00:00.000Z" }, "exam": false,
  "concept": null, "conceptLearned": null, "nextDue": null }
```

- `kind` is `problem | exercise`. `status` is `todo | in_progress | solved | revealed`.
- `revealed` means a past give-up. `open.kind` is `new | review | exam`.
- `exam` is true when the open attempt has `exam_id`.
- `concept` and `conceptLearned` are set for exercises (the exercise's concept) and null for problems.
- `nextDue` is the card's due date, null until Plan B writes cards.
- With `initialized: false` (no `.study/study.db`), every field takes its empty value.

**`pnpm -s study status <concept> --json`**:

```json
{ "initialized": true, "id": "hash-map", "kind": "concept", "accepted": true, "acceptedAt": "…", "learned": false,
  "exercises": [{ "id": "hash-map/01", "status": "solved", "done": true }] }
```

**`pnpm -s study status --json`**:

```json
{ "initialized": true, "inProgress": [{ "id": "lc-0001", "kind": "new", "hints": 1, "startedAt": "…" }],
  "solved": ["lc-0020"], "revealed": [], "orphans": ["lc-9999"] }
```

Plan B adds fields to these objects; it never renames these.

**Other Plan A entry points** [Tasks 9, 11, 13, 14]:
- **CLI:**
  - `runStudyCli(argv: string[], io: CliIo): Promise<number>`, with `CliIo = { root; clock; out(text); err(text) }`;
  - commands `init | migrate | status | record | today`. In Plan A, `today` prints that it arrives with Plan B and exits 2; **Plan B replaces it**.
- **Engine functions:**
  - `initStudy(root, { clock, minutes?, language?, timezone? })`;
  - `planMigration(root, at)` / `applyMigration(plan, { clock, timezone? })`; the plan ends with a `sync` action that regenerates `INDEX.md` and the auto-sections as pure content (Task 17).
- **Runner:**
  - `RunOptions.record?: EventSource`;
  - `recordRun(target, lang, green, source)` and `recordSolutionChange(target, lang, code, "edit" | "save", source)` in `runner/src/recording.ts`.
- **Playground events:** `RepoEvent` gains `{ kind: "progress"; version: string }`.
- **Test fixtures:**
  - `study/tests/seed.ts` provides `resetStudy(root, clock?)`, `seedClosedAttempt(root, itemId, outcome, at?)`, `seedOpenAttempt(root, itemId, { hints?, at? })` and `seedAcceptance(root, slug)`;
  - `study/tests/legacy-fixture.ts` provides `makeLegacyRepo()`, `git(root, …args)` and `snapshotTree(root)`.

---

## Milestone M1: the store

### Task 1: Dependencies, `studyRoot()`, and test isolation

**Files:**
- Modify: `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml` (the last two through `pnpm add`)
- Modify: `runner/src/paths.ts`
- Modify: `vitest.config.ts`
- Modify: `.gitignore`
- Test: `runner/tests/paths.test.ts` (create)

**Interfaces:**
- Produces: `studyRoot(root: string = contentRoot()): string` in `runner/src/paths.ts`. It returns `path.resolve($ALGO_STUDY)` when that variable is non-empty, else `path.join(root, ".study")`.
- Produces: every Vitest test runs with `process.env.ALGO_STUDY === ""`, so no test can reach the user's own progress.

- [ ] **Step 1: Allow better-sqlite3's prebuilt binary without a build**

Replace `pnpm-workspace.yaml` with:

```yaml
allowBuilds:
  # better-sqlite3 13 ships prebuilt binaries (prebuilds/<platform>.node); its binding.gyp is only a
  # fallback. false keeps pnpm from compiling SQLite and from failing with ERR_PNPM_IGNORED_BUILDS.
  better-sqlite3: false
  esbuild: true
```

- [ ] **Step 2: Add the dependencies, pinned exactly**

```bash
pnpm add better-sqlite3@13.0.3 drizzle-orm@0.45.3 ts-fsrs@5.4.2
pnpm add -D drizzle-kit@0.31.11 @types/better-sqlite3@9.6.0
node -e "const D = require('better-sqlite3'); console.log(new D(':memory:').prepare('select sqlite_version() v').get().v)"
```

Expected:
- Both `pnpm add` exit 0 with no `ERR_PNPM_IGNORED_BUILDS`.
- `package.json` lists `"better-sqlite3": "13.0.3"`, `"drizzle-orm": "0.45.3"`, `"ts-fsrs": "5.4.2"`, `"drizzle-kit": "0.31.11"` and `"@types/better-sqlite3": "9.6.0"`, with no `^`.
- `pnpm-workspace.yaml` still reads exactly as in Step 1.
- The `node -e` line prints `3.53.4`.

`ts-fsrs` is unused until Plan B; spec M1 adds it here.

- [ ] **Step 3: Write the failing test**

Create `runner/tests/paths.test.ts`:

```ts
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentRoot, studyRoot } from "../src/paths.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("studyRoot", () => {
  it("is .study inside the content root it is given", () => {
    expect(studyRoot("/work/repo")).toBe(path.join("/work/repo", ".study"));
  });

  it("defaults to the content root, which follows ALGO_ROOT", () => {
    vi.stubEnv("ALGO_ROOT", "/tmp/fixture-repo");
    expect(contentRoot()).toBe(path.resolve("/tmp/fixture-repo"));
    expect(studyRoot()).toBe(path.join(path.resolve("/tmp/fixture-repo"), ".study"));
  });

  it("uses ALGO_STUDY when it is set, made absolute", () => {
    vi.stubEnv("ALGO_STUDY", "progress/mine");
    expect(studyRoot("/work/repo")).toBe(path.resolve("progress/mine"));
  });

  it("runs every test with ALGO_STUDY cleared, so no test can reach the user's own progress", () => {
    expect(process.env.ALGO_STUDY).toBe("");
    expect(studyRoot("/work/repo")).toBe(path.join("/work/repo", ".study"));
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm vitest run runner/tests/paths.test.ts`
Expected: FAIL. `studyRoot` is not exported.

- [ ] **Step 5: Add `studyRoot()`**

Append to `runner/src/paths.ts`:

```ts
/**
 * The user's personal progress (study coach spec §3): $ALGO_STUDY, or <content root>/.study.
 * `root` is the content root being worked on (default: contentRoot()), so a test repo gets its own .study.
 */
export function studyRoot(root: string = contentRoot()): string {
  const override = process.env.ALGO_STUDY;
  return override ? path.resolve(override) : path.join(root, ".study");
}
```

- [ ] **Step 6: Isolate the tests and pick up `study/tests`**

In `vitest.config.ts`:

1. Add `env` to the top-level `test` block, right after `hookTimeout: 30_000,`:

```ts
    // No test may reach the user's own progress: studyRoot() falls back to <test repo>/.study.
    env: { ALGO_STUDY: "" },
```

2. In the `node` project, change `include` to:

```ts
          include: [
            "runner/tests/**/*.test.ts",
            "scripts/tests/**/*.test.ts",
            "playground/tests/server/**/*.test.ts",
            "study/tests/**/*.test.ts",
          ],
```

- [ ] **Step 7: Ignore `.study/`**

In `.gitignore`, after the `runner/tests/.tmp/` block, add:

```gitignore

# Personal study progress (study coach spec §3): solutions, their history, the progress database
.study/
```

- [ ] **Step 8: Run the tests and the type check**

Run: `pnpm vitest run runner/tests/paths.test.ts && pnpm exec tsc --noEmit`
Expected: 4 passed; `tsc` prints nothing.

- [ ] **Step 9: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml runner/src/paths.ts runner/tests/paths.test.ts vitest.config.ts .gitignore
git commit -m "feat(study): add the study store dependencies and studyRoot()"
```

---

### Task 2: The normalized schema, its views and the first migration

**Files:**
- Create: `study/schema.ts`, `drizzle.config.ts`
- Create (generated by drizzle-kit, never edited by hand): `study/migrations/0000_study_init.sql`, `study/migrations/meta/_journal.json`, `study/migrations/meta/0000_snapshot.json`
- Test: `study/tests/schema.test.ts`, `study/tests/migrations.test.ts` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: everything listed under "Schema" in **Interfaces for Plans B and C**, with exactly these export names.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/schema.test.ts`:

```ts
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
```

Create `study/tests/migrations.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../runner/src/paths.ts";

describe("study/migrations", () => {
  it("match study/schema.ts: generating against a copy finds no changes", () => {
    const copy = mkdtempSync(path.join(os.tmpdir(), "algo-migrations-"));
    try {
      cpSync(path.join(REPO_ROOT, "study", "migrations"), copy, { recursive: true });
      const run = spawnSync(
        path.join(REPO_ROOT, "node_modules", ".bin", "drizzle-kit"),
        ["generate", "--dialect", "sqlite", "--schema", "./study/schema.ts", "--out", copy],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
      // Anything else (a new migration, or a rename prompt that fails without a TTY) means schema.ts changed
      // without `pnpm exec drizzle-kit generate --name <what-changed>`.
      expect(run.stdout).toContain("No schema changes");
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/schema.test.ts study/tests/migrations.test.ts`
Expected: FAIL. `../schema.ts` does not exist, and `study/migrations` is missing.

- [ ] **Step 3: Write the schema**

Create `study/schema.ts`:

```ts
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
```

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

// `pnpm exec drizzle-kit generate --name <what-changed>` writes study/migrations/ from study/schema.ts.
export default defineConfig({ dialect: "sqlite", schema: "./study/schema.ts", out: "./study/migrations" });
```

- [ ] **Step 4: Generate the first migration**

Run: `pnpm exec drizzle-kit generate --name study_init`

Expected:
- The output ends with `15 tables` (followed by the per-table lines) and `[✓] Your SQL migration file ➜ study/migrations/0000_study_init.sql`.
- `study/migrations/` contains `0000_study_init.sql`, `meta/_journal.json` and `meta/0000_snapshot.json`.

Spot-check the SQL:
- `grep -c "CREATE TABLE" study/migrations/0000_study_init.sql` prints `15`;
- `grep -c "CREATE VIEW" …` prints `2`;
- the file contains `ON \`pauses\` ((1)) WHERE` and `WHERE "attempts"."ended_at" IS NULL`.

Do not edit any generated file.

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm vitest run study/tests/schema.test.ts study/tests/migrations.test.ts && pnpm exec tsc --noEmit`
Expected: 11 passed; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add study/schema.ts drizzle.config.ts study/migrations/0000_study_init.sql study/migrations/meta/_journal.json study/migrations/meta/0000_snapshot.json study/tests/schema.test.ts study/tests/migrations.test.ts
git commit -m "feat(study): add the normalized study schema, its views and the first migration"
```

---

### Task 3: The store: `openStudy`, the clock, transactions, the schema gate and the process cache

**Files:**
- Create: `study/clock.ts`, `study/store.ts`
- Test: `study/tests/store.test.ts` (create)

**Interfaces:**
- Consumes:
  - `studyRoot(root)` (Task 1);
  - `study/schema.ts` and `study/migrations/` (Task 2).
- Produces: "Clock" and "Store" exactly as listed in **Interfaces for Plans B and C**.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/store.test.ts`:

```ts
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { envClock, fixedClock, systemClock } from "../clock.ts";
import { attempts } from "../schema.ts";
import {
  cachedStudy,
  closeCachedStudies,
  dbPath,
  inTransaction,
  MIGRATIONS_DIR,
  openMemoryStudy,
  openStudy,
  pendingMigrations,
  StudyNotInitializedError,
  StudySchemaOutdatedError,
} from "../store.ts";

afterEach(() => {
  closeCachedStudies();
  cleanupTempDirs();
  vi.unstubAllEnvs();
});

/** A copy of the migrations plus a fake later one: what a repo looks like after a pull that changed the schema. */
function newerMigrations(): string {
  const dir = makeTempDir("algo-migrations-");
  cpSync(MIGRATIONS_DIR, dir, { recursive: true });
  const journalFile = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8")) as { entries: { idx: number; when: number; tag: string }[] };
  const last = journal.entries[journal.entries.length - 1];
  journal.entries.push({ ...last, idx: last.idx + 1, when: last.when + 1000, tag: "0001_probe" });
  writeFileSync(journalFile, JSON.stringify(journal));
  writeFileSync(path.join(dir, "0001_probe.sql"), "CREATE TABLE `probe` (`id` integer PRIMARY KEY);");
  return dir;
}

describe("clocks", () => {
  it("a fixed clock moves only when told to", () => {
    const clock = fixedClock("2026-10-04T10:00:00Z");
    expect(clock.now().toISOString()).toBe("2026-10-04T10:00:00.000Z");
    clock.advance(90_000);
    expect(clock.now().toISOString()).toBe("2026-10-04T10:01:30.000Z");
    clock.set("2026-10-05T00:00:00Z");
    expect(clock.now().toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(() => fixedClock("not a date")).toThrow(RangeError);
  });

  it("ALGO_STUDY_NOW freezes the CLI's clock; otherwise it is the system clock", () => {
    expect(envClock({ ALGO_STUDY_NOW: "2026-10-04T10:00:00Z" }).now().toISOString()).toBe("2026-10-04T10:00:00.000Z");
    expect(envClock({})).toBe(systemClock);
  });
});

describe("openStudy", () => {
  it("refuses a repo that was never initialized, and creates nothing", () => {
    const root = makeTempDir("algo-study-");
    expect(() => openStudy(root)).toThrow(StudyNotInitializedError);
    expect(() => openStudy(root)).toThrow(/pnpm study init.*pnpm study migrate/s);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });

  it("with migrate: true creates .study/study.db in WAL mode, with a busy timeout and foreign keys on", () => {
    const root = makeTempDir("algo-study-");
    const study = openStudy(root, { migrate: true });
    expect(study.root).toBe(root);
    expect(study.dir).toBe(path.join(root, ".study"));
    expect(existsSync(dbPath(path.join(root, ".study")))).toBe(true);
    expect(study.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(study.sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
    expect(study.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    study.close();
    openStudy(root).close(); // from now on any process may open it
  });

  it("refuses an outdated schema until a migrating open applies the new migration", () => {
    const root = makeTempDir("algo-study-");
    openStudy(root, { migrate: true }).close();
    const newer = newerMigrations();
    expect(() => openStudy(root, { migrationsDir: newer })).toThrow(StudySchemaOutdatedError);
    expect(() => openStudy(root, { migrationsDir: newer })).toThrow(/Run `pnpm study init`/);
    openStudy(root, { migrate: true, migrationsDir: newer }).close();
    const study = openStudy(root, { migrationsDir: newer });
    expect(pendingMigrations(study.sqlite, newer)).toBe(0);
    study.close();
  });

  it("follows ALGO_STUDY", () => {
    const root = makeTempDir("algo-study-");
    const elsewhere = path.join(makeTempDir("algo-elsewhere-"), "progress");
    vi.stubEnv("ALGO_STUDY", elsewhere);
    const study = openStudy(root, { migrate: true });
    expect(study.dir).toBe(elsewhere);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
    study.close();
  });
});

describe("inTransaction", () => {
  it("commits what fn wrote, or nothing at all when fn throws", () => {
    const study = openMemoryStudy({ clock: fixedClock("2026-10-04T10:00:00Z") });
    inTransaction(study, (tx) => tx.insert(attempts).values({ itemId: "lc-0001", startedAt: study.clock.now() }).run());
    expect(() =>
      inTransaction(study, (tx) => {
        tx.insert(attempts).values({ itemId: "lc-0002", startedAt: study.clock.now() }).run();
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(study.db.select().from(attempts).all().map((row) => row.itemId)).toEqual(["lc-0001"]);
    study.close();
  });
});

describe("cachedStudy", () => {
  it("is null until the database exists, then one shared handle, reopened when the file is replaced", () => {
    const root = makeTempDir("algo-study-");
    expect(cachedStudy(root)).toBeNull();
    openStudy(root, { migrate: true }).close();
    const first = cachedStudy(root);
    expect(first).not.toBeNull();
    expect(cachedStudy(root)).toBe(first);
    first!.db.insert(attempts).values({ itemId: "lc-0001", startedAt: new Date() }).run();
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath(path.join(root, ".study"))}${suffix}`, { force: true });
    expect(cachedStudy(root)).toBeNull();
    openStudy(root, { migrate: true }).close();
    const second = cachedStudy(root);
    expect(second).not.toBe(first);
    expect(second!.db.select().from(attempts).all()).toEqual([]);
  });

  it("refuses an outdated schema like openStudy", () => {
    const root = makeTempDir("algo-study-");
    openStudy(root, { migrate: true }).close();
    const study = openStudy(root);
    study.sqlite.prepare("DELETE FROM __drizzle_migrations").run();
    study.close();
    expect(() => cachedStudy(root)).toThrow(StudySchemaOutdatedError);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/store.test.ts`
Expected: FAIL. `../clock.ts` and `../store.ts` do not exist.

- [ ] **Step 3: Write the clock**

Create `study/clock.ts`:

```ts
/** Where the engine reads the time (spec §6.3: tests fix the time zone and inject the clock). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export interface FixedClock extends Clock {
  set(at: Date | string): void;
  advance(ms: number): void;
}

/** A clock that only moves when a test moves it. */
export function fixedClock(start: Date | string): FixedClock {
  const parse = (value: Date | string): number => {
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) throw new RangeError(`not a date: ${String(value)}`);
    return ms;
  };
  let current = parse(start);
  return {
    now: () => new Date(current),
    set: (at) => {
      current = parse(at);
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

/** ALGO_STUDY_NOW=<ISO time> freezes the clock of the study CLI and the runner's recording (CLI tests, e2e). */
export function envClock(env: NodeJS.ProcessEnv = process.env): Clock {
  return env.ALGO_STUDY_NOW ? fixedClock(env.ALGO_STUDY_NOW) : systemClock;
}
```

- [ ] **Step 4: Write the store**

Create `study/store.ts`:

```ts
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { studyRoot } from "../runner/src/paths.ts";
import { type Clock, systemClock } from "./clock.ts";
import * as schema from "./schema.ts";

export const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));
export const DB_FILE = "study.db";
/** Writers: the Vite server, pnpm watch, pnpm test and the study CLI (spec §12). */
export const BUSY_TIMEOUT_MS = 5000;

export type StudyDb = BetterSQLite3Database<typeof schema>;
export type StudyTx = Parameters<Parameters<StudyDb["transaction"]>[0]>[0];

export interface Study {
  /** Content root (problems/, concepts/); null for an in-memory study opened without one. */
  root: string | null;
  /** Study root (.study); null in memory, where nothing is written to disk. */
  dir: string | null;
  db: StudyDb;
  sqlite: Database.Database;
  clock: Clock;
  close(): void;
}

export class StudyNotInitializedError extends Error {
  constructor(readonly dir: string) {
    super(
      `There is no study database in ${dir}. A new repo: run \`pnpm study init\`. A repo with progress in its READMEs: run \`pnpm study migrate\`.`,
    );
    this.name = "StudyNotInitializedError";
  }
}

export class StudySchemaOutdatedError extends Error {
  constructor(readonly dir: string) {
    super(`The study database in ${dir} uses an older schema. Run \`pnpm study init\` to update it.`);
    this.name = "StudySchemaOutdatedError";
  }
}

export function dbPath(dir: string): string {
  return path.join(dir, DB_FILE);
}

/** Migrations this database has not applied, by drizzle's own rule: newer than the last applied one. */
export function pendingMigrations(sqlite: Database.Database, migrationsDir: string = MIGRATIONS_DIR): number {
  const files = readMigrationFiles({ migrationsFolder: migrationsDir });
  const table = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'").get();
  if (!table) return files.length;
  const last = (sqlite.prepare("SELECT max(created_at) AS at FROM __drizzle_migrations").get() as { at: number | null }).at;
  return files.filter((file) => last === null || Number(last) < file.folderMillis).length;
}

function configure(sqlite: Database.Database): void {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  sqlite.pragma("foreign_keys = ON");
}

export interface OpenOptions {
  clock?: Clock;
  /** Create the database and apply pending migrations: only `study init` and `study migrate` pass true. */
  migrate?: boolean;
  /** Tests only: another migrations folder. */
  migrationsDir?: string;
}

/**
 * Opens <studyRoot(root)>/study.db. Every process except `study init` / `study migrate` refuses a missing
 * database (StudyNotInitializedError) and an outdated one (StudySchemaOutdatedError), spec §9.1 and §13.
 */
export function openStudy(root: string, options: OpenOptions = {}): Study {
  const dir = studyRoot(root);
  const file = dbPath(dir);
  const migrationsDir = options.migrationsDir ?? MIGRATIONS_DIR;
  if (!options.migrate && !existsSync(file)) throw new StudyNotInitializedError(dir);
  if (options.migrate) mkdirSync(dir, { recursive: true });
  const sqlite = new Database(file, { fileMustExist: !options.migrate });
  try {
    configure(sqlite);
    const db = drizzle(sqlite, { schema });
    if (options.migrate) migrate(db, { migrationsFolder: migrationsDir });
    else if (pendingMigrations(sqlite, migrationsDir) > 0) throw new StudySchemaOutdatedError(dir);
    return { root, dir, db, sqlite, clock: options.clock ?? systemClock, close: () => sqlite.close() };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

/** A migrated in-memory study for engine tests. `root` lets content-aware code (status, the close seam) read files. */
export function openMemoryStudy(options: { clock?: Clock; root?: string } = {}): Study {
  const sqlite = new Database(":memory:");
  configure(sqlite);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { root: options.root ?? null, dir: null, db, sqlite, clock: options.clock ?? systemClock, close: () => sqlite.close() };
}

/**
 * Runs `fn` in one BEGIN IMMEDIATE transaction (spec §12): the write lock is taken before the first read, so
 * an open-attempt read-modify-write cannot interleave with another process. `fn` must be synchronous.
 */
export function inTransaction<T>(study: Study, fn: (tx: StudyTx) => T): T {
  return study.db.transaction(fn, { behavior: "immediate" });
}

interface CacheEntry {
  study: Study;
  ino: number;
}

const CACHE_KEY = Symbol.for("algorithms.study.cache");

/** Kept on globalThis: the Vite dev server re-evaluates app.ts and its imports, and must not open a second handle. */
function cache(): Map<string, CacheEntry> {
  const holder = globalThis as typeof globalThis & { [CACHE_KEY]?: Map<string, CacheEntry> };
  holder[CACHE_KEY] ??= new Map();
  return holder[CACHE_KEY];
}

/**
 * The shared handle of `root`'s study database for long-lived processes (the playground server, pnpm watch),
 * or null while it does not exist. A database replaced on disk (a reset and `pnpm study init`) is reopened.
 * Throws StudySchemaOutdatedError like openStudy.
 */
export function cachedStudy(root: string, clock: Clock = systemClock): Study | null {
  const file = dbPath(studyRoot(root));
  const entries = cache();
  const entry = entries.get(file);
  const ino = statSync(file, { throwIfNoEntry: false })?.ino;
  if (entry && entry.ino === ino) return entry.study;
  if (entry) {
    entry.study.close();
    entries.delete(file);
  }
  if (ino === undefined) return null;
  const study = openStudy(root, { clock });
  entries.set(file, { study, ino });
  return study;
}

/** Closes every cached handle (tests, between temp repos). */
export function closeCachedStudies(): void {
  const entries = cache();
  for (const { study } of entries.values()) study.close();
  entries.clear();
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm vitest run study/tests/store.test.ts && pnpm exec tsc --noEmit`
Expected: 9 passed; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add study/clock.ts study/store.ts study/tests/store.test.ts
git commit -m "feat(study): open the study store with an injectable clock and refuse an outdated schema"
```

---

### Task 4: The `state.json` snapshot

**Files:**
- Create: `study/state-file.ts` (no database import: the playground's watcher reads it), `study/state.ts`
- Test: `study/tests/state.test.ts` (create)

**Interfaces:**
- Consumes:
  - `openStudy`, `openMemoryStudy`, `Study` (Task 3);
  - `attempts`, `attemptEvents`, `attemptStats`, `phaseLog`, `AttemptKind`, `Phase` (Task 2).
- Produces: "State" exactly as listed in **Interfaces for Plans B and C**.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/state.test.ts`:

```ts
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { attemptEvents, attempts, phaseLog } from "../schema.ts";
import { readState, statePath, writeStateFile } from "../state-file.ts";
import { refreshState } from "../state.ts";
import { openMemoryStudy, openStudy } from "../store.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";

function studyWithWork() {
  const root = makeTempDir("algo-state-");
  const study = openStudy(root, { migrate: true, clock: fixedClock(T0) });
  const now = study.clock.now();
  const id = study.db.insert(attempts).values({ itemId: "lc-0001", startedAt: now }).returning().get().id;
  study.db.insert(attemptEvents).values({ attemptId: id, at: now, type: "hint", source: "skill" }).run();
  study.db.insert(phaseLog).values({ at: now, phase: "learn", reason: "criteria" }).run();
  return { study, id };
}

describe("state.json", () => {
  it("snapshots the phase and the open attempts, with a version hash and no plan yet", () => {
    const { study } = studyWithWork();
    expect(refreshState(study)).toEqual({ changed: true });
    const state = readState(study.dir!);
    expect(state).toEqual({
      version: expect.stringMatching(/^[0-9a-f]{16}$/),
      phase: "learn",
      inProgress: [{ id: "lc-0001", kind: "new", hints: 1, startedAt: T0 }],
      today: null,
    });
    expect(readFileSync(statePath(study.dir!), "utf8").endsWith("}\n")).toBe(true);
    study.close();
  });

  it("is left alone when nothing it shows changed, and gets a new version when something did", () => {
    const { study, id } = studyWithWork();
    refreshState(study);
    const before = readState(study.dir!)!;
    const stat = statSync(statePath(study.dir!));
    expect(refreshState(study)).toEqual({ changed: false });
    expect(statSync(statePath(study.dir!)).mtimeMs).toBe(stat.mtimeMs);
    study.db.update(attempts).set({ endedAt: study.clock.now(), outcome: "green" }).where(eq(attempts.id, id)).run();
    expect(refreshState(study)).toEqual({ changed: true });
    const after = readState(study.dir!)!;
    expect(after.inProgress).toEqual([]);
    expect(after.version).not.toBe(before.version);
    study.close();
  });

  it("is written through a temp file and a rename, leaving no temp file behind", () => {
    const dir = makeTempDir("algo-state-");
    writeStateFile(dir, { phase: null, inProgress: [], today: null });
    writeStateFile(dir, { phase: "bases", inProgress: [], today: null });
    expect(readdirSync(dir)).toEqual(["state.json"]);
  });

  it("is never written for an in-memory study", () => {
    const study = openMemoryStudy();
    expect(refreshState(study)).toEqual({ changed: false });
    study.close();
  });

  it("reads as null when missing or not a snapshot", () => {
    const dir = makeTempDir("algo-state-");
    expect(readState(dir)).toBeNull();
    writeFileSync(path.join(dir, "state.json"), "{ not json");
    expect(readState(dir)).toBeNull();
    writeFileSync(path.join(dir, "state.json"), "[]");
    expect(readState(dir)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/state.test.ts`
Expected: FAIL. `../state-file.ts` and `../state.ts` do not exist.

- [ ] **Step 3: Write the state file module**

Create `study/state-file.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AttemptKind, Phase } from "./schema.ts";

export const STATE_FILE = "state.json";

/** An open attempt as hooks and watchers see it. `startedAt` is ISO 8601. */
export interface InProgressItem {
  id: string;
  kind: AttemptKind;
  hints: number;
  startedAt: string;
}

/** Today's plan at a glance. Plan B (the scheduler) fills it; Plan A always writes null. */
export interface TodaySummary {
  date: string;
  planned: number;
  done: number;
}

/**
 * .study/state.json (spec §4): a snapshot rewritten after every write, so .claude/hooks/reminder.mjs and the
 * playground's file watcher never need SQLite. `version` is a hash of the other fields: it changes exactly
 * when they do.
 */
export interface StudyState {
  version: string;
  phase: Phase | null;
  inProgress: InProgressItem[];
  today: TodaySummary | null;
}

export type StudySnapshot = Omit<StudyState, "version">;

export function statePath(dir: string): string {
  return path.join(dir, STATE_FILE);
}

export function stateVersion(snapshot: StudySnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0, 16);
}

/** The snapshot on disk, or null when it is missing or is not one. */
export function readState(dir: string): StudyState | null {
  try {
    const value = JSON.parse(readFileSync(statePath(dir), "utf8")) as Partial<StudyState> | null;
    return value && typeof value.version === "string" && Array.isArray(value.inProgress) ? (value as StudyState) : null;
  } catch {
    return null;
  }
}

/** Writes the snapshot through a temp file and a rename (readers never see half a file); skips an identical one. */
export function writeStateFile(dir: string, snapshot: StudySnapshot): { changed: boolean; state: StudyState } {
  const state: StudyState = { version: stateVersion(snapshot), ...snapshot };
  if (readState(dir)?.version === state.version) return { changed: false, state };
  mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${STATE_FILE}.${process.pid}.tmp`);
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, statePath(dir));
  return { changed: true, state };
}
```

- [ ] **Step 4: Write the snapshot builder**

Create `study/state.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests, the type check and the whole suite**

Run: `pnpm vitest run study/tests/state.test.ts && pnpm verify`
Expected: 5 passed. `pnpm verify` is green: Vitest, both `tsc`, `check` with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add study/state-file.ts study/state.ts study/tests/state.test.ts
git commit -m "feat(study): write the state.json snapshot for hooks and watchers"
```

---

## Milestone M2: path indirection and watchers

### Task 5: Solution and history locations under `.study`

**Files:**
- Modify: `runner/src/paths.ts`
- Test: `runner/tests/paths.test.ts`

**Interfaces:**
- Consumes: `studyRoot` (Task 1); `Target`, `Lang` from `runner/src/types.ts`.
- Produces, in `runner/src/paths.ts` (no caller changes yet):
  - `targetRoot(target: Pick<Target, "kind" | "dir">): string`;
  - `studySolutionDir(target: Pick<Target, "id" | "kind" | "dir">): string`;
  - `studySolutionPath(target, lang: Lang): string`;
  - `legacySolutionPath(target: Pick<Target, "dir">, lang: Lang): string`;
  - `historyStamp(at: Date): string`;
  - `historyPath(target, lang, at: Date, options?: { legacy?: boolean }): string`;
  - `studyTsconfig(studyDir: string): string`;
  - `writeStudyTsconfig(studyDir: string, options?: { onlyIfMissing?: boolean }): void`.

- [ ] **Step 1: Write the failing tests**

In `runner/tests/paths.test.ts`, replace the import block with:

```ts
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contentRoot,
  historyPath,
  historyStamp,
  legacySolutionPath,
  REPO_ROOT,
  studyRoot,
  studySolutionDir,
  studySolutionPath,
  targetRoot,
  TSX_TSCONFIG,
  writeStudyTsconfig,
} from "../src/paths.ts";
import type { Target } from "../src/types.ts";
import { removeTemp, tempDir, write } from "./helpers.ts";
```

Then append:

```ts
describe("solution locations", () => {
  const problem: Target = { id: "lc-0001", kind: "problem", dir: "/work/repo/problems/lc-0001-two-sum", title: "Two Sum" };
  const exercise: Target = {
    id: "hash-map/01",
    kind: "exercise",
    dir: "/work/repo/concepts/hash-map/exercises/01-first-repeat",
    title: "First repeat",
  };

  it("finds the content root of a problem and of an exercise", () => {
    expect(targetRoot(problem)).toBe("/work/repo");
    expect(targetRoot(exercise)).toBe("/work/repo");
  });

  it("keeps solutions under .study/solutions by kind and id, and knows the old in-folder place", () => {
    expect(studySolutionDir(problem)).toBe("/work/repo/.study/solutions/problems/lc-0001");
    expect(studySolutionPath(problem, "py")).toBe("/work/repo/.study/solutions/problems/lc-0001/solution.py");
    expect(studySolutionPath(exercise, "ts")).toBe("/work/repo/.study/solutions/exercises/hash-map/01/solution.ts");
    expect(legacySolutionPath(problem, "py")).toBe("/work/repo/problems/lc-0001-two-sum/solution.py");
  });

  it("names history files with a file-name-safe ISO time, and marks migrated ones -legacy", () => {
    const at = new Date("2026-10-04T10:00:00.000Z");
    expect(historyStamp(at)).toBe("2026-10-04T10-00-00-000Z");
    expect(historyPath(problem, "py", at)).toBe("/work/repo/.study/solutions/problems/lc-0001/history/2026-10-04T10-00-00-000Z.py");
    expect(historyPath(exercise, "ts", at, { legacy: true })).toBe(
      "/work/repo/.study/solutions/exercises/hash-map/01/history/2026-10-04T10-00-00-000Z-legacy.ts",
    );
  });

  it("follows ALGO_STUDY", () => {
    vi.stubEnv("ALGO_STUDY", "/progress");
    expect(studySolutionPath(problem, "py")).toBe("/progress/solutions/problems/lc-0001/solution.py");
  });
});

describe(".study/tsconfig.json", () => {
  it("extends the repo's tsconfig, points at its @types, takes solutions and leaves history out; onlyIfMissing keeps an existing one", () => {
    const root = tempDir();
    const dir = path.join(root, ".study");
    writeStudyTsconfig(dir);
    const text = readFileSync(path.join(dir, "tsconfig.json"), "utf8");
    expect(text.startsWith("// Generated")).toBe(true);
    const config = JSON.parse(text.slice(text.indexOf("{")));
    expect(path.resolve(dir, config.extends)).toBe(TSX_TSCONFIG);
    expect(path.resolve(dir, config.compilerOptions.typeRoots[0])).toBe(path.join(REPO_ROOT, "node_modules", "@types"));
    expect(config.include).toEqual(["solutions/**/*.ts"]);
    expect(config.exclude).toEqual(["solutions/**/history"]);
    writeFileSync(path.join(dir, "tsconfig.json"), "{}\n");
    writeStudyTsconfig(dir, { onlyIfMissing: true });
    expect(readFileSync(path.join(dir, "tsconfig.json"), "utf8")).toBe("{}\n");
    removeTemp(root);
  });

  it("lets tsc resolve lc for a solution under .study, and skips history", () => {
    const root = tempDir();
    const dir = path.join(root, ".study");
    write(dir, "solutions/problems/lc-0001/solution.ts", 'import { ListNode } from "lc";\nexport default function f(head: ListNode | null): number {\n  return head ? head.val : 0;\n}\n');
    write(dir, "solutions/problems/lc-0001/history/old.ts", 'const broken: number = "not a number";\nexport default broken;\n');
    writeStudyTsconfig(dir);
    const run = spawnSync(path.join(REPO_ROOT, "node_modules", ".bin", "tsc"), ["-p", path.join(dir, "tsconfig.json")], { encoding: "utf8" });
    expect(run.stdout + run.stderr).toBe("");
    expect(run.status).toBe(0);
    removeTemp(root);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run runner/tests/paths.test.ts`
Expected: FAIL. `targetRoot`, `studySolutionDir` and the others are not exported.

- [ ] **Step 3: Add the locations**

In `runner/src/paths.ts`:

1. Add `import { existsSync, mkdirSync, writeFileSync } from "node:fs";` as the first import, and `import type { Lang, Target } from "./types.ts";` after the `node:url` import.
2. Append:

```ts
type Located = Pick<Target, "id" | "kind" | "dir">;

/** The content root a target lives in: <root>/problems/<folder>, or <root>/concepts/<slug>/exercises/<folder>. */
export function targetRoot(target: Pick<Target, "kind" | "dir">): string {
  return target.kind === "problem" ? path.resolve(target.dir, "..", "..") : path.resolve(target.dir, "..", "..", "..", "..");
}

/** .study/solutions/problems/<id> or .study/solutions/exercises/<concept>/<NN> (spec §3). */
export function studySolutionDir(target: Located): string {
  const solutions = path.join(studyRoot(targetRoot(target)), "solutions");
  return target.kind === "problem" ? path.join(solutions, "problems", target.id) : path.join(solutions, "exercises", ...target.id.split("/"));
}

export function studySolutionPath(target: Located, lang: Lang): string {
  return path.join(studySolutionDir(target), `solution.${lang}`);
}

/** Where solution.<lang> lived before the study coach: inside the content folder. `pnpm study migrate` empties it. */
export function legacySolutionPath(target: Pick<Target, "dir">, lang: Lang): string {
  return path.join(target.dir, `solution.${lang}`);
}

/** An ISO 8601 instant that is safe in file names on every OS: 2026-10-04T10-00-00-000Z. */
export function historyStamp(at: Date): string {
  return at.toISOString().replace(/[:.]/g, "-");
}

/** history/<stamp>[-legacy].<lang> beside the target's solution (spec §3). */
export function historyPath(target: Located, lang: Lang, at: Date, options: { legacy?: boolean } = {}): string {
  return path.join(studySolutionDir(target), "history", `${historyStamp(at)}${options.legacy ? "-legacy" : ""}.${lang}`);
}

/**
 * .study/tsconfig.json, for VS Code: it resolves `import … from "lc"` and @types/node in solutions under .study,
 * even when ALGO_STUDY puts it outside the repo. tsx does not need it (TSX_TSCONFIG), and the root tsc skips .study.
 */
export function studyTsconfig(studyDir: string): string {
  const relative = (file: string): string => path.relative(studyDir, file).split(path.sep).join("/");
  const config = {
    extends: relative(TSX_TSCONFIG),
    compilerOptions: { typeRoots: [relative(path.join(REPO_ROOT, "node_modules", "@types"))] },
    include: ["solutions/**/*.ts"],
    exclude: ["solutions/**/history"],
  };
  return `// Generated by the study tools for VS Code, and rewritten by \`pnpm study init\`. Do not edit.\n${JSON.stringify(config, null, 2)}\n`;
}

export function writeStudyTsconfig(studyDir: string, options: { onlyIfMissing?: boolean } = {}): void {
  const file = path.join(studyDir, "tsconfig.json");
  if (options.onlyIfMissing && existsSync(file)) return;
  mkdirSync(studyDir, { recursive: true });
  writeFileSync(file, studyTsconfig(studyDir));
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm vitest run runner/tests/paths.test.ts && pnpm exec tsc --noEmit`
Expected: 10 passed; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add runner/src/paths.ts runner/tests/paths.test.ts
git commit -m "feat(runner): add the .study solution and history locations"
```

---

### Task 6: Solutions move under `.study`: every caller, both watchers, and the playground's solution events

**Files:**
- Modify: `runner/src/stubs.ts`, `runner/src/run.ts`, `runner/src/custom.ts`, `runner/src/cli.ts`, `runner/src/watcher.ts`
- Modify: `lib/repo.ts`
- Modify: `playground/server/solutions.ts`, `playground/server/targets.ts`, `playground/server/events.ts`
- Modify: `runner/tests/helpers.ts`
- Modify tests: `runner/tests/stubs.test.ts`, `runner/tests/run.test.ts`, `runner/tests/custom.test.ts`, `runner/tests/watcher.test.ts`, `playground/tests/server/solutions.test.ts`, `playground/tests/server/events.test.ts`, `scripts/tests/render.test.ts`
- Modify e2e: `playground/e2e/fixture.ts`, `playground/e2e/live.spec.ts`, `playground/e2e/work.spec.ts`, `playground/e2e/restart.spec.ts`

**Interfaces:**
- Consumes: Task 5's helpers; `studyRoot` (Task 1).
- Produces:
  - `solutionPath(target: Target, lang: Lang): string` replaces `solutionPath(dir, lang)` (spec §3). It returns the in-folder `solution.<lang>` while one exists, else `studySolutionPath(target, lang)`.
  - `ensureSolution(target: Target, cf: CaseFile, lang: Lang): { path: string; created: boolean }` creates the stub under `.study` (and `.study/tsconfig.json` if missing).
  - `isInProgress(entry: ProblemEntry | ExerciseEntry): boolean` (legacy rule, both locations).
  - `classify(root, file, study = studyRoot(root))` and `ignoredPath(root, study, file)` in `playground/server/events.ts`.
  - `putSolution(target, lang, code)` in `runner/tests/helpers.ts`; `makeProblem` routes `solution.*` keys to `.study`.
  - `SOLUTION_PY` in `playground/e2e/fixture.ts`.

- [ ] **Step 1: Point the test helper at `.study`**

In `runner/tests/helpers.ts`:
- change the `node:fs` import to `import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";`;
- add `import { studySolutionPath } from "../src/paths.ts";` (merge with the existing `REPO_ROOT` import);
- change the types import to `import type { HarnessRequest, Lang, Target } from "../src/types.ts";`;
- replace `makeProblem` with:

```ts
/**
 * Creates problems/<folder>/ with a README, cases.json and any extra files (stress.ts…). solution.py / solution.ts
 * keys go where the runner keeps solutions: .study/solutions/problems/<id>/ (spec §3).
 */
export function makeProblem(
  root: string,
  folder: string,
  cases: Record<string, unknown>,
  files: Record<string, string> = {},
): Target {
  const dir = path.join(root, "problems", folder);
  write(root, `problems/${folder}/README.md`, `---\ntitle: ${folder}\n---\n# ${folder}\n`);
  write(root, `problems/${folder}/cases.json`, JSON.stringify(cases, null, 2));
  const target: Target = { id: problemIdFromFolder(folder), kind: "problem", dir, title: folder };
  for (const [name, content] of Object.entries(files)) {
    const lang = /^solution\.(py|ts)$/.exec(name)?.[1] as Lang | undefined;
    if (lang) putSolution(target, lang, content);
    else write(dir, name, content);
  }
  return target;
}

/** Writes a target's solution where the runner looks for it (.study/solutions/…). */
export function putSolution(target: Target, lang: Lang, code: string): string {
  const file = studySolutionPath(target, lang);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, code);
  return file;
}
```

- [ ] **Step 2: Write the failing tests**

1. In `runner/tests/stubs.test.ts`:
   - change the first import line to `import { existsSync, readFileSync, writeFileSync } from "node:fs";`;
   - import `ensureSolution, pyType, renderStub, solutionPath, tsType` from `../src/stubs.ts`;
   - change the types import to `import type { CaseFile, Target } from "../src/types.ts";`;
   - replace the whole `describe("ensureSolution", …)` block with:

```ts
describe("ensureSolution and solutionPath", () => {
  it("creates the stub under .study once, never overwrites it, and writes .study/tsconfig.json with it", () => {
    const target: Target = { id: "lc-0301", kind: "problem", dir: path.join(dir, "problems", "lc-0301-stub"), title: "Stub" };
    const first = ensureSolution(target, base, "py");
    expect(first).toEqual({ path: path.join(dir, ".study", "solutions", "problems", "lc-0301", "solution.py"), created: true });
    expect(readFileSync(first.path, "utf8")).toBe(renderStub(base, "py"));
    expect(existsSync(path.join(dir, ".study", "tsconfig.json"))).toBe(true);
    writeFileSync(first.path, "# my work\n");
    expect(ensureSolution(target, { ...base, entry: "other" }, "py")).toEqual({ path: first.path, created: false });
    expect(readFileSync(first.path, "utf8")).toBe("# my work\n");
  });

  it("keeps using a solution that still sits in the content folder (before pnpm study migrate)", () => {
    const target: Target = { id: "lc-0302", kind: "problem", dir: path.join(dir, "problems", "lc-0302-legacy"), title: "Legacy" };
    const legacy = write(target.dir, "solution.ts", "// the user's work\n");
    expect(solutionPath(target, "ts")).toBe(legacy);
    expect(ensureSolution(target, base, "ts")).toEqual({ path: legacy, created: false });
    expect(existsSync(path.join(dir, ".study", "solutions", "problems", "lc-0302"))).toBe(false);
    expect(solutionPath(target, "py")).toBe(path.join(dir, ".study", "solutions", "problems", "lc-0302", "solution.py"));
  });

  it("puts an exercise's solution under .study/solutions/exercises/<concept>/<NN>", () => {
    const target: Target = {
      id: "hash-map/01",
      kind: "exercise",
      dir: path.join(dir, "concepts", "hash-map", "exercises", "01-first-repeat"),
      title: "First repeat",
    };
    expect(ensureSolution(target, base, "py").path).toBe(path.join(dir, ".study", "solutions", "exercises", "hash-map", "01", "solution.py"));
  });
});
```

2. In `runner/tests/run.test.ts`:
   - import `write` too from `./helpers.ts`, and add `import { studySolutionPath } from "../src/paths.ts";`;
   - in the first test, change the `result.solution` line to:

```ts
      expect(result.solution).toBe(`.study/solutions/problems/lc-0001/solution.${lang}`);
```

   - replace the test `"creates a stub when the solution file is missing"` with these two:

```ts
  it("creates a stub under .study when the solution file is missing, never in the content folder", async () => {
    const target = makeProblem(root, "lc-0009-stub", SUM);
    const result = await runTarget(target, "py", { root });
    expect(readFileSync(studySolutionPath(target, "py"), "utf8")).toContain("def solve(self, nums: list[int]) -> int:");
    expect(existsSync(path.join(target.dir, "solution.py"))).toBe(false);
    expect(result.solution).toBe(".study/solutions/problems/lc-0009/solution.py");
    expect(result.examples.cases[0].status).toBe("error");
    expect(result.examples.cases[0].error?.message).toMatch(/NotImplementedError/);
  });

  it("keeps using a solution that still sits in the content folder (before pnpm study migrate)", async () => {
    const target = makeProblem(root, "lc-0014-legacy", SUM);
    write(target.dir, "solution.py", PY.correct);
    const result = await runTarget(target, "py", { root });
    expect(result.green).toBe(true);
    expect(result.solution).toBe("problems/lc-0014-legacy/solution.py");
    expect(existsSync(studySolutionPath(target, "py"))).toBe(false);
  });
```

3. In `runner/tests/custom.test.ts`:
   - import `putSolution` from `./helpers.ts` and `studySolutionPath` from `../src/paths.ts`;
   - replace both `write(target.dir, "solution.py", …)` calls with `putSolution(target, "py", …)`, keeping the same code strings;
   - replace `expect(existsSync(path.join(target.dir, "solution.py"))).toBe(false);` with:

```ts
    expect(existsSync(studySolutionPath(target, "py"))).toBe(false);
    expect(existsSync(path.join(target.dir, "solution.py"))).toBe(false);
```

4. In `runner/tests/watcher.test.ts`, import `studySolutionPath` from `../src/paths.ts`, then append inside `describe("watchTarget", …)`:

```ts
  it("reruns on a save of the solution under .study and on a change to cases.json: two folders, two watchers", async () => {
    const twice = { entry: "solve", params: [{ name: "n", type: "int" }], returns: "int", examples: [{ input: [2], expected: 4 }], hidden: [] };
    const target = makeProblem(root, "lc-0005-two-folders", twice, {
      "solution.py": "class Solution:\n    def solve(self, n: int) -> int:\n        return n\n",
    });
    const screens: string[] = [];
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      if (String(chunk).startsWith("\x1b[2J")) screens.push(String(chunk));
      return true;
    });
    try {
      const watcher = await watchTarget(target, "py", { open: false, root });
      await watcher.ready;
      expect(screens.at(-1)).toContain("watching .study/solutions/problems/lc-0005/solution.py");
      writeFileSync(studySolutionPath(target, "py"), "class Solution:\n    def solve(self, n: int) -> int:\n        return n * 2\n");
      await vi.waitFor(() => expect(screens.at(-1)).toContain("GREEN"), { timeout: 15_000, interval: 100 });
      const seen = screens.length;
      writeFileSync(path.join(target.dir, "cases.json"), JSON.stringify({ ...twice, examples: [{ input: [3], expected: 6 }] }, null, 2));
      await vi.waitFor(() => expect(screens.length).toBeGreaterThan(seen), { timeout: 15_000, interval: 100 });
      watcher.close();
    } finally {
      stdout.mockRestore();
    }
  });
```

5. In `playground/tests/server/solutions.test.ts`:
   - change the first import to `import { existsSync, readFileSync, writeFileSync } from "node:fs";`;
   - change the constant to `const SOLUTION = ".study/solutions/problems/lc-0001/solution.py";`;
   - append inside `describe("GET/PUT /api/solution", …)`:

```ts
  it("keeps reading and writing a solution that still sits in the content folder (before pnpm study migrate)", async () => {
    const root = makeRepo();
    put(root, "problems/lc-0001-two-sum/solution.py", "# the user's work\n");
    const app = createApp({ root });
    const read = await json<SolutionData>(await call(app, "/api/solution?id=lc-0001&lang=py"));
    expect(read.code).toBe("# the user's work\n");
    const saved = await call(app, "/api/solution", { method: "PUT", json: { id: "lc-0001", lang: "py", code: PY_SUM, baseVersion: read.version } });
    expect(saved.status).toBe(200);
    expect(readFileSync(path.join(root, "problems/lc-0001-two-sum/solution.py"), "utf8")).toBe(PY_SUM);
    expect(existsSync(path.join(root, SOLUTION))).toBe(false);
  });
```

6. In `playground/tests/server/events.test.ts`, import `{ classify, ignoredPath }` from `../../server/events.ts`. Append to `describe("classify", …)`:

```ts
  it("maps the user's solutions under the study root to solution events, and ignores the rest of it", () => {
    expect(classify(root, "/repo/.study/solutions/problems/lc-0001/solution.py")).toEqual({
      kind: "solution",
      target: "lc-0001",
      lang: "py",
      version: contentVersion(""),
    });
    expect(classify(root, "/repo/.study/solutions/exercises/hash-map/01/solution.ts")).toMatchObject({ kind: "solution", target: "hash-map/01", lang: "ts" });
    expect(classify(root, "/progress/solutions/problems/lc-0001/solution.py", "/progress")).toMatchObject({ kind: "solution", target: "lc-0001" });
    for (const file of ["/repo/.study/solutions/problems/lc-0001/history/2026-10-04T10-00-00-000Z.py", "/repo/.study/study.db", "/repo/.study/tsconfig.json"]) {
      expect(classify(root, file), file).toBeNull();
    }
  });
```

   Add a new `describe` after it:

```ts
describe("ignoredPath", () => {
  it("lets chokidar into problems/, concepts/ and the solutions under the study root, and nowhere else", () => {
    const kept = ["/repo", "/repo/problems/lc-0001-two-sum/README.md", "/repo/.study", "/repo/.study/solutions", "/repo/.study/solutions/problems/lc-0001/solution.py"];
    const skipped = [
      "/repo/runner/src/run.ts",
      "/repo/.study/study.db",
      "/repo/.study/study.db-wal",
      "/repo/.study/solutions/problems/lc-0001/history",
      "/repo/.study/exports/progress.json",
      "/repo/problems/lc-0001-two-sum/__pycache__",
    ];
    for (const file of kept) expect(ignoredPath("/repo", "/repo/.study", file), file).toBe(false);
    for (const file of skipped) expect(ignoredPath("/repo", "/repo/.study", file), file).toBe(true);
  });
});
```

   Append to `describe("GET /api/events", …)`:

```ts
  it("reports the user's solutions under .study, even when .study appears after the page opened", async () => {
    const root = makeRepo();
    const events = await openEvents(createApp({ root }));
    try {
      expect((await events.next()).event).toBe("ready");
      mkdirSync(path.join(root, ".study/solutions/problems/lc-0001"), { recursive: true });
      writeFileSync(path.join(root, ".study/solutions/problems/lc-0001/solution.py"), PY_SUM);
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "solution", target: "lc-0001", lang: "py", version: contentVersion(PY_SUM) });
    } finally {
      await events.close();
    }
  });
```

7. In `scripts/tests/render.test.ts`, inside the `isInProgress` test, after the `lc-0071` lines add:

```ts
    put(root, "problems/lc-0072-study/README.md", readme("lc-0072", "Study", ["dp-2d"], "todo"));
    put(root, ".study/solutions/problems/lc-0072/solution.py", "class Solution:\n    pass\n");
```

   and change the expectation to `{ "lc-0001": false, "lc-0020": true, "lc-0070": false, "lc-0071": true, "lc-0072": true }`.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run runner/tests/stubs.test.ts runner/tests/run.test.ts runner/tests/custom.test.ts runner/tests/watcher.test.ts playground/tests/server/solutions.test.ts playground/tests/server/events.test.ts scripts/tests/render.test.ts`

Expected: FAIL. `ensureSolution` still takes a folder; stubs land in the content folder; `ignoredPath` is not exported; `.study` writes raise no event.

- [ ] **Step 4: Switch the stub helpers to targets**

In `runner/src/stubs.ts`:
- change the first import to `import { existsSync, mkdirSync, writeFileSync } from "node:fs";`;
- add `import { legacySolutionPath, studyRoot, studySolutionPath, targetRoot, writeStudyTsconfig } from "./paths.ts";`;
- change the types import to `import type { CaseFile, Lang, Target } from "./types.ts";`;
- replace `solutionPath` and `ensureSolution` with:

```ts
/**
 * The solution file of a target in `lang` (spec §3): .study/solutions/…/solution.<lang>.
 * LEGACY: while a solution.<lang> still sits in the content folder (before `pnpm study migrate`), that file is
 * the solution, so the runner, the watcher and the playground never hide work the user already has. Remove this
 * fallback once the user has migrated (`pnpm check` rejects such files from then on).
 */
export function solutionPath(target: Target, lang: Lang): string {
  const legacy = legacySolutionPath(target, lang);
  return existsSync(legacy) ? legacy : studySolutionPath(target, lang);
}

/** Creates the solution from the signature when it does not exist yet (and .study/tsconfig.json with it). Never overwrites. */
export function ensureSolution(target: Target, cf: CaseFile, lang: Lang): { path: string; created: boolean } {
  const file = solutionPath(target, lang);
  if (existsSync(file)) return { path: file, created: false };
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, renderStub(cf, lang), { flag: "wx" });
  writeStudyTsconfig(studyRoot(targetRoot(target)), { onlyIfMissing: true });
  return { path: file, created: true };
}
```

- [ ] **Step 5: Update the runner's callers**

- `runner/src/run.ts`: `const solution = ensureSolution(target, cf, lang).path;`
- `runner/src/custom.ts`: `const solutionPath = ensureSolution(target, cf, lang).path;`
- `runner/src/cli.ts`, in `testCommand`: `LANGS.filter((l) => existsSync(solutionPath(target, l)))`
- `runner/src/watcher.ts`:
  - change the first line of `watchTarget` to `const solution = ensureSolution(target, loadCaseFile(target.dir), lang).path;`;
  - add this helper above `watchTarget`:

```ts
/** One watcher made of several: ready when all of them are, closed together. */
function combine(watchers: Watcher[]): Watcher {
  return {
    ready: Promise.all(watchers.map((watcher) => watcher.ready)).then(() => undefined),
    close: () => {
      for (const watcher of watchers) watcher.close();
    },
  };
}
```

  Replace the `return watchFiles(…)` line at the end of `watchTarget` with:

```ts
  // Two folders (spec §10): the problem's own files, and the solution under .study. For a solution still in the
  // content folder both watchers look at the same folder, each for its own files.
  return combine([
    watchFiles(target.dir, ["cases.json", "stress.ts"], () => void cycle()),
    watchFiles(path.dirname(solution), [path.basename(solution)], () => void cycle()),
  ]);
```

- [ ] **Step 6: Update the legacy in-progress rule**

In `lib/repo.ts`, add `import { solutionPath } from "../runner/src/stubs.ts";` and `import { LANGS } from "../runner/src/types.ts";` after the existing imports. Then replace `isInProgress` with:

```ts
/**
 * In progress by the frontmatter of READMEs that predate the study coach: status solving, or todo with a
 * solution file (created by pnpm watch or the playground) in either place. The reminder hook
 * (.claude/hooks/reminder.mjs) applies the same rule in plain JavaScript. Used only until `pnpm study migrate`.
 */
export function isInProgress(entry: ProblemEntry | ExerciseEntry): boolean {
  if (entry.data.status === "solving") return true;
  const target = { id: entry.folderId, kind: entry.kind, dir: entry.dir, title: entry.folder };
  return entry.data.status === "todo" && LANGS.some((lang) => existsSync(solutionPath(target, lang)));
}
```

- [ ] **Step 7: Update the playground server**

1. `playground/server/solutions.ts`:
   - change the `node:fs` import to `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";`;
   - add `import path from "node:path";`;
   - in `readSolution`, replace the first two lines with:

```ts
  const file = solutionPath(target, lang);
  if (!existsSync(file)) ensureSolution(target, loadCaseFile(target.dir), lang);
```

   In `writeSolution`, change the first line to `const file = solutionPath(target, lang);`, and right before `writeFileSync(file, code);` add `mkdirSync(path.dirname(file), { recursive: true });`.
2. `playground/server/targets.ts`: change the `solutions:` line to:

```ts
    solutions: { py: existsSync(solutionPath(target, "py")), ts: existsSync(solutionPath(target, "ts")) },
```

3. `playground/server/events.ts`:
   - add `import { studyRoot } from "../../runner/src/paths.ts";`;
   - replace `classify` and the class's `start` / `changed` with the code below, and keep the rest of the file.

```ts
/** `file`'s path segments under `dir` ([] for `dir` itself), or null when it is not inside `dir`. */
function segmentsUnder(dir: string, file: string): string[] | null {
  const rel = path.relative(dir, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel === "" ? [] : rel.split(path.sep);
}

function solutionEvent(target: string, name: string, file: string): RepoEvent | null {
  const lang = /^solution\.(py|ts)$/.exec(name)?.[1];
  if (lang !== "py" && lang !== "ts") return null;
  return { kind: "solution", target, lang, version: contentVersion(existsSync(file) ? readFileSync(file, "utf8") : "") };
}

/** Under the study root: solutions/problems/<id>/solution.<lang> and solutions/exercises/<concept>/<NN>/solution.<lang>. */
function classifyStudy(parts: string[], file: string): RepoEvent | null {
  if (parts[0] !== "solutions") return null;
  if (parts[1] === "problems" && parts.length === 4) return solutionEvent(parts[2], parts[3], file);
  if (parts[1] === "exercises" && parts.length === 5) return solutionEvent(`${parts[2]}/${parts[3]}`, parts[4], file);
  return null;
}

/** What a changed file means for the app, or null when the app does not show it. */
export function classify(root: string, file: string, study: string = studyRoot(root)): RepoEvent | null {
  const inStudy = segmentsUnder(study, file);
  if (inStudy !== null) return classifyStudy(inStudy, file);
  const parts = path.relative(root, file).split(path.sep);
  let target: string | undefined;
  let concept: string | undefined;
  let name: string;
  if (parts[0] === "problems" && parts.length === 3) {
    target = problemIdFromFolder(parts[1]);
    name = parts[2];
  } else if (parts[0] === "concepts" && parts.length === 3) {
    concept = parts[1];
    name = parts[2];
  } else if (parts[0] === "concepts" && parts.length === 5 && parts[2] === "exercises") {
    target = exerciseIdFromFolder(parts[1], parts[3]);
    name = parts[4];
  } else {
    return null;
  }
  if (name === "README.md") return target ? { kind: "readme", target } : { kind: "readme", concept };
  if (!target) return null;
  if (name === "cases.json") return { kind: "cases", target };
  if (name === "stress.ts") return { kind: "stress", target };
  return solutionEvent(target, name, file); // LEGACY: solution.<lang> still in the content folder
}

/** Study-root paths the app shows, or must walk into to reach them: solutions/, without history/. */
function keptInStudy(parts: string[]): boolean {
  if (parts.length === 0) return true;
  if (parts[0] !== "solutions") return false;
  return !parts.some((part) => part === "history" || IGNORED_PART.test(part));
}

/** chokidar's filter: problems/ and concepts/ under the content root, and what keptInStudy keeps under the study root. */
export function ignoredPath(root: string, study: string, file: string): boolean {
  const inStudy = segmentsUnder(study, file);
  if (inStudy !== null) return !keptInStudy(inStudy);
  const rel = path.relative(root, file);
  if (rel === "") return false;
  const top = rel.split(path.sep)[0];
  return (top !== "problems" && top !== "concepts") || IGNORED_PART.test(rel);
}
```

   In `EventHub`, replace `start()` and `changed()` with the code below. Keep the existing long comment about polling at the top of `start()`, unchanged.

```ts
  private start(): void {
    // (the existing comment about watching the root and polling stays here, unchanged)
    // The study root is usually <root>/.study and is watched with the root. An ALGO_STUDY elsewhere is watched on
    // its own when it exists: chokidar 5 never reports a watched path created later, so restart pnpm play after
    // `pnpm study init` in that case.
    const study = studyRoot(this.root);
    const paths = segmentsUnder(this.root, study) === null && existsSync(study) ? [this.root, study] : [this.root];
    const watcher = watch(paths, {
      ignoreInitial: true,
      alwaysStat: true,
      usePolling: true,
      interval: 300,
      ignored: (file) => ignoredPath(this.root, study, file),
    });
    this.watcher = watcher;
    // chokidar only emits "ready" once every discovered path's poll timer is already registered, so the
    // extra loop turns below are not load-bearing; they are a small inherited margin, kept for parity
    // with the non-polling form of this wait.
    this.ready = new Promise((resolve) => watcher.once("ready", () => setImmediate(() => setImmediate(resolve))));
    watcher.on("all", (kind, file, stats) => this.changed(kind, file, stats, study));
  }

  private stop(): void {
    void this.watcher?.close();
    this.watcher = null;
    this.seen.clear();
  }

  private changed(kind: string, file: string, stats: Stats | undefined, study: string): void {
    const version = kind === "unlink" ? "missing" : stats ? `${stats.size}:${stats.mtimeMs}` : `${Date.now()}`;
    if (this.seen.get(file) === version) return;
    this.seen.set(file, version);
    const event = classify(this.root, file, study);
    if (event) for (const listener of this.listeners) listener(event);
  }
```

- [ ] **Step 8: Point the e2e tests at `.study`**

1. In `playground/e2e/fixture.ts`, after the `repoFile` line add:

```ts
/** Where the playground keeps Two Sum's Python solution (spec §3: .study/solutions/problems/<id>/). */
export const SOLUTION_PY = repoFile(".study/solutions/problems/lc-0001/solution.py");
```

   and replace the first line of `resetRepo` with:

```ts
  for (const lang of ["py", "ts"]) {
    rmSync(repoFile(`problems/lc-0001-two-sum/solution.${lang}`), { force: true });
    rmSync(repoFile(`.study/solutions/problems/lc-0001/solution.${lang}`), { force: true });
  }
```

2. In `playground/e2e/live.spec.ts` and `playground/e2e/restart.spec.ts`:
   - import `SOLUTION_PY` from `./fixture.ts`;
   - replace `const SOLUTION = repoFile("problems/lc-0001-two-sum/solution.py");` with `const SOLUTION = SOLUTION_PY;`;
   - drop `repoFile` from the import if it becomes unused (`restart.spec.ts` keeps `E2E_ROOT`).
3. In `playground/e2e/work.spec.ts`, import `SOLUTION_PY` and replace both `repoFile("problems/lc-0001-two-sum/solution.py")` with `SOLUTION_PY`. Drop `repoFile` from the import if unused.

- [ ] **Step 9: Run everything**

Run: `pnpm verify && pnpm e2e`

Expected:
- Vitest green, including every test from Step 2;
- both `tsc` runs clean;
- `check` with 0 errors;
- every e2e test passes.

`pnpm exec tsc -p playground` is part of `verify`.

- [ ] **Step 10: Commit**

```bash
git add runner/src/stubs.ts runner/src/run.ts runner/src/custom.ts runner/src/cli.ts runner/src/watcher.ts lib/repo.ts \
  playground/server/solutions.ts playground/server/targets.ts playground/server/events.ts \
  runner/tests/helpers.ts runner/tests/stubs.test.ts runner/tests/run.test.ts runner/tests/custom.test.ts runner/tests/watcher.test.ts \
  playground/tests/server/solutions.test.ts playground/tests/server/events.test.ts scripts/tests/render.test.ts \
  playground/e2e/fixture.ts playground/e2e/live.spec.ts playground/e2e/work.spec.ts playground/e2e/restart.spec.ts
git commit -m "feat: keep solutions under .study/solutions and watch them there, falling back to the old in-folder file while it exists"
```

---

### Task 7: The `progress` event from `state.json`

**Files:**
- Modify: `playground/server/types.ts`, `playground/server/events.ts`
- Modify: `playground/web/events.tsx`, `playground/web/api.ts`
- Test: `playground/tests/server/events.test.ts`, `playground/tests/web/events.test.tsx`

**Interfaces:**
- Consumes: `STATE_FILE`, `readState`, `writeStateFile` (Task 4); `classify`, `ignoredPath` (Task 6).
- Produces:
  - `RepoEvent` gains `{ kind: "progress"; version: string }`. It is sent once per new `state.json` version, with `"missing"` when the file is removed.
  - The web refetches the home, target and concept queries on `progress`.
  - `keys.targets = ["target"]` and `keys.concepts = ["concept"]` in `playground/web/api.ts`.

- [ ] **Step 1: Write the failing tests**

In `playground/tests/server/events.test.ts`, add `import { writeStateFile } from "../../../study/state-file.ts";`.

Append to `describe("classify", …)`:

```ts
  it("turns state.json into a progress event carrying its version", () => {
    expect(classify(root, "/repo/.study/state.json")).toEqual({ kind: "progress", version: "missing" });
    expect(ignoredPath("/repo", "/repo/.study", "/repo/.study/state.json")).toBe(false);
    expect(ignoredPath("/repo", "/repo/.study", "/repo/.study/.state.json.123.tmp")).toBe(true);
  });
```

Append to `describe("GET /api/events", …)`:

```ts
  it("sends one progress event per new state.json snapshot", async () => {
    const root = makeRepo();
    const events = await openEvents(createApp({ root }));
    try {
      expect((await events.next()).event).toBe("ready");
      // Phases a fresh or seeded store never has, so both writes are real changes.
      const first = writeStateFile(path.join(root, ".study"), { phase: "expand", inProgress: [], today: null }).state;
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "progress", version: first.version });
      const second = writeStateFile(path.join(root, ".study"), { phase: "pro", inProgress: [], today: null }).state;
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "progress", version: second.version });
    } finally {
      await events.close();
    }
  });
```

In `playground/tests/web/events.test.tsx`, append inside `describe("EventsProvider", …)`:

```ts
  it("refetches what the page shows when recorded progress changes", async () => {
    renderApp();
    await settle();
    act(() => FakeEventSource.latest.ready());
    await settle();
    const before = fetches;
    const event: RepoEvent = { kind: "progress", version: "v2" };
    act(() => FakeEventSource.latest.send(event));
    await settle();
    expect(fetches).toBe(before + 1);
    expect(heard).toEqual([event]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run playground/tests/server/events.test.ts playground/tests/web/events.test.tsx`
Expected: FAIL. `RepoEvent` has no `progress` kind, `state.json` is ignored, and the web does not refetch.

- [ ] **Step 3: Add the event**

1. `playground/server/types.ts`: add a member to `RepoEvent`:

```ts
  /** .study/state.json has a new version (study coach spec §10): recorded progress changed. */
  | { kind: "progress"; version: string }
```

2. `playground/server/events.ts`:
   - add `import { readState, STATE_FILE } from "../../study/state-file.ts";`;
   - change `classifyStudy` to take the study root and handle the snapshot:

```ts
/** Under the study root: state.json, solutions/problems/<id>/solution.<lang> and solutions/exercises/<concept>/<NN>/solution.<lang>. */
function classifyStudy(study: string, parts: string[], file: string): RepoEvent | null {
  if (parts.length === 1 && parts[0] === STATE_FILE) return { kind: "progress", version: readState(study)?.version ?? "missing" };
  if (parts[0] !== "solutions") return null;
  if (parts[1] === "problems" && parts.length === 4) return solutionEvent(parts[2], parts[3], file);
  if (parts[1] === "exercises" && parts.length === 5) return solutionEvent(`${parts[2]}/${parts[3]}`, parts[4], file);
  return null;
}
```

   In `classify`, change its first `return` to `return classifyStudy(study, inStudy, file);`. In `keptInStudy`, add right after the `length === 0` line:

```ts
  if (parts.length === 1 && parts[0] === STATE_FILE) return true;
```

   In `EventHub`, add a field `private lastProgress: string | null = null;`, reset it in `stop()` (`this.lastProgress = null;`), and in `changed()` replace the last line with:

```ts
    if (!event) return;
    if (event.kind === "progress") {
      if (event.version === this.lastProgress) return; // a rewrite with the same snapshot is not news
      this.lastProgress = event.version;
    }
    for (const listener of this.listeners) listener(event);
```

3. `playground/web/api.ts`: in `keys`, add:

```ts
  /** Every target query (prefix). */
  targets: ["target"] as const,
  /** Every concept query (prefix). */
  concepts: ["concept"] as const,
```

4. `playground/web/events.tsx`: in `current.onmessage`, add a branch before the listener loop:

```ts
        } else if (event.kind === "progress") {
          // Recorded progress changed (.study/state.json): statuses and hint counts on any page may be stale.
          void queryClient.invalidateQueries({ queryKey: keys.home });
          void queryClient.invalidateQueries({ queryKey: keys.targets });
          void queryClient.invalidateQueries({ queryKey: keys.concepts });
        }
```

- [ ] **Step 4: Run everything**

Run: `pnpm verify && pnpm e2e`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add playground/server/types.ts playground/server/events.ts playground/web/api.ts playground/web/events.tsx playground/tests/server/events.test.ts playground/tests/web/events.test.tsx
git commit -m "feat(playground): send a progress event when .study/state.json changes and refetch on it"
```

---

### Task 8: Hooks and settings for `.study`

**Files:**
- Modify: `.claude/hooks/guard-solution.mjs`, `.claude/hooks/reminder.mjs`, `.claude/settings.json`
- Test: `scripts/tests/hooks.test.ts`

**Interfaces:**
- Consumes: the `.study` layout (spec §3); `ALGO_STUDY`.
- Produces:
  - **The guard denies Claude:**
    - any Edit/Write/MultiEdit/NotebookEdit under `<project>/.study/` or under `$ALGO_STUDY`;
    - shell writes, moves and deletes there;
    - `sqlite3 … study.db`;
    - `study migrate|start|pause|resume` and `study phase set`, in every launcher form;
    - the playground routes `/api/study/start|pause|resume`.
  - **The guard still allows:**
    - reading `.study` (`cat`, `ls`, `cp` out of it);
    - `pnpm -s study status|record|init|phase|curriculum`, including `study curriculum set <preset>` (the coach runs it only on the user's explicit request, spec §6.5; the switch moves no files and is logged);
    - `pnpm -s today …`.
  - **Settings** allow `Bash(pnpm -s study:*)` and `Bash(pnpm -s today:*)`.
  - **The reminder's legacy scan** also counts a `todo` item whose solution sits under `.study/solutions/…`.

- [ ] **Step 1: Write the failing tests**

In `scripts/tests/hooks.test.ts`, give `hook` an `env` parameter:

```ts
function hook(name: string, input: unknown, projectDir: string, env: Record<string, string> = {}) {
  const run = spawnSync(process.execPath, [path.join(HOOKS, name)], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...env },
    encoding: "utf8",
  });
  expect(run.status).toBe(0);
  return run.stdout ? JSON.parse(run.stdout) : null;
}
```

Append a new block after `describe("guard-solution hook", …)`:

```ts
describe("guard-solution hook: the study folder", () => {
  it("denies edits and writes anywhere under .study, and under ALGO_STUDY when it is set", () => {
    for (const file of [
      `${PROJECT}/.study/solutions/problems/lc-0001/solution.py`,
      ".study/solutions/exercises/hash-map/01/solution.ts",
      `${PROJECT}/.study/solutions/problems/lc-0001/history/2026-10-04T10-00-00-000Z.py`,
      `${PROJECT}/.study/study.db`,
      `${PROJECT}/.study/state.json`,
      `${PROJECT}/.study/explanations/hash-map.md`,
    ]) {
      expect(decision({ tool_name: "Write", tool_input: { file_path: file } }), file).toBe("deny");
    }
    expect(decision({ tool_name: "Edit", tool_input: { file_path: `${PROJECT}/study/schema.ts` } })).toBe("allow");
    expect(decision({ tool_name: "Edit", tool_input: { file_path: `${PROJECT}/docs/.study-notes.md` } })).toBe("allow");
    const elsewhere = hook(
      "guard-solution.mjs",
      { tool_name: "Write", tool_input: { file_path: "/progress/solutions/problems/lc-0001/solution.py" } },
      PROJECT,
      { ALGO_STUDY: "/progress" },
    );
    expect(elsewhere.hookSpecificOutput.permissionDecision).toBe("deny");
  });

  it("denies shell commands that write, move or delete under .study, or open the database", () => {
    expectBash(
      [
        "rm -rf .study",
        "rm .study/study.db",
        "rm -f .stud*/study.db-wal",
        "echo '{}' > .study/state.json",
        "mv .study/solutions/problems/lc-0001/solution.py /tmp/",
        "cp /tmp/ref.py .study/solutions/problems/lc-0001/solution.py",
        "sed -i '' 's/a/b/' .study/explanations/hash-map.md",
        "find . -path './.study/*' -delete",
        "git clean -fdX .study",
        `sqlite3 .study/study.db "DELETE FROM attempts"`,
        `python3 -c "open('.study/state.json', 'w')"`,
      ],
      "deny",
    );
    expect(bashReason("rm -rf .study")).toContain(".study/ holds the user's solutions");
    expect(bashReason(`sqlite3 .study/study.db "select 1"`)).toContain("never open the progress database");
  });

  it("denies the study commands that belong to the user, in every launcher form", () => {
    expectBash(
      [
        "pnpm study migrate",
        "pnpm -s study migrate --dry-run",
        "pnpm study start lc-0001",
        "pnpm -s study pause",
        "pnpm study resume",
        "pnpm study phase set learn",
        "pnpm run study start lc-0001",
        "pnpm exec tsx study/cli.ts migrate",
        "npx tsx study/cli.ts start lc-0001",
        "node --import tsx study/cli.ts pause",
      ],
      "deny",
    );
    expect(bashReason("pnpm study migrate")).toContain("for the user only");
  });

  it("denies the playground routes that start or pause study time", () => {
    expectBash(
      [
        "curl -X POST http://127.0.0.1:4173/api/study/start/lc-0001",
        "curl -X POST http://127.0.0.1:4173/api/study/pause",
        `node -e "fetch('http://127.0.0.1:4173/api/study/resume', { method: 'POST' })"`,
      ],
      "deny",
    );
  });

  it("still lets Claude read progress and use the study CLI's other commands", () => {
    expectBash(
      [
        "cat .study/state.json",
        "ls .study/solutions/problems",
        "cp -r .study/solutions /tmp/backup",
        "pnpm -s study status lc-0001 --json",
        "pnpm -s study status --json",
        "pnpm -s study record hint lc-0001",
        "pnpm -s study record complexity lc-0001 --time 'O(n)' --space 'O(1)' --optimal",
        "pnpm -s study phase",
        "pnpm -s study curriculum",
        "pnpm -s study curriculum set grind-169",
        "pnpm -s study init",
        "pnpm -s today --json",
        "echo hi > notes.study.md",
      ],
      "allow",
    );
  });
});
```

Append to `describe("reminder hook", …)`:

```ts
  it("counts a todo item as in progress when its solution sits under .study", () => {
    const root = makeTempDir("algo-hook-");
    put(root, "problems/lc-0070-climbing-stairs/README.md", "---\nid: lc-0070\nstatus: todo\nhints: 0\n---\n");
    put(root, ".study/solutions/problems/lc-0070/solution.py", "class Solution:\n    pass\n");
    put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", "---\nid: hash-map/01\nstatus: todo\nhints: 1\n---\n");
    put(root, ".study/solutions/exercises/hash-map/01/solution.ts", "export default function f() {}\n");
    const context = hook("reminder.mjs", { prompt: "hola" }, root).hookSpecificOutput.additionalContext as string;
    expect(context).toContain("In progress: lc-0070 (hints 0), hash-map/01 (hints 1).");
  });
```

Append to `describe("settings.json", …)`:

```ts
  it("lets Claude read and record progress through the study CLI without a prompt", () => {
    const settings = JSON.parse(readFileSync(path.join(REPO_ROOT, ".claude", "settings.json"), "utf8"));
    expect(settings.permissions.allow).toEqual(expect.arrayContaining(["Bash(pnpm -s study:*)", "Bash(pnpm -s today:*)"]));
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run scripts/tests/hooks.test.ts`
Expected: FAIL. `.study` writes are allowed, the study commands pass, and the settings lack the two permissions.

- [ ] **Step 3: Extend the guard**

Edit `.claude/hooks/guard-solution.mjs`:

1. Update the header comment's first line to: `// PreToolUse guard: Claude must never write to the user's solution files or their study folder (CLAUDE.md rule 2).`
2. After `const SOLUTION_PATH = …;` add:

```js
/** The user's study folder (study coach spec §3): solutions, their history, the progress database and its snapshot. */
const STUDY_PATH = /^\.study(?:\/|$)/;
```

3. Replace the `const NAME …` line and the `BASH_WRITES` array with:

```js
const NAME = String.raw`\S*solution\.(?:py|ts)\b`;
/** A path into the study folder (.study, ./.study/x, /abs/.study/x), not a name that merely contains ".study". */
const STUDY = String.raw`(?:\S*\/)?\.study(?=\/|\s|$)(?:\/\S*)?`;
/** Shell shapes that write to, empty, move or delete a file whose path matches `name`. */
const writesTo = (name) => [
  new RegExp(String.raw`>>?\|?\s*${name}`), // redirection into the file
  new RegExp(String.raw`\btee\b[^|;&]*${name}`),
  new RegExp(String.raw`\b(?:sed|perl)\b[^|;&]*\s-[a-zA-Z]*i[a-zA-Z.]*\b[^|;&]*${name}`), // in-place edit
  new RegExp(String.raw`\b(?:truncate|unlink|mv)\b[^|;&]*${name}`), // empty, delete or move away (rm: see deletesSolutions)
  new RegExp(String.raw`\b(?:cp|install|ln)\b[^|;&]*\s${name}\s*$`), // copy onto it
  new RegExp(String.raw`\bdd\b[^|;&]*\bof=${name}`),
];
const BASH_WRITES = writesTo(NAME);
const STUDY_WRITES = writesTo(STUDY);
/** Inline code that names something in the study folder or its database. */
const MENTIONS_STUDY = /(?:^|[^\w.-])\.study\/|study\.db/;
```

4. After `PLAYGROUND_REASON`, add the new reasons. Then replace `PLAYGROUND_FILES`:

```js
const STUDY_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): .study/ holds the user's solutions, their history and the progress database. " +
  "Do not write, move or delete anything there. Record progress only with pnpm -s study record ….";
const STUDY_COMMAND_REASON =
  "Blocked by the study rules: this study command is for the user only (migrate, start, pause, resume, phase set). " +
  "Ask the user to run it.";
const SQLITE_REASON =
  "Blocked by the study rules: never open the progress database directly. Read it with pnpm -s study status … --json " +
  "and write it with pnpm -s study record ….";
/** Playground routes that touch the user's files or study time (reading a solution creates its stub). */
const PLAYGROUND_FILES = /\/api\/(?:solution|concept\/explanation|study\/(?:start|pause|resume))\b/;
/** Study subcommands only the user runs; phase only with `set`. `curriculum set` stays allowed (spec §6.5). */
const USER_ONLY_STUDY = new Set(["migrate", "start", "pause", "resume"]);
```

5. After `reachesSolutions`, add:

```js
/** Does `word` name the study folder or anything in it (globs count), or anything under ALGO_STUDY? */
function reachesStudy(word, where) {
  const target = resolveWord(word, where);
  if (!target) return false;
  const parts = target.split(path.sep).filter(Boolean);
  const project = where.projectDir.split(path.sep).filter(Boolean);
  const inside = project.every((part, i) => i < parts.length && segmentMatches(parts[i], part));
  if (inside && parts.length > project.length && segmentMatches(parts[project.length], ".study")) return true;
  if (!process.env.ALGO_STUDY) return false;
  const rel = path.relative(path.resolve(process.env.ALGO_STUDY), target);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}
```

6. In `gitDiscards`, extend `covers` with `reachesStudy(spec, here) ||` as its first alternative.
7. After `deletesSolutions`, add:

```js
/** rm, find -delete / -exec rm, or xargs rm that can remove something under the study folder. */
function deletesStudy(command, segmentWords, where) {
  const { name, args, viaXargs } = command;
  if (name === "rm") {
    if (viaXargs && segmentWords.some((word) => MENTIONS_STUDY.test(word) || reachesStudy(word, where))) return true;
    return operands(args).some((arg) => reachesStudy(arg, where));
  }
  if (name !== "find") return false;
  const exec = args.findIndex((arg, i) => /^-(?:exec|execdir|ok|okdir)$/.test(arg) && path.basename(args[i + 1] ?? "") === "rm");
  if (!args.includes("-delete") && exec < 0) return false;
  return args.some((arg) => reachesStudy(arg, where) || /(?:^|[/*])\.study(?:\/|$)/.test(arg));
}

/** The words after `study` when this stage runs the study CLI (pnpm [-s] study …, pnpm run study …, tsx|node … study/cli.ts …). */
function studyArgs(command) {
  const words = (list) => list.filter((arg) => !arg.startsWith("-"));
  if (command.name === "study") return words(command.args);
  if (LAUNCHERS.has(command.name)) {
    const rest = words(command.args);
    return rest[0] === "study" ? rest.slice(1) : null;
  }
  if (command.name === "tsx" || command.name === "node") {
    const at = command.args.findIndex((arg) => /(?:^|\/)study\/cli\.ts$/.test(arg));
    return at >= 0 ? words(command.args.slice(at + 1)) : null;
  }
  return null;
}

function userOnlyStudy(command) {
  const args = studyArgs(command);
  if (!args) return false;
  return USER_ONLY_STUDY.has(args[0]) || (args[0] === "phase" && args[1] === "set");
}
```

8. Replace `inlineCodeWrites` with `inlineCodeReason`. It keeps the same body up to the final `return`, but returns `null` where the old one returned `false`, and ends with:

```js
  if (code.some((text) => MENTIONS_STUDY.test(text))) return STUDY_REASON;
  return code.some((text) => MENTIONS_SOLUTION.test(text) || PLAYGROUND_FILES.test(text)) ? WRITE_REASON : null;
```

   Its first line becomes `if (!INTERPRETER.test(command.name)) return null;`. Update its doc comment to: `/** WRITE_REASON or STUDY_REASON when an interpreter in stage `index` runs inline or stdin code that names a solution file, the playground API or the study folder. */`.
9. In `segmentReason`'s loop, after the `eval` block, add:

```js
    if (userOnlyStudy(command)) return STUDY_COMMAND_REASON;
    if (command.name === "sqlite3" && command.args.some((arg) => /study\.db/.test(arg))) return SQLITE_REASON;
    if (deletesStudy(command, segmentWords, where)) return STUDY_REASON;
```

   Replace `if (inlineCodeWrites(segment, index, command, stage)) return WRITE_REASON;` with:

```js
    const inline = inlineCodeReason(segment, index, command, stage);
    if (inline) return inline;
```

   Replace the function's last two lines with:

```js
  const text = segmentText(segment);
  if (STUDY_WRITES.some((re) => re.test(text))) return STUDY_REASON;
  return BASH_WRITES.some((re) => re.test(text)) ? WRITE_REASON : null;
```

10. In the file-tool branch at the bottom, replace the `if (target) { … }` block with:

```js
    if (target) {
      const absolute = path.resolve(projectDir, String(target));
      const relative = path.relative(projectDir, absolute).split(path.sep).join("/");
      const override = process.env.ALGO_STUDY ? path.relative(path.resolve(process.env.ALGO_STUDY), absolute) : null;
      const underOverride = override !== null && !override.startsWith("..") && !path.isAbsolute(override);
      if (SOLUTION_PATH.test(relative)) deny(WRITE_REASON);
      else if (STUDY_PATH.test(relative) || underOverride) deny(STUDY_REASON);
    }
```

- [ ] **Step 4: Teach the reminder's legacy scan about `.study`**

In `.claude/hooks/reminder.mjs`, replace `itemDirs` and `inProgress`, and the `inProgressItems` expression, with:

```js
/** Where the user's progress lives: $ALGO_STUDY, or <project>/.study (study coach spec §3). */
function studyDir(root) {
  return process.env.ALGO_STUDY ? path.resolve(process.env.ALGO_STUDY) : path.join(root, ".study");
}

/** Problem and exercise folders that have a README.md, with the .study/solutions folder kind they map to. */
function items(root) {
  const list = subdirs(path.join(root, "problems")).map((dir) => ({ dir, kind: "problems" }));
  for (const concept of subdirs(path.join(root, "concepts"))) {
    list.push(...subdirs(path.join(concept, "exercises")).map((dir) => ({ dir, kind: "exercises" })));
  }
  return list.filter(({ dir }) => existsSync(path.join(dir, "README.md")));
}

/**
 * In progress by READMEs that predate the study coach: status solving, or todo with a solution file in its
 * folder or under .study/solutions. Mirrors lib/repo.ts's isInProgress.
 */
function inProgress(root, item, text) {
  const status = field(text, "status");
  if (status === "solving") return true;
  const id = field(text, "id");
  const dirs = [item.dir, ...(id ? [path.join(studyDir(root), "solutions", item.kind, ...id.split("/"))] : [])];
  return status === "todo" && dirs.some((dir) => ["solution.py", "solution.ts"].some((name) => existsSync(path.join(dir, name))));
}
```

and inside the `try`:

```js
  const inProgressItems = items(root)
    .map((item) => ({ item, text: readFileSync(path.join(item.dir, "README.md"), "utf8") }))
    .filter(({ item, text }) => inProgress(root, item, text))
    .map(({ text }) => `${field(text, "id")} (hints ${field(text, "hints") ?? "0"})`);
```

- [ ] **Step 5: Allow the study CLI**

In `.claude/settings.json`, add to `permissions.allow`, after `"Bash(pnpm -s fill-expected:*)"`:

```json
      "Bash(pnpm -s study:*)",
      "Bash(pnpm -s today:*)"
```

(Mind the comma after the `fill-expected` entry.)

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run scripts/tests/hooks.test.ts && pnpm verify`
Expected: every hook test passes, the existing ones included; `pnpm verify` is green.

- [ ] **Step 7: Commit**

```bash
git add .claude/hooks/guard-solution.mjs .claude/hooks/reminder.mjs .claude/settings.json scripts/tests/hooks.test.ts
git commit -m "feat(hooks): protect .study, keep the user-only study commands from Claude, and allow the study CLI"
```

---

## Milestone M3: `study init` and `study migrate`

### Task 9: The study CLI and `pnpm study init`

**Files:**
- Create: `study/init.ts`, `study/commands.ts`, `study/cli.ts`
- Modify: `package.json` (scripts `study`, `today`)
- Test: `study/tests/init.test.ts` (create)

**Interfaces:**
- Consumes:
  - `openStudy`, `dbPath` (Task 3) and `refreshState` (Task 4);
  - `profile` (Task 2);
  - `studyRoot` (Task 1) and `writeStudyTsconfig` (Task 5).
- Produces:
  - `initStudy(root: string, options: InitOptions): InitResult`, with `InitOptions = { clock: Clock; minutes?: number; language?: Lang; timezone?: string }` and `InitResult = { dir: string; created: boolean; profile: { dailyMinutes: number; language: Lang; timezone: string } }`;
  - `DEFAULT_DAILY_MINUTES = 45`, `systemTimezone()`, `isTimezone(name)`;
  - `runStudyCli(argv: string[], io: CliIo): Promise<number>` and `CliIo`, `UsageError`, `USAGE` in `study/commands.ts`;
  - the scripts `pnpm study …` (`tsx study/cli.ts`) and `pnpm today …` (`tsx study/cli.ts today`). Plan A's `today` prints that it arrives with Plan B and exits 2; **Plan B replaces it**.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/init.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../runner/src/paths.ts";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { DEFAULT_DAILY_MINUTES, initStudy } from "../init.ts";
import { attempts, curriculumLog, phaseLog, profile } from "../schema.ts";
import { readState } from "../state-file.ts";
import { openStudy } from "../store.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";

async function cli(root: string, ...argv: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = "";
  let err = "";
  const io: CliIo = { root, clock: fixedClock(T0), out: (text) => (out += text), err: (text) => (err += text) };
  const code = await runStudyCli(argv, io);
  return { code, out, err };
}

describe("initStudy", () => {
  it("creates .study with the database, its folders, tsconfig.json, a .gitignore, the profile and state.json", () => {
    const root = makeTempDir("algo-init-");
    const result = initStudy(root, { clock: fixedClock(T0), timezone: "America/Bogota" });
    const dir = path.join(root, ".study");
    expect(result).toEqual({ dir, created: true, profile: { dailyMinutes: DEFAULT_DAILY_MINUTES, language: "py", timezone: "America/Bogota" } });
    for (const name of ["study.db", "solutions", "explanations", "exports", "tsconfig.json", "state.json"]) {
      expect(existsSync(path.join(dir, name)), name).toBe(true);
    }
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toContain("study.db\n");
    expect(readState(dir)).toMatchObject({ phase: null, inProgress: [], today: null });
    const study = openStudy(root);
    expect(study.db.select().from(profile).all()).toEqual([
      { id: 1, dailyMinutes: 45, language: "py", timezone: "America/Bogota", expansionList: null, createdAt: new Date(T0) },
    ]);
    study.close();
  });

  it("imports nothing (spec D5): no attempts, no curriculum, no phase", () => {
    const root = makeTempDir("algo-init-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const study = openStudy(root);
    expect(study.db.select().from(attempts).all()).toEqual([]);
    expect(study.db.select().from(curriculumLog).all()).toEqual([]);
    expect(study.db.select().from(phaseLog).all()).toEqual([]);
    study.close();
  });

  it("runs again safely: keeps the profile, changes only the fields passed, and rewrites tsconfig.json", () => {
    const root = makeTempDir("algo-init-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    writeFileSync(path.join(root, ".study", "tsconfig.json"), "{}\n");
    const again = initStudy(root, { clock: fixedClock("2026-10-05T10:00:00Z"), minutes: 30, language: "ts" });
    expect(again).toMatchObject({ created: false, profile: { dailyMinutes: 30, language: "ts", timezone: "UTC" } });
    expect(readFileSync(path.join(root, ".study", "tsconfig.json"), "utf8")).toContain('"extends"');
    const study = openStudy(root);
    expect(study.db.select({ createdAt: profile.createdAt }).from(profile).get()).toEqual({ createdAt: new Date(T0) });
    study.close();
  });

  it("rejects an unknown time zone or a bad number of minutes before writing anything", () => {
    const root = makeTempDir("algo-init-");
    expect(() => initStudy(root, { clock: fixedClock(T0), timezone: "Mars/Olympus" })).toThrow(RangeError);
    expect(() => initStudy(root, { clock: fixedClock(T0), minutes: 0 })).toThrow(RangeError);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });
});

describe("pnpm study init", () => {
  it("creates the store and reports the profile", async () => {
    const root = makeTempDir("algo-init-");
    const first = await cli(root, "init", "--timezone", "UTC", "--minutes", "30");
    expect(first).toEqual({ code: 0, out: "Created .study/ (study.db, tsconfig.json, state.json).\nProfile: 30 min/day · py · UTC.\n", err: "" });
    const second = await cli(root, "init", "--lang", "ts");
    expect(second.out).toBe("Updated .study/ (study.db, tsconfig.json, state.json).\nProfile: 30 min/day · ts · UTC.\n");
  });

  it("explains bad flags and unknown commands with exit code 1", async () => {
    const root = makeTempDir("algo-init-");
    expect(await cli(root, "init", "--minutes", "0")).toMatchObject({ code: 1, err: expect.stringContaining("--minutes must be a whole number above 0") });
    expect(await cli(root, "init", "--lang", "go")).toMatchObject({ code: 1, err: expect.stringContaining("--lang must be py or ts") });
    expect(await cli(root, "init", "--timezone", "Mars/Olympus")).toMatchObject({ code: 1, err: expect.stringContaining("--timezone must be an IANA time zone") });
    expect(await cli(root, "nope")).toMatchObject({ code: 1, err: expect.stringContaining("Usage:") });
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });

  it("is wired to pnpm study and pnpm today", () => {
    const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts;
    expect(scripts.study).toBe("tsx study/cli.ts");
    expect(scripts.today).toBe("tsx study/cli.ts today");
    const root = makeTempDir("algo-init-");
    const env = { ...process.env, ALGO_ROOT: root, ALGO_STUDY_NOW: T0 };
    const init = spawnSync(TSX_BIN, ["study/cli.ts", "init", "--timezone", "UTC"], { cwd: REPO_ROOT, env, encoding: "utf8" });
    expect(init.status).toBe(0);
    expect(existsSync(path.join(root, ".study", "study.db"))).toBe(true);
    const today = spawnSync(TSX_BIN, ["study/cli.ts", "today"], { cwd: REPO_ROOT, env, encoding: "utf8" });
    expect(today.status).toBe(2);
    expect(today.stderr).toContain("arrives with the scheduler");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/init.test.ts`
Expected: FAIL. `../commands.ts` and `../init.ts` do not exist.

- [ ] **Step 3: Write `initStudy`**

Create `study/init.ts`:

```ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { studyRoot, writeStudyTsconfig } from "../runner/src/paths.ts";
import type { Lang } from "../runner/src/types.ts";
import type { Clock } from "./clock.ts";
import { profile } from "./schema.ts";
import { refreshState } from "./state.ts";
import { dbPath, openStudy } from "./store.ts";

/** The coach asks on first use (spec §6.2); until then the budget is 45 minutes a day. */
export const DEFAULT_DAILY_MINUTES = 45;

export interface InitOptions {
  clock: Clock;
  minutes?: number;
  language?: Lang;
  timezone?: string;
}

export interface InitResult {
  /** The study root that was set up. */
  dir: string;
  /** True when this call created the database. */
  created: boolean;
  profile: { dailyMinutes: number; language: Lang; timezone: string };
}

export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isTimezone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * `pnpm study init` (spec §9.1): creates .study/, applies the migrations (only init and migrate do), writes
 * tsconfig.json and the profile, and refreshes state.json. It imports nothing (D5). Safe to run again: it
 * applies new migrations, rewrites tsconfig.json, and changes only the profile fields passed.
 */
export function initStudy(root: string, options: InitOptions): InitResult {
  if (options.timezone !== undefined && !isTimezone(options.timezone)) throw new RangeError(`unknown time zone "${options.timezone}"`);
  if (options.minutes !== undefined && !(Number.isInteger(options.minutes) && options.minutes > 0)) {
    throw new RangeError(`daily minutes must be a whole number above 0 (got ${options.minutes})`);
  }
  const dir = studyRoot(root);
  const created = !existsSync(dbPath(dir));
  for (const sub of ["solutions", "explanations", "exports"]) mkdirSync(path.join(dir, sub), { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  if (!existsSync(ignore)) {
    writeFileSync(ignore, "# .study may be its own private git repo (spec §12): it can hold exports, never the live database.\nstudy.db\nstudy.db-*\n");
  }
  writeStudyTsconfig(dir);
  const study = openStudy(root, { clock: options.clock, migrate: true });
  try {
    const current = study.db.select().from(profile).get();
    if (!current) {
      study.db
        .insert(profile)
        .values({
          id: 1,
          dailyMinutes: options.minutes ?? DEFAULT_DAILY_MINUTES,
          language: options.language ?? "py",
          timezone: options.timezone ?? systemTimezone(),
          createdAt: options.clock.now(),
        })
        .run();
    } else {
      const changes = {
        ...(options.minutes !== undefined ? { dailyMinutes: options.minutes } : {}),
        ...(options.language !== undefined ? { language: options.language } : {}),
        ...(options.timezone !== undefined ? { timezone: options.timezone } : {}),
      };
      if (Object.keys(changes).length > 0) study.db.update(profile).set(changes).where(eq(profile.id, 1)).run();
    }
    refreshState(study);
    const row = study.db.select().from(profile).get()!;
    return { dir, created, profile: { dailyMinutes: row.dailyMinutes, language: row.language, timezone: row.timezone } };
  } finally {
    study.close();
  }
}
```

- [ ] **Step 4: Write the CLI**

Create `study/commands.ts`:

```ts
import path from "node:path";
import { parseArgs } from "node:util";
import type { Lang } from "../runner/src/types.ts";
import type { Clock } from "./clock.ts";
import { initStudy, isTimezone } from "./init.ts";
import { StudySchemaOutdatedError } from "./store.ts";

/** Everything a command needs from the outside world, so tests run it in-process with a fixed clock. */
export interface CliIo {
  /** Content root (problems/, concepts/). */
  root: string;
  clock: Clock;
  out(text: string): void;
  err(text: string): void;
}

export class UsageError extends Error {}

export const USAGE = `Usage:
  pnpm study init [--minutes <n>] [--lang py|ts] [--timezone <IANA zone>]
  pnpm study migrate [--dry-run] [--timezone <IANA zone>]   (the user's, once; stop pnpm play and pnpm watch first)
  pnpm study status [<id>] [--json]
  pnpm study record hint <id>
  pnpm study record give-up <id>
  pnpm study record complexity <id> --time <O(…)> --space <O(…)> (--optimal | --not-optimal)
  pnpm study record explanation <concept>

<id>: a problem or exercise id (lc-0001, hash-map/01). status also takes a concept slug, a LeetCode number or part of a folder name.`;

/** Runs a parseArgs call, turning its errors into usage errors. */
function parsed<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    throw new UsageError(`${(error as Error).message}\n\n${USAGE}`);
  }
}

/** `file` relative to the content root when it is inside it, absolute otherwise. */
export function displayPath(root: string, file: string): string {
  const rel = path.relative(root, file);
  return rel.startsWith("..") || path.isAbsolute(rel) ? file : rel.split(path.sep).join("/");
}

function initCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() =>
    parseArgs({ args, strict: true, options: { minutes: { type: "string" }, lang: { type: "string" }, timezone: { type: "string" } } }),
  );
  const minutes = values.minutes === undefined ? undefined : Number(values.minutes);
  if (minutes !== undefined && !(Number.isInteger(minutes) && minutes > 0)) {
    throw new UsageError(`--minutes must be a whole number above 0 (got "${values.minutes}")`);
  }
  if (values.lang !== undefined && values.lang !== "py" && values.lang !== "ts") throw new UsageError(`--lang must be py or ts (got "${values.lang}")`);
  if (values.timezone !== undefined && !isTimezone(values.timezone)) {
    throw new UsageError(`--timezone must be an IANA time zone such as America/Bogota (got "${values.timezone}")`);
  }
  const result = initStudy(io.root, { clock: io.clock, minutes, language: values.lang as Lang | undefined, timezone: values.timezone });
  const { dailyMinutes, language, timezone } = result.profile;
  io.out(
    `${result.created ? "Created" : "Updated"} ${displayPath(io.root, result.dir)}/ (study.db, tsconfig.json, state.json).\n` +
      `Profile: ${dailyMinutes} min/day · ${language} · ${timezone}.\n`,
  );
  return 0;
}

/** `pnpm study <command> …` (spec §11). Returns the exit code; prints through `io`. */
export async function runStudyCli(argv: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "init":
        return initCommand(rest, io);
      case "today":
        // Plan B (the scheduler) replaces this command.
        io.err("pnpm today arrives with the scheduler (study coach, plan B).\n");
        return 2;
      default:
        throw new UsageError(USAGE);
    }
  } catch (error) {
    if (error instanceof UsageError || error instanceof StudySchemaOutdatedError) {
      io.err(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
```

Create `study/cli.ts`:

```ts
import { contentRoot } from "../runner/src/paths.ts";
import { envClock } from "./clock.ts";
import { runStudyCli } from "./commands.ts";

process.exitCode = await runStudyCli(process.argv.slice(2), {
  root: contentRoot(),
  clock: envClock(),
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});
```

- [ ] **Step 5: Add the scripts**

In `package.json` `scripts`, after `"play": "tsx playground/cli.ts",` add:

```json
    "study": "tsx study/cli.ts",
    "today": "tsx study/cli.ts today",
```

- [ ] **Step 6: Run the tests and the type check**

Run: `pnpm vitest run study/tests/init.test.ts && pnpm exec tsc --noEmit`
Expected: 7 passed; `tsc` prints nothing. Do **not** run `pnpm study init` by hand: it would create `.study/study.db` in the real repo.

- [ ] **Step 7: Commit**

```bash
git add study/init.ts study/commands.ts study/cli.ts study/tests/init.test.ts package.json
git commit -m "feat(study): add the study CLI and pnpm study init"
```

---

### Task 10: README strip helpers (and the shared "My explanation" model moves to `lib/`)

**Files:**
- Move: `playground/server/explanation.ts` → `lib/explanation.ts` (`git mv`)
- Move: `playground/tests/server/explanation.test.ts` → `scripts/tests/explanation.test.ts` (`git mv`)
- Modify: `playground/server/concepts.ts` (import path)
- Modify: `lib/schemas.ts` (`LEGACY_PERSONAL_FIELDS`)
- Create: `study/strip.ts`
- Test: `study/tests/strip.test.ts` (create)

**Interfaces:**
- Consumes: `splitExplanation`, `joinExplanation` (now in `lib/explanation.ts`); `parseMarkdown` (`lib/frontmatter.ts`).
- Produces:
  - `LEGACY_PERSONAL_FIELDS: { problem: readonly [...]; exercise: readonly [...]; concept: readonly ["status"] }` in `lib/schemas.ts`;
  - `type ReadmeKind = "problem" | "exercise" | "concept"`;
  - `stripFrontmatter(text: string, keys: readonly string[]): { text: string; removed: string[] }`;
  - `removeSection(body: string, heading: string): { body: string; removed: boolean }`;
  - `stripReadme(text: string, kind: ReadmeKind): StrippedReadme`, where `StrippedReadme = { text: string; fields: string[]; log: boolean; explanation: string | null }`;
  - `StripError`, all in `study/strip.ts`.

- [ ] **Step 1: Move the explanation model**

```bash
git mv playground/server/explanation.ts lib/explanation.ts
git mv playground/tests/server/explanation.test.ts scripts/tests/explanation.test.ts
```

Then:
- in `scripts/tests/explanation.test.ts`, change the import to `from "../../lib/explanation.ts";`;
- in `playground/server/concepts.ts`, change it to `from "../../lib/explanation.ts";`.

The module has no Node imports; nothing else imports it.

- [ ] **Step 2: Write the failing tests**

Create `study/tests/strip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { removeSection, StripError, stripFrontmatter, stripReadme } from "../strip.ts";

const PROBLEM = [
  "---",
  "id: lc-9001",
  'title: "Sample Sum: a fixture"',
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-sum/",
  "difficulty: easy",
  "patterns: [arrays-hashing]",
  "concepts: [sample-map]",
  "lists: [grind-75]",
  "status: solved",
  "hints: 1",
  "solution_revealed: false",
  "solved_in: [py, ts]",
  "complexity:",
  "  time: O(1)",
  "  space: O(1)",
  "  optimal: true",
  "---",
  "# 9001. Sample Sum",
  "",
  "## Statement",
  "",
  "Short paraphrase.",
  "",
  "## Concepts",
  "",
  "<!-- auto:concepts -->",
  "<!-- /auto -->",
  "",
  "## Log",
  "",
  "- 2026-09-28 · registered",
  "- 2026-09-29 · green in py",
  "",
].join("\n");

const PROBLEM_STRIPPED = [
  "---",
  "id: lc-9001",
  'title: "Sample Sum: a fixture"',
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-sum/",
  "difficulty: easy",
  "patterns: [arrays-hashing]",
  "concepts: [sample-map]",
  "lists: [grind-75]",
  "---",
  "# 9001. Sample Sum",
  "",
  "## Statement",
  "",
  "Short paraphrase.",
  "",
  "## Concepts",
  "",
  "<!-- auto:concepts -->",
  "<!-- /auto -->",
  "",
].join("\n");

const CONCEPT = [
  "---",
  "slug: sample-map",
  "title: Sample map",
  "status: learning",
  "requires: []",
  "related: []",
  "---",
  "# Sample map",
  "",
  "## Intuition",
  "",
  "An analogy.",
  "",
  "## My explanation",
  "",
  "<!-- Write this yourself, in your own words. Claude never fills this section. -->",
  "",
  "Keys turn into positions.",
  "",
  "## Problems",
  "",
  "<!-- auto:problems -->",
  "<!-- /auto -->",
  "",
].join("\n");

describe("stripReadme", () => {
  it("removes a problem's personal fields (block and flow style) and its Log, keeping every other byte", () => {
    expect(stripReadme(PROBLEM, "problem")).toEqual({
      text: PROBLEM_STRIPPED,
      fields: ["status", "hints", "solution_revealed", "solved_in", "complexity"],
      log: true,
      explanation: null,
    });
    const flow = PROBLEM.replace("complexity:\n  time: O(1)\n  space: O(1)\n  optimal: true\n", 'complexity: { time: "O(1)", space: "O(1)", optimal: true }\n');
    expect(stripReadme(flow, "problem").text).toBe(PROBLEM_STRIPPED);
  });

  it("removes an exercise's fields, which have no complexity", () => {
    const exercise = "---\nid: sample-map/01\ntitle: First\nconcept: sample-map\nstatus: todo\nhints: 0\nsolution_revealed: false\nsolved_in: []\n---\n# First\n\n## Statement\n\nShort.\n\n## Log\n\n- 2026-09-30 · created\n";
    expect(stripReadme(exercise, "exercise")).toEqual({
      text: "---\nid: sample-map/01\ntitle: First\nconcept: sample-map\n---\n# First\n\n## Statement\n\nShort.\n",
      fields: ["status", "hints", "solution_revealed", "solved_in"],
      log: true,
      explanation: null,
    });
  });

  it("takes a concept's status and the text of My explanation, keeping the heading and its comment", () => {
    expect(stripReadme(CONCEPT, "concept")).toEqual({
      text: CONCEPT.replace("status: learning\n", "").replace("\n\nKeys turn into positions.", ""),
      fields: ["status"],
      log: false,
      explanation: "Keys turn into positions.",
    });
  });

  it("changes nothing in a README that is already pure content", () => {
    expect(stripReadme(PROBLEM_STRIPPED, "problem")).toEqual({ text: PROBLEM_STRIPPED, fields: [], log: false, explanation: null });
  });
});

describe("removeSection", () => {
  it("removes a section in the middle up to the next ## heading, and ignores a heading inside a code block", () => {
    const body = "# T\n\n## Log\n\n- a\n\n## Notes\n\n```md\n## Log\n```\n";
    expect(removeSection(body, "Log")).toEqual({ body: "# T\n\n## Notes\n\n```md\n## Log\n```\n", removed: true });
    expect(removeSection("# T\n\n```md\n## Log\n```\n", "Log")).toEqual({ body: "# T\n\n```md\n## Log\n```\n", removed: false });
  });
});

describe("stripFrontmatter", () => {
  it("refuses a frontmatter it cannot strip line by line without changing the other fields", () => {
    const aliased = "---\nid: lc-9001\nstatus: &s solved\ntitle: *s\n---\n# T\n";
    expect(() => stripFrontmatter(aliased, ["status"])).toThrow(StripError);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run study/tests/strip.test.ts scripts/tests/explanation.test.ts`
Expected:
- `strip.test.ts` FAILS because `../strip.ts` does not exist.
- `explanation.test.ts` PASSES from its new place.

- [ ] **Step 4: Name the legacy fields**

Append to `lib/schemas.ts`:

```ts
/**
 * Personal progress READMEs held before the study coach (spec §9.4, §10). `pnpm study migrate` removes these
 * fields (with the README's `## Log` and its "My explanation" text); `pnpm check` reports any left behind.
 */
export const LEGACY_PERSONAL_FIELDS = {
  problem: ["status", "hints", "solution_revealed", "solved_in", "complexity"],
  exercise: ["status", "hints", "solution_revealed", "solved_in"],
  concept: ["status"],
} as const satisfies Record<"problem" | "exercise" | "concept", readonly string[]>;
```

- [ ] **Step 5: Write the strip helpers**

Create `study/strip.ts`:

```ts
import { isDeepStrictEqual } from "node:util";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { parse } from "yaml";
import { joinExplanation, splitExplanation } from "../lib/explanation.ts";
import { parseMarkdown } from "../lib/frontmatter.ts";
import { LEGACY_PERSONAL_FIELDS } from "../lib/schemas.ts";

export type ReadmeKind = keyof typeof LEGACY_PERSONAL_FIELDS;

/** A README whose personal data cannot be removed safely by machine: the migration stops before changing anything. */
export class StripError extends Error {}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const TOP_LEVEL_KEY = /^([A-Za-z_][\w-]*)\s*:/;

function yamlMapping(block: string): Record<string, unknown> {
  try {
    return (parse(block) ?? {}) as Record<string, unknown>;
  } catch (error) {
    throw new StripError(`frontmatter does not parse after the strip: ${(error as Error).message}`);
  }
}

/**
 * `text` without the top-level frontmatter `keys`. The other lines stay byte for byte (no YAML
 * re-serialization). The result must parse to the same mapping minus those keys, or StripError.
 */
export function stripFrontmatter(text: string, keys: readonly string[]): { text: string; removed: string[] } {
  const match = FENCE.exec(text);
  if (!match) return { text, removed: [] };
  const kept: string[] = [];
  const removed: string[] = [];
  let dropping = false;
  for (const line of match[1].split("\n")) {
    const key = TOP_LEVEL_KEY.exec(line)?.[1];
    if (key !== undefined) {
      dropping = keys.includes(key);
      if (dropping) removed.push(key);
    }
    // Indented lines, list items, blank lines and comments belong to the key above them.
    if (!dropping) kept.push(line);
  }
  if (removed.length === 0) return { text, removed };
  const block = kept.join("\n");
  const before = yamlMapping(match[1]);
  const expected = Object.fromEntries(Object.entries(before).filter(([key]) => !keys.includes(key)));
  if (!isDeepStrictEqual(yamlMapping(block), expected)) {
    throw new StripError(`could not remove ${removed.join(", ")} without changing the other frontmatter fields`);
  }
  const start = match[0].indexOf(match[1]);
  const head = match[0].slice(0, start) + block + match[0].slice(start + match[1].length);
  return { text: head + text.slice(match[0].length), removed };
}

/** `body` without its `## <heading>` section: from that heading to the next heading of depth ≤ 2, or the end. */
export function removeSection(body: string, heading: string): { body: string; removed: boolean } {
  const nodes = fromMarkdown(body).children;
  const index = nodes.findIndex(
    (node) => node.type === "heading" && node.depth === 2 && toString(node, { includeHtml: false }).trim() === heading,
  );
  if (index < 0) return { body, removed: false };
  const next = nodes.findIndex((node, i) => i > index && node.type === "heading" && node.depth <= 2);
  const start = nodes[index].position!.start.offset!;
  const end = next < 0 ? body.length : nodes[next].position!.start.offset!;
  const before = body.slice(0, start).replace(/\s*$/, "");
  const after = body.slice(end);
  return { body: after ? `${before}\n\n${after}` : `${before}\n`, removed: true };
}

export interface StrippedReadme {
  /** The README as pure content. */
  text: string;
  /** The personal frontmatter keys that were there. */
  fields: string[];
  /** It had a `## Log` section. */
  log: boolean;
  /** Concepts: the "My explanation" text taken out (the heading and its comments stay); null when empty. */
  explanation: string | null;
}

/** A README as pure content (spec §9.4): no personal frontmatter fields, no `## Log`, no "My explanation" text. */
export function stripReadme(text: string, kind: ReadmeKind): StrippedReadme {
  const { text: withoutFields, removed } = stripFrontmatter(text, LEGACY_PERSONAL_FIELDS[kind]);
  const { head, body } = parseMarkdown(withoutFields);
  const log = removeSection(body, "Log");
  let next = log.body;
  let explanation: string | null = null;
  if (kind === "concept") {
    const split = splitExplanation(next);
    if (split?.text) {
      explanation = split.text;
      next = joinExplanation(split, "");
    }
  }
  return { text: head + next, fields: removed, log: log.removed, explanation };
}
```

- [ ] **Step 6: Run the tests and the type checks**

Run: `pnpm vitest run study/tests/strip.test.ts scripts/tests/explanation.test.ts playground/tests/server/concepts.test.ts && pnpm exec tsc --noEmit && pnpm exec tsc -p playground`
Expected: all pass; both `tsc` runs print nothing.

- [ ] **Step 7: Commit**

```bash
git add lib/explanation.ts scripts/tests/explanation.test.ts playground/server/concepts.ts lib/schemas.ts study/strip.ts study/tests/strip.test.ts
git commit -m "feat(study): strip personal fields, Log and My explanation text from READMEs; share the explanation model from lib"
```

(`git mv` already staged the deletions of the two old paths.)

---

### Task 11: `pnpm study migrate` with `--dry-run`

**Files:**
- Create: `study/migrate.ts`
- Create: `study/tests/legacy-fixture.ts`
- Modify: `study/commands.ts` (the `migrate` command)
- Test: `study/tests/migrate.test.ts` (create)

**Interfaces:**
- Consumes:
  - `initStudy` (Task 9) and `stripReadme`, `StripError` (Task 10);
  - `historyPath`, `historyStamp`, `studyRoot` (Tasks 1, 5);
  - `refreshState`, `openStudy`, `dbPath` (Tasks 3, 4);
  - `scanRepo` (`lib/repo.ts`).
- Produces:
  - `type MigrationAction` (`init | archive | explanation | strip`; Task 17 adds `sync`);
  - `interface MigrationPlan { root; dir; at; actions; blockers: string[] }`;
  - `planMigration(root: string, at: Date): MigrationPlan`;
  - `applyMigration(plan: MigrationPlan, options: { clock: Clock; timezone?: string }): void`;
  - `describeAction(plan, action): string`, `trackedFiles(root): Set<string>`, `MigrationError`;
  - `makeLegacyRepo(): string`, `git(root, ...args): string`, `snapshotTree(root): Map<string, string>` in `study/tests/legacy-fixture.ts`. Task 18 reuses them.

- [ ] **Step 1: Write the legacy fixture**

Create `study/tests/legacy-fixture.ts`:

```ts
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CASES_JSON, makeTempDir, put } from "../../scripts/tests/fixture.ts";

// Fictional problems (no real LeetCode statement, so nothing here can spoil one), shaped like the READMEs written
// before the study coach: personal frontmatter fields, a ## Log, and "My explanation" text in the concept.

export const LEGACY_SUM = [
  "---",
  "id: lc-9001",
  "title: Sample Sum",
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-sum/",
  "difficulty: easy",
  "patterns: [arrays-hashing]",
  "concepts: [sample-map]",
  "lists: [grind-75]",
  "status: solved",
  "hints: 1",
  "solution_revealed: false",
  "solved_in: [py]",
  "complexity:",
  "  time: O(1)",
  "  space: O(1)",
  "  optimal: true",
  "---",
  "# 9001. Sample Sum",
  "",
  "## Statement",
  "",
  "Short paraphrase.",
  "",
  "## Concepts",
  "",
  "<!-- auto:concepts -->",
  "- [Sample map](../../concepts/sample-map/README.md) · learning",
  "<!-- /auto -->",
  "",
  "## Log",
  "",
  "- 2026-09-28 · registered",
  "",
].join("\n");

export const LEGACY_PAIRS = [
  "---",
  "id: lc-9002",
  "title: Sample Pairs",
  "source: leetcode",
  "url: https://leetcode.com/problems/sample-pairs/",
  "difficulty: medium",
  "patterns: [two-pointers]",
  "concepts: [sample-map]",
  "status: solving",
  "hints: 0",
  "solution_revealed: false",
  "solved_in: []",
  "complexity: null",
  "---",
  "# 9002. Sample Pairs",
  "",
  "## Statement",
  "",
  "Short paraphrase.",
  "",
  "## Concepts",
  "",
  "<!-- auto:concepts -->",
  "<!-- /auto -->",
  "",
  "## Log",
  "",
  "- 2026-09-30 · registered",
  "",
].join("\n");

export const EXPLANATION_TEXT = "Keys turn into positions.";

export const LEGACY_CONCEPT = [
  "---",
  "slug: sample-map",
  "title: Sample map",
  "status: learning",
  "requires: []",
  "related: []",
  "---",
  "# Sample map",
  "",
  "## Intuition",
  "",
  "An analogy.",
  "",
  "## Exercises",
  "",
  "<!-- auto:exercises -->",
  "<!-- /auto -->",
  "",
  "## My explanation",
  "",
  "<!-- Write this yourself, in your own words. Claude never fills this section. -->",
  "",
  EXPLANATION_TEXT,
  "",
  "## Problems",
  "",
  "<!-- auto:problems -->",
  "<!-- /auto -->",
  "",
].join("\n");

export const LEGACY_EXERCISE = [
  "---",
  "id: sample-map/01",
  "title: First",
  "concept: sample-map",
  "status: solved",
  "hints: 0",
  "solution_revealed: false",
  "solved_in: [py]",
  "---",
  "# First",
  "",
  "## Statement",
  "",
  "Short.",
  "",
  "## Log",
  "",
  "- 2026-09-30 · green in py",
  "",
].join("\n");

/** git with a neutral identity and none of the user's signing or hook settings. */
export function git(root: string, ...args: string[]): string {
  const run = spawnSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "-C", root, ...args],
    { encoding: "utf8" },
  );
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout;
}

/**
 * A git repo shaped like the user's before the study coach:
 * - a tracked solution (lc-9001);
 * - untracked solutions (lc-9002, sample-map/01);
 * - legacy READMEs.
 */
export function makeLegacyRepo(): string {
  const root = makeTempDir("algo-legacy-");
  put(root, ".gitignore", ".study/\n");
  put(root, "problems/lc-9001-sample-sum/README.md", LEGACY_SUM);
  put(root, "problems/lc-9001-sample-sum/cases.json", CASES_JSON);
  put(root, "problems/lc-9001-sample-sum/solution.py", "# tracked work\n");
  put(root, "problems/lc-9002-sample-pairs/README.md", LEGACY_PAIRS);
  put(root, "problems/lc-9002-sample-pairs/cases.json", CASES_JSON);
  put(root, "concepts/sample-map/README.md", LEGACY_CONCEPT);
  put(root, "concepts/sample-map/exercises/01-first/README.md", LEGACY_EXERCISE);
  put(root, "concepts/sample-map/exercises/01-first/cases.json", CASES_JSON);
  git(root, "init", "-q");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "before the study coach");
  put(root, "problems/lc-9002-sample-pairs/solution.ts", "// untracked work\n");
  put(root, "concepts/sample-map/exercises/01-first/solution.py", "# exercise work\n");
  return root;
}

/** Every file under `root` except .git/, with its bytes (base64): a dry run must leave this unchanged. */
export function snapshotTree(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.set(path.relative(root, full).split(path.sep).join("/"), readFileSync(full).toString("base64"));
    }
  };
  walk(root);
  return files;
}
```

- [ ] **Step 2: Write the failing tests**

Create `study/tests/migrate.test.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { profile } from "../schema.ts";
import { openStudy } from "../store.ts";
import { EXPLANATION_TEXT, git, makeLegacyRepo, snapshotTree } from "./legacy-fixture.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";
const STAMP = "2026-10-04T10-00-00-000Z";

async function migrate(root: string, ...flags: string[]) {
  let out = "";
  let err = "";
  const io: CliIo = { root, clock: fixedClock(T0), out: (text) => (out += text), err: (text) => (err += text) };
  const code = await runStudyCli(["migrate", "--timezone", "UTC", ...flags], io);
  return { code, out, err };
}

const read = (root: string, rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("pnpm study migrate --dry-run", () => {
  it("prints every action and changes nothing, not even .study or the git index", async () => {
    const root = makeLegacyRepo();
    const tree = snapshotTree(root);
    const status = git(root, "status", "--porcelain");
    const result = await migrate(root, "--dry-run");
    expect(result.code).toBe(0);
    expect(result.out.split("\n")).toEqual(
      expect.arrayContaining([
        "init        .study/ (study.db, tsconfig.json, profile)",
        `archive     problems/lc-9001-sample-sum/solution.py → .study/solutions/problems/lc-9001/history/${STAMP}-legacy.py (tracked: git rm --cached)`,
        `archive     problems/lc-9002-sample-pairs/solution.ts → .study/solutions/problems/lc-9002/history/${STAMP}-legacy.ts`,
        `archive     concepts/sample-map/exercises/01-first/solution.py → .study/solutions/exercises/sample-map/01/history/${STAMP}-legacy.py`,
        "strip       problems/lc-9001-sample-sum/README.md (status, hints, solution_revealed, solved_in, complexity, ## Log)",
        "strip       problems/lc-9002-sample-pairs/README.md (status, hints, solution_revealed, solved_in, complexity, ## Log)",
        "strip       concepts/sample-map/exercises/01-first/README.md (status, hints, solution_revealed, solved_in, ## Log)",
        "explanation sample-map → .study/explanations/sample-map.md",
        "strip       concepts/sample-map/README.md (status, My explanation text)",
        "Dry run: nothing was changed. Run pnpm study migrate to apply.",
      ]),
    );
    expect(snapshotTree(root)).toEqual(tree);
    expect(git(root, "status", "--porcelain")).toBe(status);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });
});

describe("pnpm study migrate", () => {
  it("archives every solution byte for byte, git-removes the tracked one, and leaves the commit to the user", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    for (const rel of ["problems/lc-9001-sample-sum/solution.py", "problems/lc-9002-sample-pairs/solution.ts", "concepts/sample-map/exercises/01-first/solution.py"]) {
      expect(existsSync(path.join(root, rel)), rel).toBe(false);
    }
    expect(read(root, `.study/solutions/problems/lc-9001/history/${STAMP}-legacy.py`)).toBe("# tracked work\n");
    expect(read(root, `.study/solutions/problems/lc-9002/history/${STAMP}-legacy.ts`)).toBe("// untracked work\n");
    expect(read(root, `.study/solutions/exercises/sample-map/01/history/${STAMP}-legacy.py`)).toBe("# exercise work\n");
    const status = git(root, "status", "--porcelain").split("\n");
    expect(status).toContain("D  problems/lc-9001-sample-sum/solution.py");
    expect(status).toContain(" M problems/lc-9001-sample-sum/README.md");
    expect(git(root, "log", "--oneline").trim().split("\n")).toHaveLength(1);
  });

  it("moves My explanation to .study, strips every README, and sets up the store with a profile", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    expect(read(root, ".study/explanations/sample-map.md")).toBe(`${EXPLANATION_TEXT}\n`);
    const concept = read(root, "concepts/sample-map/README.md");
    expect(concept).not.toContain(EXPLANATION_TEXT);
    expect(concept).not.toMatch(/^status:/m);
    expect(concept).toContain("## My explanation\n\n<!-- Write this yourself, in your own words. Claude never fills this section. -->\n\n## Problems");
    for (const rel of ["problems/lc-9001-sample-sum/README.md", "problems/lc-9002-sample-pairs/README.md", "concepts/sample-map/exercises/01-first/README.md"]) {
      const text = read(root, rel);
      expect(text, rel).not.toMatch(/^(status|hints|solution_revealed|solved_in|complexity):/m);
      expect(text, rel).not.toContain("## Log");
    }
    const study = openStudy(root);
    expect(study.db.select({ timezone: profile.timezone }).from(profile).all()).toEqual([{ timezone: "UTC" }]);
    study.close();
    expect(existsSync(path.join(root, ".study", "state.json"))).toBe(true);
  });

  it("finds nothing left to do the second time", async () => {
    const root = makeLegacyRepo();
    await migrate(root);
    const tree = snapshotTree(root);
    const again = await migrate(root);
    expect(again.code).toBe(0);
    expect(again.out).toContain("Nothing to migrate.");
    expect(snapshotTree(root)).toEqual(tree);
  });

  it("keeps newer text already in .study/explanations and saves the README's next to it", async () => {
    const root = makeLegacyRepo();
    put(root, ".study/explanations/sample-map.md", "Newer words.\n");
    const result = await migrate(root);
    expect(result.out).toContain(
      `explanation sample-map: .study/explanations/sample-map.md has newer text; the README's goes to .study/explanations/history/sample-map-${STAMP}-legacy.md`,
    );
    expect(read(root, ".study/explanations/sample-map.md")).toBe("Newer words.\n");
    expect(read(root, `.study/explanations/history/sample-map-${STAMP}-legacy.md`)).toBe(`${EXPLANATION_TEXT}\n`);
  });

  it("reuses an identical legacy copy left by an interrupted run instead of copying twice", async () => {
    const root = makeLegacyRepo();
    const history = path.join(root, ".study/solutions/problems/lc-9002/history");
    mkdirSync(history, { recursive: true });
    writeFileSync(path.join(history, "2026-10-03T09-00-00-000Z-legacy.ts"), "// untracked work\n");
    expect((await migrate(root)).code).toBe(0);
    expect(existsSync(path.join(history, `${STAMP}-legacy.ts`))).toBe(false);
    expect(existsSync(path.join(root, "problems/lc-9002-sample-pairs/solution.ts"))).toBe(false);
  });

  it("refuses to start while a README cannot be stripped, and changes nothing", async () => {
    const root = makeLegacyRepo();
    put(root, "problems/lc-9003-broken/README.md", "---\ntitle: [unclosed\n---\n# Broken\n");
    const tree = snapshotTree(root);
    const result = await migrate(root);
    expect(result.code).toBe(1);
    expect(result.err).toContain("Cannot migrate yet. Fix these READMEs first:\n  - problems/lc-9003-broken/README.md: frontmatter:");
    expect(snapshotTree(root)).toEqual(tree);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run study/tests/migrate.test.ts`
Expected: FAIL. `migrate` prints the usage and exits 1.

- [ ] **Step 4: Write the migration**

Create `study/migrate.ts`:

```ts
import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scanRepo } from "../lib/repo.ts";
import { historyPath, historyStamp, studyRoot } from "../runner/src/paths.ts";
import { LANGS } from "../runner/src/types.ts";
import type { Clock } from "./clock.ts";
import { initStudy } from "./init.ts";
import { refreshState } from "./state.ts";
import { dbPath, openStudy } from "./store.ts";
import { StripError, stripReadme } from "./strip.ts";

export type MigrationAction =
  | { kind: "init"; dir: string; exists: boolean }
  | { kind: "archive"; from: string; to: string; tracked: boolean }
  | { kind: "explanation"; slug: string; to: string; text: string; keep: "readme" | "same" | "study"; history: string | null }
  | { kind: "strip"; file: string; text: string; fields: string[]; log: boolean; explanation: boolean };

export interface MigrationPlan {
  /** Content root. */
  root: string;
  /** Study root. */
  dir: string;
  at: Date;
  actions: MigrationAction[];
  /** READMEs that cannot be stripped by machine: nothing is applied while there are any. */
  blockers: string[];
}

export class MigrationError extends Error {}

const rel = (root: string, file: string): string => path.relative(root, file).split(path.sep).join("/");

/** Repo-relative paths git tracks under problems/ and concepts/ (empty outside a git work tree). */
export function trackedFiles(root: string): Set<string> {
  const run = spawnSync("git", ["-C", root, "ls-files", "-z", "--", "problems", "concepts"], { encoding: "utf8" });
  return run.status === 0 ? new Set(run.stdout.split("\0").filter(Boolean)) : new Set();
}

function explanationAction(dir: string, slug: string, text: string, at: Date): MigrationAction {
  const to = path.join(dir, "explanations", `${slug}.md`);
  const current = existsSync(to) ? readFileSync(to, "utf8").trim() : null;
  if (current === null) return { kind: "explanation", slug, to, text, keep: "readme", history: null };
  if (current === text.trim()) return { kind: "explanation", slug, to, text, keep: "same", history: null };
  const history = path.join(dir, "explanations", "history", `${slug}-${historyStamp(at)}-legacy.md`);
  return { kind: "explanation", slug, to, text, keep: "study", history };
}

/** Everything `pnpm study migrate` would do (spec §9), computed without changing anything. */
export function planMigration(root: string, at: Date): MigrationPlan {
  const dir = studyRoot(root);
  const repo = scanRepo(root);
  const tracked = trackedFiles(root);
  const actions: MigrationAction[] = [{ kind: "init", dir, exists: existsSync(dbPath(dir)) }];
  const blockers: string[] = [];
  for (const entry of [...repo.problems, ...repo.exercises]) {
    const target = { id: entry.folderId, kind: entry.kind, dir: entry.dir };
    for (const lang of LANGS) {
      const from = path.join(entry.dir, `solution.${lang}`);
      if (!existsSync(from)) continue;
      actions.push({ kind: "archive", from, to: historyPath(target, lang, at, { legacy: true }), tracked: tracked.has(rel(root, from)) });
    }
  }
  for (const entry of [...repo.problems, ...repo.exercises, ...repo.concepts]) {
    if (entry.error) {
      if (existsSync(entry.readme)) blockers.push(`${entry.rel}: ${entry.error}`);
      continue;
    }
    const raw = readFileSync(entry.readme, "utf8");
    let stripped: ReturnType<typeof stripReadme>;
    try {
      stripped = stripReadme(raw, entry.kind);
    } catch (error) {
      if (!(error instanceof StripError)) throw error;
      blockers.push(`${entry.rel}: ${error.message}`);
      continue;
    }
    if (entry.kind === "concept" && stripped.explanation !== null) actions.push(explanationAction(dir, entry.slug, stripped.explanation, at));
    if (stripped.text !== raw) {
      actions.push({ kind: "strip", file: entry.readme, text: stripped.text, fields: stripped.fields, log: stripped.log, explanation: stripped.explanation !== null });
    }
  }
  return { root, dir, at, actions, blockers };
}

/** True when the plan only re-initializes an existing store. */
export function nothingToMigrate(plan: MigrationPlan): boolean {
  return plan.actions.every((action) => action.kind === "init" && action.exists);
}

/** One line per action, paths relative to the content root. */
export function describeAction(plan: MigrationPlan, action: MigrationAction): string {
  const show = (file: string): string => {
    const relative = path.relative(plan.root, file);
    return relative.startsWith("..") || path.isAbsolute(relative) ? file : relative.split(path.sep).join("/");
  };
  const line = (verb: string, rest: string): string => `${verb.padEnd(12)}${rest}`;
  switch (action.kind) {
    case "init":
      return line("init", `${show(action.dir)}/ (${action.exists ? "exists: apply new migrations, rewrite tsconfig.json" : "study.db, tsconfig.json, profile"})`);
    case "archive":
      return line("archive", `${show(action.from)} → ${show(action.to)}${action.tracked ? " (tracked: git rm --cached)" : ""}`);
    case "explanation":
      if (action.keep === "readme") return line("explanation", `${action.slug} → ${show(action.to)}`);
      if (action.keep === "same") return line("explanation", `${action.slug}: ${show(action.to)} already has this text`);
      return line("explanation", `${action.slug}: ${show(action.to)} has newer text; the README's goes to ${show(action.history!)}`);
    case "strip": {
      const what = [...action.fields, ...(action.log ? ["## Log"] : []), ...(action.explanation ? ["My explanation text"] : [])];
      return line("strip", `${show(action.file)} (${what.join(", ")})`);
    }
  }
}

/** A legacy copy with exactly these bytes, left by an earlier run that stopped before deleting the original. */
function sameLegacyCopy(historyDir: string, ext: string, bytes: Buffer): boolean {
  if (!existsSync(historyDir)) return false;
  return readdirSync(historyDir).some((name) => name.endsWith(`-legacy${ext}`) && readFileSync(path.join(historyDir, name)).equals(bytes));
}

/** Copy, verify the bytes, then delete (spec §9.2). A tracked file leaves the index with git rm --cached; the user commits. */
function archive(root: string, action: Extract<MigrationAction, { kind: "archive" }>): void {
  const bytes = readFileSync(action.from);
  if (!sameLegacyCopy(path.dirname(action.to), path.extname(action.to), bytes)) {
    mkdirSync(path.dirname(action.to), { recursive: true });
    copyFileSync(action.from, action.to, constants.COPYFILE_EXCL);
    if (!readFileSync(action.to).equals(bytes)) throw new MigrationError(`the copy of ${rel(root, action.from)} differs from it; nothing was deleted`);
  }
  if (action.tracked) {
    const run = spawnSync("git", ["-C", root, "rm", "--cached", "--quiet", "--", rel(root, action.from)], { encoding: "utf8" });
    if (run.status !== 0) throw new MigrationError(`git rm --cached ${rel(root, action.from)} failed: ${run.stderr.trim()}`);
  }
  unlinkSync(action.from);
}

function writeNew(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, { flag: "wx" });
}

/** Applies a plan in order. It stops at the first error; everything done before it is safe to keep, and a re-run resumes. */
export function applyMigration(plan: MigrationPlan, options: { clock: Clock; timezone?: string }): void {
  if (plan.blockers.length > 0) throw new MigrationError(`Cannot migrate yet. Fix these READMEs first:\n${plan.blockers.map((b) => `  - ${b}`).join("\n")}`);
  for (const action of plan.actions) {
    switch (action.kind) {
      case "init":
        initStudy(plan.root, { clock: options.clock, timezone: options.timezone });
        break;
      case "archive":
        archive(plan.root, action);
        break;
      case "explanation":
        if (action.keep === "readme") writeNew(action.to, `${action.text.trim()}\n`);
        if (action.keep === "study") writeNew(action.history!, `${action.text.trim()}\n`);
        break;
      case "strip":
        writeFileSync(action.file, action.text);
        break;
    }
  }
  const study = openStudy(plan.root, { clock: options.clock });
  try {
    refreshState(study);
  } finally {
    study.close();
  }
}
```

- [ ] **Step 5: Add the command**

In `study/commands.ts`:
- add `import { applyMigration, describeAction, MigrationError, nothingToMigrate, planMigration } from "./migrate.ts";`;
- add the function below;
- add `case "migrate": return migrateCommand(rest, io);` to the `switch`;
- add `|| error instanceof MigrationError` to the `catch` condition.

```ts
function migrateCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() =>
    parseArgs({ args, strict: true, options: { "dry-run": { type: "boolean", default: false }, timezone: { type: "string" } } }),
  );
  if (values.timezone !== undefined && !isTimezone(values.timezone)) {
    throw new UsageError(`--timezone must be an IANA time zone such as America/Bogota (got "${values.timezone}")`);
  }
  const plan = planMigration(io.root, io.clock.now());
  for (const action of plan.actions) io.out(`${describeAction(plan, action)}\n`);
  if (plan.blockers.length > 0) {
    io.err(`Cannot migrate yet. Fix these READMEs first:\n${plan.blockers.map((blocker) => `  - ${blocker}`).join("\n")}\n`);
    return 1;
  }
  if (values["dry-run"]) {
    io.out("Dry run: nothing was changed. Run pnpm study migrate to apply.\n");
    return 0;
  }
  if (nothingToMigrate(plan)) {
    io.out("Nothing to migrate.\n");
    return 0;
  }
  applyMigration(plan, { clock: io.clock, timezone: values.timezone });
  io.out(
    "Migrated. Review `git status`, then commit the stripped READMEs and the removed solution files (git history keeps them).\n",
  );
  return 0;
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `pnpm vitest run study/tests/migrate.test.ts study/tests/init.test.ts && pnpm exec tsc --noEmit`
Expected: all pass; `tsc` prints nothing.

The migration runs only on temp repos here. **Never run `pnpm study migrate` in the real repo**: the user runs it after Plans A, B and C.

- [ ] **Step 7: Run the whole suite**

Run: `pnpm verify`
Expected: green; `check` with 0 errors (nothing changed in content).

- [ ] **Step 8: Commit**

```bash
git add study/migrate.ts study/commands.ts study/tests/legacy-fixture.ts study/tests/migrate.test.ts
git commit -m "feat(study): add pnpm study migrate with --dry-run: archive solutions, move explanations, strip READMEs"
```

---

## Milestone M4: recording

### Task 12: The recording engine and Plan B's close seam

**Files:**
- Create: `study/record.ts`, `study/close-hook.ts`
- Create: `study/tests/fixtures/race-worker.ts`
- Test: `study/tests/record.test.ts`, `study/tests/close-hook.test.ts` (create)

**Interfaces:**
- Consumes:
  - `inTransaction`, `openMemoryStudy`, `openStudy`, `Study`, `StudyTx` (Task 3);
  - `refreshState` (Task 4) and `initStudy` (Task 9);
  - the tables and the `attemptStats` view (Task 2).
- Produces: "Recording" and "The close seam" exactly as listed in **Interfaces for Plans B and C**.

The lifecycle (spec §7):
- **Start:** an item's **first** attempt opens on real work, meaning a `save`/`edit` whose content differs from the stub, or any `run`.
- **During:** every later event joins the open attempt.
- **End:** the first green run closes it with `outcome = green`.
- **After the close:** later work is polishing and records nothing. Reviews and exams open new attempts explicitly, through Plan B's `study start`, which uses `openAttempt`.
- **Hints** need an open attempt (one is opened if the item has none yet) and are refused during an exam.
- **A give-up** closes the open attempt, or opens and closes one at once, with `outcome = gave_up`.
- **Ratings:** Plan A never writes `rating`. Plan B does, inside `onAttemptClosed`.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/fixtures/race-worker.ts`:

```ts
// One of several processes started together by record.test.ts to race on the same item (spec §12).
import { recordWork } from "../../record.ts";
import { openStudy } from "../../store.ts";

const [root, go] = process.argv.slice(2);
const study = openStudy(root);
while (Date.now() < Number(go)) {
  // wait for the others, so the writes really overlap
}
const result = recordWork(study, "lc-0001", { type: "run", lang: "py", green: false }, "cli");
study.close();
process.stdout.write(JSON.stringify(result));
```

Create `study/tests/record.test.ts`:

```ts
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { TSX_LOADER } from "../../runner/src/paths.ts";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import {
  AttemptAlreadyOpenError,
  acceptExplanation,
  closeAttempt,
  giveUp,
  openAttempt,
  recordComplexity,
  recordHint,
  recordWork,
  type WorkResult,
} from "../record.ts";
import { attemptEvents, attempts, complexityNotes, exams, itemStatusView } from "../schema.ts";
import { inTransaction, openMemoryStudy, openStudy, type Study } from "../store.ts";

const T0 = "2026-10-04T10:00:00.000Z";
const WORKER = fileURLToPath(new URL("./fixtures/race-worker.ts", import.meta.url));

function setup() {
  const clock = fixedClock(T0);
  return { clock, study: openMemoryStudy({ clock }) };
}
const attemptRows = (study: Study) => study.db.select().from(attempts).all();
const eventRows = (study: Study) =>
  study.db
    .select({ type: attemptEvents.type, lang: attemptEvents.lang, runGreen: attemptEvents.runGreen, source: attemptEvents.source })
    .from(attemptEvents)
    .orderBy(attemptEvents.id)
    .all();
const statusOf = (study: Study, itemId: string) =>
  study.db.select().from(itemStatusView).where(eq(itemStatusView.itemId, itemId)).get()?.status ?? "todo";

describe("recordWork: the attempt lifecycle (spec §7)", () => {
  it("opens nothing for a save that only repeats the stub, and opens the first attempt on real work", () => {
    const { study } = setup();
    expect(recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: false }, "playground")).toEqual({ recorded: false, reason: "stub" });
    expect(attemptRows(study)).toEqual([]);
    expect(recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: true }, "playground")).toEqual({
      recorded: true,
      attemptId: 1,
      opened: true,
      closed: false,
    });
    expect(attemptRows(study)).toEqual([
      { id: 1, itemId: "lc-0001", examId: null, startedAt: new Date(T0), endedAt: null, outcome: null, rating: null },
    ]);
    expect(eventRows(study)).toEqual([{ type: "save", lang: "py", runGreen: null, source: "playground" }]);
  });

  it("opens an attempt on any run, appends every later event to it, and closes it at the first green run with no rating", () => {
    const { study, clock } = setup();
    expect(recordWork(study, "lc-0001", { type: "run", lang: "py", green: false }, "cli")).toMatchObject({ opened: true, closed: false });
    clock.advance(60_000);
    recordWork(study, "lc-0001", { type: "edit", lang: "py", differsFromStub: false }, "watch"); // joins the open attempt
    clock.advance(60_000);
    expect(recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "watch")).toEqual({
      recorded: true,
      attemptId: 1,
      opened: false,
      closed: true,
    });
    expect(attemptRows(study)).toMatchObject([{ endedAt: new Date(Date.parse(T0) + 120_000), outcome: "green", rating: null }]);
    expect(eventRows(study).map((event) => event.type)).toEqual(["run", "edit", "run"]);
    expect(statusOf(study, "lc-0001")).toBe("solved");
  });

  it("treats work after the close as polishing: nothing is recorded, not even in the other language", () => {
    const { study } = setup();
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    expect(recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: true }, "playground")).toEqual({ recorded: false, reason: "closed" });
    expect(recordWork(study, "lc-0001", { type: "run", lang: "ts", green: true }, "cli")).toEqual({ recorded: false, reason: "closed" });
    expect(attemptRows(study)).toHaveLength(1);
    expect(eventRows(study)).toHaveLength(1);
  });

  it("keeps items apart", () => {
    const { study } = setup();
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    recordWork(study, "hash-map/01", { type: "save", lang: "ts", differsFromStub: true }, "playground");
    expect(statusOf(study, "lc-0001")).toBe("solved");
    expect(statusOf(study, "hash-map/01")).toBe("in_progress");
  });
});

describe("hints, give-ups, complexity and explanations", () => {
  it("counts hints on the open attempt, opening one when the item has none, and refuses after the close", () => {
    const { study } = setup();
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: true, attemptId: 1, hints: 1 });
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: true, attemptId: 1, hints: 2 });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: false, reason: "closed" });
  });

  it("refuses a hint during an exam attempt without counting it", () => {
    const { study, clock } = setup();
    inTransaction(study, (tx) => {
      const exam = tx.insert(exams).values({ list: "grind-75", seed: 1, startedAt: clock.now() }).returning().get();
      openAttempt(tx, "lc-0001", clock.now(), { examId: exam.id });
    });
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: false, reason: "exam" });
    expect(eventRows(study)).toEqual([]);
  });

  it("closes the open attempt as given up, or opens and closes one at once, and never gives up a closed item", () => {
    const { study } = setup();
    recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: true }, "playground");
    expect(giveUp(study, "lc-0001")).toEqual({ recorded: true, attemptId: 1 });
    expect(statusOf(study, "lc-0001")).toBe("revealed");
    expect(giveUp(study, "lc-0001")).toEqual({ recorded: false, reason: "closed" });
    expect(giveUp(study, "lc-0020")).toEqual({ recorded: true, attemptId: 2 });
    expect(attemptRows(study)[1]).toMatchObject({ itemId: "lc-0020", startedAt: new Date(T0), endedAt: new Date(T0), outcome: "gave_up" });
  });

  it("attaches complexity to the latest green attempt, replacing an earlier note, and refuses an item never green", () => {
    const { study } = setup();
    expect(recordComplexity(study, "lc-0001", { time: "O(n)", space: "O(1)", optimal: false })).toEqual({ recorded: false, reason: "not-green" });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    expect(recordComplexity(study, "lc-0001", { time: "O(n)", space: "O(1)", optimal: false })).toEqual({ recorded: true, attemptId: 1 });
    recordComplexity(study, "lc-0001", { time: "O(n)", space: "O(n)", optimal: true });
    expect(study.db.select().from(complexityNotes).all()).toEqual([{ attemptId: 1, time: "O(n)", space: "O(n)", optimal: true }]);
  });

  it("accepts an explanation once and keeps the first date", () => {
    const { study, clock } = setup();
    expect(acceptExplanation(study, "hash-map")).toEqual({ acceptedAt: new Date(T0), already: false });
    clock.advance(86_400_000);
    expect(acceptExplanation(study, "hash-map")).toEqual({ acceptedAt: new Date(T0), already: true });
  });
});

describe("openAttempt and closeAttempt", () => {
  it("refuses a second open attempt, and closing twice changes nothing", () => {
    const { study, clock } = setup();
    const id = inTransaction(study, (tx) => openAttempt(tx, "lc-0001", clock.now()));
    expect(() => inTransaction(study, (tx) => openAttempt(tx, "lc-0001", clock.now()))).toThrow(AttemptAlreadyOpenError);
    expect(inTransaction(study, (tx) => closeAttempt(tx, id, "green", clock.now(), study))).toMatchObject({ id, outcome: "green" });
    expect(inTransaction(study, (tx) => closeAttempt(tx, id, "gave_up", clock.now(), study))).toBeNull();
    expect(attemptRows(study)[0].outcome).toBe("green");
  });
});

describe("state.json after recording", () => {
  afterEach(cleanupTempDirs);

  it("is refreshed after a write that changes what it shows", () => {
    const root = makeTempDir("algo-record-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const study = openStudy(root, { clock: fixedClock(T0) });
    recordHint(study, "lc-0001");
    study.close();
    const state = JSON.parse(readFileSync(path.join(root, ".study", "state.json"), "utf8"));
    expect(state.inProgress).toEqual([{ id: "lc-0001", kind: "new", hints: 1, startedAt: T0 }]);
  });
});

describe("concurrency (spec §12)", () => {
  afterEach(cleanupTempDirs);

  it("six processes recording the first run of one item at once leave one attempt holding six runs", async () => {
    const root = makeTempDir("algo-race-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const go = Date.now() + 2500;
    const outputs = await Promise.all(
      Array.from(
        { length: 6 },
        () =>
          new Promise<string>((resolve, reject) => {
            const child = spawn(process.execPath, ["--import", TSX_LOADER, WORKER, root, String(go)], { stdio: ["ignore", "pipe", "inherit"] });
            let out = "";
            child.stdout.on("data", (chunk) => {
              out += String(chunk);
            });
            child.on("error", reject);
            child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`race worker exited with ${code}`))));
          }),
      ),
    );
    const results = outputs.map((out) => JSON.parse(out) as WorkResult);
    expect(results.filter((result) => result.recorded && result.opened)).toHaveLength(1);
    const study = openStudy(root);
    expect(study.db.select().from(attempts).all()).toHaveLength(1);
    expect(study.db.select().from(attemptEvents).all()).toHaveLength(6);
    study.close();
  });
});
```

Create `study/tests/close-hook.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ calls: [] as { attempt: unknown; root: string | null }[], fail: false }));

vi.mock("../close-hook.ts", () => ({
  onAttemptClosed: (_tx: unknown, attempt: unknown, ctx: { root: string | null }) => {
    seam.calls.push({ attempt, root: ctx.root });
    if (seam.fail) throw new Error("plan B failed");
  },
}));

import { fixedClock } from "../clock.ts";
import { closeAttempt, giveUp, recordWork } from "../record.ts";
import { attemptEvents, attempts } from "../schema.ts";
import { inTransaction, openMemoryStudy } from "../store.ts";

const T0 = "2026-10-04T10:00:00.000Z";

describe("the close seam, where Plan B rates the attempt and updates its card", () => {
  it("runs once per attempt, inside the closing transaction, with the closed attempt", () => {
    seam.calls.length = 0;
    seam.fail = false;
    const study = openMemoryStudy({ clock: fixedClock(T0), root: "/repo" });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    giveUp(study, "lc-0020");
    inTransaction(study, (tx) => closeAttempt(tx, 1, "gave_up", study.clock.now(), study)); // already closed: no second call
    expect(seam.calls).toEqual([
      { attempt: { id: 1, itemId: "lc-0001", examId: null, startedAt: new Date(T0), endedAt: new Date(T0), outcome: "green" }, root: "/repo" },
      { attempt: { id: 2, itemId: "lc-0020", examId: null, startedAt: new Date(T0), endedAt: new Date(T0), outcome: "gave_up" }, root: "/repo" },
    ]);
  });

  it("rolls the close back when it throws: the attempt stays open and the green run is not recorded", () => {
    seam.calls.length = 0;
    seam.fail = false;
    const study = openMemoryStudy({ clock: fixedClock(T0) });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: false }, "cli");
    seam.fail = true;
    expect(() => recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli")).toThrow("plan B failed");
    expect(study.db.select().from(attempts).all()).toMatchObject([{ endedAt: null, outcome: null }]);
    expect(study.db.select().from(attemptEvents).all()).toHaveLength(1);
    seam.fail = false;
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/record.test.ts study/tests/close-hook.test.ts`
Expected: FAIL. `../record.ts` and `../close-hook.ts` do not exist.

- [ ] **Step 3: Write the seam**

Create `study/close-hook.ts`:

```ts
import type { Clock } from "./clock.ts";
import type { Outcome } from "./schema.ts";
import type { StudyTx } from "./store.ts";

export interface ClosedAttempt {
  id: number;
  itemId: string;
  examId: number | null;
  startedAt: Date;
  endedAt: Date;
  outcome: Outcome;
}

export interface CloseContext {
  /** Content root, for reading the item's README (its difficulty, for the time-box). Null in memory-only tests. */
  root: string | null;
  clock: Clock;
}

/**
 * THE SEAM FOR PLAN B (study coach spec §7 "Closing", §6.3). closeAttempt calls it exactly once per attempt,
 * inside the closing transaction, right after ended_at and outcome are written.
 *
 * Plan B fills it in for problems (item ids without "/"):
 * - set attempts.rating, from the outcome, attempt_stats (hints, active_ms, measured) and the time-box;
 * - then upsert the item's row in the cards cache.
 *
 * Exercises keep rating null. Anything thrown here rolls the close back, so the attempt stays open.
 * Plan A: does nothing, so rating stays null and no card is written.
 */
export function onAttemptClosed(_tx: StudyTx, _attempt: ClosedAttempt, _ctx: CloseContext): void {}
```

- [ ] **Step 4: Write the recording API**

Create `study/record.ts`:

```ts
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Lang } from "../runner/src/types.ts";
import { type ClosedAttempt, onAttemptClosed } from "./close-hook.ts";
import { attemptEvents, attempts, attemptStats, complexityNotes, conceptAcceptances, type EventSource, type Outcome } from "./schema.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study, type StudyTx } from "./store.ts";

/** One edit, save or run of the user's code. An edit or save says whether the code differs from the stub. */
export type WorkEvent = { type: "edit" | "save"; lang: Lang; differsFromStub: boolean } | { type: "run"; lang: Lang; green: boolean };

export type WorkResult =
  | { recorded: true; attemptId: number; opened: boolean; closed: boolean }
  | { recorded: false; reason: "stub" | "closed" };
export type HintResult = { recorded: true; attemptId: number; hints: number } | { recorded: false; reason: "closed" | "exam" };
export type GiveUpResult = { recorded: true; attemptId: number } | { recorded: false; reason: "closed" };
export type ComplexityResult = { recorded: true; attemptId: number } | { recorded: false; reason: "not-green" };

export class AttemptAlreadyOpenError extends Error {
  constructor(readonly itemId: string) {
    super(`${itemId} already has an open attempt`);
    this.name = "AttemptAlreadyOpenError";
  }
}

/** The item's open attempt, if any. */
export function openAttemptOf(tx: StudyTx, itemId: string) {
  return tx.select().from(attempts).where(and(eq(attempts.itemId, itemId), isNull(attempts.endedAt))).get();
}

function hasAttempts(tx: StudyTx, itemId: string): boolean {
  return tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.itemId, itemId)).limit(1).get() !== undefined;
}

/** Opens an attempt (spec §7 "Start"). Plan B's `study start` and exams call it too. Throws when one is open. */
export function openAttempt(tx: StudyTx, itemId: string, at: Date, options: { examId?: number } = {}): number {
  if (openAttemptOf(tx, itemId)) throw new AttemptAlreadyOpenError(itemId);
  return tx.insert(attempts).values({ itemId, startedAt: at, examId: options.examId ?? null }).returning({ id: attempts.id }).get().id;
}

/**
 * Closes an attempt (spec §7 "Closing") and runs the close seam in the same transaction. Closing an attempt
 * that is already closed changes nothing and returns null (idempotent, spec §12).
 */
export function closeAttempt(tx: StudyTx, attemptId: number, outcome: Outcome, at: Date, study: Study): ClosedAttempt | null {
  const row = tx.select().from(attempts).where(eq(attempts.id, attemptId)).get();
  if (!row) throw new Error(`there is no attempt ${attemptId}`);
  if (row.endedAt !== null) return null;
  const endedAt = at.getTime() < row.startedAt.getTime() ? row.startedAt : at;
  tx.update(attempts).set({ endedAt, outcome }).where(eq(attempts.id, attemptId)).run();
  const closed: ClosedAttempt = { id: row.id, itemId: row.itemId, examId: row.examId, startedAt: row.startedAt, endedAt, outcome };
  onAttemptClosed(tx, closed, { root: study.root, clock: study.clock });
  return closed;
}

/**
 * One edit, save or run of the user's code (spec §7):
 * - it opens the item's first attempt on real work (content that differs from the stub, or any run);
 * - it joins the open attempt;
 * - it closes the attempt at the first green run.
 * Once an attempt has closed, later work is polishing and nothing is recorded; a review opens a new attempt
 * explicitly (Plan B).
 */
export function recordWork(study: Study, itemId: string, event: WorkEvent, source: EventSource): WorkResult {
  const at = study.clock.now();
  const result = inTransaction(study, (tx): WorkResult => {
    const open = openAttemptOf(tx, itemId);
    let attemptId = open?.id;
    if (attemptId === undefined) {
      if (hasAttempts(tx, itemId)) return { recorded: false, reason: "closed" };
      if (event.type !== "run" && !event.differsFromStub) return { recorded: false, reason: "stub" };
      attemptId = openAttempt(tx, itemId, at);
    }
    tx.insert(attemptEvents)
      .values({ attemptId, at, type: event.type, lang: event.lang, runGreen: event.type === "run" ? event.green : null, source })
      .run();
    const closed = event.type === "run" && event.green && closeAttempt(tx, attemptId, "green", at, study) !== null;
    return { recorded: true, attemptId, opened: open === undefined, closed };
  });
  if (result.recorded) refreshState(study);
  return result;
}

/** `pnpm -s study record hint <id>` (the `hint` skill). Refused during an exam attempt; nothing to count on after the close. */
export function recordHint(study: Study, itemId: string): HintResult {
  const at = study.clock.now();
  const result = inTransaction(study, (tx): HintResult => {
    const open = openAttemptOf(tx, itemId);
    if (open && open.examId !== null) return { recorded: false, reason: "exam" };
    if (!open && hasAttempts(tx, itemId)) return { recorded: false, reason: "closed" };
    const attemptId = open?.id ?? openAttempt(tx, itemId, at);
    tx.insert(attemptEvents).values({ attemptId, at, type: "hint", lang: null, runGreen: null, source: "skill" }).run();
    const hints = tx.select({ hints: attemptStats.hints }).from(attemptStats).where(eq(attemptStats.attemptId, attemptId)).get()?.hints ?? 0;
    return { recorded: true, attemptId, hints };
  });
  if (result.recorded) refreshState(study);
  return result;
}

/** `pnpm -s study record give-up <id>` (the `give-up` skill): closes the open attempt, or opens and closes one, as gave_up. */
export function giveUp(study: Study, itemId: string): GiveUpResult {
  const at = study.clock.now();
  const result = inTransaction(study, (tx): GiveUpResult => {
    const open = openAttemptOf(tx, itemId);
    if (!open && hasAttempts(tx, itemId)) return { recorded: false, reason: "closed" };
    const attemptId = open?.id ?? openAttempt(tx, itemId, at);
    closeAttempt(tx, attemptId, "gave_up", at, study);
    return { recorded: true, attemptId };
  });
  if (result.recorded) refreshState(study);
  return result;
}

/** `pnpm -s study record complexity` (the `review` skill): a note on the item's latest green attempt. */
export function recordComplexity(study: Study, itemId: string, note: { time: string; space: string; optimal: boolean }): ComplexityResult {
  return inTransaction(study, (tx): ComplexityResult => {
    const green = tx
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.itemId, itemId), eq(attempts.outcome, "green")))
      .orderBy(desc(attempts.endedAt), desc(attempts.id))
      .limit(1)
      .get();
    if (!green) return { recorded: false, reason: "not-green" };
    tx.insert(complexityNotes).values({ attemptId: green.id, ...note }).onConflictDoUpdate({ target: complexityNotes.attemptId, set: note }).run();
    return { recorded: true, attemptId: green.id };
  });
}

/** `pnpm -s study record explanation <slug>` (the `concept` skill). The first acceptance is the one kept. */
export function acceptExplanation(study: Study, slug: string): { acceptedAt: Date; already: boolean } {
  const at = study.clock.now();
  return inTransaction(study, (tx) => {
    const inserted = tx.insert(conceptAcceptances).values({ concept: slug, acceptedAt: at }).onConflictDoNothing().returning().get();
    const row = tx.select().from(conceptAcceptances).where(eq(conceptAcceptances.concept, slug)).get()!;
    return { acceptedAt: row.acceptedAt, already: inserted === undefined };
  });
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm vitest run study/tests/record.test.ts study/tests/close-hook.test.ts && pnpm exec tsc --noEmit`
Expected: 14 passed; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add study/record.ts study/close-hook.ts study/tests/fixtures/race-worker.ts study/tests/record.test.ts study/tests/close-hook.test.ts
git commit -m "feat(study): record the attempt lifecycle, hints, give-ups, complexity and explanations, with a close seam for the scheduler"
```

---

### Task 13: Recording from the runner and the playground; `--no-record`

**Files:**
- Create: `runner/src/recording.ts`
- Modify: `runner/src/run.ts`, `runner/src/cli.ts`, `runner/src/watcher.ts`
- Modify: `playground/server/solutions.ts`, `playground/tests/server/helpers.ts` (close cached handles)
- Test: `runner/tests/recording.test.ts` (create), `runner/tests/cli.test.ts`, `runner/tests/watcher.test.ts`, `playground/tests/server/solutions.test.ts`

**Interfaces:**
- Consumes:
  - `cachedStudy`, `closeCachedStudies` (Task 3) and `envClock` (Task 3);
  - `recordWork` (Task 12);
  - `renderStub`, `solutionPath` (Task 6) and `targetRoot` (Task 5).
- Produces:
  - `runner/src/recording.ts`:
    - `type Recording = { status: "recorded" | "ignored" | "off" } | { status: "failed"; message: string }`;
    - `recordRun(target: Target, lang: Lang, green: boolean, source: EventSource): Recording`;
    - `recordSolutionChange(target: Target, lang: Lang, code: string, type: "edit" | "save", source: EventSource): Recording`;
    - `sameAsStub(code: string, stub: string): boolean`.
  - `RunOptions.record?: EventSource`. It is unset (nothing recorded) for Claude's runs, `fill-expected` and tests.
  - `renderRun(target, lang, root, record?: EventSource)`;
  - `watchTarget(target, lang, { open, root, record?: boolean })`: `record` defaults to false; the CLI passes `!--no-record`.
  - `pnpm test|watch … --no-record`.
  - **Event sources:** the playground records `save` (PUT `/api/solution`) and `run` (POST `/api/run`); `pnpm watch` records `edit` (a solution save) and `run` (the run that save triggers); `pnpm test` records `run`.

- [ ] **Step 1: Write the failing tests**

Create `runner/tests/recording.test.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixedClock } from "../../study/clock.ts";
import { initStudy } from "../../study/init.ts";
import { attemptEvents, itemStatusView } from "../../study/schema.ts";
import { closeCachedStudies, openStudy } from "../../study/store.ts";
import { recordRun, recordSolutionChange, sameAsStub } from "../src/recording.ts";
import { runTarget } from "../src/run.ts";
import { loadCaseFile } from "../src/schema.ts";
import { renderStub } from "../src/stubs.ts";
import { makeProblem, removeTemp, tempDir } from "./helpers.ts";

const T0 = "2026-10-04T10:00:00.000Z";
const SUM = { entry: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int", examples: [{ input: [[1, 2]], expected: 3 }], hidden: [] };
const PY_SUM = "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n";
const roots: string[] = [];

afterEach(() => {
  closeCachedStudies();
  for (const root of roots.splice(0)) removeTemp(root);
});

function repo(withStudy: boolean) {
  const root = tempDir();
  roots.push(root);
  const target = makeProblem(root, "lc-0001-sum", SUM);
  if (withStudy) initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
  return { root, target };
}

const recorded = (root: string) => {
  const study = openStudy(root);
  try {
    return {
      status: study.db.select().from(itemStatusView).all().map((row) => [row.itemId, row.status]),
      events: study.db.select({ type: attemptEvents.type, source: attemptEvents.source }).from(attemptEvents).orderBy(attemptEvents.id).all(),
    };
  } finally {
    study.close();
  }
};

describe("sameAsStub", () => {
  it("ignores line endings and trailing blanks, so an editor that only reformats the stub has not started work", () => {
    const stub = "class Solution:\n    def solve(self) -> int:\n        raise NotImplementedError\n";
    expect(sameAsStub(stub.replace(/\n/g, "\r\n"), stub)).toBe(true);
    expect(sameAsStub(stub.replace("int:\n", "int:   \n") + "\n\n", stub)).toBe(true);
    expect(sameAsStub(stub.replace("raise NotImplementedError", "return 0"), stub)).toBe(false);
  });
});

describe("recording from the runner", () => {
  it("ignores a save that equals the stub, opens on real work, and closes on a green run", () => {
    const { root, target } = repo(true);
    expect(recordSolutionChange(target, "py", renderStub(loadCaseFile(target.dir), "py"), "save", "playground")).toEqual({ status: "ignored" });
    expect(recordSolutionChange(target, "py", PY_SUM, "save", "playground")).toEqual({ status: "recorded" });
    expect(recordRun(target, "py", true, "playground")).toEqual({ status: "recorded" });
    expect(recorded(root)).toEqual({
      status: [["lc-0001", "solved"]],
      events: [
        { type: "save", source: "playground" },
        { type: "run", source: "playground" },
      ],
    });
  });

  it("is off, and creates nothing, while the repo has no study database", () => {
    const { root, target } = repo(false);
    expect(recordRun(target, "py", true, "cli")).toEqual({ status: "off" });
    expect(existsSync(path.join(root, ".study", "study.db"))).toBe(false);
  });

  it("never breaks a run: an outdated database costs one stderr line, however many runs fail to record", async () => {
    const { root, target } = repo(false);
    const result = await runTarget(target, "py", { root, record: "cli" });
    expect(result.fatal).toBeNull(); // the stub runs; no database, nothing recorded, nothing printed
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const study = openStudy(root);
    study.sqlite.prepare("DELETE FROM __drizzle_migrations").run();
    study.close();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      for (let i = 0; i < 2; i++) expect((await runTarget(target, "py", { root, record: "cli" })).examples.total).toBe(1);
      const lines = stderr.mock.calls.map(([chunk]) => String(chunk)).filter((line) => line.startsWith("study:"));
      expect(lines).toEqual([expect.stringContaining("Run `pnpm study init`")]);
    } finally {
      stderr.mockRestore();
    }
  });
});
```

In `runner/tests/cli.test.ts`, add these imports:
- `import { existsSync } from "node:fs";`
- `import { fixedClock } from "../../study/clock.ts";`, `import { initStudy } from "../../study/init.ts";`, `import { itemStatusView } from "../../study/schema.ts";`, `import { openStudy } from "../../study/store.ts";`

Then append:

```ts
describe("recording the user's runs (study coach spec §7)", () => {
  it("records pnpm test's run and green, and nothing with --no-record", () => {
    const rec = tempDir();
    try {
      makeProblem(rec, "lc-0001-sum", { ...CASES, hidden: [{ input: [[4]], expected: 4 }] }, { "solution.py": PY });
      initStudy(rec, { clock: fixedClock("2026-10-04T10:00:00Z"), timezone: "UTC" });
      const run = (...args: string[]) => spawnSync(TSX_BIN, ["runner/src/cli.ts", ...args], { cwd: REPO_ROOT, env: { ...process.env, ALGO_ROOT: rec }, encoding: "utf8" });
      const statuses = () => {
        const study = openStudy(rec);
        try {
          return study.db.select().from(itemStatusView).all().map((row) => [row.itemId, row.status]);
        } finally {
          study.close();
        }
      };
      expect(run("test", "lc-0001", "--no-record").status).toBe(0);
      expect(statuses()).toEqual([]);
      expect(run("test", "lc-0001").status).toBe(0);
      expect(statuses()).toEqual([["lc-0001", "solved"]]);
      expect(existsSync(`${rec}/.study/state.json`)).toBe(true);
    } finally {
      removeTemp(rec);
    }
  });
});
```

In `runner/tests/watcher.test.ts`, add these imports:
- `import { fixedClock } from "../../study/clock.ts";`, `import { initStudy } from "../../study/init.ts";`, `import { attemptEvents } from "../../study/schema.ts";`, `import { closeCachedStudies, openStudy } from "../../study/store.ts";`

Then append inside `describe("watchTarget", …)`:

```ts
  it("records a save and the run it triggers, but not the first automatic run, which is like opening the problem", async () => {
    const own = tempDir();
    const twice = { entry: "solve", params: [{ name: "n", type: "int" }], returns: "int", examples: [{ input: [2], expected: 4 }], hidden: [] };
    const target = makeProblem(own, "lc-0006-recorded", twice, { "solution.py": "class Solution:\n    def solve(self, n: int) -> int:\n        return n\n" });
    initStudy(own, { clock: fixedClock("2026-10-04T10:00:00Z"), timezone: "UTC" });
    const recorded = () => {
      const study = openStudy(own);
      try {
        return study.db.select({ type: attemptEvents.type, source: attemptEvents.source }).from(attemptEvents).orderBy(attemptEvents.id).all();
      } finally {
        study.close();
      }
    };
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      const watcher = await watchTarget(target, "py", { open: false, root: own, record: true });
      await watcher.ready;
      expect(recorded()).toEqual([]);
      writeFileSync(studySolutionPath(target, "py"), "class Solution:\n    def solve(self, n: int) -> int:\n        return n * 2\n");
      await vi.waitFor(
        () =>
          expect(recorded()).toEqual([
            { type: "edit", source: "watch" },
            { type: "run", source: "watch" },
          ]),
        { timeout: 15_000, interval: 100 },
      );
      watcher.close();
    } finally {
      stdout.mockRestore();
      closeCachedStudies();
      removeTemp(own);
    }
  });
```

In `playground/tests/server/solutions.test.ts`:
- add `import { eq } from "drizzle-orm";`, `import { fixedClock } from "../../../study/clock.ts";`, `import { initStudy } from "../../../study/init.ts";`, `import { attemptEvents, attempts, itemStatusView } from "../../../study/schema.ts";`, `import { openStudy } from "../../../study/store.ts";`;
- add `RunResult` to the types imported from `../../../runner/src/types.ts`, adding that import line if there is none;
- append:

```ts
describe("recording (study coach spec §7)", () => {
  /** lc-0020's progress only: the fixture may seed other items. */
  const progress = (root: string) => {
    const study = openStudy(root);
    try {
      return {
        status: study.db.select().from(itemStatusView).where(eq(itemStatusView.itemId, "lc-0020")).all().map((row) => [row.itemId, row.status]),
        events: study.db
          .select({ type: attemptEvents.type, source: attemptEvents.source })
          .from(attemptEvents)
          .innerJoin(attempts, eq(attempts.id, attemptEvents.attemptId))
          .where(eq(attempts.itemId, "lc-0020"))
          .orderBy(attemptEvents.id)
          .all(),
      };
    } finally {
      study.close();
    }
  };

  it("records nothing for opening a problem or saving the stub, a save of real work opens the attempt, and a green Run closes it", async () => {
    const root = makeRepo();
    initStudy(root, { clock: fixedClock("2026-10-04T10:00:00Z"), timezone: "UTC" });
    const app = createApp({ root });
    const first = await json<SolutionData>(await call(app, "/api/solution?id=lc-0020&lang=py"));
    await call(app, "/api/solution", { method: "PUT", json: { id: "lc-0020", lang: "py", code: first.code, baseVersion: first.version } });
    expect(progress(root)).toEqual({ status: [], events: [] });
    await call(app, "/api/solution", { method: "PUT", json: { id: "lc-0020", lang: "py", code: PY_SUM, baseVersion: first.version } });
    expect(progress(root).status).toEqual([["lc-0020", "in_progress"]]);
    const run = await json<RunResult>(await call(app, "/api/run", { json: { id: "lc-0020", lang: "py" } }));
    expect(run.green).toBe(true);
    expect(progress(root)).toEqual({
      status: [["lc-0020", "solved"]],
      events: [
        { type: "save", source: "playground" },
        { type: "run", source: "playground" },
      ],
    });
  });
});
```

In `playground/tests/server/helpers.ts`, import `closeCachedStudies` from `../../../study/store.ts` and make `removeRepos` call it first:

```ts
export function removeRepos(): void {
  closeCachedStudies();
  for (const root of repos.splice(0)) removeTemp(root);
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run runner/tests/recording.test.ts runner/tests/cli.test.ts runner/tests/watcher.test.ts playground/tests/server/solutions.test.ts`
Expected: FAIL. `../src/recording.ts` does not exist, `--no-record` is an unknown option, and nothing is recorded.

- [ ] **Step 3: Write the adapter**

Create `runner/src/recording.ts`:

```ts
import { envClock } from "../../study/clock.ts";
import { recordWork, type WorkEvent } from "../../study/record.ts";
import type { EventSource } from "../../study/schema.ts";
import { cachedStudy } from "../../study/store.ts";
import { targetRoot } from "./paths.ts";
import { CaseFileError, loadCaseFile } from "./schema.ts";
import { renderStub } from "./stubs.ts";
import type { Lang, Target } from "./types.ts";

/** What happened to one piece of work: recorded, ignored by the lifecycle, off (no study database yet), or failed. */
export type Recording = { status: "recorded" | "ignored" | "off" } | { status: "failed"; message: string };

/** Same text up to line endings and trailing blanks: an editor that only reformats the stub has not started work. */
export function sameAsStub(code: string, stub: string): boolean {
  const normalize = (text: string): string => text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd();
  return normalize(code) === normalize(stub);
}

function differsFromStub(target: Target, lang: Lang, code: string): boolean {
  try {
    return !sameAsStub(code, renderStub(loadCaseFile(target.dir), lang));
  } catch (error) {
    if (error instanceof CaseFileError) return false; // no stub to compare with: only an open attempt takes the edit
    throw error;
  }
}

const warned = new Set<string>();

/** Recording never breaks a run or a save: a failure is one stderr line per distinct message and process. */
function report(result: Recording): Recording {
  if (result.status === "failed" && !warned.has(result.message)) {
    warned.add(result.message);
    process.stderr.write(`study: progress not recorded: ${result.message}\n`);
  }
  return result;
}

function record(target: Target, event: () => WorkEvent, source: EventSource): Recording {
  try {
    const study = cachedStudy(targetRoot(target), envClock());
    if (!study) return { status: "off" };
    return recordWork(study, target.id, event(), source).recorded ? { status: "recorded" } : { status: "ignored" };
  } catch (error) {
    return report({ status: "failed", message: (error as Error).message });
  }
}

/** A run of the user's code (spec §7): pnpm test, the run pnpm watch makes after a save, or ▶ Run in the playground. */
export function recordRun(target: Target, lang: Lang, green: boolean, source: EventSource): Recording {
  return record(target, () => ({ type: "run", lang, green }), source);
}

/** The solution changed on disk: `save` from the playground's editor, `edit` as pnpm watch sees it. */
export function recordSolutionChange(target: Target, lang: Lang, code: string, type: "edit" | "save", source: EventSource): Recording {
  return record(target, () => ({ type, lang, differsFromStub: differsFromStub(target, lang, code) }), source);
}
```

- [ ] **Step 4: Record from `runTarget`, the CLI and the watcher**

1. `runner/src/run.ts`:
   - import `type EventSource` from `../../study/schema.ts` and `recordRun` from `./recording.ts`;
   - add the option to `RunOptions`;
   - rename the existing `export async function runTarget(` to `async function judgeTarget(` (body unchanged);
   - add the new `runTarget` below it.

```ts
  /**
   * Records this run for the study coach (spec §7). Leave it unset for runs that are not the user's practice:
   * Claude's (`--no-record`), fill-expected, and tests.
   */
  record?: EventSource;
```

```ts
/** Runs examples, then hidden cases, then stress, and records the run when `options.record` says whose it is. */
export async function runTarget(target: Target, lang: Lang, options: RunOptions = {}): Promise<RunResult> {
  const result = await judgeTarget(target, lang, options);
  if (options.record) recordRun(target, lang, result.green, options.record);
  return result;
}
```

2. `runner/src/cli.ts`:
   - change `USAGE` to:

```ts
const USAGE = `Usage:
  pnpm watch <query> [--lang py|ts] [--open] [--no-record]
  pnpm test <query> [--lang py|ts|all] [--json] [--no-record]
  pnpm fill-expected <query> --ref <path outside the repo>

<query>: an id (lc-0001, greedy/01), a LeetCode number (1), or part of a folder name (two-sum).
--no-record: the run is not the user's practice (Claude's runs): the study coach records nothing.`;
```

   - add `"no-record": { type: "boolean", default: false },` to the `parseArgs` options;
   - give `testCommand` a `record: EventSource | undefined` parameter and pass `{ root, record }` to `runTarget`;
   - call it as `testCommand(target, parseLang(values.lang, true), values.json, root, values["no-record"] ? undefined : "cli")`;
   - call `watchTarget(target, parseLang(values.lang, false) as Lang, { open: values.open, root, record: !values["no-record"] })`;
   - add `import type { EventSource } from "../../study/schema.ts";`.
3. `runner/src/watcher.ts`:
   - change the `node:fs` import to `import { existsSync, readFileSync, type Stats, statSync } from "node:fs";`;
   - import `recordSolutionChange` from `./recording.ts` and `type EventSource` from `../../study/schema.ts`;
   - replace `renderRun` and `watchTarget`'s cycle and return with the code below. Keep the `draw`/`notice`/`openInEditor` code between them.

```ts
/** One run as terminal text. Case-file problems are shown, not thrown, so watch keeps going. */
export async function renderRun(target: Target, lang: Lang, root: string, record?: EventSource): Promise<string> {
  try {
    return formatTerminal(await runTarget(target, lang, { root, record }));
  } catch (error) {
    if (error instanceof CaseFileError) {
      return `Case file error (not your code — fix the problem files):\n${error.message}`;
    }
    throw error;
  }
}
```

```ts
export async function watchTarget(
  target: Target,
  lang: Lang,
  options: { open: boolean; root: string; record?: boolean },
): Promise<Watcher> {
  const solution = ensureSolution(target, loadCaseFile(target.dir), lang).path;
  const record = options.record ?? false;
  // (notice, screen, draw and the --open block stay exactly as they are)
  let running = false;
  let again = false;
  /** A save of the solution asked for the pending run: that run is the user's and gets recorded. */
  let savedByUser = false;
  const cycle = async (afterSave = false): Promise<void> => {
    if (afterSave) savedByUser = true;
    if (running) {
      again = true;
      return;
    }
    running = true;
    do {
      again = false;
      const source: EventSource | undefined = record && savedByUser ? "watch" : undefined;
      savedByUser = false;
      screen = await renderRun(target, lang, options.root, source).catch(
        (error: unknown) => `Runner error: ${(error as Error).message}`,
      );
      draw();
    } while (again);
    running = false;
  };
  // The first run is like opening the problem: it records nothing (spec §7).
  await cycle();
  const onSave = (): void => {
    if (record && existsSync(solution)) recordSolutionChange(target, lang, readFileSync(solution, "utf8"), "edit", "watch");
    void cycle(true);
  };
  // Two folders (spec §10): the problem's own files, and the solution under .study. For a solution still in the
  // content folder both watchers look at the same folder, each for its own files.
  return combine([
    watchFiles(target.dir, ["cases.json", "stress.ts"], () => void cycle()),
    watchFiles(path.dirname(solution), [path.basename(solution)], onSave),
  ]);
}
```

- [ ] **Step 5: Record from the playground**

In `playground/server/solutions.ts`, import `recordSolutionChange` from `../../runner/src/recording.ts`. Then:
- in the PUT handler, right after `const result = writeSolution(…);`, add:

```ts
      // An autosave of the user's editor (spec §7): it can start the first attempt, or join the open one.
      if (result.ok) recordSolutionChange(target, body.lang, body.code, "save", "playground");
```

- in the `/run` handler, change the call to `runTarget(target, body.lang, { root, record: "playground" })`.

`/run-custom` records nothing: custom input is not judged, so it has no verdict to record.

- [ ] **Step 6: Run everything**

Run: `pnpm verify && pnpm e2e`

Expected:
- Everything is green.
- The e2e repo has no study database, so recording is off there.
- The e2e run proves that Vite's SSR loader imports `better-sqlite3` through `study/store.ts`.

- [ ] **Step 7: Commit**

```bash
git add runner/src/recording.ts runner/src/run.ts runner/src/cli.ts runner/src/watcher.ts playground/server/solutions.ts \
  runner/tests/recording.test.ts runner/tests/cli.test.ts runner/tests/watcher.test.ts playground/tests/server/solutions.test.ts playground/tests/server/helpers.ts
git commit -m "feat: record the user's saves and runs from pnpm test, pnpm watch and the playground; add --no-record"
```

---

### Task 14: `pnpm study status [--json]` and `pnpm study record …`

**Files:**
- Create: `study/status.ts`
- Modify: `study/commands.ts`
- Test: `study/tests/status.test.ts` (create)

**Interfaces:**
- Consumes:
  - the recording API (Task 12) and `openAttemptList` (Task 4);
  - `listTargets`, `resolveQuery`, `QueryError` (`runner/src/resolver.ts`) and `scanRepo` (`lib/repo.ts`);
  - `cards`, `conceptAcceptances` and the views (Task 2).
- Produces:
  - "Status" and the three JSON shapes exactly as listed in **Interfaces for Plans B and C**;
  - `describeItem`, `describeConcept`, `describeSummary` for the text output;
  - the commands `status` and `record hint|give-up|complexity|explanation`.
- **Exit codes:**
  - 0: done, including "not recorded" notes and a missing database;
  - 1: usage, an unknown id, an outdated database, or a complexity with no green attempt;
  - 2: a hint refused during an exam.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/status.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, makeStudyRepo } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { initStudy } from "../init.ts";
import { acceptExplanation, openAttempt, recordHint, recordWork } from "../record.ts";
import { cards, exams } from "../schema.ts";
import { inTransaction, openStudy, type Study } from "../store.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";

async function cli(root: string, ...argv: string[]) {
  let out = "";
  let err = "";
  const io: CliIo = { root, clock: fixedClock(T0), out: (text) => (out += text), err: (text) => (err += text) };
  const code = await runStudyCli(argv, io);
  return { code, out, err, json: () => JSON.parse(out) };
}

/** makeStudyRepo has problems lc-0001 and lc-0020, concepts arrays and hash-map, and exercise hash-map/01. */
function initialized(): { root: string; with: (fn: (study: Study) => void) => void } {
  const root = makeStudyRepo();
  initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
  return {
    root,
    with: (fn) => {
      const study = openStudy(root, { clock: fixedClock(T0) });
      try {
        fn(study);
      } finally {
        study.close();
      }
    },
  };
}

describe("pnpm study status <item> --json", () => {
  it("is empty before any work, then shows the open attempt with its hints", async () => {
    const repo = initialized();
    expect((await cli(repo.root, "status", "lc-0001", "--json")).json()).toEqual({
      initialized: true,
      id: "lc-0001",
      kind: "problem",
      status: "todo",
      everGreen: false,
      revealed: false,
      open: null,
      exam: false,
      concept: null,
      conceptLearned: null,
      nextDue: null,
    });
    repo.with((study) => recordHint(study, "lc-0001"));
    expect((await cli(repo.root, "status", "1", "--json")).json()).toMatchObject({
      id: "lc-0001",
      status: "in_progress",
      open: { kind: "new", hints: 1, startedAt: T0 },
    });
  });

  it("gives an exercise its concept and whether that concept is learned", async () => {
    const repo = initialized();
    expect((await cli(repo.root, "status", "hash-map/01", "--json")).json()).toMatchObject({ kind: "exercise", concept: "hash-map", conceptLearned: false });
    repo.with((study) => {
      acceptExplanation(study, "hash-map");
      recordWork(study, "hash-map/01", { type: "run", lang: "py", green: true }, "cli");
    });
    expect((await cli(repo.root, "status", "hash-map/01", "--json")).json()).toMatchObject({ status: "solved", everGreen: true, conceptLearned: true });
  });

  it("reports the next due date from the item's card", async () => {
    const repo = initialized();
    repo.with((study) =>
      study.db.insert(cards).values({ itemId: "lc-0020", due: new Date("2026-10-11T10:00:00.000Z"), stability: 3, difficulty: 5, scheduledDays: 7, learningSteps: 0, reps: 1, lapses: 0, state: 2 }).run(),
    );
    expect((await cli(repo.root, "status", "lc-0020", "--json")).json()).toMatchObject({ nextDue: "2026-10-11T10:00:00.000Z" });
  });

  it("marks an exam attempt, and record hint refuses it with exit 2 without counting", async () => {
    const repo = initialized();
    repo.with((study) =>
      inTransaction(study, (tx) => {
        const exam = tx.insert(exams).values({ list: "grind-75", seed: 1, startedAt: new Date(T0) }).returning().get();
        openAttempt(tx, "lc-0001", new Date(T0), { examId: exam.id });
      }),
    );
    expect((await cli(repo.root, "status", "lc-0001", "--json")).json()).toMatchObject({ exam: true, open: { kind: "exam", hints: 0 } });
    expect(await cli(repo.root, "record", "hint", "lc-0001")).toMatchObject({ code: 2, err: expect.stringContaining("exams take no hints") });
    expect((await cli(repo.root, "status", "lc-0001", "--json")).json()).toMatchObject({ open: { hints: 0 } });
  });
});

describe("pnpm study status <concept> --json and the summary", () => {
  it("lists a concept's exercises, whether its explanation is accepted, and whether it is learned", async () => {
    const repo = initialized();
    repo.with((study) => acceptExplanation(study, "hash-map"));
    expect((await cli(repo.root, "status", "hash-map", "--json")).json()).toEqual({
      initialized: true,
      id: "hash-map",
      kind: "concept",
      accepted: true,
      acceptedAt: T0,
      learned: false,
      exercises: [{ id: "hash-map/01", status: "todo", done: false }],
    });
  });

  it("summarizes what is in progress, solved and revealed, and lists orphans", async () => {
    const repo = initialized();
    repo.with((study) => {
      recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
      recordHint(study, "lc-0020");
      recordWork(study, "lc-9999", { type: "run", lang: "py", green: false }, "cli");
    });
    expect((await cli(repo.root, "status", "--json")).json()).toEqual({
      initialized: true,
      inProgress: [
        { id: "lc-0020", kind: "new", hints: 1, startedAt: T0 },
        { id: "lc-9999", kind: "new", hints: 0, startedAt: T0 },
      ],
      solved: ["lc-0001"],
      revealed: [],
      orphans: ["lc-9999"],
    });
    expect((await cli(repo.root, "status")).out).toBe("In progress: lc-0020 (new, 1 hint), lc-9999 (new, 0 hints). Orphans: lc-9999.\n");
  });
});

describe("before the study database exists", () => {
  it("status says initialized: false, and record says nothing was recorded, with exit 0", async () => {
    const root = makeStudyRepo();
    expect((await cli(root, "status", "lc-0001", "--json")).json()).toMatchObject({ initialized: false, status: "todo", everGreen: false, revealed: false });
    expect((await cli(root, "status", "--json")).json()).toEqual({ initialized: false, inProgress: [], solved: [], revealed: [], orphans: [] });
    expect(await cli(root, "record", "hint", "lc-0001")).toMatchObject({ code: 0, err: expect.stringContaining("Not recorded: there is no study database yet") });
  });
});

describe("pnpm study record", () => {
  it("records a hint, a give-up, a complexity and an explanation, and explains what it refused", async () => {
    const repo = initialized();
    expect(await cli(repo.root, "record", "hint", "lc-0001")).toMatchObject({ code: 0, out: "Recorded hint 1 for lc-0001.\n" });
    expect(await cli(repo.root, "record", "give-up", "lc-0001")).toMatchObject({ code: 0, out: "Recorded: lc-0001 given up (revealed).\n" });
    expect(await cli(repo.root, "record", "give-up", "lc-0001")).toMatchObject({ code: 0, out: "Not recorded: lc-0001 has no open attempt (it is solved or revealed).\n" });
    expect(await cli(repo.root, "record", "complexity", "lc-0020", "--time", "O(n)", "--space", "O(1)", "--optimal")).toMatchObject({
      code: 1,
      err: expect.stringContaining("Not recorded: lc-0020 has no green attempt"),
    });
    repo.with((study) => recordWork(study, "lc-0020", { type: "run", lang: "py", green: true }, "cli"));
    expect(await cli(repo.root, "record", "complexity", "lc-0020", "--time", "O(n)", "--space", "O(1)", "--not-optimal")).toMatchObject({
      code: 0,
      out: "Recorded complexity for lc-0020: time O(n), space O(1), not optimal.\n",
    });
    expect(await cli(repo.root, "record", "explanation", "hash-map")).toMatchObject({ code: 0, out: "Recorded: the hash-map explanation is accepted.\n" });
    expect(await cli(repo.root, "record", "explanation", "hash-map")).toMatchObject({ code: 0, out: "Already accepted on 2026-10-04: hash-map.\n" });
  });

  it("rejects unknown ids, fuzzy ids, complexity on an exercise, and a missing optimal flag", async () => {
    const repo = initialized();
    expect(await cli(repo.root, "record", "hint", "two-sum")).toMatchObject({ code: 1, err: expect.stringContaining('There is no problem or exercise with id "two-sum"') });
    expect(await cli(repo.root, "record", "explanation", "nope")).toMatchObject({ code: 1, err: expect.stringContaining('There is no concept "nope"') });
    expect(await cli(repo.root, "record", "complexity", "hash-map/01", "--time", "O(n)", "--space", "O(1)", "--optimal")).toMatchObject({
      code: 1,
      err: expect.stringContaining("problems only"),
    });
    expect(await cli(repo.root, "record", "complexity", "lc-0001", "--time", "O(n)", "--space", "O(1)")).toMatchObject({
      code: 1,
      err: expect.stringContaining("exactly one of --optimal and --not-optimal"),
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/status.test.ts`
Expected: FAIL. `status` and `record` print the usage and exit 1.

- [ ] **Step 3: Write the status module**

Create `study/status.ts`:

```ts
import { eq, inArray } from "drizzle-orm";
import { scanRepo } from "../lib/repo.ts";
import type { Target } from "../runner/src/types.ts";
import {
  type AttemptKind,
  attempts,
  attemptStats,
  cards,
  conceptAcceptances,
  type ItemStatusValue,
  itemStatusView,
  type Outcome,
} from "./schema.ts";
import type { InProgressItem } from "./state-file.ts";
import { openAttemptList } from "./state.ts";
import type { Study } from "./store.ts";

export interface OpenAttempt {
  attemptId: number;
  kind: AttemptKind;
  hints: number;
  startedAt: Date;
  examId: number | null;
}

/** Everything derived about one item (spec §4 views, §7). */
export interface ItemProgress {
  itemId: string;
  /** item_status; "todo" when the item has no attempts. */
  status: ItemStatusValue;
  everGreen: boolean;
  /** A past give-up (spec §8: replaces solution_revealed). */
  revealed: boolean;
  lastOutcome: Outcome | null;
  open: OpenAttempt | null;
  /** Hints of the open attempt, else of the latest attempt, else 0. */
  hints: number;
  /** cards.due; null until Plan B creates the item's card. */
  nextDue: Date | null;
}

export function emptyProgress(itemId: string): ItemProgress {
  return { itemId, status: "todo", everGreen: false, revealed: false, lastOutcome: null, open: null, hints: 0, nextDue: null };
}

/** Progress of every item with attempts or a card (or of `only` those ids), in one pass. */
export function allItemProgress(study: Study, only?: readonly string[]): Map<string, ItemProgress> {
  const progress = new Map<string, ItemProgress>();
  if (only && only.length === 0) return progress;
  const of = (itemId: string): ItemProgress => {
    let item = progress.get(itemId);
    if (!item) {
      item = emptyProgress(itemId);
      progress.set(itemId, item);
    }
    return item;
  };
  const ids = only ? [...only] : null;
  for (const row of study.db.select().from(itemStatusView).where(ids ? inArray(itemStatusView.itemId, ids) : undefined).all()) {
    Object.assign(of(row.itemId), { status: row.status, everGreen: row.everGreen, revealed: row.everGaveUp, lastOutcome: row.lastOutcome });
  }
  const attemptRows = study.db
    .select({
      itemId: attempts.itemId,
      attemptId: attempts.id,
      examId: attempts.examId,
      startedAt: attempts.startedAt,
      endedAt: attempts.endedAt,
      kind: attemptStats.kind,
      hints: attemptStats.hints,
    })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .where(ids ? inArray(attempts.itemId, ids) : undefined)
    .orderBy(attempts.startedAt, attempts.id)
    .all();
  for (const row of attemptRows) {
    const item = of(row.itemId);
    item.hints = row.hints; // oldest first, so the latest attempt wins (an open attempt is always the latest)
    if (row.endedAt === null) item.open = { attemptId: row.attemptId, kind: row.kind, hints: row.hints, startedAt: row.startedAt, examId: row.examId };
  }
  for (const row of study.db.select({ itemId: cards.itemId, due: cards.due }).from(cards).where(ids ? inArray(cards.itemId, ids) : undefined).all()) {
    of(row.itemId).nextDue = row.due;
  }
  return progress;
}

export function itemProgress(study: Study, itemId: string): ItemProgress {
  return allItemProgress(study, [itemId]).get(itemId) ?? emptyProgress(itemId);
}

/** An exercise is done when its latest closed attempt ended green: solved alone, even after an earlier give-up (spec §6.1). */
export function exerciseDone(progress: ItemProgress): boolean {
  return progress.lastOutcome === "green";
}

export interface ConceptProgress {
  slug: string;
  accepted: boolean;
  acceptedAt: Date | null;
  /** Accepted, and every exercise done (spec §4 concept_acceptances, §6.1). */
  learned: boolean;
  exercises: { id: string; status: ItemStatusValue; done: boolean }[];
}

export function conceptProgress(
  study: Study,
  slug: string,
  exerciseIds: readonly string[],
  progress: Map<string, ItemProgress> = allItemProgress(study, exerciseIds),
): ConceptProgress {
  const accepted = study.db.select().from(conceptAcceptances).where(eq(conceptAcceptances.concept, slug)).get();
  const exercises = exerciseIds.map((id) => {
    const item = progress.get(id) ?? emptyProgress(id);
    return { id, status: item.status, done: exerciseDone(item) };
  });
  return {
    slug,
    accepted: accepted !== undefined,
    acceptedAt: accepted?.acceptedAt ?? null,
    learned: accepted !== undefined && exercises.every((exercise) => exercise.done),
    exercises,
  };
}

/** `pnpm -s study status <item> --json` (spec §7). */
export interface ItemStatusJson {
  initialized: boolean;
  id: string;
  kind: "problem" | "exercise";
  status: ItemStatusValue;
  everGreen: boolean;
  revealed: boolean;
  open: { kind: AttemptKind; hints: number; startedAt: string } | null;
  exam: boolean;
  concept: string | null;
  conceptLearned: boolean | null;
  nextDue: string | null;
}

/** `pnpm -s study status <concept> --json`. */
export interface ConceptStatusJson {
  initialized: boolean;
  id: string;
  kind: "concept";
  accepted: boolean;
  acceptedAt: string | null;
  learned: boolean;
  exercises: { id: string; status: ItemStatusValue; done: boolean }[];
}

/** `pnpm -s study status --json`. */
export interface SummaryJson {
  initialized: boolean;
  inProgress: InProgressItem[];
  solved: string[];
  revealed: string[];
  /** Ids with progress whose content no longer exists (spec §13). */
  orphans: string[];
}

const exercisesOf = (root: string, slug: string): string[] =>
  scanRepo(root)
    .exercises.filter((exercise) => exercise.concept === slug)
    .map((exercise) => exercise.folderId);

export function itemStatusJson(study: Study | null, root: string, target: Target): ItemStatusJson {
  const item = study ? itemProgress(study, target.id) : emptyProgress(target.id);
  const concept = target.kind === "exercise" ? target.id.split("/")[0] : null;
  return {
    initialized: study !== null,
    id: target.id,
    kind: target.kind,
    status: item.status,
    everGreen: item.everGreen,
    revealed: item.revealed,
    open: item.open ? { kind: item.open.kind, hints: item.open.hints, startedAt: item.open.startedAt.toISOString() } : null,
    exam: item.open !== null && item.open.examId !== null,
    concept,
    conceptLearned: concept === null ? null : study ? conceptProgress(study, concept, exercisesOf(root, concept)).learned : false,
    nextDue: item.nextDue?.toISOString() ?? null,
  };
}

export function conceptStatusJson(study: Study | null, root: string, slug: string): ConceptStatusJson {
  const ids = exercisesOf(root, slug);
  const concept = study
    ? conceptProgress(study, slug, ids)
    : { accepted: false, acceptedAt: null, learned: false, exercises: ids.map((id) => ({ id, status: "todo" as const, done: false })) };
  return {
    initialized: study !== null,
    id: slug,
    kind: "concept",
    accepted: concept.accepted,
    acceptedAt: concept.acceptedAt?.toISOString() ?? null,
    learned: concept.learned,
    exercises: concept.exercises,
  };
}

export function summaryJson(study: Study | null, root: string): SummaryJson {
  if (!study) return { initialized: false, inProgress: [], solved: [], revealed: [], orphans: [] };
  const progress = [...allItemProgress(study).values()];
  const repo = scanRepo(root);
  const known = new Set([...repo.problems.map((p) => p.folderId), ...repo.exercises.map((e) => e.folderId), ...repo.concepts.map((c) => c.slug)]);
  const ids = [...progress.map((item) => item.itemId), ...study.db.select({ concept: conceptAcceptances.concept }).from(conceptAcceptances).all().map((row) => row.concept)];
  return {
    initialized: true,
    inProgress: openAttemptList(study),
    solved: progress.filter((item) => item.everGreen).map((item) => item.itemId).sort(),
    revealed: progress.filter((item) => item.revealed).map((item) => item.itemId).sort(),
    orphans: [...new Set(ids)].filter((id) => !known.has(id)).sort(),
  };
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;
const NO_DATABASE = " (no study database yet)";

export function describeItem(json: ItemStatusJson): string {
  const parts = [json.id, json.status.replace("_", " ")];
  if (json.open) parts.push(`${json.open.kind} attempt, ${plural(json.open.hints, "hint")}`);
  if (json.revealed) parts.push("revealed before");
  parts.push(`next review: ${json.nextDue ?? "none"}`);
  return parts.join(" · ") + (json.initialized ? "" : NO_DATABASE);
}

export function describeConcept(json: ConceptStatusJson): string {
  const exercises = json.exercises.map((exercise) => `${exercise.id} ${exercise.done ? "done" : exercise.status.replace("_", " ")}`).join(", ");
  return (
    [json.id, `explanation ${json.accepted ? "accepted" : "not accepted"}`, json.learned ? "learned" : "not learned", `exercises: ${exercises || "none"}`].join(" · ") +
    (json.initialized ? "" : NO_DATABASE)
  );
}

export function describeSummary(json: SummaryJson): string {
  const open = json.inProgress.map((item) => `${item.id} (${item.kind}, ${plural(item.hints, "hint")})`).join(", ");
  return `In progress: ${open || "nothing"}. Orphans: ${json.orphans.join(", ") || "none"}.${json.initialized ? "" : NO_DATABASE}`;
}
```

- [ ] **Step 4: Add the commands**

In `study/commands.ts`:

1. Add these imports:

```ts
import { scanRepo } from "../lib/repo.ts";
import { listTargets, QueryError, resolveQuery } from "../runner/src/resolver.ts";
import type { Target } from "../runner/src/types.ts";
import { acceptExplanation, giveUp, recordComplexity, recordHint } from "./record.ts";
import { conceptStatusJson, describeConcept, describeItem, describeSummary, itemStatusJson, summaryJson } from "./status.ts";
import { openStudy, type Study, StudyNotInitializedError } from "./store.ts";
```

   Merge the last line with the existing `StudySchemaOutdatedError` import.
2. Add the code below the `initCommand` function.
3. Add `case "status": return statusCommand(rest, io);` and `case "record": return recordCommand(rest, io);` to the `switch`.
4. In the `catch`, before the existing `if`, add:

```ts
    if (error instanceof QueryError) {
      const list = error.candidates.map((target) => `  ${target.id.padEnd(16)} ${target.title}`).join("\n");
      io.err(`${error.message}\n${list}${list ? "\n" : ""}`);
      return 1;
    }
```

```ts
/** The study, or null before `pnpm study init` / `migrate`. An outdated schema still throws. */
function openOrNull(io: CliIo): Study | null {
  try {
    return openStudy(io.root, { clock: io.clock });
  } catch (error) {
    if (error instanceof StudyNotInitializedError) return null;
    throw error;
  }
}

const NOT_INITIALIZED =
  "Not recorded: there is no study database yet. The user runs `pnpm study init` (new repo) or `pnpm study migrate` (existing repo).\n";

/** Runs `fn` on the study; before init, prints NOT_INITIALIZED and succeeds (skills keep going, spec §13). */
function withStudy(io: CliIo, fn: (study: Study) => number): number {
  const study = openOrNull(io);
  if (!study) {
    io.err(NOT_INITIALIZED);
    return 0;
  }
  try {
    return fn(study);
  } finally {
    study.close();
  }
}

/** An exact problem or exercise id: the record commands never guess (skills always pass the id). */
function exactTarget(root: string, id: string | undefined): Target {
  if (!id) throw new UsageError(`Give a problem or exercise id.\n\n${USAGE}`);
  const target = listTargets(root).find((candidate) => candidate.id === id);
  if (!target) throw new UsageError(`There is no problem or exercise with id "${id}". Use its exact id (lc-0001, hash-map/01).`);
  return target;
}

type Found = { kind: "target"; target: Target } | { kind: "concept"; slug: string };

/** status takes an exact item id, a concept slug, or anything `pnpm test` understands. */
function findForStatus(root: string, query: string): Found {
  const targets = listTargets(root);
  const exact = targets.find((target) => target.id === query);
  if (exact) return { kind: "target", target: exact };
  if (scanRepo(root).concepts.some((concept) => concept.slug === query)) return { kind: "concept", slug: query };
  return { kind: "target", target: resolveQuery(targets, query) };
}

function statusCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: "boolean", default: false } } }),
  );
  const query = positionals.join(" ").trim();
  const found = query ? findForStatus(io.root, query) : null;
  const study = openOrNull(io);
  try {
    const print = (json: object, text: string): void => io.out(values.json ? `${JSON.stringify(json, null, 2)}\n` : `${text}\n`);
    if (!found) {
      const json = summaryJson(study, io.root);
      print(json, describeSummary(json));
    } else if (found.kind === "concept") {
      const json = conceptStatusJson(study, io.root, found.slug);
      print(json, describeConcept(json));
    } else {
      const json = itemStatusJson(study, io.root, found.target);
      print(json, describeItem(json));
    }
    return 0;
  } finally {
    study?.close();
  }
}

function recordCommand(args: string[], io: CliIo): number {
  const [what, ...rest] = args;
  if (what === "hint" || what === "give-up") {
    const { positionals } = parsed(() => parseArgs({ args: rest, strict: true, allowPositionals: true, options: {} }));
    const target = exactTarget(io.root, positionals[0]);
    return withStudy(io, (study) => {
      if (what === "give-up") {
        const result = giveUp(study, target.id);
        io.out(result.recorded ? `Recorded: ${target.id} given up (revealed).\n` : `Not recorded: ${target.id} has no open attempt (it is solved or revealed).\n`);
        return 0;
      }
      const result = recordHint(study, target.id);
      if (result.recorded) {
        io.out(`Recorded hint ${result.hints} for ${target.id}.\n`);
        return 0;
      }
      if (result.reason === "exam") {
        io.err(`Refused: ${target.id} is in an exam attempt, and exams take no hints.\n`);
        return 2;
      }
      io.out(`Not recorded: ${target.id} has no open attempt (it is solved or revealed).\n`);
      return 0;
    });
  }
  if (what === "complexity") {
    const { values, positionals } = parsed(() =>
      parseArgs({
        args: rest,
        strict: true,
        allowPositionals: true,
        options: {
          time: { type: "string" },
          space: { type: "string" },
          optimal: { type: "boolean", default: false },
          "not-optimal": { type: "boolean", default: false },
        },
      }),
    );
    const target = exactTarget(io.root, positionals[0]);
    if (target.kind !== "problem") throw new UsageError(`complexity is recorded for problems only (${target.id} is an exercise)`);
    const time = values.time;
    const space = values.space;
    if (!time || !space) throw new UsageError(`record complexity needs --time and --space\n\n${USAGE}`);
    if (values.optimal === values["not-optimal"]) throw new UsageError(`record complexity needs exactly one of --optimal and --not-optimal\n\n${USAGE}`);
    const optimal = values.optimal;
    return withStudy(io, (study) => {
      const result = recordComplexity(study, target.id, { time, space, optimal });
      if (!result.recorded) {
        io.err(`Not recorded: ${target.id} has no green attempt. The user's own run (pnpm test, pnpm watch or ▶ Run) records green.\n`);
        return 1;
      }
      io.out(`Recorded complexity for ${target.id}: time ${time}, space ${space}, ${optimal ? "optimal" : "not optimal"}.\n`);
      return 0;
    });
  }
  if (what === "explanation") {
    const { positionals } = parsed(() => parseArgs({ args: rest, strict: true, allowPositionals: true, options: {} }));
    const slug = positionals[0];
    if (!slug) throw new UsageError(`Give a concept slug.\n\n${USAGE}`);
    if (!scanRepo(io.root).concepts.some((concept) => concept.slug === slug)) throw new UsageError(`There is no concept "${slug}".`);
    return withStudy(io, (study) => {
      const result = acceptExplanation(study, slug);
      io.out(result.already ? `Already accepted on ${result.acceptedAt.toISOString().slice(0, 10)}: ${slug}.\n` : `Recorded: the ${slug} explanation is accepted.\n`);
      return 0;
    });
  }
  throw new UsageError(USAGE);
}
```

- [ ] **Step 5: Run the tests and the suite**

Run: `pnpm vitest run study/tests/status.test.ts study/tests/init.test.ts study/tests/migrate.test.ts && pnpm verify`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add study/status.ts study/commands.ts study/tests/status.test.ts
git commit -m "feat(study): add pnpm study status --json and pnpm study record for the skills"
```

---

### Task 15: The reminder reads `state.json`; skills and `CLAUDE.md` go through the study CLI

**Files:**
- Modify: `.claude/hooks/reminder.mjs`
- Modify: `.claude/skills/hint/SKILL.md`, `.claude/skills/give-up/SKILL.md`, `.claude/skills/review/SKILL.md`, `.claude/skills/concept/SKILL.md`, `.claude/skills/problem/SKILL.md`
- Modify: `CLAUDE.md`
- Test: `scripts/tests/hooks.test.ts`, `scripts/tests/claude-layer.test.ts`

**Interfaces:**
- Consumes: `.study/state.json` (Task 4); `pnpm -s study status|record` (Task 14); `--no-record` (Task 13).
- Produces:
  - **The reminder** lists `In progress: <id> (<kind>, hints <n>), …` from `state.json` when that file exists, and falls back to the legacy README scan otherwise.
  - **The skills** never write progress into READMEs. Their templates keep the old fields until Task 19, because the schema still requires them until Task 18.
  - **`CLAUDE.md` rule 1** reads solved/revealed from `study status` (spec §8). It never volunteers a solved problem's code, and warns when `nextDue` is less than 14 days away.

- [ ] **Step 1: Write the failing tests**

In `scripts/tests/hooks.test.ts`, inside `describe("reminder hook", …)`:
- in the first test, change `"2. Never edit solution.py / solution.ts."` to `"2. Never edit solution files or anything under .study/."`;
- append:

```ts
  it("lists the open attempts from .study/state.json once the study store exists, ignoring old frontmatter", () => {
    const root = makeTempDir("algo-hook-");
    put(root, "problems/lc-0001-two-sum/README.md", "---\nid: lc-0001\nstatus: solving\nhints: 1\n---\n");
    put(
      root,
      ".study/state.json",
      JSON.stringify({ version: "abc", phase: null, inProgress: [{ id: "lc-0020", kind: "review", hints: 2, startedAt: "2026-10-04T10:00:00.000Z" }], today: null }),
    );
    const context = hook("reminder.mjs", { prompt: "hola" }, root).hookSpecificOutput.additionalContext as string;
    expect(context).toContain("In progress: lc-0020 (review, hints 2).");
    expect(context).not.toContain("lc-0001");
    expect(context).toContain("--no-record");
  });

  it("reads state.json from ALGO_STUDY and says when nothing is open", () => {
    const root = makeTempDir("algo-hook-");
    const study = makeTempDir("algo-progress-");
    put(study, "state.json", JSON.stringify({ version: "abc", phase: null, inProgress: [], today: null }));
    put(root, "problems/lc-0001-two-sum/README.md", "---\nid: lc-0001\nstatus: solving\nhints: 1\n---\n");
    const context = hook("reminder.mjs", { prompt: "hola" }, root, { ALGO_STUDY: study }).hookSpecificOutput.additionalContext as string;
    expect(context).toContain("In progress: nothing.");
  });
```

In `scripts/tests/claude-layer.test.ts`, append:

```ts
describe("progress goes through the study CLI (study coach spec §7, §8)", () => {
  const text = (name: string) => readFileSync(path.join(REPO_ROOT, ".claude", "skills", name, "SKILL.md"), "utf8");

  it.each([
    ["hint", ["pnpm -s study status <id> --json", "pnpm -s study record hint <id>", "--no-record", "exam"]],
    ["give-up", ["pnpm -s study record give-up <id>"]],
    ["review", ["--no-record", "pnpm -s study status <id> --json", "pnpm -s study record complexity <id>"]],
    ["concept", ["pnpm -s study status <slug> --json", "pnpm -s study record explanation <slug>"]],
    ["problem", ["pnpm -s study status <slug> --json"]],
  ])("%s reads and records through the CLI", (name, phrases) => {
    for (const phrase of phrases) expect(text(name)).toContain(phrase);
  });

  it("hint, give-up and review no longer write progress into READMEs", () => {
    for (const name of ["hint", "give-up", "review"]) {
      for (const stale of ["solution_revealed", "solved_in", "to the Log", "set it to `solving`", "pnpm -s sync"]) {
        expect(text(name), `${name}: ${stale}`).not.toContain(stale);
      }
    }
  });

  it("CLAUDE.md reads solved and revealed from study status and runs tests with --no-record", () => {
    const claude = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(claude).toContain("pnpm -s study status <id> --json");
    expect(claude).toContain("`everGreen: true`");
    expect(claude).toContain("never volunteer a solved problem's code or approach");
    expect(claude).toContain("pnpm -s test <query> --lang all --json --no-record");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run scripts/tests/hooks.test.ts scripts/tests/claude-layer.test.ts`
Expected: FAIL. The reminder ignores `state.json` and the skills still edit frontmatter.

- [ ] **Step 3: The reminder**

In `.claude/hooks/reminder.mjs`, replace `RULES` with:

```js
const RULES = [
  "[algorithms study rules — see CLAUDE.md]",
  "1. No solution code or pseudocode for problems/exercises that are not solved or revealed " +
    "(pnpm -s study status <id> --json: everGreen / revealed). Never volunteer a solved problem's code or approach.",
  "2. Never edit solution files or anything under .study/.",
  "3. 'Help' or 'why does it fail' on unsolved work = the hint skill, one level at a time. " +
    "Language/syntax questions are not hints: answer with small generic examples that do not reveal the approach.",
  "4. Never describe hidden cases beyond the runner output.",
  "5. Optimal solution only when green AND explicitly asked, or via /give-up.",
  "Your own test runs: pnpm -s test <id> --lang all --json --no-record.",
  "Chat in Spanish; write files in English.",
];
```

Add after `inProgress`:

```js
/** Open attempts from .study/state.json (study coach spec §4), or null before `pnpm study init` / `migrate`. */
function fromState(root) {
  try {
    const state = JSON.parse(readFileSync(path.join(studyDir(root), "state.json"), "utf8"));
    if (!Array.isArray(state.inProgress)) return null;
    return state.inProgress.map((item) => `${item.id} (${item.kind}, hints ${item.hints})`);
  } catch {
    return null;
  }
}
```

and inside the `try`, replace the `inProgressItems` expression with:

```js
  const inProgressItems =
    fromState(root) ??
    items(root)
      .map((item) => ({ item, text: readFileSync(path.join(item.dir, "README.md"), "utf8") }))
      .filter(({ item, text }) => inProgress(root, item, text))
      .map(({ text }) => `${field(text, "id")} (hints ${field(text, "hints") ?? "0"})`);
```

Update the doc comment of `inProgress` to start with `LEGACY, until pnpm study migrate:`.

- [ ] **Step 4: The hint skill**

Replace the body of `.claude/skills/hint/SKILL.md` below the frontmatter (keep the frontmatter as it is) with:

```markdown
# hint — one level at a time

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

**First, is it a hint request at all?** The user has almost no Python experience, so many questions are about the language, not the problem:

- **Language questions are not hints:** "¿cómo declaro un dict en Python?", "¿qué hace enumerate?", "¿cómo se escribe un for en TS?", "¿cómo ordeno una lista?". Answer directly, briefly, with a small generic example unrelated to the current problem: different names, different data, and not the pattern the problem needs. Record nothing.
- **Approach questions dressed as syntax are hints:** "¿cómo uso un dict para resolver esto?", "¿con qué estructura guardo lo que ya vi?". They ask how to solve the problem, so follow the steps below.
- **When in doubt,** answer only the language part, generically, and ask whether they also want a hint.

1. **Target:** the problem or exercise the user names. If they name none and exactly one item is in progress, use that one. Otherwise, ask which one. The reminder context lists the items in progress (open attempts).
2. **Status:** run `pnpm -s study status <id> --json`.
   - `exam: true`: this is an exam attempt. Say in one sentence that exams take no hints, and stop. Do not run `study record hint`.
   - `initialized: false`: there is no study database yet. Hints still work, but nothing is counted: take the current level from this conversation.
   - Otherwise the current level is `open.hints` (0 when `open` is null).
3. **Next level = current level + 1:**
   - **Level 1 — one Socratic question.** It points at the key insight without naming any steps. You may read the user's solution file (`.study/solutions/…/solution.<lang>`, or `solution.<lang>` in the item's folder until `pnpm study migrate`) to aim the question at their current approach (for example, at what their inner loop keeps recomputing). Do not state the answer.
   - **Level 2 — the key idea in plain words**, in 1–3 sentences. No code, no pseudocode, no step-by-step algorithm, no variable names.
   - **Already at level 2:** no more hints. Point to the concept notes linked in the README and to their exercises, and mention that `/give-up` exists (the user has to type it).
4. **Already solved** (`everGreen: true` and `open: null`): the same ladder applies to reaching a better complexity. There is no open attempt to count it on, so take the level from this conversation; `study record hint` answers "Not recorded".
5. **"Why does it fail?":** run `pnpm -s test <id> --lang all --json --no-record` and use only what it reports: the failing input and the user's own output or error. Never reveal other hidden inputs or any expected value. `--no-record` is mandatory: your runs are not the user's practice.
6. **Record:** if you gave a level 1 or 2 hint, run `pnpm -s study record hint <id>`. At the maximum level, record nothing. Never edit README frontmatter or add Log lines: progress lives in `.study/`.
7. **Reply** with the hint and nothing else.
```

- [ ] **Step 5: The give-up skill**

Replace the body of `.claude/skills/give-up/SKILL.md` below the frontmatter with:

```markdown
# give-up — reveal, record, plan a retry

Reply in Spanish.

1. **Target:** as in the `hint` skill.
2. **Ask once:** "¿Seguro? Te muestro la solución óptima y el problema queda marcado como revealed." Then wait.
   - A clear yes: go on to step 3.
   - Anything else means stop. Record nothing.
3. **Explain in chat:**
   - the key insight;
   - the approach, step by step;
   - the optimal solution, in the language the user has been using;
   - its time and space complexity;
   - links to the relevant concept notes.

   Never write the solution to any file.
4. **Record:** run `pnpm -s study record give-up <id>`. It closes the open attempt as given up, so `study status` reports `revealed: true` from now on. "Not recorded" means the item had no open attempt (already solved or revealed), or there is no study database yet; both are fine. Never edit README frontmatter.
5. **Suggest** retrying from scratch in a few days without looking at the solution.
```

- [ ] **Step 6: The review skill**

Replace the body of `.claude/skills/review/SKILL.md` below the frontmatter with:

```markdown
# review — confirm green, measure, record

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

1. **Target:** as in the `hint` skill.
2. **Run** `pnpm -s test <id> --lang all --json --no-record` and parse the array. `--no-record` is mandatory: your run must not count as the user's.
3. **Not green in any language:** tell the user which phase fails in each language (load error, examples, hidden, stress) and stop. Debugging help goes through the `hint` skill.
4. **Green:** run `pnpm -s study status <id> --json`. If `initialized` is true and `everGreen` is false, the user's own run has not recorded the green yet (yours never does): ask them to run it themselves (▶ Run in the playground, `pnpm test <id>`, or a save under `pnpm watch`), then go on.
5. **Analyze:** read the user's solution for each green language (`.study/solutions/…/solution.<lang>`, or `solution.<lang>` in the item's folder until `pnpm study migrate`) and work out its time and space complexity (Big-O in terms of the input names). Compare it with the best known complexity for this problem.
6. **Record (problems only):** `pnpm -s study record complexity <id> --time "O(…)" --space "O(…)" --optimal` (or `--not-optimal`). Skip it when `initialized` is false. Never edit README frontmatter or add Log lines.
7. **Reply:**
   - Give the complexity of their code.
   - If it is not optimal, say only "Existe una solución O(…) en tiempo" (or in space), and nothing about how to get there. Offer the `hint` skill if they want to go for it.
8. **Show the optimal solution** only if the user then explicitly asks to see it:
   - Show it **in chat**, with a short explanation.
   - Never write it to a file.
```

- [ ] **Step 7: The concept and problem skills**

In `.claude/skills/concept/SKILL.md`:

1. Replace the paragraph under `## Existing concept` with:

```markdown
If `concepts/<slug>/` already exists, do not recreate or rewrite any of it. Teach it Socratically, as in the last bullet of Create mode step 6.
```

2. In Create mode step 2's **Template** bullet, replace `(check \`INDEX.md\`)` with `(\`pnpm -s study status --json\` lists \`solved\` and \`revealed\`; with \`initialized: false\`, treat every problem as unsolved)`.
3. In step 4, replace the last bullet with:

```markdown
   - Exercises practise the concept in isolation and must not be isomorphic to an unsolved problem (the same check as the Template).
```

4. Replace the whole `## Review mode` section with:

```markdown
## Review mode ("revisa mi explicación", "¿ya domino X?")

1. Read the user's explanation: `.study/explanations/<slug>.md` or, until `pnpm study migrate`, the README's "My explanation" section. Give feedback in Spanish. Say what is right, then ask questions about what is missing or wrong instead of correcting it directly.
2. Run `pnpm -s study status <slug> --json`. Each exercise's `done` says whether the user solved it alone in their latest attempt. Do not run the exercises yourself to judge them.
3. When the explanation has real content and you accept it, run `pnpm -s study record explanation <slug>`. `learned` turns true once the explanation is accepted and every exercise is done; otherwise say exactly what is missing. Never edit the concept's frontmatter.
```

In `.claude/skills/problem/SKILL.md`, replace step 6's items 2 and 3 with:

```markdown
2. For each concept, run `pnpm -s study status <slug> --json`: `learned: true` reads as mastered; `accepted: true`, or any exercise that is not `todo`, reads as learning; otherwise new. A concept with no folder is **missing**.
3. For each concept that is not learned, walk its `requires` and collect the prerequisites that are not learned either.
```

- [ ] **Step 8: `CLAUDE.md`**

1. Replace hard rule 1 with:

```markdown
1. Never write, show, or paraphrase code or pseudocode that solves a problem or exercise the user has not solved or revealed. `pnpm -s study status <id> --json` tells you: solved is `everGreen: true`, revealed is `revealed: true`; with `initialized: false`, treat every item as neither. Solved problems come back as reviews, so never volunteer a solved problem's code or approach either: show them only on an explicit request, and first warn when its `nextDue` is less than 14 days away. Concept templates and exercises must not be isomorphic to any problem the user has not solved (`pnpm -s study status --json` lists `solved` and `revealed`).
```

2. Replace hard rule 2 with:

```markdown
2. Never edit the user's solution files — `.study/solutions/…/solution.py` / `solution.ts`, and, until `pnpm study migrate`, `solution.py` / `solution.ts` inside `problems/` or `concepts/` — nor anything else under `.study/` (a hook blocks it). You do not fix the user's bugs. Do not run commands that can discard or delete them either (`git checkout`/`restore`/`stash`/`reset --hard`/`clean -f`, `rm` of solution files or of folders that hold them): ask the user to run those themselves.
```

3. In `## Commands`, replace the `pnpm -s test` bullet with the first bullet below, and insert the other two after it:

```markdown
- `pnpm -s test <query> --lang all --json --no-record`: runs once, only in the languages that already have a solution file. Always pass `--no-record`: without it the run counts as the user's practice. Never omit `--lang`: the default (`py`) creates `solution.py` when it is missing. `green: true` means examples, hidden and stress all pass.
- `pnpm -s study status [<id>] [--json]`: the user's progress for a problem, an exercise, a concept, or (with no id) everything in progress, solved and revealed. It is the single source for "solved", "revealed", hint counts and exams.
- `pnpm -s study record hint|give-up|complexity|explanation …`: what the `hint`, `give-up`, `review` and `concept` skills record. Nothing else writes progress. The user alone runs `pnpm study migrate|start|pause|resume` and `pnpm study phase set` (a hook blocks them for you). Run `pnpm -s study curriculum set <preset>` only when the user explicitly asks to switch lists.
```

4. Change the `pnpm play` bullet's last sentence to: `It writes the user's solution files (autosave), records their saves and runs, and writes "My explanation": treat what it writes as the user's own edits.`
5. In `## Vocabulary`, replace the first three bullets (`Problem/exercise \`status\`…`, `**In progress** = …`, `Concept \`status\`…`) with:

```markdown
- **Progress** lives in `.study/study.db`, never in READMEs. READMEs written before `pnpm study migrate` still carry `status`, `hints`, `solution_revealed`, `solved_in`, `complexity` and a `## Log`: ignore those fields and never update them.
- **Attempt:** one try at an item. It starts with the user's first real edit or run (opening a problem starts nothing) and ends at the first green run or a give-up. `study status` gives `status` (todo · in_progress · solved · revealed), `open.kind` (new · review · exam) and `open.hints` (0–2).
- **In progress** = an open attempt. The reminder lists these items.
- **Concept progress:** `accepted` (the `concept` skill accepted the explanation) and `learned` (accepted, and every exercise done), from `pnpm -s study status <slug> --json`.
```

   and replace the `Log lines` bullet with `- Log lines: only the problem template's \`- YYYY-MM-DD · registered\`; progress is never logged in READMEs.`

- [ ] **Step 9: Run the tests**

Run: `pnpm vitest run scripts/tests/hooks.test.ts scripts/tests/claude-layer.test.ts && pnpm verify`
Expected: all green; `CLAUDE.md` still has seven numbered hard rules.

- [ ] **Step 10: Commit**

```bash
git add .claude/hooks/reminder.mjs .claude/skills/hint/SKILL.md .claude/skills/give-up/SKILL.md .claude/skills/review/SKILL.md \
  .claude/skills/concept/SKILL.md .claude/skills/problem/SKILL.md CLAUDE.md scripts/tests/hooks.test.ts scripts/tests/claude-layer.test.ts
git commit -m "feat(claude): read and record progress through the study CLI; the reminder reads .study/state.json"
```

---

## Milestone M5: the content strip (code only; the user's READMEs are stripped later by `pnpm study migrate`)

**The transition, decided here:**
- From this milestone on, the code treats content as pure. It still accepts the READMEs and solution files written before the study coach, until the user migrates:
  - **`check`** reports personal data in content as **one warning** while `.study/study.db` does not exist, and as **one error per place** once it does. It never fails `pnpm verify` on the unmigrated real repo.
  - **The playground** reads statuses from the store's `item_status` view once the database exists, and from the old frontmatter before that (frozen, since Task 15 stopped writing it).
- **Why the database file is the switch, not the `.study/` folder:** since Task 6, merely opening a problem creates `.study/solutions/…` stubs, so the folder exists before any migration. Only `study init` and `study migrate` create `study.db`. A user who ran only `init` gets errors that say to run `migrate`.
- **No README in the real repo is changed by this plan.** The migration strips them, and it regenerates the indexes with the content-only renderer of Task 17.

### Task 16: The playground reads statuses from the store, and keeps "My explanation" in `.study/explanations`

**Files:**
- Create: `study/tests/seed.ts`
- Modify: `playground/server/targets.ts`, `playground/server/concepts.ts`, `playground/server/events.ts`, `playground/server/types.ts`
- Modify: `lib/explanation.ts` (drop `explanationIssues`), `scripts/tests/explanation.test.ts`
- Modify: `playground/e2e/fixture.ts`, `playground/e2e/live.spec.ts`
- Test: `playground/tests/server/targets.test.ts`, `playground/tests/server/concepts.test.ts`, `playground/tests/server/events.test.ts`

**Interfaces:**
- Consumes:
  - `cachedStudy` (Task 3) and `allItemProgress`, `conceptProgress`, `emptyProgress` (Task 14);
  - `studyRoot` (Task 1) and `splitExplanation` (Task 10).
- Produces:
  - in `playground/server/targets.ts`: `loadProgress(root): Progress | null`, `itemView(entry, progress): ItemView`, `conceptView(concept, exercises, progress): ConceptStatus`. `ItemStatus` stays as a derived type (spec §10): `in_progress` → `"solving"`. `inProgress` is true exactly when an attempt is open.
  - in `playground/server/concepts.ts`: `explanationFile(root, slug)` and `conceptData(root, concept)`.
    - `GET /api/concept` reads `.study/explanations/<slug>.md`, falling back to the README section's text before migration.
    - `PUT /api/concept/explanation` writes that file and never the README.
    - `ConceptData.version` hashes the README and the explanation file together.
  - `RepoEvent`: a change to `.study/explanations/<slug>.md` is `{ kind: "readme", concept: slug }`.
  - `study/tests/seed.ts`: `SEED_AT`, `resetStudy(root, clock?)`, `seedClosedAttempt(root, itemId, outcome, at?)`, `seedOpenAttempt(root, itemId, { hints?, at? })`, `seedAcceptance(root, slug)`.

- [ ] **Step 1: Write the seed helpers**

Create `study/tests/seed.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing tests**

1. In `playground/tests/server/targets.test.ts`, import `{ resetStudy, seedClosedAttempt, seedOpenAttempt }` from `../../../study/tests/seed.ts`. Then append:

```ts
describe("statuses from the study store (study coach spec §10)", () => {
  it("come from recorded attempts once the store exists, ignoring the old frontmatter", async () => {
    const root = makeRepo();
    resetStudy(root);
    seedOpenAttempt(root, "lc-0020", { hints: 1 });
    seedClosedAttempt(root, "hash-map/01", "gave_up");
    const app = createApp({ root });
    const { body } = await json(await call(app, "/api/home"));
    expect(body.problems.map((p: { id: string; status: string; inProgress: boolean }) => [p.id, p.status, p.inProgress])).toEqual([
      ["lc-0001", "todo", false],
      ["lc-0020", "solving", true],
    ]);
    expect(body.concepts[0]).toMatchObject({ status: "learning", exercises: [{ id: "hash-map/01", status: "revealed", inProgress: false }] });
    expect((await json(await call(app, "/api/target?id=lc-0020"))).body).toMatchObject({ status: "solving", hints: 1 });
  });

  it("keep reading the old frontmatter while there is no study database", async () => {
    const root = makeRepo();
    put(
      root,
      "problems/lc-0001-two-sum/README.md",
      "---\nid: lc-0001\ntitle: Two Sum\ndifficulty: easy\npatterns: [arrays-hashing]\nconcepts: [hash-map]\nstatus: solved\nhints: 2\n---\n# Two Sum\n",
    );
    const app = createApp({ root });
    expect((await json(await call(app, "/api/home"))).body.problems[0]).toMatchObject({ id: "lc-0001", status: "solved" });
    expect((await json(await call(app, "/api/target?id=lc-0001"))).body).toMatchObject({ status: "solved", hints: 2 });
  });
});
```

2. Replace `playground/tests/server/concepts.test.ts` with:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { resetStudy, seedAcceptance, seedClosedAttempt, seedOpenAttempt } from "../../../study/tests/seed.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

// The root tsconfig has no DOM lib, so `Response` here is @types/node's (undici-types), whose
// `.json()` returns `Promise<unknown>` rather than DOM's `Promise<any>`. Cast once here, as
// targets.test.ts does; each test asserts the actual shape it expects.
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

const README = "concepts/hash-map/README.md";
const EXPLANATION = ".study/explanations/hash-map.md";
const putExplanation = async (app: ReturnType<typeof createApp>, text: string, baseVersion: string) =>
  call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "hash-map", text, baseVersion } });
const getConcept = async (app: ReturnType<typeof createApp>, slug = "hash-map") => (await json(await call(app, `/api/concept?slug=${slug}`))).body;

describe("GET /api/concept", () => {
  it("returns the note split around My explanation, and a version", async () => {
    const root = makeRepo();
    const { status, body: concept } = await json(await call(createApp({ root }), "/api/concept?slug=hash-map"));
    expect(status).toBe(200);
    expect(concept).toMatchObject({ slug: "hash-map", title: "Hash map", readme: README, explanation: "", readmeError: null });
    expect(concept.before).toMatch(/^# Hash map\n\n## Intuition/);
    expect(concept.before).not.toContain("My explanation");
    expect(concept.after).toBe("## Problems\n\n<!-- auto:problems -->\n<!-- /auto -->\n");
    expect(concept.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it("reads the explanation from .study/explanations once it is there, and from the README's section before that", async () => {
    const root = makeRepo();
    put(root, README, readFileSync(path.join(root, README), "utf8").replace("<!-- USER: in your own words -->", "<!-- USER: in your own words -->\n\nOld words in the README."));
    const app = createApp({ root });
    expect((await getConcept(app)).explanation).toBe("Old words in the README.");
    put(root, EXPLANATION, "Newer words.\n");
    expect((await getConcept(app)).explanation).toBe("Newer words.");
  });

  it("answers 404 for unknown slugs", async () => {
    const app = createApp({ root: makeRepo() });
    for (const slug of ["nope", "../hash-map", "hash"]) {
      expect((await call(app, `/api/concept?slug=${encodeURIComponent(slug)}`)).status, slug).toBe(404);
    }
  });
});

describe("PUT /api/concept/explanation", () => {
  it("writes .study/explanations/<slug>.md and leaves the README byte for byte", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const readme = readFileSync(path.join(root, README), "utf8");
    const res = await putExplanation(app, "A hash map turns keys into positions.", (await getConcept(app)).version);
    expect(res.status).toBe(200);
    expect(readFileSync(path.join(root, EXPLANATION), "utf8")).toBe("A hash map turns keys into positions.\n");
    expect(readFileSync(path.join(root, README), "utf8")).toBe(readme);
    const after = await getConcept(app);
    expect(after.explanation).toBe("A hash map turns keys into positions.");
    expect((await json(res)).body.version).toBe(after.version);
  });

  it("keeps Spanish, emoji and headings byte for byte: the text no longer lives inside the README", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const text = "Un mapa hash es como el guardarropa 🎟️: la clave da la posición. ¡Ñandú!\n\n## Mi resumen\n\n- llaves y valores";
    expect((await putExplanation(app, text, (await getConcept(app)).version)).status).toBe(200);
    expect(readFileSync(path.join(root, EXPLANATION), "utf8")).toBe(`${text}\n`);
  });

  it("answers 409 with the fresh concept when the README or the explanation changed since it was loaded", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await getConcept(app);
    writeFileSync(path.join(root, README), readFileSync(path.join(root, README), "utf8").replace("An analogy.", "A better analogy."));
    const stale = await putExplanation(app, "Mine.", first.version);
    expect(stale.status).toBe(409);
    const fresh = (await json(stale)).body;
    expect(fresh.before).toContain("A better analogy.");
    put(root, EXPLANATION, "Written in another tab.\n");
    expect((await putExplanation(app, "Mine.", fresh.version)).status).toBe(409);
    expect(readFileSync(path.join(root, EXPLANATION), "utf8")).toBe("Written in another tab.\n");
  });

  it("saves even when the README has no My explanation section, and answers 404 for unknown slugs", async () => {
    const root = makeRepo();
    put(root, "concepts/bare/README.md", "---\nslug: bare\ntitle: Bare\nrequires: []\nrelated: []\n---\n# Bare\n\n## Intuition\n\nx\n");
    const app = createApp({ root });
    const concept = await getConcept(app, "bare");
    expect(concept.explanation).toBe("");
    expect(concept.before).toBe("# Bare\n\n## Intuition\n\nx\n");
    const saved = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "bare", text: "x", baseVersion: concept.version } });
    expect(saved.status).toBe(200);
    expect(readFileSync(path.join(root, ".study/explanations/bare.md"), "utf8")).toBe("x\n");
    const missing = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "nope", text: "x", baseVersion: "0" } });
    expect(missing.status).toBe(404);
  });
});

describe("concept status from the study store", () => {
  it("is new until the explanation is accepted or an exercise is attempted, and mastered once learned", async () => {
    const root = makeRepo();
    resetStudy(root);
    const app = createApp({ root });
    expect((await getConcept(app)).status).toBe("new");
    seedOpenAttempt(root, "hash-map/01");
    expect((await getConcept(app)).status).toBe("learning");
    seedAcceptance(root, "hash-map");
    seedClosedAttempt(root, "hash-map/01", "green");
    expect((await getConcept(app)).status).toBe("mastered");
  });
});
```

3. In `playground/tests/server/events.test.ts`:
   - append to `describe("classify", …)`:

```ts
  it("turns a change to .study/explanations/<slug>.md into that concept's readme event", () => {
    expect(classify(root, "/repo/.study/explanations/hash-map.md")).toEqual({ kind: "readme", concept: "hash-map" });
    expect(ignoredPath("/repo", "/repo/.study", "/repo/.study/explanations")).toBe(false);
    expect(ignoredPath("/repo", "/repo/.study", "/repo/.study/explanations/hash-map.md")).toBe(false);
    expect(ignoredPath("/repo", "/repo/.study", "/repo/.study/explanations/history/hash-map-2026-10-04T10-00-00-000Z-legacy.md")).toBe(true);
  });
```

   - in `scripts/tests/explanation.test.ts`, delete the `describe("explanationIssues", …)` block and drop `explanationIssues` from the import.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run playground/tests/server/targets.test.ts playground/tests/server/concepts.test.ts playground/tests/server/events.test.ts`
Expected: FAIL. Statuses still come from frontmatter, the PUT still writes the README, and `.study/explanations` raises no event.

- [ ] **Step 4: Derive statuses in `targets.ts`**

In `playground/server/targets.ts`:

1. Add these imports:

```ts
import type { ConceptEntry, ExerciseEntry, ProblemEntry } from "../../lib/repo.ts";
import type { ItemStatusValue } from "../../study/schema.ts";
import { allItemProgress, conceptProgress, emptyProgress, type ItemProgress } from "../../study/status.ts";
import { cachedStudy, type Study } from "../../study/store.ts";
```

   Merge the `lib/repo.ts` line into the existing import.
2. Keep `itemStatus`, `conceptStatus` and `findTarget`. Add after them:

```ts
/** The web's status words, kept to limit churn (spec §10), now derived from the study store's item_status view. */
const WEB_STATUS: Record<ItemStatusValue, ItemStatus> = { todo: "todo", in_progress: "solving", solved: "solved", revealed: "revealed" };

/** Recorded progress, or null before `pnpm study init` / `migrate`: until then the old frontmatter fields still speak. */
export interface Progress {
  study: Study;
  items: Map<string, ItemProgress>;
}

export function loadProgress(root: string): Progress | null {
  const study = cachedStudy(root);
  return study ? { study, items: allItemProgress(study) } : null;
}

export interface ItemView {
  status: ItemStatus;
  inProgress: boolean;
  hints: number;
}

export function itemView(entry: ProblemEntry | ExerciseEntry, progress: Progress | null): ItemView {
  if (!progress) {
    // LEGACY: README frontmatter, until `pnpm study migrate` strips it.
    return { status: itemStatus(entry.data.status), inProgress: isInProgress(entry), hints: typeof entry.data.hints === "number" ? entry.data.hints : 0 };
  }
  const item = progress.items.get(entry.folderId) ?? emptyProgress(entry.folderId);
  const status = WEB_STATUS[item.status];
  return { status, inProgress: status === "solving", hints: item.hints };
}

/** mastered once learned; learning once the explanation is accepted or an exercise attempted; new otherwise. */
export function conceptView(concept: ConceptEntry, exercises: readonly ExerciseEntry[], progress: Progress | null): ConceptStatus {
  if (!progress) return conceptStatus(concept.data.status); // LEGACY
  const state = conceptProgress(progress.study, concept.slug, exercises.map((exercise) => exercise.folderId), progress.items);
  if (state.learned) return "mastered";
  return state.accepted || state.exercises.some((exercise) => exercise.status !== "todo") ? "learning" : "new";
}
```

3. Replace `homeData` with:

```ts
export function homeData(root: string): HomeData {
  const repo = scanRepo(root);
  const progress = loadProgress(root);
  return {
    problems: repo.problems.map((p) => {
      const view = itemView(p, progress);
      return {
        id: p.folderId,
        title: str(p.data.title, p.folder),
        difficulty: str(p.data.difficulty) || null,
        patterns: strList(p.data.patterns),
        concepts: strList(p.data.concepts),
        lists: strList(p.data.lists),
        status: view.status,
        inProgress: view.inProgress,
        error: p.error,
      };
    }),
    groups: problemGroups(repo).map((group) => ({ pattern: group.pattern, ids: group.problems.map((p) => p.folderId) })),
    concepts: repo.concepts.map((c) => {
      const exercises = repo.exercises.filter((e) => e.concept === c.slug);
      return {
        slug: c.slug,
        title: str(c.data.title, c.slug),
        status: conceptView(c, exercises, progress),
        error: c.error,
        exercises: exercises.map((e) => {
          const view = itemView(e, progress);
          return { id: e.folderId, title: str(e.data.title, e.folder), status: view.status, inProgress: view.inProgress, error: e.error };
        }),
      };
    }),
  };
}
```

4. In `targetData`:
   - after `const data = entry?.data ?? {};` add `const view: ItemView = entry ? itemView(entry, loadProgress(root)) : { status: "todo", inProgress: false, hints: 0 };`;
   - replace the `status:` and `hints:` lines with `status: view.status,` and `hints: view.hints,`.

- [ ] **Step 5: Keep explanations in `.study`**

Replace `playground/server/concepts.ts` with:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { z } from "zod";
import { splitExplanation } from "../../lib/explanation.ts";
import { type ConceptEntry, scanRepo, str } from "../../lib/repo.ts";
import { studyRoot } from "../../runner/src/paths.ts";
import { contentVersion } from "./solutions.ts";
import { conceptView, loadProgress } from "./targets.ts";
import type { ConceptData } from "./types.ts";
import { valid } from "./validate.ts";

/** The concept with exactly this slug. */
export function findConcept(root: string, slug: string): ConceptEntry | null {
  return scanRepo(root).concepts.find((concept) => concept.slug === slug) ?? null;
}

/** .study/explanations/<slug>.md (spec §3): the user's "My explanation", kept out of the public README. */
export function explanationFile(root: string, slug: string): string {
  return path.join(studyRoot(root), "explanations", `${slug}.md`);
}

const readOrNull = (file: string): string | null => (existsSync(file) ? readFileSync(file, "utf8") : null);

export function conceptData(root: string, concept: ConceptEntry): ConceptData {
  const exercises = scanRepo(root).exercises.filter((exercise) => exercise.concept === concept.slug);
  const stored = readOrNull(explanationFile(root, concept.slug));
  const base = {
    slug: concept.slug,
    title: str(concept.data.title, concept.slug),
    status: conceptView(concept, exercises, loadProgress(root)),
    readme: concept.rel,
    // The README and the explanation together: a change to either since the page loaded is a conflict.
    version: contentVersion(`${readOrNull(concept.readme) ?? ""}\u0000${stored ?? ""}`),
  };
  if (concept.error) return { ...base, readmeError: concept.error, before: "", explanation: null, after: "" };
  const split = splitExplanation(concept.body);
  // LEGACY: until `pnpm study migrate` moves it, the text may still sit in the README's section.
  const explanation = stored !== null ? stored.trim() : (split?.text ?? "");
  if (!split) return { ...base, readmeError: null, before: concept.body, explanation, after: "" };
  return { ...base, readmeError: null, before: split.before, explanation, after: split.after };
}

const unknownConcept = (slug: string) => ({ error: `There is no concept "${slug}".` });

export function conceptRoutes(root: string) {
  return new Hono()
    .get("/concept", valid("query", z.object({ slug: z.string().min(1) })), (c) => {
      const { slug } = c.req.valid("query");
      const concept = findConcept(root, slug);
      if (!concept) return c.json(unknownConcept(slug), 404);
      return c.json(conceptData(root, concept), 200);
    })
    .put(
      "/concept/explanation",
      valid("json", z.object({ slug: z.string().min(1), text: z.string(), baseVersion: z.string() })),
      (c) => {
        const request = c.req.valid("json");
        const concept = findConcept(root, request.slug);
        if (!concept) return c.json(unknownConcept(request.slug), 404);
        const current = conceptData(root, concept);
        if (current.version !== request.baseVersion) return c.json(current, 409);
        if (concept.error) return c.json({ error: `${concept.rel}: ${concept.error}` }, 422);
        const file = explanationFile(root, concept.slug);
        mkdirSync(path.dirname(file), { recursive: true });
        const text = request.text.trim();
        writeFileSync(file, text ? `${text}\n` : "");
        return c.json({ version: conceptData(root, concept).version }, 200);
      },
    );
}
```

In `lib/explanation.ts`, delete `explanationIssues` and its doc comment. Nothing else uses it now.

In `playground/server/types.ts`, update the `ConceptData` doc comments:
- `explanation`: `/** The user's text: .study/explanations/<slug>.md, or (until pnpm study migrate) the README section's text; "" when there is none; null only when the README is broken. */`
- `version`: `/** Version of the README and of .study/explanations/<slug>.md together. */`

- [ ] **Step 6: Report explanation changes as live events**

In `playground/server/events.ts`:
- in `keptInStudy`, after the `STATE_FILE` line, add:

```ts
  if (parts[0] === "explanations") return parts.length === 1 || (parts.length === 2 && parts[1].endsWith(".md"));
```

- in `classifyStudy`, after the `STATE_FILE` line, add:

```ts
  if (parts[0] === "explanations" && parts.length === 2 && parts[1].endsWith(".md")) return { kind: "readme", concept: parts[1].slice(0, -3) };
```

- [ ] **Step 7: Update the e2e test and reset**

1. In `playground/e2e/fixture.ts`, at the end of `resetRepo`'s solution-removal loop, add:

```ts
  rmSync(repoFile(".study/explanations/hash-map.md"), { force: true });
```

2. In `playground/e2e/live.spec.ts`, replace the test `"My explanation is saved into the README and nothing else changes"` with the test below, and drop `EXPLANATION_NOTE` from the import if it is now unused.

```ts
test("My explanation is saved in .study/explanations and the README stays as it is", async ({ page }) => {
  const readme = readFileSync(repoFile("concepts/hash-map/README.md"), "utf8");
  const text = "Un mapa hash convierte la clave en una posición. 🎟️";
  await page.goto("/c/hash-map");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "My explanation" }).click();
  await page.keyboard.insertText(text);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();
  expect(readFileSync(repoFile(".study/explanations/hash-map.md"), "utf8")).toBe(`${text}\n`);
  expect(readFileSync(repoFile("concepts/hash-map/README.md"), "utf8")).toBe(readme);
});
```

- [ ] **Step 8: Run everything**

Run: `pnpm verify && pnpm e2e`
Expected: all green. The e2e repo has no study database yet, so the home statuses still come from its frontmatter.

- [ ] **Step 9: Commit**

```bash
git add study/tests/seed.ts playground/server/targets.ts playground/server/concepts.ts playground/server/events.ts playground/server/types.ts \
  lib/explanation.ts scripts/tests/explanation.test.ts playground/tests/server/targets.test.ts playground/tests/server/concepts.test.ts \
  playground/tests/server/events.test.ts playground/e2e/fixture.ts playground/e2e/live.spec.ts
git commit -m "feat(playground): derive statuses from the study store and keep My explanation in .study/explanations"
```

---

### Task 17: Content-only `INDEX.md` and auto-sections; the migration regenerates them

**Files:**
- Modify: `scripts/lib/render.ts`
- Modify: `study/migrate.ts`
- Test: `scripts/tests/sync.test.ts`, `study/tests/migrate.test.ts`

**Interfaces:**
- Consumes: `sync` (`scripts/lib/sync.ts`); `planMigration` / `applyMigration` (Task 11).
- Produces:
  - **render.ts:**
    - `renderProblemIndex` has no status legend or marks; its group headings read `## <pattern> (<count>)`.
    - `renderConceptIndex` has a learning path with no status and no "By status".
    - `renderProblemConcepts`, `renderConceptExercises` and `renderConceptProblems` print plain links.
    - `STATUS_MARK` is gone.
  - **Migration:** `MigrationAction` gains `{ kind: "sync" }`, the last action of every plan. `nothingToMigrate` ignores it.

From this task on, `pnpm sync` writes content-only files. **Never run `pnpm sync` on the real repo** (Global Constraints): the migration does it.

- [ ] **Step 1: Write the failing tests**

In `scripts/tests/sync.test.ts`, replace the three expectations below. The fixture still has frontmatter `status` values, and the output must ignore them.

1. `"writes the problem index grouped by pattern"`:

```ts
    expect(read(root, "INDEX.md")).toBe(
      [
        "# Problems",
        "",
        "<!-- Generated by `pnpm sync`. Do not edit by hand. -->",
        "",
        "## arrays-hashing (1)",
        "",
        "- [lc-0001 · Two Sum](problems/lc-0001-two-sum/README.md) · easy",
        "",
        "## stack (1)",
        "",
        "- [lc-0020 · Valid Parentheses](problems/lc-0020-valid-parentheses/README.md) · easy",
        "",
      ].join("\n"),
    );
```

2. `"writes the concept index with a learning path and missing concepts"`:

```ts
    expect(read(root, "concepts/INDEX.md")).toBe(
      [
        "# Concepts",
        "",
        "<!-- Generated by `pnpm sync`. Do not edit by hand. -->",
        "",
        "## Learning path",
        "",
        "1. [Arrays](arrays/README.md)",
        "2. [Hash map](hash-map/README.md) — requires: arrays",
        "",
        "## Missing",
        "",
        "- stack — referenced by lc-0020",
        "",
      ].join("\n"),
    );
```

3. In `"fills the auto sections of problems and concepts"`, change the three `toContain` strings that carry a status:

```ts
    expect(read(root, "problems/lc-0001-two-sum/README.md")).toContain(
      "<!-- auto:concepts -->\n- [Hash map](../../concepts/hash-map/README.md)\n<!-- /auto -->",
    );
```

```ts
    expect(hashMap).toContain("<!-- auto:exercises -->\n- [01 · First repeat](exercises/01-first-repeat/README.md)\n<!-- /auto -->");
    expect(hashMap).toContain("<!-- auto:problems -->\n- [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)\n<!-- /auto -->");
```

In `study/tests/migrate.test.ts`:
- add `"sync        INDEX.md, concepts/INDEX.md and the auto-sections, as pure content",` to the dry-run test's `arrayContaining` list;
- append inside `describe("pnpm study migrate", …)`:

```ts
  it("regenerates INDEX.md and the auto-sections as pure content", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    const index = read(root, "INDEX.md");
    expect(index).toContain("- [lc-9001 · Sample Sum](problems/lc-9001-sample-sum/README.md) · easy");
    expect(index).not.toMatch(/[✓…↺○]/);
    expect(read(root, "problems/lc-9001-sample-sum/README.md")).toContain(
      "<!-- auto:concepts -->\n- [Sample map](../../concepts/sample-map/README.md)\n<!-- /auto -->",
    );
    expect(read(root, "concepts/INDEX.md")).not.toContain("## By status");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run scripts/tests/sync.test.ts study/tests/migrate.test.ts`
Expected: FAIL. The output still carries the marks and the status, and migrate prints no `sync` line.

- [ ] **Step 3: Render content only**

In `scripts/lib/render.ts`:

1. Delete `STATUS_MARK` and `mark`. Put this comment above `GENERATED_NOTE`:

```ts
/**
 * Generated files and auto-sections are pure content (study coach spec §9.4): the user's progress lives in .study
 * and shows in the playground and in `pnpm study status`, never in the repo.
 */
```

2. Replace `renderProblemIndex` with:

```ts
export function renderProblemIndex(repo: RepoModel): string {
  const groups = problemGroups(repo);
  const lines = ["# Problems", "", GENERATED_NOTE, ""];
  if (groups.length === 0) lines.push("_No problems yet. Paste one into Claude Code to start._", "");
  for (const { pattern, problems: items } of groups) {
    lines.push(`## ${pattern} (${items.length})`, "");
    for (const p of items) {
      lines.push(`- [${p.folderId} · ${titleOf(p)}](problems/${p.folder}/README.md) · ${str(p.data.difficulty, "?")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
```

3. In `renderConceptIndex`:
   - change the learning-path line to:

```ts
      `${i + 1}. [${titleOf(concept)}](${slug}/README.md)${requires.length ? ` — requires: ${requires.join(", ")}` : ""}`,
```

   - delete the whole "By status" block, from `lines.push("", "## By status", "");` to the end of its `for` loop;
   - change `lines.push("## Missing", "");` to `lines.push("", "## Missing", "");`.
4. In `renderProblemConcepts`, change the found branch to `` `- [${titleOf(concept)}](../../concepts/${slug}/README.md)` ``.
5. In `renderConceptExercises`, drop `${mark(e.data.status)} ` from the line. In `renderConceptProblems`, drop `${mark(p.data.status)} `.

- [ ] **Step 4: Regenerate during the migration**

In `study/migrate.ts`:

1. Add `import { sync } from "../scripts/lib/sync.ts";`.
2. Add `| { kind: "sync" }` to `MigrationAction`.
3. At the end of `planMigration`, before the `return`, add `actions.push({ kind: "sync" });`.
4. Change `nothingToMigrate`'s body to:

```ts
  return plan.actions.every((action) => (action.kind === "init" && action.exists) || action.kind === "sync");
```

5. In `describeAction`, add:

```ts
    case "sync":
      return line("sync", "INDEX.md, concepts/INDEX.md and the auto-sections, as pure content");
```

6. In `applyMigration`'s `switch`, add:

```ts
      case "sync":
        sync(plan.root);
        break;
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run scripts/tests/sync.test.ts scripts/tests/render.test.ts study/tests/migrate.test.ts && pnpm verify`
Expected: all green. `check` does not compare `INDEX.md` with the renderer, so the real repo's unchanged indexes stay valid.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/render.ts study/migrate.ts scripts/tests/sync.test.ts study/tests/migrate.test.ts
git commit -m "feat(scripts): render INDEX.md and auto-sections as pure content; the migration regenerates them"
```

---

### Task 18: Content-only schemas, the personal-data check, the fixtures, and `.gitignore`

**Files:**
- Modify: `lib/schemas.ts`, `scripts/lib/checks.ts`, `.gitignore`
- Modify fixtures: `scripts/tests/fixture.ts`, `playground/tests/server/helpers.ts`, `playground/e2e/fixture.ts`
- Modify tests that build READMEs or expect fixture statuses:
  - `scripts/tests/check.test.ts`, `scripts/tests/render.test.ts`, `scripts/tests/sync.test.ts`;
  - `playground/tests/server/targets.test.ts`, `playground/tests/server/concepts.test.ts`, `playground/tests/server/spoiler.test.ts`;
  - `study/tests/migrate.test.ts`.
- Test (e2e): `playground/e2e/work.spec.ts`

**Interfaces:**
- Consumes:
  - `LEGACY_PERSONAL_FIELDS`, `stripReadme`, `StripError` (Task 10);
  - `dbPath` (Task 3), `studyRoot` (Task 1), `initStudy` (Task 9);
  - `makeLegacyRepo` (Task 11) and the seed helpers (Task 16).
- Produces:
  - **Schemas:** `problemFrontmatter`, `exerciseFrontmatter` and `conceptFrontmatter` hold content fields only (spec §10). Personal keys are filtered out before validation, then reported:
    - `"<n> place(s) still hold personal progress from before the study coach; pnpm study migrate moves it to .study/ (study coach spec §9)"`, a single warning on `"."` while there is no `.study/study.db`;
    - after that, one error per place: `personal progress in content: <fields…> (pnpm study migrate moves it to .study/)` or `solution file in a content folder (pnpm study migrate archives it in .study/solutions)`.
  - **No more checks for** `solved_in` or "mastered needs My explanation".
  - **Fixture builders** take content fields only:
    - `problemReadme({ id, title, slug, patterns, concepts })`;
    - `conceptReadme({ slug, title, requires })`;
    - `exerciseReadme({ id, title, concept })`.
  - **Server fixture:** `makeRepo(options?: { study?: boolean })`. With the default, it initializes `.study` and seeds `lc-0001` as solved.
  - **e2e fixture:** `resetRepo()` also resets `.study/`: it removes solution files and explanations, empties the store, and seeds `lc-0020` as solved.

- [ ] **Step 1: Write the failing tests**

1. In `scripts/tests/check.test.ts`, add these imports:
   - `import { fixedClock } from "../../study/clock.ts";`
   - `import { initStudy } from "../../study/init.ts";`
   - `import { makeLegacyRepo } from "../../study/tests/legacy-fixture.ts";`

   Then make these changes:
   - **`"validates frontmatter against the schema and the pattern vocabulary"`:** replace the `hints` edit and its expectation with:

```ts
    edit(root, "problems/lc-0001-two-sum/README.md", "difficulty: easy", "difficulty: impossible");
```

   and

```ts
    expect(errors.some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter difficulty:"))).toBe(true);
```

   - **`"checks status consistency"`:** replace it with:

```ts
  it("warns about personal progress in content until the study store exists, then reports each place as an error", async () => {
    const root = makeLegacyRepo();
    const before = await checkRepo(root);
    expect(before.errors).toEqual([]);
    expect(before.warnings).toEqual([
      { file: ".", message: "7 place(s) still hold personal progress from before the study coach; pnpm study migrate moves it to .study/ (study coach spec §9)" },
    ]);
    initStudy(root, { clock: fixedClock("2026-10-04T10:00:00Z"), timezone: "UTC" });
    expect(await messages(root)).toEqual([
      "problems/lc-9001-sample-sum/README.md: personal progress in content: status, hints, solution_revealed, solved_in, complexity, ## Log (pnpm study migrate moves it to .study/)",
      "problems/lc-9001-sample-sum/solution.py: solution file in a content folder (pnpm study migrate archives it in .study/solutions)",
      "problems/lc-9002-sample-pairs/README.md: personal progress in content: status, hints, solution_revealed, solved_in, complexity, ## Log (pnpm study migrate moves it to .study/)",
      "problems/lc-9002-sample-pairs/solution.ts: solution file in a content folder (pnpm study migrate archives it in .study/solutions)",
      "concepts/sample-map/exercises/01-first/README.md: personal progress in content: status, hints, solution_revealed, solved_in, ## Log (pnpm study migrate moves it to .study/)",
      "concepts/sample-map/exercises/01-first/solution.py: solution file in a content folder (pnpm study migrate archives it in .study/solutions)",
      'concepts/sample-map/README.md: personal progress in content: status, "My explanation" text (pnpm study migrate moves it to .study/)',
    ]);
  });
```

   - **`"requires the auto sections"`:** change the `problemReadme(…)` call to `problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: [] })`.
   - **`"accepts a kebab-case lists field…"`:** the fixture has no `solution_revealed` line to anchor on any more. Replace the first `edit` call with the line below and keep the second one as it is.

```ts
    edit(root, "problems/lc-0001-two-sum/README.md", "concepts: [hash-map]", "concepts: [hash-map]\nlists: [grind-75]");
```


2. In `study/tests/migrate.test.ts`, import `checkRepo` from `../../scripts/lib/checks.ts`, then append inside `describe("pnpm study migrate", …)`:

```ts
  it("leaves a repo that pnpm check accepts, with no personal data left (spec §9.4)", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    const report = await checkRepo(root);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
```

3. In `playground/e2e/work.spec.ts`, append:

```ts
test("opening a problem starts nothing; running it starts an attempt that the home page shows in progress", async ({ page }) => {
  const twoSum = () => page.getByRole("row", { name: /Two Sum/ });
  await page.goto("/p/lc-0001");
  await expect(page.getByRole("textbox", { name: "solution.py" })).toContainText("def twoSum");
  await page.goto("/");
  await expect(twoSum().getByRole("img", { name: "To do" })).toBeVisible();
  await page.goto("/p/lc-0001");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Example 1:/ })).toBeVisible({ timeout: 20_000 });
  await page.goto("/");
  await expect(twoSum().getByRole("img", { name: "In progress" })).toBeVisible();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run scripts/tests/check.test.ts study/tests/migrate.test.ts`
Expected: FAIL. The schema still requires `status` and others, and there is no personal-data warning.

- [ ] **Step 3: Content-only schemas**

In `lib/schemas.ts`, replace `workFields` and the three schemas with the code below. Keep `PATTERNS` and `LEGACY_PERSONAL_FIELDS`.

```ts
const itemFields = {
  id: z.string().min(1),
  title: z.string().min(1),
};

/** A problem README's frontmatter: content only (study coach spec §10). Progress lives in .study. */
export const problemFrontmatter = z
  .object({
    ...itemFields,
    source: z.string().min(1),
    url: z.string().regex(/^https?:\/\//, "must be an http(s) URL"),
    difficulty: z.enum(["easy", "medium", "hard"]),
    patterns: z.array(z.enum(PATTERNS)),
    concepts: z.array(z.string().min(1)),
    /** Curated lists the problem was imported from, e.g. [grind-75] (Grind 75 spec §5). */
    lists: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case")).optional(),
  })
  .strict();

export const exerciseFrontmatter = z.object({ ...itemFields, concept: z.string().min(1) }).strict();

export const conceptFrontmatter = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    requires: z.array(z.string().min(1)),
    related: z.array(z.string().min(1)),
  })
  .strict();
```

- [ ] **Step 4: The personal-data check**

In `scripts/lib/checks.ts`:

1. Change the imports:
   - change the `lib/repo.ts` import to `import { type ConceptEntry, type DocEntry, type ExerciseEntry, type ProblemEntry, type RepoModel, scanRepo, str, strList } from "../../lib/repo.ts";`;
   - change the `lib/schemas.ts` import to `import { conceptFrontmatter, exerciseFrontmatter, LEGACY_PERSONAL_FIELDS, problemFrontmatter } from "../../lib/schemas.ts";`;
   - add `import { studyRoot } from "../../runner/src/paths.ts";`, `import { dbPath } from "../../study/store.ts";` and `import { StripError, stripReadme } from "../../study/strip.ts";`.
2. Inside `checkRepo`:
   - replace `validate` with the version below;
   - delete `requireSolvedIn`;
   - add `migrated`, `personal`, `MIGRATE_HINT`, `findPersonal` and `findSolutions` (also below).

```ts
  /**
   * Personal progress left in content (spec D1, §10). While the study store does not exist (the user has not
   * migrated yet) it is one warning; once .study/study.db exists, every place is an error that
   * `pnpm study migrate` fixes.
   */
  const migrated = existsSync(dbPath(studyRoot(root)));
  const personal: Issue[] = [];
  const MIGRATE_HINT = "pnpm study migrate moves it to .study/";

  /** Validates the content fields; personal keys are left to findPersonal. */
  const validate = (entry: DocEntry, schema: z.ZodType, personalKeys: readonly string[]): boolean => {
    if (entry.error) {
      error(entry.rel, entry.error);
      return false;
    }
    const data = Object.fromEntries(Object.entries(entry.data).filter(([key]) => !personalKeys.includes(key)));
    const parsed = schema.safeParse(data);
    if (parsed.success) return true;
    for (const issue of parsed.error.issues) error(entry.rel, `frontmatter ${formatPath(issue.path)}: ${issue.message}`);
    return false;
  };

  const findPersonal = (entry: ProblemEntry | ExerciseEntry | ConceptEntry): void => {
    if (entry.error) return;
    try {
      const found = stripReadme(entry.head + entry.body, entry.kind);
      const what = [...found.fields, ...(found.log ? ["## Log"] : []), ...(found.explanation !== null ? ['"My explanation" text'] : [])];
      if (what.length > 0) personal.push({ file: entry.rel, message: `personal progress in content: ${what.join(", ")} (${MIGRATE_HINT})` });
    } catch (caught) {
      if (!(caught instanceof StripError)) throw caught;
      personal.push({ file: entry.rel, message: `${caught.message} (fix it by hand, then run pnpm study migrate)` });
    }
  };

  const findSolutions = (entry: ProblemEntry | ExerciseEntry): void => {
    for (const lang of ["py", "ts"]) {
      const file = path.join(entry.dir, `solution.${lang}`);
      if (existsSync(file)) personal.push({ file: rel(file), message: "solution file in a content folder (pnpm study migrate archives it in .study/solutions)" });
    }
  };
```

3. In the problems loop:
   - call `validate(problem, problemFrontmatter, LEGACY_PERSONAL_FIELDS.problem)`;
   - remove `requireSolvedIn(problem);`;
   - after `requireAuto(problem, ["concepts"]);` add `findPersonal(problem);` and `findSolutions(problem);`.
4. In the exercises loop:
   - call `validate(exercise, exerciseFrontmatter, LEGACY_PERSONAL_FIELDS.exercise)`;
   - remove `requireSolvedIn(exercise);`;
   - add `findPersonal(exercise);` and `findSolutions(exercise);` before `await checkStress(…)`.
5. In the concepts loop:
   - call `validate(concept, conceptFrontmatter, LEGACY_PERSONAL_FIELDS.concept)`;
   - delete the `status is mastered but "My explanation" is empty` check;
   - add `findPersonal(concept);` after `requireAuto(…)`.
6. Right before `return { errors, warnings };`, add:

```ts
  if (migrated) errors.push(...personal);
  else if (personal.length > 0) {
    warnings.push({
      file: ".",
      message: `${personal.length} place(s) still hold personal progress from before the study coach; ${MIGRATE_HINT} (study coach spec §9)`,
    });
  }
```

`sectionText` stays exported; its test still uses it.

- [ ] **Step 5: Ignore solutions left in content folders**

In `.gitignore`, after the `.study/` lines, add:

```gitignore
# Solutions live in .study/solutions (study coach spec §3); `pnpm check` reports any left in content folders
problems/**/solution.*
concepts/**/solution.*
```

Tracked solution files stay tracked until the user's migration `git rm`s them. This only hides untracked ones.

- [ ] **Step 6: Content-only fixtures**

1. In `scripts/tests/fixture.ts`, replace the three builders and `makeStudyRepo` with:

```ts
export function problemReadme(fields: { id: string; title: string; slug: string; patterns: string[]; concepts: string[] }): string {
  return [
    "---",
    `id: ${fields.id}`,
    `title: ${fields.title}`,
    "source: leetcode",
    `url: https://leetcode.com/problems/${fields.slug}/`,
    "difficulty: easy",
    `patterns: [${fields.patterns.join(", ")}]`,
    `concepts: [${fields.concepts.join(", ")}]`,
    "---",
    `# ${fields.title}`,
    "",
    "## Statement",
    "",
    "Short paraphrase.",
    "",
    "## Concepts",
    "",
    "<!-- auto:concepts -->",
    "<!-- /auto -->",
    "",
  ].join("\n");
}

export function conceptReadme(fields: { slug: string; title: string; requires: string[] }): string {
  return [
    "---",
    `slug: ${fields.slug}`,
    `title: ${fields.title}`,
    `requires: [${fields.requires.join(", ")}]`,
    "related: []",
    "---",
    `# ${fields.title}`,
    "",
    "## Intuition",
    "",
    "An analogy.",
    "",
    "## Exercises",
    "",
    "<!-- auto:exercises -->",
    "<!-- /auto -->",
    "",
    "## My explanation",
    "",
    "<!-- USER: in your own words -->",
    "",
    "## Problems",
    "",
    "<!-- auto:problems -->",
    "<!-- /auto -->",
    "",
  ].join("\n");
}

export function exerciseReadme(fields: { id: string; title: string; concept: string }): string {
  return ["---", `id: ${fields.id}`, `title: ${fields.title}`, `concept: ${fields.concept}`, "---", `# ${fields.title}`, "", "## Statement", "", "Short.", ""].join("\n");
}

/** A small, valid study repo in the OS temp dir: pure content, no progress (that lives in .study). */
export function makeStudyRepo(): string {
  const root = makeTempDir("algo-repo-");
  put(root, "problems/lc-0001-two-sum/README.md", problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: ["hash-map"] }));
  put(root, "problems/lc-0001-two-sum/cases.json", CASES_JSON);
  put(
    root,
    "problems/lc-0020-valid-parentheses/README.md",
    problemReadme({ id: "lc-0020", title: "Valid Parentheses", slug: "valid-parentheses", patterns: ["stack"], concepts: ["stack"] }),
  );
  put(root, "problems/lc-0020-valid-parentheses/cases.json", CASES_JSON);
  put(root, "concepts/arrays/README.md", conceptReadme({ slug: "arrays", title: "Arrays", requires: [] }));
  put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", requires: ["arrays"] }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", exerciseReadme({ id: "hash-map/01", title: "First repeat", concept: "hash-map" }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/cases.json", CASES_JSON);
  return root;
}
```

2. Update the scripts tests that build READMEs. Run `pnpm exec tsc --noEmit` to list the stale call sites.
   - **`scripts/tests/sync.test.ts`, test `"never writes past an unclosed auto marker"`:** build the README as:

```ts
    const unclosed = conceptReadme({ slug: "arrays", title: "Arrays", requires: [] })
      .replace("An analogy.", "USER WROTE THIS")
      .replace("<!-- auto:exercises -->\n<!-- /auto -->", "<!-- auto:exercises -->");
```

   - **`scripts/tests/render.test.ts`, the `problemGroups` test:** change its `readme` helper to `(id: string, title: string, patterns: string[]) => problemReadme({ id, title, slug: title.toLowerCase(), patterns, concepts: [] })`, and drop the status argument from the two calls.
   - **`scripts/tests/render.test.ts`, the `isInProgress` test:** it tests the legacy rule, so give it legacy READMEs of its own. Replace that test with:

```ts
describe("isInProgress (legacy READMEs, until pnpm study migrate)", () => {
  it("counts solving items, and todo items with a solution file in their folder or under .study", () => {
    const root = makeTempDir("algo-legacy-");
    const legacy = (id: string, status: string) => `---\nid: ${id}\ntitle: ${id}\nstatus: ${status}\n---\n# ${id}\n`;
    put(root, "problems/lc-0001-done/README.md", legacy("lc-0001", "solved"));
    put(root, "problems/lc-0020-working/README.md", legacy("lc-0020", "solving"));
    put(root, "problems/lc-0070-stairs/README.md", legacy("lc-0070", "todo"));
    put(root, "problems/lc-0071-path/README.md", legacy("lc-0071", "todo"));
    put(root, "problems/lc-0071-path/solution.ts", "export default function f() {}\n");
    put(root, "problems/lc-0072-study/README.md", legacy("lc-0072", "todo"));
    put(root, ".study/solutions/problems/lc-0072/solution.py", "class Solution:\n    pass\n");
    const byId = Object.fromEntries(scanRepo(root).problems.map((p) => [p.folderId, isInProgress(p)]));
    expect(byId).toEqual({ "lc-0001": false, "lc-0020": true, "lc-0070": false, "lc-0071": true, "lc-0072": true });
  });
});
```

   Add `makeTempDir` to its import from `./fixture.ts`.
3. In `playground/tests/server/helpers.ts`, import `{ resetStudy, seedClosedAttempt }` from `../../../study/tests/seed.ts`, and replace `makeRepo` with:

```ts
/**
 * A small study repo inside the project (so TypeScript solutions resolve "lc"). removeRepos() deletes it.
 * By default its progress is initialized in .study with Two Sum solved; `{ study: false }` leaves no study database.
 */
export function makeRepo(options: { study?: boolean } = {}): string {
  const root = tempDir();
  repos.push(root);
  const cases = JSON.stringify(SUM_CASES);
  put(root, "problems/lc-0001-two-sum/README.md", problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: ["hash-map"] }));
  put(root, "problems/lc-0001-two-sum/cases.json", cases);
  put(root, "problems/lc-0020-valid-parentheses/README.md", problemReadme({ id: "lc-0020", title: "Valid Parentheses", slug: "valid-parentheses", patterns: ["stack"], concepts: [] }));
  put(root, "problems/lc-0020-valid-parentheses/cases.json", cases);
  put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", requires: [] }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", exerciseReadme({ id: "hash-map/01", title: "First repeat", concept: "hash-map" }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/cases.json", cases);
  if (options.study ?? true) {
    resetStudy(root);
    seedClosedAttempt(root, "lc-0001", "green");
  }
  return root;
}
```

4. Update the server tests for the store-backed statuses:
   - **`playground/tests/server/targets.test.ts`:**
     - In the first `GET /api/home` test, replace `put(root, "problems/lc-0020-valid-parentheses/solution.py", PY_SUM);` with `seedOpenAttempt(root, "lc-0020");`. Change the lc-0020 row to `status: "solving", inProgress: true`, and the concept's `status: "learning"` to `status: "new"`. Import `seedOpenAttempt` (already imported in Task 16) and drop `PY_SUM` from the imports if it becomes unused.
     - In `"keep reading the old frontmatter while there is no study database"`, change `makeRepo()` to `makeRepo({ study: false })`.
   - **`playground/tests/server/concepts.test.ts`:** nothing changes. Its first test no longer asserts a status, and the status test resets the store itself.
   - **`playground/tests/server/spoiler.test.ts`:** change the `problemReadme(…)` call to `problemReadme({ id, title: folder, slug: folder, patterns: ["strings"], concepts: [] })`.
5. In `playground/e2e/fixture.ts`:
   - add `import { resetStudy, seedClosedAttempt } from "../../study/tests/seed.ts";`;
   - drop the personal fields and the `## Log` from the README constants;
   - make the auto-sections content-only;
   - reset the store in `resetRepo`.

   The constants become:

```ts
const PROBLEM_README = `---
id: lc-0001
title: Two Sum
source: leetcode
url: https://leetcode.com/problems/two-sum/
difficulty: easy
patterns: [arrays-hashing]
concepts: [hash-map]
lists: [grind-75]
---
# 1. Two Sum

## Statement

Return the indices of the two numbers in \`nums\` that add up to \`target\`.

## Concepts

<!-- auto:concepts -->
- [Hash map](../../concepts/hash-map/README.md)
<!-- /auto -->
`;
```

```ts
const CONCEPT_README = `---
slug: hash-map
title: Hash map
requires: []
related: []
---
# Hash map

## Intuition

A coat check: the ticket number tells you the hook.

## Exercises

<!-- auto:exercises -->
<!-- /auto -->

## My explanation

${EXPLANATION_NOTE}

## Problems

<!-- auto:problems -->
- [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)
<!-- /auto -->
`;
```

```ts
const SECOND_README = `---
id: lc-0020
title: Valid Parentheses
source: leetcode
url: https://leetcode.com/problems/valid-parentheses/
difficulty: easy
patterns: [stack]
concepts: [stack]
---
# 20. Valid Parentheses

## Statement

Say whether every bracket in \`s\` is closed in the right order.
`;
```

   and at the end of `resetRepo`:

```ts
  // Progress (study coach spec §10): emptied in place, so the running server keeps its handle; then Valid
  // Parentheses solved, which the home page's status tests rely on.
  resetStudy(E2E_ROOT);
  seedClosedAttempt(E2E_ROOT, "lc-0020", "green");
```

- [ ] **Step 7: Run everything**

Run: `pnpm verify && pnpm e2e`

Expected:
- Vitest green, including the new tests.
- Both `tsc` runs clean.
- `check` on the real repo: **0 errors**, plus the expected warning `… place(s) still hold personal progress from before the study coach; pnpm study migrate moves it to .study/ (study coach spec §9)`, next to the existing "referenced but not created" warnings.
- e2e green, including the new test in `work.spec.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/schemas.ts scripts/lib/checks.ts .gitignore scripts/tests/fixture.ts scripts/tests/check.test.ts scripts/tests/render.test.ts scripts/tests/sync.test.ts \
  playground/tests/server/helpers.ts playground/tests/server/targets.test.ts playground/tests/server/spoiler.test.ts \
  playground/e2e/fixture.ts playground/e2e/work.spec.ts study/tests/migrate.test.ts
git commit -m "feat: keep READMEs pure content; check warns about personal data until the study store exists, then rejects it"
```

---

### Task 19: Content-only templates, the new layout in `CLAUDE.md`, and `README.md`

**Files:**
- Modify: `.claude/skills/problem/SKILL.md`, `.claude/skills/concept/SKILL.md`
- Modify: `CLAUDE.md`, `README.md`
- Test: `scripts/tests/claude-layer.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - **Templates:** the `problem` and `concept` skills create content-only READMEs, matching the schemas of Task 18.
  - **`CLAUDE.md`:** documents the `.study/` layout and the `study/` engine.
  - **`README.md`:** documents `pnpm study init`, `migrate`, `status` and `--no-record`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/tests/claude-layer.test.ts`:

```ts
describe("content-only templates and docs (study coach spec §3, §10)", () => {
  const text = (name: string) => readFileSync(path.join(REPO_ROOT, ".claude", "skills", name, "SKILL.md"), "utf8");

  it("the problem and concept templates hold content only", () => {
    // Frontmatter lines and the Log heading, anchored at the line start ("**Typical complexity:**" is content).
    for (const stale of [/^status: /m, /^hints: /m, /^solution_revealed: /m, /^solved_in: /m, /^complexity: /m, /^## Log$/m]) {
      expect(text("problem"), String(stale)).not.toMatch(stale);
      expect(text("concept"), String(stale)).not.toMatch(stale);
    }
  });

  it("CLAUDE.md maps .study and README.md explains init, migrate and status", () => {
    const claude = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(claude).toContain("`.study/`");
    expect(claude).toContain("`study/`");
    expect(claude).not.toContain("Log lines");
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    for (const command of ["pnpm study init", "pnpm study migrate", "pnpm study status", "--no-record"]) expect(readme).toContain(command);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run scripts/tests/claude-layer.test.ts`
Expected: FAIL. The templates still have `status:` and `## Log`.

- [ ] **Step 3: The problem skill**

In `.claude/skills/problem/SKILL.md`:

1. In the step 2 template, delete the frontmatter lines `status: solving`, `hints: 0`, `solution_revealed: false`, `solved_in: []` and `complexity: null`. Delete the closing `## Log` section and its `- YYYY-MM-DD · registered` line, so the template ends with the `<!-- /auto -->` line of `## Concepts`.
2. Delete the bullet `Use \`status: todo\` instead of \`solving\` if the user says the problem is for later.`
3. In the step 1 bullet "**Already registered**", change "using its frontmatter" to "using its frontmatter and `pnpm -s study status <id> --json`".

- [ ] **Step 4: The concept skill**

In `.claude/skills/concept/SKILL.md`:

1. In the step 2 template, delete the line `status: learning`.
2. Replace step 3 with:

```markdown
3. **Frontmatter:**
   - `requires`: prerequisite slugs.
   - `related`: neighbouring concepts.

   Progress (whether the user is learning or has learned the concept) lives in `.study`, never in the README.
```

3. In step 4, replace the `README.md` bullet with:

```markdown
   - `README.md`: frontmatter `id: <slug>/<NN>`, `title`, `concept: <slug>`; then `# <title>` and `## Statement` (with examples and constraints).
```

4. In the step 2 "What goes in each section" list, change the **My explanation** bullet to: `- **My explanation:** the heading and the comment only. The user's text is saved in \`.study/explanations/<slug>.md\` (the playground writes it there).`

- [ ] **Step 5: `CLAUDE.md`**

1. In `## Repo map`:
   - replace the `problems/…` bullet with:

```markdown
- `problems/<platform>-<NNNN>-<slug>/`: `README.md` (statement + frontmatter), `cases.json`, optional `stress.ts`. Pure content: no progress, no solutions.
```

   - after the `concepts/…` bullet, add:

```markdown
- `.study/` (git-ignored, the user's; `$ALGO_STUDY` moves it): `solutions/problems/<id>/solution.{py,ts}` and `solutions/exercises/<concept>/<NN>/solution.{py,ts}`, each with `history/` (older versions, `*-legacy.*` from before the study coach); `explanations/<slug>.md` ("My explanation"); `study.db` (progress) and `state.json` (its snapshot). Read it when a skill says so; never write it.
```

   - replace the `INDEX.md` bullet with:

```markdown
- `INDEX.md` and `concepts/INDEX.md`: generated by `pnpm sync`, content only. Never edit them by hand.
```

   - change the `runner/` bullet to `` - `runner/`: test engine. `study/`: the study engine (progress store, recording, `pnpm study`). `scripts/`: sync, check, leetcode. `lib/`: shared Markdown model. ``
2. In `## Commands`, change the `pnpm play` bullet's last sentence to: `It writes the user's solution files under \`.study/solutions\` (autosave), records their saves and runs, and saves "My explanation" to \`.study/explanations\`: treat what it writes as the user's own edits.`
3. In `## Vocabulary`, delete the `Log lines` bullet.

- [ ] **Step 6: `README.md`**

1. In `## Setup`, after the code block, add:

```markdown
**Your progress** lives in `.study/` (git-ignored): your solutions and their history, your "My explanation" texts, and `study.db`. A fresh clone starts it with `pnpm study init`. A repo whose READMEs still hold progress from before the study coach moves it once with `pnpm study migrate` (try `pnpm study migrate --dry-run` first, stop `pnpm play` and `pnpm watch`, then commit what it strips).
```

2. In `## Daily flow`, change step 2's last sentence to `Claude writes the note and the exercises; you write "My explanation" (it is saved in .study/explanations, not in the README).`
3. In the `## Commands` table:
   - change the `pnpm test` row to `` | `pnpm test <query> [--lang py\|ts\|all] [--json] [--no-record]` | Runs once and records the run as your practice (`--no-record` skips that) | ``;
   - add after the `pnpm fill-expected` row:

```markdown
| `pnpm study init [--minutes <n>] [--lang py\|ts] [--timezone <zone>]` | Starts `.study/` (your progress) in a fresh clone |
| `pnpm study migrate [--dry-run]` | Once, in a repo with progress in its READMEs: archives the solutions and strips the READMEs |
| `pnpm study status [<id>] [--json]` | Your progress on a problem, an exercise, a concept, or everything |
```

4. In `## Web playground`:
   - change "Your code is saved to `solution.py` / `solution.ts` 500 ms after you stop typing" to "Your code is saved to `.study/solutions/…/solution.py` / `solution.ts` 500 ms after you stop typing";
   - change the **Concept page** bullet to `- **Concept page:** read the note and write "My explanation" (saved in \`.study/explanations\`).`;
   - replace the sentence "When you are green, ask Claude for `/review` in the terminal: the playground never changes a problem's status." with "Your saves and runs count as practice: an attempt starts with your first real edit or run and ends at your first green run. Ask Claude for `/review` when you are green."

- [ ] **Step 7: Run everything**

Run: `pnpm verify`
Expected: all green, with the same `check` warnings as after Task 18.

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/problem/SKILL.md .claude/skills/concept/SKILL.md CLAUDE.md README.md scripts/tests/claude-layer.test.ts
git commit -m "docs: content-only templates, the .study layout and the study commands"
```

---

## Final check (after Task 19)

- [ ] Run `pnpm verify && pnpm e2e`. Both must be green.
- [ ] Run `git status --short`. It must show only the user's files: the three modified `concepts/hash-map/` READMEs (`README.md`, `exercises/01-first-repeat/README.md`, `exercises/02-most-frequent/README.md`), and any untracked solution files, which `.gitignore` may now hide.
- [ ] Run `test ! -e .study/study.db && echo "no study database in the real repo"`. It must print the message. Plan A never initializes or migrates the real repo.
- [ ] Run `git log --oneline "$BASE"..HEAD`. It must show 19 commits, one per task.
- [ ] Hand-off for the user, not to be run by the plan:
  - after Plans B and C, stop `pnpm play` / `pnpm watch` and run `pnpm study migrate --dry-run`, then `pnpm study migrate`;
  - review `git status` and commit the stripped READMEs and the removed solution files;
  - then ask the coach "¿qué me toca hoy?".
