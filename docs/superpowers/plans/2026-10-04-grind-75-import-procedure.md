# Grind 75 import procedure

Binding for Tasks 10–19 of `docs/superpowers/plans/2026-10-04-grind-75.md`. It extends `.claude/skills/problem/SKILL.md` steps 1–7, the authority for anything this file does not override. The spec is `docs/superpowers/specs/2026-10-03-grind-75-design.md` §6.

## Ground rules

- **No spoilers** (CLAUDE.md hard rules 1, 6 and 7):
  - Never write a problem's approach, its target complexity, a hint, or code that solves it in any repo file, commit message or report.
  - Concept and pattern names are the only help a README carries.
- **References:** the reference solution lives only at `$TMPDIR/algorithms-ref-<id>/ref.py` (or `ref.ts`). It is deleted after use, and never quoted, summarized or described anywhere.
- **Public repo:**
  - the statement is a paraphrase in your own words;
  - LeetCode drafts (verbatim statements) stay in `$TMPDIR/grind75/`;
  - examples and constraints are facts and may stay as written.
- **No solution files:**
  - never run `pnpm test`, `pnpm watch` or `pnpm play`, and never open a problem in the playground: all of them create `solution.py` / `solution.ts`;
  - never create, edit, open, stage or delete any `solution.*` file.

  Untracked solution files in the tree belong to the user.
- **Git:** stage by explicit path only. Never `git add -A`, `git add .`, `git commit -a`, `git stash`, `git reset --hard`, `git checkout -- <path>` or `git clean`. No push.
- **Network:** LeetCode calls are sequential, with `sleep 1` between them.
- **Port and checkout:** never touch port 4173 or the main checkout `/Users/angelozdev/me/algorithms`.
- **Language:** every file and commit message is in English.

## Setup (once per batch)

