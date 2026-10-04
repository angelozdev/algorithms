---
name: problem
description: Use when the user pastes an algorithm problem statement, names a problem ("two sum", "lc 42", a LeetCode URL), or asks what they need to learn to solve one — in Spanish or English ("tengo este problema", "¿qué necesito para resolver…?"). Registers the problem (README, cases.json, optional stress.ts) and replies ONLY with the concepts needed for the optimal solution. Never gives hints, approaches or solutions.
---

# problem — register a problem and name the concepts it needs

The hard rules in `CLAUDE.md` apply. Reply to the user in Spanish; write files in English.

## 1. Identify the problem

- **LeetCode** (URL, slug, or number + title): run `pnpm -s leetcode <slug>`. It prints JSON with `id`, `folder`, `title`, `difficulty`, `url`, `statement` (Markdown), `cases` (a draft `cases.json` with the examples and no hidden cases) and `warnings`. If you only have a number, work out the slug from the title, and ask the user if you are unsure.
- **Other platforms or pasted text:** build the same data from the statement. The folder is `<platform>-<NNNN>-<slug>` (for example `hr-0042-…`), or `<platform>-<slug>` when the platform has no numeric ids.
- **Already registered** (`problems/<folder>/` exists): do not recreate anything. Jump to step 6 using its frontmatter.

## 2. Write `problems/<folder>/README.md`

```markdown
---
id: lc-0042
title: Trapping Rain Water
source: leetcode
url: https://leetcode.com/problems/trapping-rain-water/
difficulty: hard
patterns: []
concepts: []
lists: []
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 42. Trapping Rain Water

## Statement

<A 2–5 sentence English paraphrase. Never copy the statement verbatim: the repo is public.>

**Examples**

- `<input as written in the statement>` → `<output>`

**Constraints:** `<constraint>` · `<constraint>`

**Follow-up:** <only if the platform states one>

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- YYYY-MM-DD · registered
```

- Quote a `title` that contains a colon (`title: "Foo: Bar"`).
- `lists`: the curated lists the problem was imported from, kebab-case (`[grind-75]`); keep `[]` otherwise.
- Use `status: todo` instead of `solving` if the user says the problem is for later.
- Run `pnpm -s leetcode --check-paraphrase problems/<folder>/README.md` and rewrite every sentence it flags until `copied` is empty.

## 3. Write `cases.json`

Start from the draft (`cases` from step 1), or write it from the statement:

- `examples`: every example from the statement, verbatim, with `expected`.
- `hidden`: 6–10 inputs **without** `expected`. Cover the edges allowed by the constraints: smallest input, empty (if allowed), duplicates, negatives and zeros, all-equal, sorted and reverse-sorted, maximum values, and any tricky case the statement warns about.
- `compare`:
  - `unordered` if the statement says "any order".
  - `any-of` if several different answers are valid.
  - `float` for real-number answers.
  - `exact` otherwise.
- In-place problems:
  - `"inPlace": { "param": "<name>", "prefix": "return" }` when the function returns `k` and only the first `k` elements are judged.
  - Omit `prefix` when the whole array is judged (void functions).
- Class-design problems: `"mode": "class"`, `"entry": "<ClassName>"`, and every input as `{ "ops": [...], "args": [...] }`.

## 4. Stress cases (only when input size matters)

Add `stress.ts` when the constraints allow n ≥ 10^4 and a naive solution would be quadratic or worse:

```ts
import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  return [{ name: "n=1e5", input: [rng.intArray(100_000, -1_000_000_000, 1_000_000_000)] }];
}
```

- Generate inputs only, make them satisfy the problem's guarantees (for example "exactly one answer exists"), and never exceed the problem's own constraints: use the largest n they allow, not always 1e5.
- `Rng` offers `int(min, max)`, `intArray(n, min, max)`, `pick(items)`, `shuffle(items)` and `next()`.

## 5. Fill the hidden expected values

1. Write a reference solution **outside the repo**: `$TMPDIR/algorithms-ref-<id>/ref.py` (or `.ts`). Never under `problems/` or `concepts/`, and never named `solution.*`.
2. Run `pnpm -s fill-expected <id> --ref "$TMPDIR/algorithms-ref-<id>/ref.py"`. If it reports a disagreement with an example, the example is right: fix the reference and run it again.
3. Run `rm -rf "$TMPDIR/algorithms-ref-<id>"`.
4. Never show, quote or describe the reference to the user.

## 6. Name the concepts

1. Decide `patterns` (from the vocabulary in `CLAUDE.md`) and `concepts` (kebab-case slugs) for the **optimal** solution, and write them into the frontmatter.
2. For each concept, read `concepts/<slug>/README.md` to get its status (`mastered`, `learning`, `new`), or note that it is **missing**.
3. For each concept that is not mastered, walk its `requires` and collect the prerequisites that are not mastered either.

## 7. Sync and validate

Run `pnpm -s sync && pnpm -s check`, and fix every error you introduced.

## 8. Reply (in Spanish)

Only this:

- The problem title, its folder, and how to start: `pnpm play <id>` (web) or `pnpm watch <id> --open` (terminal; add `--lang ts` for TypeScript).
- The concepts, one per line: `- two-pointers — learning` / `- greedy — **falta** → ¿lo creamos?`
- The prerequisites that are not mastered, if any.

Nothing else: no approach, no complexity target, no "piensa en…". Naming the concepts **is** the help at this stage.
