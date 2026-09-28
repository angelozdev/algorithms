# Algorithms Study System — Design (Sub-project A)

- **Date:** 2026-09-27
- **Status:** Implemented on branch `restructure`. §12 lists the amendments made after planning.
- **Branch:** `restructure`
- **Scope:** Sub-project A (knowledge base, Claude layer, test engine + terminal watch). Sub-project B (local web playground) gets its own spec later and builds on the engine defined here.

## 1. Intent

The user wants to study algorithms (LeetCode and similar platforms) through Claude Code without being handed solutions. They currently have no background in greedy, divide and conquer, graphs, trees, etc.

**What the user asked for**

1. A Markdown knowledge base: problems categorized, plus a concepts folder (explanations, exercises), with problems and concepts linked to each other.
2. A Claude Code workflow: the user gives a problem, Claude lists the concepts needed to reach the most efficient solution — never the solution itself. If a concept does not exist yet, Claude and the user create it together and link it.
3. A local runner for TypeScript and Python, RunJS-like, with no AI and no autocomplete, to try code against test cases.

**Assumptions accepted by the user**

- Personal use, single user.
- Concepts start from zero (no prior knowledge assumed).
- "Most efficient" means the concepts required for the optimal-complexity solution, not just any solution.
- The anti-spoiler rule covers pseudocode and implementation hints, not only final code.

**Success criteria (definition of done for sub-project A)**

1. `pnpm watch two-sum --open` works for both `py` and `ts`.
2. `/problem` with a newly pasted statement produces files that pass `pnpm check` and replies with concepts only.
3. The hook blocks Claude from editing any `solution.*` file.
4. All 19 migrated legacy problems pass `pnpm check`, and `INDEX.md` is generated.
5. One concept (e.g. `hash-map`) exists end to end with runnable exercises.

## 2. Decisions log

| Topic | Decision |
|---|---|
| Location | Restructure the existing `algorithms/` repo (keep git history). |
| Runner UX | Web playground, delivered in phases: engine + terminal watch now (A), web UI later (B). |
| Hint policy | Escalating on request: default = concept names only; level 1 = Socratic question; level 2 = key idea in words. Never code or pseudocode. |
| After green | Complexity review. If a better complexity exists, say so without saying how. Optimal solution shown only on explicit request after green. |
| Giving up | `/give-up` reveals the optimal solution in chat and marks the problem `revealed`. |
| Concept creation | Hybrid: Claude writes the base note and exercises; the user writes "My explanation" and solves the exercises. |
| Reading surface | Claude Code first; VS Code for reading. Standard relative Markdown links (no wikilinks). |
| Problem layout | Flat `problems/` folder + generated `INDEX.md` grouped by pattern. |
| Test cases | Visible examples + hidden cases + optional stress cases with a time limit. |
| Engine | TypeScript orchestrator + one small harness per language, talking JSON. |
| Language | **Every file in the repo is in English.** Claude chats with the user in **Spanish**. |
| Claude config scope | Project-level only (`algorithms/.claude/`). Nothing goes to `~/.claude/`. |
| Dependencies | Allowed when they remove real complexity or flakiness: `chokidar` (watch mode) and `node-html-markdown` (LeetCode statements) were adopted during implementation. See §7 and §12. |

## 3. Repository layout

```
algorithms/
├── CLAUDE.md                     # rules + workflow (English)
├── AGENTS.md -> CLAUDE.md        # symlink so other agents follow the same rules
├── README.md                     # human quickstart (start Claude Code from this folder)
├── INDEX.md                      # generated: problems by pattern + status
├── package.json                  # pnpm scripts: watch, test, fill-expected, leetcode, sync, check, verify
├── pnpm-workspace.yaml           # allowBuilds: esbuild (pnpm 11)
├── pyproject.toml                # Python 3.13 + ruff config (no runtime deps)
├── tsconfig.json                 # includes `paths` alias for "lc"
├── concepts/
│   ├── INDEX.md                  # generated: concepts by status + learning path
│   └── <concept-slug>/
│       ├── README.md             # the concept note
│       └── exercises/
│           └── <NN>-<slug>/      # same shape as a problem folder
├── problems/
│   └── <problem-id>-<slug>/
│       ├── README.md
│       ├── cases.json
│       ├── stress.ts             # optional
│       ├── solution.py           # user-owned
│       └── solution.ts           # user-owned
├── lib/                          # shared Markdown model: frontmatter parser, repo scanner, frontmatter schemas
├── runner/
│   ├── src/                      # orchestrator, CLI, resolver, loader, stubs, comparator, reporter, watcher, stress worker
│   ├── harness/
│   │   ├── python/               # harness.py + lc.py (ListNode, TreeNode)
│   │   └── ts/                   # harness.ts + lc.ts (ListNode, TreeNode)
│   └── tests/                    # vitest + fixtures
├── scripts/                      # sync, check, leetcode
├── .claude/
│   ├── settings.json             # hook registration (committed)
│   ├── hooks/                    # guard-solution.mjs, reminder.mjs
│   └── skills/                   # problem, concept, hint, review, give-up
├── .vscode/settings.json         # AI + autocomplete disabled for this workspace
├── docs/superpowers/specs/
└── archive/                      # rust/, swift/, ts data-structures, legacy configs
```

