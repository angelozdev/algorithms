# Study Coach Plan C (the `coach` skill and the five phase-0 concepts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the study coach (milestone M8): write the five phase-0 concept notes (`big-o`, `recursion`, `arrays-and-strings`, `maps-and-sets`, `sorting`) with three runnable exercises each, and the `coach` skill that answers "¿qué me toca hoy?" in Spanish from `pnpm -s today --json`; then rehearse the whole study coach (Plans A, B and C) end to end on throwaway copies and hand it to the user.

**Architecture:**
- **Content, not code.** The notes and exercises are ordinary content folders (`concepts/<slug>/README.md`, `concepts/<slug>/exercises/<NN>-<slug>/{README.md,cases.json,stress.ts}`) in the format Plan A Tasks 18–19 leave behind: content-only frontmatter, no `## Log`. Plan B's engine already plans them (`curriculum/*.yaml`, `phases.bases.concepts`) and shows `missing: true` until they exist.
- **Every byte is decided here.** Each content file is printed in full in its task, validated beforehand in a scratch copy of the repo (see "Verified facts"), and fingerprinted with SHA-256. The executor transcribes, checks the hashes, re-derives every hidden expected value with an independent reference of their own, and reviews each exercise against the repo's problems.
- **The skill is a thin client.** `.claude/skills/coach/SKILL.md` (+ `examples.md`) only runs the study CLI commands Plan B lists as the coach's, renders their JSON, and sends the user to the commands the hook reserves for them. A test pins it to the code: every command it runs is one the hook allows and the CLI accepts, every command it leaves to the user is one the hook denies, and its examples parse as real `today --json` shapes.
- **A test with the real content.** `study/tests/phase-zero.test.ts` copies this repo's presets, problems and base notes into a temp folder, runs Plan A's `migrate` on it, starts the coach with `grind-75`, and walks phase 0 day by day with a fixed clock, through the CLI.

**Tech Stack:** Node 24.14, pnpm 11.3, TypeScript 7.0, Vitest 5, zod 4.6.5, the runner's harnesses (Python 3.13 via uv, tsx). Nothing is added or upgraded.

