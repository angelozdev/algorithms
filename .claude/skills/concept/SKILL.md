---
name: concept
description: Use when a concept note is missing or the user wants to learn, create or review a concept (greedy, two pointers, BFS, hash map…) — "creemos el concepto", "enséñame greedy", "¿qué es divide y vencerás?", "revisa mi explicación", "¿ya domino X?". Creates concept notes with runnable exercises, teaches Socratically, and reviews mastery.
---

# concept — create, teach and review concept notes

The hard rules and the student profile in `CLAUDE.md` apply. Reply in Spanish; write files in English.

## Existing concept

If `concepts/<slug>/` already exists, do not recreate or rewrite any of it. Teach it Socratically, as in the last bullet of Create mode step 6.

## Create mode

1. **Slug and folder:** a kebab-case English slug (`two-pointers`) in `concepts/<slug>/`.
2. **Write `concepts/<slug>/README.md`** with exactly these headings (`pnpm check` relies on them):

```markdown
---
slug: two-pointers
title: Two pointers
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
   - **Template:** a generic skeleton in Python **and** TypeScript. It must not be shaped after any problem that is not `solved` or `revealed` (`pnpm -s study status --json` lists `solved` and `revealed`; with `initialized: false`, treat every problem as unsolved). If a template would give one away, keep it more abstract.
   - **Quick checks:** 2–4 questions the user answers in chat.
   - **My explanation:** the heading and the comment only. The user's text is saved in `.study/explanations/<slug>.md` (the playground writes it there).
3. **Frontmatter:**
   - `requires`: prerequisite slugs.
   - `related`: neighbouring concepts.

   Progress (whether the user is learning or has learned the concept) lives in `.study`, never in the README.
4. **Exercises:** 2–4, in increasing difficulty. Each lives in `concepts/<slug>/exercises/<NN>-<slug>/` with:
   - `README.md`: frontmatter `id: <slug>/<NN>`, `title`, `concept: <slug>`; then `# <title>` and `## Statement` (with examples and constraints).
   - `cases.json`, following the same rules as step 3 of the `problem` skill, and `stress.ts` only if input size matters.
   - Hidden `expected` values filled with the reference procedure from step 5 of the `problem` skill. The reference lives outside the repo and is deleted afterwards.
   - Exercises practise the concept in isolation and must not be isomorphic to an unsolved problem (the same check as the Template).
5. **Sync:** `pnpm -s sync && pnpm -s check`.
6. **Reply (in Spanish):**
   - A short summary of the idea.
   - The exercise list, each with `pnpm play <slug>/<NN>` (web) or `pnpm watch <slug>/<NN> --open` (terminal).
   - An offer to walk through the Intuition together.
   - If they accept, teach Socratically: ask, wait, and build on their answer. Never lecture for more than a few lines at a time.

## Review mode ("revisa mi explicación", "¿ya domino X?")

1. Read the user's explanation: `.study/explanations/<slug>.md` or, until `pnpm study migrate`, the README's "My explanation" section. Give feedback in Spanish. Say what is right, then ask questions about what is missing or wrong instead of correcting it directly.
2. Run `pnpm -s study status <slug> --json`. Each exercise's `done` says whether the user solved it alone in their latest attempt. Do not run the exercises yourself to judge them.
3. When the explanation has real content and you accept it, run `pnpm -s study record explanation <slug>`. `learned` turns true once the explanation is accepted and every exercise is done; otherwise say exactly what is missing. Never edit the concept's frontmatter.