### Naming

- **Problem folder:** `<platform>-<NNNN>-<slug>` for platforms with numeric IDs (`lc-0001-two-sum`). Platforms without numeric IDs use `<platform>-<slug>`. The **problem id** is the folder name without the slug (`lc-0001`) or, for non-numeric platforms, the full folder name. Numbers are zero-padded to 4 digits so alphabetical order matches numeric order.
- **Platform prefixes:** `lc` (LeetCode). New prefixes (`hr`, `cw`, …) are added when the first problem from that platform arrives.
- **Concept slug:** kebab-case (`hash-map`, `two-pointers`, `greedy`).
- **Exercise folder:** `concepts/<concept-slug>/exercises/<NN>-<slug>/`. **Exercise id:** `<concept-slug>/<NN>` (e.g. `greedy/01`).
- Any folder containing a `cases.json` is runnable, whether it is a problem or an exercise.

## 4. File formats

**Rule:** frontmatter is the source of truth. Sections wrapped in `<!-- auto:<name> -->` … `<!-- /auto -->` are rewritten by `pnpm sync`. Everything else is edited by the user or by Claude.

### 4.1 Problem `README.md`

```markdown
---
id: lc-0001
title: Two Sum
source: leetcode
url: https://leetcode.com/problems/two-sum/
difficulty: easy                 # easy | medium | hard
patterns: [arrays-hashing]       # drives INDEX.md grouping; fixed vocabulary (§12)
concepts: [hash-map]             # concept slugs (may reference concepts not created yet)
status: solving                  # todo | solving | solved | revealed
hints: 0                         # highest hint level reached: 0 | 1 | 2
solution_revealed: false         # true once the optimal solution was shown (review request or give-up)
solved_in: []                    # languages where examples + hidden + stress all pass
complexity: null                 # set by review: { time: "O(n)", space: "O(n)", optimal: true }
---
# 1. Two Sum

## Statement
(short paraphrase in English + the platform's examples; see note below)

## Concepts
<!-- auto:concepts -->
- [Hash map](../../concepts/hash-map/README.md)
<!-- /auto -->

## Log
- 2026-09-27 · hint 1
- 2026-09-28 · green in py, O(n²) → better exists
- 2026-09-28 · green in py, O(n) ✓ optimal
```

- **Statement:** the repo is **public on GitHub**, so the statement is a short English paraphrase plus the examples and constraints, with the `url` for the full text. It is not a verbatim copy of the platform's statement.
- **Status transitions:**
  - `todo`: added for later ("save this one for later").
  - `solving`: set by `/problem` by default, and by `/hint`, `/review` and `/give-up` when they act on a `todo` item.
  - `solved`: set by `/review` when at least one language is fully green.
  - `revealed`: set by `/give-up`. A `revealed` problem that later goes fully green becomes `solved`, and `solution_revealed` stays `true`.
- **In progress:** `status: solving`, or `status: todo` with a `solution.py`/`solution.ts` in the folder (for example, created by `pnpm watch`). Exercises start as `todo`, so this is how the reminder and the skills see them once the user starts one.
- **Log:** one line per meaningful event (hint used, green, review verdict, reveal, migration result). Written by the skills.

### 4.2 `cases.json`

```json
{
  "mode": "function",
  "entry": "twoSum",
  "params": [
    { "name": "nums", "type": "int[]" },
    { "name": "target", "type": "int" }
  ],
  "returns": "int[]",
  "compare": "unordered",
  "examples": [
    { "input": [[2, 7, 11, 15], 9], "expected": [0, 1] }
  ],
  "hidden": [
    { "input": [[-3, 4, 3, 90], 0], "expected": [0, 2] }
  ]
}
```

**Type grammar:** `T := int | float | bool | string | ListNode | TreeNode | T[]`. `returns` may also be `void`. `ListNode` and `TreeNode` are nullable by nature and serialized LeetCode-style: `ListNode` as an array of values, `TreeNode` as a level-order array with `null` gaps.

**Modes**

- `function` (default):
  - Python: method `entry` on `class Solution`.
  - TypeScript: `export default function entry(...)`.
  - `input` is the positional argument list.
- `class` (design problems such as Min Stack or LRU Cache):
  - Python: class named `entry`. TypeScript: `export default class`.
  - `input` is `{ "ops": ["MinStack", "push", "getMin"], "args": [[], [3], []] }`, and `expected` is the list of return values (`[null, null, 3]`), LeetCode-style.
  - `params` and `returns` are omitted in class mode; stub generation writes the class with an empty constructor.