**Spec:** `docs/superpowers/specs/2026-10-04-study-coach-design.md` (binding; commit 14f0b01: the coach may run `pnpm -s study curriculum set <preset>`, only on the user's explicit request). Sections used: §1, §2 (D6, D7, D8, D12, D13), §6.1, §6.5, §8, §11 (the `coach` skill), §14, §15 (M8 and the hand-off after it).

**Prerequisites:**
- Plan A, `docs/superpowers/plans/2026-10-04-study-coach-a.md` (M1–M5), fully executed on the branch `study-coach`.
- Plan B, `docs/superpowers/plans/2026-10-04-study-coach-b.md` (M6–M7), fully executed after it.
- This plan uses the names in Plan A's "Interfaces for Plans B and C" and Plan B's "Interfaces for Plan C" exactly as written there.

**Start condition:**
- The main checkout `/Users/angelozdev/me/algorithms` is on `study-coach`, with Plan A's 19 commits and Plan B's 15 on top of `main`; `pnpm verify && pnpm e2e` are green; `test ! -e .study/study.db` holds.
- Before Task 1 the controller records `BASE_C=$(git rev-parse HEAD)`.
- This plan was written against `main` at c456959. All paths are relative to the repo root.

**Final location of this file:** `docs/superpowers/plans/2026-10-04-study-coach-c.md`.

**How this plan was checked:**
- Every exercise below was built in a scratch copy of the repo at c456959 (the runner's `cases.json`, harness and `fill-expected` formats are the ones Plans A and B keep). Its hidden values were filled by a Python reference with `fill-expected`; examples, hidden and stress cases were green with independent Python **and** TypeScript references; deliberately slower variants failed the stress cases; the SHA-256 values in each task are of those validated files.
- In the same copy, `check` (with Plan A Task 18's content-only schemas patched in) reported nothing for the new files, `sync` (with Plan A Task 17's content-only renderer patched in) left the five notes unchanged, and `tsc --noEmit` passed with the new `stress.ts` files.
- The coach skill's frontmatter, its six examples and its vocabulary passed the schema and coverage checks of Task 6 in that copy.
- The tests of Tasks 1–6 call Plan A and Plan B code that does not exist on `main` yet, so they were written against those plans' interfaces and not run. If one fails for a reason outside this plan (a renamed field, an output line worded differently), fix the test to the code's real behavior, keep its intent, and say so in the task report.

## Global Constraints

- **Where:**
  - Work in the main checkout `/Users/angelozdev/me/algorithms`, on the branch `study-coach`, after Plans A and B.
  - Never commit to `main`. Never touch the retired `playground` worktree. No push, merge, rebase or PR.
- **The user's files:**
  - Never stage, edit, move or delete the user's untracked, ignored or modified files. Today these are the three modified `concepts/hash-map/` READMEs (`README.md`, `exercises/01-first-repeat/README.md`, `exercises/02-most-frequent/README.md`) and the `solution.py` / `solution.ts` files of hash-map 01 and 02, two-pointers/01-pair-sum, lc-0026, lc-0053, lc-0066, lc-0067 and lc-0070 (`.gitignore` hides them after Plan A Task 18). New ones may appear while you work.
  - Every task starts with procedure P1's baseline; every path in it is the user's for that task.
  - Stage by explicit file path only. Never `git add -A`, `git add .`, `git add <folder>`, `git commit -a`, `git stash`, `git reset --hard`, `git checkout -- <path>`, `git restore` or `git clean`.
  - If `pnpm verify` or `check` fails only because of such a file, report it and do not fix it.
- **The real repo's progress stays put until the user migrates:**
  - Never run `pnpm study migrate`, `pnpm study init`, `pnpm study start`, `pnpm study curriculum set`, `pnpm study pause|resume`, `pnpm today` or `pnpm sync` against the real repo, and never call their functions on it. The real repo must have no `.study/study.db` when this plan ends.
  - Never run `pnpm test` on the new exercises in the real repo (it would create stubs under `.study/solutions`). The independent check uses `pnpm -s fill-expected`, which writes only the exercise's `cases.json`.
  - `pnpm sync` is not an option either: with Plan A Task 17's content-only renderer it rewrites `INDEX.md`, `concepts/INDEX.md` and every auto-section in `problems/` and `concepts/`, including the user's modified `concepts/hash-map/README.md`. The new notes' auto-sections are therefore written by hand, exactly as `sync` would write them, and procedure P5 checks that without writing anything. `concepts/INDEX.md` and the auto-sections of the problems that reference `recursion` or `sorting` stay as they are; `pnpm study migrate` regenerates them (Plan A Task 17).
  - Tests that need a study store build it in a temp copy (`makeTempDir`, Plan B's `makeCoachRepo`).
- **Scratch copies:**
  - Scratch files go in `S="${TMPDIR:-/tmp}/plan-c"`, never in the repo.
  - Never run `pnpm` inside a copy whose `node_modules` is a symlink to the real one: pnpm 11 then tries to reinstall and asks to purge that `node_modules` (verified). The final rehearsal uses a real `git clone` with its own `pnpm install --offline --frozen-lockfile`.
- **Ports and browser:**
  - Port 4173 is the user's running `pnpm play`: never use, stop or restart it.
  - `pnpm e2e` uses 4391 and 4392. The final rehearsal's playground uses 4393, started with `--no-open` and stopped by its own PID.
  - No claude-in-chrome and never the user's Chrome; the rehearsal uses `playwright-cli` on 127.0.0.1:4393 only.
- **Language:** every repo file, code comment, test name and commit message is in English. The coach skill quotes short Spanish phrases (the triggers, a few model lines), as the existing skills do. Commits follow Conventional Commits.
- **No spoilers** (CLAUDE.md hard rules 1, 4 and 7):
  - Nothing in content, tests, reports or commits may hold code, pseudocode, an approach or a complexity target that solves any problem in `problems/` or any of the fifteen new exercises.
  - Reference solutions live only in `$S`, are deleted right after use, and are never shown, quoted or described (not in the report either).
  - Reviews of an exercise describe what it **asks**, never how to answer it.
- **Byte-exact transcription:** write each file exactly as printed (between the fences, ending with one newline), then check it with procedure P2. The only allowed deviation is an auto-section line that procedure P5 prints differently (a problem registered after c456959 that references the concept).
- **Verification:**
  - `pnpm verify` (Vitest, both `tsc` runs, `check`) stays green after every task, with 0 errors.
  - The `check` warnings change only as each task says (P1 records the baseline count).
  - This plan touches nothing in `playground/`, so `pnpm e2e` runs once, in the final check.
- **Spec authority:** where this plan reads the spec in a way the spec does not spell out, the ruling is in "Decisions and spec rulings". Do not re-decide them in a task.

## Verified facts

Checked on 2026-10-04 in a scratch copy of the repo at c456959 (macOS arm64, Node 24.14.0, pnpm 11.3.0, Python 3.13). Do not re-litigate them.

1. **The runner's shapes:** the Python harness calls `Solution().<entry>(…)` (a class `Solution` with the entry method); the TypeScript harness calls the module's default export. `cases.json` types are `int | float | bool | string` (and node types) with `[]` suffixes; `compare` is `exact` unless noted.
2. **`pnpm -s fill-expected <id> --ref <file outside the repo>`:**
   - checks the reference against every example (exit 1, `the reference disagrees with examples[i]: …`);
   - fills each hidden value that has no `expected`, and **checks** each one that has (exit 1, `hidden[i] already expects … but the reference returned …`);
   - rewrites `cases.json` with the runner's own formatter. The files below are already in that format, so a run that agrees leaves them byte for byte the same and prints `Filled 0 hidden expected value(s) in <path>.` (`Filled 6 …` and `Filled 5 …` for the two files whose hidden values this plan leaves empty).
3. **Timing:** with correct references every stress case ran in under 40 ms in both languages, against the default 2,000 ms limit. Examples plus hidden cases share one 5,000 ms limit per run.
4. **`check`** validates frontmatter, the `<!-- auto:… -->` markers, `cases.json`, the stress generator's inputs and every relative link. It does **not** compare auto-sections or `INDEX.md` with what `sync` would write.
5. **The real repo's `check` at c456959:** `0 error(s), 41 warning(s)`, all of them `"<slug>" is referenced but not created (…)`. `recursion` (referenced by 9 problems) and `sorting` (by 3) are among them; `big-o`, `arrays-and-strings` and `maps-and-sets` are referenced by nothing yet. Plans A and B add warnings of their own; every task below states its effect relative to the count P1 records.
6. **The content-only renderer** (Plan A Task 17) writes a concept's exercises as `- [<NN> · <title>](exercises/<folder>/README.md)`, its problems as `- [<id> · <title>](../../problems/<folder>/README.md)` in folder order, and `_No problems yet._` when there are none. A problem's auto-section shows a missing concept as `- <slug> (missing)`.
7. **The guard** (Plan A Task 8) denies `pnpm [-s] study migrate|start|pause|resume` and `study phase set` to Claude whatever the folder, flags or arguments; it allows `pnpm -s study status|record|init|ack|phase|curriculum …` and `pnpm -s today …`. So Claude can never run `migrate` from a shell, even on a copy: the migration rehearsal is a test (Task 1), as Plan A's migration tests are.

## Review Focus

The five failure modes most likely to bite the user, each pinned in the task named:

1. **The user's real migration is blocked by a README that the strip cannot handle.** Plan A's migration tests use a fictional fixture; nothing yet runs it over the 90 real problem READMEs. Pinned by Task 1's "migrates a copy of this repo, then starts the coach at phase 0 with big-o".
2. **A base concept the engine cannot find** (a slug, folder, title or exercise id that does not match the preset) leaves `missing: true` forever, and phase 0 never ends. Pinned by the walk test of Tasks 1–5, "plans the base concepts one a day, in the preset's order, each with three exercises", and by Task 5's "ends phase 0 after the fifth base concept".
3. **A base exercise that no correct solution can pass in one of the two languages** (a wrong hidden value, an ambiguous statement, a stress case too tight for Python) would block phase 0 for good. Pinned in every content task by P2 (the files are the validated ones, byte for byte) and P3 (an independent reference written from the statement alone agrees with every hidden value).
4. **The coach typing a command the hook denies or the CLI rejects, or telling the user a command that does not exist,** fails in the middle of a conversation. Pinned by Task 6's "only runs commands the hook allows…" and "works against the CLI in a session from the first question to phase 1…".
5. **The coach's examples and vocabulary drifting from `today --json`** (a renamed field, a new announcement key) makes it render nonsense. Pinned by Task 6's strict schema test, which parses both the real CLI output and every example with the same schema.

## Decisions and spec rulings

1. **`maps-and-sets` and the existing `hash-map`: kept distinct (no change to Plan B).** The slugs stay as Plan B's presets name them.
   - `maps-and-sets` (phase 0, "language essentials", spec §1 and D6) teaches **using** `dict`/`set` and `Map`/`Set` in both languages: create, read safely, overwrite, delete, iterate, set operations, composite keys, the O(1) cost model, and the traps (plain objects, `__proto__`, identity keys, insertion order).
   - `hash-map` (phase 1, opens `arrays-hashing` in `curriculum/grind-75.yaml`) keeps **why** lookups are O(1) (hashing, buckets, collisions) and the problem patterns built on it (seen-before, counting, grouping). The new note links to it and leaves those topics out; its exercises do none of them.
   - `hash-map` is not edited: it holds the user's uncommitted work. Adding `requires: [maps-and-sets]` to it is a follow-up for the user (see the hand-off).
   - The alternative, reusing `hash-map` as the fourth base concept, was rejected: it would put a phase-1 pattern concept into phase 0 (against D6), and it would have meant editing `phases.bases.concepts` in Plan B Task 2's three presets, that task's test expectation in `study/tests/curriculum.test.ts`, and the slug list in Plan B's "Interfaces for Plan C".
2. **`arrays-and-strings` overlaps nothing that exists.** It is language essentials (indexes, slices, building results, immutable strings, character codes, grids). The pattern concepts the problems reference (`string-traversal`, `matrix-traversal`, `in-place-array-modification`) do not exist and stay with phase 1 (D6); `two-pointers` is its only `related`.
3. **Three exercises per base concept**, easiest first, all original. A `stress.ts` exists only where input size is the lesson (8 of the 15). Statements may say which constraint matters ("n goes up to a million here"): reading constraints is the Big-O lesson itself.
4. **The coach never names the pattern of a `mix`, `continue`, `review` or `exam` item.** Interleaved practice exists to train recognizing the pattern unaided (the research report the spec cites; part 2 adds the "which pattern?" prediction). Block items (`block i/n · <pattern>`) and the concept that opens a pattern (`opens <pattern>`) do name it. The playground's Today section (Plan B Task 13) shows `mix · <pattern>`; aligning it belongs to part 2 and is not changed here.
5. **With no database (`initialized: false`) the coach runs nothing:** it sends the user to `pnpm study init` or `pnpm study migrate` (Plan B, "Onboarding" step 2). It runs `pnpm -s study init --minutes … --lang …` only when the database exists, where it only updates the profile.
6. **An explicit request to switch names the list** ("cámbiame a NeetCode 150"). A question ("¿y si me cambio?") gets an explanation and a question back, never a `curriculum set` (spec §6.5).
7. **How the skill is tested:** the repo's convention is `scripts/tests/claude-layer.test.ts` (frontmatter and wording). Task 6 adds the coach there and adds `study/tests/coach-skill.test.ts`, which checks what is mechanical: the commands against the hook and the CLI, the examples against a strict schema of `today --json`, and the vocabulary's coverage. The conversation itself is not mechanically testable; the hand-off's first "¿qué me toca hoy?" is its live check.
8. **Hidden values in this plan:** every `cases.json` is printed with its hidden values filled, except `recursion/02` and `recursion/03`, whose outputs are long (up to 255 moves); there the plan prints the inputs and the SHA-256 of the filled file, and P3 fills them.
9. **Pre-existing findings, reported and left alone:** `concepts/hash-map/exercises/03-same-letters` asks the same question as `lc-0242` (Valid Anagram), and the two-pointers note's template merges two sorted lists as `lc-0021` asks. After the migration every problem counts as unsolved (spec D5), so both conflict with hard rule 1. Neither is in this plan's scope (hash-map holds the user's edits); the final report lists them for the user.

## File map

| File | Change | Task |
|---|---|---|
| `concepts/big-o/README.md`, `concepts/big-o/exercises/{01-pair-ticks,02-halving-ticks,03-fits-budget}/*` | create | 1 |
| `concepts/recursion/README.md`, `concepts/recursion/exercises/{01-collatz-steps,02-echo,03-hanoi}/*` | create | 2 |
| `concepts/arrays-and-strings/README.md`, `concepts/arrays-and-strings/exercises/{01-regroup,02-letter-shift,03-headline}/*` | create | 3 |
| `concepts/maps-and-sets/README.md`, `concepts/maps-and-sets/exercises/{01-settings,02-lineups,03-robot-trail}/*` | create | 4 |
| `concepts/sorting/README.md`, `concepts/sorting/exercises/{01-insertion-shifts,02-leaderboard,03-chart-positions}/*` | create | 5 |
| `study/tests/phase-zero.test.ts` | create (1); the `WRITTEN` line (2–5); one `describe` appended (2, 5) | 1–5 |
| `.claude/skills/coach/SKILL.md`, `.claude/skills/coach/examples.md` | create | 6 |
| `study/tests/coach-skill.test.ts` | create | 6 |
| `scripts/tests/claude-layer.test.ts`, `CLAUDE.md`, `README.md` | the coach in `SKILLS`, the skills table, the repo map, the daily flow | 6 |

## Shared procedures

Tasks 1–6 run these by name. Each is complete here; nothing else is needed to run it.

### P1. Baseline, tree review and commit

1. **Baseline (Step 0 of every task):**

   ```bash
   S="${TMPDIR:-/tmp}/plan-c"; mkdir -p "$S"
   git status --porcelain --untracked-files=all > "$S/task-$N-baseline.txt"   # N = the task number
   pnpm -s check 2>&1 | tail -1 | tee "$S/task-$N-check.txt"                  # "0 error(s), W warning(s)"
   ```

   Every path in the baseline file is the user's for this task.
2. **Tree review (before committing):** run `git status --porcelain --untracked-files=all` and compare it with the baseline. The new entries must be exactly the files the task's **Files** block lists. Anything else may be the user's live work: stop and find out why.
3. **Commit:** `git add` each listed file by its full path (never a folder), run `git diff --cached --name-only` and check it lists exactly those files, then commit with the task's message.

### P2. Byte check of the transcribed files

1. Make every new file end with exactly one newline (the Write tool may add or drop one):

   ```bash
   perl -0pi -e 's/\n*\z/\n/' <every file the task created>
   ```

2. Run `shasum -a 256 <the same files>` and compare with the task's hash table. Every line must match.
3. A mismatch means a transcription slip: diff the file against the plan's text and fix it. The one allowed exception is a concept README whose auto-section P5 prints differently; then only that README's hash differs, and the report says why.
4. For `recursion/02` and `recursion/03`, run P2 after P3 (P3 fills their hidden values).

### P3. Independent reference check (per exercise)

The plan's hidden values were computed by two references already. This check is a third, written by you **from the statement alone**, so it also catches a statement that can be read two ways.

1. Read only the exercise's `README.md` and the `entry` and `params` of its `cases.json`. Do not read its hidden values.
2. Write a reference solution in `$S/ref-<slug>-<NN>/ref.py`: a class `Solution` with a method named like `entry`, taking `self` and then the params in order. Never write it under the repo, never name it `solution.*`.
3. Run:

   ```bash
   pnpm -s fill-expected <slug>/<NN> --ref "$S/ref-<slug>-<NN>/ref.py"
   ```

   Expected: `Filled 0 hidden expected value(s) in concepts/<slug>/exercises/<folder>/cases.json.` (or `Filled 6 …` / `Filled 5 …` for `recursion/02` / `recursion/03`).
4. On `the reference disagrees with examples[i]` or `hidden[i] already expects …`, the plan and your reading of the statement differ. Re-read the statement. If both readings are reasonable, stop and report it: the user would hit the same ambiguity. Never edit an expected value to match your reference without knowing which reading is right.
5. `rm -rf "$S/ref-<slug>-<NN>"`. Never show, quote or describe the reference.

### P4. Non-isomorphism review (per concept)

Hard rule 1 and spec §8: an exercise must not ask the same question as any problem in `problems/` (after the migration, every one of them counts as unsolved, spec D5), nor as an existing concept exercise.

1. Write the signature lister once:

   ```bash
   cat > "$S/signatures.mjs" <<'EOF'
   // node signatures.mjs <repo root> <concept slug>: each exercise's signature, and the problems that share it.
   import { existsSync, readdirSync, readFileSync } from "node:fs";
   import path from "node:path";

   const [root, slug] = process.argv.slice(2);
   const signature = (file) => {
     const cf = JSON.parse(readFileSync(file, "utf8"));
     return (cf.mode ?? "function") === "function" ? `(${(cf.params ?? []).map((p) => p.type).join(", ")}) -> ${cf.returns}` : cf.mode;
   };
   const problems = readdirSync(path.join(root, "problems"))
     .filter((folder) => existsSync(path.join(root, "problems", folder, "cases.json")))
     .sort()
     .map((folder) => [folder, signature(path.join(root, "problems", folder, "cases.json"))]);
   for (const exercise of readdirSync(path.join(root, "concepts", slug, "exercises")).sort()) {
     const mine = signature(path.join(root, "concepts", slug, "exercises", exercise, "cases.json"));
     const same = problems.filter(([, sig]) => sig === mine).map(([folder]) => folder);
     console.log(`${slug}/${exercise.slice(0, 2)}  ${mine}  same signature: ${same.length ? same.join(", ") : "none"}`);
   }
   EOF
   node "$S/signatures.mjs" "$PWD" <slug>
   ```

2. Compare the output with the task's review table. A problem registered after c456959 may add a name: review it too.
3. For every problem listed, read its `## Statement` and confirm the exercise asks a different question (different input, different output, or a different relation between them), not the same one renamed.
4. Then read the full list (`ls problems`, and the titles in `INDEX.md`) and the existing exercises (`ls concepts/*/exercises`) for the same question behind different types, and confirm none.
5. Report one line per exercise: `<id>: nearest <problems>; asks <what the exercise asks> while they ask <what they ask>`. Never an approach.

### P5. Auto-sections, as `pnpm sync` would write them (read-only)

```bash
cat > "$S/auto-sections.ts" <<'EOF'
// pnpm exec tsx auto-sections.ts <slug>: compares a concept's auto-sections with what pnpm sync would write. Writes nothing.
import { scanRepo } from "/Users/angelozdev/me/algorithms/lib/repo.ts";
import { replaceAuto } from "/Users/angelozdev/me/algorithms/scripts/lib/auto.ts";
import { renderConceptExercises, renderConceptProblems } from "/Users/angelozdev/me/algorithms/scripts/lib/render.ts";

const slug = process.argv[2];
const repo = scanRepo("/Users/angelozdev/me/algorithms");
const concept = repo.concepts.find((entry) => entry.slug === slug);
if (!concept) throw new Error(`no concept ${slug}`);
const sections: [string, string][] = [
  ["exercises", renderConceptExercises(concept, repo)],
  ["problems", renderConceptProblems(concept, repo)],
];
let body = concept.body;
for (const [name, content] of sections) body = replaceAuto(body, name, content) ?? body;
if (body === concept.body) console.log(`${slug}: the auto-sections match pnpm sync`);
else {
  for (const [name, content] of sections) console.log(`<!-- auto:${name} -->\n${content}\n<!-- /auto -->`);
  process.exitCode = 1;
}
EOF
pnpm exec tsx "$S/auto-sections.ts" <slug>
```

Expected: `<slug>: the auto-sections match pnpm sync`. Otherwise it prints both sections as `sync` would write them: replace the README's two auto-sections with exactly those lines, run P2 again (only the README's hash may now differ), and say so in the report.

---
## Milestone M8: the five phase-0 concepts

### Task 1: The `big-o` concept, its three exercises, and the phase-0 test on a copy of this repo

**Files:**
- Create: `concepts/big-o/README.md`
- Create: `concepts/big-o/exercises/01-pair-ticks/README.md`
- Create: `concepts/big-o/exercises/01-pair-ticks/cases.json`
- Create: `concepts/big-o/exercises/01-pair-ticks/stress.ts`
- Create: `concepts/big-o/exercises/02-halving-ticks/README.md`
- Create: `concepts/big-o/exercises/02-halving-ticks/cases.json`
- Create: `concepts/big-o/exercises/02-halving-ticks/stress.ts`
- Create: `concepts/big-o/exercises/03-fits-budget/README.md`
- Create: `concepts/big-o/exercises/03-fits-budget/cases.json`
- Create: `concepts/big-o/exercises/03-fits-budget/stress.ts`
- Create: `study/tests/phase-zero.test.ts`

**Interfaces:**
- Consumes:
  - Plan A: `runStudyCli(argv, io)` with `CliIo = { root; clock; out(text); err(text) }` (`study/commands.ts`); `fixedClock`, `FixedClock` (`study/clock.ts`); `openStudy(root, { clock })` (`study/store.ts`); `recordWork(study, itemId, { type: "run", lang, green }, source)` (`study/record.ts`); `makeTempDir`, `cleanupTempDirs` (`scripts/tests/fixture.ts`); `REPO_ROOT` (`runner/src/paths.ts`); the CLI's `migrate [--dry-run] [--timezone <zone>]` (prints `Dry run: nothing was changed.` and, the second time, `Nothing to migrate.`), `init [--minutes] [--lang] [--timezone]` and `record explanation <slug>`.
  - Plan B: `loadCatalog(root).concepts.get(slug)?.exercises` (`study/catalog.ts`); the CLI's `curriculum set <preset> --json` (`CurriculumResult`), `today --json` (`TodayJson`) and `ack <id>`; the preset `curriculum/grind-75.yaml`, whose `phases.bases.concepts` is `[big-o, recursion, arrays-and-strings, maps-and-sets, sorting]`; a concept row is `{ kind: "concept", id, title, minutes: 20, reason: "bases i/n", done, missing }`.
- Produces:
  - the concept `big-o` ("Big-O") and the exercises `big-o/01` (`pairTicks`), `big-o/02` (`halvingTicks`), `big-o/03` (`fitsBudget`);
  - `study/tests/phase-zero.test.ts`, with the test-local helpers `BASES`, `WRITTEN`, `shippedCopy()`, `copy()`, `startCoach(c)` and `learn(c, slug)` that Tasks 2–5 extend.

Big-O comes first: every later note and exercise speaks in its terms (spec §1, phase 0: "Big-O, recursion and language essentials"). The note teaches the three counting rules (steps in a row add, nested steps multiply, halving gives a logarithm), the constraint-to-growth table and the hidden loops of everyday code. Its exercises: the exact count of a printed nested loop, the exact count of a printed halving loop, and whether a growth rate fits a step budget. All three have a stress case at the largest input the constraints allow.

The note's `related: [recursion, sorting]` names notes that Tasks 2 and 5 write; until then `check` lists `big-o` among the places that reference those two missing slugs, which changes no count.

- [ ] **Step 0: Baseline**

Run procedure P1 step 1 with `N=1`.

- [ ] **Step 1: Write the failing test**

Create `study/tests/phase-zero.test.ts`:

```ts
import { cpSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { loadCatalog } from "../catalog.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { runStudyCli } from "../commands.ts";
import { recordWork } from "../record.ts";
import { openStudy } from "../store.ts";

// The shipped content end to end (study coach spec §15, D6, D7): a copy of this repo's presets, problems and
// phase-0 notes migrates cleanly, and the coach walks the five base concepts in the preset's order.

afterEach(cleanupTempDirs);

/** Phase 0 of curriculum/grind-75.yaml (`phases.bases.concepts`), in order, with the title of each note. */
const BASES: [slug: string, title: string][] = [
  ["big-o", "Big-O"],
  ["recursion", "Recursion"],
  ["arrays-and-strings", "Arrays and strings"],
  ["maps-and-sets", "Maps and sets"],
  ["sorting", "Sorting"],
];
/** The base notes written so far (study coach Plan C adds one per task). */
const WRITTEN = ["big-o"];
const TZ = "America/Bogota";
const MONDAY = "2026-10-05T14:00:00.000Z"; // 09:00 in Bogotá
const DAY = 86_400_000;
/** Content files only: never a solution file, never anything from .study. */
const CONTENT = new Set(["README.md", "cases.json"]);

/** The presets, every problem and the written base notes, as a fresh clone has them. */
function shippedCopy(): string {
  const root = makeTempDir("algo-shipped-");
  cpSync(path.join(REPO_ROOT, "curriculum"), path.join(root, "curriculum"), { recursive: true });
  const content = (rel: string) =>
    cpSync(path.join(REPO_ROOT, rel), path.join(root, rel), {
      recursive: true,
      filter: (source) => statSync(source).isDirectory() || CONTENT.has(path.basename(source)),
    });
  content("problems");
  for (const slug of WRITTEN) content(path.join("concepts", slug));
  return root;
}

interface Copy {
  root: string;
  clock: FixedClock;
  cli(...argv: string[]): Promise<{ code: number; out: string; err: string }>;
  json(...argv: string[]): Promise<any>;
}

/** A fresh copy and the study CLI run in-process on it, at Monday 09:00 in Bogotá. */
function copy(): Copy {
  const root = shippedCopy();
  const clock = fixedClock(MONDAY);
  const cli = async (...argv: string[]) => {
    let out = "";
    let err = "";
    const code = await runStudyCli(argv, { root, clock, out: (text) => (out += text), err: (text) => (err += text) });
    return { code, out, err };
  };
  const json = async (...argv: string[]) => {
    const result = await cli(...argv);
    expect(result.code, result.err).toBe(0);
    return JSON.parse(result.out);
  };
  return { root, clock, cli, json };
}

/** What the coach skill runs on first use (spec §11): the profile, then the default preset. */
async function startCoach(c: Copy): Promise<void> {
  expect((await c.cli("init", "--timezone", TZ, "--minutes", "45", "--lang", "py")).code).toBe(0);
  expect(await c.json("curriculum", "set", "grind-75", "--json")).toMatchObject({ status: "started", preset: "grind-75", phase: "bases" });
}

/** The user learns a base concept: the concept skill accepts the explanation, and every exercise has a green run. */
async function learn(c: Copy, slug: string): Promise<void> {
  expect((await c.cli("record", "explanation", slug)).code).toBe(0);
  const study = openStudy(c.root, { clock: c.clock });
  try {
    for (const id of loadCatalog(c.root).concepts.get(slug)?.exercises ?? []) {
      recordWork(study, id, { type: "run", lang: "py", green: true }, "cli");
    }
  } finally {
    study.close();
  }
}

describe("phase 0 with the shipped content (study coach spec §15)", () => {
  it("migrates a copy of this repo, then starts the coach at phase 0 with big-o", async () => {
    const c = copy();
    const dry = await c.cli("migrate", "--dry-run", "--timezone", TZ);
    expect(dry.code, dry.err).toBe(0);
    expect(dry.out).toContain("Dry run: nothing was changed.");
    const migrated = await c.cli("migrate", "--timezone", TZ);
    expect(migrated.code, migrated.err).toBe(0);
    expect((await c.cli("migrate", "--timezone", TZ)).out).toContain("Nothing to migrate.");
    expect(await c.json("today", "--json")).toMatchObject({ initialized: true, started: false });

    await startCoach(c);
    const plan = await c.json("today", "--json");
    expect(plan.phase).toMatchObject({ id: "bases", preset: "grind-75", progress: { done: 0, total: 5 }, list: null });
    expect(plan.announcements).toEqual([expect.objectContaining({ key: "coach-started", payload: { preset: "grind-75", phase: "bases" } })]);
    expect(plan.items).toEqual([{ kind: "concept", id: "big-o", title: "Big-O", minutes: 20, reason: "bases 1/5", done: false, missing: false }]);
  });

  it("plans the base concepts one a day, in the preset's order, each with three exercises", async () => {
    const c = copy();
    await startCoach(c);
    for (const [i, [slug, title]] of BASES.entries()) {
      const plan = await c.json("today", "--json");
      expect(plan.phase).toMatchObject({ id: "bases", progress: { done: i, total: BASES.length } });
      if (!WRITTEN.includes(slug)) {
        // The next note is not written yet: today plans it anyway, marked missing (Plan B, Task 9).
        expect(plan.items).toEqual([expect.objectContaining({ kind: "concept", id: slug, missing: true })]);
        return;
      }
      expect(plan.items).toEqual([{ kind: "concept", id: slug, title, minutes: 20, reason: `bases ${i + 1}/${BASES.length}`, done: false, missing: false }]);
      expect(loadCatalog(c.root).concepts.get(slug)?.exercises).toEqual([`${slug}/01`, `${slug}/02`, `${slug}/03`]);
      await learn(c, slug);
      c.clock.advance(DAY);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: FAIL, 2 tests. Both see the `big-o` row as `{ kind: "concept", id: "big-o", title: "big-o", …, missing: true }`: the note does not exist yet. If the first test fails earlier, at `migrate`, read its `err`: a line `Cannot migrate yet. Fix these READMEs first:` means a real README cannot be stripped (Review Focus 1). Stop and report those lines; they would block the user's own migration too.

- [ ] **Step 3: The note**

Create `concepts/big-o/README.md`:

````markdown
---
slug: big-o
title: Big-O
requires: []
related: [recursion, sorting]
---
# Big-O

## Intuition

Your IoT dashboard is snappy with 10 sensors. Then a client plugs in 10,000, and the page freezes 🥶. The code did not change; the **input grew**. Big-O is the habit of asking, before you run anything: *if the input doubles, what happens to the work?*

Think of a band rehearsing a setlist 🎸. Playing every song once grows with the number of songs: twice the songs, twice the time. Having **every pair of musicians** run a duet grows much faster: twice the musicians, four times the duets. Big-O names that growth: O(n) for the first, O(n²) for the second. It ignores the tempo (constants such as "each song takes 4 minutes") and keeps only the shape of the curve, because for large inputs the shape is what decides whether your code finishes.

Three counting rules cover most code:
- **Steps in a row add up** ➕: a loop over n, then another loop over n, is n + n = O(n).
- **Steps inside steps multiply** ✖️: a loop over n inside a loop over n is n × n = O(n²).
- **Halving gives a logarithm** ✂️: cutting n in half until 1 is left takes about log₂ n steps. log₂ of 1,000,000 is only about 20.

## Diagram

How the work grows (rounded) as n grows:

```
n             O(1)   O(log n)   O(n)        O(n log n)    O(n²)            O(2ⁿ)
10            1      3          10          33            100              1,024
1,000         1      10         1,000       9,966         1,000,000        ≈ 10³⁰¹  💥
1,000,000     1      20         1,000,000   19,931,569    10¹²  💥          —
```

Counting the steps of nested loops:

```
for i in range(n):          ← the outer body runs n times
    for j in range(n):      ← for EACH i, this body runs n times
        work()              → work() runs n × n = n² times

size = n
while size > 1:             ← n, n/2, n/4, … 2: about log₂ n rounds
    size = size // 2
```

## Signals

- The statement gives **constraints** such as `n <= 10^5`: they tell you which growth will fit in time (see the table below)
- "Correct on the examples, but it times out"
- A loop inside a loop, or a function that loops (`x in my_list`, `includes`, `indexOf`, `slice`) called inside a loop
- Something is cut in half again and again
- A function that calls itself more than once

## When it fails

- **Big-O hides constants.** O(n) with a heavy step (a network call, a 50 ms render) can lose to O(n log n) with tiny steps. For small n, the "worse" algorithm is often faster.
- **Average is not worst case.** Some operations are O(1) on average but O(n) in rare bad cases.
- **Hidden loops count.** `if x in my_list:` looks like one line, but it scans the list: inside a loop over n items it makes the whole thing O(n²). The same goes for `list.pop(0)`, `nums.shift()`, slicing, and copying with `[...nums]`.
- **Python is slower per step than TypeScript.** The same O(n) loop can take ten times longer in Python. Big-O tells you the shape, not the seconds.

## Typical complexity

The rule of thumb: a judge runs roughly 10⁸ simple steps per second. So the constraints suggest a target:

| Largest n | Growth that usually fits | Typical example |
|---|---|---|
| ≤ 10 | O(n!) | every ordering of the items |
| ≤ 20 | O(2ⁿ) | every subset of the items |
| ≤ 500 | O(n³) | three nested loops |
| ≤ 10⁴ | O(n²) | two nested loops |
| ≤ 10⁶ | O(n log n) | sorting, then one pass |
| ≤ 10⁸ | O(n) | one pass |
| larger | O(log n) or O(1) | halving, or a formula |

**Space** counts the same way: the extra memory your code allocates (a copy of the input is O(n), a few variables are O(1)).

## Template

A doubling experiment: run your function on n, 2n, 4n… and look at how the time grows. About ×2 per doubling means O(n), about ×4 means O(n²), and about ×1 means O(log n) or O(1).

Python:

```python
import time

def measure(f, sizes):
    previous = None
    for n in sizes:
        data = list(range(n))
        start = time.perf_counter()
        f(data)
        elapsed = time.perf_counter() - start
        growth = f"×{elapsed / previous:.1f}" if previous else ""
        print(f"n={n:>9,}  {elapsed * 1000:9.2f} ms  {growth}")
        previous = elapsed

def total(items: list[int]) -> int:  # one pass: O(n)
    result = 0
    for x in items:
        result += x
    return result

measure(total, [250_000, 500_000, 1_000_000, 2_000_000])
```

TypeScript:

```ts
function measure(f: (data: number[]) => unknown, sizes: number[]): void {
  let previous = 0;
  for (const n of sizes) {
    const data = Array.from({ length: n }, (_, i) => i);
    const start = performance.now();
    f(data);
    const elapsed = performance.now() - start;
    const growth = previous ? `×${(elapsed / previous).toFixed(1)}` : "";
    console.log(`n=${n.toLocaleString().padStart(9)}  ${elapsed.toFixed(2).padStart(9)} ms  ${growth}`);
    previous = elapsed;
  }
}

function total(items: number[]): number { // one pass: O(n)
  let result = 0;
  for (const x of items) result += x;
  return result;
}

measure(total, [250_000, 500_000, 1_000_000, 2_000_000]);
```

Tiny inputs are noisy (a few microseconds): use sizes large enough to take a few milliseconds.

## Exercises

<!-- auto:exercises -->
- [01 · Pair ticks](exercises/01-pair-ticks/README.md)
- [02 · Halving ticks](exercises/02-halving-ticks/README.md)
- [03 · Fits the budget](exercises/03-fits-budget/README.md)
<!-- /auto -->

## Quick checks

1. A loop over n items, followed by a separate loop over the same n items: what is the total, in Big-O? And if the second loop sits *inside* the first?
2. Why is `if x in my_list:` inside a `for` loop over n items O(n²), and not O(n)?
3. A statement says `1 <= n <= 10^5`. Is an O(n²) solution likely to finish in time? Why?
4. Big-O turns 3n + 5 steps into O(n). Why is it fine to drop the 3 and the 5, and when could they still matter?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
_No problems yet._
<!-- /auto -->
````

- [ ] **Step 4: Exercise 01 · Pair ticks**

Create `concepts/big-o/exercises/01-pair-ticks/README.md`:

````markdown
---
id: big-o/01
title: Pair ticks
concept: big-o
---
# Pair ticks

## Statement

This code makes a metronome tick once for every pair of musicians `(i, j)` with `i < j` in a band of `n`:

```
ticks = 0
for i from 0 to n - 1:
    for j from i + 1 to n - 1:
        ticks = ticks + 1
```

Return the final value of `ticks` for the given `n`. Running the loops literally works for small bands, but `n` goes up to a million here.

**Examples**

- `n = 4` → `6`
- `n = 1` → `0` (nobody to pair with)
- `n = 5` → `10`

**Constraints:** `0 <= n <= 10^6`

**Follow-up:** can you answer without any loop at all?
````

Create `concepts/big-o/exercises/01-pair-ticks/cases.json`:

```json
{
  "mode": "function",
  "entry": "pairTicks",
  "params": [
    {"name":"n","type":"int"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[4],"expected":6},
    {"input":[1],"expected":0},
    {"input":[5],"expected":10}
  ],
  "hidden": [
    {"input":[0],"expected":0},
    {"input":[2],"expected":1},
    {"input":[3],"expected":3},
    {"input":[7],"expected":21},
    {"input":[10],"expected":45},
    {"input":[100],"expected":4950},
    {"input":[999],"expected":498501},
    {"input":[1000],"expected":499500},
    {"input":[2026],"expected":2051325},
    {"input":[3000],"expected":4498500}
  ]
}
```

Create `concepts/big-o/exercises/01-pair-ticks/stress.ts`:

```ts
import type { StressCase } from "../../../../runner/src/stress.ts";

export default function stress(): StressCase[] {
  return [{ name: "n=1e6", input: [1_000_000] }];
}
```

- [ ] **Step 5: Exercise 02 · Halving ticks**

Create `concepts/big-o/exercises/02-halving-ticks/README.md`:

````markdown
---
id: big-o/02
title: Halving ticks
concept: big-o
---
# Halving ticks

## Statement

A dashboard redraws its widgets in rounds. The first round redraws `n` widgets, and every round after that redraws half as many (rounded down), until a round would redraw none:

```
ticks = 0
size = n
while size >= 1:
    for k from 1 to size:
        ticks = ticks + 1
    size = size // 2        (integer division: 7 // 2 = 3)
```

Return the final value of `ticks` for the given `n`.

**Examples**

- `n = 8` → `15` (8 + 4 + 2 + 1)
- `n = 6` → `10` (6 + 3 + 1)
- `n = 1` → `1`

**Constraints:** `0 <= n <= 10^15`

**Follow-up:** before you code, guess how the answer grows as `n` grows: like `n`, like `n log n`, or like `n²`? Then check your guess against your results.
````

Create `concepts/big-o/exercises/02-halving-ticks/cases.json`:

```json
{
  "mode": "function",
  "entry": "halvingTicks",
  "params": [
    {"name":"n","type":"int"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[8],"expected":15},
    {"input":[6],"expected":10},
    {"input":[1],"expected":1}
  ],
  "hidden": [
    {"input":[0],"expected":0},
    {"input":[2],"expected":3},
    {"input":[3],"expected":4},
    {"input":[7],"expected":11},
    {"input":[100],"expected":197},
    {"input":[1023],"expected":2036},
    {"input":[1024],"expected":2047},
    {"input":[65537],"expected":131072},
    {"input":[999999],"expected":1999986},
    {"input":[1000000],"expected":1999993}
  ]
}
```

Create `concepts/big-o/exercises/02-halving-ticks/stress.ts`:

```ts
import type { StressCase } from "../../../../runner/src/stress.ts";

export default function stress(): StressCase[] {
  return [{ name: "n=1e15", input: [1_000_000_000_000_000] }];
}
```

- [ ] **Step 6: Exercise 03 · Fits the budget**

Create `concepts/big-o/exercises/03-fits-budget/README.md`:

```markdown
---
id: big-o/03
title: Fits the budget
concept: big-o
---
# Fits the budget

## Statement

An online judge gives your code a budget of `100,000,000` (10⁸) steps. An algorithm whose work grows like `growth` takes this many steps on an input of size `n`:

| `growth` | Steps |
|---|---|
| `"1"` | 1 |
| `"log n"` | log₂ n |
| `"n"` | n |
| `"n log n"` | n · log₂ n |
| `"n^2"` | n² |
| `"n^3"` | n³ |
| `"2^n"` | 2ⁿ |
| `"n!"` | n! = 1 · 2 · … · n |

Return `true` if the number of steps is at most `100,000,000`, and `false` otherwise.

**Examples**

- `growth = "n^2", n = 10000` → `true` (exactly 10⁸ steps still fits)
- `growth = "n^2", n = 10001` → `false`
- `growth = "n!", n = 12` → `false` (12! = 479,001,600)

**Constraints:** `1 <= n <= 10^9` · `growth` is one of the eight strings in the table
```

Create `concepts/big-o/exercises/03-fits-budget/cases.json`:

```json
{
  "mode": "function",
  "entry": "fitsBudget",
  "params": [
    {"name":"growth","type":"string"},
    {"name":"n","type":"int"}
  ],
  "returns": "bool",
  "compare": "exact",
  "examples": [
    {"input":["n^2",10000],"expected":true},
    {"input":["n^2",10001],"expected":false},
    {"input":["n!",12],"expected":false}
  ],
  "hidden": [
    {"input":["1",1000000000],"expected":true},
    {"input":["log n",1000000000],"expected":true},
    {"input":["n",100000001],"expected":false},
    {"input":["n log n",4194304],"expected":true},
    {"input":["n log n",8388608],"expected":false},
    {"input":["n^3",464],"expected":true},
    {"input":["n^3",465],"expected":false},
    {"input":["2^n",26],"expected":true},
    {"input":["2^n",27],"expected":false},
    {"input":["n!",11],"expected":true}
  ]
}
```

Create `concepts/big-o/exercises/03-fits-budget/stress.ts`:

```ts
import type { StressCase } from "../../../../runner/src/stress.ts";

export default function stress(): StressCase[] {
  return [
    { name: "n!, n=1e9", input: ["n!", 1_000_000_000] },
    { name: "2^n, n=1e9", input: ["2^n", 1_000_000_000] },
  ];
}
```

- [ ] **Step 7: Independent reference check**

Run procedure P3 for each exercise below. Each run prints `Filled 0 hidden expected value(s) in …`.

- `big-o/01`
- `big-o/02`
- `big-o/03`

- [ ] **Step 8: Byte check**

Run procedure P2 on the 10 new content files. Expected hashes:

| File | SHA-256 |
|---|---|
| `concepts/big-o/README.md` | `c6e332da04f1ccdb9300fee6da5c51d9efd2a41052083a8df74bfc9b95d5adc0` |
| `concepts/big-o/exercises/01-pair-ticks/README.md` | `a7b77bba2188c71b2bae872926ff507c15af5d7e90b41d2b35e6da47eb85124c` |
| `concepts/big-o/exercises/01-pair-ticks/cases.json` | `fc0c96454e2489fd67e8e8877daeafacaf8f73872c88dbc6b124cfaac76641cb` |
| `concepts/big-o/exercises/01-pair-ticks/stress.ts` | `9fecd7f82194252b942228a5b514f5e3c9b8bddad70b03fc8de640c48b13769a` |
| `concepts/big-o/exercises/02-halving-ticks/README.md` | `01ef41dcc49fbe96e606e16a0fbbffb193c2c7d5ce2ad9b779098c230ce1267e` |
| `concepts/big-o/exercises/02-halving-ticks/cases.json` | `9893b4dfd3fdbac0979006d1929eda2eef6f2d90a95d0e103959d3ed87b7497a` |
| `concepts/big-o/exercises/02-halving-ticks/stress.ts` | `9d334c40536b6564848787a3caf5dcb70a08b833c6c29237497fbd99ecef1373` |
| `concepts/big-o/exercises/03-fits-budget/README.md` | `195fef6a4ced163e2356508673be08df17dcfb325cbadcb68b69814c94bb5221` |
| `concepts/big-o/exercises/03-fits-budget/cases.json` | `85b13dd7c616a7ffaa9a3d06f83ce1dde49dd09cfb6331d72d04b41355649651` |
| `concepts/big-o/exercises/03-fits-budget/stress.ts` | `6d1bce8f54dd45da6ce2f095ecee84792c1dedaa18b84e6d8b66256523315fc8` |

- [ ] **Step 9: Non-isomorphism review**

Run procedure P4 with `big-o`. Expected output, and the review it must confirm:

```
big-o/01  (int) -> int  same signature: lc-0070-climbing-stairs
big-o/02  (int) -> int  same signature: lc-0070-climbing-stairs
big-o/03  (string, int) -> bool  same signature: none
```

| Exercise | Signature | It asks | Same signature in `problems/` | Why the question differs |
|---|---|---|---|---|
| `big-o/01` Pair ticks | `(int) -> int` | the final value of a counter in a printed double loop, for a given n | lc-0070 | lc-0070 counts the ways to climb a staircase taking 1 or 2 steps at a time; there is no loop to count in it |
| `big-o/02` Halving ticks | `(int) -> int` | the final value of a counter in a printed loop that halves its size each round | lc-0070 | as above |
| `big-o/03` Fits the budget | `(string, int) -> bool` | whether a named growth rate's step count at n is at most 10⁸ | none | no problem asks about growth rates; the nearest numeric ones, lc-2894 (the difference of two sums over 1..n) and lc-0009 (is a number a palindrome), ask unrelated questions |

None of the three is a problem of Grind 169 or NeetCode 150 either, to the author's knowledge (those lists are not in the repo yet); if you recognize one, report it.

- [ ] **Step 10: Auto-sections**

Run procedure P5 with `big-o`. Expected: `big-o: the auto-sections match pnpm sync`.

- [ ] **Step 11: Run the tests and the checks**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: PASS.

Run: `pnpm -s check 2>&1 | tail -1` and `pnpm -s check 2>&1 | grep -E "concepts/big-o|\"big-o\""`
Expected: `0 error(s), W warning(s)`, where `W` is the count P1 recorded in `$S/task-1-check.txt`. The second command prints nothing.

Run: `pnpm verify`
Expected: green.

- [ ] **Step 12: Review the tree and commit**

Run procedure P1 steps 2 and 3. The new paths are exactly:

- `concepts/big-o/README.md`
- `concepts/big-o/exercises/01-pair-ticks/README.md`
- `concepts/big-o/exercises/01-pair-ticks/cases.json`
- `concepts/big-o/exercises/01-pair-ticks/stress.ts`
- `concepts/big-o/exercises/02-halving-ticks/README.md`
- `concepts/big-o/exercises/02-halving-ticks/cases.json`
- `concepts/big-o/exercises/02-halving-ticks/stress.ts`
- `concepts/big-o/exercises/03-fits-budget/README.md`
- `concepts/big-o/exercises/03-fits-budget/cases.json`
- `concepts/big-o/exercises/03-fits-budget/stress.ts`
- `study/tests/phase-zero.test.ts`

```bash
git add concepts/big-o/README.md concepts/big-o/exercises/01-pair-ticks/README.md concepts/big-o/exercises/01-pair-ticks/cases.json concepts/big-o/exercises/01-pair-ticks/stress.ts concepts/big-o/exercises/02-halving-ticks/README.md concepts/big-o/exercises/02-halving-ticks/cases.json concepts/big-o/exercises/02-halving-ticks/stress.ts concepts/big-o/exercises/03-fits-budget/README.md concepts/big-o/exercises/03-fits-budget/cases.json concepts/big-o/exercises/03-fits-budget/stress.ts study/tests/phase-zero.test.ts
git commit -m "feat(concepts): add the big-o base concept and its exercises, and test phase 0 on a copy of the repo"
```

---

### Task 2: The `recursion` concept and its three exercises

**Files:**
- Create: `concepts/recursion/README.md`
- Create: `concepts/recursion/exercises/01-collatz-steps/README.md`
- Create: `concepts/recursion/exercises/01-collatz-steps/cases.json`
- Create: `concepts/recursion/exercises/02-echo/README.md`
- Create: `concepts/recursion/exercises/02-echo/cases.json`
- Create: `concepts/recursion/exercises/03-hanoi/README.md`
- Create: `concepts/recursion/exercises/03-hanoi/cases.json`
- Modify: `study/tests/phase-zero.test.ts` (one line, and one `describe` appended)

**Interfaces:**
- Consumes: Task 1's `study/tests/phase-zero.test.ts` (`WRITTEN`, `copy()`, `startCoach(c)`, `learn(c, slug)`, `DAY`); Plan B's `welcome-back` announcement (`payload: { date, daysAway }`) and `mode: "return"` after 7 or more idle days; the CLI's `ack <id>`.
- Produces: the concept `recursion` ("Recursion") and the exercises `recursion/01` (`collatzSteps`), `recursion/02` (`echo`), `recursion/03` (`hanoi`); a second `describe` in `study/tests/phase-zero.test.ts`.

Recursion second (the preset's order). The note teaches the base case, the recursive case, the leap of faith, the call stack, depth limits (Python stops near 1,000 nested calls) and exponential blow-up. Its exercises: a recursive definition turned into code (Collatz), work before and after the recursive call (Echo), and two calls per level (Tower of Hanoi). The inputs are small on purpose, so none has a stress case.

The note's examples (`total`, a sum with an index) stay away from the shapes of the unsolved problems that list `recursion` among their concepts (lc-0017, lc-0039, lc-0046, lc-0070, lc-0078, lc-0104, lc-0110, lc-0226, lc-0543). Its `## Problems` auto-section lists those nine, as `sync` would.

- [ ] **Step 0: Baseline**

Run procedure P1 step 1 with `N=2`.

- [ ] **Step 1: Write the failing tests**

In `study/tests/phase-zero.test.ts`:
1. Replace `const WRITTEN = ["big-o"];` with `const WRITTEN = ["big-o", "recursion"];`.
2. Append at the end of the file:

```ts

describe("phase 0 over the days (study coach spec §6.1, §6.4)", () => {
  it("welcomes the user back after nine idle days, still in phase 0, with the next base concept", async () => {
    const c = copy();
    await startCoach(c);
    const first = await c.json("today", "--json");
    expect((await c.cli("ack", String(first.announcements[0].id))).code).toBe(0);
    await learn(c, "big-o");
    c.clock.advance(9 * DAY);
    const plan = await c.json("today", "--json");
    expect(plan).toMatchObject({ mode: "return", phase: { id: "bases", progress: { done: 1, total: 5 } } });
    expect(plan.announcements).toEqual([expect.objectContaining({ key: "welcome-back", payload: expect.objectContaining({ daysAway: 9 }) })]);
    expect(plan.items).toEqual([expect.objectContaining({ kind: "concept", id: "recursion", missing: false })]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: FAIL, 2 tests: "plans the base concepts one a day…" and "welcomes the user back…". Both see the `recursion` row with `missing: true`: the note does not exist yet.

- [ ] **Step 3: The note**

Create `concepts/recursion/README.md`:

````markdown
---
slug: recursion
title: Recursion
requires: [big-o]
related: [sorting]
---
# Recursion

## Intuition

Picture a React component tree ⚛️. `<Dashboard>` does not know how to draw every chart: it renders `<Panel>`s and **trusts** each panel to render itself, and each panel trusts its `<Chart>`s. Nobody draws the whole page alone. Recursion is that trick for functions: a function solves a problem by calling **itself** on a smaller piece of it, and trusts that call to return the right answer.

Every recursive function has two parts:
- **The base case** 🛑: a piece so small you answer it directly (an empty list, n = 0, a single note). Without it the calls never stop.
- **The recursive case** 🔁: shrink the problem, call yourself on the smaller piece, then use that answer.

The mental leap is the **leap of faith** 🪂: when you write the recursive case, do not trace every call in your head. Assume the call on the smaller piece already works, and ask only "given that answer, how do I finish mine?". It feels like a looper pedal 🎛️: each layer plays on top of the layer below, and the stack of layers is the whole song.

Under the hood each call waits for the inner one on the **call stack**, like browser tabs opened one inside another: the last one opened is the first one closed.

## Diagram

`total(nums, i)` adds `nums[i:]`. The calls go down to the base case, then the answers come back up:

```
total([4, 1, 3], 0)
│  = 4 + total([4, 1, 3], 1)
│        │  = 1 + total([4, 1, 3], 2)
│        │        │  = 3 + total([4, 1, 3], 3)
│        │        │        │  = 0              ← base case: i is past the end
│        │        │  = 3 + 0 = 3               ← the stack unwinds…
│        │  = 1 + 3 = 4
│  = 4 + 4 = 8                                  ← …back to the first call

call stack at the deepest point (top = newest):
  total(…, 3)   ← returns first
  total(…, 2)
  total(…, 1)
  total(…, 0)   ← returns last
```

## Signals

- The problem is defined in terms of a **smaller version of itself** ("the answer for n uses the answer for n - 1")
- Nested, self-similar data: folders inside folders, comments with replies, components with children
- "Do it for the first part, then the same for the rest"
- Split in halves, solve each half, combine (you will meet it again in sorting)
- You need **every** combination or arrangement (later: backtracking)

## When it fails

- **No base case, or one you never reach** 🔁💥: `RecursionError: maximum recursion depth exceeded` in Python, `RangeError: Maximum call stack size exceeded` in TypeScript.
- **Too deep for the stack:** Python allows about 1,000 nested calls by default, Node about 10,000. One call per element of a 100,000-element list crashes; a loop does not. Use recursion when the depth stays small (a few hundred), or when it is about log n.
- **Exponential blow-up:** a function that calls itself twice on n - 1 makes about 2ⁿ calls. At n = 40 that is a trillion calls, even if each one is tiny. Count the calls (see the table) before you trust a branching recursion.
- **Hidden copies:** `total(nums[1:])` copies the rest of the list at every call, so a "linear" recursion becomes O(n²). Pass an index instead, as in the template.

## Typical complexity

| Shape | Calls | Time | Extra space (the stack) |
|---|---|---|---|
| One call on n - 1, O(1) work each | n | O(n) | O(n) |
| One call on n / 2, O(1) work each | log₂ n | O(log n) | O(log n) |
| Two calls on n - 1 | about 2ⁿ | O(2ⁿ) | O(n) |

Rule: time = number of calls × work per call; stack space = the deepest chain of calls.

## Template

The shape of every recursive function:

```python
def solve(problem):
    if is_small(problem):            # base case: answer directly
        return direct_answer(problem)
    smaller = shrink(problem)        # move toward the base case
    partial = solve(smaller)         # leap of faith: assume it works
    return combine(problem, partial) # finish your own part
```

The sum of a list, with an index instead of a copy — Python:

```python
def total(nums: list[int], i: int = 0) -> int:
    if i == len(nums):               # base case: nothing left
        return 0
    return nums[i] + total(nums, i + 1)
```

TypeScript:

```ts
function total(nums: number[], i = 0): number {
  if (i === nums.length) return 0; // base case: nothing left
  return nums[i] + total(nums, i + 1);
}
```

## Exercises

<!-- auto:exercises -->
- [01 · Collatz steps](exercises/01-collatz-steps/README.md)
- [02 · Echo](exercises/02-echo/README.md)
- [03 · Tower of Hanoi](exercises/03-hanoi/README.md)
<!-- /auto -->

## Quick checks

1. What happens if a recursive function has no base case? What error do you see in Python, and in TypeScript?
2. In the diagram, which runs first: the `4 +` of the first call, or the `0` of the base case? Why?
3. Why can a recursive sum over a 100,000-element list crash Python when a `for` loop does not?
4. A function calls itself twice, each time with n - 1. About how many calls does it make for n = 20?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
- [lc-0017 · Letter Combinations of a Phone Number](../../problems/lc-0017-letter-combinations-of-a-phone-number/README.md)
- [lc-0039 · Combination Sum](../../problems/lc-0039-combination-sum/README.md)
- [lc-0046 · Permutations](../../problems/lc-0046-permutations/README.md)
- [lc-0070 · Climbing Stairs](../../problems/lc-0070-climbing-stairs/README.md)
- [lc-0078 · Subsets](../../problems/lc-0078-subsets/README.md)
- [lc-0104 · Maximum Depth of Binary Tree](../../problems/lc-0104-maximum-depth-of-binary-tree/README.md)
- [lc-0110 · Balanced Binary Tree](../../problems/lc-0110-balanced-binary-tree/README.md)
- [lc-0226 · Invert Binary Tree](../../problems/lc-0226-invert-binary-tree/README.md)
- [lc-0543 · Diameter of Binary Tree](../../problems/lc-0543-diameter-of-binary-tree/README.md)
<!-- /auto -->
````

- [ ] **Step 4: Exercise 01 · Collatz steps**

Create `concepts/recursion/exercises/01-collatz-steps/README.md`:

````markdown
---
id: recursion/01
title: Collatz steps
concept: recursion
---
# Collatz steps

## Statement

The hailstone game starts from a positive integer `n` and repeats one rule: if the number is even, halve it; if it is odd, triple it and add one. The game ends at `1`. Written as a recursive definition:

```
steps(1) = 0
steps(n) = 1 + steps(n / 2)        if n is even
steps(n) = 1 + steps(3 * n + 1)    if n is odd
```

Return `steps(n)`: how many rule applications it takes to reach `1`.

**Examples**

- `n = 1` → `0`
- `n = 6` → `8` (6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1)
- `n = 7` → `16`

**Constraints:** `1 <= n <= 10^6` (along the way the numbers can grow far beyond 10^6, and every game reaches 1 in fewer than 600 steps)
````

Create `concepts/recursion/exercises/01-collatz-steps/cases.json`:

```json
{
  "mode": "function",
  "entry": "collatzSteps",
  "params": [
    {"name":"n","type":"int"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[1],"expected":0},
    {"input":[6],"expected":8},
    {"input":[7],"expected":16}
  ],
  "hidden": [
    {"input":[2],"expected":1},
    {"input":[3],"expected":7},
    {"input":[27],"expected":111},
    {"input":[97],"expected":118},
    {"input":[871],"expected":178},
    {"input":[1024],"expected":10},
    {"input":[77031],"expected":350},
    {"input":[524288],"expected":19},
    {"input":[837799],"expected":524},
    {"input":[999999],"expected":258}
  ]
}
```

- [ ] **Step 5: Exercise 02 · Echo**

Create `concepts/recursion/exercises/02-echo/README.md`:

```markdown
---
id: recursion/02
title: Echo
concept: recursion
---
# Echo

## Statement

An echo of `n` fades down to `1` and comes back up 🔊: the numbers `n, n - 1, …, 2, 1, 2, …, n - 1, n`, separated by single spaces. Return the echo of `n` as a string.

**Examples**

- `n = 1` → `"1"`
- `n = 3` → `"3 2 1 2 3"`
- `n = 5` → `"5 4 3 2 1 2 3 4 5"`

**Constraints:** `1 <= n <= 500`

**Follow-up:** write it with recursion, then notice what your function does *before* its recursive call and what it does *after* it returns.
```

Create `concepts/recursion/exercises/02-echo/cases.json`. Its hidden values are left empty on purpose (the outputs are long): P3 fills them, and P2 then checks the filled file against the hash below.

```json
{
  "mode": "function",
  "entry": "echo",
  "params": [
    {"name":"n","type":"int"}
  ],
  "returns": "string",
  "compare": "exact",
  "examples": [
    {"input":[1],"expected":"1"},
    {"input":[3],"expected":"3 2 1 2 3"},
    {"input":[5],"expected":"5 4 3 2 1 2 3 4 5"}
  ],
  "hidden": [
    {"input":[2]},
    {"input":[4]},
    {"input":[9]},
    {"input":[10]},
    {"input":[12]},
    {"input":[500]}
  ]
}
```

- [ ] **Step 6: Exercise 03 · Tower of Hanoi**

Create `concepts/recursion/exercises/03-hanoi/README.md`:

```markdown
---
id: recursion/03
title: Tower of Hanoi
concept: recursion
---
# Tower of Hanoi

## Statement

Three pegs are named `"A"`, `"B"` and `"C"`. Peg `A` holds `n` disks of different sizes, the largest at the bottom and the smallest on top. Move the whole tower to peg `C`, following two rules:

- move one disk at a time: the top disk of one peg goes onto the top of another;
- never put a disk on top of a smaller one.

Return the moves, in order, as strings `"<from>-><to>"` (for example `"A->C"`), using the fewest moves possible. The fewest-moves sequence is unique.

**Examples**

- `n = 1` → `["A->C"]`
- `n = 2` → `["A->B","A->C","B->C"]`
- `n = 3` → `["A->C","A->B","C->B","A->C","B->A","B->C","A->C"]`

**Constraints:** `1 <= n <= 12`
```

Create `concepts/recursion/exercises/03-hanoi/cases.json`. Its hidden values are left empty on purpose (the outputs are long): P3 fills them, and P2 then checks the filled file against the hash below.

```json
{
  "mode": "function",
  "entry": "hanoi",
  "params": [
    {"name":"n","type":"int"}
  ],
  "returns": "string[]",
  "compare": "exact",
  "examples": [
    {"input":[1],"expected":["A->C"]},
    {"input":[2],"expected":["A->B","A->C","B->C"]},
    {"input":[3],"expected":["A->C","A->B","C->B","A->C","B->A","B->C","A->C"]}
  ],
  "hidden": [
    {"input":[4]},
    {"input":[5]},
    {"input":[6]},
    {"input":[7]},
    {"input":[8]}
  ]
}
```

- [ ] **Step 7: Independent reference check**

Run procedure P3 for each exercise below. For `recursion/01` it prints `Filled 0 …`; for `recursion/02` `Filled 6 …` and for `recursion/03` `Filled 5 …`, because their hidden values start empty.

- `recursion/01`
- `recursion/02`
- `recursion/03`

- [ ] **Step 8: Byte check**

Run procedure P2 on the 7 new content files. Expected hashes:

| File | SHA-256 |
|---|---|
| `concepts/recursion/README.md` | `13c0ca3379c2fbdcec19d07d51c1b5d108e7687745801bccca6d8a83fdad3e23` |
| `concepts/recursion/exercises/01-collatz-steps/README.md` | `5c0489a7a517291ea46c92b53a43e2f264ad86e40ea2cdcfb9bb5aa90998cdee` |
| `concepts/recursion/exercises/01-collatz-steps/cases.json` | `1680f6d62536c33967d8b1b671a6c5be24c64ac8760fd5df278a9c412a8fe85b` |
| `concepts/recursion/exercises/02-echo/README.md` | `928355ac099995a2b9c80e6eaee963528b48a63069b6877fa5bcdda6730923e1` |
| `concepts/recursion/exercises/02-echo/cases.json` | `04cd23dcc4effd5096ade02a9318103ec1ead8d41335855858802e12bb19a452` |
| `concepts/recursion/exercises/03-hanoi/README.md` | `7fa329d3bc8400bd2e5ed74dca508e52cb3551e63ceaf8ca214db138a2b40bb4` |
| `concepts/recursion/exercises/03-hanoi/cases.json` | `3a4832b5ab78f0433681f32be6f84315440d93a43016a18376ed66fa2e000af7` |

- [ ] **Step 9: Non-isomorphism review**

Run procedure P4 with `recursion`. Expected output, and the review it must confirm:

```
recursion/01  (int) -> int  same signature: lc-0070-climbing-stairs
recursion/02  (int) -> string  same signature: none
recursion/03  (int) -> string[]  same signature: none
```

| Exercise | Signature | It asks | Same signature in `problems/` | Why the question differs |
|---|---|---|---|---|
| `recursion/01` Collatz steps | `(int) -> int` | how many applications of the hailstone rule take n to 1 | lc-0070 | lc-0070 counts the ways to climb a staircase; the hailstone rule has no choices to count |
| `recursion/02` Echo | `(int) -> string` | the string n … 2 1 2 … n | none | the nearest by theme, lc-0009 and lc-0125, decide whether something reads the same both ways; Echo builds a string and decides nothing |
| `recursion/03` Tower of Hanoi | `(int) -> string[]` | the shortest sequence of moves that carries n disks from peg A to peg C | none | lc-0017, lc-0046 and lc-0078 list every combination, ordering or subset of a given input; Hanoi has no input set, and its answer is one forced sequence |

None of the three is a problem of Grind 169 or NeetCode 150 either, to the author's knowledge (those lists are not in the repo yet); if you recognize one, report it.

- [ ] **Step 10: Auto-sections**

Run procedure P5 with `recursion`. Expected: `recursion: the auto-sections match pnpm sync`.

- [ ] **Step 11: Run the tests and the checks**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: PASS.

Run: `pnpm -s check 2>&1 | tail -1` and `pnpm -s check 2>&1 | grep -E "concepts/recursion|\"recursion\""`
Expected: `0 error(s), W−1 warning(s)` (`W` from `$S/task-2-check.txt`): the `"recursion" is referenced but not created` warning is gone. The second command prints nothing.

Run: `pnpm verify`
Expected: green.

- [ ] **Step 12: Review the tree and commit**

Run procedure P1 steps 2 and 3. The new paths are exactly:

- `concepts/recursion/README.md`
- `concepts/recursion/exercises/01-collatz-steps/README.md`
- `concepts/recursion/exercises/01-collatz-steps/cases.json`
- `concepts/recursion/exercises/02-echo/README.md`
- `concepts/recursion/exercises/02-echo/cases.json`
- `concepts/recursion/exercises/03-hanoi/README.md`
- `concepts/recursion/exercises/03-hanoi/cases.json`
- `study/tests/phase-zero.test.ts`

```bash
git add concepts/recursion/README.md concepts/recursion/exercises/01-collatz-steps/README.md concepts/recursion/exercises/01-collatz-steps/cases.json concepts/recursion/exercises/02-echo/README.md concepts/recursion/exercises/02-echo/cases.json concepts/recursion/exercises/03-hanoi/README.md concepts/recursion/exercises/03-hanoi/cases.json study/tests/phase-zero.test.ts
git commit -m "feat(concepts): add the recursion base concept and its exercises"
```

---

### Task 3: The `arrays-and-strings` concept and its three exercises

**Files:**
- Create: `concepts/arrays-and-strings/README.md`
- Create: `concepts/arrays-and-strings/exercises/01-regroup/README.md`
- Create: `concepts/arrays-and-strings/exercises/01-regroup/cases.json`
- Create: `concepts/arrays-and-strings/exercises/01-regroup/stress.ts`
- Create: `concepts/arrays-and-strings/exercises/02-letter-shift/README.md`
- Create: `concepts/arrays-and-strings/exercises/02-letter-shift/cases.json`
- Create: `concepts/arrays-and-strings/exercises/02-letter-shift/stress.ts`
- Create: `concepts/arrays-and-strings/exercises/03-headline/README.md`
- Create: `concepts/arrays-and-strings/exercises/03-headline/cases.json`
- Modify: `study/tests/phase-zero.test.ts` (one line)

**Interfaces:**
- Consumes: Task 1's `study/tests/phase-zero.test.ts` (`WRITTEN`).
- Produces: the concept `arrays-and-strings` ("Arrays and strings") and the exercises `arrays-and-strings/01` (`regroup`), `/02` (`shiftLetters`), `/03` (`headline`).

Arrays and strings third: the language essentials of sequences, in Python and TypeScript side by side (Decisions 2). The note teaches indexes and slices (and that slices copy), building results in a list, immutable strings and `join`, character codes, and grids read row by row, plus the classic traps (the shared-row grid, negative indexes in TypeScript, `"a" + 1`). Its exercises: re-laying a grid in rows of a new width, shifting letters along the alphabet, and normalizing a title's spaces and case. The first two have stress cases (the largest inputs the constraints allow).

Nothing references `arrays-and-strings` yet, so its `## Problems` auto-section is `_No problems yet._`.

- [ ] **Step 0: Baseline**

Run procedure P1 step 1 with `N=3`.

- [ ] **Step 1: Write the failing test**

In `study/tests/phase-zero.test.ts`, replace `const WRITTEN = ["big-o", "recursion"];` with `const WRITTEN = ["big-o", "recursion", "arrays-and-strings"];`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: FAIL, 1 test ("plans the base concepts one a day…"): on day 3 the `arrays-and-strings` row has `missing: true`.

- [ ] **Step 3: The note**

Create `concepts/arrays-and-strings/README.md`:

````markdown
---
slug: arrays-and-strings
title: Arrays and strings
requires: [big-o]
related: [two-pointers]
---
# Arrays and strings

## Intuition

An **array** (a Python `list`, a TypeScript `number[]`) is a row of numbered seats in a concert hall 🎭. Seat 57? Walk straight to it: reading or writing `nums[57]` costs the same as `nums[0]`, O(1). Adding a seat at the **end** is cheap too. But squeezing a new seat in at the **front** means every person stands up and moves one seat to the right: O(n).

A **string** is a row of characters, with one twist: in both Python and TypeScript it is **immutable** 🔒. Like a printed setlist, you never edit it in place: "changing" one letter builds a brand-new string. So build text from pieces (a list of parts, then one `join`) instead of gluing it together character by character.

Every character also has a **number**, its code, the way every key on a MIDI keyboard has a note number 🎹: `"a"` is 97, `"b"` is 98, … `"z"` is 122, and `"A"` is 65. Arithmetic on letters is arithmetic on those codes.

And a **grid** (a list of rows) is your dashboard layout 📊: `grid[row][col]`, rows first. Reading it "row by row" means left to right, top to bottom, like reading a page.

## Diagram

Indexes and slices:

```
index:     0    1    2    3    4
nums  = [ 10 , 20 , 30 , 40 , 50 ]
         ↑                      ↑
       nums[0]          nums[-1] (Python) / nums.at(-1) (TS)

nums[1:4]        → [20, 30, 40]   start included, end excluded — and it is a COPY
nums.slice(1, 4) → [20, 30, 40]   the same in TypeScript
```

A grid, row by row:

```
grid = [[1, 2, 3],        grid[0] → [1, 2, 3]     (a whole row)
        [4, 5, 6]]        grid[1][2] → 6          (row 1, column 2)

reading order: 1 → 2 → 3 → 4 → 5 → 6
```

Characters and codes:

```
"a"  97      "b"  98      …      "z"  122
"A"  65      "B"  66      …      "Z"   90
" "  32      "0"  48      "!"    33

ord("c") - ord("a")  → 2         "c".charCodeAt(0) - "a".charCodeAt(0)  → 2
chr(97 + 2)          → "c"       String.fromCharCode(97 + 2)            → "c"
```

## Signals

- "The element at position i", "the first k", "from index i to j": indexes and slices
- "Return a new array/string where each …": build the result in a list, then return it (or `join` it)
- "Letters", "uppercase/lowercase", "shift", "alphabet position": character codes
- "A grid", "a matrix", "rows and columns": nested lists, `grid[r][c]`
- "In place": you must change the given array instead of building a new one

## When it fails

- **Gluing strings in a loop:** `s = s + piece` can copy the whole string every time. Collect the pieces in a list and `"".join(pieces)` / `pieces.join("")` once.
- **Slices are copies:** `nums[1:]` inside a loop over `nums` turns O(n) into O(n²).
- **The shared-row trap:** in Python, `[[0] * 3] * 2` makes two references to *the same* row; changing one changes both. Use `[[0] * 3 for _ in range(2)]`. TypeScript's `new Array(2).fill([])` has the same trap: use `Array.from({ length: 2 }, () => [])`.
- **Off by one:** `range(a, b)` and `slice(a, b)` stop **before** `b`.
- **Negative indexes:** Python's `nums[-1]` is the last element; in TypeScript `nums[-1]` is `undefined`. Use `nums.at(-1)`.
- **Mixing types:** `"a" + 1` is `"a1"` in TypeScript and a `TypeError` in Python.

## Typical complexity

| Operation | Python | TypeScript | Cost |
|---|---|---|---|
| read or write by index | `nums[i]` | `nums[i]` | O(1) |
| add or remove at the end | `append`, `pop()` | `push`, `pop()` | O(1) (amortized) |
| add or remove at the front | `insert(0, x)`, `pop(0)` | `unshift`, `shift` | O(n) |
| search for a value | `x in nums`, `index` | `includes`, `indexOf` | O(n) |
| slice of length k | `nums[a:b]` | `slice(a, b)` | O(k) |
| join pieces of total length L | `"".join(parts)` | `parts.join("")` | O(L) |
| length | `len(s)` | `s.length` | O(1) |

## Template

Python:

```python
nums = [3, 1, 4]

for i, x in enumerate(nums):        # index and value together
    print(i, x)

doubled = []                        # build a new list
for x in nums:
    doubled.append(x * 2)

words = "  hi   there ".split()     # ["hi", "there"]: split() with no argument skips runs of spaces
loud = " ".join(w.upper() for w in words)   # "HI THERE"

rows, cols = 2, 3
grid = [[0] * cols for _ in range(rows)]    # each row is its own list
grid[1][2] = 7

position = ord("d") - ord("a")      # 3: the letter's place in the alphabet
letter = chr(ord("a") + position)   # "d" again
```

TypeScript:

```ts
const nums = [3, 1, 4];

nums.forEach((x, i) => console.log(i, x)); // index and value together

const doubled: number[] = []; // build a new array
for (const x of nums) doubled.push(x * 2);

const words = "  hi   there ".trim().split(/\s+/); // ["hi", "there"]
const loud = words.map((w) => w.toUpperCase()).join(" "); // "HI THERE"

const rows = 2;
const cols = 3;
const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0)); // each row is its own array
grid[1][2] = 7;

const position = "d".charCodeAt(0) - "a".charCodeAt(0); // 3
const letter = String.fromCharCode("a".charCodeAt(0) + position); // "d" again
```

One TypeScript catch: `"".trim().split(/\s+/)` returns `[""]`, not `[]`.

## Exercises

<!-- auto:exercises -->
- [01 · Regroup](exercises/01-regroup/README.md)
- [02 · Letter shift](exercises/02-letter-shift/README.md)
- [03 · Headline case](exercises/03-headline/README.md)
<!-- /auto -->

## Quick checks

1. Why does adding at the front (`insert(0, x)`, `unshift`) cost O(n), while adding at the end costs O(1)?
2. What goes wrong with `grid = [[0] * 3] * 2` after `grid[0][0] = 5`?
3. A grid has `cols` columns and you number its cells 0, 1, 2… row by row. In which row and column does cell number `k` sit?
4. Strings are immutable. What does that mean for code that changes one letter of a long string a thousand times?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
_No problems yet._
<!-- /auto -->
````

- [ ] **Step 4: Exercise 01 · Regroup**

Create `concepts/arrays-and-strings/exercises/01-regroup/README.md`:

```markdown
---
id: arrays-and-strings/01
title: Regroup
concept: arrays-and-strings
---
# Regroup

## Statement

A dashboard shows its widgets in rows; `grid[r]` is row `r`, and rows may have different lengths. The screen changes width 📱: lay out the same widgets again, in the same reading order (row by row, left to right), in rows of exactly `cols` widgets. Only the last row may be shorter. Return the new grid; it never contains an empty row.

**Examples**

- `grid = [[1,2,3],[4,5,6]], cols = 2` → `[[1,2],[3,4],[5,6]]`
- `grid = [[1,2],[3,4],[5]], cols = 4` → `[[1,2,3,4],[5]]`
- `grid = [[7]], cols = 3` → `[[7]]`

**Constraints:** `0 <= grid.length <= 10^5` · `0 <= grid[r].length` · at most `10^5` widgets in total · `1 <= cols <= 10^5` · `-10^9 <= grid[r][c] <= 10^9`
```

Create `concepts/arrays-and-strings/exercises/01-regroup/cases.json`:

```json
{
  "mode": "function",
  "entry": "regroup",
  "params": [
    {"name":"grid","type":"int[][]"},
    {"name":"cols","type":"int"}
  ],
  "returns": "int[][]",
  "compare": "exact",
  "examples": [
    {"input":[[[1,2,3],[4,5,6]],2],"expected":[[1,2],[3,4],[5,6]]},
    {"input":[[[1,2],[3,4],[5]],4],"expected":[[1,2,3,4],[5]]},
    {"input":[[[7]],3],"expected":[[7]]}
  ],
  "hidden": [
    {"input":[[],2],"expected":[]},
    {"input":[[[],[]],3],"expected":[]},
    {"input":[[[1,2,3,4]],1],"expected":[[1],[2],[3],[4]]},
    {"input":[[[1],[2],[3]],3],"expected":[[1,2,3]]},
    {"input":[[[],[1,2],[]],1],"expected":[[1],[2]]},
    {"input":[[[1,2,3]],5],"expected":[[1,2,3]]},
    {"input":[[[-1,0],[1,2],[3,4]],4],"expected":[[-1,0,1,2],[3,4]]},
    {"input":[[[5,5],[5,5]],3],"expected":[[5,5,5],[5]]},
    {"input":[[[1,2,3],[4,5,6],[7,8,9]],2],"expected":[[1,2],[3,4],[5,6],[7,8],[9]]},
    {"input":[[[1000000000,-1000000000]],1],"expected":[[1000000000],[-1000000000]]}
  ]
}
```

Create `concepts/arrays-and-strings/exercises/01-regroup/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const manyRows = Array.from({ length: 100_000 }, () => [rng.int(-1_000_000_000, 1_000_000_000)]);
  const oneRow = [rng.intArray(100_000, -1_000_000_000, 1_000_000_000)];
  return [
    { name: "1e5 rows of one widget, cols=3", input: [manyRows, 3] },
    { name: "one row of 1e5 widgets, cols=1", input: [oneRow, 1] },
  ];
}
```

- [ ] **Step 5: Exercise 02 · Letter shift**

Create `concepts/arrays-and-strings/exercises/02-letter-shift/README.md`:

```markdown
---
id: arrays-and-strings/02
title: Letter shift
concept: arrays-and-strings
---
# Letter shift

## Statement

To keep tonight's setlist secret 🤫, shift every letter of `text` forward by `k` places in the alphabet, wrapping around after `z` (with `k = 1`, `z` becomes `a`). Uppercase letters stay uppercase and lowercase letters stay lowercase. Every other character (digits, spaces, punctuation) stays as it is. Return the shifted text.

**Examples**

- `text = "abc xyz", k = 1` → `"bcd yza"`
- `text = "Hello, World!", k = 3` → `"Khoor, Zruog!"`
- `text = "Zz9", k = 27` → `"Aa9"`

**Constraints:** `0 <= text.length <= 10^5` · `text` has printable ASCII characters only (codes 32 to 126) · `0 <= k <= 10^9`
```

Create `concepts/arrays-and-strings/exercises/02-letter-shift/cases.json`:

```json
{
  "mode": "function",
  "entry": "shiftLetters",
  "params": [
    {"name":"text","type":"string"},
    {"name":"k","type":"int"}
  ],
  "returns": "string",
  "compare": "exact",
  "examples": [
    {"input":["abc xyz",1],"expected":"bcd yza"},
    {"input":["Hello, World!",3],"expected":"Khoor, Zruog!"},
    {"input":["Zz9",27],"expected":"Aa9"}
  ],
  "hidden": [
    {"input":["",5],"expected":""},
    {"input":["a",0],"expected":"a"},
    {"input":["a",26],"expected":"a"},
    {"input":["The quick brown fox",13],"expected":"Gur dhvpx oebja sbk"},
    {"input":["12345 !?",7],"expected":"12345 !?"},
    {"input":["AZaz",25],"expected":"ZYzy"},
    {"input":["mIxEd CaSe",52],"expected":"mIxEd CaSe"},
    {"input":["@[`{~",3],"expected":"@[`{~"},
    {"input":["zzz",100],"expected":"vvv"},
    {"input":["Bye",78],"expected":"Bye"}
  ]
}
```

Create `concepts/arrays-and-strings/exercises/02-letter-shift/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const text = Array.from({ length: 100_000 }, () => String.fromCharCode(rng.int(32, 126))).join("");
  return [{ name: "1e5 characters, k=999999937", input: [text, 999_999_937] }];
}
```

- [ ] **Step 6: Exercise 03 · Headline case**

Create `concepts/arrays-and-strings/exercises/03-headline/README.md`:

```markdown
---
id: arrays-and-strings/03
title: Headline case
concept: arrays-and-strings
---
# Headline case

## Statement

A chart title arrives messy from an IoT device 📟. Its words are separated by one or more spaces, and there may be spaces at the start and at the end. Return the words joined by single spaces, each one with its first character in uppercase and the rest in lowercase. A first character that is a digit stays as it is.

**Examples**

- `text = "  live   SENSOR data "` → `"Live Sensor Data"`
- `text = "iOT"` → `"Iot"`
- `text = "   "` → `""`

**Constraints:** `0 <= text.length <= 10^4` · `text` has English letters, digits and spaces only
```

Create `concepts/arrays-and-strings/exercises/03-headline/cases.json`:

```json
{
  "mode": "function",
  "entry": "headline",
  "params": [
    {"name":"text","type":"string"}
  ],
  "returns": "string",
  "compare": "exact",
  "examples": [
    {"input":["  live   SENSOR data "],"expected":"Live Sensor Data"},
    {"input":["iOT"],"expected":"Iot"},
    {"input":["   "],"expected":""}
  ],
  "hidden": [
    {"input":[""],"expected":""},
    {"input":["a"],"expected":"A"},
    {"input":["ALL CAPS HERE"],"expected":"All Caps Here"},
    {"input":["  x  "],"expected":"X"},
    {"input":["2nd floor 3d view"],"expected":"2nd Floor 3d View"},
    {"input":["mIxEd"],"expected":"Mixed"},
    {"input":["one two  three   four"],"expected":"One Two Three Four"},
    {"input":["a b c"],"expected":"A B C"},
    {"input":["123 456"],"expected":"123 456"},
    {"input":["hELLO wORLD 42"],"expected":"Hello World 42"}
  ]
}
```

- [ ] **Step 7: Independent reference check**

Run procedure P3 for each exercise below. Each run prints `Filled 0 hidden expected value(s) in …`.

- `arrays-and-strings/01`
- `arrays-and-strings/02`
- `arrays-and-strings/03`

- [ ] **Step 8: Byte check**

Run procedure P2 on the 9 new content files. Expected hashes:

| File | SHA-256 |
|---|---|
| `concepts/arrays-and-strings/README.md` | `9bbd46556bb2669ca91d5927df5f39debec21d58720fe71ad3dd3530e8cb845d` |
| `concepts/arrays-and-strings/exercises/01-regroup/README.md` | `87463ab032d950d77c5110965d1e26edc412f84c9ae6e23f80f4015e1b5c3ba6` |
| `concepts/arrays-and-strings/exercises/01-regroup/cases.json` | `dde86303c84c2c7687dde9943d0bb96f1986945c420ab7d4b84aa307287e1ec3` |
| `concepts/arrays-and-strings/exercises/01-regroup/stress.ts` | `5dd757b0c72d2f328b0f5983264d3f4ef94ebd5c0884d0db7b26cd12a10ddb28` |
| `concepts/arrays-and-strings/exercises/02-letter-shift/README.md` | `9f9c2acbf05bf8d3c54eaefaa8d22c9e43e9b37c6350b93ce3c4ef306a71b1af` |
| `concepts/arrays-and-strings/exercises/02-letter-shift/cases.json` | `93c6288c64e1d0c909bd9c47790ca56571c27210565fe47429d6563c97ebab9a` |
| `concepts/arrays-and-strings/exercises/02-letter-shift/stress.ts` | `1bbbfece14d6e020fa7f4ef7011f91a31c9e143ac43ea77623d669d55978da0b` |
| `concepts/arrays-and-strings/exercises/03-headline/README.md` | `5d2694d6b540af7a54bc28320ea820f9380a65d118c52fd38be8ffc01d2d9c6d` |
| `concepts/arrays-and-strings/exercises/03-headline/cases.json` | `f8e0ea617823be88bcc1e6d8006490157642c6150d4e2ca27b988d3e10d5d05a` |

- [ ] **Step 9: Non-isomorphism review**

Run procedure P4 with `arrays-and-strings`. Expected output, and the review it must confirm:

```
arrays-and-strings/01  (int[][], int) -> int[][]  same signature: lc-0973-k-closest-points-to-origin
arrays-and-strings/02  (string, int) -> string  same signature: none
arrays-and-strings/03  (string) -> string  same signature: lc-0005-longest-palindromic-substring, lc-3280-convert-date-to-binary
```

| Exercise | Signature | It asks | Same signature in `problems/` | Why the question differs |
|---|---|---|---|---|
| `arrays-and-strings/01` Regroup | `(int[][], int) -> int[][]` | the same values, in reading order, laid out in rows of `cols` | lc-0973 | lc-0973 selects the k points closest to the origin; Regroup keeps every value and only moves the row breaks. lc-0054 (spiral order) and lc-1672 (the richest row) read a grid for other answers |
| `arrays-and-strings/02` Letter shift | `(string, int) -> string` | the text with every letter moved k places along the alphabet, wrapping, case kept | none | lc-3110 scores a string by its neighbouring character codes and lc-0067 adds two binary strings; neither transforms letters |
| `arrays-and-strings/03` Headline case | `(string) -> string` | the words rejoined with single spaces, each with its first character upper and the rest lower | lc-0005, lc-3280 | lc-0005 asks for the longest palindromic substring and lc-3280 for a date written in binary; lc-0058 also splits words, but asks for the last word's length |

None of the three is a problem of Grind 169 or NeetCode 150 either, to the author's knowledge (those lists are not in the repo yet); if you recognize one, report it.

- [ ] **Step 10: Auto-sections**

Run procedure P5 with `arrays-and-strings`. Expected: `arrays-and-strings: the auto-sections match pnpm sync`.

- [ ] **Step 11: Run the tests and the checks**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: PASS.

Run: `pnpm -s check 2>&1 | tail -1` and `pnpm -s check 2>&1 | grep -E "concepts/arrays-and-strings|\"arrays-and-strings\""`
Expected: `0 error(s), W warning(s)` (`W` from `$S/task-3-check.txt`). The second command prints nothing.

Run: `pnpm verify`
Expected: green.

- [ ] **Step 12: Review the tree and commit**

Run procedure P1 steps 2 and 3. The new paths are exactly:

- `concepts/arrays-and-strings/README.md`
- `concepts/arrays-and-strings/exercises/01-regroup/README.md`
- `concepts/arrays-and-strings/exercises/01-regroup/cases.json`
- `concepts/arrays-and-strings/exercises/01-regroup/stress.ts`
- `concepts/arrays-and-strings/exercises/02-letter-shift/README.md`
- `concepts/arrays-and-strings/exercises/02-letter-shift/cases.json`
- `concepts/arrays-and-strings/exercises/02-letter-shift/stress.ts`
- `concepts/arrays-and-strings/exercises/03-headline/README.md`
- `concepts/arrays-and-strings/exercises/03-headline/cases.json`
- `study/tests/phase-zero.test.ts`

```bash
git add concepts/arrays-and-strings/README.md concepts/arrays-and-strings/exercises/01-regroup/README.md concepts/arrays-and-strings/exercises/01-regroup/cases.json concepts/arrays-and-strings/exercises/01-regroup/stress.ts concepts/arrays-and-strings/exercises/02-letter-shift/README.md concepts/arrays-and-strings/exercises/02-letter-shift/cases.json concepts/arrays-and-strings/exercises/02-letter-shift/stress.ts concepts/arrays-and-strings/exercises/03-headline/README.md concepts/arrays-and-strings/exercises/03-headline/cases.json study/tests/phase-zero.test.ts
git commit -m "feat(concepts): add the arrays-and-strings base concept and its exercises"
```

---

### Task 4: The `maps-and-sets` concept and its three exercises

**Files:**
- Create: `concepts/maps-and-sets/README.md`
- Create: `concepts/maps-and-sets/exercises/01-settings/README.md`
- Create: `concepts/maps-and-sets/exercises/01-settings/cases.json`
- Create: `concepts/maps-and-sets/exercises/01-settings/stress.ts`
- Create: `concepts/maps-and-sets/exercises/02-lineups/README.md`
- Create: `concepts/maps-and-sets/exercises/02-lineups/cases.json`
- Create: `concepts/maps-and-sets/exercises/03-robot-trail/README.md`
- Create: `concepts/maps-and-sets/exercises/03-robot-trail/cases.json`
- Create: `concepts/maps-and-sets/exercises/03-robot-trail/stress.ts`
- Modify: `study/tests/phase-zero.test.ts` (one line)

**Interfaces:**
- Consumes: Task 1's `study/tests/phase-zero.test.ts` (`WRITTEN`); Task 3's concept (this note `requires` it).
- Produces: the concept `maps-and-sets` ("Maps and sets") and the exercises `maps-and-sets/01` (`applySettings`), `/02` (`lineups`), `/03` (`robotTrail`).

Maps and sets fourth. **The boundary with `hash-map` is Decisions 1:** this note is about *using* `dict`/`set` and `Map`/`Set` fluently in both languages (create, read safely, overwrite, delete, iterate, set operations, composite keys, the O(1) cost model, and the traps: `KeyError`, changing a dict while looping, identity keys in TypeScript, plain objects and `__proto__`, insertion order). It links to `hash-map` for *why* lookups are O(1) and for the problem patterns built on them, and its exercises do none of those patterns (no seen-before, no counting answer, no grouping). Its exercises: applying a log of settings changes, comparing festival days, and counting the different cells a robot visits. Two have stress cases.

`concepts/hash-map/` is not touched (it holds the user's uncommitted edits).

- [ ] **Step 0: Baseline**

Run procedure P1 step 1 with `N=4`.

- [ ] **Step 1: Write the failing test**

In `study/tests/phase-zero.test.ts`, replace `const WRITTEN = ["big-o", "recursion", "arrays-and-strings"];` with `const WRITTEN = ["big-o", "recursion", "arrays-and-strings", "maps-and-sets"];`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: FAIL, 1 test ("plans the base concepts one a day…"): on day 4 the `maps-and-sets` row has `missing: true`.

- [ ] **Step 3: The note**

Create `concepts/maps-and-sets/README.md`:

````markdown
---
slug: maps-and-sets
title: Maps and sets
requires: [big-o, arrays-and-strings]
related: [hash-map]
---
# Maps and sets

## Intuition

A **map** (Python `dict`, TypeScript `Map`) is the channel strip of a mixing console 🎚️: every fader has a label (`"vocals"`, `"kick"`), and you reach a fader by its **label**, not by counting positions. Labels are unique; asking for one is O(1) on average, however many channels there are. You already use the idea in frontend code: feature flags, `localStorage`, a `usersById` lookup.

A **set** (Python `set`, TypeScript `Set`) is the guest list at the door 🎟️: a name is on it or it is not. No duplicates, and "is this name on the list?" is also O(1) on average. That is the big difference with a list, where `x in my_list` reads the list from the start.

This note is about **using** them fluently in both languages: creating, reading safely, updating, deleting, iterating, combining sets, and choosing keys. *Why* the lookup is O(1) (hashing, buckets and collisions), and the problem patterns built on it, come with the [hash map](../hash-map/README.md) concept.

## Diagram

A map from channel to volume:

```
volumes = { "vocals": 7, "kick": 9 }

volumes["bass"] = 5        insert     { vocals: 7, kick: 9, bass: 5 }
volumes["kick"] = 6        overwrite  { vocals: 7, kick: 6, bass: 5 }
volumes.pop("vocals")      delete     { kick: 6, bass: 5 }
"kick" in volumes          → True     (looks at the KEYS)
6 in volumes               → False    (6 is a value, not a key)
volumes.get("pads", 0)     → 0        (a default instead of a KeyError)
```

Two sets and the three regions between them:

```
a = {"red", "green", "blue"}        b = {"blue", "black"}

   only in a        in both        only in b
 ┌────────────┐   ┌────────┐   ┌───────────┐
 │ red  green │   │  blue  │   │   black   │
 └────────────┘   └────────┘   └───────────┘
     a - b           a & b         b - a          a | b = all four colors
```

## Signals

- "Look up by name / id / key": a map instead of searching a list
- "Unique", "distinct", "remove duplicates": a set
- "Is x one of these?", asked many times: a set (O(1)) instead of `in list` (O(n))
- "In both", "in either", "in one but not the other": set operations
- A key made of several parts (a cell `(row, col)`, a pair of names): a composite key

## When it fails

- **Reading a missing key:** Python's `d["x"]` raises `KeyError`; use `d.get("x", default)` or check `"x" in d` first. TypeScript's `m.get("x")` returns `undefined`.
- **Changing a dict while you loop over it:** Python raises `RuntimeError`. Loop over `list(d)` (a copy of the keys) when you need to delete.
- **Keys must be immutable in Python:** a `list` cannot be a key or a set element; a `tuple` can: `seen.add((row, col))`.
- **TypeScript compares object keys by identity:** `new Set([[0, 1]]).has([0, 1])` is `false`, because they are two different arrays. Build a string key: `` `${row},${col}` ``.
- **Plain objects are not maps:** `{}` turns every key into a string and already "has" keys such as `"constructor"`; setting `obj["__proto__"]` does not even store a value. Use `Map` and `Set` for data.
- **Order:** both languages iterate in **insertion** order, never in sorted order. Sort the keys when the output must be sorted.

## Typical complexity

| Operation | Python | TypeScript | Average cost |
|---|---|---|---|
| insert or overwrite | `d[k] = v` | `m.set(k, v)` | O(1) |
| read | `d[k]`, `d.get(k, default)` | `m.get(k)` | O(1) |
| delete | `d.pop(k, None)`, `del d[k]` | `m.delete(k)` | O(1) |
| membership | `k in d`, `x in s` | `m.has(k)`, `s.has(x)` | O(1) |
| size | `len(d)` | `m.size` | O(1) |
| build a set from n items | `set(items)` | `new Set(items)` | O(n) |
| intersection / union / difference | `a & b`, `a \| b`, `a - b` | filter over one set, `has` on the other | O(size of the sets) |

Worst cases can be O(n) per operation, but with the built-in types you can count on O(1).

## Template

Python:

```python
volumes: dict[str, int] = {}
volumes["kick"] = 9                 # insert or overwrite
volumes.get("snare", 0)             # 0: a default for a missing key
volumes.pop("kick", None)           # delete if present, no error otherwise

for channel, volume in volumes.items():   # keys and values, in insertion order
    print(channel, volume)

a = {"red", "green", "blue"}
b = {"blue", "black"}
a & b, a | b, a - b                 # intersection, union, difference
sorted(a)                           # a list, in alphabetical order

visited: set[tuple[int, int]] = set()
visited.add((2, 3))                 # a tuple key: (row, col)
(2, 3) in visited                   # True
```

TypeScript:

```ts
const volumes = new Map<string, number>();
volumes.set("kick", 9); // insert or overwrite
volumes.get("snare") ?? 0; // 0: a default for a missing key
volumes.delete("kick"); // false when it was not there; no error either way

for (const [channel, volume] of volumes) console.log(channel, volume); // insertion order

const a = new Set(["red", "green", "blue"]);
const b = new Set(["blue", "black"]);
const both = [...a].filter((x) => b.has(x)); // intersection
const either = new Set([...a, ...b]); // union
const onlyA = [...a].filter((x) => !b.has(x)); // difference
[...a].sort(); // an array, in alphabetical order

const visited = new Set<string>();
visited.add(`${2},${3}`); // a string key for (row, col)
visited.has("2,3"); // true
```

Node 22+ also has `a.intersection(b)`, `a.union(b)` and `a.difference(b)`, but this repo's TypeScript settings (`lib: ES2023`) do not declare them yet: use the filter form.

## Exercises

<!-- auto:exercises -->
- [01 · Settings](exercises/01-settings/README.md)
- [02 · Lineups](exercises/02-lineups/README.md)
- [03 · Robot trail](exercises/03-robot-trail/README.md)
<!-- /auto -->

## Quick checks

1. Why is `x in my_set` O(1) on average while `x in my_list` is O(n)? What does that mean inside a loop over 10⁵ items?
2. In Python, `"kick" in volumes` is `True` and `9 in volumes` is `False`, although 9 is stored. Why?
3. Why can't a Python `list` be a set element, and what do you use instead for a pair `(row, col)`? What about TypeScript?
4. You need the keys of a map in alphabetical order. Is the map's own order enough?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
_No problems yet._
<!-- /auto -->
````

- [ ] **Step 4: Exercise 01 · Settings**

Create `concepts/maps-and-sets/exercises/01-settings/README.md`:

```markdown
---
id: maps-and-sets/01
title: Settings
concept: maps-and-sets
---
# Settings

## Statement

A web app saves user settings as a log of changes ⚙️: change `i` sets the setting `keys[i]` to `values[i]`. An **empty** value means "remove this setting" (removing a setting that is not there does nothing). Apply the changes in order and return the final settings as strings `"<key>=<value>"`, in any order.

**Examples**

- `keys = ["theme","lang","theme"], values = ["dark","es","light"]` → `["theme=light","lang=es"]`
- `keys = ["beta","beta"], values = ["on",""]` → `[]`
- `keys = ["units"], values = [""]` → `[]`

**Constraints:** `0 <= keys.length == values.length <= 10^5` · keys have 1 to 20 characters, values 0 to 20 · both use lowercase and uppercase English letters, digits, `-` and `_`
```

Create `concepts/maps-and-sets/exercises/01-settings/cases.json`:

```json
{
  "mode": "function",
  "entry": "applySettings",
  "params": [
    {"name":"keys","type":"string[]"},
    {"name":"values","type":"string[]"}
  ],
  "returns": "string[]",
  "compare": "unordered",
  "examples": [
    {"input":[["theme","lang","theme"],["dark","es","light"]],"expected":["theme=light","lang=es"]},
    {"input":[["beta","beta"],["on",""]],"expected":[]},
    {"input":[["units"],[""]],"expected":[]}
  ],
  "hidden": [
    {"input":[[],[]],"expected":[]},
    {"input":[["a","b","c"],["1","2","3"]],"expected":["a=1","b=2","c=3"]},
    {"input":[["a","a","a"],["1","","2"]],"expected":["a=2"]},
    {"input":[["x","y","x","y"],["1","2","",""]],"expected":[]},
    {"input":[["__proto__","constructor"],["on","off"]],"expected":["__proto__=on","constructor=off"]},
    {"input":[["k-1","k_2","k-1"],["a","b",""]],"expected":["k_2=b"]},
    {"input":[["tostring","toString"],["","x"]],"expected":["toString=x"]},
    {"input":[["v"],["0"]],"expected":["v=0"]},
    {"input":[["a","b","a","b","c"],["x","y","z","","w"]],"expected":["a=z","c=w"]}
  ]
}
```

Create `concepts/maps-and-sets/exercises/01-settings/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 100_000;
  const distinct = Array.from({ length: n }, (_, i) => `key${i}`);
  const values = Array.from({ length: n }, () => `v${rng.int(0, 999)}`);
  const churnKeys = Array.from({ length: n }, () => `key${rng.int(0, 49_999)}`);
  const churnValues = Array.from({ length: n }, () => (rng.int(0, 3) === 0 ? "" : `v${rng.int(0, 999)}`));
  return [
    { name: "1e5 different keys", input: [distinct, values] },
    { name: "1e5 changes on 5e4 keys, a quarter of them removals", input: [churnKeys, churnValues] },
  ];
}
```

- [ ] **Step 5: Exercise 02 · Lineups**

Create `concepts/maps-and-sets/exercises/02-lineups/README.md`:

```markdown
---
id: maps-and-sets/02
title: Lineups
concept: maps-and-sets
---
# Lineups

## Statement

A festival runs for several days 🎪; `days[d]` lists the bands that play on day `d` (a band may be listed twice on the same day by mistake). Return two lists: the bands that play on **every** day, and the bands that play on **exactly one** day. Sort each list alphabetically, in plain character order (`-` comes before every letter, so `b-side` comes before `ba`).

**Examples**

- `days = [["muse","blur"],["blur","oasis"],["blur","muse","muse"]]` → `[["blur"],["oasis"]]` (`muse` plays on two days)
- `days = [["a-ha"]]` → `[["a-ha"],["a-ha"]]`
- `days = [["x","y"],[]]` → `[[],["x","y"]]`

**Constraints:** `1 <= days.length <= 50` · `0 <= days[d].length <= 1000` · band names have 1 to 20 characters: lowercase English letters and `-`
```

Create `concepts/maps-and-sets/exercises/02-lineups/cases.json`:

```json
{
  "mode": "function",
  "entry": "lineups",
  "params": [
    {"name":"days","type":"string[][]"}
  ],
  "returns": "string[][]",
  "compare": "exact",
  "examples": [
    {"input":[[["muse","blur"],["blur","oasis"],["blur","muse","muse"]]],"expected":[["blur"],["oasis"]]},
    {"input":[[["a-ha"]]],"expected":[["a-ha"],["a-ha"]]},
    {"input":[[["x","y"],[]]],"expected":[[],["x","y"]]}
  ],
  "hidden": [
    {"input":[[[]]],"expected":[[],[]]},
    {"input":[[["a","a"],["a"]]],"expected":[["a"],[]]},
    {"input":[[["a"],["b"],["c"]]],"expected":[[],["a","b","c"]]},
    {"input":[[["c","b","a"],["a","b","c"]]],"expected":[["a","b","c"],[]]},
    {"input":[[["d","e"],["e","f"],["f","d"],["d","e","f"]]],"expected":[[],[]]},
    {"input":[[["z-z","zz","z"],["z"],["zz","z","q"]]],"expected":[["z"],["q","z-z"]]},
    {"input":[[[],[],["solo"]]],"expected":[[],["solo"]]},
    {"input":[[["b-side","b"],["b"],["b","b-side","a"]]],"expected":[["b"],["a"]]}
  ]
}
```

- [ ] **Step 6: Exercise 03 · Robot trail**

Create `concepts/maps-and-sets/exercises/03-robot-trail/README.md`:

```markdown
---
id: maps-and-sets/03
title: Robot trail
concept: maps-and-sets
---
# Robot trail

## Statement

A warehouse robot 🤖 starts at cell `(0, 0)` of an endless grid and follows `moves`, one step per character: `U` goes up, `D` down, `L` left and `R` right. Return how many **different** cells it visits, counting the starting cell.

**Examples**

- `moves = ""` → `1`
- `moves = "UR"` → `3`
- `moves = "URDL"` → `4` (the last step returns to the start)

**Constraints:** `0 <= moves.length <= 10^5` · `moves` has only the characters `U`, `D`, `L` and `R`
```

Create `concepts/maps-and-sets/exercises/03-robot-trail/cases.json`:

```json
{
  "mode": "function",
  "entry": "robotTrail",
  "params": [
    {"name":"moves","type":"string"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[""],"expected":1},
    {"input":["UR"],"expected":3},
    {"input":["URDL"],"expected":4}
  ],
  "hidden": [
    {"input":["UDUD"],"expected":2},
    {"input":["RRRR"],"expected":5},
    {"input":["LLRR"],"expected":3},
    {"input":["UUDDLLRR"],"expected":5},
    {"input":["ULDR"],"expected":4},
    {"input":["RURURU"],"expected":7},
    {"input":["UUUUDDDD"],"expected":5},
    {"input":["RDLURDLURDLU"],"expected":4},
    {"input":["LLLLUUUURRRRDDDD"],"expected":16},
    {"input":["D"],"expected":2}
  ]
}
```

Create `concepts/maps-and-sets/exercises/03-robot-trail/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const staircase = Array.from({ length: 100_000 }, () => rng.pick(["U", "R"])).join("");
  const wander = Array.from({ length: 100_000 }, () => rng.pick(["U", "D", "L", "R"])).join("");
  return [
    { name: "1e5 moves, never back to a visited cell", input: [staircase] },
    { name: "1e5 random moves", input: [wander] },
  ];
}
```

- [ ] **Step 7: Independent reference check**

Run procedure P3 for each exercise below. Each run prints `Filled 0 hidden expected value(s) in …`.

- `maps-and-sets/01`
- `maps-and-sets/02`
- `maps-and-sets/03`

- [ ] **Step 8: Byte check**

Run procedure P2 on the 9 new content files. Expected hashes:

| File | SHA-256 |
|---|---|
| `concepts/maps-and-sets/README.md` | `eb6189d8c952b99fb0b59ae0563f14c1605fddf57741bdf9367459d4b50ee302` |
| `concepts/maps-and-sets/exercises/01-settings/README.md` | `7bf03ae72cb86eefe5fe1eba34ae003cb7f0b2dd74f80b6528caa189b998810e` |
| `concepts/maps-and-sets/exercises/01-settings/cases.json` | `09b7272bfa4c1da1960adfb575d6c89679e072fef2a15ce6204482b603f55be0` |
| `concepts/maps-and-sets/exercises/01-settings/stress.ts` | `cc6a54e1479e7a01d2e18ce3834709bb18df7a2e6a3adf69a341fd2bb9116c69` |
| `concepts/maps-and-sets/exercises/02-lineups/README.md` | `52adc3ab7007c91981582d7de2fdd6d041ea8825b309d5a59caf0a17c929ddcf` |
| `concepts/maps-and-sets/exercises/02-lineups/cases.json` | `177ff475c8cbbaba9d285ae0410fd35caa077a754cdbc64bc82eb2c4e853b2f9` |
| `concepts/maps-and-sets/exercises/03-robot-trail/README.md` | `14bb8ed9109f35193c121439d1efa0214b7088cde46c22cc563331e3b216ce54` |
| `concepts/maps-and-sets/exercises/03-robot-trail/cases.json` | `761868e79f6843d2702576046e518a789a502a062b85d73cc395cbcca0b72f53` |
| `concepts/maps-and-sets/exercises/03-robot-trail/stress.ts` | `cf17db008f4d867760221acc57750c0fa4d58f2ef9dc81831f4c87c5c92ba993` |

- [ ] **Step 9: Non-isomorphism review**

Run procedure P4 with `maps-and-sets`. Expected output, and the review it must confirm:

```
maps-and-sets/01  (string[], string[]) -> string[]  same signature: none
maps-and-sets/02  (string[][]) -> string[][]  same signature: lc-0721-accounts-merge
maps-and-sets/03  (string) -> int  same signature: lc-0003-longest-substring-without-repeating-characters, lc-0008-string-to-integer-atoi, lc-0058-length-of-last-word, lc-0224-basic-calculator, lc-0409-longest-palindrome, lc-3110-score-of-a-string
```

| Exercise | Signature | It asks | Same signature in `problems/` | Why the question differs |
|---|---|---|---|---|
| `maps-and-sets/01` Settings | `(string[], string[]) -> string[]` | the settings left after applying a log of sets and removals | none | lc-0146 (LRU cache) and lc-0981 (time-based key-value store) are classes with a capacity or timestamps; Settings is one log, with neither |
| `maps-and-sets/02` Lineups | `(string[][]) -> string[][]` | the bands that play on every day, and those that play on exactly one | lc-0721 | lc-0721 groups accounts that share an email, through chains of shared emails; Lineups groups nothing and compares the days |
| `maps-and-sets/03` Robot trail | `(string) -> int` | how many different cells a path of U/D/L/R steps visits | lc-0003, lc-0008, lc-0058, lc-0224, lc-0409, lc-3110 | they ask for a substring length, a parsed integer, a word length, an expression's value, a palindrome length and a score; the grid problems (lc-0200, lc-0542, lc-0733, lc-0994) explore a given grid, while the robot walks a given path on an empty one |

None of the three is a problem of Grind 169 or NeetCode 150 either, to the author's knowledge (those lists are not in the repo yet); if you recognize one, report it.

- [ ] **Step 10: Auto-sections**

Run procedure P5 with `maps-and-sets`. Expected: `maps-and-sets: the auto-sections match pnpm sync`.

- [ ] **Step 11: Run the tests and the checks**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: PASS.

Run: `pnpm -s check 2>&1 | tail -1` and `pnpm -s check 2>&1 | grep -E "concepts/maps-and-sets|\"maps-and-sets\""`
Expected: `0 error(s), W warning(s)` (`W` from `$S/task-4-check.txt`). The second command prints nothing.

Run: `pnpm verify`
Expected: green.

- [ ] **Step 12: Review the tree and commit**

Run procedure P1 steps 2 and 3. The new paths are exactly:

- `concepts/maps-and-sets/README.md`
- `concepts/maps-and-sets/exercises/01-settings/README.md`
- `concepts/maps-and-sets/exercises/01-settings/cases.json`
- `concepts/maps-and-sets/exercises/01-settings/stress.ts`
- `concepts/maps-and-sets/exercises/02-lineups/README.md`
- `concepts/maps-and-sets/exercises/02-lineups/cases.json`
- `concepts/maps-and-sets/exercises/03-robot-trail/README.md`
- `concepts/maps-and-sets/exercises/03-robot-trail/cases.json`
- `concepts/maps-and-sets/exercises/03-robot-trail/stress.ts`
- `study/tests/phase-zero.test.ts`

```bash
git add concepts/maps-and-sets/README.md concepts/maps-and-sets/exercises/01-settings/README.md concepts/maps-and-sets/exercises/01-settings/cases.json concepts/maps-and-sets/exercises/01-settings/stress.ts concepts/maps-and-sets/exercises/02-lineups/README.md concepts/maps-and-sets/exercises/02-lineups/cases.json concepts/maps-and-sets/exercises/03-robot-trail/README.md concepts/maps-and-sets/exercises/03-robot-trail/cases.json concepts/maps-and-sets/exercises/03-robot-trail/stress.ts study/tests/phase-zero.test.ts
git commit -m "feat(concepts): add the maps-and-sets base concept and its exercises"
```

---

### Task 5: The `sorting` concept and its three exercises; phase 0 can end

**Files:**
- Create: `concepts/sorting/README.md`
- Create: `concepts/sorting/exercises/01-insertion-shifts/README.md`
- Create: `concepts/sorting/exercises/01-insertion-shifts/cases.json`
- Create: `concepts/sorting/exercises/02-leaderboard/README.md`
- Create: `concepts/sorting/exercises/02-leaderboard/cases.json`
- Create: `concepts/sorting/exercises/02-leaderboard/stress.ts`
- Create: `concepts/sorting/exercises/03-chart-positions/README.md`
- Create: `concepts/sorting/exercises/03-chart-positions/cases.json`
- Create: `concepts/sorting/exercises/03-chart-positions/stress.ts`
- Modify: `study/tests/phase-zero.test.ts` (one line, and one `describe` appended)

**Interfaces:**
- Consumes: Task 1's `study/tests/phase-zero.test.ts` (`BASES`, `WRITTEN`, `copy()`, `startCoach(c)`, `learn(c, slug)`); Plan B's phase transition after the last base concept (`phase-advanced { from: "bases", to: "learn" }`) and phase 1's first item, the concept that opens `arrays-hashing` (`hash-map`, reason `opens arrays-hashing`).
- Produces: the concept `sorting` ("Sorting") and the exercises `sorting/01` (`insertionShifts`), `/02` (`leaderboard`), `/03` (`chartPositions`); a third `describe` in `study/tests/phase-zero.test.ts`. Phase 0 of every preset can now end.

Sorting last. The note teaches insertion sort and merge sort as mechanisms (ASCII only, no code for either), the built-in sorts as the everyday tool (keys, comparators, multi-key orders, stability), and the traps (TypeScript's text sort of numbers, boolean comparators, `list.sort()` returning `None`, lost positions). Its exercises: counting insertion sort's slides, ordering a leaderboard, and turning play counts into chart positions. The last two have stress cases.

Its `## Problems` auto-section lists lc-0056, lc-0721 and lc-1235, as `sync` would. With this note, phase 0 of every preset can end, and the coach moves to phase 1.

- [ ] **Step 0: Baseline**

Run procedure P1 step 1 with `N=5`.

- [ ] **Step 1: Write the failing tests**

In `study/tests/phase-zero.test.ts`:
1. Replace `const WRITTEN = ["big-o", "recursion", "arrays-and-strings", "maps-and-sets"];` with `const WRITTEN = ["big-o", "recursion", "arrays-and-strings", "maps-and-sets", "sorting"];`.
2. Append at the end of the file:

```ts

describe("the end of phase 0 (study coach spec §6.1)", () => {
  it("ends phase 0 after the fifth base concept and opens phase 1 with the hash-map concept", async () => {
    const c = copy();
    await startCoach(c);
    for (const [slug] of BASES) {
      await c.json("today", "--json");
      await learn(c, slug);
      c.clock.advance(DAY);
    }
    const plan = await c.json("today", "--json");
    expect(plan.phase).toMatchObject({ id: "learn", preset: "grind-75", list: { list: "grind-75" } });
    expect(plan.announcements).toContainEqual(expect.objectContaining({ key: "phase-advanced", payload: { from: "bases", to: "learn" } }));
    // hash-map opens arrays-hashing in curriculum/grind-75.yaml; the copy leaves the user's own notes out.
    expect(plan.items[0]).toMatchObject({ kind: "concept", id: "hash-map", reason: "opens arrays-hashing" });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: FAIL, 2 tests: "plans the base concepts one a day…" (on day 5 the `sorting` row has `missing: true`) and "ends phase 0 after the fifth base concept…" (the phase is still `bases`).

- [ ] **Step 3: The note**

Create `concepts/sorting/README.md`:

````markdown
---
slug: sorting
title: Sorting
requires: [big-o, recursion, maps-and-sets]
related: [two-pointers]
---
# Sorting

## Intuition

You sort a hand of cards without thinking 🃏: take the next card and slide it left until it sits after a smaller one. That is **insertion sort**: simple, and fine for a hand of cards, but O(n²) for a long list, because each new item may slide past everything before it.

For big inputs, divide and conquer: split the pile in two, sort each half (recursion!), then **merge** the two sorted halves by repeatedly taking the smaller front card. That is **merge sort**, O(n log n): about log₂ n levels of splitting, and O(n) merging work per level.

In practice you rarely write either one: Python's `sorted` / `list.sort` and TypeScript's `Array.prototype.sort` are fast O(n log n) sorts. Your job is to tell them **what order you want**: by which key, ascending or descending, and how to break ties. It is the table header you click in a dashboard 📊: sort by status, then by name. Both built-ins are **stable**: items that tie keep their previous relative order, which is what lets the "then by" part work.

## Diagram

Insertion sort on `[5, 2, 4, 1]` (the bar separates the sorted part):

```
[5 | 2, 4, 1]    take 2: it slides left past 5            → [2, 5 | 4, 1]
[2, 5 | 4, 1]    take 4: it slides left past 5            → [2, 4, 5 | 1]
[2, 4, 5 | 1]    take 1: it slides left past 5, 4 and 2   → [1, 2, 4, 5]
```

Merge sort on the same list:

```
            [5, 2, 4, 1]
            /          \
        [5, 2]        [4, 1]          split: about log₂ n levels
        /    \        /    \
      [5]   [2]     [4]   [1]
        \    /        \    /
        [2, 5]        [1, 4]          merge: take the smaller front each time
            \          /
           [1, 2, 4, 5]
```

Stability, by example:

```
rows, already sorted by name:     (ana, 3)  (bo, 1)  (cy, 3)  (di, 1)
stable sort by the number:        (bo, 1)  (di, 1)  (ana, 3)  (cy, 3)
                                  ties keep their name order ↑
```

## Signals

- The output must come **in order**: "sorted by …", "in increasing …", "alphabetically"
- Ties are broken by a second rule: "… and, for equal …, by …"
- "Rank", "position", "top", "the k smallest or largest"
- Equal or close values need to end up **next to each other**
- A nested loop compares every pair just to find which comes first

## When it fails

- **TypeScript's default sort compares text:** `[10, 9, 1].sort()` gives `[1, 10, 9]`. Always pass a comparator for numbers: `nums.sort((a, b) => a - b)`.
- **A comparator returns a number, not a boolean:** negative means "a first", positive means "b first", 0 means a tie. `(a, b) => a > b` is a bug.
- **In place or a copy?** Python's `list.sort()` sorts in place and returns `None` (`x = x.sort()` loses your list); `sorted(x)` returns a new list. TypeScript's `arr.sort()` sorts in place *and* returns the same array; `arr.toSorted()` returns a copy.
- **Sorting loses positions:** once sorted, you no longer know where each item came from. Sort the indexes (or `(value, index)` pairs) when you need them.
- **O(n log n) is not always the best:** finding only the smallest item is one O(n) pass, and values from a tiny range (ages 0 to 120) can be counted instead of compared.

## Typical complexity

| Sort | Time | Extra space | Stable |
|---|---|---|---|
| Insertion sort | O(n²); O(n) on almost sorted input | O(1) | yes |
| Merge sort | O(n log n) | O(n) | yes |
| Built-in (`sorted`, `list.sort`, `Array.prototype.sort`) | O(n log n) | O(n) | yes |

Sorting strings also pays for comparing them: two long strings that share a long prefix take longer to compare.

## Template

Python:

```python
words = ["kiwi", "fig", "banana", "apple"]

sorted(words)                                  # ['apple', 'banana', 'fig', 'kiwi']
sorted(words, key=len)                         # by length; ties keep their order (stable)
sorted(words, key=lambda w: (len(w), w))       # by length, then alphabetically
sorted(words, reverse=True)                    # descending

values = [30, 10, 20]
order = sorted(range(len(values)), key=lambda i: values[i])   # [1, 2, 0]: the indexes, by value
```

TypeScript:

```ts
const words = ["kiwi", "fig", "banana", "apple"];

[...words].sort(); // alphabetical (copy first: sort works in place)
[...words].sort((a, b) => a.length - b.length); // by length; ties keep their order (stable)
[...words].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)); // by length, then alphabetically
[...words].sort().reverse(); // descending

const values = [30, 10, 20];
const order = values.map((_, i) => i).sort((i, j) => values[i] - values[j]); // [1, 2, 0]: the indexes, by value
```

## Exercises

<!-- auto:exercises -->
- [01 · Insertion shifts](exercises/01-insertion-shifts/README.md)
- [02 · Leaderboard](exercises/02-leaderboard/README.md)
- [03 · Chart positions](exercises/03-chart-positions/README.md)
<!-- /auto -->

## Quick checks

1. Why does `[10, 9, 1].sort()` give `[1, 10, 9]` in TypeScript, and how do you fix it?
2. What does "stable" mean? Give one case where it changes the result.
3. How many slides does insertion sort make on a list that is already sorted? And on a list of n items in reverse order?
4. Why does merge sort have about log₂ n levels, and why does each level cost O(n)?

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
- [lc-0056 · Merge Intervals](../../problems/lc-0056-merge-intervals/README.md)
- [lc-0721 · Accounts Merge](../../problems/lc-0721-accounts-merge/README.md)
- [lc-1235 · Maximum Profit in Job Scheduling](../../problems/lc-1235-maximum-profit-in-job-scheduling/README.md)
<!-- /auto -->
````

- [ ] **Step 4: Exercise 01 · Insertion shifts**

Create `concepts/sorting/exercises/01-insertion-shifts/README.md`:

```markdown
---
id: sorting/01
title: Insertion shifts
concept: sorting
---
# Insertion shifts

## Statement

Insertion sort walks through `nums` from left to right. Each element slides to the left, one slot at a time, past every **bigger** element before it (it never passes an equal one), until the part on its left is sorted. Return how many one-slot slides insertion sort makes in total to sort `nums` in non-decreasing order.

**Examples**

- `nums = [5,2,4,1]` → `5` (2 passes 5; 4 passes 5; 1 passes 5, 4 and 2)
- `nums = [1,2,3]` → `0`
- `nums = [3,3,1]` → `2`

**Constraints:** `0 <= nums.length <= 2000` · `-10^9 <= nums[i] <= 10^9`
```

Create `concepts/sorting/exercises/01-insertion-shifts/cases.json`:

```json
{
  "mode": "function",
  "entry": "insertionShifts",
  "params": [
    {"name":"nums","type":"int[]"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[[5,2,4,1]],"expected":5},
    {"input":[[1,2,3]],"expected":0},
    {"input":[[3,3,1]],"expected":2}
  ],
  "hidden": [
    {"input":[[]],"expected":0},
    {"input":[[7]],"expected":0},
    {"input":[[2,1]],"expected":1},
    {"input":[[3,2,1]],"expected":3},
    {"input":[[1,1,1]],"expected":0},
    {"input":[[4,3,2,1]],"expected":6},
    {"input":[[1,3,2,3,1]],"expected":4},
    {"input":[[10,-10]],"expected":1},
    {"input":[[2,4,1,3,5]],"expected":3},
    {"input":[[-1,-2,-3,0]],"expected":3}
  ]
}
```

- [ ] **Step 5: Exercise 02 · Leaderboard**

Create `concepts/sorting/exercises/02-leaderboard/README.md`:

```markdown
---
id: sorting/02
title: Leaderboard
concept: sorting
---
# Leaderboard

## Statement

After a hackathon 🏆, `names[i]` scored `scores[i]` points. Return the names in leaderboard order: higher scores first, and names with the same score in alphabetical order.

**Examples**

- `names = ["ana","bo","cy"], scores = [3,7,3]` → `["bo","ana","cy"]`
- `names = ["zed","amy"], scores = [5,5]` → `["amy","zed"]`
- `names = ["solo"], scores = [0]` → `["solo"]`

**Constraints:** `1 <= names.length == scores.length <= 10^5` · names are distinct, with 1 to 10 lowercase English letters · `-10^9 <= scores[i] <= 10^9`
```

Create `concepts/sorting/exercises/02-leaderboard/cases.json`:

```json
{
  "mode": "function",
  "entry": "leaderboard",
  "params": [
    {"name":"names","type":"string[]"},
    {"name":"scores","type":"int[]"}
  ],
  "returns": "string[]",
  "compare": "exact",
  "examples": [
    {"input":[["ana","bo","cy"],[3,7,3]],"expected":["bo","ana","cy"]},
    {"input":[["zed","amy"],[5,5]],"expected":["amy","zed"]},
    {"input":[["solo"],[0]],"expected":["solo"]}
  ],
  "hidden": [
    {"input":[["a","b","c"],[1,2,3]],"expected":["c","b","a"]},
    {"input":[["c","b","a"],[0,0,0]],"expected":["a","b","c"]},
    {"input":[["x","y"],[-5,-1]],"expected":["y","x"]},
    {"input":[["mia","li","al","bea"],[10,20,10,20]],"expected":["bea","li","al","mia"]},
    {"input":[["one"],[-1000000000]],"expected":["one"]},
    {"input":[["dd","d","ddd"],[1,1,1]],"expected":["d","dd","ddd"]},
    {"input":[["b","a"],[1000000000,-1000000000]],"expected":["b","a"]},
    {"input":[["kai","ana","zoe","ben"],[3,1,2,4]],"expected":["ben","kai","zoe","ana"]}
  ]
}
```

Create `concepts/sorting/exercises/02-leaderboard/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

/** The i-th distinct name of up to four lowercase letters: a, b, …, z, ba, bb, … */
function name(i: number): string {
  let text = "";
  do {
    text = String.fromCharCode(97 + (i % 26)) + text;
    i = Math.floor(i / 26);
  } while (i > 0);
  return text;
}

export default function stress(rng: Rng): StressCase[] {
  const names = rng.shuffle(Array.from({ length: 100_000 }, (_, i) => name(i)));
  return [
    { name: "n=1e5, spread-out scores", input: [names, rng.intArray(100_000, -1_000_000_000, 1_000_000_000)] },
    { name: "n=1e5, scores from 0 to 9 (many ties)", input: [names, rng.intArray(100_000, 0, 9)] },
  ];
}
```

- [ ] **Step 6: Exercise 03 · Chart positions**

Create `concepts/sorting/exercises/03-chart-positions/README.md`:

```markdown
---
id: sorting/03
title: Chart positions
concept: sorting
---
# Chart positions

## Statement

`plays[i]` is how many times song `i` was played this week 🎧. A song's chart position is `1` plus the number of **different** play counts that are higher than its own: the most played songs are at position 1, songs with the same count share a position, and the next lower count takes the next position, with no gaps. Return the position of every song, in the original order of `plays`.

**Examples**

- `plays = [50,80,50,20]` → `[2,1,2,3]`
- `plays = [7,7,7]` → `[1,1,1]`
- `plays = [5]` → `[1]`

**Constraints:** `0 <= plays.length <= 10^5` · `0 <= plays[i] <= 10^9`
```

Create `concepts/sorting/exercises/03-chart-positions/cases.json`:

```json
{
  "mode": "function",
  "entry": "chartPositions",
  "params": [
    {"name":"plays","type":"int[]"}
  ],
  "returns": "int[]",
  "compare": "exact",
  "examples": [
    {"input":[[50,80,50,20]],"expected":[2,1,2,3]},
    {"input":[[7,7,7]],"expected":[1,1,1]},
    {"input":[[5]],"expected":[1]}
  ],
  "hidden": [
    {"input":[[]],"expected":[]},
    {"input":[[1,2,3,4]],"expected":[4,3,2,1]},
    {"input":[[4,3,2,1]],"expected":[1,2,3,4]},
    {"input":[[0,0,1]],"expected":[2,2,1]},
    {"input":[[10,20,10,30,20]],"expected":[3,2,3,1,2]},
    {"input":[[1000000000,0]],"expected":[1,2]},
    {"input":[[3,1,3,1,2]],"expected":[1,3,1,3,2]},
    {"input":[[0]],"expected":[1]},
    {"input":[[9,8,9,8,7,7]],"expected":[1,2,1,2,3,3]},
    {"input":[[2,2,1,1,0,0,3]],"expected":[2,2,3,3,4,4,1]}
  ]
}
```

Create `concepts/sorting/exercises/03-chart-positions/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  return [
    { name: "n=1e5, counts up to 1e9", input: [rng.intArray(100_000, 0, 1_000_000_000)] },
    { name: "n=1e5, counts up to 5e4 (many ties)", input: [rng.intArray(100_000, 0, 50_000)] },
  ];
}
```

- [ ] **Step 7: Independent reference check**

Run procedure P3 for each exercise below. Each run prints `Filled 0 hidden expected value(s) in …`.

- `sorting/01`
- `sorting/02`
- `sorting/03`

- [ ] **Step 8: Byte check**

Run procedure P2 on the 9 new content files. Expected hashes:

| File | SHA-256 |
|---|---|
| `concepts/sorting/README.md` | `1bffe237e0220a6044243d82593aa42f00c14934e2e517263d74d293f1ade16a` |
| `concepts/sorting/exercises/01-insertion-shifts/README.md` | `89cdcc2bccf62db7ce382f25a4852a89985d84f987288b01c2e09fb33e8b41a9` |
| `concepts/sorting/exercises/01-insertion-shifts/cases.json` | `8aa279bf23bca57a81b5e4b6a14850cf96a379b03979947e268b0cf239d5ec53` |
| `concepts/sorting/exercises/02-leaderboard/README.md` | `45684c2eac116b70d65a9ddb3a3e7a14d2956f94f09656ce882ea774c62ec1d4` |
| `concepts/sorting/exercises/02-leaderboard/cases.json` | `d26a5439ff82d1ab220e3593c43b6435ab1a532ccfe25dc3847eb0420f5d3800` |
| `concepts/sorting/exercises/02-leaderboard/stress.ts` | `e39cf39acca2940a9cd3ca39100318793ae551304f612329b668539337f0f6a7` |
| `concepts/sorting/exercises/03-chart-positions/README.md` | `c381e92f1345915e76915b63ebbd24143a34e2f238e0a7901f78f1b2c8a4e113` |
| `concepts/sorting/exercises/03-chart-positions/cases.json` | `ba272db1b10c9a3fc19df093e08162b4fa854e0d3431d7dc5daab94544f31223` |
| `concepts/sorting/exercises/03-chart-positions/stress.ts` | `72c5e060208cb1356c7c0f98d27c304388d0eee5521713a632d647f9223736c6` |

- [ ] **Step 9: Non-isomorphism review**

Run procedure P4 with `sorting`. Expected output, and the review it must confirm:

```
sorting/01  (int[]) -> int  same signature: lc-0011-container-with-most-water, lc-0026-remove-duplicates-from-sorted-array, lc-0042-trapping-rain-water, lc-0053-maximum-subarray, lc-0084-largest-rectangle-in-histogram, lc-0121-best-time-to-buy-and-sell-stock, lc-0169-majority-element
sorting/02  (string[], int[]) -> string[]  same signature: none
sorting/03  (int[]) -> int[]  same signature: lc-0066-plus-one, lc-0238-product-of-array-except-self, lc-1920-build-array-from-permutation
```

| Exercise | Signature | It asks | Same signature in `problems/` | Why the question differs |
|---|---|---|---|---|
| `sorting/01` Insertion shifts | `(int[]) -> int` | how many one-slot slides insertion sort makes on the list | lc-0011, lc-0026, lc-0042, lc-0053, lc-0084, lc-0121, lc-0169 | they ask for a container's area, a length after removing duplicates, trapped water, a best subarray sum, a largest rectangle, a best profit and a majority value; none asks about the order of pairs |
| `sorting/02` Leaderboard | `(string[], int[]) -> string[]` | the names ordered by their scores, ties alphabetical | none | lc-0973 keeps the k points closest to the origin; nothing orders names by a parallel list of scores |
| `sorting/03` Chart positions | `(int[]) -> int[]` | each value's position among the distinct values, highest first, with ties sharing a position | lc-0066, lc-0238, lc-1920 | they ask to add one to a number stored as digits, for the product of every other element, and for an array indexed by its own values |

None of the three is a problem of Grind 169 or NeetCode 150 either, to the author's knowledge (those lists are not in the repo yet); if you recognize one, report it.

- [ ] **Step 10: Auto-sections**

Run procedure P5 with `sorting`. Expected: `sorting: the auto-sections match pnpm sync`.

- [ ] **Step 11: Run the tests and the checks**

Run: `pnpm vitest run study/tests/phase-zero.test.ts`
Expected: PASS.

Run: `pnpm -s check 2>&1 | tail -1` and `pnpm -s check 2>&1 | grep -E "concepts/sorting|\"sorting\""`
Expected: `0 error(s), W−1 warning(s)` (`W` from `$S/task-5-check.txt`): the `"sorting" is referenced but not created` warning is gone. The second command prints nothing.

Run: `pnpm verify`
Expected: green.

- [ ] **Step 12: Review the tree and commit**

Run procedure P1 steps 2 and 3. The new paths are exactly:

- `concepts/sorting/README.md`
- `concepts/sorting/exercises/01-insertion-shifts/README.md`
- `concepts/sorting/exercises/01-insertion-shifts/cases.json`
- `concepts/sorting/exercises/02-leaderboard/README.md`
- `concepts/sorting/exercises/02-leaderboard/cases.json`
- `concepts/sorting/exercises/02-leaderboard/stress.ts`
- `concepts/sorting/exercises/03-chart-positions/README.md`
- `concepts/sorting/exercises/03-chart-positions/cases.json`
- `concepts/sorting/exercises/03-chart-positions/stress.ts`
- `study/tests/phase-zero.test.ts`

```bash
git add concepts/sorting/README.md concepts/sorting/exercises/01-insertion-shifts/README.md concepts/sorting/exercises/01-insertion-shifts/cases.json concepts/sorting/exercises/02-leaderboard/README.md concepts/sorting/exercises/02-leaderboard/cases.json concepts/sorting/exercises/02-leaderboard/stress.ts concepts/sorting/exercises/03-chart-positions/README.md concepts/sorting/exercises/03-chart-positions/cases.json concepts/sorting/exercises/03-chart-positions/stress.ts study/tests/phase-zero.test.ts
git commit -m "feat(concepts): add the sorting base concept and its exercises"
```

---
## Milestone M8: the coach skill

### Task 6: The `coach` skill, its contract test, and the docs that point to it

**Files:**
- Create: `.claude/skills/coach/SKILL.md`, `.claude/skills/coach/examples.md`
- Create: `study/tests/coach-skill.test.ts`
- Modify: `scripts/tests/claude-layer.test.ts` (`SKILLS`, one `describe` appended)
- Modify: `CLAUDE.md` (the skills table, the repo map), `README.md` (the daily flow, the map)

**Interfaces:**
- Consumes:
  - Plan B's "Interfaces for Plan C", as written there: the commands table (`today --json [--refresh]`, `study ack <id>`, `study status --json` with its `coach` field, `study init --minutes … --lang …`, `study curriculum --json`, `… set <preset> --json`, `… expand <list> --json`, `study phase --json`); `TodayJson` / `NotInitializedJson`; the five announcement keys and their payloads; the reason vocabulary; `CurriculumResult`, `ExpansionResult`, `CurriculumStatusJson`, `PhaseStatusJson`; "Playground copy" (phase and list names, Start review / Start exam / Start again).
  - Plan B's `study/tests/coach-fixture.ts`: `makeCoachRepo()` (presets `demo-list`: 8 problems, all imported, expansion choices `wide-list` and `ghost-list`; `wide-list`: 11 of 12; `ghost-list`: none; base concepts `basics-a` and `basics-b`, one exercise each, `<slug>/01`), `MONDAY`, `TZ`, `DAY`.
  - Plan A: `runStudyCli`, `fixedClock`, `openStudy`, `recordWork`, `cleanupTempDirs`, `REPO_ROOT`; the guard `.claude/hooks/guard-solution.mjs` (Verified facts 7); `scripts/tests/claude-layer.test.ts`'s `SKILLS` and `skill(name)` helper; the `CLAUDE.md` and `README.md` text left by Plan A Task 19 and Plan B Tasks 11 and 15.
- Produces: the project skill `coach` (`.claude/skills/coach/`), listed in `CLAUDE.md`'s skills table and started from `README.md`'s daily flow.

The skill follows Decisions 4–7: it renders `today --json` in Spanish, acknowledges what it shows, onboards on first use, asks the 2 → 3 expansion question, switches lists only on an explicit request, offers the import of a list that is not in the repo, and sends the user to the commands the hook keeps for them. It never adds hints, approaches or complexity targets, and never names the pattern of a mixed, review or exam item.

- [ ] **Step 0: Baseline**

Run procedure P1 step 1 with `N=6`.

- [ ] **Step 1: Write the failing tests**

Create `study/tests/coach-skill.test.ts`:

````ts
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { runStudyCli } from "../commands.ts";
import { recordWork } from "../record.ts";
import { openStudy } from "../store.ts";
import { DAY, makeCoachRepo, MONDAY, TZ } from "./coach-fixture.ts";

// The coach skill is instructions for Claude, so it is checked where it touches code (study coach spec §11):
// every command it runs is one the hook allows and the CLI accepts, every command it leaves to the user is one
// the hook denies, and its examples and vocabulary match what `pnpm -s today --json` returns.

afterEach(cleanupTempDirs);

const SKILL_DIR = path.join(REPO_ROOT, ".claude", "skills", "coach");
const SKILL = readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8");
const EXAMPLES = readFileSync(path.join(SKILL_DIR, "examples.md"), "utf8");

/** The commands the skill tells Claude to run, exactly as it writes them (placeholders in angle brackets). */
const CLAUDE_RUNS = [
  "pnpm -s today --json",
  "pnpm -s today --json --refresh",
  "pnpm -s study ack <id>",
  "pnpm -s study status --json",
  "pnpm -s study phase --json",
  "pnpm -s study curriculum --json",
  "pnpm -s study curriculum set <preset> --json",
  "pnpm -s study curriculum expand <list> --json",
  "pnpm -s study init --minutes <n> --lang <lang>",
  "pnpm -s study init --minutes <n>",
  "pnpm -s study init --lang <lang>",
];

/** The study commands only the user runs (spec §10, the guard), as the skill quotes them for the user. */
const USER_ONLY = [
  "pnpm study start <id>",
  "pnpm study pause",
  "pnpm study resume",
  "pnpm study phase set <phase>",
  "pnpm study migrate --dry-run",
  "pnpm study migrate",
];

/** Every `pnpm …` span in the skill and its examples. examples.md acknowledges real ids (`pnpm -s study ack 7`). */
function quoted(): string[] {
  const spans = [...`${SKILL}\n${EXAMPLES}`.matchAll(/`(pnpm [^`]+)`/g)].map((match) => match[1]);
  return [...new Set(spans.map((span) => span.replace(/^pnpm -s study ack \d+$/, "pnpm -s study ack <id>")))];
}

function fill(command: string, values: Record<string, string>): string {
  return command.replace(/<(\w+)>/g, (whole, name: string) => values[name] ?? whole);
}

/** What the PreToolUse guard decides for a Bash command (scripts/tests/hooks.test.ts runs the hook the same way). */
function guard(command: string): string {
  const run = spawnSync(process.execPath, [path.join(REPO_ROOT, ".claude", "hooks", "guard-solution.mjs")], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: "/work/algorithms" },
    encoding: "utf8",
  });
  expect(run.status).toBe(0);
  return run.stdout ? (JSON.parse(run.stdout).hookSpecificOutput?.permissionDecision ?? "allow") : "allow";
}

const SAMPLE = { id: "3", preset: "neetcode-150", list: "grind-169", n: "30", lang: "py", phase: "learn" };

// `pnpm -s today --json`, as Plan B's "Interfaces for Plan C" defines it. Strict: a field the CLI adds or renames
// fails here, so the skill and its examples are updated with it.
const phaseId = z.enum(["bases", "learn", "master", "expand", "pro"]);
const presetPhase = z.object({ preset: z.string(), phase: phaseId }).strict();
const fromTo = z.object({ from: phaseId, to: phaseId }).strict();
const announcement = z.discriminatedUnion("key", [
  z.object({ id: z.number().int(), key: z.literal("coach-started"), at: z.string(), payload: presetPhase }).strict(),
  z.object({ id: z.number().int(), key: z.literal("phase-advanced"), at: z.string(), payload: fromTo }).strict(),
  z.object({ id: z.number().int(), key: z.literal("phase-set"), at: z.string(), payload: fromTo }).strict(),
  z
    .object({ id: z.number().int(), key: z.literal("curriculum-switched"), at: z.string(), payload: z.object({ from: presetPhase, to: presetPhase }).strict() })
    .strict(),
  z
    .object({ id: z.number().int(), key: z.literal("welcome-back"), at: z.string(), payload: z.object({ date: z.string(), daysAway: z.number().int() }).strict() })
    .strict(),
]);
const todayJson = z
  .object({
    initialized: z.literal(true),
    started: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paused: z.object({ since: z.string() }).strict().nullable(),
    phase: z
      .object({
        id: phaseId,
        since: z.string(),
        preset: z.string(),
        progress: z.object({ done: z.number().int(), total: z.number().int() }).strict(),
        list: z.object({ list: z.string(), imported: z.number().int(), size: z.number().int().nullable() }).strict().nullable(),
        expansion: z.object({ list: z.string().nullable(), choices: z.array(z.string()) }).strict().nullable(),
      })
      .strict()
      .nullable(),
    announcements: z.array(announcement),
    mode: z.enum(["normal", "return", "catch-up"]),
    items: z.array(
      z
        .object({
          kind: z.enum(["continue", "review", "new", "concept", "exam"]),
          id: z.string(),
          title: z.string(),
          minutes: z.number(),
          reason: z.string(),
          done: z.boolean(),
          missing: z.boolean(),
        })
        .strict(),
    ),
    backlog: z.object({ waiting: z.number().int(), days: z.number().int() }).strict(),
    budget: z.object({ minutes: z.number(), planned: z.number() }).strict(),
  })
  .strict();
const todayResponse = z.union([z.object({ initialized: z.literal(false), next: z.enum(["init", "migrate"]) }).strict(), todayJson]);

describe("the coach skill (study coach spec §11)", () => {
  it("runs exactly the study commands listed here, and quotes the user-only ones for the user", () => {
    const spans = quoted();
    expect(new Set(spans.filter((span) => span.startsWith("pnpm -s ")))).toEqual(new Set(CLAUDE_RUNS));
    for (const command of USER_ONLY) expect(spans, command).toContain(command);
  });

  it("only runs commands the hook allows, and leaves to the user exactly the ones the hook denies", () => {
    for (const command of CLAUDE_RUNS) expect(guard(fill(command, SAMPLE)), command).toBe("allow");
    for (const command of USER_ONLY) expect(guard(fill(command, SAMPLE)), command).toBe("deny");
  });

  it("names every announcement, kind, phase and reason that pnpm -s today --json returns", () => {
    const words = [
      ...["coach-started", "phase-advanced", "phase-set", "curriculum-switched", "welcome-back"],
      ...["continue", "review", "exam", "new", "concept"],
      ...["bases", "learn", "master", "expand", "pro"],
      ...["in progress · <name>", "due today", "due yesterday", "due N days ago", "block i/n · <pattern>", "mix · <pattern>"],
      ...["opens <pattern>", "bases i/n", "exam i/n", "expand · <list>", "practice"],
    ];
    for (const word of words) expect(SKILL, word).toContain(`\`${word}\``);
  });

  it("shows only real shapes of pnpm -s today --json in its examples", () => {
    const blocks = [...EXAMPLES.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => match[1]);
    expect(blocks).toHaveLength(6);
    for (const block of blocks) expect(() => todayResponse.parse(JSON.parse(block)), block.slice(0, 60)).not.toThrow();
  });

  it("works against the CLI in a session from the first question to phase 1, with the shapes it reads", async () => {
    const root = makeCoachRepo();
    const clock: FixedClock = fixedClock(MONDAY);
    const ran = new Set<string>();
    const cli = async (argv: string[]) => {
      let out = "";
      let err = "";
      const code = await runStudyCli(argv, { root, clock, out: (text) => (out += text), err: (text) => (err += text) });
      return { code, out, err, json: () => JSON.parse(out) };
    };
    /** One of the skill's commands, as Claude types it, run in-process through the study CLI. */
    const run = (command: string, values: Record<string, string> = {}) => {
      ran.add(command);
      const words = fill(command, values).split(" ").slice(2); // drop "pnpm -s"
      expect(words.join(" "), command).not.toMatch(/[<>]/);
      return cli(words[0] === "study" ? words.slice(1) : words);
    };
    const today = async () => {
      const result = await run("pnpm -s today --json");
      expect(result.code, result.err).toBe(0);
      return todayResponse.parse(result.json());
    };

    // No database: the skill sends the user to `pnpm study init` (SKILL.md §2).
    expect(await today()).toEqual({ initialized: false, next: "init" });
    expect((await run("pnpm -s study status --json")).json().coach).toEqual({ started: false, preset: null, phase: null, paused: false, expansionList: null });
    expect((await cli(["init", "--timezone", TZ])).code).toBe(0); // the user's `pnpm study init`

    // Onboarding (§3).
    expect(await today()).toMatchObject({ initialized: true, started: false, phase: null });
    expect((await run("pnpm -s study curriculum --json")).json().presets).toContainEqual({ id: "demo-list", list: "demo-list", imported: 8, size: 8 });
    expect((await run("pnpm -s study init --minutes <n> --lang <lang>", { n: "30", lang: "py" })).code).toBe(0);
    expect((await run("pnpm -s study curriculum set <preset> --json", { preset: "demo-list" })).json()).toMatchObject({ status: "started", phase: "bases" });

    // The plan, its announcement and the acknowledgment (§5, §6).
    const first = (await today()) as z.infer<typeof todayJson>;
    expect(first).toMatchObject({ started: true, budget: { minutes: 30 }, announcements: [{ key: "coach-started" }] });
    const id = String(first.announcements[0].id);
    expect((await run("pnpm -s study ack <id>", { id })).out).toBe(`Acknowledged announcement ${id} (chat).\n`);
    expect(await today()).toMatchObject({ announcements: [] });
    expect((await run("pnpm -s today --json --refresh")).code).toBe(0);
    expect((await run("pnpm -s study status --json")).json().coach).toEqual({ started: true, preset: "demo-list", phase: "bases", paused: false, expansionList: null });
    expect((await run("pnpm -s study phase --json")).json()).toMatchObject({ started: true, phase: "bases", exitMet: false });

    // Lists (§7–§9): one that is not imported, the current one, and an expansion choice.
    const refused = await run("pnpm -s study curriculum set <preset> --json", { preset: "ghost-list" });
    expect(refused.code).toBe(1);
    expect(refused.json()).toMatchObject({ status: "refused", preset: "ghost-list", list: "ghost-list" });
    expect((await run("pnpm -s study curriculum set <preset> --json", { preset: "demo-list" })).json()).toEqual({ status: "unchanged", preset: "demo-list" });
    expect((await run("pnpm -s study curriculum expand <list> --json", { list: "wide-list" })).json()).toMatchObject({ status: "set", list: "wide-list", imported: 11, size: 12 });

    // Profile changes (§10).
    expect((await run("pnpm -s study init --minutes <n>", { n: "45" })).code).toBe(0);
    expect((await run("pnpm -s study init --lang <lang>", { lang: "ts" })).code).toBe(0);

    // Both base concepts learned: the next day is phase 1, with its list and an announcement (§5, §6).
    for (const slug of ["basics-a", "basics-b"]) {
      expect((await cli(["record", "explanation", slug])).code).toBe(0);
      const study = openStudy(root, { clock });
      try {
        recordWork(study, `${slug}/01`, { type: "run", lang: "py", green: true }, "cli");
      } finally {
        study.close();
      }
    }
    clock.advance(DAY);
    expect(await today()).toMatchObject({
      phase: { id: "learn", preset: "demo-list", list: { list: "demo-list", imported: 8, size: 8 } },
      announcements: [{ key: "phase-advanced", payload: { from: "bases", to: "learn" } }],
    });

    expect([...ran].sort()).toEqual([...CLAUDE_RUNS].sort());
  });
});
````

In `scripts/tests/claude-layer.test.ts`:
1. Replace `const SKILLS = ["problem", "concept", "hint", "review", "give-up"];` with `const SKILLS = ["problem", "concept", "hint", "review", "give-up", "coach"];`.
2. Append at the end of the file:

```ts
describe("the coach skill and the docs that point to it (study coach spec §11, §15)", () => {
  it("triggers on the questions the spec names", () => {
    const description = skill("coach").data.description as string;
    for (const phrase of ["¿qué me toca hoy?", "¿qué sigue?", "¿en qué fase voy?"]) expect(description).toContain(phrase);
  });

  it("CLAUDE.md lists the coach and the presets, and README.md starts the daily flow with it", () => {
    const claude = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(claude).toMatch(/^\| `coach` \| /m);
    expect(claude).toContain("`curriculum/<preset>.yaml`");
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toContain('**"¿qué me toca hoy?"**');
    expect(readme).toContain("(docs/superpowers/specs/2026-10-04-study-coach-design.md)");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run study/tests/coach-skill.test.ts scripts/tests/claude-layer.test.ts`
Expected: FAIL. `coach-skill.test.ts` cannot load (`ENOENT … .claude/skills/coach/SKILL.md`). In `claude-layer.test.ts`, every test that reads the coach's `SKILL.md` ("coach has parseable frontmatter…", "give-up can only be invoked by the user", "triggers on the questions…") fails the same way, and the docs test fails on `CLAUDE.md`.

- [ ] **Step 3: The skill**

Create `.claude/skills/coach/SKILL.md`:

```markdown
---
name: coach
description: Use when the user asks what to study today or what comes next, or about their phase and progress — "¿qué me toca hoy?", "¿qué sigue?", "¿qué hago hoy?", "¿en qué fase voy?", "¿cuánto me falta para la siguiente fase?", "rehaz el plan de hoy" — or wants to start the study coach, switch lists ("cámbiame a NeetCode 150"), choose the list to expand with, or pause or resume. Runs pnpm -s today --json, renders it in Spanish, acknowledges announcements, onboards on first use, and never gives hints or approaches.
---

# coach — today's plan, phases and lists

The hard rules and the student profile in `CLAUDE.md` apply. Reply in Spanish, in the student-profile tone: warm, a little humor, a few emojis to mark key points, short lines, no walls of text. `examples.md` next to this file has worked examples.

**The CLI is the only source.** Every answer starts from `pnpm -s today --json`. Never guess the plan, the phase or the progress, never read them from READMEs, and never open anything under `.study/`.

## 1. Run today's plan

Run `pnpm -s today --json` and branch on what it returns:

| It returns | Go to |
|---|---|
| `"initialized": false` | §2, no study database |
| `"started": false` | §3, onboarding |
| `"paused"` is not `null` | §4, paused |
| otherwise | §5, render the plan |

## 2. No study database (`initialized: false`)

Nothing to plan yet. Tell the user what to run; you never run `init` or `migrate` in this state.

- `"next": "migrate"` (this repo still holds progress from before the coach): stop `pnpm play` and `pnpm watch`, run `pnpm study migrate --dry-run` and read what it will do, then `pnpm study migrate`, review `git status` and commit what it strips. Then ask again: "¿qué me toca hoy?".
- `"next": "init"` (a fresh clone): run `pnpm study init`, then ask again.

## 3. Onboarding (`started: false`)

1. Run `pnpm -s study curriculum --json` and read `presets` (`id`, `imported`, `size`).
2. Ask, in **one** message:
   - how many minutes a day they want to study (45 if they do not mind);
   - Python or TypeScript;
   - which list: Grind 75 (`grind-75`, the default), Grind 169 (`grind-169`) or NeetCode 150 (`neetcode-150`). Say how much of each is imported (`imported` of `size`) and recommend one that is fully imported.
3. Wait for the answers. Then run `pnpm -s study init --minutes <n> --lang <lang>` (`<lang>` is `py` or `ts`; with a database it only updates the profile) and `pnpm -s study curriculum set <preset> --json`:
   - `"status": "started"`: go on with step 4.
   - `"status": "refused"`: that list is not imported. Follow §8 and ask them to pick an imported list.
4. Run `pnpm -s today --json` again and render it (§5). Its `coach-started` announcement is the welcome.

## 4. Paused (`paused` is not null)

Say since when (`paused.since`, as a local date) and that due dates are waiting for them, so nothing is lost. There is no plan while paused. To go on, the user runs `pnpm study resume` or presses Resume on the playground home. Stop there.

## 5. Render the plan

In this order, skipping what is empty:

1. **Announcements** (§6). After showing each one, run `pnpm -s study ack <id>` with its `id`. Acknowledge only what you showed.
2. **Phase:** its name (table below), `phase.progress` as `done/total`, and the list's name. If `phase.list.imported` is less than `phase.list.size`, say that the list is only partly imported. If `phase.id` is `"expand"` and `phase.expansion.list` is `null`, ask §7's question before anything else.
3. **Mode:** `"return"`: today opens with quick wins (the easiest due reviews first). `"catch-up"`: a catch-up day, with fewer new items so the reviews can catch up.
4. **Items**, one line each, in the order given: an emoji for the kind, the title and the id, the minutes, the reason in Spanish, and ✅ when `done` is true. Then what the user does with it (table below).
5. **Backlog:** when `backlog.waiting` is above 0: that many due reviews are waiting, spread over the next `backlog.days` days.
6. **Budget:** `budget.planned` of `budget.minutes` minutes.
7. One short closing line with the first concrete action (for example `pnpm play lc-0242`).

**Phases** (`phase.id`) and what ends each one (spec §6.1):

| `phase.id` | Say | Ends when |
|---|---|---|
| `bases` | Fase 0 · Bases | the five base concepts are learned: explanation accepted and every exercise green with no give-up |
| `learn` | Fase 1 · Aprender la lista | every problem of the list was solved and then passed 2 reviews (Good or Easy) |
| `master` | Fase 2 · Dominar la lista | one exam (random order, no hints, time-boxed) reaches 80% first-try success, and every failure is solved again later |
| `expand` | Fase 3 · Ampliar | at least 65% of the last 20 unseen Mediums of the expansion list solved alone within 35 minutes |
| `pro` | Fase 4 · Pro | never: interview or competitive track |

**Lists:** `grind-75` is Grind 75, `grind-169` is Grind 169, `neetcode-150` is NeetCode 150.

**Kinds** (`items[].kind`):

| `kind` | Emoji and label | What the user does |
|---|---|---|
| `continue` | ▶️ Sigue | goes on with the attempt already open: `pnpm play <id>` |
| `review` | 🔁 Repaso | solves it again **from scratch**: the playground shows **Start review**; from a terminal the user runs `pnpm study start <id>` |
| `exam` | 📝 Examen | the same with **Start exam**; exams take no hints |
| `new` | ✨ Nuevo | a first attempt: `pnpm play <id>` (or `pnpm watch <id> --open`); it starts with their first edit or run |
| `concept` | 📚 Concepto | reads `concepts/<id>/README.md` (or its page in the playground), does its exercises (`pnpm play <id>/01`, …), writes "My explanation", then asks you to review it ("revisa mi explicación", the `concept` skill). With `missing: true` the note does not exist yet: offer to create it with the `concept` skill. An exercise they gave up on counts again only once it is solved again: the playground shows **Start again** |

**Reasons** (`items[].reason`):

| `reason` | Say |
|---|---|
| `in progress · <name>` | "en curso" |
| `due today` | "toca hoy" |
| `due yesterday` | "tocaba ayer" |
| `due N days ago` | "tocaba hace N días" |
| `block i/n · <pattern>` | "bloque i de n · <pattern name>" |
| `mix · <pattern>` | "práctica mezclada" |
| `opens <pattern>` | "abre <pattern name>" |
| `bases i/n` | "base i de n" |
| `exam i/n` | "examen: i de n" |
| `expand · <list>` | "ampliación · <list name>" |
| `practice` | "práctica libre" |

Name patterns as the playground does (`PATTERN_LABELS` in `playground/web/lib/labels.ts`: `arrays-hashing` is "Arrays & hashing", `dp-1d` is "1-D DP"). **Never name the pattern of a `mix`, `continue`, `review` or `exam` item:** recognizing it without being told is the skill that mixed practice trains. Block items and the concept that opens a pattern do name it, because there the pattern is the lesson.

## 6. Announcements

Render each one from its `key` and `payload`, then acknowledge it (§5 step 1):

| `key` | `payload` | Say |
|---|---|---|
| `coach-started` | `{ preset, phase }` | Welcome to the coach 🎉: the list and the starting phase. Phase 0 is five short base concepts (Big-O, recursion, arrays and strings, maps and sets, sorting), one a day; then the list itself, pattern by pattern. Reviews from scratch run underneath everything |
| `phase-advanced` | `{ from, to }` | Celebrate 🥳: from which phase to which, and what the new one asks. With `to: "expand"`, ask §7's question when `phase.expansion.list` is `null` |
| `phase-set` | `{ from, to }` | Neutral: the phase was set by hand, from `from` to `to` |
| `curriculum-switched` | `{ from: { preset, phase }, to: { preset, phase } }` | The list changed from one to the other and the phase was recalculated against the new list. Every solved problem still counts. If the new phase is lower, say so kindly: it is the new list's measure, not a step back in what they know |
| `welcome-back` | `{ date, daysAway }` | A warm welcome back after `daysAway` days, with no guilt 💛. Today opens with quick wins, and time away never lowers the phase |

## 7. Phase 3: which list to expand with

When `phase.id` is `"expand"` and `phase.expansion.list` is `null`, ask: "¿ampliamos con Grind 169 o NeetCode 150?" (the choices are `phase.expansion.choices`). Add one line on how they differ: Grind 169 is the long version of the Grind list (most of Grind 75 plus more, harder problems); NeetCode 150 is a different selection, grouped by pattern, that shares about 58 problems with Grind 75.

When the user answers, run `pnpm -s study curriculum expand <list> --json`:
- `"status": "set"`: done. If `imported` is 0 (or below `size`), the list is not fully in the repo: follow §8. Until it is, `today` serves reviews only.
- `"status": "refused"`: that list is not one of `choices`. Say which ones are, and ask again.

## 8. A list that is not imported

`curriculum set` answers `"status": "refused"` when the preset's list has no problem in the repo, and `curriculum expand` reports `imported: 0`. Then:
- say it plainly; nothing changed, and the current list stays in force;
- offer the import: it is a project of its own, like the Grind 75 import (`docs/superpowers/specs/2026-10-03-grind-75-design.md` and `docs/superpowers/plans/2026-10-04-grind-75-import-procedure.md`). The header of `curriculum/<preset>.yaml` says where the list comes from. Ask whether they want to plan it now; never start importing without a clear yes.

## 9. Switching lists

Only on an **explicit request** that names the list ("cámbiame a NeetCode 150"). A question ("¿y si me cambio a NeetCode?") is not a request: explain what a switch does and ask whether they want it.

What a switch does (spec §6.5): solved problems keep counting, and the phase is recalculated against the new list, so it may go down (from phase 2 of Grind 75 to phase 1 of Grind 169, for example).

Run `pnpm -s study curriculum set <preset> --json`:
- `"status": "switched"`: say the change (`previous` → the new `preset` and `phase`), then run `pnpm -s today --json` and render it; its `curriculum-switched` announcement says the same, so show and acknowledge it there.
- `"status": "unchanged"`: they are already on that list.
- `"status": "refused"`: §8.

## 10. Other requests

| The user asks | You do |
|---|---|
| "¿en qué fase voy?", "¿cuánto me falta?" | `pnpm -s today --json` gives the phase and its progress; `pnpm -s study phase --json` adds `exitMet`. Explain what ends the phase (the Phases table) |
| a new plan for today ("rehaz el plan") | `pnpm -s today --json --refresh`, only on that explicit request |
| a different daily time or language | `pnpm -s study init --minutes <n>` or `pnpm -s study init --lang <lang>`; today's plan stays as it was unless they also ask for a new one |
| whether the coach is started or paused, without the plan | `pnpm -s study status --json`: its `coach` field (`started`, `preset`, `phase`, `paused`, `expansionList`) |
| help with an item, or why it fails | the `hint` skill |
| "ya pasa", a review of their solution | the `review` skill |
| to learn or review a concept | the `concept` skill |

## 11. Commands only the user runs

Tell the user the exact command and never run it yourself (the hook blocks it, and you never look for another way to do the same):

| The user wants to | They run |
|---|---|
| pause the coach (a trip, exams) | `pnpm study pause`, or Pause on the playground home |
| resume it | `pnpm study resume`, or Resume |
| start a review or an exam from a terminal | `pnpm study start <id>` (the playground's Start review does the same) |
| force a phase | `pnpm study phase set <phase>`, with `bases`, `learn`, `master`, `expand` or `pro`. Warn that it skips the phase's criteria |
| move the old progress into `.study/` | `pnpm study migrate --dry-run`, then `pnpm study migrate` |

## Never

- Never add hints, approaches, complexity targets or "piensa en …" to any item, and never say which pattern a mixed, review or exam item belongs to.
- Never run `curriculum set` or `curriculum expand` without the user's explicit choice.
- Never edit `.study/`, `curriculum/` or a README to change progress or the plan.
```

- [ ] **Step 4: The worked examples**

Create `.claude/skills/coach/examples.md`:

````markdown
# coach — worked examples

Each example is a real shape of `pnpm -s today --json` (a test checks them against the CLI) and an outline of the answer. Write the answer in Spanish; the quoted phrases are the tone to aim for, not a script.

## 1. The repo still has progress from before the coach

```json
{ "initialized": false, "next": "migrate" }
```

- Say there is nothing to plan until the old progress moves into `.study/`, and that only the user runs that move.
- The steps: stop `pnpm play` and `pnpm watch`; `pnpm study migrate --dry-run` and read it; `pnpm study migrate`; review `git status` and commit what it strips.
- End with "Cuando termines, pregúntame otra vez «¿qué me toca hoy?» 🚀".

## 2. First use: the coach has not started

```json
{
  "initialized": true,
  "started": false,
  "date": "2026-10-05",
  "paused": null,
  "phase": null,
  "announcements": [],
  "mode": "normal",
  "items": [],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 0 }
}
```

- Run `pnpm -s study curriculum --json` first.
- One message with the three questions: minutes a day ("¿Cuántos minutos al día? Si te da igual, arrancamos con 45"), Python or TypeScript, and the list (Grind 75 recommended: it is the one already imported).
- After the answers: `pnpm -s study init --minutes <n> --lang <lang>`, `pnpm -s study curriculum set <preset> --json`, then today's plan again (example 3).

## 3. Day one of phase 0

```json
{
  "initialized": true,
  "started": true,
  "date": "2026-10-05",
  "paused": null,
  "phase": { "id": "bases", "since": "2026-10-05T14:00:00.000Z", "preset": "grind-75", "progress": { "done": 0, "total": 5 }, "list": null, "expansion": null },
  "announcements": [{ "id": 1, "key": "coach-started", "at": "2026-10-05T14:00:00.000Z", "payload": { "preset": "grind-75", "phase": "bases" } }],
  "mode": "normal",
  "items": [{ "kind": "concept", "id": "big-o", "title": "Big-O", "minutes": 20, "reason": "bases 1/5", "done": false, "missing": false }],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 20 }
}
```

- The welcome (`coach-started`): Grind 75, phase 0, what the phases are in two lines. Then `pnpm -s study ack 1`.
- "Fase 0 · Bases — 0/5".
- "📚 Concepto · Big-O (big-o) · 20 min · base 1 de 5": read `concepts/big-o/README.md`, do its three exercises (`pnpm play big-o/01`…), write "My explanation", then "revisa mi explicación".
- "Hoy: 20 de 45 minutos".

## 4. A normal day in phase 1

```json
{
  "initialized": true,
  "started": true,
  "date": "2026-11-02",
  "paused": null,
  "phase": { "id": "learn", "since": "2026-10-12T15:00:00.000Z", "preset": "grind-75", "progress": { "done": 9, "total": 75 }, "list": { "list": "grind-75", "imported": 75, "size": 75 }, "expansion": null },
  "announcements": [],
  "mode": "normal",
  "items": [
    { "kind": "continue", "id": "lc-0020", "title": "Valid Parentheses", "minutes": 15, "reason": "in progress · stack", "done": false, "missing": false },
    { "kind": "review", "id": "lc-0001", "title": "Two Sum", "minutes": 9, "reason": "due 2 days ago", "done": true, "missing": false },
    { "kind": "new", "id": "lc-0232", "title": "Implement Queue using Stacks", "minutes": 15, "reason": "block 2/3 · stack", "done": false, "missing": false }
  ],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 39 }
}
```

- "Fase 1 · Aprender la lista — 9/75 (Grind 75)".
- "▶️ Sigue · Valid Parentheses (lc-0020) · en curso".
- "🔁 Repaso · Two Sum (lc-0001) · tocaba hace 2 días ✅".
- "✨ Nuevo · Implement Queue using Stacks (lc-0232) · 15 min · bloque 2 de 3 · Stack": a block item names its pattern.
- "Hoy: 39 de 45 minutos", and the first action: `pnpm play lc-0020`.

## 5. Back after a break

```json
{
  "initialized": true,
  "started": true,
  "date": "2026-11-20",
  "paused": null,
  "phase": { "id": "learn", "since": "2026-10-12T15:00:00.000Z", "preset": "grind-75", "progress": { "done": 14, "total": 75 }, "list": { "list": "grind-75", "imported": 75, "size": 75 }, "expansion": null },
  "announcements": [{ "id": 7, "key": "welcome-back", "at": "2026-11-20T13:30:00.000Z", "payload": { "date": "2026-11-20", "daysAway": 9 } }],
  "mode": "return",
  "items": [
    { "kind": "review", "id": "lc-0704", "title": "Binary Search", "minutes": 9, "reason": "due 6 days ago", "done": false, "missing": false },
    { "kind": "review", "id": "lc-0217", "title": "Contains Duplicate", "minutes": 9, "reason": "due 4 days ago", "done": false, "missing": false },
    { "kind": "new", "id": "lc-0242", "title": "Valid Anagram", "minutes": 15, "reason": "mix · arrays-hashing", "done": false, "missing": false }
  ],
  "backlog": { "waiting": 6, "days": 2 },
  "budget": { "minutes": 45, "planned": 33 }
}
```

- The welcome back first: "¡9 días! Bienvenido de vuelta 💛". No guilt; the phase is still 1.
- Today opens with quick wins: the reviews they are most likely to remember.
- "✨ Nuevo · Valid Anagram (lc-0242) · 15 min · práctica mezclada": a mixed item never names its pattern.
- "6 repasos más esperan; los reparto en los próximos 2 días".
- Then `pnpm -s study ack 7`.

## 6. Phase 3 begins: choose the list to expand with

```json
{
  "initialized": true,
  "started": true,
  "date": "2027-03-01",
  "paused": null,
  "phase": { "id": "expand", "since": "2027-03-01T14:10:00.000Z", "preset": "grind-75", "progress": { "done": 0, "total": 20 }, "list": null, "expansion": { "list": null, "choices": ["grind-169", "neetcode-150"] } },
  "announcements": [{ "id": 12, "key": "phase-advanced", "at": "2027-03-01T14:10:00.000Z", "payload": { "from": "master", "to": "expand" } }],
  "mode": "normal",
  "items": [{ "kind": "review", "id": "lc-0056", "title": "Merge Intervals", "minutes": 21, "reason": "due today", "done": false, "missing": false }],
  "backlog": { "waiting": 0, "days": 0 },
  "budget": { "minutes": 45, "planned": 21 }
}
```

- Celebrate: "¡Dominaste Grind 75! 🥳 Fase 3 · Ampliar". Then `pnpm -s study ack 12`.
- Ask: "¿ampliamos con Grind 169 o NeetCode 150?", with one line on each.
- After the answer: `pnpm -s study curriculum expand <list> --json`. With `imported: 0`, offer the import (SKILL.md §8); until then the plan holds reviews only.
````

- [ ] **Step 5: Byte check of the skill**

Run procedure P2 on the two files. Expected hashes:

| File | SHA-256 |
|---|---|
| `.claude/skills/coach/SKILL.md` | `d05b229f468aa52705513c3a775d48f45313435f4d390c38889911c44ffcf03d` |
| `.claude/skills/coach/examples.md` | `5fd28727438edb11c9d1d780b3cfd5d945830a8436216bbf8caac22135ab57c9` |

- [ ] **Step 6: `CLAUDE.md`**

1. In `## Skills`, replace:

```markdown
| Skill | Use it when |
|---|---|
```

   with:

```markdown
| Skill | Use it when |
|---|---|
| `coach` | The user asks what to study today, what comes next or which phase they are in, or wants to start the coach, switch or expand lists, or pause or resume it. |
```

2. In `## Repo map`, find the line that starts with ``- `.study/` (git-ignored`` (Plan A Task 19 added it) and insert this line right after it:

```markdown
- `curriculum/<preset>.yaml`: the study coach's presets (`grind-75`, the default; `grind-169`; `neetcode-150`): phase 0's five base concepts (`big-o`, `recursion`, `arrays-and-strings`, `maps-and-sets`, `sorting`), the list, and the order of its patterns with the concept that opens each. They are content: `pnpm -s check` validates them.
```

- [ ] **Step 7: `README.md`**

1. Replace the start of the section (only the start of step 1's line is shown; the rest of that line stays as it is):

```markdown
## Daily flow

1. Paste a problem statement or a LeetCode link into Claude Code.
```

   with:

```markdown
## Daily flow

Start every session by asking Claude **"¿qué me toca hoy?"** (or open the playground's home page). The study coach answers with today's plan: the reviews that are due (solved again from scratch), the next new item, and a note whenever you change phase. The first time, it asks how many minutes a day you want to study, Python or TypeScript, and which list (Grind 75 by default). Phase 0 is five short base concepts, one a day (Big-O, recursion, arrays and strings, maps and sets, sorting), each with three exercises. The steps below are what each item asks of you.

1. Paste a problem statement or a LeetCode link into Claude Code.
```

2. In `## Map`, replace:

```markdown
- [Web playground spec](docs/superpowers/specs/2026-09-28-web-playground-design.md)
```

   with:

```markdown
- [Web playground spec](docs/superpowers/specs/2026-09-28-web-playground-design.md)
- [Study coach spec](docs/superpowers/specs/2026-10-04-study-coach-design.md)
```

- [ ] **Step 8: Run the tests**

Run: `pnpm vitest run study/tests/coach-skill.test.ts scripts/tests/claude-layer.test.ts`
Expected: PASS (`coach-skill.test.ts`: 5 tests).

If the session test fails on a shape (a field the CLI names differently, an extra field, an output line worded otherwise), the CLI is the truth (Plan B owns it): fix the schema or the expectation in the test, **and** the matching wording in `SKILL.md` and `examples.md`, then rerun P2 and report the new hashes and why.

Run: `pnpm verify`
Expected: green.

- [ ] **Step 9: Spoiler and tone review**

Read `SKILL.md` and `examples.md` once more as the user would hear them, and confirm:
- no approach, data structure, complexity target or "piensa en …" for any problem or exercise (the examples name problems by title, minutes and reason only);
- no pattern name next to a `mix`, `continue`, `review` or `exam` item;
- every Spanish phrase is a short quotation inside English instructions (CLAUDE.md "Language").

- [ ] **Step 10: Review the tree and commit**

Run procedure P1 steps 2 and 3. The new or changed paths are exactly:
- `.claude/skills/coach/SKILL.md`
- `.claude/skills/coach/examples.md`
- `study/tests/coach-skill.test.ts`
- `scripts/tests/claude-layer.test.ts`
- `CLAUDE.md`
- `README.md`

```bash
git add .claude/skills/coach/SKILL.md .claude/skills/coach/examples.md study/tests/coach-skill.test.ts scripts/tests/claude-layer.test.ts CLAUDE.md README.md
git commit -m "feat(claude): add the coach skill: today's plan in Spanish, onboarding, announcements and lists"
```

---
## Final check (after Task 6)

- [ ] Run `pnpm verify && pnpm e2e`. Both must be green (`pnpm e2e` uses ports 4391 and 4392).
- [ ] Run `git status --short`. It must show only the user's files: the three modified `concepts/hash-map/` READMEs and any untracked or ignored solution files.
- [ ] Run `test ! -e .study/study.db && echo "no study database in the real repo"`. It must print the message.
- [ ] Run `git log --oneline "$BASE_C"..HEAD`. It must show 6 commits, one per task.
- [ ] Run `git diff --stat "$BASE_C" HEAD -- concepts/hash-map concepts/two-pointers concepts/INDEX.md INDEX.md problems curriculum`. It must print nothing: Plan C's commits change nothing outside its new folders, its two tests, the skill and the two docs (comparing commits leaves out the user's uncommitted edits).
- [ ] Run `pnpm -s check 2>&1 | tail -1`: `0 error(s), W−2 warning(s)`, with `W` from `$S/task-1-check.txt`. Then `pnpm -s check 2>&1 | grep -E '"(big-o|recursion|arrays-and-strings|maps-and-sets|sorting)"'` prints nothing.

## Rehearsal: Plans A, B and C end to end, on a scratch clone

The test suite already rehearses the migration on a copy of this repo (Task 1) and the coach's commands on a fixture (Task 6). This rehearsal drives the real stack once more, from a shell and a browser, on a throwaway clone: the CLI with a fixed clock, a real green run of the `big-o` exercises, and the playground's Today section on a scratch port. Claude cannot run `migrate` from a shell (Verified facts 7), so the clone starts its study store with `init` instead.

Every command below runs inside the clone, guarded by a marker file so that a wrong folder fails instead of touching the real repo. Shell state does not persist between commands, so start **every** shell command of this section with these two lines:

```bash
S="${TMPDIR:-/tmp}/plan-c"; R="$S/rehearsal"
in_clone() { (cd "$R" && test -f .rehearsal && unset ALGO_ROOT ALGO_STUDY && "$@"); }
```

- [ ] **R1. Clone and install**

```bash
rm -rf "$R" && git clone -q --branch study-coach --single-branch /Users/angelozdev/me/algorithms "$R" && touch "$R/.rehearsal"
in_clone pnpm install --offline --frozen-lockfile
```

Expected: exit 0. If the offline install misses a package, rerun with `--prefer-offline` instead of `--offline`. Never point the clone's `node_modules` at the real one (Global Constraints).

- [ ] **R2. What the user sees before migrating**

Run: `in_clone pnpm -s today --json`
Expected: `{ "initialized": false, "next": "migrate" }` (the clone carries the same legacy READMEs and tracked solutions as the real repo).

- [ ] **R3. Start the coach on day one (fixed clock)**

```bash
D1=2026-10-05T14:00:00.000Z
in_clone env ALGO_STUDY_NOW=$D1 pnpm -s study init --timezone America/Bogota --minutes 45 --lang py
in_clone env ALGO_STUDY_NOW=$D1 pnpm -s study curriculum set grind-75 --json
in_clone env ALGO_STUDY_NOW=$D1 pnpm -s today --json
in_clone env ALGO_STUDY_NOW=$D1 pnpm -s study ack 1
```

Expected:
- `curriculum set` prints `"status": "started"` with `"phase": "bases"`;
- `today` shows `phase.id` `bases` with `progress` `0/5`, the `coach-started` announcement with id 1, and exactly one item: `{ "kind": "concept", "id": "big-o", "title": "Big-O", "minutes": 20, "reason": "bases 1/5", "done": false, "missing": false }`;
- `ack` prints `Acknowledged announcement 1 (chat).`

- [ ] **R4. Solve the three `big-o` exercises for real, and accept the explanation**

1. Write your own Python solutions to `big-o/01`, `/02` and `/03` from their statements, as `$R/.study/solutions/exercises/big-o/01/solution.py` (and `02`, `03`): a class `Solution` with the entry method. They live only in the clone, are deleted with it in R7, and are never shown or described.
2. For each: `in_clone env ALGO_STUDY_NOW=2026-10-05T15:00:00.000Z pnpm -s test big-o/01 --lang py --json` (no `--no-record`: in the clone the run must count). Expected: `"green": true`, with `stress.status` `"pass"`.
3. `in_clone env ALGO_STUDY_NOW=2026-10-05T15:30:00.000Z pnpm -s study record explanation big-o`. Expected: `Recorded: the big-o explanation is accepted.`
4. `in_clone env ALGO_STUDY_NOW=2026-10-05T15:30:00.000Z pnpm -s study status big-o --json`. Expected: `"accepted": true`, `"learned": true`, and three exercises with `"done": true`.

- [ ] **R5. The next day, and ten idle days later**

```bash
in_clone env ALGO_STUDY_NOW=2026-10-06T14:00:00.000Z pnpm -s today --json
in_clone env ALGO_STUDY_NOW=2026-10-16T14:00:00.000Z pnpm -s today --json
```

Expected:
- day 2: `progress` `1/5` and one item, `{ "kind": "concept", "id": "recursion", "title": "Recursion", "reason": "bases 2/5", "missing": false, … }`;
- day 12: `"mode": "return"`, a `welcome-back` announcement with `daysAway` of 10, the phase still `bases`, and `recursion` still the item.

- [ ] **R6. The playground's Today section on a scratch port**

1. Note who holds port 4173: `lsof -nP -iTCP:4173 -sTCP:LISTEN` (the user's `pnpm play`, or nothing). Never touch it.
2. Start the clone's playground with the shell tool's background mode (not a trailing `&`), with the day-12 clock, and wait until its log prints `Playground: http://127.0.0.1:4393`:

   ```bash
   in_clone env ALGO_STUDY_NOW=2026-10-16T14:00:00.000Z pnpm play --no-open --port 4393 > "$S/play.log" 2>&1
   ```

3. `curl -s http://127.0.0.1:4393/api/study/today`. Expected: the same plan as R5's day 12, but with the `ui` surface's announcements: `coach-started` and `welcome-back` (only the chat acknowledged id 1).
4. In a real browser, on that port only:

   ```bash
   playwright-cli -s=plan-c open http://127.0.0.1:4393/
   playwright-cli -s=plan-c find "Recursion"
   playwright-cli -s=plan-c find "Welcome back after 10 days"
   playwright-cli -s=plan-c find "0 · Bases"
   playwright-cli -s=plan-c close
   ```

   Expected: each `find` returns a match in the Today section.
5. Stop it: `lsof -t -nP -iTCP:4393 -sTCP:LISTEN | xargs kill`. Then `lsof -nP -iTCP:4393 -sTCP:LISTEN` prints nothing, and `lsof -nP -iTCP:4173 -sTCP:LISTEN` prints what step 1 printed.

- [ ] **R7. Clean up**

Run `rm -rf "$R"`: the clone, its study store and its solutions go together. If the hook refuses the delete, leave it and give the user the path in the report.

## Hand-off for the user (not run by this plan)

Report these steps to the user, in Spanish, as the last thing:

1. Stop `pnpm play` (port 4173) and `pnpm watch`.
2. Run `pnpm study migrate --dry-run` and read it. It lists every solution file it will archive under `.study/solutions/…/history/*-legacy.*` (the tracked ones with `git rm --cached`, and the untracked ones: hash-map 01 and 02, two-pointers/01-pair-sum, lc-0026, lc-0053, lc-0066, lc-0067, lc-0070 and any newer), each README it strips, the "My explanation" texts it moves to `.study/explanations/`, and the final `sync`.
3. Run `pnpm study migrate`.
4. Review `git status`, then commit the result as content by explicit paths: the stripped READMEs, the regenerated `INDEX.md`, `concepts/INDEX.md` and auto-sections (this is when the five new concepts join the learning path and the problems that reference `recursion` and `sorting` link to them), and the removed tracked solutions. The three `concepts/hash-map/` READMEs are stripped too: their status marks were the only uncommitted change in them.
5. Ask Claude **"¿qué me toca hoy?"**. The coach asks for minutes a day, the language and the list, then starts phase 0 with Big-O.
6. Optional follow-ups:
   - add `requires: [maps-and-sets]` to `concepts/hash-map/README.md` once it is committed;
   - review `concepts/hash-map/exercises/03-same-letters`, which asks the same question as lc-0242, and the two-pointers template, which merges two sorted lists as lc-0021 asks (Decisions 9);
   - part 2 of the coach: the Today section shows `mix · <pattern>`, while the coach does not name it (Decisions 4).

## Report to the controller (after the final check)

- Per task: the commit, the P2 result, the P3 lines (`Filled …`), the P4 table as confirmed (questions only), the P5 line, and the `check` count line.
- The rehearsal: R2–R6 results in one line each, and the cleanup.
- Anything that deviated from the plan, with why.
- Never: reference code, an approach, a complexity target or a hidden expected value.
