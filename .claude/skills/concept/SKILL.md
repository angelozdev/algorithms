---
name: concept
description: Use when a concept note is missing or the user wants to learn, create or review a concept (greedy, two pointers, BFS, hash map…) — "creemos el concepto", "enséñame greedy", "¿qué es divide y vencerás?", "revisa mi explicación", "¿ya domino X?". Creates concept notes with runnable exercises, teaches Socratically, and reviews mastery.
---

# concept — create, teach and review concept notes

The hard rules and the student profile in `CLAUDE.md` apply. Reply in Spanish; write files in English.

## Existing concept

If `concepts/<slug>/` already exists, do not recreate or rewrite any of it (it holds the user's "My explanation"). If its `status` is `new` and the user starts studying it, set `status: learning` and run `pnpm -s sync && pnpm -s check`. Then teach it Socratically, as in the last bullet of Create mode step 6.

## Create mode

1. **Slug and folder:** a kebab-case English slug (`two-pointers`) in `concepts/<slug>/`.
2. **Write `concepts/<slug>/README.md`** with exactly these headings (`pnpm check` relies on them):

```markdown
---
slug: two-pointers
title: Two pointers
status: learning
requires: []
related: []
---
# Two pointers

## Intuition
## Diagram
## Signals
## When it fails
## Typical complexity
## Template
## Exercises

<!-- auto:exercises -->
<!-- /auto -->

## Quick checks
## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
<!-- /auto -->
```

   What goes in each section:
   - **Intuition:** analogy first, taken from the profile domains (frontend, music, IoT dashboards). One or two short paragraphs, plus an emoji or two.
   - **Diagram:** ASCII art that shows the mechanism step by step on a tiny input.
   - **Signals:** a bullet list of statement phrases that suggest this concept.
   - **When it fails:** one classic counterexample and why it breaks.
   - **Typical complexity:** time and space of the canonical forms.
   - **Template:** a generic skeleton in Python **and** TypeScript. It must not be shaped after any problem that is not `solved` or `revealed` (check `INDEX.md`). If a template would give one away, keep it more abstract.
   - **Quick checks:** 2–4 questions the user answers in chat.
   - **My explanation:** empty, except for the comment.
3. **Frontmatter:**
   - `status: learning` if the user is studying the concept now; `new` if you are creating it ahead of time (for example as a prerequisite).
   - `requires`: prerequisite slugs.
   - `related`: neighbouring concepts.
4. **Exercises:** 2–4, in increasing difficulty. Each lives in `concepts/<slug>/exercises/<NN>-<slug>/` with:
   - `README.md`: frontmatter `id: <slug>/<NN>`, `title`, `concept: <slug>`, `status: todo`, `hints: 0`, `solution_revealed: false`, `solved_in: []`; then `# <title>`, `## Statement` (with examples and constraints), and `## Log`.
   - `cases.json`, following the same rules as step 3 of the `problem` skill, and `stress.ts` only if input size matters.
   - Hidden `expected` values filled with the reference procedure from step 5 of the `problem` skill. The reference lives outside the repo and is deleted afterwards.
   - Exercises practise the concept in isolation and must not be isomorphic to an unsolved problem.
5. **Sync:** `pnpm -s sync && pnpm -s check`.
6. **Reply (in Spanish):**
   - A short summary of the idea.
   - The exercise list, each with `pnpm watch <slug>/<NN> --open`.
   - An offer to walk through the Intuition together.
   - If they accept, teach Socratically: ask, wait, and build on their answer. Never lecture for more than a few lines at a time.

## Review mode ("revisa mi explicación", "¿ya domino X?")

1. Read "My explanation" and give feedback in Spanish. Say what is right, then ask questions about what is missing or wrong instead of correcting it directly.
2. Run `pnpm -s test <slug>/<NN> --lang all --json` for every exercise. An exercise counts as done when at least one language is `green`.
3. Set `status: mastered` only if "My explanation" has real content **and** every exercise counts as done. Otherwise keep `learning` and say exactly what is missing.
4. Run `pnpm -s sync && pnpm -s check`.