**`compare`**

- `exact` (default): deep equality.
- `unordered`: the top-level list may be in any order.
- `float`: absolute tolerance 1e-5, applied element-wise.
- `any-of`: `expected` is a list of acceptable answers; matching one is enough.

**In-place problems:** `"inPlace": { "param": "nums", "prefix": "return" }`.

- The comparison runs on the mutated `param` instead of the return value, using `compare`.
- With `"prefix": "return"`, the return value `k` must equal `expected.length`, and only the first `k` elements of the mutated param are compared.
- Without `prefix`, the whole mutated param is compared, and the return value is ignored (for functions returning `void`).

**Missing `expected`:** only allowed transiently while `fill-expected` runs (see §5.2). `pnpm check` treats it as an error.

### 4.3 `stress.ts` (optional)

```ts
import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  // e.g. n = 100_000 inputs; rng is seeded per problem id → deterministic
  return [{ name: "n=1e5", input: [/* … */] }];
}
```

- Stress cases check **time only**, not correctness.
- The default limit is **2000 ms per case**, measured inside the harness (Python interpreter startup is excluded). An optional `limitMs` overrides it per case.
- The generous margin is deliberate: at n = 10⁵, O(n log n) passes in any language and O(n²) finishes in none.
- Inputs stay within the problem's own constraints (the largest n they allow, not always 10⁵), and each `input` must match the `cases.json` signature: the runner and `pnpm check` report a mismatch as a case-file error.
- The generator runs in its own process with a 10 s limit (see §5.3).

### 4.4 Concept `README.md`

```markdown
---
slug: greedy
title: Greedy algorithms
status: learning        # new | learning | mastered
requires: [sorting]     # prerequisite concept slugs
related: [dp-1d]
---
# Greedy algorithms

## Intuition            <!-- Claude: analogy-first -->
## Diagram              <!-- Claude: ASCII -->
## Signals              <!-- Claude: statement phrases that hint at this concept -->
## When it fails        <!-- Claude: classic counterexample -->
## Typical complexity   <!-- Claude -->
## Template             <!-- Claude: generic, never shaped after an unsolved user problem -->
## Exercises
<!-- auto:exercises -->
<!-- /auto -->
## Quick checks         <!-- Claude: 2–4 questions answered in chat -->
## My explanation       <!-- USER: in your own words -->
## Problems
<!-- auto:problems -->
<!-- /auto -->
```

- **Status:**
  - `new`: the note was created ahead of time (e.g. as a prerequisite).
  - `learning`: the user is actively studying it. `/concept` sets this when it creates the note during a study session, or when the user starts a `new` concept.
  - `mastered`: set by `/concept` in review mode, only when "My explanation" has content **and** every exercise passes in the runner.
- **Exercise folders** have the same `README.md` + `cases.json` (+ optional `stress.ts`) shape as problems.
  - Exercise frontmatter: `id`, `title`, `concept`, `status` (`todo | solving | solved | revealed`), `hints`, `solution_revealed`, `solved_in`.
  - No `source`, `url`, `patterns`, or `complexity`.
- **Note style** comes from the user's profile (copied into `CLAUDE.md`): analogies drawn from frontend, music and IoT; diagrams; emojis; a light, humorous tone.

## 5. Test engine (runner)

### 5.1 CLI

| Command | Purpose |
|---|---|
| `pnpm watch <query> [--lang py\|ts] [--open]` | Run on every save of the solution file (and `cases.json`). `--open` runs `code <solution file>`. If `code` is not on PATH, it prints a warning and continues. |
| `pnpm test <query> [--lang py\|ts\|all] [--json]` | Single run. `--json` prints the machine-readable result for skills. |
| `pnpm fill-expected <query> --ref <path>` | Runs a reference solution located **outside the repo** against every input and writes `expected` for hidden cases (see §5.2). |

- The default language is `py`.
- If the solution file for the chosen language does not exist, the runner creates a stub from `params`/`returns` (or an empty class in class mode).

**Query resolution** searches `problems/` and `concepts/*/exercises/`:

1. Exact id (`lc-0001`, `greedy/01`).
2. Bare number (`1`, `0001`), mapped to `lc-NNNN`.
3. Case-insensitive substring of the folder slug.
4. If there are several matches: print the candidates and exit with code 1 (watch included). The runner never guesses.

### 5.2 `fill-expected` (how hidden cases get correct answers)

Claude writes hidden inputs without `expected`, then:

1. Writes a reference solution to a temp directory **outside the repo** (`$TMPDIR/algorithms-ref-<id>/`).
2. Runs `pnpm fill-expected <id> --ref <that file>`. The runner executes the reference against examples and hidden inputs.
3. If the reference output disagrees with any example's `expected`, the command fails and writes nothing.
4. Otherwise it fills `expected` for every hidden case.
5. Claude deletes the temp directory.

