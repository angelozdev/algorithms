# Study Coach Plan B (presets, scheduler, phases, `today`, the playground's Today section) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the progress Plan A records into a coach: curriculum presets, FSRS reviews, phases with their announcements, a stored daily plan served by `pnpm today` and the study CLI, and the playground's Today section with Start review. This covers milestones M6 and M7 of the study coach spec.

**Architecture:**
- **Engine** (`study/`, deterministic, no UI; each function gets its `now`):
  - `curriculum.ts` (presets, zod), `catalog.ts` (content joined in memory), `days.ts` (local days), `random.ts` (seeded order);
  - `fsrs.ts` (ratings, replayed cards) behind Plan A's close seam (`close-hook.ts`);
  - `exam.ts` and `phase.ts` (criteria and transitions), `switch.ts` (start, switch, expansion list, forced phase), `pause.ts`;
  - `sequence.ts` (phase 1's cycle), `plan-store.ts` and `plan.ts` (the stored daily plan), `today.ts` (rendering, announcements, acks), `start.ts` (Start review), `export.ts`;
  - the CLI cases in Plan A's `commands.ts`.
- **Thin clients:** the playground's `/api/study/*` routes and the web's Today section and Start review gate only call the engine. The live refresh rides on Plan A's `progress` event from `.study/state.json`, whose `today` summary this plan fills.
- **No schema change:** Plan A's tables, views and checks hold everything (the migration drift test keeps passing).

**Tech Stack:**
- Node 24.14, pnpm 11.3, TypeScript 7.0, Vitest 5, Playwright 1.63, zod 4.6.5, yaml 2.9.1, Hono 4.13, React 19, TanStack Query 5 and Router 1, shadcn/ui components already in `playground/web/components/ui`.
- From Plan A: `better-sqlite3` 13.0.3, `drizzle-orm` 0.45.3, `ts-fsrs` 5.4.2 (exact; unused until this plan).
- New, pinned exactly: `@date-fns/tz` 1.5.0 (local midnight across daylight saving time; no dependencies).

**Spec:** `docs/superpowers/specs/2026-10-04-study-coach-design.md` (the approved design, binding authority; commit 14f0b01 lets the coach run `study curriculum set` on the user's explicit request). Sections used: §1, §2 (D8–D13), §4 (cards cache, views, `state.json`), §5, §6, §7 ("Start review"), §10 (playground rows, `check`), §11, §12, §13, §14, §15 (M6, M7).

**Prerequisite:** Plan A, `docs/superpowers/plans/2026-10-04-study-coach-a.md` (milestones M1–M5), is fully executed on the branch `study-coach`. This plan builds on the names in Plan A's "Interfaces for Plans B and C" and on the code of its Tasks 2–4, 6–7, 9, 12–14, 16 and 18, exactly as Plan A writes them.

**Start condition:**
- The main checkout `/Users/angelozdev/me/algorithms` is on `study-coach`, with Plan A's 19 commits on top of `main`, and `pnpm verify && pnpm e2e` green.
- Before Task 1 the controller records `BASE_B=$(git rev-parse HEAD)`.
- This plan was written against `main` at c456959 (the spec commit 14f0b01 plus a home-page scroll fix that changes only `<main>`'s class in `playground/web/routes/home.tsx` and adds e2e tests to `home.spec.ts`; no anchor used here is affected).
- All paths below are relative to the repo root.

**Final location of this file:** `docs/superpowers/plans/2026-10-04-study-coach-b.md`.

**Follow-up owned by Plan C (M8):** the `coach` skill and the five phase-0 concept notes (`big-o`, `recursion`, `arrays-and-strings`, `maps-and-sets`, `sorting`) with their exercises. It builds on "Interfaces for Plan C" at the end of this plan.

**How this plan was checked:** every task below was replayed in order on a scratch copy of the repo carrying Plan A's engine (its code blocks applied verbatim): each "verify it fails" step failed, each "run the tests" step passed, and each commit staged exactly the files its task changed. `pnpm e2e`'s new spec passed there on port 4391.

## Global Constraints

- **Where:**
  - Work in the main checkout `/Users/angelozdev/me/algorithms`, on the branch `study-coach`, after Plan A.
  - Never commit to `main`. Never touch the retired `playground` worktree.
  - No push, merge, rebase or PR.
- **The user's files:**
  - Never stage, edit, move or delete the user's untracked or modified files. Today these are the three modified `concepts/hash-map/` READMEs (`README.md`, `exercises/01-first-repeat/README.md`, `exercises/02-most-frequent/README.md`) and the untracked `solution.py` / `solution.ts` files (hash-map 01 and 02, two-pointers/01-pair-sum, lc-0026, lc-0053, lc-0066, lc-0067, lc-0070). New ones may appear while you work.
  - Every task starts by recording `git status --porcelain`; every path in it is the user's for that task.
  - Stage by explicit path only (each task's commit step lists them). Never `git add -A`, `git add .`, `git commit -a`, `git stash`, `git reset --hard`, `git checkout -- <path>` or `git clean`.
  - If `pnpm verify` or `check` fails only because of such a file, report it and do not fix it.
- **The real repo's progress stays put until the user migrates:**
  - Never run `pnpm study migrate`, `pnpm study init`, `pnpm study start`, `pnpm study curriculum set`, `pnpm today` or `pnpm sync` against the real repo, and never call their functions on it. The real repo must have no `.study/study.db` when this plan ends.
  - Every test that needs a study store builds it in a temp repo (`makeCoachRepo`, `makeTempDir`, Plan A's `makeRepo` and `makeStudyRepo`) or in the e2e repo (`playground/e2e/.tmp/repo`). `vitest.config.ts` already clears `ALGO_STUDY` for every test (Plan A Task 1).
- **Ports and browser:**
  - Port 4173 is the user's running `pnpm play`: never use, stop or restart it.
  - `pnpm e2e` uses 4391 and 4392 (`playground/e2e/fixture.ts`, `restart.spec.ts`), which is fine.
  - No claude-in-chrome; never the user's Chrome.
- **Language:** every repo file, code comment, test name and commit message is in English. Commits follow Conventional Commits, as in `git log`.
- **No spoilers** (CLAUDE.md hard rule 1):
  - No fixture, test, doc or commit may contain code, pseudocode, an approach or a complexity that solves any problem or exercise in the repo.
  - Test problems are synthetic (`lc-91NN`, "Sample 91NN", placeholder statements, Plan A's shared `CASES_JSON`); the e2e repo reuses the existing Two Sum fixture solution.
- **Dependencies:** only `@date-fns/tz@1.5.0`, added with `pnpm add @date-fns/tz@1.5.0` (pnpm 11 saves the exact version). Nothing else is added or upgraded.
- **Schema:** this plan changes no table, view or migration. `study/tests/migrations.test.ts` (the drift check) must keep passing; if a change seems to need a migration, stop and ask.
- **Verification:**
  - `pnpm verify` (Vitest, both `tsc` runs, `check`) stays green after every task, with 0 errors. The real repo's `check` shows the same warnings as after Plan A and no `curriculum/…` line.
  - `pnpm e2e` stays green after every task that touches `playground/`: Tasks 12–15.
- **Spec authority:** where this plan reads the spec in a way the spec does not spell out, the ruling is in "Decisions and spec rulings" below. Do not re-decide them in a task.

## Verified dependency facts

Checked on 2026-10-04 in scratch installs (macOS arm64, Node 24.14.0, pnpm 11.3.0, TypeScript 7.0.2). The plan relies on them; do not re-litigate them.

1. **ts-fsrs 5.4.2:**
   - `generatorParameters({ request_retention: 0.85, maximum_interval: 180, enable_fuzz: true, enable_short_term: false })` returns those values, 21 weights, and `learning_steps ["1m", "10m"]` / `relearning_steps ["10m"]`, which `enable_short_term: false` ignores. `fsrs(params)` builds the scheduler.
   - `createEmptyCard(now)`; `scheduler.next(card, now, grade).card`; `Rating.Again | Hard | Good | Easy` are 1–4; `State.New | Learning | Review | Relearning` are 0–3. `next` also takes a plain object whose `due` is an ISO string.
   - From a new card, with short-term steps off, the first review lands in `Review` state: Again → 1 day, Hard → 2, Good → 5, Easy → 19 (stability 0.21, 1.29, 2.31, 8.30).
   - **Replay is deterministic with fuzz on:** `DefaultInitSeedStrategy` seeds from `${review_time}_${reps}_${difficulty × stability}`. Two replays of the same history give equal cards, while the same grade at different seconds gives different intervals (31–39 days for a second Good).
   - `get_retrievability(card, now, false)` returns a number (0.869 at the due date of the card above); with `true` it returns a string such as `"79.71%"`.
   - `maximum_interval: 180` is honored by the interval function, but its Hard < Good < Easy ordering can push an Easy interval to 182 days, even with fuzz off. No test asserts ≤ 180.
   - Importing it patches `Date.prototype` with four deprecated helpers (`scheduler`, `diff`, `format`, `dueFormat`); harmless.
2. **`@date-fns/tz` 1.5.0:** `new TZDate(y, m, d, zone)` is local midnight (`America/Bogota` 2026-10-05 → `05:00Z`; `America/New_York` 2026-03-08 → `05:00Z`, 03-09 → `04:00Z`). `new TZDate(ms, zone)` gives local fields. No dependencies. Node 24.14 has no `Temporal`.
3. **yaml 2.9.1** (already a dependency, used by `lib/frontmatter.ts`): `parse` throws `YAMLParseError` whose first message line names the line and column. **zod 4.6.5** issue messages: `Too small: expected number to be >0`, `Unrecognized key: "extra"`, `Invalid option: expected one of "a"|"b"`; `formatPath` (`runner/src/schema.ts`) renders paths as `phases.learn.block` and `patterns[2].pattern`.
4. **better-sqlite3 13.0.3:** `sqlite.prepare("VACUUM INTO ?").run(file)` copies a WAL database into one file, and fails with `output file already exists` rather than overwrite.
5. **drizzle-orm 0.45.3:** `BaseSQLiteDatabase<"sync", Database.RunResult, typeof schema>` (from `drizzle-orm/sqlite-core`) accepts both `study.db` and a transaction (`tsc` 7.0.2). `max(column)` returns a `Date` for a `timestamp_ms` column; `count()` works in a `select`. Statements run on `study.db` inside an `inTransaction` callback join that transaction (same connection).
6. **Hono 4.13.12:** a `:id{.+}` path parameter matches ids with a slash (`/api/study/start/hash-map/01`), and the typed client's key `":id{.+}"` sends them unencoded; a plain `:id` answers 404 for them. `hono/csrf` treats a POST with no content type as a form post, so server tests send a JSON body (`{ json: {} }`); browsers send `Origin`, which `formCsrf` accepts.
7. **jsdom web tests:** in the work view, `userEvent.type` does not reach the textarea that stands in for CodeMirror; `fireEvent.change` does (the tests use it).
8. **List data** (fetched 2026-10-04; the presets' headers say the same):
   - TIH's Grind data: 169 questions in recommended order (41 easy, 102 medium, 26 hard, 12 premium), in the page chunk that contains `"slug":"two-sum"`. Six of the repo's Grind 75 problems (lc-0704, lc-0876, lc-0973, lc-0981, lc-0994, lc-1235) are not among them.
   - neetcode.io's main bundle: 150 entries with `neetcode150:!0` in 18 categories; 58 of the repo's Grind 75 problems are among them.
9. **The scratch e2e run:** with Plan A's e2e fixture, the four tests of `today.spec.ts` passed together with the existing specs on port 4391.

## Review Focus

The five failure modes most likely to bite, each pinned by a test in the task named:

1. **A broken or missing preset must never block recording a run.** A green run still closes and is rated with the default time-boxes; `today` and `check` report the preset's issues. Test: Task 4, "never let a broken preset break a recorded run".
2. **Content that disappears after it was planned** (a renamed or deleted problem, a concept note not written yet) must not break `today` or the Today section. The row keeps its id as title and says `missing: true`. Tests: Task 9, "renders a planned item whose content is gone", and the missing concept in "marks planned items done".
3. **Two processes, one day:** the playground and the CLI must see the same stored plan, never two plans or a primary-key error. Test: Task 8, "gives a second handle on the same database the stored plan".
4. **The live refresh must not loop:** the `progress` event refetches today's plan, and that request must not rewrite `state.json` when nothing changed. Test: Task 9, "leaves state.json alone when nothing changed".
5. **Start review must never lose the user's code:** the archive is verified before the delete, never overwrites a history file, and opens no attempt when it fails. Test: Task 10, "never overwrites a history file".

## Decisions and spec rulings

Where the spec is silent or ambiguous, this plan rules as follows. The final report to the user lists the rulings marked **(spec)**.

1. **(spec) Backlog spreading, §6.4** ("due cards beyond about 14 days of review capacity are spread across the coming days"). A day never takes more reviews than its capacity (about 60% of the budget), so a backlog is always spread over the coming days in priority order, whatever its size, and card data never changes. `today` reports `backlog: { waiting, days }`. The 14-day figure adds no separate rule under this cap; nothing else uses it.
2. **(spec) Exam rows, §11.** The `today --json` kinds in §11 are `continue|review|new|concept`, but §11's Today section has "review and exam rows". Exam problems come out as `kind: "exam"`. They are stored with slot `new`, since Plan A's schema allows only four slots, and recognized as members of the latest exam while in phase 2.
3. **(spec) A given-up exercise is retried through the gate, §6.1 / §7.** Phase 0 needs every base exercise done, and Plan A never reopens a closed item by itself. An exercise whose latest attempt was given up therefore shows a "Start again" gate (kind `retry`), handled like Start review.
4. **(spec) "Unseen Mediums", §6.1 phase 3:** first tries of the expansion list's medium problems that are not in the learn list. Problems shared by both lists were seen in phases 1–2.
5. **(spec) The preset gains `phases.learn.size`, §5 / §13.** Reporting a partially imported list needs the list's upstream size. It is a count, not membership; membership stays the frontmatter `lists` field.
6. **(spec) Extra commands and a route:**
   - `pnpm study ack <id>`: the chat surface's acknowledgment (§6.1);
   - `pnpm study curriculum expand <list>`: stores `profile.expansion_list` (§6.1);
   - `pnpm study backup`: §12's `VACUUM INTO`;
   - `POST /api/study/resume`, which Plan A's guard already denies to Claude.
7. **Starting the coach.** `today` never picks a preset by itself: until `pnpm study curriculum set <preset>`, it answers `started: false`, and the coach skill onboards the user (§11: minutes, language, preset). The first `set` logs `curriculum_log` (`init`) and the phase computed from scratch, and announces it (`coach-started`).
8. **The concept gates its block, §6.2.4.** While the current pattern's block is not done and its concept is not learned, the day's only new item is that concept. Phase 0 plans one concept a day. A concept slot is estimated at 20 minutes.
9. **Phase 1's cycle.** Each pattern's block comes from the problems not done before it was introduced. Problems first done after the block count toward its mix. Patterns with nothing left are skipped. A pattern is recorded in `pattern_intros` when the step that introduces it is planned.
10. **Exams.**
    - The first phase-2 plan starts an exam (seed from the list, the local date and the number of earlier exams).
    - A first-try success is a try rated Good or Easy; a failure is re-solved by a later green attempt.
    - A new exam starts only when no finished exam reached the threshold. Otherwise the failures come back as reviews until they are solved.
11. **Modes.**
    - Return mode counts idle time without finished pauses: a pause is not an absence.
    - When return and catch-up both apply, the day is `return` (one new item allowed).
    - Catch-up compares overdue cards (due before today) with 3 days of today's review capacity.
12. **Continue** plans every open attempt, not only one.
13. **`state.json`'s `today`** (Plan A's `TodaySummary`, filled here) also carries `paused` and the playground's pending announcement count. That way a pause from the terminal, or an announcement made by a chat command, refreshes the Today section live.
14. **Time.** Engine entry points take an explicit `now`. The CLI passes its clock (`ALGO_STUDY_NOW` in tests), and the server passes `envClock().now()`.
15. **Reasons are English and short** (`due 3 days ago`, `block 2/3 · arrays-hashing`); the coach skill words them in Spanish.
16. **Grind 75's pattern order and concepts** are listed in Task 2. Grind 169 and NeetCode 150 follow their sources' order, as documented in their headers.

## File map

| File | Change | Task |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | `@date-fns/tz` 1.5.0 | 1 |
| `study/days.ts`, `study/random.ts`, `study/catalog.ts` | local days, seeded order, content catalog | 1 |
| `study/curriculum.ts`, `curriculum/{grind-75,grind-169,neetcode-150}.yaml` | presets and their schema | 2 |
| `scripts/lib/checks.ts` | presets validated; a pattern missing from a preset warns | 2 |
| `study/store.ts` | `StudyQueries` | 3 |
| `study/fsrs.ts`, `study/close-hook.ts` | ratings, cards by replay, the seam's body | 3, 11 |
| `study/exam.ts`, `study/phase.ts`, `study/record.ts` | exams, criteria, transitions; evaluation after each recorded attempt | 4 |
| `study/switch.ts` | start, switch, expansion list, forced phase | 5 |
| `study/pause.ts` | pause, resume | 6 |
| `study/sequence.ts` | phase 1's concept/block/mix cycle | 7 |
| `study/open-attempts.ts`, `study/state.ts`, `study/state-file.ts`, `study/status.ts` | `openAttemptList` moved; `state.json`'s `today` | 8 |
| `study/plan-store.ts`, `study/plan.ts` | the stored daily plan | 8 |
| `study/today.ts` | rendering, announcements, acks; phase and curriculum views | 9, 11 |
| `study/start.ts` | Start review | 10 |
| `study/export.ts`, `study/commands.ts`, `study/status.ts` | the CLI; `study status --json`'s `coach` | 11 |
| `README.md`, `CLAUDE.md`, `scripts/tests/claude-layer.test.ts` | the commands; Today and Start review | 11, 15 |
| `playground/server/{study,app,types,targets}.ts` | `/api/study/*`; the gate on targets | 12 |
| `playground/web/{api.ts,events.tsx,lib/labels.ts}` | API calls, `keys.today`, labels | 13 |
| `playground/web/home/TodaySection.tsx`, `routes/home.tsx`, `home/model.ts`, `home/ContinueCards.tsx` (deleted) | the Today section replaces Continue | 13 |
| `playground/web/routes/work.tsx` | the Start review gate; no Keep mine on a fresh start | 14 |
| `playground/e2e/fixture.ts`, `playground/e2e/today.spec.ts` | end-to-end | 15 |
| `study/tests/coach-fixture.ts` and `study/tests/*.test.ts`, `playground/tests/{server,web}/*` | tests | 1–15 |

---

## Milestone M6: presets, scheduler, phases and `today`

### Task 1: Engine foundations: local days, a seeded order, the content catalog, and the scheduler's test repo

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (through `pnpm add`)
- Create: `study/days.ts`, `study/random.ts`, `study/catalog.ts`
- Create: `study/tests/coach-fixture.ts` (shared by every scheduler test from here on)
- Test: `study/tests/foundations.test.ts` (create)

**Interfaces:**
- Consumes (Plan A): `scanRepo`, `str`, `strList` (`lib/repo.ts`), `parseMarkdown` (`lib/frontmatter.ts`), `problemIdFromFolder` (`lib/ids.ts`); `fixedClock`, `FixedClock` (`study/clock.ts`); `openMemoryStudy`, `inTransaction`, `Study` (`study/store.ts`); `recordWork`, `recordHint`, `giveUp`, `acceptExplanation`, `openAttempt` (`study/record.ts`); `profile`, `phaseLog`, `curriculumLog`, `announcements` (`study/schema.ts`); `put`, `makeTempDir`, `CASES_JSON`, `conceptReadme`, `exerciseReadme` (`scripts/tests/fixture.ts`, Plan A Task 18 signatures).
- Produces:
  - `study/days.ts`: `DAY_MS`; `localDate(at: Date, timezone: string): string` ("YYYY-MM-DD"); `addDays(date: string, days: number): string`; `daysBetween(from: string, to: string): number`; `startOfLocalDay(date: string, timezone: string): Date`; `interface LocalDay { date: string; start: Date; end: Date }`; `localDay(at: Date, timezone: string): LocalDay`.
  - `study/random.ts`: `seedFrom(text: string): number`; `shuffled<T>(items: readonly T[], seed: number): T[]`.
  - `study/catalog.ts`: `DIFFICULTIES`, `type Difficulty`; `interface CatalogProblem { id; title; difficulty: Difficulty | null; pattern: string | null; lists: string[] }`; `interface CatalogExercise { id; title; concept }`; `interface CatalogConcept { slug; title; exercises: string[] }`; `interface Catalog { problems: Map<string, CatalogProblem>; exercises: Map<string, CatalogExercise>; concepts: Map<string, CatalogConcept> }`; `loadCatalog(root): Catalog`; `problemNumber(id): number | null`; `easyToHard(a, b): number`; `listMembers(catalog, list): CatalogProblem[]` (sorted by id); `itemTitle(catalog, id): string | null`; `readProblem(root, id): CatalogProblem | null` (never throws).
  - `study/tests/coach-fixture.ts`: `TZ = "America/Bogota"`, `MONDAY = "2026-10-05T14:00:00.000Z"`, `DAY`; `PROBLEMS`, `DEMO_LIST`, `WIDE_LIST`, `PRESETS` (YAML text of the presets `demo-list`, `wide-list`, `ghost-list`); `problemReadme(problem)`; `makeCoachRepo(): string`; `interface Coach { root; study; clock }`; `coach({ start?, minutes? }): Coach`; `begin(c, preset?)`; `solve(c, itemId, rating?: "good" | "easy" | "hard")`; `fail(c, itemId)`; `learn(c, slug, exercises?)`; `review(c, itemId, rating?, { examId? })`; `phases(study): [phase, reason][]`.

The fixture is synthetic on purpose (CLAUDE.md hard rule 1): placeholder problems `lc-91NN` titled "Sample 91NN" with one shared `cases.json`, made-up lists (`demo-list`, `wide-list`, `ghost-list`) and concepts (`basics-a`, `basics-b`, `map-intro`, `pointer-intro`; `stack-intro` and `graph-intro` deliberately have no note). Nothing in it solves anything.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output. Every path in it is the user's: never stage, edit or delete it in this task.

- [ ] **Step 1: Add the time-zone library, pinned exactly**

The engine needs local midnight in `profile.timezone`, daylight saving time included (spec §6.3). Node 24.14 has no `Temporal`, so use `@date-fns/tz` (TZDate; no dependencies) instead of hand-rolled offset math.

```bash
pnpm add @date-fns/tz@1.5.0
```

Expected: exit 0; `package.json` lists `"@date-fns/tz": "1.5.0"` with no `^`; `pnpm-workspace.yaml` is unchanged.

- [ ] **Step 2: Write the failing tests**

Create `study/tests/coach-fixture.ts`:

```ts
// A synthetic repo for the scheduler's tests: placeholder problems (no real statements, no solutions) tagged with
// made-up lists, synthetic concepts, and presets named after their lists.
import { CASES_JSON, conceptReadme, exerciseReadme, makeTempDir, put } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { acceptExplanation, giveUp, openAttempt, recordHint, recordWork } from "../record.ts";
import { announcements, curriculumLog, phaseLog, profile } from "../schema.ts";
import { inTransaction, openMemoryStudy, type Study } from "../store.ts";

/** Every scheduler test runs in this zone (UTC-5, no daylight saving time): local midnight is 05:00Z. */
export const TZ = "America/Bogota";
/** Monday 2026-10-05, 09:00 local. */
export const MONDAY = "2026-10-05T14:00:00.000Z";
export const DAY = 86_400_000;

interface FixtureProblem {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  patterns: string[];
  lists: string[];
}

/** Placeholder problems: "Sample 9101" and so on. Each pattern's problems, easy to hard, are listed in id order. */
export const PROBLEMS: FixtureProblem[] = [
  { id: "lc-9101", difficulty: "easy", patterns: ["arrays-hashing"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9102", difficulty: "medium", patterns: ["arrays-hashing"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9103", difficulty: "hard", patterns: ["arrays-hashing"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9104", difficulty: "easy", patterns: ["two-pointers"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9105", difficulty: "medium", patterns: ["two-pointers"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9106", difficulty: "easy", patterns: ["stack"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9107", difficulty: "medium", patterns: ["stack"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9108", difficulty: "medium", patterns: ["greedy"], lists: ["demo-list"] },
  { id: "lc-9111", difficulty: "medium", patterns: ["arrays-hashing"], lists: ["wide-list"] },
  { id: "lc-9112", difficulty: "medium", patterns: ["two-pointers"], lists: ["wide-list"] },
  { id: "lc-9113", difficulty: "medium", patterns: ["stack"], lists: ["wide-list"] },
  { id: "lc-9114", difficulty: "medium", patterns: ["graphs"], lists: ["wide-list"] },
];

export const DEMO_LIST = PROBLEMS.filter((p) => p.lists.includes("demo-list")).map((p) => p.id);
export const WIDE_LIST = PROBLEMS.filter((p) => p.lists.includes("wide-list")).map((p) => p.id);

function preset(id: string, options: { size: number; expand: string[]; patterns: [string, string][] }): string {
  return [
    `id: ${id}`,
    "phases:",
    "  bases: { concepts: [basics-a, basics-b] }",
    `  learn: { list: ${id}, size: ${options.size}, block: 2, mix_after_block: 1 }`,
    `  master: { list: ${id}, first_try_success: 0.8 }`,
    `  expand: { choose_from: [${options.expand.join(", ")}], window: 3, unseen_medium_success: 0.65, medium_minutes: 35 }`,
    "  pro: { tracks: [interview] }",
    "patterns:",
    ...options.patterns.map(([pattern, concept]) => `  - { pattern: ${pattern}, concept: ${concept} }`),
    "timebox_minutes: { easy: 15, medium: 35, hard: 50 }",
    "",
  ].join("\n");
}

const PATTERNS: [string, string][] = [
  ["arrays-hashing", "map-intro"],
  ["two-pointers", "pointer-intro"],
  ["stack", "stack-intro"],
];

/** demo-list (8 problems, complete), wide-list (11 of 12 imported) and ghost-list (nothing imported). */
export const PRESETS: Record<string, string> = {
  "demo-list": preset("demo-list", { size: 8, expand: ["wide-list", "ghost-list"], patterns: PATTERNS }),
  "wide-list": preset("wide-list", { size: 12, expand: ["demo-list"], patterns: [...PATTERNS, ["graphs", "graph-intro"]] }),
  "ghost-list": preset("ghost-list", { size: 5, expand: ["demo-list"], patterns: PATTERNS }),
};

export function problemReadme(problem: FixtureProblem): string {
  const number = problem.id.slice(3).replace(/^0+/, "");
  return [
    "---",
    `id: ${problem.id}`,
    `title: Sample ${number}`,
    "source: leetcode",
    `url: https://leetcode.com/problems/sample-${number}/`,
    `difficulty: ${problem.difficulty}`,
    `patterns: [${problem.patterns.join(", ")}]`,
    "concepts: []",
    `lists: [${problem.lists.join(", ")}]`,
    "---",
    `# Sample ${number}`,
    "",
    "## Statement",
    "",
    "Placeholder.",
    "",
    "## Concepts",
    "",
    "<!-- auto:concepts -->",
    "<!-- /auto -->",
    "",
  ].join("\n");
}

/**
 * The repo: the problems above; concepts basics-a and basics-b (one exercise each), map-intro (one exercise) and
 * pointer-intro (no exercise). stack-intro and graph-intro have no note: the concept skill would create them.
 */
export function makeCoachRepo(): string {
  const root = makeTempDir("algo-coach-");
  for (const problem of PROBLEMS) {
    const folder = `problems/${problem.id}-sample`;
    put(root, `${folder}/README.md`, problemReadme(problem));
    put(root, `${folder}/cases.json`, CASES_JSON);
  }
  for (const [slug, exercise] of [["basics-a", true], ["basics-b", true], ["map-intro", true], ["pointer-intro", false]] as const) {
    put(root, `concepts/${slug}/README.md`, conceptReadme({ slug, title: `Concept ${slug}`, requires: [] }));
    if (exercise) {
      put(root, `concepts/${slug}/exercises/01-drill/README.md`, exerciseReadme({ id: `${slug}/01`, title: `Drill ${slug}`, concept: slug }));
      put(root, `concepts/${slug}/exercises/01-drill/cases.json`, CASES_JSON);
    }
  }
  for (const [id, text] of Object.entries(PRESETS)) put(root, `curriculum/${id}.yaml`, text);
  return root;
}

export interface Coach {
  root: string;
  study: Study;
  clock: FixedClock;
}

/** A fresh repo and an in-memory study at Monday 09:00 local, with a 45-minute profile in TZ. */
export function coach(options: { start?: string; minutes?: number } = {}): Coach {
  const root = makeCoachRepo();
  const clock = fixedClock(options.start ?? MONDAY);
  const study = openMemoryStudy({ clock, root });
  study.db.insert(profile).values({ id: 1, dailyMinutes: options.minutes ?? 45, language: "py", timezone: TZ, createdAt: clock.now() }).run();
  return { root, study, clock };
}

/**
 * Starts the coach on `preset` at phase 0, writing the rows `pnpm study curriculum set` writes for a first preset
 * (curriculum_log init, phase_log bases, a phase announcement). For tests that run before setCurriculum exists.
 */
export function begin(c: Coach, preset = "demo-list"): void {
  const at = c.clock.now();
  const curriculum = c.study.db.insert(curriculumLog).values({ at, preset, reason: "init" }).returning().get();
  const phase = c.study.db.insert(phaseLog).values({ at, phase: "bases", reason: "criteria", curriculumLogId: curriculum.id }).returning().get();
  c.study.db.insert(announcements).values({ at, kind: "phase", phaseLogId: phase.id }).run();
}

/**
 * Solves `itemId` from scratch, ending at the clock's time (problems are then rated as asked):
 * - good: one green run (unmeasured time, so at best Good);
 * - easy: an edit, a save and a green run one minute apart (measured, 2 minutes);
 * - hard: a hint, then a green run.
 * The item must have no closed attempt, or an open one (a review started with startAttempt).
 */
export function solve(c: Coach, itemId: string, rating: "good" | "easy" | "hard" = "good"): void {
  if (rating === "hard") recordHint(c.study, itemId);
  if (rating === "easy") {
    recordWork(c.study, itemId, { type: "edit", lang: "py", differsFromStub: true }, "watch");
    c.clock.advance(60_000);
    recordWork(c.study, itemId, { type: "save", lang: "py", differsFromStub: true }, "playground");
    c.clock.advance(60_000);
  }
  recordWork(c.study, itemId, { type: "run", lang: "py", green: true }, "cli");
}

/** Gives up (rating Again for a problem). */
export function fail(c: Coach, itemId: string): void {
  giveUp(c.study, itemId);
}

/** Accepts a concept's explanation and solves its exercises: the concept is learned (spec §6.1). */
export function learn(c: Coach, slug: string, exercises: string[] = [`${slug}/01`]): void {
  acceptExplanation(c.study, slug);
  for (const id of exercises) solve(c, id);
}

/** Opens a review attempt the way `study start` does (without the file work), then solves it. */
export function review(c: Coach, itemId: string, rating: "good" | "easy" | "hard" = "good", options: { examId?: number } = {}): void {
  inTransaction(c.study, (tx) => openAttempt(tx, itemId, c.clock.now(), options));
  if (rating === "hard") recordHint(c.study, itemId);
  recordWork(c.study, itemId, { type: "run", lang: "py", green: true }, "cli");
}

/** The phase_log rows, oldest first, as [phase, reason]. */
export function phases(study: Study): [string, string][] {
  return study.db.select({ phase: phaseLog.phase, reason: phaseLog.reason }).from(phaseLog).orderBy(phaseLog.id).all().map((row) => [row.phase, row.reason]);
}
```

Create `study/tests/foundations.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { easyToHard, itemTitle, listMembers, loadCatalog, readProblem } from "../catalog.ts";
import { addDays, daysBetween, localDate, localDay, startOfLocalDay } from "../days.ts";
import { seedFrom, shuffled } from "../random.ts";
import { makeCoachRepo, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

describe("local days (spec §6.3: the day boundary is local midnight in profile.timezone)", () => {
  it("gives the local date of an instant and the instants that bound its day", () => {
    expect(localDate(new Date("2026-10-06T04:59:59.999Z"), TZ)).toBe("2026-10-05");
    expect(localDate(new Date("2026-10-06T05:00:00.000Z"), TZ)).toBe("2026-10-06");
    expect(localDay(new Date("2026-10-05T14:00:00.000Z"), TZ)).toEqual({
      date: "2026-10-05",
      start: new Date("2026-10-05T05:00:00.000Z"),
      end: new Date("2026-10-06T05:00:00.000Z"),
    });
  });

  it("follows daylight saving time: a local day can be 23 hours long", () => {
    const day = localDay(new Date("2026-03-08T12:00:00.000Z"), "America/New_York");
    expect(day.start).toEqual(new Date("2026-03-08T05:00:00.000Z"));
    expect(day.end).toEqual(new Date("2026-03-09T04:00:00.000Z"));
    expect(startOfLocalDay("2026-11-01", "America/New_York")).toEqual(new Date("2026-11-01T04:00:00.000Z"));
  });

  it("counts calendar days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(daysBetween("2026-10-05", "2026-10-15")).toBe(10);
    expect(daysBetween("2026-10-15", "2026-10-05")).toBe(-10);
  });
});

describe("seeded order (spec §6.2: the mix is seeded by the local date)", () => {
  it("is the same for the same seed, a permutation, and differs between seeds", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `lc-${9100 + i}`);
    expect(seedFrom("2026-10-05")).toBe(seedFrom("2026-10-05"));
    expect(shuffled(ids, seedFrom("2026-10-05"))).toEqual(shuffled(ids, seedFrom("2026-10-05")));
    expect([...shuffled(ids, 7)].sort()).toEqual(ids);
    expect(shuffled(ids, seedFrom("2026-10-05"))).not.toEqual(shuffled(ids, seedFrom("2026-10-06")));
  });
});

describe("the catalog (spec D11: content is joined in memory)", () => {
  it("has runnable problems only, with their first pattern and lists, and concepts with their exercises", () => {
    const root = makeCoachRepo();
    put(root, "problems/lc-9199-draft/README.md", "---\nid: lc-9199\ntitle: Draft\n---\n# Draft\n"); // no cases.json
    put(root, "problems/lc-9198-broken/README.md", "---\nid: [\n---\n");
    put(root, "problems/lc-9198-broken/cases.json", "{}");
    const catalog = loadCatalog(root);
    expect(catalog.problems.has("lc-9199")).toBe(false);
    expect(catalog.problems.has("lc-9198")).toBe(false);
    expect(catalog.problems.get("lc-9101")).toEqual({ id: "lc-9101", title: "Sample 9101", difficulty: "easy", pattern: "arrays-hashing", lists: ["demo-list", "wide-list"] });
    expect(catalog.concepts.get("basics-a")).toEqual({ slug: "basics-a", title: "Concept basics-a", exercises: ["basics-a/01"] });
    expect(catalog.concepts.get("pointer-intro")!.exercises).toEqual([]);
    expect(listMembers(catalog, "demo-list").map((p) => p.id)).toEqual(["lc-9101", "lc-9102", "lc-9103", "lc-9104", "lc-9105", "lc-9106", "lc-9107", "lc-9108"]);
    expect([itemTitle(catalog, "basics-a/01"), itemTitle(catalog, "map-intro"), itemTitle(catalog, "lc-0000")]).toEqual(["Drill basics-a", "Concept map-intro", null]);
  });

  it("orders easy to hard, then by number", () => {
    const catalog = loadCatalog(makeCoachRepo());
    const ids = [...catalog.problems.values()].filter((p) => p.pattern === "arrays-hashing").sort(easyToHard).map((p) => p.id);
    expect(ids).toEqual(["lc-9101", "lc-9102", "lc-9111", "lc-9103"]);
  });

  it("reads one problem's README without scanning the repo, and never throws", () => {
    const root = makeCoachRepo();
    expect(readProblem(root, "lc-9103")).toMatchObject({ difficulty: "hard", pattern: "arrays-hashing" });
    expect(readProblem(root, "lc-0000")).toBeNull();
    expect(readProblem("/nowhere", "lc-9103")).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run study/tests/foundations.test.ts`
Expected: FAIL. `../catalog.ts`, `../days.ts` and `../random.ts` do not exist.

- [ ] **Step 4: Write the three modules**

Create `study/days.ts`:

```ts
import { TZDate } from "@date-fns/tz";

/** One calendar day, in milliseconds (only for durations: calendar math goes through the helpers below). */
export const DAY_MS = 86_400_000;

const pad = (n: number): string => String(n).padStart(2, "0");

/** The local calendar date ("YYYY-MM-DD") of `at` in `timezone` (spec §6.3: the day boundary is local midnight). */
export function localDate(at: Date, timezone: string): string {
  const local = new TZDate(at.getTime(), timezone);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** `date` moved by `days` calendar days ("2026-10-31" + 1 → "2026-11-01"). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to`, both "YYYY-MM-DD" (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The instant local midnight starts `date` in `timezone`, daylight saving time included. */
export function startOfLocalDay(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(new TZDate(year, month - 1, day, timezone).getTime());
}

export interface LocalDay {
  /** "YYYY-MM-DD" in the profile's time zone. */
  date: string;
  /** Local midnight that starts the day. */
  start: Date;
  /** Local midnight that starts the next day: "due today" means due before this. */
  end: Date;
}

/** The local day `at` falls in. */
export function localDay(at: Date, timezone: string): LocalDay {
  const date = localDate(at, timezone);
  return { date, start: startOfLocalDay(date, timezone), end: startOfLocalDay(addDays(date, 1), timezone) };
}
```

Create `study/random.ts`:

```ts
/** A 32-bit seed from text (FNV-1a), so a local date ("2026-10-05") always gives the same draw (spec §6.2). */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast PRNG with a 32-bit state; good enough to shuffle a study list. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A copy of `items` in an order fixed by `seed` (Fisher–Yates). Sort the input first for a stable result. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const next = generator(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

Create `study/catalog.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseMarkdown } from "../lib/frontmatter.ts";
import { problemIdFromFolder } from "../lib/ids.ts";
import { type ExerciseEntry, type ProblemEntry, scanRepo, str, strList } from "../lib/repo.ts";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** A problem as the engine sees it (spec D11: content stays in files; the engine joins it in memory). */
export interface CatalogProblem {
  id: string;
  title: string;
  difficulty: Difficulty | null;
  /** The first entry of `patterns` (spec §6.2); null when there is none. */
  pattern: string | null;
  lists: string[];
}

export interface CatalogExercise {
  id: string;
  title: string;
  concept: string;
}

export interface CatalogConcept {
  slug: string;
  title: string;
  /** Runnable exercise ids, in folder order. */
  exercises: string[];
}

export interface Catalog {
  problems: Map<string, CatalogProblem>;
  exercises: Map<string, CatalogExercise>;
  concepts: Map<string, CatalogConcept>;
}

const difficultyOf = (value: unknown): Difficulty | null => DIFFICULTIES.find((d) => d === value) ?? null;
/** Runnable, like listTargets(): a README that parses, and a cases.json (spec §5: "load as runnable targets"). */
const runnable = (entry: ProblemEntry | ExerciseEntry): boolean => entry.error === null && existsSync(path.join(entry.dir, "cases.json"));

/** Everything the engine needs from content, read once per command or request. */
export function loadCatalog(root: string): Catalog {
  const repo = scanRepo(root);
  const problems = new Map<string, CatalogProblem>();
  for (const entry of repo.problems.filter(runnable)) {
    problems.set(entry.folderId, {
      id: entry.folderId,
      title: str(entry.data.title, entry.folder),
      difficulty: difficultyOf(entry.data.difficulty),
      pattern: strList(entry.data.patterns)[0] ?? null,
      lists: strList(entry.data.lists),
    });
  }
  const exercises = new Map<string, CatalogExercise>();
  for (const entry of repo.exercises.filter(runnable)) {
    exercises.set(entry.folderId, { id: entry.folderId, title: str(entry.data.title, entry.folder), concept: entry.concept });
  }
  const concepts = new Map<string, CatalogConcept>();
  for (const entry of repo.concepts) {
    concepts.set(entry.slug, {
      slug: entry.slug,
      title: str(entry.data.title, entry.slug),
      exercises: [...exercises.values()].filter((exercise) => exercise.concept === entry.slug).map((exercise) => exercise.id),
    });
  }
  return { problems, exercises, concepts };
}

/** LeetCode's number in "lc-0242"; null for other ids. */
export function problemNumber(id: string): number | null {
  const match = /^[a-z]+-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

const RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Easy to hard (spec §6.2), then by number, then by id; a missing difficulty sorts as medium. */
export function easyToHard(a: CatalogProblem, b: CatalogProblem): number {
  return (
    RANK[a.difficulty ?? "medium"] - RANK[b.difficulty ?? "medium"] ||
    (problemNumber(a.id) ?? Number.MAX_SAFE_INTEGER) - (problemNumber(b.id) ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id)
  );
}

/** The problems of a list (frontmatter `lists`, spec §5), by id. */
export function listMembers(catalog: Catalog, list: string): CatalogProblem[] {
  return [...catalog.problems.values()].filter((problem) => problem.lists.includes(list)).sort((a, b) => a.id.localeCompare(b.id));
}

/** The title of a problem, an exercise or a concept; null when the content is gone (an orphan, spec §13). */
export function itemTitle(catalog: Catalog, id: string): string | null {
  return catalog.problems.get(id)?.title ?? catalog.exercises.get(id)?.title ?? catalog.concepts.get(id)?.title ?? null;
}

/**
 * One problem's README, without scanning the repo: the close seam reads the difficulty on every closed attempt.
 * Null when there is no such folder or its README does not parse. Never throws.
 */
export function readProblem(root: string, id: string): CatalogProblem | null {
  try {
    const dir = path.join(root, "problems");
    const folder = readdirSync(dir).find((name) => problemIdFromFolder(name) === id);
    if (!folder) return null;
    const { data } = parseMarkdown(readFileSync(path.join(dir, folder, "README.md"), "utf8"));
    return { id, title: str(data.title, folder), difficulty: difficultyOf(data.difficulty), pattern: strList(data.patterns)[0] ?? null, lists: strList(data.lists) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm vitest run study/tests/foundations.test.ts && pnpm exec tsc --noEmit`
Expected: 7 passed; `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml study/tests/coach-fixture.ts study/tests/foundations.test.ts study/days.ts study/random.ts study/catalog.ts
git commit -m "feat(study): add local days, a seeded order and the content catalog for the scheduler"
```


### Task 2: Curriculum presets (`grind-75`, `grind-169`, `neetcode-150`), their zod schema, and the `check` warning

**Files:**
- Create: `study/curriculum.ts`
- Create: `curriculum/grind-75.yaml`, `curriculum/grind-169.yaml`, `curriculum/neetcode-150.yaml`
- Modify: `scripts/lib/checks.ts`
- Test: `study/tests/curriculum.test.ts` (create), `scripts/tests/check.test.ts`

**Interfaces:**
- Consumes: `PATTERNS` (`lib/schemas.ts`); `formatPath` (`runner/src/schema.ts`); `Catalog`, `Difficulty`, `listMembers`, `loadCatalog` (Task 1); `makeCoachRepo`, `PRESETS` (Task 1 fixture); Plan A's `makeStudyRepo`, `put`, `cleanupTempDirs` and check.test.ts's local `edit` helper.
- Produces (`study/curriculum.ts`):
  - `presetSchema` (zod) and `type Preset`; `DEFAULT_PRESET = "grind-75"`; `DEFAULT_TIMEBOX = { easy: 15, medium: 35, hard: 50 }`;
  - `class PresetError { file: string; issues: string[] }` (each issue is `path: message`);
  - `curriculumDir(root)`, `presetFile(root, id)`, `listPresets(root): string[]`;
  - `loadPreset(root, id): Preset` (throws PresetError), `tryLoadPreset(root | null, id | null): Preset | null`;
  - `timeboxMinutes(preset | null, difficulty | null): number` (missing difficulty counts as medium);
  - `patternOrder(preset, catalog): string[]` (listed patterns, then the list's other patterns, sorted);
  - `conceptOf(preset, pattern): string | null`;
  - `interface ListImport { list; imported; size: number | null }`, `listImport(root, catalog, list): ListImport`.
- **Preset format:** spec §5's YAML plus one field, `phases.learn.size`, the list's upstream size. Membership still comes only from frontmatter `lists`; the size is what lets `today` report a partially imported list (spec §13). A list's size is read from the preset named like the list.
- **`check`:** every `curriculum/*.yaml` must validate (one error per zod issue, on `curriculum/<id>.yaml`); a pattern of the preset's list (first entry of a problem's `patterns`) that the preset does not list is a warning.

Where each list comes from (verified on 2026-10-04; the header of each YAML file says the same):
- **Grind 75:** the problems tagged `lists: [grind-75]`, imported from the LeetCode list `rab78cw1` (75 questions, none premium; `docs/superpowers/specs/2026-10-03-grind-75-design.md`). Pattern order: NeetCode's roadmap order, which is the order of `PATTERNS` in `lib/schemas.ts`, with `strings` moved up after `two-pointers`; it starts like spec §5's example.
- **Grind 169:** not a LeetCode list. Tech Interview Handbook's Grind tool (https://www.techinterviewhandbook.org/grind75) ships its 169 questions, in recommended order, inside its page bundle (`/grind75/_next/static/chunks/<hash>.js`, the chunk containing `"slug":"two-sum"`): each with `slug`, `id`, `difficulty`, `topic` and `routines`; 41 easy, 102 medium, 26 hard, 12 premium. Pattern order: the first appearance of each topic in that order, mapped to `PATTERNS`, with the routine-only patterns (interval, two-pointers, sliding-window, greedy) where that routine first appears. Note: 6 of the repo's Grind 75 problems (lc-0704, lc-0876, lc-0973, lc-0981, lc-0994, lc-1235) are not in TIH's current 169; the list will be partial even after an import.
- **NeetCode 150:** neetcode.io's main bundle (`https://neetcode.io/main.<hash>.js`) lists every problem as `{problem, pattern, link, difficulty, code, …}`; the 150 members carry `neetcode150:!0`. Pattern order: the order of its 18 categories (Advanced Graphs folds into `graphs`, Math & Geometry into `math`); NeetCode has no strings category.

Grind 75's phase 0 names the five concept notes Plan C writes: `big-o`, `recursion`, `arrays-and-strings`, `maps-and-sets`, `sorting`. Each pattern's opening concept is one the imported problems already reference where possible (`hash-map`, `two-pointers`, `string-parsing`, `sliding-window`, `stack`, `binary-search`, `linked-list`, `binary-tree`, `trie`, `heap`, `backtracking`, `graph-dfs`, `dynamic-programming`, `greedy`, `intervals`, `binary-representation`); the `concept` skill creates the missing notes when the plan reaches them (spec D7).

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/curriculum.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { scanRepo, strList } from "../../lib/repo.ts";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { loadCatalog } from "../catalog.ts";
import { DEFAULT_TIMEBOX, listImport, listPresets, loadPreset, patternOrder, PresetError, timeboxMinutes, tryLoadPreset } from "../curriculum.ts";
import { makeCoachRepo, PRESETS } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const issues = (root: string, id: string): string[] => {
  try {
    loadPreset(root, id);
    return [];
  } catch (error) {
    if (error instanceof PresetError) return error.issues;
    throw error;
  }
};

describe("the shipped presets (spec §5)", () => {
  it("are grind-75, grind-169 and neetcode-150, and all of them are valid", () => {
    expect(listPresets(REPO_ROOT)).toEqual(["grind-169", "grind-75", "neetcode-150"]);
    for (const id of listPresets(REPO_ROOT)) expect(loadPreset(REPO_ROOT, id).id).toBe(id);
  });

  it("grind-75 opens with the five phase-0 concepts and lists every pattern of the imported Grind 75 problems", () => {
    const preset = loadPreset(REPO_ROOT, "grind-75");
    expect(preset.phases.bases.concepts).toEqual(["big-o", "recursion", "arrays-and-strings", "maps-and-sets", "sorting"]);
    expect(preset.phases).toMatchObject({
      learn: { list: "grind-75", size: 75, block: 3, mix_after_block: 3 },
      master: { list: "grind-75", first_try_success: 0.8 },
      expand: { choose_from: ["grind-169", "neetcode-150"], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 },
    });
    expect(preset.timebox_minutes).toEqual({ easy: 15, medium: 35, hard: 50 });
    expect(preset.patterns.slice(0, 2)).toEqual([
      { pattern: "arrays-hashing", concept: "hash-map" },
      { pattern: "two-pointers", concept: "two-pointers" },
    ]);
    const listed = new Set(preset.patterns.map((entry) => entry.pattern as string));
    const used = scanRepo(REPO_ROOT)
      .problems.filter((p) => strList(p.data.lists).includes("grind-75"))
      .map((p) => strList(p.data.patterns)[0]);
    expect(used.filter((pattern) => !listed.has(pattern))).toEqual([]);
  });

  it("grind-169 and neetcode-150 keep their own pattern order", () => {
    expect(loadPreset(REPO_ROOT, "grind-169").patterns.map((e) => e.pattern)).toEqual([
      "arrays-hashing", "stack", "linked-list", "strings", "trees", "binary-search", "graphs", "dp-1d", "dp-2d",
      "intervals", "heap", "two-pointers", "sliding-window", "tries", "backtracking", "bit-manipulation", "greedy", "math",
    ]);
    expect(loadPreset(REPO_ROOT, "neetcode-150").patterns.map((e) => e.pattern)).toEqual([
      "arrays-hashing", "two-pointers", "sliding-window", "stack", "binary-search", "linked-list", "trees", "heap",
      "backtracking", "tries", "graphs", "dp-1d", "dp-2d", "greedy", "intervals", "math", "bit-manipulation",
    ]);
    expect(loadPreset(REPO_ROOT, "grind-169").phases.learn.size).toBe(169);
    expect(loadPreset(REPO_ROOT, "neetcode-150").phases.learn.size).toBe(150);
  });

  it("report grind-169 and neetcode-150 as not imported yet", () => {
    const catalog = loadCatalog(REPO_ROOT);
    expect(listImport(REPO_ROOT, catalog, "grind-169")).toEqual({ list: "grind-169", imported: 0, size: 169 });
    expect(listImport(REPO_ROOT, catalog, "neetcode-150")).toEqual({ list: "neetcode-150", imported: 0, size: 150 });
  });
});

describe("loadPreset (spec §13: zod issues with paths)", () => {
  it("lists every issue with its path", () => {
    const root = makeCoachRepo();
    put(root, "curriculum/bad.yaml", PRESETS["demo-list"].replace("id: demo-list", "id: bad").replace("block: 2", "block: 0").replace("pattern: stack", "pattern: stacks"));
    expect(issues(root, "bad")).toEqual([
      "phases.learn.block: Too small: expected number to be >0",
      'patterns[2].pattern: Invalid option: expected one of "arrays-hashing"|"two-pointers"|"sliding-window"|"stack"|"binary-search"|"linked-list"|"trees"|"tries"|"heap"|"backtracking"|"graphs"|"dp-1d"|"dp-2d"|"greedy"|"intervals"|"math"|"bit-manipulation"|"strings"',
    ]);
  });

  it("rejects broken YAML, a duplicated pattern, an id that is not the file name, and an unknown preset", () => {
    const root = makeCoachRepo();
    put(root, "curriculum/syntax.yaml", "id: [unclosed\n");
    expect(issues(root, "syntax")[0]).toMatch(/^YAML: /);
    put(root, "curriculum/twice.yaml", PRESETS["demo-list"].replace("id: demo-list", "id: twice").replace("pattern: stack", "pattern: two-pointers"));
    expect(issues(root, "twice")).toEqual(['patterns[2].pattern: "two-pointers" is listed twice']);
    put(root, "curriculum/other.yaml", PRESETS["demo-list"]);
    expect(issues(root, "other")).toEqual(['id: "demo-list" does not match the file name']);
    expect(issues(root, "nope")).toEqual(['there is no preset "nope" (presets: demo-list, ghost-list, other, syntax, twice, wide-list)']);
    expect(() => loadPreset(root, "nope")).toThrow(/curriculum\/nope\.yaml: there is no preset/);
    expect(tryLoadPreset(root, "syntax")).toBeNull();
  });
});

describe("patterns and time-boxes", () => {
  it("puts patterns of the list that the preset misses after the listed ones (spec §5)", () => {
    const root = makeCoachRepo();
    expect(patternOrder(loadPreset(root, "demo-list"), loadCatalog(root))).toEqual(["arrays-hashing", "two-pointers", "stack", "greedy"]);
  });

  it("takes the time-box by difficulty, medium when unknown, and the defaults without a preset", () => {
    const root = makeCoachRepo();
    expect(timeboxMinutes(loadPreset(root, "demo-list"), "hard")).toBe(50);
    expect(timeboxMinutes(null, null)).toBe(35);
    expect(DEFAULT_TIMEBOX).toEqual({ easy: 15, medium: 35, hard: 50 });
  });

  it("knows how much of a list is imported", () => {
    const root = makeCoachRepo();
    expect(listImport(root, loadCatalog(root), "wide-list")).toEqual({ list: "wide-list", imported: 11, size: 12 });
  });
});
```

Then append to `scripts/tests/check.test.ts` (it already imports `checkRepo`, `makeStudyRepo`, `put` and `cleanupTempDirs`, and defines `edit`):

Append to `scripts/tests/check.test.ts`:

```ts
describe("checkRepo: curriculum presets (study coach spec §5, §10)", () => {
  afterEach(cleanupTempDirs);

  const PRESET = [
    "id: demo",
    "phases:",
    "  bases: { concepts: [arrays] }",
    "  learn: { list: demo, size: 2, block: 3, mix_after_block: 3 }",
    "  master: { list: demo, first_try_success: 0.8 }",
    "  expand: { choose_from: [other], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }",
    "  pro: { tracks: [interview] }",
    "patterns:",
    "  - { pattern: arrays-hashing, concept: hash-map }",
    "timebox_minutes: { easy: 15, medium: 35, hard: 50 }",
    "",
  ].join("\n");

  it("warns about a pattern of the preset's list that the preset does not list", async () => {
    const root = makeStudyRepo();
    put(root, "curriculum/demo.yaml", PRESET);
    edit(root, "problems/lc-0001-two-sum/README.md", "concepts: [hash-map]", "concepts: [hash-map]\nlists: [demo]");
    edit(root, "problems/lc-0020-valid-parentheses/README.md", "concepts: [stack]", "concepts: [stack]\nlists: [demo]");
    const report = await checkRepo(root);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toContainEqual({ file: "curriculum/demo.yaml", message: 'pattern "stack" is not in patterns, so phase 1 serves it after the listed ones (lc-0020)' });
  });

  it("reports an invalid preset as errors with paths", async () => {
    const root = makeStudyRepo();
    put(root, "curriculum/demo.yaml", PRESET.replace("block: 3", "block: 0"));
    expect((await checkRepo(root)).errors).toEqual([{ file: "curriculum/demo.yaml", message: "phases.learn.block: Too small: expected number to be >0" }]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/curriculum.test.ts scripts/tests/check.test.ts`
Expected: FAIL. `../curriculum.ts` does not exist, and `check` ignores `curriculum/`.

- [ ] **Step 3: Write the presets and their schema**

Create `study/curriculum.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { PATTERNS } from "../lib/schemas.ts";
import { formatPath } from "../runner/src/schema.ts";
import { type Catalog, type Difficulty, listMembers } from "./catalog.ts";

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");
const positive = z.number().int().positive();
const share = z.number().gt(0).max(1);

/**
 * curriculum/<preset>.yaml (spec §5). A list is named only by its id: membership is the problems' frontmatter
 * `lists`. `learn.size` is how many problems the list has upstream, so `today` can report a partial import.
 */
export const presetSchema = z
  .object({
    id: kebab,
    phases: z
      .object({
        bases: z.object({ concepts: z.array(kebab).min(1) }).strict(),
        learn: z.object({ list: kebab, size: positive, block: positive, mix_after_block: z.number().int().min(0) }).strict(),
        master: z.object({ list: kebab, first_try_success: share }).strict(),
        expand: z.object({ choose_from: z.array(kebab).min(1), window: positive, unseen_medium_success: share, medium_minutes: positive }).strict(),
        pro: z.object({ tracks: z.array(z.enum(["interview", "competitive"])).min(1) }).strict(),
      })
      .strict(),
    /** Order of phase 1, and the concept that opens each pattern. */
    patterns: z
      .array(z.object({ pattern: z.enum(PATTERNS), concept: kebab }).strict())
      .min(1)
      .superRefine((entries, ctx) => {
        const seen = new Set<string>();
        entries.forEach((entry, i) => {
          if (seen.has(entry.pattern)) ctx.addIssue({ code: "custom", message: `"${entry.pattern}" is listed twice`, path: [i, "pattern"] });
          seen.add(entry.pattern);
        });
      }),
    timebox_minutes: z.object({ easy: positive, medium: positive, hard: positive }).strict(),
  })
  .strict();

export type Preset = z.infer<typeof presetSchema>;

/** The default preset (spec D12). */
export const DEFAULT_PRESET = "grind-75";
/** Time-boxes when no preset is in force or it cannot be read (the values every shipped preset uses, spec §5). */
export const DEFAULT_TIMEBOX: Preset["timebox_minutes"] = { easy: 15, medium: 35, hard: 50 };

/** A preset that is missing or invalid; `issues` are "path: message" lines (spec §13). */
export class PresetError extends Error {
  constructor(
    readonly file: string,
    readonly issues: string[],
  ) {
    super(`${file}: ${issues.join("; ")}`);
    this.name = "PresetError";
  }
}

export function curriculumDir(root: string): string {
  return path.join(root, "curriculum");
}

export function presetFile(root: string, id: string): string {
  return path.join(curriculumDir(root), `${id}.yaml`);
}

/** Preset ids in curriculum/, sorted. */
export function listPresets(root: string): string[] {
  const dir = curriculumDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => name.slice(0, -".yaml".length))
    .sort();
}

/** Reads and validates curriculum/<id>.yaml. Throws PresetError with every issue and its path. */
export function loadPreset(root: string, id: string): Preset {
  const rel = `curriculum/${id}.yaml`;
  const file = presetFile(root, id);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !existsSync(file)) {
    throw new PresetError(rel, [`there is no preset "${id}" (presets: ${listPresets(root).join(", ") || "none"})`]);
  }
  let data: unknown;
  try {
    data = parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new PresetError(rel, [`YAML: ${(error as Error).message.split("\n")[0]}`]);
  }
  const parsed = presetSchema.safeParse(data);
  if (!parsed.success) throw new PresetError(rel, parsed.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`));
  if (parsed.data.id !== id) throw new PresetError(rel, [`id: "${parsed.data.id}" does not match the file name`]);
  return parsed.data;
}

/** loadPreset, or null when the preset is missing or invalid: for code that must never fail (ratings). */
export function tryLoadPreset(root: string | null, id: string | null): Preset | null {
  if (!root || !id) return null;
  try {
    return loadPreset(root, id);
  } catch (error) {
    if (error instanceof PresetError) return null;
    throw error;
  }
}

/** The time-box of a problem (spec §5); a missing difficulty counts as medium. */
export function timeboxMinutes(preset: Preset | null, difficulty: Difficulty | null): number {
  return (preset?.timebox_minutes ?? DEFAULT_TIMEBOX)[difficulty ?? "medium"];
}

/** Phase 1's pattern order: the preset's, then patterns it misses, sorted (spec §5; `check` warns about them). */
export function patternOrder(preset: Preset, catalog: Catalog): string[] {
  const listed = preset.patterns.map((entry) => entry.pattern as string);
  const extra = new Set<string>();
  for (const problem of listMembers(catalog, preset.phases.learn.list)) {
    if (problem.pattern && !listed.includes(problem.pattern)) extra.add(problem.pattern);
  }
  return [...listed, ...[...extra].sort()];
}

/** The concept that opens `pattern` in this preset, or null for a pattern the preset does not list. */
export function conceptOf(preset: Preset, pattern: string): string | null {
  return preset.patterns.find((entry) => entry.pattern === pattern)?.concept ?? null;
}

/** How much of a list is in the repo (spec §5: "today reports a partially imported list"). */
export interface ListImport {
  list: string;
  /** Runnable problems tagged with the list. */
  imported: number;
  /** The list's upstream size, from the preset named like the list; null when there is no such preset. */
  size: number | null;
}

export function listImport(root: string, catalog: Catalog, list: string): ListImport {
  return { list, imported: listMembers(catalog, list).length, size: tryLoadPreset(root, list)?.phases.learn.size ?? null };
}
```

Create `curriculum/grind-75.yaml`:

```yaml
# Grind 75: the default preset (study coach spec §5, D12).
# Members: the problems whose frontmatter `lists` has grind-75. They were imported from the LeetCode list
# rab78cw1 (75 questions, none premium; docs/superpowers/specs/2026-10-03-grind-75-design.md).
# Pattern order: NeetCode's roadmap order (the order of PATTERNS in lib/schemas.ts), with strings moved up after
# two-pointers. Each pattern opens with the concept named next to it; the `concept` skill creates missing notes.
id: grind-75
phases:
  bases: { concepts: [big-o, recursion, arrays-and-strings, maps-and-sets, sorting] }
  learn: { list: grind-75, size: 75, block: 3, mix_after_block: 3 }
  master: { list: grind-75, first_try_success: 0.8 }
  expand: { choose_from: [grind-169, neetcode-150], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }
  pro: { tracks: [interview, competitive] }
patterns:
  - { pattern: arrays-hashing, concept: hash-map }
  - { pattern: two-pointers, concept: two-pointers }
  - { pattern: strings, concept: string-parsing }
  - { pattern: sliding-window, concept: sliding-window }
  - { pattern: stack, concept: stack }
  - { pattern: binary-search, concept: binary-search }
  - { pattern: linked-list, concept: linked-list }
  - { pattern: trees, concept: binary-tree }
  - { pattern: tries, concept: trie }
  - { pattern: heap, concept: heap }
  - { pattern: backtracking, concept: backtracking }
  - { pattern: graphs, concept: graph-dfs }
  - { pattern: dp-1d, concept: dynamic-programming }
  - { pattern: dp-2d, concept: dynamic-programming }
  - { pattern: greedy, concept: greedy }
  - { pattern: intervals, concept: intervals }
  - { pattern: math, concept: binary-representation }
  - { pattern: bit-manipulation, concept: binary-representation }
timebox_minutes: { easy: 15, medium: 35, hard: 50 }
```

Create `curriculum/grind-169.yaml`:

```yaml
# Grind 169 (study coach spec §5). Not imported yet: `pnpm study curriculum set grind-169` refuses until its
# problems carry `lists: [grind-169]` (an import like the Grind 75 one, spec §16).
# Source of the list: Tech Interview Handbook's Grind tool, https://www.techinterviewhandbook.org/grind75 (not a
# LeetCode list). Its page bundle (/grind75/_next/static/chunks/<hash>.js, the chunk that contains
# "slug":"two-sum") embeds the 169 questions in recommended order, each with slug, id, difficulty, topic and
# routines. On 2026-10-04: 41 easy, 102 medium, 26 hard, 12 premium.
# Pattern order: the first appearance of each topic in that order (array → arrays-hashing, string → strings,
# binary-tree and binary-search-tree → trees, graph → graphs, dynamic-programming → dp-1d then dp-2d,
# trie → tries, recursion → backtracking, binary → bit-manipulation, math → math). Patterns the Grind data has
# only as routines (interval, two-pointers, sliding-window, greedy) go where that routine first appears.
id: grind-169
phases:
  bases: { concepts: [big-o, recursion, arrays-and-strings, maps-and-sets, sorting] }
  learn: { list: grind-169, size: 169, block: 3, mix_after_block: 3 }
  master: { list: grind-169, first_try_success: 0.8 }
  expand: { choose_from: [neetcode-150], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }
  pro: { tracks: [interview, competitive] }
patterns:
  - { pattern: arrays-hashing, concept: hash-map }
  - { pattern: stack, concept: stack }
  - { pattern: linked-list, concept: linked-list }
  - { pattern: strings, concept: string-parsing }
  - { pattern: trees, concept: binary-tree }
  - { pattern: binary-search, concept: binary-search }
  - { pattern: graphs, concept: graph-dfs }
  - { pattern: dp-1d, concept: dynamic-programming }
  - { pattern: dp-2d, concept: dynamic-programming }
  - { pattern: intervals, concept: intervals }
  - { pattern: heap, concept: heap }
  - { pattern: two-pointers, concept: two-pointers }
  - { pattern: sliding-window, concept: sliding-window }
  - { pattern: tries, concept: trie }
  - { pattern: backtracking, concept: backtracking }
  - { pattern: bit-manipulation, concept: binary-representation }
  - { pattern: greedy, concept: greedy }
  - { pattern: math, concept: digit-manipulation }
timebox_minutes: { easy: 15, medium: 35, hard: 50 }
```

Create `curriculum/neetcode-150.yaml`:

```yaml
# NeetCode 150 (study coach spec §5). Not imported yet: `pnpm study curriculum set neetcode-150` refuses until its
# problems carry `lists: [neetcode-150]` (an import like the Grind 75 one, spec §16).
# Source of the list: neetcode.io (https://neetcode.io/practice). The site's main bundle (main.<hash>.js) holds
# every problem as {problem, pattern, link, difficulty, code, …}; the 150 members are the entries with
# neetcode150:!0. On 2026-10-04 there were 150, in 18 categories.
# Pattern order: the order of those categories (Arrays & Hashing, Two Pointers, Sliding Window, Stack, Binary
# Search, Linked List, Trees, Heap / Priority Queue, Backtracking, Tries, Graphs and Advanced Graphs → graphs,
# 1-D DP, 2-D DP, Greedy, Intervals, Math & Geometry → math, Bit Manipulation). NeetCode has no strings category.
id: neetcode-150
phases:
  bases: { concepts: [big-o, recursion, arrays-and-strings, maps-and-sets, sorting] }
  learn: { list: neetcode-150, size: 150, block: 3, mix_after_block: 3 }
  master: { list: neetcode-150, first_try_success: 0.8 }
  expand: { choose_from: [grind-169], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }
  pro: { tracks: [interview, competitive] }
patterns:
  - { pattern: arrays-hashing, concept: hash-map }
  - { pattern: two-pointers, concept: two-pointers }
  - { pattern: sliding-window, concept: sliding-window }
  - { pattern: stack, concept: stack }
  - { pattern: binary-search, concept: binary-search }
  - { pattern: linked-list, concept: linked-list }
  - { pattern: trees, concept: binary-tree }
  - { pattern: heap, concept: heap }
  - { pattern: backtracking, concept: backtracking }
  - { pattern: tries, concept: trie }
  - { pattern: graphs, concept: graph-dfs }
  - { pattern: dp-1d, concept: dynamic-programming }
  - { pattern: dp-2d, concept: dynamic-programming }
  - { pattern: greedy, concept: greedy }
  - { pattern: intervals, concept: intervals }
  - { pattern: math, concept: matrix-traversal }
  - { pattern: bit-manipulation, concept: binary-representation }
timebox_minutes: { easy: 15, medium: 35, hard: 50 }
```

- [ ] **Step 4: Validate the presets in `check`**

1. In `scripts/lib/checks.ts`, replace:

```ts
import { missingConcepts } from "./render.ts";
```

with:

```ts
import { missingConcepts } from "./render.ts";
import { listPresets, loadPreset, PresetError } from "../../study/curriculum.ts";
```

2. In `scripts/lib/checks.ts`, replace:

```ts
  for (const [slug, by] of missingConcepts(repo)) {
```

with:

```ts
  // Curriculum presets (study coach spec §5, §10): each must be valid, and a pattern of its list's problems that
  // it does not list goes after the listed ones, which deserves a warning.
  for (const id of listPresets(root)) {
    const file = `curriculum/${id}.yaml`;
    try {
      const preset = loadPreset(root, id);
      const listed = new Set<string>(preset.patterns.map((entry) => entry.pattern));
      const missing = new Map<string, string[]>();
      for (const problem of repo.problems) {
        const pattern = strList(problem.data.patterns)[0];
        if (!pattern || listed.has(pattern) || !strList(problem.data.lists).includes(preset.phases.learn.list)) continue;
        missing.set(pattern, [...(missing.get(pattern) ?? []), problem.folderId]);
      }
      for (const [pattern, ids] of missing) {
        warnings.push({ file, message: `pattern "${pattern}" is not in patterns, so phase 1 serves it after the listed ones (${ids.join(", ")})` });
      }
    } catch (caught) {
      if (!(caught instanceof PresetError)) throw caught;
      for (const issue of caught.issues) error(file, issue);
    }
  }

  for (const [slug, by] of missingConcepts(repo)) {
```

- [ ] **Step 5: Run the tests and the whole suite**

Run: `pnpm vitest run study/tests/curriculum.test.ts scripts/tests/check.test.ts && pnpm exec tsc --noEmit`
Expected: all pass (curriculum.test.ts: 9 tests, plus the two new check tests). Then run `pnpm verify`: the real repo's `check` shows no `curriculum/…` line (every Grind 75 pattern is listed; Grind 169 and NeetCode 150 have no problems yet).

- [ ] **Step 6: Commit**

```bash
git add study/tests/curriculum.test.ts scripts/tests/check.test.ts study/curriculum.ts curriculum/grind-75.yaml curriculum/grind-169.yaml curriculum/neetcode-150.yaml scripts/lib/checks.ts
git commit -m "feat(study): add the grind-75, grind-169 and neetcode-150 presets and check them"
```


### Task 3: The FSRS scheduler and the close seam: ratings and the `cards` cache

**Files:**
- Modify: `study/store.ts` (one type)
- Create: `study/fsrs.ts`
- Replace: `study/close-hook.ts` (Plan A's seam, empty body)
- Modify: `study/tests/coach-fixture.ts`, `study/tests/record.test.ts` (one expectation)
- Test: `study/tests/fsrs.test.ts` (create)

**Interfaces:**
- Consumes: `ts-fsrs` 5.4.2 (`fsrs`, `generatorParameters`, `createEmptyCard`, `Rating`, `Card`, `Grade`, `State`); Plan A's `attempts`, `attemptStats`, `cards`, `pauses`, `curriculumLog`, `Outcome`, `Rating` (`study/schema.ts`), `StudyTx`, `ClosedAttempt`, `CloseContext`; `readProblem` (Task 1); `timeboxMinutes`, `tryLoadPreset` (Task 2).
- Produces:
  - `study/store.ts`: `type StudyQueries = BaseSQLiteDatabase<"sync", Database.RunResult, typeof schema>`, which both `study.db` and a transaction satisfy (verified with `tsc`). Engine code that only runs statements takes it.
  - `study/fsrs.ts`: `FSRS_PARAMS`, `scheduler`; `interface RatingInput { outcome; hints; activeMs; measured; timeboxMinutes }`, `rateAttempt(input): Rating`; `interface PauseSpan { start; end }` (ms), `studyTime(at, spans)`, `totalPaused(spans)`; `interface CardValues` (the `cards` columns); `interface RatedReview { at; rating }`; `replayCard(reviews, spans): CardValues | null`; `pauseSpans(db)`; `replayAllCards(db): Map<string, CardValues>`; `rebuildCard(db, itemId)`; `rebuildAllCards(db): number`; `storedCards(db): Map<string, CardValues>`; `toFsrsCard(values)`; `retrievability(values, now): number`.
  - `study/close-hook.ts`: same exports as Plan A, plus `timeboxNow(db, root, itemId): number`. `onAttemptClosed` now returns the rating it wrote (`Rating | null`).
  - `study/tests/coach-fixture.ts`: `expectCacheEqualsReplay(study)` (spec §4: a test asserts that cache equals replay).
- **Behavior (spec §6.3, §6.4, §7 "Closing"):**
  - Every closed **problem** attempt is rated, in the closing transaction: gave up → `again`; hints, or active time over the time-box → `hard`; within it → `good`; measured and under half of it → `easy`. Unmeasured time is at best `good`. The time-box is the preset in force (the last `curriculum_log` row) for the README's difficulty; with no preset, or one that does not load, the defaults 15/35/50, and a missing difficulty counts as medium. Nothing here may throw on content: a throw rolls the close back.
  - The card is rebuilt by **replaying** the item's rated attempts (by `ended_at`, then id) from `createEmptyCard`, in study time: wall time minus finished pauses. The result is shifted back by the total paused time, so a pause moves both `due` and `last_review` by its length. Exercises are never rated and never get a card.
  - Plan A's decisions stay: hints after an item is solved are not counted (Plan A refuses them), and an exercise is done when its latest closed attempt ended green.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Give engine code one type for the database and a transaction**

1. In `study/store.ts`, replace:

```ts
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
```

with:

```ts
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
```

2. In `study/store.ts`, replace:

```ts
export type StudyTx = Parameters<Parameters<StudyDb["transaction"]>[0]>[0];
```

with:

```ts
export type StudyTx = Parameters<Parameters<StudyDb["transaction"]>[0]>[0];
/** What both `study.db` and a transaction offer: engine code that only runs statements takes this. */
export type StudyQueries = BaseSQLiteDatabase<"sync", Database.RunResult, typeof schema>;
```

- [ ] **Step 2: Write the failing tests**

Add the cache check to the fixture:

1. In `study/tests/coach-fixture.ts`, replace:

```ts
// made-up lists, synthetic concepts, and presets named after their lists.
import { CASES_JSON,
```

with:

```ts
// made-up lists, synthetic concepts, and presets named after their lists.
import { expect } from "vitest";
import { CASES_JSON,
```

2. In `study/tests/coach-fixture.ts`, replace:

```ts
import { type FixedClock, fixedClock } from "../clock.ts";
```

with:

```ts
import { type FixedClock, fixedClock } from "../clock.ts";
import { replayAllCards, storedCards } from "../fsrs.ts";
```

3. In `study/tests/coach-fixture.ts`, replace:

```ts
/** The phase_log rows, oldest first, as [phase, reason]. */
```

with:

```ts
/** Spec §4: the cards cache must equal a replay from scratch after every scenario. */
export function expectCacheEqualsReplay(study: Study): void {
  expect(storedCards(study.db)).toEqual(replayAllCards(study.db));
}

/** The phase_log rows, oldest first, as [phase, reason]. */
```

Create `study/tests/fsrs.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { FSRS_PARAMS, rateAttempt, rebuildAllCards, replayCard, storedCards, studyTime } from "../fsrs.ts";
import { openAttempt, recordHint, recordWork } from "../record.ts";
import { attempts, cards, curriculumLog, pauses } from "../schema.ts";
import { inTransaction, openMemoryStudy, type Study } from "../store.ts";
import { coach, DAY, expectCacheEqualsReplay, fail, MONDAY, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const T0 = new Date(MONDAY);
const at = (days: number) => new Date(T0.getTime() + days * DAY);

describe("FSRS settings (spec §6.3)", () => {
  it("are retention 0.85, at most 180 days, fuzz on and no short-term steps", () => {
    expect(FSRS_PARAMS).toMatchObject({ request_retention: 0.85, maximum_interval: 180, enable_fuzz: true, enable_short_term: false });
  });
});

describe("rateAttempt (spec §6.3)", () => {
  const base = { outcome: "green" as const, hints: 0, activeMs: 10 * 60_000, measured: true, timeboxMinutes: 15 };
  it("maps a give-up to Again, hints or over the time-box to Hard, within it to Good, and under half of it to Easy", () => {
    expect(rateAttempt({ ...base, outcome: "gave_up" })).toBe("again");
    expect(rateAttempt({ ...base, hints: 1, activeMs: 60_000 })).toBe("hard");
    expect(rateAttempt({ ...base, activeMs: 16 * 60_000 })).toBe("hard");
    expect(rateAttempt({ ...base, activeMs: 15 * 60_000 })).toBe("good");
    expect(rateAttempt(base)).toBe("good");
    expect(rateAttempt({ ...base, activeMs: 7 * 60_000 })).toBe("easy");
  });

  it("never gives Easy when the time was not measured", () => {
    expect(rateAttempt({ ...base, activeMs: 60_000, measured: false })).toBe("good");
  });
});

describe("the close seam rates problems and writes their cards", () => {
  it("rates a problem's closed attempt and creates its card when the first attempt finishes", () => {
    const c = coach();
    solve(c, "lc-9101", "easy");
    const row = c.study.db.select().from(attempts).where(eq(attempts.itemId, "lc-9101")).get()!;
    expect(row.rating).toBe("easy");
    const card = c.study.db.select().from(cards).where(eq(cards.itemId, "lc-9101")).get()!;
    expect(card).toMatchObject({ reps: 1, lapses: 0, state: 2, lastReview: row.endedAt });
    expect(card.due.getTime()).toBeGreaterThan(row.endedAt!.getTime());
    expectCacheEqualsReplay(c.study);
  });

  it("uses the time-box of the preset in force and the README's difficulty", () => {
    const c = coach();
    c.study.db.insert(curriculumLog).values({ at: c.clock.now(), preset: "demo-list", reason: "init" }).run();
    // lc-9103 is hard (50 minutes): 26 measured minutes is over half of it, so Good, not Easy.
    for (let minute = 0; minute <= 26; minute += 2) {
      recordWork(c.study, "lc-9103", minute === 26 ? { type: "run", lang: "py", green: true } : { type: "edit", lang: "py", differsFromStub: true }, "watch");
      if (minute < 26) c.clock.advance(2 * 60_000);
    }
    expect(c.study.db.select({ rating: attempts.rating }).from(attempts).get()).toEqual({ rating: "good" });
  });

  it("rates a give-up Again and a hinted solve Hard, and never rates an exercise", () => {
    const c = coach();
    fail(c, "lc-9101");
    recordHint(c.study, "lc-9102");
    solve(c, "lc-9102");
    solve(c, "basics-a/01");
    const ratings = Object.fromEntries(c.study.db.select({ itemId: attempts.itemId, rating: attempts.rating }).from(attempts).all().map((r) => [r.itemId, r.rating]));
    expect(ratings).toEqual({ "lc-9101": "again", "lc-9102": "hard", "basics-a/01": null });
    expect(c.study.db.select({ itemId: cards.itemId }).from(cards).all().map((r) => r.itemId).sort()).toEqual(["lc-9101", "lc-9102"]);
    expectCacheEqualsReplay(c.study);
  });

  it("updates the card on every review, so a review attempt replays the whole history", () => {
    const c = coach();
    solve(c, "lc-9101");
    c.clock.advance(6 * DAY);
    inTransaction(c.study, (tx) => openAttempt(tx, "lc-9101", c.clock.now()));
    solve(c, "lc-9101");
    expect(c.study.db.select().from(cards).get()).toMatchObject({ reps: 2 });
    expectCacheEqualsReplay(c.study);
  });
});

describe("replay", () => {
  it("is deterministic with fuzz on: the same history always gives the same card", () => {
    const reviews = [
      { at: at(0), rating: "good" as const },
      { at: at(5), rating: "hard" as const },
      { at: at(17), rating: "again" as const },
      { at: at(18), rating: "easy" as const },
    ];
    expect(replayCard(reviews, [])).toEqual(replayCard(reviews, []));
    expect(replayCard([], [])).toBeNull();
  });

  it("shifts due and last_review by a pause after the last review, and only by the paused time", () => {
    const reviews = [{ at: at(0), rating: "good" as const }];
    const plain = replayCard(reviews, [])!;
    const paused = replayCard(reviews, [{ start: at(1).getTime(), end: at(4).getTime() }])!;
    expect(paused.due.getTime() - plain.due.getTime()).toBe(3 * DAY);
    expect(paused.lastReview!.getTime() - plain.lastReview!.getTime()).toBe(3 * DAY);
    expect({ ...paused, due: plain.due, lastReview: plain.lastReview }).toEqual(plain);
  });

  it("does not count paused time between two reviews as elapsed time", () => {
    const pause = { start: at(2).getTime(), end: at(12).getTime() };
    const withPause = replayCard([{ at: at(0), rating: "good" }, { at: at(15), rating: "good" }], [pause])!;
    const without = replayCard([{ at: at(0), rating: "good" }, { at: at(5), rating: "good" }], [])!;
    expect(withPause.stability).toBe(without.stability);
    expect(withPause.lastReview).toEqual(at(15));
    expect(studyTime(at(15).getTime(), [pause])).toBe(at(5).getTime());
  });

  it("rebuildAllCards regenerates the cache from attempts and pauses", () => {
    const study = openMemoryStudy({ clock: fixedClock(MONDAY) });
    study.db.insert(attempts).values({ itemId: "lc-9101", startedAt: at(0), endedAt: at(0), outcome: "green", rating: "good" }).run();
    study.db.insert(attempts).values({ itemId: "lc-9102", startedAt: at(1), endedAt: at(1), outcome: "gave_up", rating: "again" }).run();
    study.db.insert(pauses).values({ startedAt: at(2), endedAt: at(9) }).run();
    expect(study.db.select().from(cards).all()).toEqual([]);
    expect(inTransaction(study, (tx) => rebuildAllCards(tx))).toBe(2);
    expectCacheEqualsReplay(study);
    expect(storedCards(study.db).get("lc-9101")!.lastReview).toEqual(at(7));
  });
});
```

Plan A's record test pinned the empty seam (`rating: null`). Now the seam rates: that attempt has 2 measured minutes against the default medium time-box (no root, so no README), which is Easy.

1. In `study/tests/record.test.ts`, replace:

```ts
closes it at the first green run with no rating", () => {
```

with:

```ts
closes it at the first green run, rated by the close seam", () => {
```

2. In `study/tests/record.test.ts`, replace:

```ts
    expect(attemptRows(study)).toMatchObject([{ endedAt: new Date(Date.parse(T0) + 120_000), outcome: "green", rating: null }]);
```

with:

```ts
    // 2 measured minutes, well under half of the default medium time-box (35): Easy (Plan B's close seam, spec §6.3).
    expect(attemptRows(study)).toMatchObject([{ endedAt: new Date(Date.parse(T0) + 120_000), outcome: "green", rating: "easy" }]);
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm vitest run study/tests/fsrs.test.ts study/tests/record.test.ts`
Expected: FAIL. `../fsrs.ts` does not exist, and Plan A's seam leaves `rating` null.

- [ ] **Step 4: Write the scheduler**

Create `study/fsrs.ts`:

```ts
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { type Card, createEmptyCard, fsrs, generatorParameters, type Grade, Rating as FsrsRating, type State } from "ts-fsrs";
import { attempts, cards, type Outcome, pauses, type Rating } from "./schema.ts";
import type { StudyQueries } from "./store.ts";

/**
 * Spec §6.3, exactly. ts-fsrs 5.4.2 is deterministic even with fuzz on: the fuzz seed is the review time, reps and
 * difficulty × stability (DefaultInitSeedStrategy). Changing these means `pnpm study rebuild`; no history is lost.
 */
export const FSRS_PARAMS = generatorParameters({ request_retention: 0.85, maximum_interval: 180, enable_fuzz: true, enable_short_term: false });
export const scheduler = fsrs(FSRS_PARAMS);

const GRADES: Record<Rating, Grade> = { again: FsrsRating.Again, hard: FsrsRating.Hard, good: FsrsRating.Good, easy: FsrsRating.Easy };

export interface RatingInput {
  outcome: Outcome;
  hints: number;
  activeMs: number;
  /** attempt_stats.measured: enough events to trust activeMs. */
  measured: boolean;
  timeboxMinutes: number;
}

/**
 * The grade FSRS receives (spec §6.3): gave up → Again; hints, or alone over the time-box → Hard; alone within
 * the time-box → Good; alone in under half of it, with measured time → Easy. Unmeasured time is at best Good.
 */
export function rateAttempt(input: RatingInput): Rating {
  if (input.outcome === "gave_up") return "again";
  const box = input.timeboxMinutes * 60_000;
  if (input.hints > 0 || input.activeMs > box) return "hard";
  if (input.measured && input.activeMs < box / 2) return "easy";
  return "good";
}

/** A finished pause, in epoch milliseconds. Open pauses never shift cards until `resume` closes them. */
export interface PauseSpan {
  start: number;
  end: number;
}

/** Wall time to study time: time inside pauses does not count (spec §6.4). */
export function studyTime(at: number, spans: readonly PauseSpan[]): number {
  let paused = 0;
  for (const span of spans) if (span.start < at) paused += Math.min(at, span.end) - span.start;
  return at - paused;
}

export function totalPaused(spans: readonly PauseSpan[]): number {
  return spans.reduce((sum, span) => sum + (span.end - span.start), 0);
}

/** The columns of a `cards` row (spec §4, deliberate exception 1). */
export interface CardValues {
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

export interface RatedReview {
  at: Date;
  rating: Rating;
}

/**
 * Replays rated attempts (oldest first) in study time and maps the result back to wall time: every finished pause
 * moves both `due` and `last_review` by its length (spec §6.4). Null when there is nothing to replay.
 */
export function replayCard(reviews: readonly RatedReview[], spans: readonly PauseSpan[]): CardValues | null {
  if (reviews.length === 0) return null;
  const shift = totalPaused(spans);
  let card: Card = createEmptyCard(new Date(studyTime(reviews[0].at.getTime(), spans)));
  for (const review of reviews) card = scheduler.next(card, new Date(studyTime(review.at.getTime(), spans)), GRADES[review.rating]).card;
  return {
    due: new Date(card.due.getTime() + shift),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ? new Date(card.last_review.getTime() + shift) : null,
  };
}

/** Finished pauses, oldest first. */
export function pauseSpans(db: StudyQueries): PauseSpan[] {
  return db
    .select({ startedAt: pauses.startedAt, endedAt: pauses.endedAt })
    .from(pauses)
    .where(isNotNull(pauses.endedAt))
    .orderBy(asc(pauses.startedAt))
    .all()
    .map((row) => ({ start: row.startedAt.getTime(), end: row.endedAt!.getTime() }));
}

/** Rated attempts per item, each list in ended_at order: the card's whole history. */
function ratedReviews(db: StudyQueries, itemId?: string): Map<string, RatedReview[]> {
  const rows = db
    .select({ itemId: attempts.itemId, endedAt: attempts.endedAt, rating: attempts.rating })
    .from(attempts)
    .where(itemId === undefined ? isNotNull(attempts.rating) : and(isNotNull(attempts.rating), eq(attempts.itemId, itemId)))
    .orderBy(asc(attempts.endedAt), asc(attempts.id))
    .all();
  const byItem = new Map<string, RatedReview[]>();
  for (const row of rows) {
    const list = byItem.get(row.itemId) ?? [];
    list.push({ at: row.endedAt!, rating: row.rating! });
    byItem.set(row.itemId, list);
  }
  return byItem;
}

/** What `cards` must hold, computed from scratch: the source of truth the cache is checked against. */
export function replayAllCards(db: StudyQueries): Map<string, CardValues> {
  const spans = pauseSpans(db);
  const out = new Map<string, CardValues>();
  for (const [itemId, reviews] of ratedReviews(db)) out.set(itemId, replayCard(reviews, spans)!);
  return out;
}

function writeCard(db: StudyQueries, itemId: string, values: CardValues | null): void {
  if (!values) {
    db.delete(cards).where(eq(cards.itemId, itemId)).run();
    return;
  }
  db.insert(cards).values({ itemId, ...values }).onConflictDoUpdate({ target: cards.itemId, set: values }).run();
}

/** Rebuilds one problem's card from its rated attempts (the close seam calls this inside the closing transaction). */
export function rebuildCard(db: StudyQueries, itemId: string): CardValues | null {
  const values = replayCard(ratedReviews(db, itemId).get(itemId) ?? [], pauseSpans(db));
  writeCard(db, itemId, values);
  return values;
}

/** `pnpm study rebuild` and `study resume`: regenerates the whole cache. Returns how many cards it holds. */
export function rebuildAllCards(db: StudyQueries): number {
  const all = replayAllCards(db);
  db.delete(cards).run();
  for (const [itemId, values] of all) writeCard(db, itemId, values);
  return all.size;
}

/** The cache as stored. */
export function storedCards(db: StudyQueries): Map<string, CardValues> {
  return new Map(db.select().from(cards).all().map(({ itemId, ...values }) => [itemId, values]));
}

/** A cached card as ts-fsrs takes it. */
export function toFsrsCard(values: CardValues): Card {
  return {
    due: values.due,
    stability: values.stability,
    difficulty: values.difficulty,
    elapsed_days: 0,
    scheduled_days: values.scheduledDays,
    learning_steps: values.learningSteps,
    reps: values.reps,
    lapses: values.lapses,
    state: values.state as State,
    last_review: values.lastReview ?? undefined,
  };
}

/** The chance of recalling the item at `now` (return mode serves the highest first, spec §6.4). */
export function retrievability(values: CardValues, now: Date): number {
  return scheduler.get_retrievability(toFsrsCard(values), now, false);
}
```

- [ ] **Step 5: Fill the close seam**

Replace the whole of `study/close-hook.ts` with:

```ts
import { desc, eq } from "drizzle-orm";
import { readProblem } from "./catalog.ts";
import type { Clock } from "./clock.ts";
import { timeboxMinutes, tryLoadPreset } from "./curriculum.ts";
import { rateAttempt, rebuildCard } from "./fsrs.ts";
import { attempts, attemptStats, curriculumLog, type Outcome, type Rating } from "./schema.ts";
import type { StudyQueries, StudyTx } from "./store.ts";

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

/** The time-box in force for a problem now: the current preset's, by the README's difficulty (spec §5, §6.3). */
export function timeboxNow(db: StudyQueries, root: string | null, itemId: string): number {
  const current = db.select({ preset: curriculumLog.preset }).from(curriculumLog).orderBy(desc(curriculumLog.id)).limit(1).get();
  const difficulty = root ? (readProblem(root, itemId)?.difficulty ?? null) : null;
  return timeboxMinutes(tryLoadPreset(root, current?.preset ?? null), difficulty);
}

/**
 * The close seam (spec §7 "Closing", §6.3). closeAttempt calls it exactly once per attempt, inside the closing
 * transaction, right after ended_at and outcome are written. For a problem (an id without "/") it:
 * - rates the attempt from its outcome, attempt_stats (hints, active_ms, measured) and the time-box in force;
 * - rebuilds the item's card by replaying its rated attempts (the cache always equals the replay).
 * Exercises keep rating null and get no card. A throw rolls the close back, so nothing here may fail on content:
 * a missing README or preset falls back to the default time-boxes.
 */
export function onAttemptClosed(tx: StudyTx, attempt: ClosedAttempt, ctx: CloseContext): Rating | null {
  if (attempt.itemId.includes("/")) return null;
  const stats = tx.select().from(attemptStats).where(eq(attemptStats.attemptId, attempt.id)).get();
  const rating = rateAttempt({
    outcome: attempt.outcome,
    hints: stats?.hints ?? 0,
    activeMs: stats?.activeMs ?? 0,
    measured: stats?.measured ?? false,
    timeboxMinutes: timeboxNow(tx, ctx.root, attempt.itemId),
  });
  tx.update(attempts).set({ rating }).where(eq(attempts.id, attempt.id)).run();
  rebuildCard(tx, attempt.itemId);
  return rating;
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `pnpm vitest run study/tests && pnpm exec tsc --noEmit`
Expected: every `study/tests` file passes (fsrs.test.ts: 11 tests); `tsc` prints nothing. Plan A's close-hook.test.ts still passes: it mocks the seam.

- [ ] **Step 7: Commit**

```bash
git add study/store.ts study/tests/coach-fixture.ts study/tests/fsrs.test.ts study/tests/record.test.ts study/fsrs.ts study/close-hook.ts
git commit -m "feat(study): rate closed problem attempts and keep the FSRS cards cache by replay"
```


### Task 4: Exams and the phase criteria, evaluated after every recorded attempt

**Files:**
- Create: `study/exam.ts`, `study/phase.ts`
- Modify: `study/record.ts` (three calls)
- Test: `study/tests/phase.test.ts` (create)

**Interfaces:**
- Consumes: `StudyQueries` (Task 3); `Catalog`, `listMembers`, `loadCatalog` (Task 1); `loadPreset`, `Preset`, `PresetError` (Task 2); `seedFrom`, `shuffled` (Task 1); Plan A's `allItemProgress`, `conceptProgress`, `ItemProgress` (`study/status.ts`), `inTransaction`, the schema tables and `PHASES`.
- Produces:
  - `study/exam.ts`: `interface ExamRow { id; list; seed; startedAt }`; `interface ExamTry`; `interface ExamResult { exam; order; tries; remaining; finished; successes; failures; rate }`; `examOrder(members, seed)`; `examsOf(db, list)`; `examResult(db, exam, members)`; `openExam(db, list, members): ExamResult | null`; `failuresResolved(db, result)`; `examPassed(db, list, members, threshold): boolean`; `rateReached(db, list, members, threshold): boolean`; `createExam(db, list, at, date): ExamRow`.
  - `study/phase.ts`: `interface CurriculumRow { id; preset; at }`, `interface PhaseRow { id; phase; at; reason }`; `currentCurriculum(db)`, `currentPhase(db)`, `nextPhase(phase)`; `interface CoachContext { root; preset; catalog; progress; expansionList }`, `loadContext(study, root, presetId)`; `conceptLearned(study, ctx, slug)`; `reviewSuccesses(db)`; `REVIEWS_TO_LEARN = 2`; `learnedProblems(study, ctx): { members; learned }`; `interface ExpansionWindow { list; results; window }`, `expansionWindow(study, ctx)`; `exitMet(study, ctx, phase)`; `computePhase(study, ctx): Phase`; `interface PhaseChange { phaseLogId; announcementId; from; to }`; `syncPhase(study, root, now): PhaseChange[]`; `evaluatePhase(study): void`.
  - `study/record.ts`: `recordWork` (when it closes an attempt), `giveUp` and a first `acceptExplanation` call `evaluatePhase(study)` before `refreshState`. `acceptExplanation` now refreshes `state.json` too.
- **Criteria (spec §6.1):**
  - **0 · bases:** every base concept is learned: its note exists, the explanation is accepted, and every exercise is done (latest closed attempt green, Plan A's rule).
  - **1 · learn:** every runnable problem of `learn.list` has a green attempt and 2 successful reviews: review or exam attempts rated Good or Easy. An empty list never passes.
  - **2 · master:** some finished exam of `master.list` reached `first_try_success` (tries rated Good or Easy over the list's size), and every failed try was solved green later. "Finished" is derived: every problem has a closed try with that `exam_id`.
  - **3 · expand:** the last `window` unseen Mediums of `profile.expansion_list`, meaning first tries of its medium problems that are **not** in the learn list (those were seen in phases 1–2), with at least `unseen_medium_success` of them solved alone (green, no hint) within `medium_minutes` of active time (wall time when the time was not measured).
  - **4 · pro:** no exit.
- **Transitions:** `syncPhase` advances one phase at a time while the current phase's exit holds, each with a `phase_log` row (reason `criteria`, `curriculum_log_id` set) and an announcement of kind `phase` that references it. It never moves back: absence never lowers a phase. It does nothing before the coach starts (no `curriculum_log` row). `evaluatePhase` is the after-close hook: it skips an in-memory study without a content root and swallows `PresetError`, so a broken preset never breaks a recorded run (`today` reports the preset's issues instead).

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/phase.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { PresetError } from "../curriculum.ts";
import { createExam, examResult } from "../exam.ts";
import { openAttempt } from "../record.ts";
import { syncPhase } from "../phase.ts";
import { announcements, attempts, profile } from "../schema.ts";
import { inTransaction } from "../store.ts";
import { begin, type Coach, coach, DAY, DEMO_LIST, expectCacheEqualsReplay, fail, learn, phases, review, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

/** Phase 0 done: both base concepts learned. */
function bases(c: Coach): void {
  learn(c, "basics-a");
  learn(c, "basics-b");
}

/** Phase 1 done: every demo-list problem solved, then reviewed successfully twice. */
function learnList(c: Coach): void {
  for (const id of DEMO_LIST) solve(c, id);
  for (const round of [1, 2]) {
    c.clock.advance(10 * DAY * round);
    for (const id of DEMO_LIST) review(c, id);
  }
}

/** Runs the demo-list exam: `failed` problems are given up (exams take no hints), the rest are Good. */
function exam(c: Coach, failed: string[] = []): number {
  const row = createExam(c.study.db, "demo-list", c.clock.now(), "2026-11-20");
  for (const id of examResult(c.study.db, row, DEMO_LIST).order) {
    c.clock.advance(60_000);
    if (failed.includes(id)) {
      inTransaction(c.study, (tx) => openAttempt(tx, id, c.clock.now(), { examId: row.id }));
      fail(c, id);
    } else review(c, id, "good", { examId: row.id });
  }
  return row.id;
}

describe("phases (spec §6.1)", () => {
  it("do nothing before the coach starts", () => {
    const c = coach();
    bases(c);
    expect(syncPhase(c.study, c.root, c.clock.now())).toEqual([]);
    expect(phases(c.study)).toEqual([]);
  });

  it("start at phase 0 and leave it once every base concept is learned: explanation accepted and every exercise green", () => {
    const c = coach();
    begin(c);
    expect(phases(c.study)).toEqual([["bases", "criteria"]]);
    learn(c, "basics-a");
    solve(c, "basics-b/01");
    expect(phases(c.study)).toEqual([["bases", "criteria"]]);
    learn(c, "basics-b", []); // the acceptance is the last step: the phase moves right away
    expect(phases(c.study)).toEqual([
      ["bases", "criteria"],
      ["learn", "criteria"],
    ]);
  });

  it("count an exercise solved after a give-up as done, and a give-up alone as not done", () => {
    const c = coach();
    begin(c);
    learn(c, "basics-a");
    fail(c, "basics-b/01");
    learn(c, "basics-b", []);
    expect(phases(c.study).at(-1)).toEqual(["bases", "criteria"]);
    review(c, "basics-b/01");
    expect(phases(c.study).at(-1)).toEqual(["learn", "criteria"]);
  });

  it("leave phase 1 when every list problem was solved and then reviewed successfully twice", () => {
    const c = coach();
    begin(c);
    bases(c);
    for (const id of DEMO_LIST) solve(c, id);
    c.clock.advance(10 * DAY);
    for (const id of DEMO_LIST) review(c, id);
    c.clock.advance(20 * DAY);
    for (const id of DEMO_LIST.slice(1)) review(c, id);
    review(c, DEMO_LIST[0], "hard"); // Hard is not a successful review
    expect(phases(c.study).at(-1)).toEqual(["learn", "criteria"]);
    review(c, DEMO_LIST[0], "easy");
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
    expectCacheEqualsReplay(c.study);
  });

  it("leave phase 2 after an exam with at least 80% first-try success, once every failure was solved again later", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    c.clock.advance(5 * DAY);
    exam(c, [DEMO_LIST[0], DEMO_LIST[1]]); // 6/8 = 75%
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
    c.clock.advance(DAY);
    exam(c, [DEMO_LIST[2]]); // 7/8 = 87.5%, one failure
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
    c.clock.advance(3 * DAY);
    review(c, DEMO_LIST[2]);
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    expectCacheEqualsReplay(c.study);
  });

  it("leave phase 3 when the last unseen Mediums of the expansion list were solved alone in time, at the preset's rate", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    exam(c);
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    c.study.db.update(profile).set({ expansionList: "wide-list" }).where(eq(profile.id, 1)).run();
    solve(c, "lc-9111");
    fail(c, "lc-9112");
    solve(c, "lc-9113", "hard"); // a hint: not alone
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    solve(c, "lc-9114"); // window of 3: 9112 ✗, 9113 ✗, 9114 ✓ → 1/3
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
  });

  it("reach phase 4 with 2 of the last 3 unseen Mediums solved alone (65%)", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    exam(c);
    c.study.db.update(profile).set({ expansionList: "wide-list" }).where(eq(profile.id, 1)).run();
    fail(c, "lc-9111");
    solve(c, "lc-9112");
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    solve(c, "lc-9113");
    expect(phases(c.study).at(-1)).toEqual(["pro", "criteria"]);
  });

  it("never move back: a failed review in phase 2 keeps phase 2, and a long absence changes nothing", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    c.clock.advance(60 * DAY);
    fail(c, DEMO_LIST[0]);
    expect(syncPhase(c.study, c.root, c.clock.now())).toEqual([]);
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
  });

  it("announce every change once, each referencing its phase_log row", () => {
    const c = coach();
    begin(c);
    bases(c);
    const rows = c.study.db.select({ kind: announcements.kind, phaseLogId: announcements.phaseLogId }).from(announcements).orderBy(announcements.id).all();
    expect(rows).toEqual([
      { kind: "phase", phaseLogId: 1 },
      { kind: "phase", phaseLogId: 2 },
    ]);
  });

  it("never let a broken preset break a recorded run: the attempt closes, rated with the default time-boxes", () => {
    const c = coach();
    begin(c);
    put(c.root, "curriculum/demo-list.yaml", "id: demo-list\nphases: {}\n");
    expect(() => solve(c, "lc-9101", "easy")).not.toThrow();
    expect(c.study.db.select({ outcome: attempts.outcome, rating: attempts.rating }).from(attempts).all()).toEqual([{ outcome: "green", rating: "easy" }]);
    expect(() => syncPhase(c.study, c.root, c.clock.now())).toThrow(PresetError);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/phase.test.ts`
Expected: FAIL. `../exam.ts` and `../phase.ts` do not exist.

- [ ] **Step 3: Write the exams and the criteria**

Create `study/exam.ts`:

```ts
import { and, asc, desc, eq, gt, isNotNull } from "drizzle-orm";
import { seedFrom, shuffled } from "./random.ts";
import { attempts, exams, type Outcome, type Rating } from "./schema.ts";
import type { StudyQueries } from "./store.ts";

export interface ExamRow {
  id: number;
  list: string;
  seed: number;
  startedAt: Date;
}

export interface ExamTry {
  attemptId: number;
  endedAt: Date | null;
  outcome: Outcome | null;
  rating: Rating | null;
}

/** An exam as its attempts show it ("finished" is derived, spec §4). */
export interface ExamResult {
  exam: ExamRow;
  /** The list's problems in the exam's seeded order (spec §6.1). */
  order: string[];
  /** The try of each problem in this exam (exam attempts carry exam_id). */
  tries: Map<string, ExamTry>;
  /** Problems with no try yet, in exam order. */
  remaining: string[];
  /** Every problem has a closed try. */
  finished: boolean;
  /** Closed tries rated Good or Easy: solved alone within the time-box, first try. */
  successes: number;
  /** Closed tries that were not a success. */
  failures: string[];
  /** successes / problems (0 for an empty list). */
  rate: number;
}

/** The exam order: the problems shuffled by the exam's seed. */
export function examOrder(members: readonly string[], seed: number): string[] {
  return shuffled([...members].sort(), seed);
}

export function examsOf(db: StudyQueries, list: string): ExamRow[] {
  return db.select().from(exams).where(eq(exams.list, list)).orderBy(asc(exams.id)).all();
}

export function examResult(db: StudyQueries, exam: ExamRow, members: readonly string[]): ExamResult {
  const tries = new Map<string, ExamTry>();
  const rows = db
    .select({ itemId: attempts.itemId, attemptId: attempts.id, endedAt: attempts.endedAt, outcome: attempts.outcome, rating: attempts.rating })
    .from(attempts)
    .where(eq(attempts.examId, exam.id))
    .orderBy(asc(attempts.id))
    .all();
  for (const { itemId, ...row } of rows) if (!tries.has(itemId)) tries.set(itemId, row);
  const order = examOrder(members, exam.seed);
  const closed = order.filter((id) => tries.get(id)?.endedAt);
  const successes = closed.filter((id) => ["good", "easy"].includes(tries.get(id)!.rating ?? "")).length;
  return {
    exam,
    order,
    tries,
    remaining: order.filter((id) => !tries.has(id)),
    finished: order.length > 0 && closed.length === order.length,
    successes,
    failures: closed.filter((id) => !["good", "easy"].includes(tries.get(id)!.rating ?? "")),
    rate: order.length === 0 ? 0 : successes / order.length,
  };
}

/** The exam in progress for `list`: the latest one, unless it is finished. */
export function openExam(db: StudyQueries, list: string, members: readonly string[]): ExamResult | null {
  const latest = db.select().from(exams).where(eq(exams.list, list)).orderBy(desc(exams.id)).limit(1).get();
  if (!latest) return null;
  const result = examResult(db, latest, members);
  return result.finished ? null : result;
}

/** Every failed problem of the exam was solved green after its try (spec §6.1: "every failure re-solved later"). */
export function failuresResolved(db: StudyQueries, result: ExamResult): boolean {
  return result.failures.every((itemId) => {
    const failedAt = result.tries.get(itemId)!.endedAt!;
    const later = db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.itemId, itemId), eq(attempts.outcome, "green"), isNotNull(attempts.endedAt), gt(attempts.endedAt, failedAt)))
      .limit(1)
      .get();
    return later !== undefined;
  });
}

/** Spec §6.1, phase 2: a finished exam at or above `threshold` whose failures were all solved later. */
export function examPassed(db: StudyQueries, list: string, members: readonly string[], threshold: number): boolean {
  return examsOf(db, list).some((exam) => {
    const result = examResult(db, exam, members);
    return result.finished && result.rate >= threshold && failuresResolved(db, result);
  });
}

/** Whether some finished exam already reached the threshold: then no new exam starts, the failures come back as reviews. */
export function rateReached(db: StudyQueries, list: string, members: readonly string[], threshold: number): boolean {
  return examsOf(db, list).some((exam) => {
    const result = examResult(db, exam, members);
    return result.finished && result.rate >= threshold;
  });
}

/** Starts an exam of `list`; the seed comes from the list, the local date and how many exams came before it. */
export function createExam(db: StudyQueries, list: string, at: Date, date: string): ExamRow {
  const before = examsOf(db, list).length;
  return db.insert(exams).values({ list, seed: seedFrom(`${list}:${date}:${before}`), startedAt: at }).returning().get();
}
```

Create `study/phase.ts`:

```ts
import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { type Catalog, listMembers, loadCatalog } from "./catalog.ts";
import { loadPreset, type Preset, PresetError } from "./curriculum.ts";
import { examPassed } from "./exam.ts";
import { announcements, attempts, attemptStats, curriculumLog, type Phase, PHASES, phaseLog, profile } from "./schema.ts";
import { allItemProgress, conceptProgress, type ItemProgress } from "./status.ts";
import { inTransaction, type Study, type StudyQueries } from "./store.ts";

export interface CurriculumRow {
  id: number;
  preset: string;
  at: Date;
}

export interface PhaseRow {
  id: number;
  phase: Phase;
  at: Date;
  reason: "criteria" | "forced" | "switch";
}

/** The preset in force: the last curriculum_log row (spec §4); null before the coach has started. */
export function currentCurriculum(db: StudyQueries): CurriculumRow | null {
  return db.select({ id: curriculumLog.id, preset: curriculumLog.preset, at: curriculumLog.at }).from(curriculumLog).orderBy(desc(curriculumLog.id)).limit(1).get() ?? null;
}

/** The current phase: the last phase_log row (spec §4). */
export function currentPhase(db: StudyQueries): PhaseRow | null {
  return db.select({ id: phaseLog.id, phase: phaseLog.phase, at: phaseLog.at, reason: phaseLog.reason }).from(phaseLog).orderBy(desc(phaseLog.id)).limit(1).get() ?? null;
}

export function nextPhase(phase: Phase): Phase {
  return PHASES[Math.min(PHASES.indexOf(phase) + 1, PHASES.length - 1)];
}

/** Everything the phase criteria and the planner read, loaded once. */
export interface CoachContext {
  root: string;
  preset: Preset;
  catalog: Catalog;
  progress: Map<string, ItemProgress>;
  /** profile.expansion_list: the second list, chosen at the 2 → 3 transition (spec §6.1). */
  expansionList: string | null;
}

export function loadContext(study: Study, root: string, presetId: string): CoachContext {
  const expansion = study.db.select({ list: profile.expansionList }).from(profile).get();
  return { root, preset: loadPreset(root, presetId), catalog: loadCatalog(root), progress: allItemProgress(study), expansionList: expansion?.list ?? null };
}

/** Learned: the note exists, its explanation is accepted, and every exercise is done (spec §6.1). */
export function conceptLearned(study: Study, ctx: CoachContext, slug: string): boolean {
  const concept = ctx.catalog.concepts.get(slug);
  return concept !== undefined && conceptProgress(study, slug, concept.exercises, ctx.progress).learned;
}

/** Successful reviews per problem: review or exam attempts rated Good or Easy (spec §6.1, phase 1). */
export function reviewSuccesses(db: StudyQueries): Map<string, number> {
  const rows = db
    .select({ itemId: attempts.itemId })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .where(and(inArray(attempts.rating, ["good", "easy"]), ne(attemptStats.kind, "new")))
    .all();
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.itemId, (counts.get(row.itemId) ?? 0) + 1);
  return counts;
}

/** Phase 1 is done for a problem once it was solved and then reviewed successfully twice. */
export const REVIEWS_TO_LEARN = 2;

export function learnedProblems(study: Study, ctx: CoachContext): { members: string[]; learned: string[] } {
  const members = listMembers(ctx.catalog, ctx.preset.phases.learn.list).map((problem) => problem.id);
  const successes = reviewSuccesses(study.db);
  const learned = members.filter((id) => ctx.progress.get(id)?.everGreen && (successes.get(id) ?? 0) >= REVIEWS_TO_LEARN);
  return { members, learned };
}

export interface ExpansionWindow {
  list: string | null;
  /** Success of each first try in the window, oldest first. */
  results: boolean[];
  window: number;
}

/**
 * Phase 3 (spec §6.1): the last `window` unseen Mediums of the expansion list: first tries, by when they ended,
 * of its medium problems that are not in the list of phases 1–2 (those were seen there). Solved alone within `medium_minutes`: green, no hints, and active time (wall
 * time when it was not measured) within the limit.
 */
export function expansionWindow(study: Study, ctx: CoachContext): ExpansionWindow {
  const { window, medium_minutes } = ctx.preset.phases.expand;
  const list = ctx.expansionList;
  if (!list) return { list, results: [], window };
  const seen = new Set(listMembers(ctx.catalog, ctx.preset.phases.learn.list).map((p) => p.id));
  const mediums = new Set(listMembers(ctx.catalog, list).filter((p) => p.difficulty === "medium" && !seen.has(p.id)).map((p) => p.id));
  const rows = study.db
    .select({ itemId: attempts.itemId, startedAt: attempts.startedAt, endedAt: attempts.endedAt, outcome: attempts.outcome, hints: attemptStats.hints, activeMs: attemptStats.activeMs, measured: attemptStats.measured })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .where(isNotNull(attempts.endedAt))
    .orderBy(asc(attempts.startedAt), asc(attempts.id))
    .all();
  const first = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (mediums.has(row.itemId) && !first.has(row.itemId)) first.set(row.itemId, row);
  const limit = medium_minutes * 60_000;
  const results = [...first.values()]
    .sort((a, b) => a.endedAt!.getTime() - b.endedAt!.getTime())
    .slice(-window)
    .map((row) => row.outcome === "green" && row.hints === 0 && (row.measured ? row.activeMs : row.endedAt!.getTime() - row.startedAt.getTime()) <= limit);
  return { list, results, window };
}

/** Exit criteria of each phase (spec §6.1). */
export function exitMet(study: Study, ctx: CoachContext, phase: Phase): boolean {
  switch (phase) {
    case "bases":
      return ctx.preset.phases.bases.concepts.every((slug) => conceptLearned(study, ctx, slug));
    case "learn": {
      const { members, learned } = learnedProblems(study, ctx);
      return members.length > 0 && learned.length === members.length;
    }
    case "master": {
      const { list, first_try_success } = ctx.preset.phases.master;
      return examPassed(study.db, list, listMembers(ctx.catalog, list).map((p) => p.id), first_try_success);
    }
    case "expand": {
      const { results, window } = expansionWindow(study, ctx);
      return results.length >= window && results.filter(Boolean).length / window >= ctx.preset.phases.expand.unseen_medium_success;
    }
    case "pro":
      return false;
  }
}

/** The phase from scratch: the first one whose exit criteria are not met (curriculum switches, spec §6.5). */
export function computePhase(study: Study, ctx: CoachContext): Phase {
  let phase: Phase = "bases";
  while (phase !== "pro" && exitMet(study, ctx, phase)) phase = nextPhase(phase);
  return phase;
}

export interface PhaseChange {
  phaseLogId: number;
  announcementId: number;
  from: Phase | null;
  to: Phase;
}

/**
 * Spec §6.1: criteria are evaluated after every recorded attempt and on every `today`. A phase whose criteria are
 * met moves to the next one (possibly several), each with a phase_log row and an announcement that references it.
 * It never moves back: absence never lowers a phase. Throws PresetError when the preset in force is invalid.
 */
export function syncPhase(study: Study, root: string, now: Date): PhaseChange[] {
  return inTransaction(study, (tx) => {
    const curriculum = currentCurriculum(tx);
    const current = currentPhase(tx);
    if (!curriculum || !current) return [];
    const ctx = loadContext(study, root, curriculum.preset);
    const changes: PhaseChange[] = [];
    let phase = current.phase;
    while (phase !== "pro" && exitMet(study, ctx, phase)) {
      const to = nextPhase(phase);
      const row = tx.insert(phaseLog).values({ at: now, phase: to, reason: "criteria", curriculumLogId: curriculum.id }).returning({ id: phaseLog.id }).get();
      const announcement = tx.insert(announcements).values({ at: now, kind: "phase", phaseLogId: row.id }).returning({ id: announcements.id }).get();
      changes.push({ phaseLogId: row.id, announcementId: announcement.id, from: phase, to });
      phase = to;
    }
    return changes;
  });
}

/** After a recorded attempt: evaluate the criteria, but a broken preset must not break the recording (spec §13). */
export function evaluatePhase(study: Study): void {
  if (!study.root) return;
  try {
    syncPhase(study, study.root, study.clock.now());
  } catch (error) {
    if (!(error instanceof PresetError)) throw error;
  }
}
```

- [ ] **Step 4: Evaluate the criteria after every recorded attempt**

1. In `study/record.ts`, replace:

```ts
import { refreshState } from "./state.ts";
```

with:

```ts
import { evaluatePhase } from "./phase.ts";
import { refreshState } from "./state.ts";
```

2. In `study/record.ts`, replace:

```ts
    return { recorded: true, attemptId, opened: open === undefined, closed };
  });
  if (result.recorded) refreshState(study);
```

with:

```ts
    return { recorded: true, attemptId, opened: open === undefined, closed };
  });
  if (result.recorded && result.closed) evaluatePhase(study); // spec §6.1: criteria after every recorded attempt
  if (result.recorded) refreshState(study);
```

3. In `study/record.ts`, replace:

```ts
    closeAttempt(tx, attemptId, "gave_up", at, study);
    return { recorded: true, attemptId };
  });
  if (result.recorded) refreshState(study);
```

with:

```ts
    closeAttempt(tx, attemptId, "gave_up", at, study);
    return { recorded: true, attemptId };
  });
  if (result.recorded) evaluatePhase(study);
  if (result.recorded) refreshState(study);
```

4. In `study/record.ts`, replace:

```ts
  const at = study.clock.now();
  return inTransaction(study, (tx) => {
    const inserted = tx.insert(conceptAcceptances).values({ concept: slug, acceptedAt: at }).onConflictDoNothing().returning().get();
    const row = tx.select().from(conceptAcceptances).where(eq(conceptAcceptances.concept, slug)).get()!;
    return { acceptedAt: row.acceptedAt, already: inserted === undefined };
  });
}
```

with:

```ts
  const at = study.clock.now();
  const result = inTransaction(study, (tx) => {
    const inserted = tx.insert(conceptAcceptances).values({ concept: slug, acceptedAt: at }).onConflictDoNothing().returning().get();
    const row = tx.select().from(conceptAcceptances).where(eq(conceptAcceptances.concept, slug)).get()!;
    return { acceptedAt: row.acceptedAt, already: inserted === undefined };
  });
  if (!result.already) {
    evaluatePhase(study); // the last step of a base concept can end phase 0
    refreshState(study);
  }
  return result;
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `pnpm vitest run study/tests && pnpm exec tsc --noEmit`
Expected: all green (phase.test.ts: 10 tests); `tsc` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add study/tests/phase.test.ts study/exam.ts study/phase.ts study/record.ts
git commit -m "feat(study): evaluate the phase criteria, exams included, after every recorded attempt"
```


### Task 5: Starting the coach and switching curricula, with the phase recalculated

**Files:**
- Create: `study/switch.ts`
- Test: `study/tests/switch.test.ts` (create)

**Interfaces:**
- Consumes: `listMembers`, `loadCatalog` (Task 1); `listImport`, `loadPreset` (Task 2); `computePhase`, `currentCurriculum`, `currentPhase`, `loadContext` (Task 4); Plan A's `refreshState`, `inTransaction`, the tables.
- Produces (`study/switch.ts`):
  - `type CurriculumResult = { status: "started" | "switched"; preset; phase; previous: { preset; phase } | null; announcementId } | { status: "unchanged"; preset } | { status: "refused"; preset; list; size: number | null }`;
  - `setCurriculum(study, root, presetId, now): CurriculumResult` (throws PresetError for a missing or invalid preset);
  - `type ExpansionResult = { status: "set"; list; imported; size } | { status: "refused"; list; reason: "not-a-choice"; choices }`, `setExpansionList(study, root, list)`;
  - `forcePhase(study, phase, now): { status: "set"; from; to; announcementId } | { status: "not-started" }`.
- **Behavior (spec §6.5, §6.1, §11):**
  - The first `setCurriculum` starts the coach: `curriculum_log` (reason `init`), `phase_log` with the phase computed from scratch (reason `criteria`), and an announcement of kind `phase`.
  - A later one with another preset is a switch: progress per problem id and `pattern_intros` are untouched; `curriculum_log` (reason `switch`) and `phase_log` (reason `switch`, the phase recalculated against the new list, which may move back) each get a row, and one announcement of kind `switch` references both.
  - It refuses, changing nothing, when the preset's list has no runnable problem in the repo; a partially imported list is accepted (`today` reports it).
  - `setExpansionList` is how the coach stores the user's answer at the 2 → 3 transition (`profile.expansion_list`). The list must be one of the preset's `expand.choose_from`; it may still be unimported (`today` then serves only reviews, spec §6.1).
  - `forcePhase` is `pnpm study phase set` (the user's only; the hook denies it to Claude): a `phase_log` row with reason `forced`, announced. It refuses before the coach starts.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/switch.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { PresetError } from "../curriculum.ts";
import { announcements, curriculumLog, patternIntros, profile } from "../schema.ts";
import { forcePhase, setCurriculum, setExpansionList } from "../switch.ts";
import { coach, DAY, DEMO_LIST, learn, phases, review, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const curricula = (c: ReturnType<typeof coach>) =>
  c.study.db.select({ preset: curriculumLog.preset, reason: curriculumLog.reason }).from(curriculumLog).orderBy(curriculumLog.id).all();

describe("setCurriculum (spec §6.5)", () => {
  it("starts the coach with the preset and the phase its criteria give", () => {
    const c = coach();
    expect(setCurriculum(c.study, c.root, "demo-list", c.clock.now())).toEqual({ status: "started", preset: "demo-list", phase: "bases", previous: null, announcementId: 1 });
    expect(curricula(c)).toEqual([{ preset: "demo-list", reason: "init" }]);
    expect(setCurriculum(c.study, c.root, "demo-list", c.clock.now())).toEqual({ status: "unchanged", preset: "demo-list" });
  });

  it("refuses a preset whose list is not imported, and keeps the current one", () => {
    const c = coach();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    expect(setCurriculum(c.study, c.root, "ghost-list", c.clock.now())).toEqual({ status: "refused", preset: "ghost-list", list: "ghost-list", size: 5 });
    expect(curricula(c)).toEqual([{ preset: "demo-list", reason: "init" }]);
    expect(() => setCurriculum(c.study, c.root, "nope", c.clock.now())).toThrow(PresetError);
  });

  it("switches both ways, recalculating the phase, which may move back, and announces each switch", () => {
    const c = coach();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    learn(c, "basics-a");
    learn(c, "basics-b");
    for (const id of DEMO_LIST) solve(c, id);
    for (const round of [1, 2]) {
      c.clock.advance(10 * DAY * round);
      for (const id of DEMO_LIST) review(c, id);
    }
    c.study.db.insert(patternIntros).values({ pattern: "stack", introducedAt: c.clock.now() }).run();
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);

    // wide-list has 3 problems never solved: back to phase 1.
    expect(setCurriculum(c.study, c.root, "wide-list", c.clock.now())).toMatchObject({
      status: "switched",
      phase: "learn",
      previous: { preset: "demo-list", phase: "master" },
    });
    expect(phases(c.study).at(-1)).toEqual(["learn", "switch"]);
    const switchRow = c.study.db.select().from(announcements).orderBy(announcements.id).all().at(-1)!;
    expect(switchRow).toMatchObject({ kind: "switch", phaseLogId: expect.any(Number), curriculumLogId: 2 });

    // Back to demo-list: its criteria still hold, so phase 2 again.
    expect(setCurriculum(c.study, c.root, "demo-list", c.clock.now())).toMatchObject({ status: "switched", phase: "master" });
    expect(curricula(c)).toEqual([
      { preset: "demo-list", reason: "init" },
      { preset: "wide-list", reason: "switch" },
      { preset: "demo-list", reason: "switch" },
    ]);
    expect(c.study.db.select({ pattern: patternIntros.pattern }).from(patternIntros).all()).toEqual([{ pattern: "stack" }]);
  });
});

describe("setExpansionList and forcePhase", () => {
  it("stores one of the preset's expansion choices, even when it is not imported yet", () => {
    const c = coach();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    expect(setExpansionList(c.study, c.root, "grind-169")).toEqual({ status: "refused", list: "grind-169", reason: "not-a-choice", choices: ["wide-list", "ghost-list"] });
    expect(setExpansionList(c.study, c.root, "ghost-list")).toEqual({ status: "set", list: "ghost-list", imported: 0, size: 5 });
    expect(setExpansionList(c.study, c.root, "wide-list")).toEqual({ status: "set", list: "wide-list", imported: 11, size: 12 });
    expect(c.study.db.select({ list: profile.expansionList }).from(profile).get()).toEqual({ list: "wide-list" });
  });

  it("forces a phase with reason forced, and refuses before the coach starts", () => {
    const c = coach();
    expect(forcePhase(c.study, "learn", c.clock.now())).toEqual({ status: "not-started" });
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    expect(forcePhase(c.study, "learn", c.clock.now())).toEqual({ status: "set", from: "bases", to: "learn", announcementId: 2 });
    expect(phases(c.study)).toEqual([
      ["bases", "criteria"],
      ["learn", "forced"],
    ]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/switch.test.ts`
Expected: FAIL. `../switch.ts` does not exist.

- [ ] **Step 3: Write the switch**

Create `study/switch.ts`:

```ts
import { eq } from "drizzle-orm";
import { listMembers, loadCatalog } from "./catalog.ts";
import { listImport, loadPreset } from "./curriculum.ts";
import { computePhase, currentCurriculum, currentPhase, loadContext } from "./phase.ts";
import { announcements, curriculumLog, type Phase, phaseLog, profile } from "./schema.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study } from "./store.ts";

export type CurriculumResult =
  /** The coach's first preset (reason init), or a switch (reason switch); `phase` is computed from scratch. */
  | { status: "started" | "switched"; preset: string; phase: Phase; previous: { preset: string; phase: Phase } | null; announcementId: number }
  | { status: "unchanged"; preset: string }
  /** The preset's list has no runnable problems in the repo: nothing changes (spec §6.5). */
  | { status: "refused"; preset: string; list: string; size: number | null };

/**
 * `pnpm study curriculum set <preset>` (spec §6.5). The first call starts the coach. A later one switches lists:
 * - progress per problem id and pattern_intros are untouched;
 * - the phase is recalculated against the new list, and may move back;
 * - curriculum_log and phase_log (reason switch) get a row each, and one announcement references both.
 * It refuses when the preset's list is not imported. Throws PresetError for a missing or invalid preset.
 */
export function setCurriculum(study: Study, root: string, presetId: string, now: Date): CurriculumResult {
  const preset = loadPreset(root, presetId);
  const imported = listImport(root, loadCatalog(root), preset.phases.learn.list);
  if (imported.imported === 0) return { status: "refused", preset: presetId, list: imported.list, size: imported.size };
  const result = inTransaction(study, (tx): CurriculumResult => {
    const previousCurriculum = currentCurriculum(tx);
    const previousPhase = currentPhase(tx);
    if (previousCurriculum?.preset === presetId) return { status: "unchanged", preset: presetId };
    const curriculum = tx
      .insert(curriculumLog)
      .values({ at: now, preset: presetId, reason: previousCurriculum ? "switch" : "init" })
      .returning({ id: curriculumLog.id })
      .get();
    const phase = computePhase(study, loadContext(study, root, presetId));
    const row = tx
      .insert(phaseLog)
      .values({ at: now, phase, reason: previousCurriculum ? "switch" : "criteria", curriculumLogId: curriculum.id })
      .returning({ id: phaseLog.id })
      .get();
    const announcement = tx
      .insert(announcements)
      .values(previousCurriculum ? { at: now, kind: "switch", phaseLogId: row.id, curriculumLogId: curriculum.id } : { at: now, kind: "phase", phaseLogId: row.id })
      .returning({ id: announcements.id })
      .get();
    return {
      status: previousCurriculum ? "switched" : "started",
      preset: presetId,
      phase,
      previous: previousCurriculum && previousPhase ? { preset: previousCurriculum.preset, phase: previousPhase.phase } : null,
      announcementId: announcement.id,
    };
  });
  refreshState(study);
  return result;
}

export type ExpansionResult =
  | { status: "set"; list: string; imported: number; size: number | null }
  | { status: "refused"; list: string; reason: "not-a-choice"; choices: string[] };

/**
 * `pnpm study curriculum expand <list>`: the coach stores the user's answer at the 2 → 3 transition (spec §6.1).
 * The list must be one the preset offers; it may still be unimported (`today` then serves reviews until it is in).
 */
export function setExpansionList(study: Study, root: string, list: string): ExpansionResult {
  const curriculum = currentCurriculum(study.db);
  const choices = curriculum ? loadPreset(root, curriculum.preset).phases.expand.choose_from : [];
  if (!choices.includes(list)) return { status: "refused", list, reason: "not-a-choice", choices };
  study.db.update(profile).set({ expansionList: list }).where(eq(profile.id, 1)).run();
  const catalog = loadCatalog(root);
  return { status: "set", list, imported: listMembers(catalog, list).length, size: listImport(root, catalog, list).size };
}

/** `pnpm study phase set <phase>` (the user's only, spec §11): a phase_log row with reason forced, announced. */
export function forcePhase(
  study: Study,
  phase: Phase,
  now: Date,
): { status: "set"; from: Phase | null; to: Phase; announcementId: number } | { status: "not-started" } {
  const result = inTransaction(study, (tx) => {
    const curriculum = currentCurriculum(tx);
    if (!curriculum) return { status: "not-started" as const };
    const from = currentPhase(tx)?.phase ?? null;
    const row = tx.insert(phaseLog).values({ at: now, phase, reason: "forced", curriculumLogId: curriculum.id }).returning({ id: phaseLog.id }).get();
    const announcement = tx.insert(announcements).values({ at: now, kind: "phase", phaseLogId: row.id }).returning({ id: announcements.id }).get();
    return { status: "set" as const, from, to: phase, announcementId: announcement.id };
  });
  refreshState(study);
  return result;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm vitest run study/tests/switch.test.ts && pnpm exec tsc --noEmit`
Expected: 5 passed; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add study/tests/switch.test.ts study/switch.ts
git commit -m "feat(study): start the coach on a preset and switch curricula, recalculating the phase"
```


### Task 6: Pause and resume

**Files:**
- Create: `study/pause.ts`
- Test: `study/tests/pause.test.ts` (create)

**Interfaces:**
- Consumes: `rebuildAllCards` (Task 3); Plan A's `pauses`, `refreshState`, `inTransaction`.
- Produces (`study/pause.ts`): `openPause(db): { id; startedAt } | null`; `pauseStudy(study, now): { since: Date; already: boolean }`; `resumeStudy(study, now): { resumed: boolean; pausedMs: number }`.
- **Behavior (spec §6.4):** a pause is a row; at most one is open (Plan A's unique index). Resuming closes it and rebuilds every card in the same transaction, so each `due` and `last_review` moves by the paused time; no attempt row is touched. While a pause is open nothing is shifted yet, and Task 8's plan is not made.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/pause.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { storedCards } from "../fsrs.ts";
import { openPause, pauseStudy, resumeStudy } from "../pause.ts";
import { attempts } from "../schema.ts";
import { coach, DAY, expectCacheEqualsReplay, MONDAY, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

describe("pause and resume (spec §6.4)", () => {
  it("records one open pause; pausing again changes nothing", () => {
    const c = coach();
    expect(pauseStudy(c.study, c.clock.now())).toEqual({ since: new Date(MONDAY), already: false });
    c.clock.advance(DAY);
    expect(pauseStudy(c.study, c.clock.now())).toEqual({ since: new Date(MONDAY), already: true });
    expect(openPause(c.study.db)).toMatchObject({ startedAt: new Date(MONDAY) });
  });

  it("moves every card's due date and last review by the paused time, and changes no attempt", () => {
    const c = coach();
    solve(c, "lc-9101");
    solve(c, "lc-9102", "easy");
    const before = storedCards(c.study.db);
    const rows = c.study.db.select().from(attempts).all();
    c.clock.advance(DAY);
    pauseStudy(c.study, c.clock.now());
    c.clock.advance(4 * DAY);
    expect(resumeStudy(c.study, c.clock.now())).toEqual({ resumed: true, pausedMs: 4 * DAY });
    for (const [itemId, card] of storedCards(c.study.db)) {
      expect(card.due.getTime() - before.get(itemId)!.due.getTime()).toBe(4 * DAY);
      expect(card.lastReview!.getTime() - before.get(itemId)!.lastReview!.getTime()).toBe(4 * DAY);
    }
    expect(c.study.db.select().from(attempts).all()).toEqual(rows);
    expectCacheEqualsReplay(c.study);
  });

  it("does nothing on resume when there is no pause", () => {
    const c = coach();
    expect(resumeStudy(c.study, c.clock.now())).toEqual({ resumed: false, pausedMs: 0 });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/pause.test.ts`
Expected: FAIL. `../pause.ts` does not exist.

- [ ] **Step 3: Write pause and resume**

Create `study/pause.ts`:

```ts
import { eq, isNull } from "drizzle-orm";
import { rebuildAllCards } from "./fsrs.ts";
import { pauses } from "./schema.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study, type StudyQueries } from "./store.ts";

/** The open pause, if any (at most one, spec §4). */
export function openPause(db: StudyQueries): { id: number; startedAt: Date } | null {
  return db.select({ id: pauses.id, startedAt: pauses.startedAt }).from(pauses).where(isNull(pauses.endedAt)).get() ?? null;
}

/** `pnpm study pause` or the UI's button (spec §6.4): records the start of a pause. Pausing twice changes nothing. */
export function pauseStudy(study: Study, now: Date): { since: Date; already: boolean } {
  const result = inTransaction(study, (tx) => {
    const open = openPause(tx);
    if (open) return { since: open.startedAt, already: true };
    tx.insert(pauses).values({ startedAt: now }).run();
    return { since: now, already: false };
  });
  refreshState(study);
  return result;
}

/**
 * `pnpm study resume`: ends the open pause, then rebuilds every card, so each due date and last review moves by
 * the paused time (spec §6.4). No attempt is changed.
 */
export function resumeStudy(study: Study, now: Date): { resumed: boolean; pausedMs: number } {
  const result = inTransaction(study, (tx) => {
    const open = openPause(tx);
    if (!open) return { resumed: false, pausedMs: 0 };
    const endedAt = now.getTime() < open.startedAt.getTime() ? open.startedAt : now;
    tx.update(pauses).set({ endedAt }).where(eq(pauses.id, open.id)).run();
    rebuildAllCards(tx);
    return { resumed: true, pausedMs: endedAt.getTime() - open.startedAt.getTime() };
  });
  refreshState(study);
  return result;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm vitest run study/tests/pause.test.ts && pnpm exec tsc --noEmit`
Expected: 3 passed; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add study/tests/pause.test.ts study/pause.ts
git commit -m "feat(study): pause and resume, shifting every card by the paused time"
```


### Task 7: Phase 1's new-item cycle: concept, block, mix, next pattern

**Files:**
- Create: `study/sequence.ts`
- Test: `study/tests/sequence.test.ts` (create)

**Interfaces:**
- Consumes: `CatalogProblem`, `easyToHard` (Task 1); `seedFrom`, `shuffled` (Task 1).
- Produces (`study/sequence.ts`): `interface LearnInput { date; now; order; members; block; mixAfterBlock; intros; attempted; firstClosed; conceptOf(pattern); conceptLearned(slug) }`; `type LearnStep = { kind: "concept"; slug; pattern } | { kind: "block"; itemId; pattern; index; size } | { kind: "mix"; itemId; pattern }`; `interface Planned { step: LearnStep; introduces: string | null }`; `learnSequence(input): Generator<Planned>`.
- **Behavior (spec §6.2.4), pure and deterministic:**
  - The current pattern is the last one in `pattern_intros`. Its **block** is the first `block` problems of that pattern, easy to hard (then by number), among those not done before it was introduced.
  - While the block is not done and the pattern's concept is not learned, the only step is that **concept**, and the cycle stops for the day.
  - Then the block's problems one by one; then `mix_after_block` **mix** items: the first unattempted problems of introduced patterns in an order shuffled by a seed from the local date. Problems first done after the block count toward the mix.
  - Then the **next pattern** in the preset's order (Task 2's `patternOrder`) that still has an unattempted problem, introduced by the step that first needs it (`introduces`), so an intro is stored only when the plan takes that step.
  - Once every pattern is introduced, every new item comes from the mix. Steps already pulled today count as done for what follows; open attempts count as taken.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/sequence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CatalogProblem } from "../catalog.ts";
import { type LearnInput, learnSequence } from "../sequence.ts";

const p = (id: string, pattern: string, difficulty: CatalogProblem["difficulty"] = "medium"): CatalogProblem => ({ id, title: id, difficulty, pattern, lists: ["demo-list"] });
const NOW = new Date("2026-10-05T14:00:00.000Z");
const EARLIER = new Date("2026-10-01T14:00:00.000Z");

const MEMBERS = [
  p("lc-9103", "arrays-hashing", "hard"),
  p("lc-9101", "arrays-hashing", "easy"),
  p("lc-9102", "arrays-hashing", "medium"),
  p("lc-9104", "two-pointers", "easy"),
  p("lc-9105", "two-pointers", "medium"),
  p("lc-9106", "stack", "easy"),
  p("lc-9108", "greedy", "medium"),
];

function input(overrides: Partial<LearnInput> = {}): LearnInput {
  return {
    date: "2026-10-05",
    now: NOW,
    order: ["arrays-hashing", "two-pointers", "stack", "greedy"],
    members: MEMBERS,
    block: 2,
    mixAfterBlock: 1,
    intros: [],
    attempted: new Set(),
    firstClosed: new Map(),
    conceptOf: (pattern) => ({ "arrays-hashing": "map-intro", "two-pointers": "pointer-intro" })[pattern] ?? null,
    conceptLearned: () => true,
    ...overrides,
  };
}

const take = (generator: Generator<unknown>, n: number) => {
  const out: unknown[] = [];
  for (const value of generator) {
    out.push(value);
    if (out.length === n) break;
  }
  return out;
};

describe("learnSequence (spec §6.2)", () => {
  it("opens the first pattern with its concept and stops there while the concept is not learned", () => {
    expect([...learnSequence(input({ conceptLearned: () => false }))]).toEqual([
      { step: { kind: "concept", slug: "map-intro", pattern: "arrays-hashing" }, introduces: "arrays-hashing" },
    ]);
  });

  it("then runs the block easy to hard, the mix, and the next pattern", () => {
    const steps = take(learnSequence(input()), 5);
    expect(steps).toEqual([
      { step: { kind: "block", itemId: "lc-9101", pattern: "arrays-hashing", index: 1, size: 2 }, introduces: "arrays-hashing" },
      { step: { kind: "block", itemId: "lc-9102", pattern: "arrays-hashing", index: 2, size: 2 }, introduces: null },
      { step: { kind: "mix", itemId: "lc-9103", pattern: "arrays-hashing" }, introduces: null },
      { step: { kind: "block", itemId: "lc-9104", pattern: "two-pointers", index: 1, size: 2 }, introduces: "two-pointers" },
      { step: { kind: "block", itemId: "lc-9105", pattern: "two-pointers", index: 2, size: 2 }, introduces: null },
    ]);
  });

  it("gates a newly introduced pattern on its concept", () => {
    const steps = [...learnSequence(input({ conceptLearned: (slug) => slug === "map-intro" }))];
    expect(steps.at(-1)).toEqual({ step: { kind: "concept", slug: "pointer-intro", pattern: "two-pointers" }, introduces: "two-pointers" });
  });

  it("continues where the recorded work left off, and leaves problems done before the intro out of the block", () => {
    const steps = take(
      learnSequence(
        input({
          intros: [{ pattern: "arrays-hashing", at: NOW }],
          attempted: new Set(["lc-9101", "lc-9102"]),
          firstClosed: new Map([
            ["lc-9101", EARLIER],
            ["lc-9102", NOW],
          ]),
        }),
      ),
      1,
    );
    // lc-9101 was done before the pattern was introduced, so the block is 9102 and 9103.
    expect(steps).toEqual([{ step: { kind: "block", itemId: "lc-9103", pattern: "arrays-hashing", index: 2, size: 2 }, introduces: null }]);
  });

  it("draws the mix in an order seeded by the local date", () => {
    const allIntroduced = {
      intros: ["arrays-hashing", "two-pointers", "stack", "greedy"].map((pattern) => ({ pattern, at: EARLIER })),
      attempted: new Set(["lc-9101", "lc-9102"]),
      firstClosed: new Map([
        ["lc-9101", EARLIER],
        ["lc-9102", EARLIER],
      ]),
    };
    const order = (date: string) => [...learnSequence(input({ ...allIntroduced, date }))].map((planned) => (planned.step as { itemId: string }).itemId).join(" ");
    expect(order("2026-10-05")).toBe(order("2026-10-05"));
    const dates = Array.from({ length: 10 }, (_, i) => `2026-10-${String(10 + i)}`);
    expect(new Set(dates.map(order)).size).toBeGreaterThan(1);
    expect(order("2026-10-05").split(" ").sort()).toEqual(["lc-9103", "lc-9104", "lc-9105", "lc-9106", "lc-9108"]);
  });

  it("follows the pattern order, and serves only the mix once every pattern is introduced", () => {
    const steps = [...learnSequence(input({ block: 5, mixAfterBlock: 0 }))].map((planned) => (planned as { step: { kind: string; itemId?: string } }).step);
    expect(steps.map((step) => step.itemId)).toEqual(["lc-9101", "lc-9102", "lc-9103", "lc-9104", "lc-9105", "lc-9106", "lc-9108"]);
    const done = new Set(MEMBERS.map((m) => m.id).filter((id) => id !== "lc-9105"));
    const tail = [...learnSequence(input({ intros: ["arrays-hashing", "two-pointers", "stack", "greedy"].map((pattern) => ({ pattern, at: EARLIER })), attempted: done, firstClosed: new Map([...done].map((id) => [id, EARLIER])) }))];
    expect(tail).toEqual([{ step: { kind: "mix", itemId: "lc-9105", pattern: "two-pointers" }, introduces: null }]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/sequence.test.ts`
Expected: FAIL. `../sequence.ts` does not exist.

- [ ] **Step 3: Write the cycle**

Create `study/sequence.ts`:

```ts
import { type CatalogProblem, easyToHard } from "./catalog.ts";
import { seedFrom, shuffled } from "./random.ts";

/** What the phase-1 cycle reads (spec §6.2): content, the engine's pattern intros, and what the user has done. */
export interface LearnInput {
  /** Local date: it seeds the mix. */
  date: string;
  now: Date;
  /** Pattern order (patternOrder()). */
  order: readonly string[];
  /** The list's problems. */
  members: readonly CatalogProblem[];
  /** Problems per block, and mix items after each block (the preset's `block` and `mix_after_block`). */
  block: number;
  mixAfterBlock: number;
  /** pattern_intros, oldest first. */
  intros: readonly { pattern: string; at: Date }[];
  /** Items with any attempt, open or closed. */
  attempted: ReadonlySet<string>;
  /** When each item's first attempt closed. */
  firstClosed: ReadonlyMap<string, Date>;
  conceptOf(pattern: string): string | null;
  conceptLearned(slug: string): boolean;
}

export type LearnStep =
  /** The concept that opens the pattern, while it is not learned: nothing new comes after it today. */
  | { kind: "concept"; slug: string; pattern: string }
  | { kind: "block"; itemId: string; pattern: string; index: number; size: number }
  | { kind: "mix"; itemId: string; pattern: string | null };

export interface Planned {
  step: LearnStep;
  /** A pattern this step introduces: store it in pattern_intros only when the step is planned. */
  introduces: string | null;
}

/**
 * Phase 1's new items, in order (spec §6.2). For the current pattern (the last one introduced):
 * 1. its concept, while not learned, and the block is not done yet (then the cycle stops for today);
 * 2. the block: the first `block` problems of the pattern, easy to hard, among those not done when it was introduced;
 * 3. `mixAfterBlock` items drawn in an order seeded by the local date, from unattempted problems of introduced patterns;
 * 4. the next pattern with something left to do. Once every pattern is introduced, everything comes from the mix.
 * The caller pulls as many items as the day's budget allows; pulled items count as done for what follows.
 */
export function* learnSequence(input: LearnInput): Generator<Planned> {
  const intros = [...input.intros];
  const planned = new Set<string>();
  const plannedMix = new Map<string, number>();
  let pendingIntro: string | null = null;
  const takeIntro = (): string | null => {
    const pattern = pendingIntro;
    pendingIntro = null;
    return pattern;
  };
  const taken = (id: string): boolean => input.attempted.has(id) || planned.has(id);
  const membersOf = (pattern: string) => input.members.filter((member) => member.pattern === pattern);
  const blockOf = (intro: { pattern: string; at: Date }): string[] =>
    membersOf(intro.pattern)
      .filter((member) => {
        const closed = input.firstClosed.get(member.id);
        return closed === undefined || closed.getTime() >= intro.at.getTime();
      })
      .sort(easyToHard)
      .slice(0, input.block)
      .map((member) => member.id);
  const mixOrder = shuffled(
    input.members.map((member) => member.id).sort(),
    seedFrom(input.date),
  );
  const patternOf = new Map(input.members.map((member) => [member.id, member.pattern]));
  const mixPick = (): string | undefined => {
    const introduced = new Set(intros.map((intro) => intro.pattern));
    return mixOrder.find((id) => !taken(id) && introduced.has(patternOf.get(id) ?? ""));
  };
  const introduceNext = (): boolean => {
    const introduced = new Set(intros.map((intro) => intro.pattern));
    const next = input.order.find((pattern) => !introduced.has(pattern) && membersOf(pattern).some((member) => !taken(member.id)));
    if (!next) return false;
    intros.push({ pattern: next, at: input.now });
    pendingIntro = next;
    return true;
  };

  for (;;) {
    const current = intros.at(-1);
    if (!current) {
      if (!introduceNext()) break;
      continue;
    }
    const block = blockOf(current);
    const blockDone = block.every(taken);
    const concept = input.conceptOf(current.pattern);
    if (!blockDone && concept && !input.conceptLearned(concept)) {
      yield { step: { kind: "concept", slug: concept, pattern: current.pattern }, introduces: takeIntro() };
      return;
    }
    if (!blockDone) {
      const itemId = block.find((id) => !taken(id))!;
      planned.add(itemId);
      yield { step: { kind: "block", itemId, pattern: current.pattern, index: block.indexOf(itemId) + 1, size: block.length }, introduces: takeIntro() };
      continue;
    }
    if (block.length > 0) {
      const doneAt = Math.max(...block.map((id) => input.firstClosed.get(id)?.getTime() ?? input.now.getTime()));
      const mixedSince = input.members.filter((m) => !block.includes(m.id) && (input.firstClosed.get(m.id)?.getTime() ?? -1) >= doneAt).length;
      if (mixedSince + (plannedMix.get(current.pattern) ?? 0) < input.mixAfterBlock) {
        const itemId = mixPick();
        if (itemId) {
          planned.add(itemId);
          plannedMix.set(current.pattern, (plannedMix.get(current.pattern) ?? 0) + 1);
          yield { step: { kind: "mix", itemId, pattern: patternOf.get(itemId) ?? null }, introduces: takeIntro() };
          continue;
        }
      }
    }
    if (!introduceNext()) break;
  }
  // Every pattern is introduced: the mix is all that is left.
  for (let itemId = mixPick(); itemId; itemId = mixPick()) {
    planned.add(itemId);
    yield { step: { kind: "mix", itemId, pattern: patternOf.get(itemId) ?? null }, introduces: null };
  }
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm vitest run study/tests/sequence.test.ts && pnpm exec tsc --noEmit`
Expected: 6 passed; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add study/tests/sequence.test.ts study/sequence.ts
git commit -m "feat(study): order phase 1's new items by pattern: concept, block, seeded mix"
```


### Task 8: The daily plan: stored per local day, budget, reviews, modes, and `state.json`'s summary

**Files:**
- Create: `study/open-attempts.ts` (moves `openAttemptList` out of `study/state.ts`)
- Replace: `study/state.ts`
- Modify: `study/status.ts` (one import), `study/state-file.ts` (`TodaySummary`)
- Create: `study/plan-store.ts`, `study/plan.ts`
- Test: `study/tests/plan.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1–7 (`localDay`, `addDays`, `DAY_MS`; `listMembers`; `conceptOf`, `patternOrder`, `timeboxMinutes`; `storedCards`, `retrievability`, `pauseSpans`; `createExam`, `examResult`, `openExam`, `rateReached`; `CoachContext`, `conceptLearned`, `currentCurriculum`, `currentPhase`, `loadContext`; `openPause`; `learnSequence`; `seedFrom`, `shuffled`); Plan A's `conceptProgress`, `refreshState`, `writeStateFile`, the tables.
- Produces:
  - `study/open-attempts.ts`: `openAttemptList(study)` (unchanged body). `study/state.ts` re-exports it, so every Plan A import keeps working; `study/status.ts` imports it from the new module. This removes an import cycle: `state.ts` now imports the plan's summary, and the plan's modules import `status.ts`.
  - `study/state-file.ts`: `TodaySummary = { date; planned; done; paused: boolean; announcements: number }` (Plan B owns this type: Plan A only wrote null).
  - `study/plan-store.ts`: `type PlanMode`, `type PlanSlot`; `interface ProfileSettings { dailyMinutes; timezone; language }`, `readProfile(db)` (defaults 45 / UTC / py when there is no row); `interface StoredItem { position; itemId; slot; pattern; blockIndex }`, `interface StoredPlan { date; mode; createdAt; items }`, `storedPlan(db, date)`; `itemsDone(study, plan): boolean[]`; `todaySummary(study): TodaySummary | null`.
  - `study/plan.ts`: `REVIEW_SHARE = 0.6`, `REVIEW_FACTOR = 0.6`, `CONCEPT_MINUTES = 20`, `RETURN_AFTER_DAYS = 7`, `CATCH_UP_DAYS = 3`; `interface Facts`, `loadFacts(db)`; `problemMinutes(ctx, itemId, factor?)`; `interface DueCard { itemId; card }`, `dueCards(db, ctx, facts, end)`, `reviewOrder(due, mode, now)`; `interface NewSlot`, `newSlots(...)`; `ensurePlan(study, root, now, { refresh? }): StoredPlan | null`.
- **The plan (spec §6.2, §6.4):**
  - Made once per local day in `profile.timezone` (stored in `daily_plans` / `plan_items`, in one `BEGIN IMMEDIATE` transaction, so the UI and the CLI never make two); `refresh` replaces it. None before the coach starts, and none while a pause is open.
  - **Continue:** every open attempt first. **Reviews:** cards due before the end of the local day (problems that still exist and are not open), most overdue first, while they fit in 60% of `daily_minutes` at 0.6 × the time-box each; at least one when any is due.
  - **New**, by phase: 0, the next base concept not learned (one concept slot a day); 1, Task 7's cycle; 2, the open exam's next problems (an exam starts when there is none open and no finished exam reached the threshold); 3, unattempted problems of the expansion list in a date-seeded order, and nothing while `profile.expansion_list` is unset; 4, unattempted problems of the repo, seeded. The first new item is always planned, even over the budget; more while they fit.
  - **Modes:** `return` after 7 days with no attempt or event, finished pauses not counted: reviews are ordered by retrievability (highest first, a quick win) and a `return` announcement is made once for that date. `catch_up` when more cards are overdue (due before today) than 3 days of today's review capacity: a new item only every other day (none if yesterday's stored plan had one), never zero two days running.
  - **Backlog spreading:** the cap above is the spread: a day never takes more than its review capacity, so due cards beyond it wait for the next days in the same order; `today` reports them (Task 9). Card data is never changed.
- **`state.json`'s `today`:** null until the coach starts; then today's date, the planned and done counts, whether a pause is open, and how many announcements the playground has not acknowledged. The playground refetches its Today section when this changes (the `progress` event, Plan A Task 7).

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/plan.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import { readState } from "../state-file.ts";
import { inTransaction, openStudy } from "../store.ts";
import { examResult, examsOf } from "../exam.ts";
import { pauseStudy, resumeStudy } from "../pause.ts";
import { ensurePlan } from "../plan.ts";
import { openAttempt, recordHint } from "../record.ts";
import { announcements, patternIntros, profile } from "../schema.ts";
import { forcePhase, setCurriculum } from "../switch.ts";
import { type Coach, coach, DAY, DEMO_LIST, expectCacheEqualsReplay, fail, learn, makeCoachRepo, MONDAY, phases, review, solve, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const plan = (c: Coach, refresh = false) => ensurePlan(c.study, c.root, c.clock.now(), { refresh });
const slots = (c: Coach, refresh = false) => plan(c, refresh)?.items.map((item) => [item.slot, item.itemId]) ?? null;

function started(options: { minutes?: number } = {}): Coach {
  const c = coach(options);
  setCurriculum(c.study, c.root, "demo-list", c.clock.now());
  return c;
}

/** Phase 1 with both base concepts learned and map-intro learned: the first block is open. */
function inLearn(options: { minutes?: number } = {}): Coach {
  const c = started(options);
  learn(c, "basics-a");
  learn(c, "basics-b");
  learn(c, "map-intro");
  return c;
}

describe("the daily plan (spec §6.2)", () => {
  it("does not exist before the coach starts, or while a pause is open", () => {
    const c = coach();
    expect(plan(c)).toBeNull();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    pauseStudy(c.study, c.clock.now());
    expect(plan(c)).toBeNull();
    resumeStudy(c.study, c.clock.now());
    expect(plan(c)).not.toBeNull();
  });

  it("serves phase 0's next base concept that is not learned", () => {
    const c = started();
    expect(slots(c)).toEqual([["concept", "basics-a"]]);
    c.clock.advance(DAY);
    learn(c, "basics-a");
    expect(slots(c)).toEqual([["concept", "basics-b"]]);
  });

  it("is stored for the local day: the same plan all day, a new one after local midnight, and --refresh rebuilds it", () => {
    const c = started();
    expect(slots(c)).toEqual([["concept", "basics-a"]]);
    learn(c, "basics-a");
    c.clock.advance(9 * 3_600_000); // 18:00 local: still Monday
    expect(slots(c)).toEqual([["concept", "basics-a"]]);
    expect(slots(c, true)).toEqual([["concept", "basics-b"]]);
    c.clock.set("2026-10-06T04:59:00.000Z"); // 23:59 local Monday
    expect(plan(c)!.date).toBe("2026-10-05");
    c.clock.set("2026-10-06T05:00:00.000Z"); // local midnight
    expect(plan(c)!.date).toBe("2026-10-06");
  });

  it("introduces the next pattern with its concept, then runs its block", () => {
    const c = started({ minutes: 60 });
    learn(c, "basics-a");
    learn(c, "basics-b");
    expect(slots(c)).toEqual([["concept", "map-intro"]]);
    expect(c.study.db.select({ pattern: patternIntros.pattern }).from(patternIntros).all()).toEqual([{ pattern: "arrays-hashing" }]);
    learn(c, "map-intro");
    expect(slots(c, true)).toEqual([
      ["new", "lc-9101"],
      ["new", "lc-9102"],
    ]);
  });

  it("puts open attempts first, then due reviews up to about 60% of the budget, then at least one new item", () => {
    const c = inLearn({ minutes: 20 });
    solve(c, "lc-9101");
    solve(c, "lc-9104");
    recordHint(c.study, "lc-9105"); // an open attempt
    c.clock.advance(30 * DAY);
    // Reviews may take 12 of the 20 minutes: lc-9101 (easy, 9 min) fits, lc-9104 would make it 18. The next
    // problem of the block (lc-9102, 35 min) is over the budget, but one new item is always planned.
    expect(slots(c)).toEqual([
      ["continue", "lc-9105"],
      ["review", "lc-9101"],
      ["new", "lc-9102"],
    ]);
  });

  it("plans one review even when it alone is over 60% of the budget", () => {
    const c = inLearn({ minutes: 10 });
    solve(c, "lc-9102");
    c.clock.advance(30 * DAY);
    expect(slots(c)!.slice(0, 1)).toEqual([["review", "lc-9102"]]);
  });

  it("serves the exam in phase 2, in its seeded order, at full time-box", () => {
    const c = started({ minutes: 30 });
    forcePhase(c.study, "master", c.clock.now());
    const first = plan(c)!.items;
    const exam = examsOf(c.study.db, "demo-list");
    expect(exam).toHaveLength(1);
    const order = examResult(c.study.db, exam[0], DEMO_LIST).order;
    expect(first.map((item) => [item.slot, item.itemId])).toEqual([["new", order[0]]]);
  });

  it("serves only reviews in phase 3 until the expansion list is chosen", () => {
    const c = started();
    solve(c, "lc-9101");
    forcePhase(c.study, "expand", c.clock.now());
    c.clock.advance(30 * DAY);
    expect(slots(c)).toEqual([["review", "lc-9101"]]);
    c.study.db.update(profile).set({ expansionList: "wide-list" }).run();
    expect(slots(c, true)!.map(([slot]) => slot)).toEqual(["review", "new"]);
  });
});

describe("state.json's today (spec §4)", () => {
  it("is null until the coach starts, then summarizes today's plan, the pause and the pending announcements", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const study = openStudy(root, { clock });
    expect(readState(study.dir!)?.today).toBeNull();
    setCurriculum(study, root, "demo-list", clock.now());
    expect(readState(study.dir!)?.today).toEqual({ date: "2026-10-05", planned: 0, done: 0, paused: false, announcements: 1 });
    ensurePlan(study, root, clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ planned: 1, done: 0 });
    pauseStudy(study, clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ paused: true });
    study.close();
  });
});

describe("one plan per day across processes (spec §12)", () => {
  it("gives a second handle on the same database the stored plan, never a second one", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const ui = openStudy(root, { clock });
    const cli = openStudy(root, { clock });
    setCurriculum(ui, root, "demo-list", clock.now());
    const first = ensurePlan(ui, root, clock.now())!;
    const second = ensurePlan(cli, root, clock.now())!;
    expect(second).toEqual(first);
    ui.close();
    cli.close();
  });
});

describe("returns, backlog and catch-up days (spec §6.4)", () => {
  it("welcomes the user back after 7 days away, once, and serves the most retrievable reviews first", () => {
    const c = inLearn({ minutes: 60 });
    solve(c, "lc-9101", "easy");
    solve(c, "lc-9102");
    c.clock.advance(25 * DAY);
    const today = plan(c)!;
    expect(today.mode).toBe("return");
    // Most overdue first would put lc-9102 (due after 5 days) first. lc-9101 (Easy: a longer interval) is more
    // likely remembered, so it comes first, for a quick win.
    expect(today.items.filter((item) => item.slot === "review").map((item) => item.itemId)).toEqual(["lc-9101", "lc-9102"]);
    plan(c, true);
    expect(c.study.db.select({ kind: announcements.kind, localDate: announcements.localDate }).from(announcements).all().filter((a) => a.kind === "return")).toEqual([
      { kind: "return", localDate: "2026-10-30" },
    ]);
  });

  it("does not call a paused week an absence", () => {
    const c = inLearn();
    solve(c, "lc-9101");
    pauseStudy(c.study, c.clock.now());
    c.clock.advance(10 * DAY);
    resumeStudy(c.study, c.clock.now());
    expect(plan(c)!.mode).toBe("normal");
    expectCacheEqualsReplay(c.study);
  });

  it("has catch-up days when more than 3 days of reviews are overdue: a new item only every other day", () => {
    const c = inLearn({ minutes: 15 });
    for (const id of ["lc-9101", "lc-9104", "lc-9106", "lc-9102", "lc-9105"]) solve(c, id);
    c.clock.advance(40 * DAY);
    review(c, "lc-9101"); // some activity: not a return
    // Reviews may take 9 of the 15 minutes: one easy review a day. Four cards are overdue: more than 3 days.
    const monday = plan(c)!;
    expect(monday.mode).toBe("catch_up");
    expect(monday.items.map((item) => item.slot)).toEqual(["review", "new"]);
    c.clock.advance(DAY);
    expect(plan(c)!.items.map((item) => item.slot)).toEqual(["review"]);
    c.clock.advance(DAY);
    expect(plan(c)!.items.map((item) => item.slot)).toEqual(["review", "new"]);
  });

  it("never lowers the phase after a long absence: the plan only welcomes the user back", () => {
    const c = inLearn();
    for (const id of DEMO_LIST) solve(c, id);
    // A retry of a base exercise given up: phase 0's criteria no longer hold, yet the phase stays.
    inTransaction(c.study, (tx) => openAttempt(tx, "basics-a/01", c.clock.now()));
    fail(c, "basics-a/01");
    c.clock.advance(90 * DAY);
    expect(plan(c)!.mode).toBe("return");
    expect(phases(c.study)).toEqual([
      ["bases", "criteria"],
      ["learn", "criteria"],
    ]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/plan.test.ts`
Expected: FAIL. `../plan.ts` does not exist.

- [ ] **Step 3: Move `openAttemptList`, so `state.ts` can read the plan without an import cycle**

Create `study/open-attempts.ts`:

```ts
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
```

Replace the whole of `study/state.ts` with:

```ts
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
```

In `study/status.ts`, replace:

```ts
import { openAttemptList } from "./state.ts";
```

with:

```ts
import { openAttemptList } from "./open-attempts.ts";
```

- [ ] **Step 4: Give `state.json`'s `today` its fields**

In `study/state-file.ts`, replace:

```ts
/** Today's plan at a glance. Plan B (the scheduler) fills it; Plan A always writes null. */
export interface TodaySummary {
  date: string;
  planned: number;
  done: number;
}
```

with:

```ts
/** Today at a glance once the coach has started (null before): the playground refetches its Today section when it changes. */
export interface TodaySummary {
  date: string;
  /** Items in today's stored plan (0 before `today` makes it, and while paused). */
  planned: number;
  done: number;
  paused: boolean;
  /** Announcements the playground has not acknowledged yet. */
  announcements: number;
}
```

- [ ] **Step 5: Write the stored plan and the planner**

Create `study/plan-store.ts`:

```ts
import { and, asc, count, eq, gte, inArray, isNull } from "drizzle-orm";
import type { Lang } from "../runner/src/types.ts";
import { loadCatalog } from "./catalog.ts";
import { localDate } from "./days.ts";
import { announcementAcks, announcements, attempts, curriculumLog, dailyPlans, PLAN_MODES, PLAN_SLOTS, pauses, planItems, profile } from "./schema.ts";
import type { TodaySummary } from "./state-file.ts";
import { conceptProgress } from "./status.ts";
import type { Study, StudyQueries } from "./store.ts";

export type PlanMode = (typeof PLAN_MODES)[number];
export type PlanSlot = (typeof PLAN_SLOTS)[number];

export interface ProfileSettings {
  dailyMinutes: number;
  timezone: string;
  language: Lang;
}

/** The profile (spec §4), or the defaults `study init` would write when it is missing. */
export function readProfile(db: StudyQueries): ProfileSettings {
  const row = db.select().from(profile).get();
  return { dailyMinutes: row?.dailyMinutes ?? 45, timezone: row?.timezone ?? "UTC", language: row?.language ?? "py" };
}

export interface StoredItem {
  position: number;
  /** A problem or exercise id; a concept slug for the concept slot. */
  itemId: string;
  slot: PlanSlot;
  pattern: string | null;
  blockIndex: number | null;
}

export interface StoredPlan {
  date: string;
  mode: PlanMode;
  createdAt: Date;
  items: StoredItem[];
}

/** The plan stored for a local date (spec §6.2: stable within the day), or null. */
export function storedPlan(db: StudyQueries, date: string): StoredPlan | null {
  const plan = db.select().from(dailyPlans).where(eq(dailyPlans.localDate, date)).get();
  if (!plan) return null;
  const items = db
    .select({ position: planItems.position, itemId: planItems.itemId, slot: planItems.slot, pattern: planItems.pattern, blockIndex: planItems.blockIndex })
    .from(planItems)
    .where(eq(planItems.localDate, date))
    .orderBy(asc(planItems.position))
    .all();
  return { date, mode: plan.mode, createdAt: plan.createdAt, items };
}

/**
 * Which planned items are done: a problem or exercise has an attempt that closed after the plan was made (green or
 * given up); a concept is learned (spec §6.1).
 */
export function itemsDone(study: Study, plan: StoredPlan): boolean[] {
  const ids = plan.items.filter((item) => item.slot !== "concept").map((item) => item.itemId);
  const closed = new Set(
    ids.length === 0
      ? []
      : study.db
          .select({ itemId: attempts.itemId })
          .from(attempts)
          .where(and(inArray(attempts.itemId, ids), gte(attempts.endedAt, plan.createdAt)))
          .all()
          .map((row) => row.itemId),
  );
  const catalog = study.root && plan.items.some((item) => item.slot === "concept") ? loadCatalog(study.root) : null;
  return plan.items.map((item) => {
    if (item.slot !== "concept") return closed.has(item.itemId);
    const concept = catalog?.concepts.get(item.itemId);
    return concept !== undefined && conceptProgress(study, item.itemId, concept.exercises).learned;
  });
}

/**
 * state.json's `today` (Plan A's TodaySummary, filled here): null until the coach starts. Read straight from the
 * tables, because state.ts imports this module and the scheduler's modules import state.ts.
 */
export function todaySummary(study: Study): TodaySummary | null {
  if (!study.db.select({ id: curriculumLog.id }).from(curriculumLog).limit(1).get()) return null;
  const date = localDate(study.clock.now(), readProfile(study.db).timezone);
  const plan = storedPlan(study.db, date);
  const paused = study.db.select({ id: pauses.id }).from(pauses).where(isNull(pauses.endedAt)).get() !== undefined;
  const pending = study.db
    .select({ n: count() })
    .from(announcements)
    .leftJoin(announcementAcks, and(eq(announcementAcks.announcementId, announcements.id), eq(announcementAcks.surface, "ui")))
    .where(isNull(announcementAcks.announcementId))
    .get()!.n;
  return { date, planned: plan?.items.length ?? 0, done: plan ? itemsDone(study, plan).filter(Boolean).length : 0, paused, announcements: pending };
}
```

Create `study/plan.ts`:

```ts
import { and, asc, eq, max } from "drizzle-orm";
import { listMembers } from "./catalog.ts";
import { conceptOf, patternOrder, timeboxMinutes } from "./curriculum.ts";
import { addDays, DAY_MS, type LocalDay, localDay } from "./days.ts";
import { createExam, examResult, openExam, rateReached } from "./exam.ts";
import { type CardValues, pauseSpans, retrievability, storedCards } from "./fsrs.ts";
import { openPause } from "./pause.ts";
import { type CoachContext, conceptLearned, currentCurriculum, currentPhase, loadContext } from "./phase.ts";
import { type PlanMode, type PlanSlot, type ProfileSettings, readProfile, type StoredPlan, storedPlan } from "./plan-store.ts";
import { seedFrom, shuffled } from "./random.ts";
import { announcements, attemptEvents, attempts, attemptStats, type AttemptKind, dailyPlans, type Phase, patternIntros, planItems } from "./schema.ts";
import { learnSequence } from "./sequence.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study, type StudyQueries } from "./store.ts";

/** Reviews fill about this share of the daily budget (spec §6.2). */
export const REVIEW_SHARE = 0.6;
/** A review is estimated at this share of the item's time-box (spec §6.2). */
export const REVIEW_FACTOR = 0.6;
/** A concept slot's estimate: reading the note and its exercises. */
export const CONCEPT_MINUTES = 20;
/** Return mode after this many days with no activity (spec §6.4). */
export const RETURN_AFTER_DAYS = 7;
/** A catch-up day when more than this many days of review capacity are overdue (spec §6.4). */
export const CATCH_UP_DAYS = 3;

/** What the user has done, read once per plan. */
export interface Facts {
  /** Items with any attempt, open or closed. */
  attempted: Set<string>;
  /** When each item's first attempt closed. */
  firstClosed: Map<string, Date>;
  /** Open attempts, oldest first. */
  open: { itemId: string; kind: AttemptKind; examId: number | null; startedAt: Date }[];
  /** The latest attempt start, end or event. */
  lastActivity: Date | null;
}

export function loadFacts(db: StudyQueries): Facts {
  const rows = db
    .select({ itemId: attempts.itemId, startedAt: attempts.startedAt, endedAt: attempts.endedAt, examId: attempts.examId, kind: attemptStats.kind })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .orderBy(asc(attempts.startedAt), asc(attempts.id))
    .all();
  const facts: Facts = { attempted: new Set(), firstClosed: new Map(), open: [], lastActivity: null };
  let last = 0;
  for (const row of rows) {
    facts.attempted.add(row.itemId);
    if (row.endedAt && !facts.firstClosed.has(row.itemId)) facts.firstClosed.set(row.itemId, row.endedAt);
    if (!row.endedAt) facts.open.push({ itemId: row.itemId, kind: row.kind, examId: row.examId, startedAt: row.startedAt });
    last = Math.max(last, row.startedAt.getTime(), row.endedAt?.getTime() ?? 0);
  }
  const event = db.select({ at: max(attemptEvents.at) }).from(attemptEvents).get()?.at;
  if (event) last = Math.max(last, event.getTime());
  facts.lastActivity = last > 0 ? new Date(last) : null;
  return facts;
}

/** A problem's estimate: its time-box, or `factor` of it for a review (spec §6.2). */
export function problemMinutes(ctx: CoachContext, itemId: string, factor = 1): number {
  return Math.round(timeboxMinutes(ctx.preset, ctx.catalog.problems.get(itemId)?.difficulty ?? null) * factor);
}

/** An open attempt's estimate: exercises take an easy problem's time-box; reviews 0.6 of theirs. */
function continueMinutes(ctx: CoachContext, open: Facts["open"][number]): number {
  if (open.itemId.includes("/")) return timeboxMinutes(ctx.preset, "easy");
  return problemMinutes(ctx, open.itemId, open.kind === "review" ? REVIEW_FACTOR : 1);
}

export interface DueCard {
  itemId: string;
  card: CardValues;
}

/** Cards due before `end` (the end of the local day) for problems that still exist and are not open now. */
export function dueCards(db: StudyQueries, ctx: CoachContext, facts: Facts, end: Date): DueCard[] {
  const open = new Set(facts.open.map((attempt) => attempt.itemId));
  return [...storedCards(db)]
    .filter(([itemId, card]) => card.due.getTime() < end.getTime() && ctx.catalog.problems.has(itemId) && !open.has(itemId))
    .map(([itemId, card]) => ({ itemId, card }));
}

/** Most overdue first; in return mode, highest retrievability first, for a quick win (spec §6.4). */
export function reviewOrder(due: DueCard[], mode: PlanMode, now: Date): DueCard[] {
  const byDue = (a: DueCard, b: DueCard) => a.card.due.getTime() - b.card.due.getTime() || a.itemId.localeCompare(b.itemId);
  if (mode !== "return") return [...due].sort(byDue);
  return [...due].sort((a, b) => retrievability(b.card, now) - retrievability(a.card, now) || byDue(a, b));
}

/** Time with no practice, not counting finished pauses (a pause is not an absence). */
function idleMs(db: StudyQueries, since: Date, now: Date): number {
  let paused = 0;
  for (const span of pauseSpans(db)) paused += Math.max(0, Math.min(span.end, now.getTime()) - Math.max(span.start, since.getTime()));
  return now.getTime() - since.getTime() - paused;
}

/** A new item or a concept, as the plan stores it. */
export interface NewSlot {
  itemId: string;
  slot: Extract<PlanSlot, "new" | "concept">;
  pattern: string | null;
  blockIndex: number | null;
  minutes: number;
  /** A pattern to record in pattern_intros if this slot is planned. */
  introduces: string | null;
}

/** New items for `phase`, in order; the caller takes as many as the budget allows (spec §6.2). */
export function* newSlots(study: Study, db: StudyQueries, ctx: CoachContext, phase: Phase, facts: Facts, day: LocalDay, now: Date): Generator<NewSlot> {
  const unattempted = (ids: string[]) => ids.filter((id) => !facts.attempted.has(id));
  const seeded = (ids: string[]) => shuffled([...ids].sort(), seedFrom(day.date));
  switch (phase) {
    case "bases": {
      const slug = ctx.preset.phases.bases.concepts.find((concept) => !conceptLearned(study, ctx, concept));
      if (slug) yield { itemId: slug, slot: "concept", pattern: null, blockIndex: null, minutes: CONCEPT_MINUTES, introduces: null };
      return;
    }
    case "learn": {
      const learn = ctx.preset.phases.learn;
      const intros = db.select({ pattern: patternIntros.pattern, at: patternIntros.introducedAt }).from(patternIntros).orderBy(asc(patternIntros.introducedAt), asc(patternIntros.pattern)).all();
      for (const { step, introduces } of learnSequence({
        date: day.date,
        now,
        order: patternOrder(ctx.preset, ctx.catalog),
        members: listMembers(ctx.catalog, learn.list),
        block: learn.block,
        mixAfterBlock: learn.mix_after_block,
        intros,
        attempted: facts.attempted,
        firstClosed: facts.firstClosed,
        conceptOf: (pattern) => conceptOf(ctx.preset, pattern),
        conceptLearned: (slug) => conceptLearned(study, ctx, slug),
      })) {
        if (step.kind === "concept") yield { itemId: step.slug, slot: "concept", pattern: step.pattern, blockIndex: null, minutes: CONCEPT_MINUTES, introduces };
        else yield { itemId: step.itemId, slot: "new", pattern: step.pattern, blockIndex: step.kind === "block" ? step.index : null, minutes: problemMinutes(ctx, step.itemId), introduces };
      }
      return;
    }
    case "master": {
      const { list, first_try_success } = ctx.preset.phases.master;
      const members = listMembers(ctx.catalog, list).map((problem) => problem.id);
      let exam = openExam(db, list, members);
      if (!exam && !rateReached(db, list, members, first_try_success)) exam = examResult(db, createExam(db, list, now, day.date), members);
      const open = new Set(facts.open.map((attempt) => attempt.itemId));
      for (const itemId of exam?.remaining ?? []) {
        if (!open.has(itemId)) yield { itemId, slot: "new", pattern: null, blockIndex: null, minutes: problemMinutes(ctx, itemId), introduces: null };
      }
      return;
    }
    case "expand": {
      // Until the coach stores the list (2 → 3) and it is imported, only reviews are served (spec §6.1).
      if (!ctx.expansionList) return;
      for (const itemId of seeded(unattempted(listMembers(ctx.catalog, ctx.expansionList).map((p) => p.id)))) {
        yield { itemId, slot: "new", pattern: null, blockIndex: null, minutes: problemMinutes(ctx, itemId), introduces: null };
      }
      return;
    }
    case "pro":
      for (const itemId of seeded(unattempted([...ctx.catalog.problems.keys()]))) {
        yield { itemId, slot: "new", pattern: null, blockIndex: null, minutes: problemMinutes(ctx, itemId), introduces: null };
      }
  }
}

interface PlannedRow {
  itemId: string;
  slot: PlanSlot;
  pattern: string | null;
  blockIndex: number | null;
}

/** Builds and stores today's plan (spec §6.2, §6.4) in the caller's transaction. */
function buildPlan(study: Study, db: StudyQueries, ctx: CoachContext, phase: Phase, profile: ProfileSettings, day: LocalDay, now: Date): void {
  const facts = loadFacts(db);
  const budget = profile.dailyMinutes;
  const rows: PlannedRow[] = [];
  let used = 0;

  // 1. Continue: every open attempt.
  for (const open of facts.open) {
    rows.push({ itemId: open.itemId, slot: "continue", pattern: null, blockIndex: null });
    used += continueMinutes(ctx, open);
  }

  // 2. Reviews: due cards until about 60% of the budget, at least one when any is due.
  let mode: PlanMode = facts.lastActivity && idleMs(db, facts.lastActivity, now) >= RETURN_AFTER_DAYS * DAY_MS ? "return" : "normal";
  const due = dueCards(db, ctx, facts, day.end);
  let reviewMinutes = 0;
  const reviews: string[] = [];
  for (const { itemId } of reviewOrder(due, mode, now)) {
    const minutes = problemMinutes(ctx, itemId, REVIEW_FACTOR);
    if (reviews.length > 0 && reviewMinutes + minutes > REVIEW_SHARE * budget) break;
    reviews.push(itemId);
    reviewMinutes += minutes;
  }
  for (const itemId of reviews) rows.push({ itemId, slot: "review", pattern: null, blockIndex: null });
  used += reviewMinutes;
  const overdue = due.filter(({ card }) => card.due.getTime() < day.start.getTime()).length;
  if (mode === "normal" && reviews.length > 0 && overdue > CATCH_UP_DAYS * reviews.length) mode = "catch_up";

  // 3. New: at least one a day; on catch-up days one every other day (spec §6.4).
  const yesterday = storedPlan(db, addDays(day.date, -1));
  const newToday = mode !== "catch_up" || !yesterday?.items.some((item) => item.slot === "new" || item.slot === "concept");
  if (newToday) {
    for (const next of newSlots(study, db, ctx, phase, facts, day, now)) {
      const first = !rows.some((row) => row.slot === "new" || row.slot === "concept");
      if (!first && used + next.minutes > budget) break;
      rows.push({ itemId: next.itemId, slot: next.slot, pattern: next.pattern, blockIndex: next.blockIndex });
      used += next.minutes;
      if (next.introduces) db.insert(patternIntros).values({ pattern: next.introduces, introducedAt: now }).onConflictDoNothing().run();
    }
  }

  db.insert(dailyPlans).values({ localDate: day.date, mode, createdAt: now }).run();
  rows.forEach((row, position) => db.insert(planItems).values({ localDate: day.date, position, ...row }).run());
  if (mode === "return") {
    const welcomed = db.select({ id: announcements.id }).from(announcements).where(and(eq(announcements.kind, "return"), eq(announcements.localDate, day.date))).get();
    if (!welcomed) db.insert(announcements).values({ at: now, kind: "return", localDate: day.date }).run();
  }
}

/**
 * Today's plan (spec §6.2): computed once per local day and stored; `refresh` (pnpm today --refresh) replaces it.
 * Null before the coach starts and while a pause is open. Throws PresetError for an invalid preset.
 */
export function ensurePlan(study: Study, root: string, now: Date, options: { refresh?: boolean } = {}): StoredPlan | null {
  const profile = readProfile(study.db);
  const day = localDay(now, profile.timezone);
  const result = inTransaction(study, (tx) => {
    const curriculum = currentCurriculum(tx);
    const phase = currentPhase(tx);
    if (!curriculum || !phase || openPause(tx)) return null;
    const existing = storedPlan(tx, day.date);
    if (existing && !options.refresh) return existing;
    if (existing) {
      tx.delete(planItems).where(eq(planItems.localDate, day.date)).run();
      tx.delete(dailyPlans).where(eq(dailyPlans.localDate, day.date)).run();
    }
    buildPlan(study, tx, loadContext(study, root, curriculum.preset), phase.phase, profile, day, now);
    return storedPlan(tx, day.date);
  });
  refreshState(study);
  return result;
}
```

- [ ] **Step 6: Run the tests, the type check and the whole suite**

Run: `pnpm vitest run study/tests && pnpm exec tsc --noEmit`
Expected: all green (plan.test.ts: 14 tests). Plan A's state.test.ts still passes: its store has a phase but no preset, so `today` stays null. Then run `pnpm verify`.

- [ ] **Step 7: Commit**

```bash
git add study/tests/plan.test.ts study/open-attempts.ts study/state.ts study/status.ts study/state-file.ts study/plan-store.ts study/plan.ts
git commit -m "feat(study): plan each local day: continue, reviews within the budget, new items, return and catch-up days"
```


### Task 9: `today`: the plan rendered, announcements per surface, and the missing-database answer

**Files:**
- Create: `study/today.ts`
- Test: `study/tests/today.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1–8; Plan A's `scanRepo`, `LEGACY_PERSONAL_FIELDS` (`lib/schemas.ts`), `refreshState`, the tables.
- Produces (`study/today.ts`):
  - `type Surface = "chat" | "ui"`;
  - `interface TodayItem { kind: "continue" | "review" | "new" | "concept" | "exam"; id; title; minutes; reason; done; missing }`;
  - `interface TodayPhase { id; since; preset; progress: { done; total }; list: ListImport | null; expansion: { list; choices } | null }`;
  - `interface AnnouncementJson { id; key: "coach-started" | "phase-advanced" | "phase-set" | "curriculum-switched" | "welcome-back"; at; payload }`;
  - `interface TodayJson { initialized: true; started; date; paused: { since } | null; phase; announcements; mode: "normal" | "return" | "catch-up"; items; backlog: { waiting; days }; budget: { minutes; planned } }`;
  - `interface NotInitializedJson { initialized: false; next: "init" | "migrate" }`, `notInitialized(root)`;
  - `pendingAnnouncements(db, surface)`, `ackAnnouncement(study, id, surface, now): "acked" | "already" | "unknown"`;
  - `today(study, root, { surface, now, refresh? }): TodayJson`, `describeToday(json): string`.
- **Behavior (spec §6.1, §6.2, §11, §13):**
  - `today` evaluates the phase criteria (spec §6.1: "on every `today`"), makes or reads today's stored plan (Task 8), and renders it. Titles, minutes and reasons come from content and the preset, never from the database.
  - **Reasons** (English, short; the coach skill words them in Spanish): `in progress · <pattern or concept>`, `due today | due yesterday | due N days ago`, `block i/n · <pattern>`, `mix · <pattern>`, `opens <pattern>` (a concept opening a pattern), `bases i/n` (a base concept), `exam i/n`, `expand · <list>`, `practice`.
  - **Kinds:** spec §11 lists `continue|review|new|concept`; exam problems are rows of their own in the Today section (spec §11 "review and exam rows"), so they come out as kind `exam`. They are stored with slot `new` (Plan A's schema allows only the four slots) and recognized as members of the latest exam while in phase 2.
  - A row whose content is gone (an orphan) or a concept note not created yet keeps its id as title and has `missing: true`; nothing fails.
  - **Announcements** are rendered from the rows they reference (spec §4): `coach-started { preset, phase }` (the first phase row), `phase-advanced { from, to }`, `phase-set { from, to }` (reason forced), `curriculum-switched { from: { preset, phase }, to: { preset, phase } }`, `welcome-back { date, daysAway }`. Each surface sees those it has not acknowledged; an ack writes one `announcement_acks` row for that surface and refreshes `state.json`.
  - **Backlog:** `waiting` counts due cards left out of today's plan; `days` is how many days of today's review capacity they need.
  - `notInitialized` says `migrate` when a README still holds a legacy personal field or a solution file sits in a content folder, `init` otherwise (spec §13).

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/today.test.ts`:

```ts
import { rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import { pauseStudy } from "../pause.ts";
import { patternIntros } from "../schema.ts";
import { readState } from "../state-file.ts";
import { openStudy } from "../store.ts";
import { setCurriculum } from "../switch.ts";
import { ackAnnouncement, describeToday, notInitialized, today } from "../today.ts";
import { type Coach, coach, DAY, learn, makeCoachRepo, MONDAY, solve, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const ui = (c: Coach, refresh = false) => today(c.study, c.root, { surface: "ui", now: c.clock.now(), refresh });
const chat = (c: Coach) => today(c.study, c.root, { surface: "chat", now: c.clock.now() });
const start = (c: Coach, preset = "demo-list") => setCurriculum(c.study, c.root, preset, c.clock.now());

describe("today (spec §11)", () => {
  it("says the coach has not started until a preset is set", () => {
    const c = coach();
    expect(ui(c)).toEqual({
      initialized: true,
      started: false,
      date: "2026-10-05",
      paused: null,
      phase: null,
      announcements: [],
      mode: "normal",
      items: [],
      backlog: { waiting: 0, days: 0 },
      budget: { minutes: 45, planned: 0 },
    });
  });

  it("renders the plan with titles, minutes and reasons from content, and the phase with its progress", () => {
    const c = coach();
    start(c);
    expect(ui(c)).toMatchObject({
      started: true,
      phase: { id: "bases", since: MONDAY, preset: "demo-list", progress: { done: 0, total: 2 }, list: null, expansion: null },
      items: [{ kind: "concept", id: "basics-a", title: "Concept basics-a", minutes: 20, reason: "bases 1/2", done: false, missing: false }],
      budget: { minutes: 45, planned: 20 },
    });
  });

  it("marks planned items done, and tells a block item, a mix item and a missing concept apart", () => {
    const c = coach({ minutes: 120 });
    start(c);
    learn(c, "basics-a");
    learn(c, "basics-b");
    learn(c, "map-intro");
    c.study.db.insert(patternIntros).values({ pattern: "arrays-hashing", introducedAt: c.clock.now() }).run();
    c.clock.advance(60_000);
    solve(c, "lc-9101");
    solve(c, "lc-9102");
    c.study.db.insert(patternIntros).values({ pattern: "two-pointers", introducedAt: c.clock.now() }).run();
    c.clock.advance(60_000);
    const plan = ui(c).items;
    expect(plan.map((item) => [item.kind, item.id, item.reason])).toEqual([
      ["concept", "pointer-intro", "opens two-pointers"],
    ]);
    learn(c, "pointer-intro", []);
    const block = ui(c, true).items;
    expect(block.map((item) => [item.kind, item.id, item.minutes, item.reason])).toEqual([
      ["new", "lc-9104", 15, "block 1/2 · two-pointers"],
      ["new", "lc-9105", 35, "block 2/2 · two-pointers"],
      ["new", "lc-9103", 50, "mix · arrays-hashing"],
      ["concept", "stack-intro", 20, "opens stack"],
    ]);
    expect(block.at(-1)).toMatchObject({ title: "stack-intro", missing: true });
    solve(c, "lc-9104");
    expect(ui(c).items.map((item) => item.done)).toEqual([true, false, false, false]);
  });

  it("reports how much of the phase's list is imported", () => {
    const c = coach();
    start(c, "wide-list");
    c.study.db.insert(patternIntros).values({ pattern: "arrays-hashing", introducedAt: c.clock.now() }).run();
    expect(ui(c).phase).toMatchObject({ id: "bases", list: null });
    learn(c, "basics-a");
    learn(c, "basics-b");
    expect(ui(c).phase).toMatchObject({ id: "learn", progress: { done: 0, total: 11 }, list: { list: "wide-list", imported: 11, size: 12 } });
  });

  it("counts the due reviews it leaves for later", () => {
    const c = coach({ minutes: 15 });
    start(c);
    for (const id of ["lc-9101", "lc-9104", "lc-9106"]) solve(c, id);
    c.clock.advance(30 * DAY);
    expect(ui(c)).toMatchObject({ backlog: { waiting: 2, days: 2 } });
  });

  it("shows nothing to do while paused", () => {
    const c = coach();
    start(c);
    pauseStudy(c.study, c.clock.now());
    expect(ui(c)).toMatchObject({ paused: { since: MONDAY }, items: [] });
    expect(describeToday(ui(c))).toContain("Paused since 2026-10-05");
  });
});

describe("today with content that changed", () => {
  it("renders a planned item whose content is gone with its id and missing: true", () => {
    const c = coach({ minutes: 60 });
    start(c);
    learn(c, "basics-a");
    learn(c, "basics-b");
    learn(c, "map-intro");
    const first = ui(c).items[0];
    expect(first).toMatchObject({ kind: "new", id: "lc-9101", missing: false });
    rmSync(path.join(c.root, "problems/lc-9101-sample"), { recursive: true });
    expect(ui(c).items[0]).toMatchObject({ kind: "new", id: "lc-9101", title: "lc-9101", missing: true });
  });

  it("leaves state.json alone when nothing changed, so the playground's refetch on progress cannot loop", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const study = openStudy(root, { clock });
    setCurriculum(study, root, "demo-list", clock.now());
    today(study, root, { surface: "ui", now: clock.now() });
    const version = readState(study.dir!)!.version;
    today(study, root, { surface: "ui", now: clock.now() });
    expect(readState(study.dir!)!.version).toBe(version);
    study.close();
  });
});

describe("announcements (spec §6.1)", () => {
  it("are returned until acknowledged, on each surface separately", () => {
    const c = coach();
    start(c);
    const first = ui(c).announcements;
    expect(first).toEqual([{ id: 1, key: "coach-started", at: MONDAY, payload: { preset: "demo-list", phase: "bases" } }]);
    expect(ackAnnouncement(c.study, 1, "ui", c.clock.now())).toBe("acked");
    expect(ackAnnouncement(c.study, 1, "ui", c.clock.now())).toBe("already");
    expect(ackAnnouncement(c.study, 99, "ui", c.clock.now())).toBe("unknown");
    expect(ui(c).announcements).toEqual([]);
    expect(chat(c).announcements).toEqual(first);
  });

  it("say which phase came, which curriculum switch happened, and how long the user was away", () => {
    const c = coach();
    start(c);
    learn(c, "basics-a");
    learn(c, "basics-b");
    start(c, "wide-list");
    c.clock.advance(10 * DAY);
    expect(ui(c).announcements.map((a) => [a.key, a.payload])).toEqual([
      ["coach-started", { preset: "demo-list", phase: "bases" }],
      ["phase-advanced", { from: "bases", to: "learn" }],
      ["curriculum-switched", { from: { preset: "demo-list", phase: "learn" }, to: { preset: "wide-list", phase: "learn" } }],
      ["welcome-back", { date: "2026-10-15", daysAway: 10 }],
    ]);
  });
});

describe("state.json and the first run", () => {
  it("counts in state.json the announcements the playground has not acknowledged", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const study = openStudy(root, { clock });
    setCurriculum(study, root, "demo-list", clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ announcements: 1 });
    ackAnnouncement(study, 1, "chat", clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ announcements: 1 });
    ackAnnouncement(study, 1, "ui", clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ announcements: 0 });
    study.close();
  });

  it("says whether a repo without a study database needs init or migrate", () => {
    const root = makeCoachRepo();
    expect(notInitialized(root)).toEqual({ initialized: false, next: "init" });
    put(root, "problems/lc-9101-sample/solution.py", "# placeholder\n");
    expect(notInitialized(root)).toEqual({ initialized: false, next: "migrate" });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/today.test.ts`
Expected: FAIL. `../today.ts` does not exist.

- [ ] **Step 3: Write `today`**

Create `study/today.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, isNull, lt, max } from "drizzle-orm";
import { LEGACY_PERSONAL_FIELDS } from "../lib/schemas.ts";
import { scanRepo } from "../lib/repo.ts";
import { itemTitle, listMembers } from "./catalog.ts";
import { type ListImport, listImport, timeboxMinutes } from "./curriculum.ts";
import { daysBetween, localDate, localDay } from "./days.ts";
import { examResult, examsOf, openExam } from "./exam.ts";
import { openPause } from "./pause.ts";
import { type CoachContext, conceptLearned, currentCurriculum, currentPhase, expansionWindow, learnedProblems, loadContext, syncPhase } from "./phase.ts";
import { CONCEPT_MINUTES, dueCards, ensurePlan, loadFacts, problemMinutes, REVIEW_FACTOR } from "./plan.ts";
import { itemsDone, readProfile, type StoredItem, type StoredPlan } from "./plan-store.ts";
import { announcementAcks, announcements, attemptEvents, curriculumLog, type Phase, phaseLog, type SURFACES } from "./schema.ts";
import { storedCards } from "./fsrs.ts";
import { refreshState } from "./state.ts";
import type { Study, StudyQueries } from "./store.ts";

export type Surface = (typeof SURFACES)[number];

export interface TodayItem {
  kind: "continue" | "review" | "new" | "concept" | "exam";
  /** A problem or exercise id; a concept slug for kind concept. */
  id: string;
  title: string;
  minutes: number;
  reason: string;
  /** Closed since the plan was made (a concept: learned). */
  done: boolean;
  /** The content is not in the repo: a concept note the `concept` skill has not created yet, or an orphan. */
  missing: boolean;
}

export interface TodayPhase {
  id: Phase;
  /** ISO time of the phase_log row. */
  since: string;
  preset: string;
  progress: { done: number; total: number };
  /** The list this phase works on (learn, master: the preset's; expand: the expansion list), with how much is imported. */
  list: ListImport | null;
  /** Phase 3 only: the expansion list (null until the coach stores the user's choice) and the choices. */
  expansion: { list: string | null; choices: string[] } | null;
}

export interface AnnouncementJson {
  id: number;
  key: "coach-started" | "phase-advanced" | "phase-set" | "curriculum-switched" | "welcome-back";
  at: string;
  payload: Record<string, unknown>;
}

/** `pnpm -s today --json` (spec §11) and GET /api/study/today. */
export interface TodayJson {
  initialized: true;
  /** False until `pnpm study curriculum set <preset>` (the coach's onboarding) starts the coach. */
  started: boolean;
  date: string;
  paused: { since: string } | null;
  phase: TodayPhase | null;
  /** Not yet acknowledged on the asking surface (chat or ui). */
  announcements: AnnouncementJson[];
  mode: "normal" | "return" | "catch-up";
  items: TodayItem[];
  /** Due reviews left out of today's plan; `days` at today's review capacity. */
  backlog: { waiting: number; days: number };
  budget: { minutes: number; planned: number };
}

/** No study database yet (spec §13): `next` says which command the user runs. */
export interface NotInitializedJson {
  initialized: false;
  next: "init" | "migrate";
}

/** A repo with progress in its READMEs or solution files in content folders needs `migrate`; a fresh clone `init`. */
export function notInitialized(root: string): NotInitializedJson {
  const repo = scanRepo(root);
  const legacy =
    repo.problems.some((p) => LEGACY_PERSONAL_FIELDS.problem.some((field) => field in p.data) || ["py", "ts"].some((lang) => existsSync(path.join(p.dir, `solution.${lang}`)))) ||
    repo.exercises.some((e) => LEGACY_PERSONAL_FIELDS.exercise.some((field) => field in e.data)) ||
    repo.concepts.some((c) => LEGACY_PERSONAL_FIELDS.concept.some((field) => field in c.data));
  return { initialized: false, next: legacy ? "migrate" : "init" };
}

function lastBefore<T extends { id: number }>(rows: T[], id: number): T | undefined {
  return rows.filter((row) => row.id < id).at(-1);
}

/** The message of an announcement is rendered from the rows it references (spec §4). */
function announcementJson(db: StudyQueries, row: typeof announcements.$inferSelect): AnnouncementJson {
  const at = row.at.toISOString();
  const phases = db.select().from(phaseLog).orderBy(asc(phaseLog.id)).all();
  const curricula = db.select().from(curriculumLog).orderBy(asc(curriculumLog.id)).all();
  if (row.kind === "return") {
    const last = db.select({ at: max(attemptEvents.at) }).from(attemptEvents).where(lt(attemptEvents.at, row.at)).get()?.at;
    const daysAway = last ? Math.floor((row.at.getTime() - last.getTime()) / 86_400_000) : 0;
    return { id: row.id, key: "welcome-back", at, payload: { date: row.localDate, daysAway } };
  }
  const phase = phases.find((p) => p.id === row.phaseLogId)!;
  const before = lastBefore(phases, phase.id);
  if (row.kind === "switch") {
    const curriculum = curricula.find((c) => c.id === row.curriculumLogId)!;
    return {
      id: row.id,
      key: "curriculum-switched",
      at,
      payload: { from: { preset: lastBefore(curricula, curriculum.id)?.preset ?? null, phase: before?.phase ?? null }, to: { preset: curriculum.preset, phase: phase.phase } },
    };
  }
  if (phase.reason === "forced") return { id: row.id, key: "phase-set", at, payload: { from: before?.phase ?? null, to: phase.phase } };
  if (!before) return { id: row.id, key: "coach-started", at, payload: { preset: curricula.find((c) => c.id === phase.curriculumLogId)?.preset ?? null, phase: phase.phase } };
  return { id: row.id, key: "phase-advanced", at, payload: { from: before.phase, to: phase.phase } };
}

/** Announcements the surface has not acknowledged yet, oldest first (spec §6.1). */
export function pendingAnnouncements(db: StudyQueries, surface: Surface): AnnouncementJson[] {
  return db
    .select({ announcement: announcements })
    .from(announcements)
    .leftJoin(announcementAcks, and(eq(announcementAcks.announcementId, announcements.id), eq(announcementAcks.surface, surface)))
    .where(isNull(announcementAcks.announcementId))
    .orderBy(asc(announcements.id))
    .all()
    .map(({ announcement }) => announcementJson(db, announcement));
}

/** `pnpm -s study ack <id>` (chat) and POST /api/study/ack/:id (ui): one row per surface (spec §4). */
export function ackAnnouncement(study: Study, id: number, surface: Surface, now: Date): "acked" | "already" | "unknown" {
  if (!study.db.select({ id: announcements.id }).from(announcements).where(eq(announcements.id, id)).get()) return "unknown";
  const inserted = study.db.insert(announcementAcks).values({ announcementId: id, surface, at: now }).onConflictDoNothing().returning().get();
  refreshState(study); // state.json counts the announcements the playground has not acknowledged
  return inserted ? "acked" : "already";
}

const PLURAL = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Phase progress (spec §11 `phase.progress`): what the phase's exit criteria count. */
function phaseProgress(study: Study, ctx: CoachContext, phase: Phase): { done: number; total: number } {
  switch (phase) {
    case "bases": {
      const concepts = ctx.preset.phases.bases.concepts;
      return { done: concepts.filter((slug) => conceptLearned(study, ctx, slug)).length, total: concepts.length };
    }
    case "learn": {
      const { members, learned } = learnedProblems(study, ctx);
      return { done: learned.length, total: members.length };
    }
    case "master": {
      const list = ctx.preset.phases.master.list;
      const members = listMembers(ctx.catalog, list).map((p) => p.id);
      const exam = openExam(study.db, list, members) ?? (examsOf(study.db, list).length > 0 ? examResult(study.db, examsOf(study.db, list).at(-1)!, members) : null);
      return { done: exam ? exam.order.length - exam.remaining.length : 0, total: members.length };
    }
    case "expand": {
      const window = expansionWindow(study, ctx);
      return { done: window.results.filter(Boolean).length, total: window.window };
    }
    case "pro":
      return { done: 0, total: 0 };
  }
}

function itemJson(study: Study, ctx: CoachContext, phase: Phase, item: StoredItem, done: boolean, day: string): TodayItem {
  const title = itemTitle(ctx.catalog, item.itemId);
  const base = { id: item.itemId, title: title ?? item.itemId, done, missing: title === null };
  if (item.slot === "concept") {
    const bases = ctx.preset.phases.bases.concepts;
    const reason = item.pattern ? `opens ${item.pattern}` : `bases ${bases.indexOf(item.itemId) + 1}/${bases.length}`;
    return { ...base, kind: "concept", minutes: CONCEPT_MINUTES, reason };
  }
  const exercise = ctx.catalog.exercises.get(item.itemId);
  if (item.slot === "continue") {
    const where = exercise ? exercise.concept : (ctx.catalog.problems.get(item.itemId)?.pattern ?? "");
    const minutes = exercise ? timeboxMinutes(ctx.preset, "easy") : problemMinutes(ctx, item.itemId);
    return { ...base, kind: "continue", minutes, reason: `in progress${where ? ` · ${where}` : ""}` };
  }
  if (item.slot === "review") {
    const card = storedCards(study.db).get(item.itemId);
    const late = card ? daysBetween(localDate(card.due, readProfile(study.db).timezone), day) : 0;
    const reason = late <= 0 ? "due today" : late === 1 ? "due yesterday" : `due ${late} days ago`;
    return { ...base, kind: "review", minutes: problemMinutes(ctx, item.itemId, REVIEW_FACTOR), reason };
  }
  const minutes = problemMinutes(ctx, item.itemId);
  if (item.blockIndex !== null && item.pattern) {
    const size = Math.min(ctx.preset.phases.learn.block, listMembers(ctx.catalog, ctx.preset.phases.learn.list).filter((p) => p.pattern === item.pattern).length);
    return { ...base, kind: "new", minutes, reason: `block ${item.blockIndex}/${Math.max(size, item.blockIndex)} · ${item.pattern}` };
  }
  if (item.pattern) return { ...base, kind: "new", minutes, reason: `mix · ${item.pattern}` };
  if (phase === "master") {
    const list = ctx.preset.phases.master.list;
    const exam = examsOf(study.db, list).at(-1);
    if (exam) {
      const order = examResult(study.db, exam, listMembers(ctx.catalog, list).map((p) => p.id)).order;
      return { ...base, kind: "exam", minutes, reason: `exam ${order.indexOf(item.itemId) + 1}/${order.length}` };
    }
  }
  return { ...base, kind: "new", minutes, reason: phase === "expand" && ctx.expansionList ? `expand · ${ctx.expansionList}` : "practice" };
}

/**
 * `pnpm today` and the playground's Today section (spec §6, §11): evaluates the phase criteria, makes or reads
 * today's stored plan, and renders it with the announcements the surface has not acknowledged.
 */
export function today(study: Study, root: string, options: { surface: Surface; now: Date; refresh?: boolean }): TodayJson {
  const { now } = options;
  syncPhase(study, root, now);
  const plan: StoredPlan | null = ensurePlan(study, root, now, { refresh: options.refresh });
  const profile = readProfile(study.db);
  const day = localDay(now, profile.timezone);
  const curriculum = currentCurriculum(study.db);
  const phaseRow = currentPhase(study.db);
  const pause = openPause(study.db);
  const json: TodayJson = {
    initialized: true,
    started: curriculum !== null && phaseRow !== null,
    date: day.date,
    paused: pause ? { since: pause.startedAt.toISOString() } : null,
    phase: null,
    announcements: pendingAnnouncements(study.db, options.surface),
    mode: "normal",
    items: [],
    backlog: { waiting: 0, days: 0 },
    budget: { minutes: profile.dailyMinutes, planned: 0 },
  };
  if (!curriculum || !phaseRow) return json;
  const ctx = loadContext(study, root, curriculum.preset);
  const phase = phaseRow.phase;
  const listId = phase === "learn" ? ctx.preset.phases.learn.list : phase === "master" ? ctx.preset.phases.master.list : phase === "expand" ? ctx.expansionList : null;
  json.phase = {
    id: phase,
    since: phaseRow.at.toISOString(),
    preset: curriculum.preset,
    progress: phaseProgress(study, ctx, phase),
    list: listId ? listImport(root, ctx.catalog, listId) : null,
    expansion: phase === "expand" ? { list: ctx.expansionList, choices: ctx.preset.phases.expand.choose_from } : null,
  };
  if (!plan) return json;
  const done = itemsDone(study, plan);
  json.mode = plan.mode === "catch_up" ? "catch-up" : plan.mode;
  json.items = plan.items.map((item, i) => itemJson(study, ctx, phase, item, done[i], day.date));
  json.budget.planned = json.items.reduce((sum, item) => sum + item.minutes, 0);
  const planned = new Set(plan.items.map((item) => item.itemId));
  const waiting = dueCards(study.db, ctx, loadFacts(study.db), day.end).filter(({ itemId }) => !planned.has(itemId)).length;
  const capacity = Math.max(1, plan.items.filter((item) => item.slot === "review").length);
  json.backlog = { waiting, days: Math.ceil(waiting / capacity) };
  return json;
}

const PHASE_NAMES: Record<Phase, string> = { bases: "0 · Bases", learn: "1 · Learn the list", master: "2 · Master the list", expand: "3 · Expand", pro: "4 · Pro" };

/** `pnpm today` without --json: the same plan as text. */
export function describeToday(json: TodayJson): string {
  if (!json.started) return "The coach has not started yet. Ask Claude \"¿qué me toca hoy?\", or run `pnpm study curriculum set grind-75`.";
  const lines: string[] = [];
  const phase = json.phase!;
  lines.push(`${json.date} · phase ${PHASE_NAMES[phase.id]} (${phase.progress.done}/${phase.progress.total}) · ${phase.preset}${json.mode === "normal" ? "" : ` · ${json.mode}`}`);
  for (const a of json.announcements) lines.push(`! [${a.id}] ${a.key} ${JSON.stringify(a.payload)}`);
  if (json.paused) {
    lines.push(`Paused since ${json.paused.since.slice(0, 10)}. Run \`pnpm study resume\` to go on.`);
    return lines.join("\n");
  }
  json.items.forEach((item, i) => lines.push(`${i + 1}. ${item.done ? "✓" : " "} [${item.kind}] ${item.id} ${item.title} · ${item.minutes} min · ${item.reason}${item.missing ? " (not in the repo yet)" : ""}`));
  if (json.items.length === 0) lines.push("Nothing planned today.");
  if (json.backlog.waiting > 0) lines.push(`Backlog: ${PLURAL(json.backlog.waiting, "review")} waiting (about ${PLURAL(json.backlog.days, "day")}).`);
  return lines.join("\n");
}

```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm vitest run study/tests/today.test.ts && pnpm exec tsc --noEmit`
Expected: 12 passed; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add study/tests/today.test.ts study/today.ts
git commit -m "feat(study): render today's plan with its announcements per surface"
```


### Task 10: Start review: the gate, the archive to `history/`, the fresh stub

**Files:**
- Create: `study/start.ts`
- Test: `study/tests/start.test.ts` (create)

**Interfaces:**
- Consumes: Plan A's `historyPath`, `studySolutionPath` (`runner/src/paths.ts`), `solutionPath`, `renderStub` (`runner/src/stubs.ts`), `sameAsStub` (`runner/src/recording.ts`), `loadCaseFile`, `openAttempt`, `AttemptAlreadyOpenError`, `itemProgress`, `refreshState`; `readProblem`, `listMembers`, `loadCatalog` (Task 1); `timeboxMinutes`, `tryLoadPreset` (Task 2); `storedCards` (Task 3); `openExam` (Task 4); `currentCurriculum`, `currentPhase` (Task 4); `REVIEW_FACTOR` (Task 8); `readProfile`, `localDay`.
- Produces (`study/start.ts`):
  - `type GateKind = "review" | "exam" | "retry"`; `interface Gate { kind; minutes; examId: number | null }`;
  - `startGate(study, root, itemId, now): Gate | null`;
  - `type StartResult = { started: true; attemptId; kind: GateKind; examId; archived: string[]; solutions: string[] } | { started: false; reason: "open" | "new" }`;
  - `startAttempt(study, root, target, now, { lang? }): StartResult` (throws `CaseFileError` for a broken `cases.json`, and the file error when archiving fails).
- **Behavior (spec §7 "Start review, from scratch"):**
  - **The gate:** none while an attempt is open. `exam` in phase 2 for the open exam's problems with no try yet. `review` for a problem whose card is due before the end of the local day. `retry` for an exercise whose latest attempt was given up: Plan A's lifecycle never reopens a closed item by itself, and an exercise must be solved again to count as done (spec §6.1), so it needs this gate too.
  - **Start:** for each language with a solution file (the legacy in-folder one too, before `migrate`), copy it to `history/<timestamp>.<lang>`, verify the bytes, then delete it; a file equal to the stub is just replaced. History is never overwritten (`COPYFILE_EXCL`): when the copy fails, nothing is deleted and no attempt opens. Then write a fresh stub under `.study` in those languages (or `lang`, or the profile's language), and open the attempt, with `exam_id` for an exam.
  - An item that was never tried is refused (`new`): its first attempt starts with real work (Plan A). An item with an open attempt is refused (`open`). The user's `pnpm study start <id>` may start a review early (any item with a closed attempt).
  - Claude never runs this: the hook denies `study start` and `/api/study/start` (Plan A Task 8).

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/start.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { studySolutionDir, studySolutionPath } from "../../runner/src/paths.ts";
import { listTargets } from "../../runner/src/resolver.ts";
import { loadCaseFile } from "../../runner/src/schema.ts";
import { renderStub } from "../../runner/src/stubs.ts";
import type { Target } from "../../runner/src/types.ts";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import { ensurePlan } from "../plan.ts";
import { giveUp, recordWork } from "../record.ts";
import { attempts, attemptStats } from "../schema.ts";
import { startAttempt, startGate } from "../start.ts";
import { openStudy, type Study } from "../store.ts";
import { forcePhase, setCurriculum } from "../switch.ts";
import { DAY, makeCoachRepo, MONDAY, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

interface Repo {
  root: string;
  study: Study;
  clock: FixedClock;
  target(id: string): Target;
}

/** A repo on disk (start moves files): .study initialized in TZ, the coach started on demo-list. */
function repo(): Repo {
  const root = makeCoachRepo();
  const clock = fixedClock(MONDAY);
  initStudy(root, { clock, timezone: TZ });
  const study = openStudy(root, { clock });
  setCurriculum(study, root, "demo-list", clock.now());
  return { root, study, clock, target: (id) => listTargets(root).find((t) => t.id === id)! };
}

const OLD_WORK = "# my earlier work\n";

describe("the Start review gate (spec §7)", () => {
  it("shows for a problem whose card is due, never while an attempt is open", () => {
    const r = repo();
    recordWork(r.study, "lc-9101", { type: "run", lang: "py", green: true }, "cli");
    expect(startGate(r.study, r.root, "lc-9101", r.clock.now())).toBeNull(); // due in a few days
    r.clock.advance(30 * DAY);
    expect(startGate(r.study, r.root, "lc-9101", r.clock.now())).toEqual({ kind: "review", minutes: 9, examId: null });
    expect(startGate(r.study, r.root, "lc-9102", r.clock.now())).toBeNull(); // never tried: a new item, no gate
    r.study.close();
  });

  it("shows for a given-up exercise, which is not done until it is solved again", () => {
    const r = repo();
    giveUp(r.study, "basics-a/01");
    expect(startGate(r.study, r.root, "basics-a/01", r.clock.now())).toEqual({ kind: "retry", minutes: 15, examId: null });
    r.study.close();
  });

  it("shows for the open exam's problems in phase 2", () => {
    const r = repo();
    forcePhase(r.study, "master", r.clock.now());
    const plan = ensurePlan(r.study, r.root, r.clock.now())!;
    const gate = startGate(r.study, r.root, plan.items[0].itemId, r.clock.now());
    expect(gate).toMatchObject({ kind: "exam", examId: 1 });
    r.study.close();
  });
});

describe("startAttempt (spec §7)", () => {
  it("archives the old solution to history/, writes a fresh stub, and opens a review attempt", () => {
    const r = repo();
    const target = r.target("lc-9101");
    put(r.root, path.relative(r.root, studySolutionPath(target, "py")), OLD_WORK);
    recordWork(r.study, "lc-9101", { type: "run", lang: "py", green: true }, "cli");
    r.clock.advance(30 * DAY);
    const result = startAttempt(r.study, r.root, target, r.clock.now());
    const history = path.join(studySolutionDir(target), "history", "2026-11-04T14-00-00-000Z.py");
    expect(result).toEqual({ started: true, attemptId: 2, kind: "review", examId: null, archived: [history], solutions: [studySolutionPath(target, "py")] });
    expect(readFileSync(history, "utf8")).toBe(OLD_WORK);
    expect(readFileSync(studySolutionPath(target, "py"), "utf8")).toBe(renderStub(loadCaseFile(target.dir), "py"));
    const open = r.study.db.select({ kind: attemptStats.kind }).from(attemptStats).all().at(-1);
    expect(open).toEqual({ kind: "review" });
    expect(startAttempt(r.study, r.root, target, r.clock.now())).toEqual({ started: false, reason: "open" });
    r.study.close();
  });

  it("moves a solution that still sits in the content folder, and writes the stub under .study", () => {
    const r = repo();
    const target = r.target("lc-9101");
    put(r.root, "problems/lc-9101-sample/solution.ts", "// legacy work\n");
    recordWork(r.study, "lc-9101", { type: "run", lang: "ts", green: true }, "cli");
    r.clock.advance(30 * DAY);
    const result = startAttempt(r.study, r.root, target, r.clock.now(), { lang: "py" });
    expect(result).toMatchObject({ started: true, solutions: [studySolutionPath(target, "py"), studySolutionPath(target, "ts")] });
    expect(existsSync(path.join(r.root, "problems/lc-9101-sample/solution.ts"))).toBe(false);
    expect(readdirSync(path.join(studySolutionDir(target), "history"))).toEqual(["2026-11-04T14-00-00-000Z.ts"]);
    r.study.close();
  });

  it("joins the open exam, and refuses an item that was never tried", () => {
    const r = repo();
    expect(startAttempt(r.study, r.root, r.target("lc-9102"), r.clock.now())).toEqual({ started: false, reason: "new" });
    forcePhase(r.study, "master", r.clock.now());
    const first = ensurePlan(r.study, r.root, r.clock.now())!.items[0].itemId;
    expect(startAttempt(r.study, r.root, r.target(first), r.clock.now())).toMatchObject({ started: true, kind: "exam", examId: 1 });
    expect(r.study.db.select({ examId: attempts.examId }).from(attempts).all()).toEqual([{ examId: 1 }]);
    r.study.close();
  });

  it("never overwrites a history file: the start fails and the solution stays where it was", () => {
    const r = repo();
    const target = r.target("lc-9101");
    put(r.root, path.relative(r.root, studySolutionPath(target, "py")), OLD_WORK);
    recordWork(r.study, "lc-9101", { type: "run", lang: "py", green: true }, "cli");
    r.clock.advance(30 * DAY);
    put(r.root, path.relative(r.root, path.join(studySolutionDir(target), "history", "2026-11-04T14-00-00-000Z.py")), "# older\n");
    expect(() => startAttempt(r.study, r.root, target, r.clock.now())).toThrow(/EEXIST/);
    expect(readFileSync(studySolutionPath(target, "py"), "utf8")).toBe(OLD_WORK);
    expect(r.study.db.select().from(attempts).all()).toHaveLength(1);
    r.study.close();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/start.test.ts`
Expected: FAIL. `../start.ts` does not exist.

- [ ] **Step 3: Write the gate and the start**

Create `study/start.ts`:

```ts
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { historyPath, studySolutionPath } from "../runner/src/paths.ts";
import { sameAsStub } from "../runner/src/recording.ts";
import { loadCaseFile } from "../runner/src/schema.ts";
import { renderStub, solutionPath } from "../runner/src/stubs.ts";
import { type Lang, LANGS, type Target } from "../runner/src/types.ts";
import { listMembers, loadCatalog, readProblem } from "./catalog.ts";
import { timeboxMinutes, tryLoadPreset } from "./curriculum.ts";
import { localDay } from "./days.ts";
import { openExam } from "./exam.ts";
import { storedCards } from "./fsrs.ts";
import { currentCurriculum, currentPhase } from "./phase.ts";
import { REVIEW_FACTOR } from "./plan.ts";
import { readProfile } from "./plan-store.ts";
import { AttemptAlreadyOpenError, openAttempt } from "./record.ts";
import { refreshState } from "./state.ts";
import { itemProgress } from "./status.ts";
import { inTransaction, type Study } from "./store.ts";

export type GateKind = "review" | "exam" | "retry";

/** "Start review" (spec §7): shown instead of the editor until the user starts the attempt from scratch. */
export interface Gate {
  kind: GateKind;
  /** The estimate: a review 0.6 of the time-box, an exam the whole time-box, a retried exercise an easy one's. */
  minutes: number;
  /** The exam the attempt joins (kind exam). */
  examId: number | null;
}

/**
 * The gate of an item now, or null when its editor opens as usual:
 * - none while an attempt is open;
 * - exam: phase 2, and the item is in the open exam with no try yet;
 * - review: a problem whose card is due today;
 * - retry: an exercise whose latest attempt was given up (it is not done until it is solved again, spec §6.1).
 */
export function startGate(study: Study, root: string, itemId: string, now: Date): Gate | null {
  const progress = itemProgress(study, itemId);
  if (progress.open) return null;
  const curriculum = currentCurriculum(study.db);
  const preset = tryLoadPreset(root, curriculum?.preset ?? null);
  const minutes = (factor: number) => Math.round(timeboxMinutes(preset, readProblem(root, itemId)?.difficulty ?? null) * factor);
  if (itemId.includes("/")) return progress.lastOutcome === "gave_up" ? { kind: "retry", minutes: timeboxMinutes(preset, "easy"), examId: null } : null;
  if (preset && currentPhase(study.db)?.phase === "master") {
    const list = preset.phases.master.list;
    const exam = openExam(study.db, list, listMembers(loadCatalog(root), list).map((p) => p.id));
    if (exam?.remaining.includes(itemId)) return { kind: "exam", minutes: minutes(1), examId: exam.exam.id };
  }
  const card = storedCards(study.db).get(itemId);
  const end = localDay(now, readProfile(study.db).timezone).end;
  return card && card.due.getTime() < end.getTime() ? { kind: "review", minutes: minutes(REVIEW_FACTOR), examId: null } : null;
}

export type StartResult =
  | { started: true; attemptId: number; kind: GateKind; examId: number | null; archived: string[]; solutions: string[] }
  /** open: an attempt is already open; new: the item was never tried, and its first attempt starts with real work. */
  | { started: false; reason: "open" | "new" };

/** Moves a file, verifying the copy's bytes before deleting the original; never overwrites history. */
function archive(file: string, dest: string): void {
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(file, dest, constants.COPYFILE_EXCL);
  if (!readFileSync(dest).equals(readFileSync(file))) throw new Error(`archiving ${file} failed: the copy differs`);
  unlinkSync(file);
}

/**
 * `POST /api/study/start/<id>` and the user's `pnpm study start <id>` (spec §7, "Start review, from scratch"):
 * 1. archives each current solution to history/<timestamp>.<lang> (a solution equal to the stub is just replaced);
 * 2. writes a fresh stub, in every language that had a solution (or `lang`, or the profile's language);
 * 3. opens the attempt, joining the open exam when the gate says so.
 * Items that were never tried are refused. Claude never runs this: the hook denies `study start` and the route.
 */
export function startAttempt(study: Study, root: string, target: Target, now: Date, options: { lang?: Lang } = {}): StartResult {
  const progress = itemProgress(study, target.id);
  if (progress.open) return { started: false, reason: "open" };
  const gate = startGate(study, root, target.id, now);
  if (!gate && progress.status === "todo") return { started: false, reason: "new" };
  const caseFile = loadCaseFile(target.dir);
  const archived: string[] = [];
  const langs = new Set<Lang>(options.lang ? [options.lang] : []);
  for (const lang of LANGS) {
    const file = solutionPath(target, lang);
    if (!existsSync(file)) continue;
    langs.add(lang);
    if (sameAsStub(readFileSync(file, "utf8"), renderStub(caseFile, lang))) {
      unlinkSync(file);
      continue;
    }
    const dest = historyPath(target, lang, now);
    archive(file, dest);
    archived.push(dest);
  }
  if (langs.size === 0) langs.add(readProfile(study.db).language);
  const solutions = [...langs].map((lang) => {
    const file = studySolutionPath(target, lang);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, renderStub(caseFile, lang));
    return file;
  });
  try {
    const attemptId = inTransaction(study, (tx) => openAttempt(tx, target.id, now, { examId: gate?.examId ?? undefined }));
    refreshState(study);
    return { started: true, attemptId, kind: gate?.kind ?? (target.kind === "problem" ? "review" : "retry"), examId: gate?.examId ?? null, archived, solutions };
  } catch (error) {
    if (error instanceof AttemptAlreadyOpenError) return { started: false, reason: "open" };
    throw error;
  }
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm vitest run study/tests/start.test.ts && pnpm exec tsc --noEmit`
Expected: 7 passed; `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add study/tests/start.test.ts study/start.ts
git commit -m "feat(study): start a review from scratch: archive the solution, write a stub, open the attempt"
```


### Task 11: The study CLI: `pnpm today`, `ack`, `start`, `pause`, `resume`, `phase`, `curriculum`, `export`, `backup`, `rebuild`

**Files:**
- Create: `study/export.ts`
- Modify: `study/fsrs.ts`, `study/today.ts`, `study/status.ts`, `study/commands.ts`
- Modify: `README.md`, `CLAUDE.md`
- Modify tests: `study/tests/status.test.ts`, `study/tests/init.test.ts` (Plan A's), `scripts/tests/claude-layer.test.ts`
- Test: `study/tests/coach-cli.test.ts` (create)

**Interfaces:**
- Consumes: everything from Tasks 1–10; Plan A's CLI plumbing in `study/commands.ts` (`CliIo`, `UsageError`, `USAGE`, `parsed`, `openOrNull`, `withStudy`, `exactTarget`, `displayPath`, `runStudyCli`), `historyStamp`.
- Produces:
  - `study/export.ts`: `EXPORTED_TABLES`; `exportStudy(study, now): string` (`.study/exports/study-<stamp>.json`); `backupStudy(study, now): string` (`.study/exports/study-<stamp>.db`, by `VACUUM INTO`).
  - `study/fsrs.ts`: `staleCards(db): string[]`.
  - `study/today.ts`: `interface PhaseStatusJson { started; phase; since; reason; preset; progress; exitMet }`, `phaseStatus(study, root)`; `interface CurriculumStatusJson { preset; since; presets: { id; list; imported; size }[]; expansion: { list; choices } }`, `curriculumStatus(study, root)`.
  - `study/status.ts`: `SummaryJson` gains `coach: CoachSummary`, with `interface CoachSummary { started; preset; phase; paused; expansionList }` and `coachSummary(study)`. Plan A's fields are unchanged (Plan A: "Plan B adds fields; it never renames these").
  - **Commands** (spec §11). Exit 0 unless noted; `--json` prints the engine's result object.

    | Command | Output | Exit |
    |---|---|---|
    | `pnpm today [--json] [--refresh]` | the plan for the **chat** surface (`TodayJson`); with no database, what to run (`NotInitializedJson`) | 0 |
    | `pnpm study ack <id> [--surface chat\|ui]` | acknowledges an announcement (default chat) | 1 when unknown |
    | `pnpm study start <id> [--lang py\|ts]` | Start review from the terminal (the user's only) | 1 for a never-tried item |
    | `pnpm study pause` / `resume` | the user's only | 0 |
    | `pnpm study phase [--json]` / `phase set <phase>` | `PhaseStatusJson`; `set` is the user's only | 1 before the coach starts |
    | `pnpm study curriculum [--json]` / `set <preset>` / `expand <list>` | `CurriculumStatusJson`; `CurriculumResult`; `ExpansionResult` | 1 when refused |
    | `pnpm study export` / `backup` | the file written under `.study/exports` | 0 |
    | `pnpm study rebuild [--check]` | rebuilds the cards cache; `--check` only compares it with a replay | 1 when `--check` finds stale cards |

  - An invalid preset prints `curriculum/<id>.yaml is not a valid preset:` and one `  path: message` line per issue, exit 1 (spec §13).
- The hook (Plan A Task 8) already denies Claude `study start|pause|resume|migrate` and `study phase set`, and allows the rest (`curriculum set` included: the coach runs it only on the user's explicit request, spec §6.5). `.claude/settings.json` already allows `pnpm -s study:*` and `pnpm -s today:*`.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/coach-cli.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { initStudy } from "../init.ts";
import { acceptExplanation, recordWork } from "../record.ts";
import { cards } from "../schema.ts";
import { openStudy } from "../store.ts";
import { DAY, makeCoachRepo, MONDAY, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

function repo(options: { init?: boolean } = {}) {
  const root = makeCoachRepo();
  const clock: FixedClock = fixedClock(MONDAY);
  if (options.init ?? true) initStudy(root, { clock, timezone: TZ });
  const cli = async (...argv: string[]) => {
    let out = "";
    let err = "";
    const io: CliIo = { root, clock, out: (text) => (out += text), err: (text) => (err += text) };
    const code = await runStudyCli(argv, io);
    return { code, out, err, json: () => JSON.parse(out) };
  };
  const withStudy = (fn: (study: ReturnType<typeof openStudy>) => void) => {
    const study = openStudy(root, { clock });
    try {
      fn(study);
    } finally {
      study.close();
    }
  };
  return { root, clock, cli, withStudy };
}

describe("pnpm today", () => {
  it("explains what to run when there is no study database", async () => {
    const r = repo({ init: false });
    expect(await r.cli("today")).toMatchObject({ code: 0, out: expect.stringContaining("Run `pnpm study init`") });
    expect((await r.cli("today", "--json")).json()).toEqual({ initialized: false, next: "init" });
  });

  it("says the coach has not started, then shows the plan, and acknowledges announcements for the chat", async () => {
    const r = repo();
    expect((await r.cli("today", "--json")).json()).toMatchObject({ initialized: true, started: false, items: [] });
    expect((await r.cli("today")).out).toContain("The coach has not started yet");
    expect(await r.cli("curriculum", "set", "demo-list")).toMatchObject({ code: 0, out: "Started demo-list: phase bases.\n" });
    const plan = (await r.cli("today", "--json")).json();
    expect(plan).toMatchObject({ started: true, phase: { id: "bases" }, items: [{ kind: "concept", id: "basics-a" }] });
    expect(plan.announcements).toEqual([{ id: 1, key: "coach-started", at: MONDAY, payload: { preset: "demo-list", phase: "bases" } }]);
    expect((await r.cli("today")).out).toBe(
      [
        "2026-10-05 · phase 0 · Bases (0/2) · demo-list",
        '! [1] coach-started {"preset":"demo-list","phase":"bases"}',
        "1.   [concept] basics-a Concept basics-a · 20 min · bases 1/2",
        "",
      ].join("\n"),
    );
    expect(await r.cli("ack", "1")).toMatchObject({ code: 0, out: "Acknowledged announcement 1 (chat).\n" });
    expect(await r.cli("ack", "1")).toMatchObject({ code: 0, out: "Announcement 1 was already acknowledged (chat).\n" });
    expect(await r.cli("ack", "7")).toMatchObject({ code: 1, err: "There is no announcement 7.\n" });
    expect((await r.cli("today", "--json")).json().announcements).toEqual([]);
  });

  it("rebuilds the plan with --refresh", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    await r.cli("today");
    r.withStudy((study) => {
      recordWork(study, "basics-a/01", { type: "run", lang: "py", green: true }, "cli");
      acceptExplanation(study, "basics-a");
    });
    expect((await r.cli("today", "--json")).json().items[0]).toMatchObject({ id: "basics-a", done: true });
    expect((await r.cli("today", "--json", "--refresh")).json().items[0]).toMatchObject({ id: "basics-b", done: false });
  });
});

describe("pnpm study curriculum", () => {
  it("refuses a list that is not imported and keeps the current preset", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    const refused = await r.cli("curriculum", "set", "ghost-list");
    expect(refused).toMatchObject({ code: 1, err: expect.stringContaining("Refused: the ghost-list list is not imported") });
    expect((await r.cli("curriculum", "--json")).json()).toEqual({
      preset: "demo-list",
      since: MONDAY,
      presets: [
        { id: "demo-list", list: "demo-list", imported: 8, size: 8 },
        { id: "ghost-list", list: "ghost-list", imported: 0, size: 5 },
        { id: "wide-list", list: "wide-list", imported: 11, size: 12 },
      ],
      expansion: { list: null, choices: ["wide-list", "ghost-list"] },
    });
    expect((await r.cli("curriculum", "set", "ghost-list", "--json")).json()).toEqual({ status: "refused", preset: "ghost-list", list: "ghost-list", size: 5 });
  });

  it("switches, stores the expansion list, and reports an invalid preset with paths", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    expect(await r.cli("curriculum", "set", "wide-list")).toMatchObject({ code: 0, out: "Switched to wide-list: phase bases (was demo-list, phase bases).\n" });
    expect(await r.cli("curriculum", "expand", "demo-list")).toMatchObject({ code: 0, out: "Expansion list: demo-list (8 of 8 imported).\n" });
    put(r.root, "curriculum/broken.yaml", "id: broken\nphases: {}\npatterns: []\ntimebox_minutes: { easy: 0, medium: 35, hard: 50 }\n");
    const broken = await r.cli("curriculum", "set", "broken");
    expect(broken.code).toBe(1);
    expect(broken.err).toContain("curriculum/broken.yaml is not a valid preset:");
    expect(broken.err).toContain("  timebox_minutes.easy: Too small: expected number to be >0");
  });
});

describe("pnpm study start, pause, resume and phase", () => {
  it("starts a review from scratch: the old solution goes to history/", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    put(r.root, ".study/solutions/problems/lc-9101/solution.py", "# my earlier work\n");
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "run", lang: "py", green: true }, "cli"));
    expect(await r.cli("start", "lc-9102")).toMatchObject({ code: 1, err: expect.stringContaining("lc-9102 was never tried") });
    r.clock.advance(30 * DAY);
    const started = await r.cli("start", "lc-9101");
    expect(started).toMatchObject({ code: 0 });
    expect(started.out).toBe(
      "Started a review of lc-9101 from scratch.\nArchived: .study/solutions/problems/lc-9101/history/2026-11-04T14-00-00-000Z.py.\nFresh stub: .study/solutions/problems/lc-9101/solution.py.\n",
    );
    expect(await r.cli("start", "lc-9101")).toMatchObject({ code: 0, out: "lc-9101 already has an open attempt: go on with it.\n" });
  });

  it("pauses and resumes, moving due dates by the paused time", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "run", lang: "py", green: true }, "cli"));
    const due = () => {
      let at = 0;
      r.withStudy((study) => (at = study.db.select().from(cards).get()!.due.getTime()));
      return at;
    };
    const before = due();
    expect(await r.cli("pause")).toMatchObject({ code: 0, out: expect.stringContaining("Paused.") });
    expect((await r.cli("today", "--json")).json()).toMatchObject({ paused: { since: MONDAY }, items: [] });
    r.clock.advance(3 * DAY);
    expect(await r.cli("resume")).toMatchObject({ code: 0, out: "Resumed after 3 day(s): every due date moved by the paused time.\n" });
    expect(due() - before).toBe(3 * DAY);
    expect(await r.cli("resume")).toMatchObject({ code: 0, out: "Not paused.\n" });
  });

  it("shows the phase and lets the user force one", async () => {
    const r = repo();
    expect(await r.cli("phase", "set", "learn")).toMatchObject({ code: 1, err: expect.stringContaining("has not started") });
    await r.cli("curriculum", "set", "demo-list");
    expect((await r.cli("phase", "--json")).json()).toEqual({ started: true, phase: "bases", since: MONDAY, reason: "criteria", preset: "demo-list", progress: { done: 0, total: 2 }, exitMet: false });
    expect(await r.cli("phase", "set", "master")).toMatchObject({ code: 0, out: "Phase set to master (was bases).\n" });
    expect(await r.cli("phase", "set", "zen")).toMatchObject({ code: 1, err: expect.stringContaining("phase set takes one of bases, learn, master, expand, pro") });
  });
});

describe("pnpm study export, backup and rebuild", () => {
  it("export writes every table as JSON, and backup a database copy, both under .study/exports", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    expect(await r.cli("export")).toMatchObject({ code: 0, out: "Exported to .study/exports/study-2026-10-05T14-00-00-000Z.json.\n" });
    const data = JSON.parse(readFileSync(path.join(r.root, ".study/exports/study-2026-10-05T14-00-00-000Z.json"), "utf8"));
    expect(Object.keys(data.tables)).toHaveLength(15);
    expect(data.tables.curriculum_log).toEqual([{ id: 1, at: MONDAY, preset: "demo-list", reason: "init" }]);
    expect(await r.cli("backup")).toMatchObject({ code: 0, out: "Backed up to .study/exports/study-2026-10-05T14-00-00-000Z.db.\n" });
    expect(readdirSync(path.join(r.root, ".study/exports")).sort()).toEqual(["study-2026-10-05T14-00-00-000Z.db", "study-2026-10-05T14-00-00-000Z.json"]);
  });

  it("rebuild regenerates the cards cache, and --check reports a stale one", async () => {
    const r = repo();
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "run", lang: "py", green: true }, "cli"));
    expect(await r.cli("rebuild", "--check")).toMatchObject({ code: 0, out: "The cards cache matches a replay (1 card(s)).\n" });
    r.withStudy((study) => study.db.update(cards).set({ reps: 9 }).run());
    expect(await r.cli("rebuild", "--check")).toMatchObject({ code: 1, err: expect.stringContaining("differs from a replay for: lc-9101") });
    expect(await r.cli("rebuild")).toMatchObject({ code: 0, out: "Rebuilt 1 card(s) from the rated attempts.\n" });
    expect(await r.cli("rebuild", "--check")).toMatchObject({ code: 0 });
    expect(existsSync(path.join(r.root, ".study/state.json"))).toBe(true);
  });
});

describe("pnpm study status --json", () => {
  it("adds the coach's state for the skills", async () => {
    const r = repo();
    expect((await r.cli("status", "--json")).json().coach).toEqual({ started: false, preset: null, phase: null, paused: false, expansionList: null });
    await r.cli("curriculum", "set", "demo-list");
    await r.cli("pause");
    expect((await r.cli("status", "--json")).json().coach).toEqual({ started: true, preset: "demo-list", phase: "bases", paused: true, expansionList: null });
  });
});
```

Plan A's tests pin two things this task changes: the summary JSON gains `coach`, and `today` no longer exits 2.

1. In `study/tests/status.test.ts`, replace:

```ts
      revealed: [],
      orphans: ["lc-9999"],
    });
```

with:

```ts
      revealed: [],
      orphans: ["lc-9999"],
      coach: { started: false, preset: null, phase: null, paused: false, expansionList: null },
    });
```

2. In `study/tests/status.test.ts`, replace:

```ts
expect((await cli(root, "status", "--json")).json()).toEqual({ initialized: false, inProgress: [], solved: [], revealed: [], orphans: [] });
```

with:

```ts
expect((await cli(root, "status", "--json")).json()).toEqual({
      initialized: false,
      inProgress: [],
      solved: [],
      revealed: [],
      orphans: [],
      coach: { started: false, preset: null, phase: null, paused: false, expansionList: null },
    });
```

In `study/tests/init.test.ts`, replace:

```ts
    expect(today.status).toBe(2);
    expect(today.stderr).toContain("arrives with the scheduler");
```

with:

```ts
    expect(today.status).toBe(0);
    expect(today.stdout).toContain("The coach has not started yet");
```

Append to `scripts/tests/claude-layer.test.ts`:

```ts
describe("the study coach's commands (study coach spec §11)", () => {
  it("README.md lists them and CLAUDE.md says how Claude reads today's plan", () => {
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    for (const command of ["pnpm today", "pnpm study start", "pnpm study pause", "pnpm study curriculum", "pnpm study rebuild"]) expect(readme).toContain(command);
    const claude = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(claude).toContain("pnpm -s today --json");
    expect(claude).toContain("pnpm -s study ack <id>");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/coach-cli.test.ts study/tests/status.test.ts study/tests/init.test.ts scripts/tests/claude-layer.test.ts`
Expected: FAIL. The commands print the usage, `today` exits 2, the summary has no `coach`, and the docs lack the commands.

- [ ] **Step 3: Export and backup**

Create `study/export.ts`:

```ts
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
```

- [ ] **Step 4: A stale-cache check, and the phase and curriculum views**

Append to `study/fsrs.ts`:

```ts
/** Items whose cached card differs from a replay (`pnpm study rebuild --check`); empty when the cache is right. */
export function staleCards(db: StudyQueries): string[] {
  const stored = storedCards(db);
  const replayed = replayAllCards(db);
  const ids = new Set([...stored.keys(), ...replayed.keys()]);
  return [...ids].filter((id) => JSON.stringify(stored.get(id) ?? null) !== JSON.stringify(replayed.get(id) ?? null)).sort();
}
```

1. In `study/today.ts`, replace:

```ts
import { itemTitle, listMembers } from "./catalog.ts";
import { type ListImport, listImport, timeboxMinutes } from "./curriculum.ts";
```

with:

```ts
import { itemTitle, listMembers, loadCatalog } from "./catalog.ts";
import { type ListImport, listImport, listPresets, loadPreset, timeboxMinutes } from "./curriculum.ts";
```

2. In `study/today.ts`, replace:

```ts
import { type CoachContext, conceptLearned, currentCurriculum, currentPhase, expansionWindow, learnedProblems, loadContext, syncPhase } from "./phase.ts";
```

with:

```ts
import { type CoachContext, conceptLearned, currentCurriculum, currentPhase, exitMet, expansionWindow, learnedProblems, loadContext, syncPhase } from "./phase.ts";
```

3. In `study/today.ts`, replace:

```ts
import { announcementAcks, announcements, attemptEvents, curriculumLog, type Phase, phaseLog, type SURFACES } from "./schema.ts";
```

with:

```ts
import { announcementAcks, announcements, attemptEvents, curriculumLog, type Phase, phaseLog, profile, type SURFACES } from "./schema.ts";
```

Append to `study/today.ts`:

```ts
/** `pnpm study phase --json`. */
export interface PhaseStatusJson {
  started: boolean;
  phase: Phase | null;
  since: string | null;
  reason: "criteria" | "forced" | "switch" | null;
  preset: string | null;
  progress: { done: number; total: number };
  /** The phase's exit criteria hold now (the phase moves on at the next recorded attempt or `today`). */
  exitMet: boolean;
}

export function phaseStatus(study: Study, root: string): PhaseStatusJson {
  const curriculum = currentCurriculum(study.db);
  const row = currentPhase(study.db);
  if (!curriculum || !row) return { started: false, phase: null, since: null, reason: null, preset: null, progress: { done: 0, total: 0 }, exitMet: false };
  const ctx = loadContext(study, root, curriculum.preset);
  return {
    started: true,
    phase: row.phase,
    since: row.at.toISOString(),
    reason: row.reason,
    preset: curriculum.preset,
    progress: phaseProgress(study, ctx, row.phase),
    exitMet: exitMet(study, ctx, row.phase),
  };
}

/** `pnpm study curriculum --json`. */
export interface CurriculumStatusJson {
  preset: string | null;
  since: string | null;
  presets: { id: string; list: string; imported: number; size: number | null }[];
  expansion: { list: string | null; choices: string[] };
}

export function curriculumStatus(study: Study, root: string): CurriculumStatusJson {
  const curriculum = currentCurriculum(study.db);
  const catalog = loadCatalog(root);
  const presets = listPresets(root).map((id) => {
    const preset = loadPreset(root, id);
    return { id, list: preset.phases.learn.list, imported: listMembers(catalog, preset.phases.learn.list).length, size: preset.phases.learn.size };
  });
  const expansionList = study.db.select({ list: profile.expansionList }).from(profile).get()?.list ?? null;
  return {
    preset: curriculum?.preset ?? null,
    since: curriculum?.at.toISOString() ?? null,
    presets,
    expansion: { list: expansionList, choices: curriculum ? loadPreset(root, curriculum.preset).phases.expand.choose_from : [] },
  };
}
```

- [ ] **Step 5: The coach's state in `study status --json`**

1. In `study/status.ts`, replace:

```ts
import { eq, inArray } from "drizzle-orm";
```

with:

```ts
import { desc, eq, inArray, isNull } from "drizzle-orm";
```

2. In `study/status.ts`, replace:

```ts
  conceptAcceptances,
  type ItemStatusValue,
```

with:

```ts
  conceptAcceptances,
  curriculumLog,
  type ItemStatusValue,
```

3. In `study/status.ts`, replace:

```ts
  type Outcome,
} from "./schema.ts";
```

with:

```ts
  type Outcome,
  pauses,
  type Phase,
  phaseLog,
  profile,
} from "./schema.ts";
```

4. In `study/status.ts`, replace:

```ts
  /** Ids with progress whose content no longer exists (spec §13). */
  orphans: string[];
}
```

with:

```ts
  /** Ids with progress whose content no longer exists (spec §13). */
  orphans: string[];
  /** The scheduler's state (Plan B): read by the coach skill to know whether to onboard. */
  coach: CoachSummary;
}

/** `study status --json`'s `coach`: the preset in force, the phase, an open pause and the expansion list. */
export interface CoachSummary {
  /** A preset was set (`pnpm study curriculum set`): false means the coach still has to onboard the user. */
  started: boolean;
  preset: string | null;
  phase: Phase | null;
  paused: boolean;
  expansionList: string | null;
}

const NO_COACH: CoachSummary = { started: false, preset: null, phase: null, paused: false, expansionList: null };

/** Read straight from the tables (phase.ts imports this module, so it cannot be imported here). */
export function coachSummary(study: Study): CoachSummary {
  const preset = study.db.select({ preset: curriculumLog.preset }).from(curriculumLog).orderBy(desc(curriculumLog.id)).limit(1).get()?.preset ?? null;
  const phase = study.db.select({ phase: phaseLog.phase }).from(phaseLog).orderBy(desc(phaseLog.id)).limit(1).get()?.phase ?? null;
  const paused = study.db.select({ id: pauses.id }).from(pauses).where(isNull(pauses.endedAt)).get() !== undefined;
  const expansionList = study.db.select({ list: profile.expansionList }).from(profile).get()?.list ?? null;
  return { started: preset !== null && phase !== null, preset, phase, paused, expansionList };
}
```

5. In `study/status.ts`, replace:

```ts
  if (!study) return { initialized: false, inProgress: [], solved: [], revealed: [], orphans: [] };
```

with:

```ts
  if (!study) return { initialized: false, inProgress: [], solved: [], revealed: [], orphans: [], coach: NO_COACH };
```

6. In `study/status.ts`, replace:

```ts
    orphans: [...new Set(ids)].filter((id) => !known.has(id)).sort(),
  };
```

with:

```ts
    orphans: [...new Set(ids)].filter((id) => !known.has(id)).sort(),
    coach: coachSummary(study),
  };
```

- [ ] **Step 6: The commands**

In `study/commands.ts`, add the imports, the usage lines, the cases and the preset error. (The `./store.ts` line is the one Plan A Task 14 merged; if yours is ordered differently, just add `inTransaction` to it.)

1. In `study/commands.ts`, replace:

```ts
import type { Lang } from "../runner/src/types.ts";
```

with:

```ts
import type { Lang } from "../runner/src/types.ts";
import { listPresets, PresetError } from "./curriculum.ts";
import { backupStudy, exportStudy } from "./export.ts";
import { rebuildAllCards, staleCards, storedCards } from "./fsrs.ts";
import { pauseStudy, resumeStudy } from "./pause.ts";
import { type Phase, PHASES } from "./schema.ts";
import { startAttempt } from "./start.ts";
import { refreshState } from "./state.ts";
import { forcePhase, setCurriculum, setExpansionList } from "./switch.ts";
import { ackAnnouncement, curriculumStatus, describeToday, notInitialized, phaseStatus, today } from "./today.ts";
```

2. In `study/commands.ts`, replace:

```ts
import { openStudy, type Study, StudyNotInitializedError, StudySchemaOutdatedError } from "./store.ts";
```

with:

```ts
import { inTransaction, openStudy, type Study, StudyNotInitializedError, StudySchemaOutdatedError } from "./store.ts";
```

3. In `study/commands.ts`, replace:

```ts
  pnpm study record explanation <concept>
```

with:

```ts
  pnpm study record explanation <concept>
  pnpm today [--json] [--refresh]
  pnpm study ack <announcement> [--surface chat|ui]
  pnpm study start <id> [--lang py|ts]                        (the user's: archives the solution, opens a review)
  pnpm study pause | pnpm study resume                         (the user's)
  pnpm study phase [--json] | pnpm study phase set <phase>     (set: the user's)
  pnpm study curriculum [--json] | … set <preset> | … expand <list>   (set: only on the user's request)
  pnpm study export | pnpm study backup | pnpm study rebuild [--check]
```

4. In `study/commands.ts`, replace:

```ts
      case "today":
        // Plan B (the scheduler) replaces this command.
        io.err("pnpm today arrives with the scheduler (study coach, plan B).\n");
        return 2;
```

with:

```ts
      case "today":
        return todayCommand(rest, io);
      case "ack":
        return ackCommand(rest, io);
      case "start":
        return startCommand(rest, io);
      case "pause":
      case "resume":
        return pauseCommand(command, rest, io);
      case "phase":
        return phaseCommand(rest, io);
      case "curriculum":
        return curriculumCommand(rest, io);
      case "export":
        return exportCommand(rest, io);
      case "backup":
        return backupCommand(rest, io);
      case "rebuild":
        return rebuildCommand(rest, io);
```

5. In `study/commands.ts`, replace:

```ts
  } catch (error) {
    if (error instanceof QueryError) {
```

with:

```ts
  } catch (error) {
    if (error instanceof PresetError) {
      io.err(`${error.file} is not a valid preset:\n${error.issues.map((issue) => `  ${issue}`).join("\n")}\n`);
      return 1;
    }
    if (error instanceof QueryError) {
```

Then append the command functions:

Append to `study/commands.ts`:

```ts
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const NO_DATABASE_TEXT: Record<"init" | "migrate", string> = {
  init: "There is no study database yet. Run `pnpm study init`, then ask Claude \"¿qué me toca hoy?\".",
  migrate: "There is no study database yet, and this repo still has progress in its READMEs. Run `pnpm study migrate --dry-run`, then `pnpm study migrate`.",
};

/** `pnpm today [--json] [--refresh]` (spec §11): the chat surface (the coach skill and the terminal). */
function todayCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() =>
    parseArgs({ args, strict: true, options: { json: { type: "boolean", default: false }, refresh: { type: "boolean", default: false } } }),
  );
  const study = openOrNull(io);
  if (!study) {
    const missing = notInitialized(io.root);
    io.out(values.json ? json(missing) : `${NO_DATABASE_TEXT[missing.next]}\n`);
    return 0;
  }
  try {
    const plan = today(study, io.root, { surface: "chat", now: io.clock.now(), refresh: values.refresh });
    io.out(values.json ? json(plan) : `${describeToday(plan)}\n`);
    return 0;
  } finally {
    study.close();
  }
}

/** `pnpm study start <id> [--lang py|ts]` (the user's only, spec §7): Start review from the terminal. */
function startCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() => parseArgs({ args, strict: true, allowPositionals: true, options: { lang: { type: "string" } } }));
  if (values.lang !== undefined && values.lang !== "py" && values.lang !== "ts") throw new UsageError(`--lang must be py or ts (got "${values.lang}")`);
  const target = exactTarget(io.root, positionals[0]);
  return withStudy(io, (study) => {
    const result = startAttempt(study, io.root, target, io.clock.now(), { lang: values.lang as Lang | undefined });
    if (!result.started) {
      if (result.reason === "open") {
        io.out(`${target.id} already has an open attempt: go on with it.\n`);
        return 0;
      }
      io.err(`Nothing to start: ${target.id} was never tried. Its first attempt starts with your first edit or run.\n`);
      return 1;
    }
    const archived = result.archived.map((file) => displayPath(io.root, file));
    io.out(
      `Started a${result.kind === "exam" ? "n" : ""} ${result.kind} of ${target.id} from scratch.\n` +
        (archived.length ? `Archived: ${archived.join(", ")}.\n` : "") +
        `Fresh stub: ${result.solutions.map((file) => displayPath(io.root, file)).join(", ")}.\n`,
    );
    return 0;
  });
}

/** `pnpm study pause` / `pnpm study resume` (the user's only, spec §6.4). */
function pauseCommand(command: "pause" | "resume", args: string[], io: CliIo): number {
  parsed(() => parseArgs({ args, strict: true, options: {} }));
  return withStudy(io, (study) => {
    if (command === "pause") {
      const result = pauseStudy(study, io.clock.now());
      io.out(result.already ? `Already paused since ${result.since.toISOString()}.\n` : "Paused. Due dates wait for you; run `pnpm study resume` to go on.\n");
      return 0;
    }
    const result = resumeStudy(study, io.clock.now());
    const days = Math.round((result.pausedMs / 86_400_000) * 10) / 10;
    io.out(result.resumed ? `Resumed after ${days} day(s): every due date moved by the paused time.\n` : "Not paused.\n");
    return 0;
  });
}

/** `pnpm study phase [--json]` and `pnpm study phase set <phase>` (set: the user's only, spec §11). */
function phaseCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: "boolean", default: false } } }),
  );
  if (positionals[0] === "set") {
    const phase = positionals[1] as Phase;
    if (!PHASES.includes(phase)) throw new UsageError(`phase set takes one of ${PHASES.join(", ")}`);
    return withStudy(io, (study) => {
      const result = forcePhase(study, phase, io.clock.now());
      if (result.status === "not-started") {
        io.err("The coach has not started: run `pnpm study curriculum set <preset>` first.\n");
        return 1;
      }
      io.out(values.json ? json(result) : `Phase set to ${phase} (was ${result.from ?? "none"}).\n`);
      return 0;
    });
  }
  if (positionals.length > 0) throw new UsageError(USAGE);
  return withStudy(io, (study) => {
    const status = phaseStatus(study, io.root);
    if (values.json) io.out(json(status));
    else if (!status.started) io.out("The coach has not started: run `pnpm study curriculum set <preset>`.\n");
    else io.out(`Phase ${status.phase} since ${status.since!.slice(0, 10)} (${status.reason}) · ${status.preset} · ${status.progress.done}/${status.progress.total}\n`);
    return 0;
  });
}

/** `pnpm study curriculum [--json]`, `… set <preset>` and `… expand <list>` (spec §6.5; the coach runs set only when asked). */
function curriculumCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: "boolean", default: false } } }),
  );
  const [action, name] = positionals;
  if (action === "set") {
    if (!name) throw new UsageError(`curriculum set needs a preset: ${listPresets(io.root).join(", ")}`);
    return withStudy(io, (study) => {
      const result = setCurriculum(study, io.root, name, io.clock.now());
      if (values.json) io.out(json(result));
      else if (result.status === "refused") {
        io.err(
          `Refused: the ${result.list} list is not imported (no problem has \`lists: [${result.list}]\`${result.size ? `; it has ${result.size} upstream` : ""}). ` +
            "Import it first, as Grind 75 was (docs/superpowers/plans/2026-10-04-grind-75-import-procedure.md). The current preset stays.\n",
        );
      } else if (result.status === "unchanged") io.out(`Already on ${result.preset}.\n`);
      else io.out(`${result.status === "started" ? "Started" : "Switched to"} ${result.preset}: phase ${result.phase}${result.previous ? ` (was ${result.previous.preset}, phase ${result.previous.phase})` : ""}.\n`);
      return result.status === "refused" ? 1 : 0;
    });
  }
  if (action === "expand") {
    if (!name) throw new UsageError("curriculum expand needs a list, one of the preset's expand.choose_from");
    return withStudy(io, (study) => {
      const result = setExpansionList(study, io.root, name);
      if (values.json) io.out(json(result));
      else if (result.status === "refused") io.err(`Refused: ${name} is not one of ${result.choices.join(", ") || "the preset's choices (start the coach first)"}.\n`);
      else io.out(`Expansion list: ${result.list} (${result.imported}${result.size ? ` of ${result.size}` : ""} imported).\n`);
      return result.status === "refused" ? 1 : 0;
    });
  }
  if (positionals.length > 0) throw new UsageError(USAGE);
  return withStudy(io, (study) => {
    const status = curriculumStatus(study, io.root);
    if (values.json) io.out(json(status));
    else {
      const rows = status.presets.map((p) => `  ${p.id === status.preset ? "*" : " "} ${p.id.padEnd(14)} ${p.imported}${p.size ? `/${p.size}` : ""} imported`);
      io.out(`${status.preset ? `Preset: ${status.preset} since ${status.since!.slice(0, 10)}` : "The coach has not started."}\n${rows.join("\n")}\n`);
    }
    return 0;
  });
}

/** `pnpm -s study ack <announcement> [--surface chat|ui]`: the coach acknowledges what it showed (spec §6.1). */
function ackCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { surface: { type: "string", default: "chat" } } }),
  );
  const id = Number(positionals[0]);
  if (!Number.isInteger(id) || id <= 0) throw new UsageError("ack needs an announcement id (the `id` in pnpm -s today --json)");
  if (values.surface !== "chat" && values.surface !== "ui") throw new UsageError(`--surface must be chat or ui (got "${values.surface}")`);
  const surface = values.surface;
  return withStudy(io, (study) => {
    const result = ackAnnouncement(study, id, surface, io.clock.now());
    if (result === "unknown") {
      io.err(`There is no announcement ${id}.\n`);
      return 1;
    }
    io.out(result === "acked" ? `Acknowledged announcement ${id} (${surface}).\n` : `Announcement ${id} was already acknowledged (${surface}).\n`);
    return 0;
  });
}

/** `pnpm study export`: every table as JSON in .study/exports (spec §12). */
function exportCommand(args: string[], io: CliIo): number {
  parsed(() => parseArgs({ args, strict: true, options: {} }));
  return withStudy(io, (study) => {
    const file = exportStudy(study, io.clock.now());
    io.out(`Exported to ${displayPath(io.root, file)}.\n`);
    return 0;
  });
}

/** `pnpm study backup`: a copy of the database with VACUUM INTO, safe while it is in use (spec §12). */
function backupCommand(args: string[], io: CliIo): number {
  parsed(() => parseArgs({ args, strict: true, options: {} }));
  return withStudy(io, (study) => {
    const file = backupStudy(study, io.clock.now());
    io.out(`Backed up to ${displayPath(io.root, file)}.\n`);
    return 0;
  });
}

/** `pnpm study rebuild [--check]`: regenerates the cards cache by replay (spec §4), or only compares with --check. */
function rebuildCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() => parseArgs({ args, strict: true, options: { check: { type: "boolean", default: false } } }));
  return withStudy(io, (study) => {
    if (values.check) {
      const stale = staleCards(study.db);
      if (stale.length === 0) {
        io.out(`The cards cache matches a replay (${storedCards(study.db).size} card(s)).\n`);
        return 0;
      }
      io.err(`The cards cache differs from a replay for: ${stale.join(", ")}. Run \`pnpm study rebuild\`.\n`);
      return 1;
    }
    const count = inTransaction(study, (tx) => rebuildAllCards(tx));
    refreshState(study);
    io.out(`Rebuilt ${count} card(s) from the rated attempts.\n`);
    return 0;
  });
}
```

- [ ] **Step 7: Document the commands**

In `README.md`, replace:

```markdown
| `pnpm study status [<id>] [--json]` | Your progress on a problem, an exercise, a concept, or everything |
```

with:

```markdown
| `pnpm study status [<id>] [--json]` | Your progress on a problem, an exercise, a concept, or everything |
| `pnpm today [--json] [--refresh]` | What the coach planned for today: reviews, the next new item, announcements (`--refresh` makes a new plan) |
| `pnpm study start <id>` | Starts a due review from scratch: archives your solution to `history/` and writes a fresh stub |
| `pnpm study pause` / `pnpm study resume` | Pauses the coach (due dates wait for you) and resumes it |
| `pnpm study phase [set <phase>]` | Your phase and its progress; `set` forces one |
| `pnpm study curriculum [set <preset>]` | The presets (`grind-75`, `grind-169`, `neetcode-150`) and how much of each is imported; `set` switches |
| `pnpm study export` / `pnpm study backup` / `pnpm study rebuild [--check]` | A JSON export and a database copy under `.study/exports`; rebuilds the review cache from your attempts |
```

In `CLAUDE.md`, under `## Commands`, add this bullet right after the bullet that starts with ``- `pnpm -s study record hint|give-up|complexity|explanation …` ``:

In `CLAUDE.md`, replace:

```markdown
Run `pnpm -s study curriculum set <preset>` only when the user explicitly asks to switch lists.
```

with:

```markdown
Run `pnpm -s study curriculum set <preset>` only when the user explicitly asks to switch lists.
- `pnpm -s today --json`: today's plan from the study coach (the `coach` skill renders it in Spanish). After showing an announcement in chat, acknowledge it with `pnpm -s study ack <id>`. `pnpm -s study status --json`'s `coach.started` says whether the coach still has to onboard the user. Run `pnpm -s today --json --refresh` only when the user asks for a new plan.
```

- [ ] **Step 8: Run the tests, the type check and the whole suite**

Run: `pnpm vitest run study/tests scripts/tests/claude-layer.test.ts && pnpm exec tsc --noEmit`
Expected: all green (coach-cli.test.ts: 11 tests); `tsc` prints nothing. Then run `pnpm verify`. Do **not** run `pnpm today`, `pnpm study start` or `pnpm study curriculum set` in the real repo: the tests cover them on temp repos, and the real repo must keep no `.study/study.db`.

- [ ] **Step 9: Commit**

```bash
git add study/tests/coach-cli.test.ts study/tests/status.test.ts study/tests/init.test.ts scripts/tests/claude-layer.test.ts study/export.ts study/fsrs.ts study/today.ts study/status.ts study/commands.ts README.md CLAUDE.md
git commit -m "feat(study): add pnpm today and the study commands: ack, start, pause, resume, phase, curriculum, export, backup, rebuild"
```


## Milestone M7: the playground's Today section and Start review

### Task 12: The playground API: today, start, ack, pause, resume, and the gate on each target

**Files:**
- Create: `playground/server/study.ts`
- Modify: `playground/server/app.ts`, `playground/server/types.ts`, `playground/server/targets.ts`
- Modify test: `playground/tests/web/work-header.test.tsx` (its `TargetData` fixture gains the two new fields)
- Test: `playground/tests/server/study.test.ts` (create)

**Interfaces:**
- Consumes: `today`, `notInitialized`, `ackAnnouncement` (Task 9); `startAttempt`, `startGate` (Task 10); `pauseStudy`, `resumeStudy` (Task 6); Plan A's `cachedStudy`, `envClock`, `findTarget`, `unknownTarget`, `valid`, `loadProgress`, `itemView`, `makeRepo` (the Task 18 helper, which initializes `.study` and seeds lc-0001 as solved) and `call`.
- Produces:
  - **Routes** (spec §10), mounted under `/api`:
    - `GET /api/study/today` → `200 TodayJson` for the **ui** surface, or `200 NotInitializedJson`;
    - `POST /api/study/start/:id{.+}` with `{ lang: "py" | "ts" }` → `200 { kind }`; `409 { error }` when an attempt is open or the item was never tried; `404` for an unknown id; `422` for a broken `cases.json`. The `{.+}` pattern lets exercise ids keep their slash (`/api/study/start/hash-map/01`), and Hono's typed client sends them unencoded (verified);
    - `POST /api/study/ack/:id{[0-9]+}` → `200 { acked }`, `404` for an unknown announcement;
    - `POST /api/study/pause` → `200 { since }`; `POST /api/study/resume` → `200 { resumed }`.
    - Without a study database the write routes answer `409 { error }`.
  - The time comes from `envClock()` (`ALGO_STUDY_NOW` in tests), passed to the engine as `now`; the handle from `cachedStudy` (kept on `globalThis` across Vite's re-evaluations, Plan A Task 3).
  - `TargetData` gains `gate: { kind: "review" | "exam" | "retry"; minutes } | null` and `freshStart: boolean` (an attempt started from scratch is open: the editor must not offer "Keep mine").
  - `playground/server/types.ts` re-exports the types `TodayJson`, `TodayItem`, `AnnouncementJson`, `NotInitializedJson` for the web.
- The hook (Plan A Task 8) already denies Claude `/api/study/start|pause|resume` in `PLAYGROUND_FILES`.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `playground/tests/server/study.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { fixedClock } from "../../../study/clock.ts";
import { recordWork } from "../../../study/record.ts";
import { openStudy } from "../../../study/store.ts";
import { setCurriculum } from "../../../study/switch.ts";
import { pendingAnnouncements } from "../../../study/today.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, PY_SUM, removeRepos } from "./helpers.ts";

afterEach(() => {
  removeRepos();
  vi.unstubAllEnvs();
});

// See targets.test.ts: Response.json() is Promise<unknown> under the root tsconfig.
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

const NOW = "2026-11-04T14:00:00.000Z";
const PRESET = [
  "id: server-list",
  "phases:",
  "  bases: { concepts: [hash-map] }",
  "  learn: { list: server-list, size: 2, block: 3, mix_after_block: 3 }",
  "  master: { list: server-list, first_try_success: 0.8 }",
  "  expand: { choose_from: [server-list], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }",
  "  pro: { tracks: [interview] }",
  "patterns:",
  "  - { pattern: arrays-hashing, concept: hash-map }",
  "  - { pattern: stack, concept: stack }",
  "timebox_minutes: { easy: 15, medium: 35, hard: 50 }",
  "",
].join("\n");

/** makeRepo's two problems in a list with a preset; the coach started 30 days before NOW, when lc-0020 was solved. */
function coachRepo(): string {
  const root = makeRepo();
  for (const rel of ["problems/lc-0001-two-sum/README.md", "problems/lc-0020-valid-parentheses/README.md"]) {
    put(root, rel, readFileSync(path.join(root, rel), "utf8").replace(/^concepts: (.*)$/m, "concepts: $1\nlists: [server-list]"));
  }
  put(root, "curriculum/server-list.yaml", PRESET);
  const study = openStudy(root, { clock: fixedClock("2026-10-05T14:00:00.000Z") });
  setCurriculum(study, root, "server-list", study.clock.now());
  put(root, ".study/solutions/problems/lc-0020/solution.py", PY_SUM);
  recordWork(study, "lc-0020", { type: "run", lang: "py", green: true }, "cli");
  study.close();
  vi.stubEnv("ALGO_STUDY_NOW", NOW);
  return root;
}

describe("GET /api/study/today", () => {
  it("says what to run before the study database exists", async () => {
    const { status, body } = await json(await call(createApp({ root: makeRepo({ study: false }) }), "/api/study/today"));
    expect(status).toBe(200);
    expect(body).toEqual({ initialized: false, next: "init" });
  });

  it("returns the plan and the announcements the playground has not acknowledged", async () => {
    const root = coachRepo();
    const app = createApp({ root });
    const { body } = await json(await call(app, "/api/study/today"));
    expect(body).toMatchObject({
      started: true,
      date: "2026-11-04",
      phase: { id: "bases", preset: "server-list" },
      // Nothing was recorded for 30 days: return mode, with its welcome.
      mode: "return",
      announcements: [
        { id: 1, key: "coach-started", payload: { preset: "server-list", phase: "bases" } },
        { id: 2, key: "welcome-back", payload: { date: "2026-11-04", daysAway: 30 } },
      ],
      items: [
        { kind: "review", id: "lc-0020", title: "Valid Parentheses" },
        { kind: "concept", id: "hash-map", title: "Hash map" },
      ],
    });
  });
});

describe("POST /api/study/ack/:id", () => {
  it("acknowledges an announcement for the playground only", async () => {
    const root = coachRepo();
    const app = createApp({ root });
    expect(await json(await call(app, "/api/study/ack/1", { json: {} }))).toEqual({ status: 200, body: { acked: true } });
    expect(await json(await call(app, "/api/study/ack/1", { json: {} }))).toEqual({ status: 200, body: { acked: false } });
    expect((await call(app, "/api/study/ack/9", { json: {} })).status).toBe(404);
    expect((await json(await call(app, "/api/study/today"))).body.announcements.map((a: { key: string }) => a.key)).toEqual(["welcome-back"]);
    const study = openStudy(root);
    expect(pendingAnnouncements(study.db, "chat").map((a) => a.key)).toEqual(["coach-started", "welcome-back"]);
    study.close();
  });
});

describe("POST /api/study/pause and /resume", () => {
  it("pauses and resumes, and the plan waits meanwhile", async () => {
    const app = createApp({ root: coachRepo() });
    expect(await json(await call(app, "/api/study/pause", { json: {} }))).toEqual({ status: 200, body: { since: NOW } });
    expect((await json(await call(app, "/api/study/today"))).body).toMatchObject({ paused: { since: NOW }, items: [] });
    expect(await json(await call(app, "/api/study/resume", { json: {} }))).toEqual({ status: 200, body: { resumed: true } });
    expect((await json(await call(app, "/api/study/today"))).body.paused).toBeNull();
  });

  it("answer 409 before the study database exists", async () => {
    const app = createApp({ root: makeRepo({ study: false }) });
    expect((await call(app, "/api/study/pause", { json: {} })).status).toBe(409);
  });
});

describe("POST /api/study/start/:id", () => {
  it("shows the gate for a due review, archives the solution, writes a stub, and opens the attempt", async () => {
    const root = coachRepo();
    const app = createApp({ root });
    expect((await json(await call(app, "/api/target?id=lc-0020"))).body).toMatchObject({ gate: { kind: "review", minutes: 9 }, freshStart: false });
    const started = await json(await call(app, "/api/study/start/lc-0020", { json: { lang: "py" } }));
    expect(started).toEqual({ status: 200, body: { kind: "review" } });
    const history = path.join(root, ".study/solutions/problems/lc-0020/history");
    expect(readdirSync(history)).toEqual(["2026-11-04T14-00-00-000Z.py"]);
    expect(readFileSync(path.join(history, "2026-11-04T14-00-00-000Z.py"), "utf8")).toBe(PY_SUM);
    expect(readFileSync(path.join(root, ".study/solutions/problems/lc-0020/solution.py"), "utf8")).toContain("def solve(self, nums: list[int]) -> int:");
    expect((await json(await call(app, "/api/target?id=lc-0020"))).body).toMatchObject({ gate: null, freshStart: true, status: "solving" });
    expect(await json(await call(app, "/api/study/start/lc-0020", { json: { lang: "py" } }))).toMatchObject({ status: 409 });
  });

  it("refuses an exercise that was never tried (ids with a slash work), and an unknown id", async () => {
    const app = createApp({ root: coachRepo() });
    expect(await json(await call(app, "/api/study/start/hash-map/01", { json: { lang: "py" } }))).toEqual({
      status: 409,
      body: { error: "hash-map/01 was never tried: its first attempt starts with your first edit or run." },
    });
    expect((await call(app, "/api/study/start/lc-9999", { json: { lang: "py" } })).status).toBe(404);
    expect(existsSync(path.join(makeRepo({ study: false }), ".study"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run playground/tests/server/study.test.ts`
Expected: FAIL. The routes answer 404, and targets have no `gate`.

- [ ] **Step 3: The routes**

Create `playground/server/study.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import { CaseFileError } from "../../runner/src/schema.ts";
import { envClock } from "../../study/clock.ts";
import { pauseStudy, resumeStudy } from "../../study/pause.ts";
import { startAttempt } from "../../study/start.ts";
import { cachedStudy } from "../../study/store.ts";
import { ackAnnouncement, notInitialized, today } from "../../study/today.ts";
import { findTarget, unknownTarget } from "./targets.ts";
import { valid } from "./validate.ts";

const NO_STUDY = { error: "There is no study database yet: run `pnpm study init` (a fresh clone) or `pnpm study migrate` (this repo)." };

/**
 * The Today section's API (study coach spec §10). The time comes from envClock (ALGO_STUDY_NOW in tests), and
 * the database handle from cachedStudy (the Vite dev server re-evaluates this module).
 * Claude never calls start, pause or resume: the hook denies these routes (spec §10).
 */
export function studyRoutes(root: string) {
  return new Hono()
    .get("/study/today", (c) => {
      const study = cachedStudy(root);
      return c.json(study ? today(study, root, { surface: "ui", now: envClock().now() }) : notInitialized(root), 200);
    })
    .post("/study/start/:id{.+}", valid("json", z.object({ lang: z.enum(["py", "ts"]) })), (c) => {
      const id = c.req.param("id");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      try {
        const result = startAttempt(study, root, target, envClock().now(), { lang: c.req.valid("json").lang });
        if (result.started) return c.json({ kind: result.kind }, 200);
        const reason = result.reason === "open" ? `${id} already has an open attempt.` : `${id} was never tried: its first attempt starts with your first edit or run.`;
        return c.json({ error: reason }, 409);
      } catch (error) {
        if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
        throw error;
      }
    })
    .post("/study/ack/:id{[0-9]+}", (c) => {
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      const id = Number(c.req.param("id"));
      const result = ackAnnouncement(study, id, "ui", envClock().now());
      if (result === "unknown") return c.json({ error: `There is no announcement ${id}.` }, 404);
      return c.json({ acked: result === "acked" }, 200);
    })
    .post("/study/pause", (c) => {
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      return c.json({ since: pauseStudy(study, envClock().now()).since.toISOString() }, 200);
    })
    .post("/study/resume", (c) => {
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      return c.json({ resumed: resumeStudy(study, envClock().now()).resumed }, 200);
    });
}
```

1. In `playground/server/app.ts`, replace:

```ts
import { solutionRoutes } from "./solutions.ts";
```

with:

```ts
import { solutionRoutes } from "./solutions.ts";
import { studyRoutes } from "./study.ts";
```

2. In `playground/server/app.ts`, replace:

```ts
    .route("/api", conceptRoutes(ctx.root))
```

with:

```ts
    .route("/api", conceptRoutes(ctx.root))
    .route("/api", studyRoutes(ctx.root))
```

- [ ] **Step 4: The gate on each target**

1. In `playground/server/types.ts`, replace:

```ts
  solutions: Record<Lang, boolean>;
}
```

with:

```ts
  solutions: Record<Lang, boolean>;
  /**
   * "Start review" (study coach spec §7): the editor stays closed until the user starts the attempt from scratch;
   * null when it opens as usual.
   */
  gate: { kind: "review" | "exam" | "retry"; minutes: number } | null;
  /** An attempt started from scratch is open (a review, an exam, a retry): "Keep mine" would bring the old code back. */
  freshStart: boolean;
}
```

2. In `playground/server/types.ts`, replace:

```ts
export type RepoEvent =
```

with:

```ts
export type { AnnouncementJson, NotInitializedJson, TodayItem, TodayJson } from "../../study/today.ts";

export type RepoEvent =
```

1. In `playground/server/targets.ts`, replace:

```ts
import { cachedStudy, type Study } from "../../study/store.ts";
```

with:

```ts
import { envClock } from "../../study/clock.ts";
import { startGate } from "../../study/start.ts";
import { cachedStudy, type Study } from "../../study/store.ts";
```

2. In `playground/server/targets.ts`, replace:

```ts
  const view: ItemView = entry ? itemView(entry, loadProgress(root)) : { status: "todo", inProgress: false, hints: 0 };
```

with:

```ts
  const progress = loadProgress(root);
  const view: ItemView = entry ? itemView(entry, progress) : { status: "todo", inProgress: false, hints: 0 };
  const item = progress?.items.get(target.id);
  const gate = progress ? startGate(progress.study, root, target.id, envClock().now()) : null;
```

3. In `playground/server/targets.ts`, replace:

```ts
    solutions: { py: existsSync(solutionPath(target, "py")), ts: existsSync(solutionPath(target, "ts")) },
  };
```

with:

```ts
    solutions: { py: existsSync(solutionPath(target, "py")), ts: existsSync(solutionPath(target, "ts")) },
    gate: gate ? { kind: gate.kind, minutes: gate.minutes } : null,
    freshStart: item?.open != null && (item.everGreen || item.revealed),
  };
```

The web test's `TargetData` fixture needs the two fields:

In `playground/tests/web/work-header.test.tsx`, replace:

```tsx
  solutions: { py: true, ts: false },
  ...extra,
```

with:

```tsx
  solutions: { py: true, ts: false },
  gate: null,
  freshStart: false,
  ...extra,
```

- [ ] **Step 5: Run the tests and the type checks**

Run: `pnpm vitest run playground/tests/server && pnpm exec tsc -p playground && pnpm exec tsc --noEmit`
Expected: all green (study.test.ts: 7 tests); both `tsc` runs print nothing.

- [ ] **Step 6: Commit**

```bash
git add playground/tests/server/study.test.ts playground/server/study.ts playground/server/app.ts playground/server/types.ts playground/server/targets.ts playground/tests/web/work-header.test.tsx
git commit -m "feat(playground): serve today's plan, Start review, acknowledgments and the pause over the API"
```


### Task 13: The Today section replaces Continue on the home page

**Files:**
- Modify: `playground/web/api.ts`, `playground/web/events.tsx`, `playground/web/lib/labels.ts`
- Create: `playground/web/home/TodaySection.tsx`
- Modify: `playground/web/routes/home.tsx`, `playground/web/home/model.ts`
- Delete: `playground/web/home/ContinueCards.tsx`
- Modify tests: `playground/tests/web/home.test.tsx`, `playground/tests/web/home-model.test.ts`
- Test: `playground/tests/web/today-section.test.tsx` (create)

**Interfaces:**
- Consumes: the routes and types of Task 12; Plan A Task 7's `keys.targets`, `keys.concepts` and the `progress` branch in `events.tsx`; the existing shadcn pieces (`Alert`, `Badge`, `Button`, `Skeleton`), `SectionTitle`, `targetLink`, TanStack Query and Router, lucide icons.
- Produces:
  - `playground/web/api.ts`: `type TodayData = TodayJson | NotInitializedJson`; `getToday()`, `startReview(id, lang): Promise<{ kind }>`, `ackAnnouncement(id)`, `pauseStudy()`, `resumeStudy()`; `keys.today = ["today"]`; `todayQuery()`.
  - `playground/web/lib/labels.ts`: `PHASE_LABELS`, `phaseLabel(phase)`; `LIST_LABELS` gains `grind-169` and `neetcode-150`.
  - `playground/web/home/TodaySection.tsx`: `TodayView({ data, onAck, onPause, onResume, busy })` (pure), `TodaySection()` (query and mutations), `announcementText(announcement)`, `reasonText(reason)`.
  - `HomeView` gains an optional `today?: ReactNode`, rendered where Continue was; `HomePage` passes `<TodaySection />`. `ContinueCards`, `ContinueItem` and `continueItems` are gone (spec §10: Today replaces Continue).
- **The section (spec §11):** a region "Today" with: one banner per announcement the playground has not acknowledged (`role="status"`, a "Got it" button); the phase and its progress, a mode badge (Welcome back, Catch-up day), the planned minutes over the budget, and a Pause / Resume button; a warning for a partially imported list and for a missing expansion choice; the rows (`list` "Today's plan"): kind, id, title, reason with pattern names, minutes, a done mark. Problems and exercises link to their page (a review or exam row leads to the Start review gate there); a concept links to its page, or says to ask Claude when the note does not exist yet. Before the database exists it says which command to run; before the coach starts, how to start it. It refetches on the live `progress` event and after each of its own requests.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

Create `playground/tests/web/today-section.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TodayJson } from "../../server/types.ts";
import { announcementText, reasonText, TodaySection, TodayView } from "../../web/home/TodaySection.tsx";
import { renderWithRouter } from "./render.tsx";

const PLAN: TodayJson = {
  initialized: true,
  started: true,
  date: "2026-10-05",
  paused: null,
  phase: { id: "learn", since: "2026-10-01T14:00:00.000Z", preset: "grind-75", progress: { done: 12, total: 75 }, list: { list: "grind-75", imported: 75, size: 75 }, expansion: null },
  announcements: [{ id: 3, key: "phase-advanced", at: "2026-10-05T14:00:00.000Z", payload: { from: "bases", to: "learn" } }],
  mode: "normal",
  items: [
    { kind: "continue", id: "hash-map/01", title: "First repeat", minutes: 15, reason: "in progress · hash-map", done: false, missing: false },
    { kind: "review", id: "lc-0020", title: "Valid Parentheses", minutes: 9, reason: "due 2 days ago", done: true, missing: false },
    { kind: "new", id: "lc-0001", title: "Two Sum", minutes: 15, reason: "block 1/3 · arrays-hashing", done: false, missing: false },
    { kind: "concept", id: "two-pointers", title: "Two pointers", minutes: 20, reason: "opens two-pointers", done: false, missing: false },
    { kind: "concept", id: "string-parsing", title: "string-parsing", minutes: 20, reason: "opens strings", done: false, missing: true },
  ],
  backlog: { waiting: 4, days: 2 },
  budget: { minutes: 45, planned: 79 },
};

const noop = { onAck: () => {}, onPause: () => {}, onResume: () => {}, busy: false };
const region = () => screen.getByRole("region", { name: "Today" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TodayView (spec §11)", () => {
  it("lists today's items as links to where they are worked, with their kind, reason and minutes", async () => {
    await renderWithRouter(<TodayView data={PLAN} {...noop} />);
    const plan = within(region()).getByRole("list", { name: "Today's plan" });
    const rows = within(plan).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Continuehash-map/01First repeatin progress · hash-map15 min",
      "Reviewlc-0020Valid Parenthesesdue 2 days ago9 min",
      "Newlc-0001Two Sumblock 1/3 · Arrays & hashing15 min",
      "ConceptTwo pointersopens Two pointers20 min",
      "Conceptstring-parsing · not in the repo yet: ask Claude to create itopens Strings20 min",
    ]);
    expect(within(plan).getByRole("link", { name: "hash-map/01 First repeat" })).toHaveAttribute("href", "/e/hash-map/01");
    expect(within(plan).getByRole("link", { name: "lc-0020 Valid Parentheses" })).toHaveAttribute("href", "/p/lc-0020");
    expect(within(plan).getByRole("link", { name: "two-pointers Two pointers" })).toHaveAttribute("href", "/c/two-pointers");
    expect(within(plan).queryByRole("link", { name: /string-parsing/ })).not.toBeInTheDocument();
    expect(within(rows[1]).getByRole("img", { name: "Done" })).toBeInTheDocument();
    expect(within(region()).getByText("Phase 1 · Learn the list · 12/75")).toBeInTheDocument();
    expect(within(region()).getByText("4 more review(s) wait for the coming days (about 2 day(s)).")).toBeInTheDocument();
  });

  it("shows each announcement once until acknowledged", async () => {
    const onAck = vi.fn();
    await renderWithRouter(<TodayView data={PLAN} {...noop} onAck={onAck} />);
    const banner = within(region()).getByRole("status");
    expect(banner).toHaveTextContent("New phase: 1 · Learn the list. You finished 0 · Bases.");
    await userEvent.click(within(banner).getByRole("button", { name: "Got it" }));
    expect(onAck).toHaveBeenCalledWith(3);
  });

  it("pauses, and while paused says so and offers to resume", async () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const { unmount } = await renderWithRouter(<TodayView data={PLAN} {...noop} onPause={onPause} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalled();
    unmount();
    await renderWithRouter(<TodayView data={{ ...PLAN, paused: { since: "2026-10-05T14:00:00.000Z" }, items: [] }} {...noop} onResume={onResume} />);
    expect(screen.getByText(/^Paused since/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(onResume).toHaveBeenCalled();
  });

  it("says what to run before the store exists, and before the coach starts", async () => {
    const { unmount } = await renderWithRouter(<TodayView data={{ initialized: false, next: "migrate" }} {...noop} />);
    expect(region()).toHaveTextContent("Your progress is not set up yet. Run pnpm study migrate");
    unmount();
    await renderWithRouter(<TodayView data={{ ...PLAN, started: false, phase: null, announcements: [], items: [] }} {...noop} />);
    expect(region()).toHaveTextContent("The coach has not started yet.");
  });

  it("warns about a partially imported list and a missing expansion choice", async () => {
    await renderWithRouter(
      <TodayView
        data={{ ...PLAN, phase: { ...PLAN.phase!, id: "expand", list: { list: "grind-169", imported: 100, size: 169 }, expansion: { list: null, choices: ["grind-169"] } } }}
        {...noop}
      />,
    );
    expect(region()).toHaveTextContent("Only 100 of the 169 problems of Grind 169 are imported.");
    expect(region()).toHaveTextContent("Choose the list to expand with: ask Claude.");
  });

  it("words announcements and reasons for people", () => {
    expect(announcementText({ id: 1, key: "welcome-back", at: "", payload: { date: "2026-10-05", daysAway: 9 } })).toBe(
      "Welcome back after 9 days! Today starts with the reviews you are most likely to remember.",
    );
    expect(announcementText({ id: 2, key: "curriculum-switched", at: "", payload: { from: { preset: "grind-75", phase: "master" }, to: { preset: "grind-169", phase: "learn" } } })).toBe(
      "Switched to Grind 169: phase 1 · Learn the list.",
    );
    expect(reasonText("mix · dp-1d")).toBe("mix · 1-D DP");
  });
});

describe("TodaySection", () => {
  it("loads today's plan and acknowledges an announcement through the API", async () => {
    let acked = false;
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(`${init?.method ?? "GET"} ${new URL(url, "http://localhost").pathname}`);
      if (url.includes("/api/study/ack/3")) {
        acked = true;
        return Response.json({ acked: true });
      }
      return Response.json(acked ? { ...PLAN, announcements: [] } : PLAN);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await renderWithRouter(
      <QueryClientProvider client={client}>
        <TodaySection />
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(calls).toEqual(["GET /api/study/today", "POST /api/study/ack/3", "GET /api/study/today"]);
  });
});
```

The home tests lose the Continue cards:

1. In `playground/tests/web/home.test.tsx`, replace:

```tsx
  it("shows the work in progress as cards, the overall progress, the problems by pattern, and the concepts", async () => {
    await renderWithRouter(<Harness />);
    const progress = screen.getByRole("region", { name: "Continue" });
    expect(within(progress).getByRole("link", { name: "lc-0026 Remove Duplicates" })).toHaveAttribute("href", "/p/lc-0026");
    expect(within(progress).getByRole("link", { name: "hash-map/02 Most frequent" })).toHaveAttribute("href", "/e/hash-map/02");
    expect(screen.getByText("1/3 solved")).toBeInTheDocument();
```

with:

```tsx
  it("shows the overall progress, the problems by pattern, and the concepts, and no Continue cards (Today replaces them)", async () => {
    await renderWithRouter(<Harness />);
    expect(screen.queryByRole("region", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.getByText("1/3 solved")).toBeInTheDocument();
```

2. In `playground/tests/web/home.test.tsx`, replace:

```tsx
    expect(screen.queryByRole("region", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hash map" })).not.toBeInTheDocument();
```

with:

```tsx
    expect(screen.queryByRole("link", { name: "Hash map" })).not.toBeInTheDocument();
```

1. In `playground/tests/web/home-model.test.ts`, replace:

```ts
  conceptRows,
  continueItems,
  facetOptions,
```

with:

```ts
  conceptRows,
  facetOptions,
```

2. In `playground/tests/web/home-model.test.ts`, delete these lines:

```ts
  it("lists the work in progress to continue, problems first, with where each one belongs", () => {
    expect(continueItems(DATA, "").map((item) => [item.id, item.context])).toEqual([
      ["lc-2181", "Linked list"],
      ["lc-0035", "Binary search"],
      ["hash-map/02", "Hash map"],
    ]);
    expect(continueItems(DATA, "most").map((item) => item.id)).toEqual(["hash-map/02"]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project web playground/tests/web/today-section.test.tsx playground/tests/web/home.test.tsx playground/tests/web/home-model.test.ts`
Expected: FAIL. `TodaySection.tsx` does not exist, and the home page still shows Continue.

- [ ] **Step 3: The API calls, the query key and the labels**

1. In `playground/web/api.ts`, replace:

```ts
import type { ConceptData, HomeData, SolutionData, TargetData } from "../server/types.ts";
```

with:

```ts
import type { ConceptData, HomeData, NotInitializedJson, SolutionData, TargetData, TodayJson } from "../server/types.ts";
```

2. In `playground/web/api.ts`, replace:

```ts
export const keys = {
```

with:

```ts
/** The Today section's data: the plan, or what to run before the study database exists. */
export type TodayData = TodayJson | NotInitializedJson;

export async function getToday(): Promise<TodayData> {
  const res = await client.api.study.today.$get();
  if (!res.ok) return fail(res);
  return res.json();
}

/** "Start review" (study coach spec §7): the server archives the solution, writes a fresh stub and opens the attempt. */
export async function startReview(id: string, lang: Lang): Promise<{ kind: string }> {
  const res = await client.api.study.start[":id{.+}"].$post({ param: { id }, json: { lang } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function ackAnnouncement(id: number): Promise<void> {
  const res = await client.api.study.ack[":id{[0-9]+}"].$post({ param: { id: String(id) } });
  if (!res.ok) return fail(res);
}

export async function pauseStudy(): Promise<void> {
  const res = await client.api.study.pause.$post();
  if (!res.ok) return fail(res);
}

export async function resumeStudy(): Promise<void> {
  const res = await client.api.study.resume.$post();
  if (!res.ok) return fail(res);
}

export const keys = {
```

3. In `playground/web/api.ts`, replace:

```ts
  concepts: ["concept"] as const,
};
```

with:

```ts
  concepts: ["concept"] as const,
  today: ["today"] as const,
};
```

4. In `playground/web/api.ts`, replace:

```ts
export const conceptQuery = (slug: string) => queryOptions({ queryKey: keys.concept(slug), queryFn: () => getConcept(slug) });
```

with:

```ts
export const conceptQuery = (slug: string) => queryOptions({ queryKey: keys.concept(slug), queryFn: () => getConcept(slug) });
export const todayQuery = () => queryOptions({ queryKey: keys.today, queryFn: getToday });
```

Refetch today's plan on the live `progress` event (Plan A Task 7 added the branch):

In `playground/web/events.tsx`, replace:

```tsx
          void queryClient.invalidateQueries({ queryKey: keys.concepts });
        }
```

with:

```tsx
          void queryClient.invalidateQueries({ queryKey: keys.concepts });
          void queryClient.invalidateQueries({ queryKey: keys.today });
        }
```

1. In `playground/web/lib/labels.ts`, replace:

```ts
export const LIST_LABELS: Readonly<Record<string, string>> = { "grind-75": "Grind 75" };
```

with:

```ts
export const LIST_LABELS: Readonly<Record<string, string>> = { "grind-75": "Grind 75", "grind-169": "Grind 169", "neetcode-150": "NeetCode 150" };
```

2. In `playground/web/lib/labels.ts`, replace:

```ts
/** LeetCode's problem number from an id like "lc-0035", or null for any other id. */
```

with:

```ts
/** The study coach's phases (spec §1), numbered as the coach says them. */
export const PHASE_LABELS: Readonly<Record<string, string>> = {
  bases: "0 · Bases",
  learn: "1 · Learn the list",
  master: "2 · Master the list",
  expand: "3 · Expand",
  pro: "4 · Pro",
};

export function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? prettifySlug(phase);
}

/** LeetCode's problem number from an id like "lc-0035", or null for any other id. */
```

- [ ] **Step 4: The section**

Create `playground/web/home/TodaySection.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Circle, CircleCheck, Megaphone, Pause, Play, TriangleAlert } from "lucide-react";
import type { AnnouncementJson, TodayItem, TodayJson } from "../../server/types.ts";
import { ackAnnouncement, keys, pauseStudy, resumeStudy, type TodayData, todayQuery } from "../api.ts";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { listLabel, PATTERN_LABELS, phaseLabel } from "../lib/labels.ts";
import { targetLink } from "../links.ts";
import { SectionTitle } from "./SectionTitle.tsx";

const KIND_LABEL: Record<TodayItem["kind"], string> = { continue: "Continue", review: "Review", new: "New", concept: "Concept", exam: "Exam" };
const MODE_LABEL: Record<TodayJson["mode"], string | null> = { normal: null, return: "Welcome back", "catch-up": "Catch-up day" };

/** The announcement as one sentence (spec §6.1: the message is rendered from the rows it references). */
export function announcementText(announcement: AnnouncementJson): string {
  const p = announcement.payload as Record<string, unknown>;
  const phase = (value: unknown) => phaseLabel(String(value));
  switch (announcement.key) {
    case "coach-started":
      return `The coach started you on ${listLabel(String(p.preset))}, at phase ${phase(p.phase)}.`;
    case "phase-advanced":
      return `New phase: ${phase(p.to)}. You finished ${phase(p.from)}.`;
    case "phase-set":
      return `Phase set to ${phase(p.to)}.`;
    case "curriculum-switched": {
      const to = p.to as { preset: string; phase: string };
      return `Switched to ${listLabel(to.preset)}: phase ${phase(to.phase)}.`;
    }
    case "welcome-back":
      return `Welcome back after ${String(p.daysAway)} days! Today starts with the reviews you are most likely to remember.`;
  }
}

/** The engine's reason with pattern slugs as their names: "block 2/3 · arrays-hashing" → "block 2/3 · Arrays & hashing". */
export function reasonText(reason: string): string {
  return reason.replace(/[a-z0-9]+(?:-[a-z0-9]+)*/g, (word) => PATTERN_LABELS[word] ?? word);
}

function AnnouncementBanner({ announcement, onAck, busy }: { announcement: AnnouncementJson; onAck(id: number): void; busy: boolean }) {
  return (
    <Alert variant="success" role="status" className="mb-2">
      <Megaphone aria-hidden />
      <AlertDescription className="flex items-center gap-2">
        <span className="flex-1 text-foreground">{announcementText(announcement)}</span>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAck(announcement.id)}>
          Got it
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Where a row leads: problems and exercises to their page (reviews and exams show the Start review gate there). */
function ItemTitle({ item }: { item: TodayItem }) {
  const label = `${item.id} ${item.title}`;
  if (item.missing) {
    return (
      <span className="font-medium">
        {item.title} <span className="font-normal text-muted-foreground">· not in the repo yet: ask Claude to create it</span>
      </span>
    );
  }
  if (item.kind === "concept") {
    return (
      <Link to="/c/$slug" params={{ slug: item.id }} aria-label={label} className="font-medium hover:text-primary">
        {item.title}
      </Link>
    );
  }
  return (
    <Link {...targetLink(item.id)} aria-label={label} className="font-medium hover:text-primary">
      {item.title}
    </Link>
  );
}

function TodayRow({ item }: { item: TodayItem }) {
  const Done = item.done ? CircleCheck : item.kind === "concept" ? BookOpen : Circle;
  return (
    <li className="flex items-center gap-3 border-b py-1.5 last:border-b-0">
      <span role="img" aria-label={item.done ? "Done" : "To do"} className={item.done ? "text-success" : "text-muted-foreground"}>
        <Done aria-hidden className="size-4" />
      </span>
      <Badge variant={item.kind === "review" || item.kind === "exam" ? "warning" : "outline"} className="w-16">
        {KIND_LABEL[item.kind]}
      </Badge>
      <span className="font-mono text-xs text-muted-foreground">{item.kind === "concept" ? "" : item.id}</span>
      <ItemTitle item={item} />
      <span className="ml-auto text-xs text-muted-foreground">{reasonText(item.reason)}</span>
      <span className="w-14 text-right font-mono text-xs text-muted-foreground">{item.minutes} min</span>
    </li>
  );
}

export interface TodayViewProps {
  data: TodayData;
  onAck(id: number): void;
  onPause(): void;
  onResume(): void;
  /** A request is on its way: the buttons wait. */
  busy: boolean;
}

/** The Today section (spec §11): what the coach planned for today, its announcements, and the pause button. */
export function TodayView({ data, onAck, onPause, onResume, busy }: TodayViewProps) {
  let body;
  if (!data.initialized) {
    body = (
      <p className="text-muted-foreground">
        Your progress is not set up yet. Run <code>{data.next === "migrate" ? "pnpm study migrate" : "pnpm study init"}</code>
        {data.next === "migrate" ? " (try --dry-run first) to move the progress in your READMEs to .study/." : ", then ask Claude “¿qué me toca hoy?”."}
      </p>
    );
  } else if (!data.started) {
    body = (
      <p className="text-muted-foreground">
        The coach has not started yet. Ask Claude “¿qué me toca hoy?”, or run <code>pnpm study curriculum set grind-75</code>.
      </p>
    );
  } else {
    const phase = data.phase!;
    const mode = MODE_LABEL[data.mode];
    const partial = phase.list && phase.list.size !== null && phase.list.imported < phase.list.size;
    body = (
      <>
        {data.announcements.map((announcement) => (
          <AnnouncementBanner key={announcement.id} announcement={announcement} onAck={onAck} busy={busy} />
        ))}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Phase {phaseLabel(phase.id)} · {phase.progress.done}/{phase.progress.total}
          </span>
          {mode && <Badge variant="secondary">{mode}</Badge>}
          <span className="ml-auto">
            {data.budget.planned} of {data.budget.minutes} min
          </span>
          {data.paused ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onResume}>
              <Play aria-hidden />
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onPause}>
              <Pause aria-hidden />
              Pause
            </Button>
          )}
        </div>
        {partial && (
          <Alert variant="warning" className="mb-2">
            <TriangleAlert aria-hidden />
            <AlertDescription>
              Only {phase.list!.imported} of the {phase.list!.size} problems of {listLabel(phase.list!.list)} are imported.
            </AlertDescription>
          </Alert>
        )}
        {phase.expansion && phase.expansion.list === null && (
          <p className="mb-2 text-muted-foreground">Choose the list to expand with: ask Claude. Until then, only reviews are planned.</p>
        )}
        {data.paused ? (
          <p className="text-muted-foreground">Paused since {new Date(data.paused.since).toLocaleDateString()}. Due dates wait for you.</p>
        ) : data.items.length === 0 ? (
          <p className="text-muted-foreground">Nothing planned for today.</p>
        ) : (
          <ul aria-label="Today's plan" className="rounded-lg border bg-card px-3">
            {data.items.map((item) => (
              <TodayRow key={`${item.kind}:${item.id}`} item={item} />
            ))}
          </ul>
        )}
        {data.backlog.waiting > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {data.backlog.waiting} more review(s) wait for the coming days (about {data.backlog.days} day(s)).
          </p>
        )}
      </>
    );
  }
  return (
    <section aria-labelledby="home-today" className="mb-8">
      <SectionTitle id="home-today">Today</SectionTitle>
      {body}
    </section>
  );
}

/** TodayView with its data and buttons; it refetches on the live `progress` event (events.tsx). */
export function TodaySection() {
  const today = useQuery(todayQuery());
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: keys.today });
  const ack = useMutation({ mutationFn: ackAnnouncement, onSettled: refresh });
  const pause = useMutation({ mutationFn: pauseStudy, onSettled: refresh });
  const resume = useMutation({ mutationFn: resumeStudy, onSettled: refresh });
  if (today.isPending) return <Skeleton aria-label="Loading today" className="mb-8 h-24" />;
  if (today.isError) {
    return (
      <Alert variant="destructive" className="mb-8">
        <TriangleAlert aria-hidden />
        <AlertTitle>Could not load today's plan</AlertTitle>
        <AlertDescription>{today.error.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <TodayView
      data={today.data}
      busy={ack.isPending || pause.isPending || resume.isPending}
      onAck={(id) => ack.mutate(id)}
      onPause={() => pause.mutate()}
      onResume={() => resume.mutate()}
    />
  );
}
```

- [ ] **Step 5: Put it where Continue was**

1. In `playground/web/routes/home.tsx`, replace:

```tsx
import type { HomeData } from "../../server/types.ts";
```

with:

```tsx
import type { ReactNode } from "react";
import type { HomeData } from "../../server/types.ts";
```

2. In `playground/web/routes/home.tsx`, delete these lines:

```tsx
import { ContinueCards } from "../home/ContinueCards.tsx";
```

3. In `playground/web/routes/home.tsx`, replace:

```tsx
import { conceptRows, continueItems, problemList } from "../home/model.ts";
```

with:

```tsx
import { conceptRows, problemList } from "../home/model.ts";
```

4. In `playground/web/routes/home.tsx`, replace:

```tsx
import { SectionTitle } from "../home/SectionTitle.tsx";
```

with:

```tsx
import { SectionTitle } from "../home/SectionTitle.tsx";
import { TodaySection } from "../home/TodaySection.tsx";
```

5. In `playground/web/routes/home.tsx`, replace:

```tsx
  /** Changes part of the view; the page writes it to the URL. */
  onSearch(change: Partial<HomeSearch>): void;
}
```

with:

```tsx
  /** Changes part of the view; the page writes it to the URL. */
  onSearch(change: Partial<HomeSearch>): void;
  /** The Today section (study coach spec §10: it replaces Continue); the page passes TodaySection. */
  today?: ReactNode;
}
```

6. In `playground/web/routes/home.tsx`, replace:

```tsx
export function HomeView({ data, search, onSearch }: HomeViewProps) {
```

with:

```tsx
export function HomeView({ data, search, onSearch, today }: HomeViewProps) {
```

7. In `playground/web/routes/home.tsx`, replace:

```tsx
      <ContinueCards items={continueItems(data, search.q)} />
```

with:

```tsx
      {today}
```

8. In `playground/web/routes/home.tsx`, replace:

```tsx
  return <HomeView data={home.data} search={search} onSearch={onSearch} />;
```

with:

```tsx
  return <HomeView data={home.data} search={search} onSearch={onSearch} today={<TodaySection />} />;
```

1. In `playground/web/home/model.ts`, replace:

```ts
import type { HomeConcept, HomeData, HomeExercise, HomeProblem, ItemStatus } from "../../server/types.ts";
```

with:

```ts
import type { HomeConcept, HomeData, HomeExercise, HomeProblem } from "../../server/types.ts";
```

2. In `playground/web/home/model.ts`, delete these lines:

```ts
export interface ContinueItem {
  id: string;
  title: string;
  status: ItemStatus;
  inProgress: boolean;
  difficulty: string | null;
  /** The first pattern of a problem, or the concept of an exercise. */
  context: string | null;
}

/** Problems, then exercises, that are in progress and match the search box. */
export function continueItems(data: HomeData, q: string): ContinueItem[] {
  const problems = data.problems
    .filter((p) => p.inProgress)
    .map((p) => ({ id: p.id, title: p.title, status: p.status, inProgress: true, difficulty: p.difficulty, context: p.patterns[0] ? patternLabel(p.patterns[0]) : null }));
  const exercises = data.concepts.flatMap((concept) =>
    concept.exercises
      .filter((e) => e.inProgress)
      .map((e) => ({ id: e.id, title: e.title, status: e.status, inProgress: true, difficulty: null, context: concept.title })),
  );
  return [...problems, ...exercises].filter((item) => matchesQuery(item, q));
}
```

```bash
git rm playground/web/home/ContinueCards.tsx
```

- [ ] **Step 6: Run the tests and the type check**

Run: `pnpm vitest run --project web && pnpm exec tsc -p playground`
Expected: every web test passes (today-section.test.tsx: 7 tests); `tsc` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add playground/tests/web/today-section.test.tsx playground/tests/web/home.test.tsx playground/tests/web/home-model.test.ts playground/web/api.ts playground/web/events.tsx playground/web/lib/labels.ts playground/web/home/TodaySection.tsx playground/web/routes/home.tsx playground/web/home/model.ts
git commit -m "feat(playground): show today's plan, its announcements and a pause button on the home page"
```


### Task 14: The Start review gate in the work view, a fresh editor, and no "Keep mine" for a fresh start

**Files:**
- Modify: `playground/web/routes/work.tsx`
- Test: `playground/tests/web/work-gate.test.tsx` (create)

**Interfaces:**
- Consumes: `TargetData.gate`, `TargetData.freshStart` (Task 12); `startReview`, `keys.today` (Task 13); the existing `WorkHeader`, `StatementPane`, `Workspace`, `ConflictAlert`, `useSolutionSync`.
- Produces:
  - `WorkPage` renders `GatedWorkspace` while `target.gate` is set: the header, the statement, and instead of the editor a short text and one button: "Start review" (review), "Start exam" (exam) or "Start again" (retry). The old solution is never loaded there.
  - The button calls `POST /api/study/start/<id>` with the page's language, refetches the target and today's plan, then mounts the normal `Workspace`: a new CodeMirror instance (so an empty undo history) that loads the fresh stub from disk (spec §7: "the editor resets its document and undo history").
  - Once the editor has opened on a page, a gate that appears later (a card falling due at midnight) waits for the next visit: it never closes an editor.
  - `ConflictAlert` takes `onMine: (() => void) | null`; it hides "Keep mine" when the target's `freshStart` is true (spec §7: keep-mine is disabled for that attempt), so another tab cannot write the archived code back.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: Write the failing tests**

They stand in a textarea for CodeMirror, as `concept-page.test.tsx` does, and fake the API with a `fetch` stub.

Create `playground/tests/web/work-gate.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeData, TargetData } from "../../server/types.ts";
import { keys } from "../../web/api.ts";
import { routeTree } from "../../web/router.tsx";

// CodeMirror needs layout APIs that jsdom lacks; a textarea stands in for it here (as in concept-page.test.tsx).
// A fresh CodeMirror instance has an empty undo history: the end-to-end test checks that with the real editor.
vi.mock("../../web/components/CodeEditor.tsx", async () => {
  const { createElement } = await import("react");
  return {
    CodeEditor: ({ value, onChange, ariaLabel }: { value: string; onChange(value: string): void; ariaLabel: string }) =>
      createElement("textarea", { "aria-label": ariaLabel, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) }),
  };
});

const STUB = "class Solution:\n    def isValid(self, s: str) -> bool:\n        raise NotImplementedError\n";

const target = (extra: Partial<TargetData>): TargetData => ({
  id: "lc-0020",
  kind: "problem",
  title: "Valid Parentheses",
  readme: "problems/lc-0020-valid-parentheses/README.md",
  markdown: "# 20. Valid Parentheses\n\nPlaceholder statement.\n",
  readmeError: null,
  difficulty: "easy",
  url: null,
  status: "solved",
  hints: 0,
  signature: null,
  exampleInput: null,
  caseError: null,
  solutions: { py: true, ts: false },
  gate: null,
  freshStart: false,
  ...extra,
});
const HOME: HomeData = { problems: [], groups: [], concepts: [] };

let requests: { method: string; path: string; body: string | null }[] = [];
let started = false;
/** What GET /api/target answers before Start review. */
let before: Partial<TargetData> = { gate: { kind: "review", minutes: 9 } };

beforeEach(() => {
  requests = [];
  started = false;
  before = { gate: { kind: "review", minutes: 9 } };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      requests.push({ method, path: url.pathname, body: typeof init?.body === "string" ? init.body : null });
      if (url.pathname === "/api/study/start/lc-0020") {
        started = true;
        return Response.json({ kind: "review" });
      }
      if (url.pathname === "/api/target") return Response.json(started ? target({ status: "solving", freshStart: true }) : target(before));
      if (url.pathname === "/api/solution" && method === "GET") return Response.json({ code: STUB, version: "stub-v1" });
      // Another tab saved over the file meanwhile.
      if (url.pathname === "/api/solution" && method === "PUT") return Response.json({ code: "# from another tab\n", version: "other-v1" }, { status: 409 });
      return Response.json({ error: "unexpected request" }, { status: 500 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openProblem() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  client.setQueryData(keys.home, HOME);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/p/lc-0020"] }) });
  await act(() => router.load());
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("the Start review gate (spec §7)", () => {
  it("shows the statement and a Start review button instead of the old code, then opens the editor on a fresh stub", async () => {
    await openProblem();
    await screen.findByRole("heading", { name: "Time to review" });
    expect(screen.getByRole("heading", { name: "20. Valid Parentheses" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "solution.py" })).not.toBeInTheDocument();
    expect(requests.some((request) => request.path === "/api/solution")).toBe(false); // the old code is never loaded

    await userEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect(await screen.findByRole("textbox", { name: "solution.py" })).toHaveValue(STUB);
    expect(requests.find((request) => request.method === "POST")).toEqual({ method: "POST", path: "/api/study/start/lc-0020", body: JSON.stringify({ lang: "py" }) });
  });

  it("never offers Keep mine during an attempt started from scratch, and does otherwise", async () => {
    before = { status: "solving", freshStart: true };
    await openProblem();
    fireEvent.change(await screen.findByRole("textbox", { name: "solution.py" }), { target: { value: `${STUB}x` } }); // an edit, then autosave
    expect(await screen.findByRole("button", { name: "Use disk version" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep mine" })).not.toBeInTheDocument();
  });

  it("offers Keep mine for an attempt that was not started from scratch", async () => {
    before = { status: "solving", freshStart: false };
    await openProblem();
    fireEvent.change(await screen.findByRole("textbox", { name: "solution.py" }), { target: { value: `${STUB}x` } }); // an edit, then autosave
    expect(await screen.findByRole("button", { name: "Keep mine" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run --project web playground/tests/web/work-gate.test.tsx`
Expected: FAIL. There is no "Time to review" heading, and "Keep mine" is always offered.

- [ ] **Step 3: The gate and the keep-mine rule**

1. In `playground/web/routes/work.tsx`, replace:

```tsx
import { ArrowLeft, CircleX, TriangleAlert } from "lucide-react";
```

with:

```tsx
import { ArrowLeft, CircleX, RotateCcw, TriangleAlert } from "lucide-react";
```

2. In `playground/web/routes/work.tsx`, replace:

```tsx
import { ApiError, conceptQuery, getSolution, keys, putSolution, runCustomInput, runTests, targetQuery } from "../api.ts";
```

with:

```tsx
import { ApiError, conceptQuery, getSolution, keys, putSolution, runCustomInput, runTests, startReview, targetQuery } from "../api.ts";
```

3. In `playground/web/routes/work.tsx`, replace:

```tsx
function WorkPage({ id }: { id: string }) {
  const target = useQuery(targetQuery(id));
  const [chosen, setChosen] = useState<Lang | null>(null);
```

with:

```tsx
function WorkPage({ id }: { id: string }) {
  const target = useQuery(targetQuery(id));
  const [chosen, setChosen] = useState<Lang | null>(null);
  // Once the editor has opened on this page, a gate that appears later (a card falling due at midnight) waits for
  // the next visit: it must never close an editor with text in it.
  const [opened, setOpened] = useState(false);
```

4. In `playground/web/routes/work.tsx`, replace:

```tsx
  return <Workspace key={lang} target={target.data} lang={lang} onLang={choose} />;
}
```

with:

```tsx
  if (target.data.gate && !opened) {
    return <GatedWorkspace target={target.data} gate={target.data.gate} lang={lang} onLang={choose} onStarted={() => setOpened(true)} />;
  }
  if (!opened) setOpened(true);
  return <Workspace key={lang} target={target.data} lang={lang} onLang={choose} />;
}

const GATE_TEXT: Record<NonNullable<TargetData["gate"]>["kind"], { title: string; button: string; body: string }> = {
  review: {
    title: "Time to review",
    button: "Start review",
    body: "Solve it again from scratch. Your previous solution goes to the history and the editor starts with a fresh stub.",
  },
  exam: {
    title: "Exam",
    button: "Start exam",
    body: "Solve it from scratch, alone, within the time-box: no hints in an exam. Your previous solution goes to the history.",
  },
  retry: {
    title: "Try it again",
    button: "Start again",
    body: "Solve it from scratch this time. Your previous attempt goes to the history and the editor starts with a fresh stub.",
  },
};

/**
 * "Start review" (study coach spec §7): the statement, and instead of the editor a button that asks the server to
 * archive the old solution, write a fresh stub and open the attempt. The old code is never loaded here, so the
 * editor that opens afterwards starts with the stub and an empty undo history.
 */
function GatedWorkspace({ target, gate, lang, onLang, onStarted }: { target: TargetData; gate: NonNullable<TargetData["gate"]>; lang: Lang; onLang(lang: Lang): void; onStarted(): void }) {
  const queryClient = useQueryClient();
  const [trail, setTrail] = useState<string[]>([]);
  const text = GATE_TEXT[gate.kind];
  const start = useMutation({
    mutationFn: () => startReview(target.id, lang),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.target(target.id) });
      void queryClient.invalidateQueries({ queryKey: keys.today });
      onStarted();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkHeader target={target} lang={lang} onLang={onLang} running={false} elapsedMs={0} canRun={false} onRun={() => {}} langLock={null} />
      <div className="flex min-h-0 flex-1">
        <div className="w-2/5 overflow-y-auto border-r bg-card p-4">
          <StatementPane
            target={target}
            trail={trail}
            onConcept={(slug) => setTrail((current) => (current.at(-1) === slug ? current : [...current, slug]))}
            onBack={() => setTrail((current) => current.slice(0, -1))}
          />
        </div>
        <section aria-labelledby="gate-title" className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm space-y-3 text-center">
            <RotateCcw aria-hidden className="mx-auto size-6 text-primary" />
            <h2 id="gate-title" className="text-base font-semibold">
              {text.title}
            </h2>
            <p className="text-muted-foreground">{text.body}</p>
            <p className="font-mono text-xs text-muted-foreground">About {gate.minutes} min</p>
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {text.button}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
```

5. In `playground/web/routes/work.tsx`, replace:

```tsx
function ConflictAlert({ file, onDisk, onMine }: { file: string; onDisk(): void; onMine(): void }) {
```

with:

```tsx
function ConflictAlert({ file, onDisk, onMine }: { file: string; onDisk(): void; onMine: (() => void) | null }) {
```

6. In `playground/web/routes/work.tsx`, replace:

```tsx
        <Button size="sm" variant="outline" onClick={onMine}>
          Keep mine
        </Button>
```

with:

```tsx
        {onMine && (
          <Button size="sm" variant="outline" onClick={onMine}>
            Keep mine
          </Button>
        )}
```

7. In `playground/web/routes/work.tsx`, replace:

```tsx
      {sync.conflict && <ConflictAlert file={`solution.${lang}`} onDisk={sync.takeDisk} onMine={() => void sync.keepMine()} />}
```

with:

```tsx
      {sync.conflict && (
        // An attempt started from scratch (spec §7): keeping this tab's text would bring the archived code back.
        <ConflictAlert file={`solution.${lang}`} onDisk={sync.takeDisk} onMine={target.freshStart ? null : () => void sync.keepMine()} />
      )}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm vitest run --project web && pnpm exec tsc -p playground`
Expected: all web tests pass (work-gate.test.tsx: 3 tests); `tsc` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add playground/tests/web/work-gate.test.tsx playground/web/routes/work.tsx
git commit -m "feat(playground): gate reviews and exams behind Start review, and never offer Keep mine on a fresh start"
```


### Task 15: End-to-end: Today lists the plan, Start review starts blank, the banner is acknowledged once, the pause button

**Files:**
- Modify: `playground/e2e/fixture.ts`
- Test: `playground/e2e/today.spec.ts` (create)
- Modify: `README.md` (the web playground section), `scripts/tests/claude-layer.test.ts`

**Interfaces:**
- Consumes: everything above; Plan A's e2e fixture (`E2E_ROOT`, `repoFile`, `SOLUTION_PY`, `TWO_SUM_PY`, `resetRepo`, which already empties the store and seeds lc-0020 as solved), `fixedClock`, `openStudy`, `recordHint`, `recordWork`, `setCurriculum` (Task 5), `pauseStudy` (Task 6).
- Produces, in `playground/e2e/fixture.ts`: the e2e repo's preset `curriculum/grind-75.yaml` (phase 0 is the `hash-map` concept; the list is Two Sum's `grind-75`); `resetRepo` also removes Two Sum's `history/`; `startCoach()`, `seedDueReview()` (Two Sum solved three days ago with one hint: rated Hard, so its card fell due yesterday, and three days is not an absence), `pauseFromTerminal()`.
- The e2e server keeps using its own ports (4391, and 4392 for `restart.spec.ts`; `playground/e2e/fixture.ts`). Port 4173 is the user's `pnpm play`: never use it.

- [ ] **Step 0: Record the baseline**

Run: `git status --porcelain`
Keep the output: those paths are the user's.

- [ ] **Step 1: The fixture**

1. In `playground/e2e/fixture.ts`, replace:

```ts
import { resetStudy, seedClosedAttempt } from "../../study/tests/seed.ts";
```

with:

```ts
import { fixedClock } from "../../study/clock.ts";
import { pauseStudy } from "../../study/pause.ts";
import { recordHint, recordWork } from "../../study/record.ts";
import { openStudy } from "../../study/store.ts";
import { setCurriculum } from "../../study/switch.ts";
import { resetStudy, seedClosedAttempt } from "../../study/tests/seed.ts";
```

2. In `playground/e2e/fixture.ts`, replace:

```ts
const FILES: Record<string, string> = {
```

with:

```ts
/** The e2e repo's preset (study coach spec §5): phase 0 is the hash-map concept, and the list is Two Sum's. */
const PRESET = `id: grind-75
phases:
  bases: { concepts: [hash-map] }
  learn: { list: grind-75, size: 1, block: 3, mix_after_block: 3 }
  master: { list: grind-75, first_try_success: 0.8 }
  expand: { choose_from: [grind-75], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 }
  pro: { tracks: [interview] }
patterns:
  - { pattern: arrays-hashing, concept: hash-map }
timebox_minutes: { easy: 15, medium: 35, hard: 50 }
`;

const FILES: Record<string, string> = {
  "curriculum/grind-75.yaml": PRESET,
```

3. In `playground/e2e/fixture.ts`, replace:

```ts
  rmSync(repoFile(".study/explanations/hash-map.md"), { force: true });
```

with:

```ts
  rmSync(repoFile(".study/explanations/hash-map.md"), { force: true });
  // Start review archives here; the playground does not watch history/.
  rmSync(repoFile(".study/solutions/problems/lc-0001/history"), { recursive: true, force: true });
```

Append to `playground/e2e/fixture.ts`:

```ts
const DAY_MS = 86_400_000;

/** Runs `fn` on the e2e repo's study store, the way the CLI would, at `at` (default: now). */
function withStudy(fn: (study: ReturnType<typeof openStudy>) => void, at: Date = new Date()): void {
  const study = openStudy(E2E_ROOT, { clock: fixedClock(at) });
  try {
    fn(study);
  } finally {
    study.close();
  }
}

/** `pnpm study curriculum set grind-75`: the coach starts at phase 0 and announces it. */
export function startCoach(): void {
  withStudy((study) => setCurriculum(study, E2E_ROOT, "grind-75", study.clock.now()));
}

/**
 * Two Sum solved three days ago with one hint (TWO_SUM_PY): rated Hard, so its card fell due yesterday and today's
 * plan has its review. Three days is not an absence (7), so there is no welcome-back announcement.
 */
export function seedDueReview(): void {
  mkdirSync(path.dirname(SOLUTION_PY), { recursive: true });
  writeFileSync(SOLUTION_PY, TWO_SUM_PY);
  withStudy((study) => {
    recordHint(study, "lc-0001");
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
  }, new Date(Date.now() - 3 * DAY_MS));
}

/** `pnpm study pause` from a terminal, while the page is open. */
export function pauseFromTerminal(): void {
  withStudy((study) => pauseStudy(study, study.clock.now()));
}
```

- [ ] **Step 2: Write the end-to-end tests**

Create `playground/e2e/today.spec.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { pauseFromTerminal, repoFile, resetRepo, seedDueReview, startCoach, TWO_SUM_PY } from "./fixture.ts";

test.beforeEach(() => resetRepo());

const today = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Today" });

test("the Today section lists today's plan, and a review leads to the Start review gate", async ({ page }) => {
  startCoach();
  seedDueReview();
  await page.goto("/");
  const plan = today(page).getByRole("list", { name: "Today's plan" });
  await expect(plan.getByRole("listitem")).toHaveCount(2);
  await expect(plan.getByRole("listitem").first()).toContainText("Review");
  await expect(plan.getByRole("link", { name: "hash-map Hash map" })).toHaveAttribute("href", "/c/hash-map");
  await plan.getByRole("link", { name: "lc-0001 Two Sum" }).click();
  await expect(page).toHaveURL(/\/p\/lc-0001$/);
  await expect(page.getByRole("heading", { name: "Time to review" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "solution.py" })).toHaveCount(0);
});

test("Start review archives the old solution to history/ and opens a blank editor with no undo history", async ({ page }) => {
  startCoach();
  seedDueReview();
  await page.goto("/");
  await today(page).getByRole("link", { name: "lc-0001 Two Sum" }).click();
  await page.getByRole("button", { name: "Start review" }).click();
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await expect(editor).not.toContainText("seen = {}");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+Z");
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(editor).not.toContainText("seen = {}");
  const history = repoFile(".study/solutions/problems/lc-0001/history");
  const archived = readdirSync(history);
  expect(archived).toHaveLength(1);
  expect(readFileSync(`${history}/${archived[0]}`, "utf8")).toBe(TWO_SUM_PY);
  // The plan is stored for the day: the review is still listed, not done until it is green.
  await page.goto("/");
  const review = today(page).getByRole("listitem").first();
  await expect(review).toContainText("Review");
  await expect(review.getByRole("img", { name: "To do" })).toBeVisible();
});

test("the announcement banner is acknowledged once", async ({ page }) => {
  startCoach();
  await page.goto("/");
  const banner = today(page).getByRole("status");
  await expect(banner).toContainText("The coach started you on Grind 75, at phase 0 · Bases.");
  await banner.getByRole("button", { name: "Got it" }).click();
  await expect(today(page).getByRole("status")).toHaveCount(0);
  await page.reload();
  await expect(today(page).getByRole("list", { name: "Today's plan" })).toBeVisible();
  await expect(today(page).getByRole("status")).toHaveCount(0);
});

test("the pause button pauses the plan, Resume brings it back, and a pause from the terminal shows up live", async ({ page }) => {
  startCoach();
  await page.goto("/");
  await today(page).getByRole("button", { name: "Pause" }).click();
  await expect(today(page).getByText(/^Paused since/)).toBeVisible();
  await today(page).getByRole("button", { name: "Resume" }).click();
  await expect(today(page).getByRole("list", { name: "Today's plan" })).toBeVisible();
  pauseFromTerminal(); // .study/state.json changes: the progress event refreshes the section
  await expect(today(page).getByText(/^Paused since/)).toBeVisible();
});
```

- [ ] **Step 3: Run them**

Run: `pnpm e2e`
Expected: every e2e test passes, the four new ones included. They exercise Tasks 12–14 end to end, so they pass now; if one fails, fix the code, not the test.

- [ ] **Step 4: Document the Today section and Start review**

In `README.md`, replace:

```markdown
- **Home:** work in progress, problems by pattern, concepts with their exercises. Status badges update live when Claude edits a README.
```

with:

```markdown
- **Home:** today's plan from the study coach (what is in progress, the reviews due, the next new item or concept, a banner for each announcement, and a Pause button), then problems by pattern and concepts with their exercises. Everything updates live when your progress or a README changes.
- **Start review:** a problem due for review (or an exam problem) opens with a Start review button instead of your old code. It archives your solution to `.study/solutions/…/history/` and opens a fresh stub with an empty undo history: you solve it again from scratch.
```

Append to `scripts/tests/claude-layer.test.ts`:

```ts
describe("the playground's Today section (study coach spec §11)", () => {
  it("README.md explains Today and Start review", () => {
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toContain("today's plan from the study coach");
    expect(readme).toContain("**Start review:**");
  });
});
```

- [ ] **Step 5: Run everything**

Run: `pnpm verify && pnpm e2e`
Expected: `pnpm verify` green (Vitest, both `tsc`, `check` with 0 errors and no `curriculum/…` line); `pnpm e2e` green.

- [ ] **Step 6: Commit**

```bash
git add playground/e2e/fixture.ts playground/e2e/today.spec.ts README.md scripts/tests/claude-layer.test.ts
git commit -m "test(playground): cover Today, Start review, the announcement banner and the pause button end to end"
```


---

## Final check (after Task 15)

- [ ] Run `pnpm verify && pnpm e2e`. Both must be green.
- [ ] Run `git status --short`. It must show only the user's files: the three modified `concepts/hash-map/` READMEs and any untracked solution files (`.gitignore` may hide them).
- [ ] Run `test ! -e .study/study.db && echo "no study database in the real repo"`. It must print the message.
- [ ] Run `git log --oneline "$BASE_B"..HEAD`. It must show 15 commits, one per task.
- [ ] Run `pnpm -s check | grep curriculum`. It must print nothing: the three presets are valid, and Grind 75 lists every pattern its problems use.

---

## Interfaces for Plan C

Plan C (M8) writes the `coach` skill and the five phase-0 concept notes. Everything below exists after this plan, with exactly these names and shapes. Plan C adds; it never renames.

### Commands the coach runs (all allowed by the hook and by `.claude/settings.json`)

| Command | What it returns | Exit |
|---|---|---|
| `pnpm -s today --json` | `TodayJson`, or `NotInitializedJson` when there is no `.study/study.db`. It is the **chat** surface: its announcements are those chat has not acknowledged. | 0 |
| `pnpm -s today --json --refresh` | Replaces today's stored plan. Run it only when the user asks for a new plan. | 0 |
| `pnpm -s study ack <id>` | `Acknowledged announcement <id> (chat).` / `Announcement <id> was already acknowledged (chat).` | 0; 1 with `There is no announcement <id>.` |
| `pnpm -s study status --json` | Plan A's `SummaryJson` plus `coach` (below) | 0 |
| `pnpm -s study status <id> --json` | Plan A's `ItemStatusJson`; `nextDue` is now the card's due date (ISO) for every problem with a closed attempt | 0 |
| `pnpm -s study init --minutes <n> --lang py\|ts [--timezone <IANA zone>]` | Plan A's command: creates `.study/` or changes only the profile fields passed | 0; 1 for a bad flag |
| `pnpm -s study curriculum --json` | `CurriculumStatusJson` | 0 |
| `pnpm -s study curriculum set <preset> --json` | `CurriculumResult`. Run it only on the user's explicit choice (onboarding, or a request to switch lists, spec §6.5) | 0; 1 when `status` is `refused` or the preset is invalid |
| `pnpm -s study curriculum expand <list> --json` | `ExpansionResult` (the 2 → 3 answer) | 0; 1 when refused |
| `pnpm -s study phase --json` | `PhaseStatusJson` | 0 |

The coach never runs these; the hook denies them, and only the user does:
- `pnpm study start <id>`: the playground's Start review button does the same;
- `pnpm study pause` and `pnpm study resume`;
- `pnpm study phase set <phase>`;
- `pnpm study migrate`.

With no database, `pnpm -s study curriculum …`, `phase` and `ack` print Plan A's `Not recorded: there is no study database yet…` on stderr and exit 0.

### `pnpm -s today --json`

```ts
type TodayResponse = TodayJson | NotInitializedJson;

interface NotInitializedJson {
  initialized: false;
  /** "migrate": a README still holds legacy progress, or a solution file sits in a content folder; otherwise "init". */
  next: "init" | "migrate";
}

interface TodayJson {
  initialized: true;
  /** False until `study curriculum set <preset>`: the coach onboards the user (minutes, language, preset). */
  started: boolean;
  /** Local date in profile.timezone. */
  date: string; // "2026-10-05"
  paused: { since: string } | null; // ISO; while paused, items is [] and no plan is made
  phase: {
    id: "bases" | "learn" | "master" | "expand" | "pro";
    since: string; // ISO time of the phase_log row
    preset: string; // "grind-75"
    /** bases: concepts learned / base concepts; learn: problems with a green attempt and 2 good reviews / list size in the repo;
     *  master: problems tried in the latest exam / list; expand: successes in the window / window; pro: 0/0. */
    progress: { done: number; total: number };
    /** learn and master: the preset's list; expand: the expansion list (null until chosen); bases and pro: null. */
    list: { list: string; imported: number; size: number | null } | null;
    /** Phase 3 only. `list: null` means: ask the user which list to expand with, then `study curriculum expand <list>`. */
    expansion: { list: string | null; choices: string[] } | null;
  } | null; // null when started is false
  announcements: {
    id: number;
    key: "coach-started" | "phase-advanced" | "phase-set" | "curriculum-switched" | "welcome-back";
    at: string; // ISO
    payload: Record<string, unknown>; // shapes below
  }[];
  mode: "normal" | "return" | "catch-up";
  items: {
    kind: "continue" | "review" | "new" | "concept" | "exam";
    /** Problem or exercise id; a concept slug when kind is "concept". */
    id: string;
    title: string; // the id when the content is missing
    minutes: number;
    reason: string; // vocabulary below
    done: boolean; // closed since the plan was made; a concept: learned
    /** The content is not in the repo: for a concept, the note does not exist yet (create it with the `concept` skill). */
    missing: boolean;
  }[];
  /** Due reviews left out of today's plan, and how many days of today's review capacity they need. */
  backlog: { waiting: number; days: number };
  budget: { minutes: number; planned: number };
}
```

Example (phase 1, the coach started yesterday):

```json
{
  "initialized": true,
  "started": true,
  "date": "2026-10-05",
  "paused": null,
  "phase": { "id": "learn", "since": "2026-10-04T14:00:00.000Z", "preset": "grind-75", "progress": { "done": 0, "total": 75 }, "list": { "list": "grind-75", "imported": 75, "size": 75 }, "expansion": null },
  "announcements": [{ "id": 2, "key": "phase-advanced", "at": "2026-10-04T15:10:00.000Z", "payload": { "from": "bases", "to": "learn" } }],
  "mode": "normal",
  "items": [
    { "kind": "review", "id": "lc-0242", "title": "Valid Anagram", "minutes": 9, "reason": "due yesterday", "done": false, "missing": false },
    { "kind": "concept", "id": "hash-map", "title": "Hash map", "minutes": 20, "reason": "opens arrays-hashing", "done": false, "missing": false }
  ],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 29 }
}
```

**Announcement payloads** (spec §6.1; acknowledge each one after showing it in chat):

| `key` | `payload` | When |
|---|---|---|
| `coach-started` | `{ preset, phase }` | The first `curriculum set` |
| `phase-advanced` | `{ from, to }` | Criteria met. With `to: "expand"`, ask which list to expand with when `phase.expansion.list` is null |
| `phase-set` | `{ from, to }` | The user forced a phase |
| `curriculum-switched` | `{ from: { preset, phase }, to: { preset, phase } }` | A switch; `to.phase` may be lower than `from.phase` (spec D13) |
| `welcome-back` | `{ date, daysAway }` | The first plan after 7 or more days without practice |

**Reason vocabulary** (English, for the coach to word in Spanish):
- `in progress · <pattern or concept>`;
- `due today`, `due yesterday`, `due N days ago`;
- `block i/n · <pattern>`, `mix · <pattern>`;
- `opens <pattern>` (the concept that opens a pattern), `bases i/n` (a base concept);
- `exam i/n`, `expand · <list>`, `practice`.

**What each kind means for the user:**
- `continue`: go on with the open attempt.
- `review` and `exam`: solve again from scratch. The playground shows Start review, or the user runs `pnpm study start <id>`. Exams take no hints: `record hint` exits 2 during one (Plan A).
- `new`: a first attempt, which starts with the user's first real edit or run.
- `concept`: read the note and do its exercises; the coach's `concept` skill accepts the explanation (`pnpm -s study record explanation <slug>`). When `missing` is true, create the note first.

### `pnpm -s study status --json`: the new `coach` field

```ts
interface CoachSummary {
  started: boolean; // a preset was set
  preset: string | null;
  phase: "bases" | "learn" | "master" | "expand" | "pro" | null;
  paused: boolean;
  expansionList: string | null;
}
```

Without a database: `{ "started": false, "preset": null, "phase": null, "paused": false, "expansionList": null }`.

### The other JSON results

```ts
type CurriculumResult =
  | { status: "started" | "switched"; preset: string; phase: Phase; previous: { preset: string; phase: Phase } | null; announcementId: number }
  | { status: "unchanged"; preset: string }
  /** The preset's list has no runnable problem in the repo: offer its import (like the Grind 75 one); nothing changed. */
  | { status: "refused"; preset: string; list: string; size: number | null };

type ExpansionResult =
  | { status: "set"; list: string; imported: number; size: number | null } // imported 0: offer the import; today serves reviews only
  | { status: "refused"; list: string; reason: "not-a-choice"; choices: string[] };

interface CurriculumStatusJson {
  preset: string | null;
  since: string | null;
  presets: { id: string; list: string; imported: number; size: number | null }[]; // grind-169 and neetcode-150: imported 0 today
  expansion: { list: string | null; choices: string[] };
}

interface PhaseStatusJson {
  started: boolean;
  phase: Phase | null;
  since: string | null;
  reason: "criteria" | "forced" | "switch" | null;
  preset: string | null;
  progress: { done: number; total: number };
  exitMet: boolean;
}
```

### Onboarding, as the coach should run it

1. `pnpm -s today --json`.
2. `initialized: false`: tell the user to run `pnpm study init` (`next: "init"`) or `pnpm study migrate` (`next: "migrate"`, with `--dry-run` first). They run it themselves.
3. `started: false`: ask minutes per day, language and preset (`pnpm -s study curriculum --json` lists the presets and what is imported).
4. Run `pnpm -s study init --minutes <n> --lang <py|ts>` (it only updates the profile), then `pnpm -s study curriculum set <preset> --json`. If it is refused, explain the import and keep the current preset.
5. `pnpm -s today --json` again; render it; `pnpm -s study ack <id>` for each announcement shown.

### Content Plan C provides

- **The five phase-0 notes**, at exactly these slugs (`curriculum/grind-75.yaml`, `phases.bases.concepts`, in this order): `big-o`, `recursion`, `arrays-and-strings`, `maps-and-sets`, `sorting`.
  - Until they exist, `today` plans the first one as a concept item with `missing: true`, and phase 0 cannot end. A concept is learned when its note exists, its explanation is accepted, and every exercise's latest attempt is green.
  - `grind-169.yaml` and `neetcode-150.yaml` list the same five.
- **Phase-1 concepts** open the patterns as `curriculum/grind-75.yaml` names them (`hash-map` and `two-pointers` already exist). The `concept` skill creates the others when a plan reaches them.

### Playground copy (so chat and UI say the same thing)

- **Phases:** `0 · Bases`, `1 · Learn the list`, `2 · Master the list`, `3 · Expand`, `4 · Pro`.
- **List names:** Grind 75, Grind 169, NeetCode 150.
- **Gate buttons:** Start review, Start exam, Start again.