The user works in this worktree while batches run. Their uncommitted edits (a concept's "My explanation", a README status, new solution files) can sit in files `pnpm -s sync` also rewrites. Take a baseline **before touching anything**:

```bash
mkdir -p "$TMPDIR/grind75"
git status --porcelain --untracked-files=all > "$TMPDIR/grind75/baseline-<batch>.txt"
```

Every path in that baseline belongs to the user for this batch. Never stage it, even if `sync` changed it afterwards.

```bash
mkdir -p "$TMPDIR/grind75"
pnpm -s leetcode --list rab78cw1 > "$TMPDIR/grind75/list.json"   # folder names: .questions[].folder
```

Create the stress checker once per batch at `$TMPDIR/grind75/stress-check.mts`:

```ts
// Usage: pnpm exec tsx "$TMPDIR/grind75/stress-check.mts" problems/<folder> "$TMPDIR/algorithms-ref-<id>/ref.py"
import path from "node:path";
import { runHarness } from "/Users/angelozdev/me/algorithms-playground/runner/src/executor.ts";
import { loadCaseFile } from "/Users/angelozdev/me/algorithms-playground/runner/src/schema.ts";
import { DEFAULT_STRESS_LIMIT_MS, loadStressCases } from "/Users/angelozdev/me/algorithms-playground/runner/src/stress.ts";

const [dirArg, ref] = process.argv.slice(2);
const dir = path.resolve(dirArg);
const id = path.basename(dir).split("-").slice(0, 2).join("-");
const cf = loadCaseFile(dir);
const cases = await loadStressCases(dir, id, cf);
if (!cases) {
  console.log("no stress.ts");
} else {
  const outcome = await runHarness(
    ref.endsWith(".py") ? "py" : "ts",
    {
      solutionPath: ref,
      mode: cf.mode,
      entry: cf.entry,
      params: cf.params,
      returns: cf.returns,
      inPlace: cf.inPlace,
      discardOutput: true,
      cases: cases.map((c, i) => ({ id: `s${i + 1}`, input: c.input })),
    },
    { wallLimitMs: 120_000 },
  );
  if (outcome.fatal) console.log("FATAL", outcome.fatal.message);
  cases.forEach((c, i) => {
    const run = outcome.runs.get(`s${i + 1}`);
    const limit = c.limitMs ?? DEFAULT_STRESS_LIMIT_MS;
    const verdict = !run ? "NO RESULT" : !run.ok ? `ERROR ${run.error?.message}` : run.ms <= limit / 2 ? "ok" : "TOO SLOW";
    console.log(`${c.name}: ${verdict} (${run?.ms ?? "-"} ms of ${limit})`);
  });
}
```

## Per-problem steps A–H

Problem `<n>`, slug `<slug>`, with `<id>` and `<folder>` taken from `list.json`:

**A. Draft.**
- Run `pnpm -s leetcode <slug> > "$TMPDIR/grind75/<slug>.json"`, then `sleep 1`.
- Read `statement`, `cases` and `warnings`.
- A warning that the problem is `"manual"` means its `cases.json` follows the shape the task gives (Task 19 only). If a non-Task-19 problem warns "manual", stop and report it.

**B. README.**
- Write `problems/<folder>/README.md` with the skill's §2 template and these values:
  - `status: todo`, `hints: 0`, `solution_revealed: false`, `solved_in: []`, `complexity: null`;
  - `lists: [grind-75]` (on the line after `concepts:`);
  - `patterns` from the CLAUDE.md vocabulary, and `concepts` from the catalog below (skill step 6).
- Heading: `# <n>. <Title>`, with LeetCode's title (quote it in the frontmatter if it contains a colon).
- `## Statement`: a 2–5 sentence paraphrase.
- `**Examples**`: every example, with inputs and outputs as the statement writes them.
- `**Constraints:**` and an optional `**Follow-up:**`, both paraphrased where they are prose.
- `## Concepts` with the empty auto block.
- `## Log` with `- <date> · registered (Grind 75)`, where `<date>` is `date +%F`.

**C. Paraphrase check.**
- Run `pnpm -s leetcode --check-paraphrase problems/<folder>/README.md`, then `sleep 1`.
- `copied` must be `[]`. Rewrite flagged sentences until it is.

**D. `cases.json`.**
- Start from the draft's `cases` and apply the task's notes column: mode, types and compare.
- `examples`: all of the statement's, with `expected`.
- `hidden`: 6–10 inputs **without** `expected`, inside the constraints. Cover:
  - the smallest input, and empty input if allowed;
  - duplicates, negatives and zeros;
  - all-equal, sorted and reverse-sorted inputs;
  - the largest values;
  - every edge the statement warns about.
- Class mode: hidden inputs are op sequences that exercise every method, including the edge behaviors the statement defines (empty structure, capacity, overwrite…).
- For `any-of`, hidden inputs must have a single valid answer.

**E. `stress.ts`** (skill §4). Add it when:
- the constraints allow n ≥ 10^4 (or a long op sequence in class mode), and
- an input of that size can separate a fast solution from a slow one.

Rules for the file:
- Use the largest size the constraints allow, never more.
- Respect every guarantee (sorted input, unique answer, valid tree…).
- One to three cases.

Do not explain the choice in any file.

**F. Hidden expected values.**
- Write the reference at `$TMPDIR/algorithms-ref-<id>/ref.py`. Use Python when there is a `stress.ts`: it is the slower language, so a stress case it passes will pass in TS too.
- Run `pnpm -s fill-expected <id> --ref "$TMPDIR/algorithms-ref-<id>/ref.py"`.
- If it disagrees with an example, the example is right: fix the reference and run it again.

**G. Stress check** (only with a `stress.ts`):
- Run `pnpm exec tsx "$TMPDIR/grind75/stress-check.mts" problems/<folder> "$TMPDIR/algorithms-ref-<id>/ref.py"`.
- Every case must say `ok`: it ran within half its limit.
- On `TOO SLOW`, set that case's `limitMs` in `stress.ts` to about 2.5× the reference's time, rounded up to 500 ms. Keep the size.
- On `ERROR`, fix the generator.

**H. Clean up.**
- `rm -rf "$TMPDIR/algorithms-ref-<id>"`.
- Note for the report: folder, patterns, concepts, any new concept slug, compare mode, stress yes/no, and the warnings you handled.

## Concept catalog

Use these slugs (1–3 per problem). Reuse the existing ones exactly as written:

- **Already in the repo:** `hash-map`, `two-pointers`, `binary-search`, `linked-list`, `dummy-node`, `stack`, `recursion`, `dynamic-programming`, `matrix-traversal`, `string-traversal`, `string-matching`, `in-place-array-modification`, `binary-representation`, `carry-propagation`, `digit-manipulation`, `modular-arithmetic`, `arithmetic-series`, `gcd`.
- **New for Grind 75:** `hash-set`, `frequency-counting`, `prefix-sum`, `sorting`, `fast-slow-pointers`, `sliding-window`, `monotonic-stack`, `queue`, `divide-and-conquer`, `binary-tree`, `tree-dfs`, `tree-bfs`, `binary-search-tree`, `trie`, `heap`, `backtracking`, `graph-dfs`, `graph-bfs`, `topological-sort`, `union-find`, `memoization`, `greedy`, `intervals`, `bit-manipulation`, `string-parsing`, `class-design`.

A slug outside the catalog is allowed only when the problem's optimal solution needs a named idea that no entry covers. List it in the report with the problem. The controller normalizes new slugs across batches.

## Compare rules

| The statement says… | `compare` |
|---|---|
| nothing about order, and one answer | `exact` (default) |
| "in any order" for a list of items | `unordered` |
| a set of groups whose members are unordered (triplets, combinations, subsets) | `unordered-nested` |
| several different answers are valid | `any-of` (examples list the valid answers; hidden inputs have exactly one) |
| real-number answers | `float` |

The task's notes column overrides this table.

## What a batch touches

- New: `problems/<folder>/README.md`, `problems/<folder>/cases.json`, and optionally `problems/<folder>/stress.ts`, for each problem of the batch.
- Regenerated by `pnpm -s sync`: `INDEX.md`, `concepts/INDEX.md`, and the auto-sections `sync` maintains in READMEs (for example the `## Concepts` block and the backlinks in existing concept notes).
- Task 19 only: one added line in four existing READMEs.

## Batch checks

Run in order, from the worktree root:

1. `pnpm -s sync && pnpm -s check`: `0 error(s)`. Warnings about concepts that are referenced but not created are expected.
2. `for f in <this batch's README paths>; do pnpm -s leetcode --check-paraphrase "$f" >/dev/null || echo "COPIED: $f"; sleep 1; done`: prints nothing.
3. `pnpm verify`: green.
4. `ls "$TMPDIR" | grep algorithms-ref`: prints nothing (every reference is deleted).

## Review the tree

Run `git status --porcelain --untracked-files=all` and compare it with the batch's baseline file:
- **Paths in the baseline** are the user's. Never stage them, even when `sync` changed them too. Mention any such path in the report ("sync also updated <path>, left unstaged: it holds the user's uncommitted edits").
- **New paths not in the baseline** must be exactly:
  - this batch's `problems/<folder>/` files;
  - the files `pnpm -s sync` regenerated (`INDEX.md`, `concepts/INDEX.md`, auto-sections);
  - in Task 19, the four tagged READMEs.

If anything else appears, stop and find out why before committing: it may be the user's live work.

## Commit

Stage by explicit path:
- each new `README.md`, `cases.json` and `stress.ts`;
- each path from `git diff --name-only` that is **not** in the baseline.

Run `git diff --cached --stat` and check that only those paths are staged. Then commit with the message the task gives.

If `INDEX.md` or `concepts/INDEX.md` is in the baseline (the user changed it), leave it unstaged. The next `pnpm -s sync` the user runs reconciles it.

## Report (to the file the controller names)

- **Per problem:** folder, patterns, concepts, any new concept slug, compare, stress yes/no, warnings handled.
- **Then:** the batch check outputs (the `check` count line, the verify summary), `git log --oneline -1`, and any problem you could not finish, with why.
- **Never:** reference code, an approach, a complexity or a hidden expected value.