Result: the repo never contains a solution that is not the user's.

### 5.3 Execution pipeline

```
resolver → loader (schema-validate cases.json) → stub (if missing)
        → executor → harness subprocess → comparator → reporter (terminal | JSON)
        → watcher (chokidar, 100 ms debounce, clear screen, rerun)
stress.ts → stress worker (own process, 10 s limit), only once hidden passes
```

- **Phases, gated:** examples → hidden → stress.
  - Hidden runs only if all examples pass. Otherwise it is reported as `skipped (fix examples first)`.
  - Examples and hidden share one harness process; hidden results are reported only when every example passes. What the user sees is the same as two gated runs, and each save costs one process start instead of two.
  - Stress runs only if all hidden cases pass.
  - Stress runs in its own subprocess, so a hang there never loses the earlier results.
- **Loading stress cases:** lazily, and out of process.
  - `stress.ts` is loaded only when every hidden case passes. Most saves in watch mode stop at examples or hidden, so generating 10⁵-element inputs on every save would only add latency.
  - Generation runs in a separate `node --import <tsx loader>` process (the stress worker), which sends the cases back as JSON and is killed after 10 s. A generator that never returns cannot freeze `pnpm watch`, `pnpm test` or `pnpm check`; a timeout, crash, load error or throw is reported as a case-file error for `stress.ts`.
  - A fresh process per load also means edits to `stress.ts` are always picked up, with no module-cache tricks.
  - `pnpm check` loads every `stress.ts` the same way (the generator only, never a solution), so a broken file is caught when it is written, not at the user's first green.
- **Protocol:**
  - The orchestrator spawns the harness with an extra pipe on **fd 3** and sends one request on stdin: `{ solutionPath, mode, entry, params, returns, inPlace, cases: [{ id, input }] }`.
  - The request **never includes `expected`**. The harness only executes; the orchestrator compares.
  - The harness writes one JSON line per case to fd 3: `{ id, ok: true, output, ms, stdout }` or `{ id, ok: false, error: { kind, message, trace }, stdout }`.
  - Anything the user's code prints is captured in-process per case (`redirect_stdout`/`redirect_stderr` in Python; `process.stdout.write`/`process.stderr.write` patched in TypeScript), capped at 64 KB, and attributed to the case that was running. The protocol channel is never corrupted by user prints.
- **Type adapters** live in the harness: arrays ⇄ `ListNode`/`TreeNode` on input and output, plus in-place param capture.
- **Timeouts:**
  - Per-case time is measured inside the harness.
  - The orchestrator also enforces a wall-clock limit: 5000 ms for the examples+hidden process, and the sum of stress limits + 2000 ms for the stress process.
  - On kill, the case in flight is marked `timeout` (covers infinite loops) and the remaining cases are marked `skipped`.
- **Interpreters:**
  - Python is resolved once at startup via `uv python find 3.13`, not `uv run` per save.
  - TypeScript runs as `node --import <tsx loader> harness.ts` with `TSX_TSCONFIG_PATH` pointing at the repo `tsconfig.json`, so any syntax the user writes works. The `tsx` CLI is not used: it runs the script in a child process that does not inherit fd 3.
  - Tests and tools can override the content root with `ALGO_ROOT` and the interpreter with `ALGO_PYTHON`.
- **The `lc` helper module** provides `ListNode` and `TreeNode`:
  - Python: `harness/python/lc.py`, added to `sys.path` by the harness and to `python.analysis.extraPaths` in `.vscode/settings.json`.
  - TypeScript: `harness/ts/lc.ts` via the `tsconfig.json` `paths` alias `lc`.
  - Stubs import from `lc` only when the problem uses those types, with a comment telling the user to delete that line when pasting into LeetCode.

### 5.4 What the reporter shows

| Phase | Shown |
|---|---|
| Examples | Input, expected, got, time, captured stdout. |
| Hidden | Pass count. For the **first** failing case: its input and **the user's output** (or error). **Never the expected value.** |
| Stress | Case name, time vs. limit, or `timeout`. |
| stdout | Shown for examples and the first failing hidden case, truncated to 20 lines. Suppressed for stress. |
| User errors | Traceback trimmed to frames from the user's file. A missing entry reads `expected method "twoSum" in class Solution` / `expected default export function "twoSum"`. |
| Invalid `cases.json` | Exact field path (`hidden[3].input: expected 2 params, got 1`), labeled as a case-file error, not a user error. |

Terminal sample:

```
lc-0001 · Two Sum · py                      problems/lc-0001-two-sum/README.md
─────────────────────────────────────────────────────────────────────────────
✓ example 1   [2,7,11,15], 9 → [0,1]                                  0.01ms
✓ example 2   [3,2,4], 6 → [1,2]                                      0.01ms
✗ example 3   [3,3], 6
    expected  [0,1]
    got       [0,0]
    stdout    > seen = {3: 0}
– hidden      skipped (fix examples first)
– stress      skipped
─────────────────────────────────────────────────────────────────────────────
2/3 examples · watching solution.py …
```

**JSON result** (`--json`: one object for a single language, an array of objects for `--lang all`):

```json
{
  "id": "lc-0001",
  "lang": "py",
  "examples": { "passed": 2, "total": 3, "cases": [{ "id": 1, "status": "pass", "input": [[2, 7, 11, 15], 9], "expected": [0, 1], "output": [0, 1], "ms": 0.01, "stdout": "" }] },
  "hidden": { "passed": 0, "total": 9, "status": "skipped", "firstFailure": null },
  "stress": { "status": "skipped", "cases": [] },
  "green": false
}
```

`hidden.firstFailure` is `{ input, output | error, stdout }`. It has no `expected` field, and no other part of the JSON carries hidden expected values.

## 6. Claude layer (project-level)

All of it lives in `algorithms/.claude/` and `algorithms/CLAUDE.md`, and all of it is written in English. Claude Code must be started from `algorithms/` so that `settings.json` (hooks) loads. The README states this.

### 6.1 `CLAUDE.md` hard rules

1. Never write, show, or paraphrase code or pseudocode that solves a problem or exercise whose status is not `solved` (or `revealed`). Concept templates and exercises must not be isomorphic to any problem the user has not solved.
2. Never edit the user's `solution.*` files. Claude does not fix the user's bugs.
3. "Why does it fail?", "help", and similar requests on an unsolved problem count as a hint request and go through `/hint`. Questions about the language itself ("¿qué hace enumerate?") are not: they get a direct answer with small generic examples unrelated to the problem, and cost no hint level, as long as the answer does not reveal the approach.
4. Never describe hidden cases beyond what the runner already printed.
5. Show the optimal solution only if the problem is green (examples + hidden + stress) **and** the user explicitly asks, or through `/give-up`.
6. Chat with the user in Spanish. Write every file in English.
7. Note style follows the student profile section (copied from `tutor/PROFILE.md`).

`CLAUDE.md` also contains: a repo map, the file formats (short form, pointing to this spec), the runner commands, and the status vocabulary. As built, rules 6–7 above became their own sections (language, student profile), and two more hard rules are explicit: no approach or complexity target volunteered before green, and reference solutions only in `$TMPDIR` (§12).

### 6.2 Skills (`.claude/skills/<name>/SKILL.md`)

Descriptions are in English and state that the user may speak Spanish, so natural-language triggers work (e.g. "tengo este problema", "dame una pista").

`hint`, `review`, and `give-up` apply to both problems and concept exercises. For exercises, `review` sets `status` and `solved_in` but skips `complexity`, since exercises have no complexity field.

**`problem`**

- *Triggers:* the user pastes a statement, names a problem, or asks what they need to learn for it.
- *Steps:*
  1. Create the folder, `README.md` (paraphrased statement + examples) and `cases.json` (examples verbatim, generated hidden edge cases). Add `stress.ts` when input size matters.
  2. Fill hidden `expected` via `fill-expected` (§5.2).
  3. Analyze `patterns` and `concepts` for the optimal solution. Set `status: solving` (or `todo` if the user says "for later").
  4. Run `pnpm sync` and `pnpm check`.
- *Reply (in Spanish):* only the concepts, each with its status (`mastered` / `learning` / `new` / **missing** → "¿lo creamos?"). Flag unmastered prerequisites. No hints.

**`concept`**

- *Create mode:*
  - Writes the note (§4.4) and 2–4 exercises of increasing difficulty, each with `cases.json` filled via `fill-expected`.
  - Leaves "My explanation" empty.
  - Sets `status` (`learning` if studying now, `new` if created ahead of time) and fills `requires`/`related`.
  - Offers to walk through the concept in chat.
- *Review mode:*
  - Reads "My explanation", gives feedback, and runs `pnpm test` on every exercise.
  - Sets `mastered` only when both conditions hold.
- *Sync:* runs `pnpm sync` and `pnpm check`.

**`hint`**

- *Target:* the problem or exercise the user names. If none is named and exactly one item is in progress (§4.1), use that one; otherwise ask. A `todo` target becomes `solving` (`review` and `give-up` use the same rule).
- *Not a hint:* a question about the language itself, answered as in §6.1 rule 3.
- *Escalation:* raises `hints` by one.
  - Level 1: one Socratic question. Claude may read the user's current solution to aim it.
  - Level 2: the key idea in words. No code, no pseudocode.
  - Beyond level 2: no further hints. Point to the concept note and its exercises, and mention `/give-up`.
- *Record:* appends to the Log.
- *After green:* also applies to reaching the optimal complexity.

**`review`**

- *Steps:*
  1. Run `pnpm test <id> --lang all --json`.
  2. If not green, report which phase fails and stop.
  3. If green, analyze the time and space complexity of the user's code and compare it with the known optimum.
  4. Update `status: solved`, `solved_in` and `complexity`, and append to the Log.
- *If not optimal:* state only that a better complexity exists and what it is ("existe O(n)"), never how.
- *Showing the optimum:* only if the user then explicitly asks. Show it in chat and set `solution_revealed: true`.
- *Sync:* runs `pnpm sync`.

**`give-up`**

- Only the user can start it (`disable-model-invocation: true`): Claude never reveals a solution on its own initiative.
- Asks for confirmation once.
- Explains the optimal solution in chat (code allowed here, chat only).
- Sets `status: revealed` and `solution_revealed: true`, appends to the Log, and runs `pnpm sync`.

### 6.3 Hooks (`.claude/settings.json` → `.claude/hooks/*.mjs`)

Plain `.mjs` for fast startup, because `reminder` runs on every prompt. `.claude/settings.json` also allow-lists the `pnpm -s` commands the skills run constantly (`test`, `sync`, `check`, `leetcode`, `fill-expected`), so they need no approval each time.

- **`guard-solution.mjs` (PreToolUse)**
  - `Edit|Write|MultiEdit|NotebookEdit`: deny when the target path matches `problems/**/solution.{py,ts}` or `concepts/**/solution.{py,ts}`, with a reason citing rule 2.
  - `Bash` (best effort, few false denies): deny commands that write to such a file (redirection, `tee`, in-place `sed`/`perl`, `cp`/`mv` onto it, `dd of=`, inline or piped `python`/`node`/`ruby`/`perl` code that names one). Also deny commands that can discard or delete the user's uncommitted solution work, with a reason saying the user must run them:
    - `rm` of a solution file (globs included) and recursive `rm` of an item folder, `problems/`, `concepts/`, the project or an ancestor; `find -delete`/`-exec rm` and `xargs rm` aimed at them;
    - `git checkout`/`restore`/`rm` on solution files or folders that hold them (and `.`), `git checkout -f`, `git switch --discard-changes`/`-f`, `git reset --hard`, `git clean -f` over them, and `git stash` other than `list`/`show`.
  - The command is read the way a shell would: quoted text and heredoc bodies are data (a commit message never triggers a deny), `bash -c`, shell heredocs, `eval`, `$(…)` and subshells are checked as commands, `cd` inside the command moves the working directory, and git commands in another repository are ignored. Reads, runs, `git add`, `git status`, `git restore --staged`, `git rm --cached` and `git mv` of an existing solution file are allowed.
  - The runner creating stubs is unaffected, because it is a separate process, not a Claude tool call.
- **`reminder.mjs` (UserPromptSubmit)**
  - Injects a short context block: rules 1–5 in one line each, plus the problems and exercises in progress (§4.1) and their `hints` level (read from frontmatter).
  - Keeps the rules fresh in long sessions.

## 7. Scripts

**`pnpm sync`**

- Reads all frontmatter and regenerates:
  - `INDEX.md`: problems grouped by pattern. A problem with several patterns appears under each one. Status markers: ✓ solved · … solving · ↺ revealed · ○ todo. Per-pattern counts.
  - `concepts/INDEX.md`: concepts grouped by status, plus a **learning path** in topological order of `requires`.
  - `auto:concepts` in problems, and `auto:exercises` / `auto:problems` (backlinks) in concepts.
- A concept that does not exist yet renders as plain text `greedy (missing)`, never as a broken link.
- It is idempotent (a second run produces no diff) and only writes inside `auto` markers and the two index files.

**`pnpm check`**

- *Errors (exit ≠ 0):*
  - Frontmatter schema per file kind (problem, exercise, concept) and `cases.json` schema.
  - Every relative link resolves.
  - No cycles in `requires`.
  - Hidden cases all have `expected`.
  - Every `stress.ts` loads, returns within 10 s, and produces inputs that match the `cases.json` signature (§5.3).
  - Status consistency: `solved` ⇒ `solved_in` non-empty; `mastered` ⇒ "My explanation" non-empty.
- *Warnings:* concepts referenced but not created.

**`pnpm verify`** = `vitest run` (runner, script and hook tests) + `pnpm check`. The `test` script name is reserved for the problem runner (§5.1), not for vitest.

**`pnpm leetcode <slug|url>`** prints a JSON draft of a LeetCode problem (statement as Markdown, a draft `cases.json`, warnings), used by the `problem` skill.

**Dependencies:** `typescript`, `tsx`, `vitest`, `zod` (schemas), `yaml` (frontmatter), `chokidar` (watch mode) and `node-html-markdown` (LeetCode statements). A dependency is allowed when it removes real complexity or flakiness:

- `chokidar` replaced a hand-rolled `fs.watch` layer: on macOS, `fs.watch` dropped events right after starting and needed fixed sleeps; chokidar gives a `ready` signal and handles atomic saves.
- `node-html-markdown` replaced a regex HTML-to-text converter that mangled lists, dropped `<sub>` and left entities raw.
- Still hand-written or built in: colors via `node:util` `styleText` (no chalk), `parseArgs`, native `fetch`, the small frontmatter parser, and the `node:child_process` executor. The Python harness stays stdlib-only.

## 8. VS Code workspace settings

`.vscode/settings.json` at the repo root:

- *Disabled:* quick suggestions, suggestions on trigger characters, word-based suggestions, parameter hints, inline suggestions, GitHub Copilot (`github.copilot.enable: { "*": false }`), and VS Code's built-in AI chat features. The exact setting names are verified against the installed VS Code version during implementation.
- *Kept:* syntax highlighting, format on save (ruff for Python), and diagnostics.
- *Added:* `python.analysis.extraPaths` for the `lc` module.
- This is a workspace setting and can be reverted. The hard guarantee of "no AI in the editor" arrives with sub-project B's web editor.

## 9. Migration of the existing repo

**Inventory (19 unique problems in py/ts)**

| # | Problem | Legacy files |
|---|---|---|
| 1 | Two Sum | py, ts |
| 9 | Palindrome Number | py, ts |
| 20 | Valid Parentheses | py |
| 21 | Merge Two Sorted Lists | ts |
| 26 | Remove Duplicates from Sorted Array | py |
| 27 | Remove Element | py |
| 28 | Find the Index of the First Occurrence in a String | py |
| 35 | Search Insert Position | py |
| 58 | Length of Last Word (legacy file misnamed `55_lenght_of_the_world.py`; verify) | py |
| 66 | Plus One | py |
| 70 | Climbing Stairs | py |
| 1672 | Richest Customer Wealth | ts |
| 1920 | Build Array from Permutation | ts |
| 2181 | Merge Nodes in Between Zeros | ts |
| 2807 | Insert Greatest Common Divisors in Linked List | ts |
| 2894 | Divisible and Non-divisible Sums Difference | ts |
| 2942 | Find Words Containing Character | ts |
| 3110 | Score of a String | ts |
| 3280 | Convert Date to Binary | ts |

**Steps**

1. Move each legacy file with `git mv` to `problems/lc-NNNN-slug/solution.{py,ts}` (history preserved).
2. Adapt only the wrapper shape to the harness contract:
   - `export default function`, and `class Solution` in Python.
   - Replace self-defined `ListNode` classes with the `lc` import.
   - Remove top-level/`__main__` test code (asserts, logs) that would run on import. Those asserts become `cases.json` examples.
   - **Algorithm logic is not touched.**
3. Write `README.md` (paraphrased statement, pulled via LeetCode's public GraphQL endpoint when available, otherwise link-only with a note), `cases.json` (examples from the legacy asserts + generated hidden cases via `fill-expected`), and `stress.ts` where relevant.
4. Run the runner on every migrated solution:
   - Fully green → `solved`, with `solved_in` set.
   - Fails anything → `solving`, with Log line `migrated: fails <phase>`. Legacy solutions are genuinely re-verified.
5. Fill `patterns` and `concepts`. Analysis is not a spoiler for solved problems. Concepts are created on demand, not during migration.
6. Move `rust/`, `swift/`, `ts/src/data-structures/`, and the legacy `ts/` and `python/` configs to `archive/` unchanged.
7. Replace `AGENTS.md` with a symlink to `CLAUDE.md`.
8. Install the hooks **after** the migration, since migration legitimately adapts legacy solution wrappers.

The work happens on branch `restructure`, with one commit per phase.

## 10. Testing strategy

Tests exercise behavior through public interfaces, not internals.

- **Runner (vitest):** fixture problems in `runner/tests/fixtures/`, each with py and ts solutions:
  - correct, wrong on an example, wrong on a hidden case, too slow (stress), infinite loop, syntax error, runtime exception, missing entry;
  - `ListNode` in/out, `TreeNode` in/out, in-place with `prefix`, class mode;
  - every `compare` mode.
  - Assertions are made on the `pnpm test --json` result.
  - **Dedicated leak test:** neither terminal nor JSON output contains any hidden `expected` value.
  - `fill-expected`: fills correctly; refuses when the reference disagrees with an example.
  - Resolver: ambiguous queries list candidates and exit 1.
- **Scripts:** a fixture tree copied to a temp dir → `sync` → compare `INDEX.md`, `concepts/INDEX.md` and auto sections against expected files. Also: idempotency, and `check` detecting a broken link, bad frontmatter, a `requires` cycle, and missing hidden `expected`.
- **Hooks:** feed sample hook-event JSON on stdin.
  - `guard-solution` denies Edit/Write/Bash writes to solution files and the destructive commands of §6.3, and allows other paths, reads, runs and `git mv`.
  - `reminder` lists in-progress problems and exercises (§4.1) with their hint levels.
- **Stress loading:** a generator that never returns fails fast with a `stress.ts` case-file error, both in the runner and in `pnpm check`; an edited `stress.ts` is reloaded.
- **Skills:** not unit-testable. Manual acceptance scenarios:
  1. Paste Two Sum → folder created, `check` passes, reply lists concepts only.
  2. Ask for the solution while `solving` → refusal, pointing to `/hint`.
  3. Three hints in a row → level 1, level 2, then refusal with a pointer to concept + `/give-up`.
  4. Claude tries to edit `solution.py` → hook denies.
  5. Green with O(n²) → review says a better complexity exists, without how.
  6. `/give-up` → confirmation, explanation in chat, `status: revealed`.
  7. Missing concept → `/concept` creates note + runnable exercises. Review mode refuses `mastered` while "My explanation" is empty.

## 11. Out of scope for sub-project A

- Sub-project B: the local web playground (editor without AI, statement/concept rendering, navigation). Its own spec.
- Languages other than Python and TypeScript.
- Custom output validators (`validate.ts`) for problems with many valid outputs beyond `any-of`. Added when the first such problem appears.
- Spaced repetition, statistics, dashboards.

## 12. Amendments after planning

Decisions made while planning or building sub-project A that are now part of the design. The sections above already reflect them.

| Change | Where | Why |
|---|---|---|
| A shared `lib/` (frontmatter parser, repo scanner, frontmatter schemas) | §3 | The runner, `sync` and `check` read the same Markdown model. |
| `pnpm leetcode <slug\|url>` prints a JSON draft (statement as Markdown, draft `cases.json`, warnings) | §7 | The `problem` skill reuses it for every LeetCode problem, not only during the migration. |
| Examples and hidden run in the same harness process; hidden is reported as `skipped` when an example fails | §5.3 | One process start per save instead of two (about 300 ms for TypeScript). The user sees the same result. |
| The TypeScript harness runs as `node --import <tsx loader>` with `TSX_TSCONFIG_PATH` | §5.3 | The `tsx` CLI runs the script in a child process that does not inherit fd 3. |
| User prints are captured in-process per case | §5.3 | Exact attribution without racing two pipes. |
| `give-up` has `disable-model-invocation: true` | §6.2 | A solution is revealed only when the user types `/give-up`. |
| `CLAUDE.md` gives language and profile their own sections and adds two hard rules: no approach or complexity target volunteered before green, and reference solutions only in `$TMPDIR` | §6.1 | Both were agreed during brainstorming; numbering them makes them checkable. |
| `.claude/settings.json` allow-lists `pnpm -s test/sync/check/leetcode/fill-expected` | §6.3 | The skills run these constantly; approving each call would break the flow. |
| `pnpm-workspace.yaml` with `allowBuilds: { esbuild: true }` | §3 | pnpm 11 fails `install` with `ERR_PNPM_IGNORED_BUILDS` otherwise. |
| Env overrides `ALGO_ROOT` (content root) and `ALGO_PYTHON` (interpreter) | §5.3 | Tests point the CLI at a temporary repo. |
| A fixed `patterns` vocabulary: arrays-hashing, two-pointers, sliding-window, stack, binary-search, linked-list, trees, tries, heap, backtracking, graphs, dp-1d, dp-2d, greedy, intervals, math, bit-manipulation, strings | §4.1 | `INDEX.md` groups stay consistent, and `check` rejects typos. |
| Dependencies are allowed when they remove real complexity: `chokidar` (watch) and `node-html-markdown` (LeetCode statements) | §7 | Both replaced hand-written code that was flaky or lossy. |
| Stress inputs are checked against the `cases.json` signature; `pnpm check` loads every `stress.ts`; stress cases are generated lazily, in a separate process with a 10 s limit | §4.3, §5.3, §7 | A malformed input gave a false green; a generator that never returns froze `watch`, `test` and `check`; generating on every save would slow watch mode. |
| "In progress" = `status: solving`, or `status: todo` with a solution file; `hint`, `review` and `give-up` set a `todo` target to `solving` | §4.1, §6.2, §6.3 | Exercises start as `todo` and nothing flipped them, so the reminder and the hint target rule never saw them. |
| Language questions are not hint requests | §6.1, §6.2 | The user has almost no Python experience; a question like "¿qué hace enumerate?" must not spend a hint level or be refused, as long as the answer does not reveal the approach. |
| The Bash guard also blocks commands that can discard solution work (`rm` globs and recursive deletes, `git checkout/restore/rm/reset --hard/clean -f/stash`, `find -delete`, inline interpreter writes), reading the command as a shell would | §6.3 | These throw away the user's uncommitted work; the user runs them if they are really needed. |
