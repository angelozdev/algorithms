# Algorithms

Study algorithms (LeetCode and similar) with Claude Code as a study partner that **never hands you the solution**. It names the concepts a problem needs, helps you learn them, gives escalating hints only when you ask, and reviews your solution once it is green.

## Requirements

- Node.js 24+ and pnpm 11
- [uv](https://docs.astral.sh/uv/) (provides Python 3.13 for the runner)
- VS Code (optional, for `--open`)

## Setup

```bash
pnpm install
uv python install 3.13   # only if `uv python find` finds nothing
```

**Start Claude Code from this folder.** The anti-spoiler hooks in `.claude/settings.json` only load when Claude Code starts here.

## Daily flow

1. Paste a problem statement or a LeetCode link into Claude Code. You get back only the concepts you need.
2. A concept is missing? Say "creemos el concepto". Claude writes the note and the exercises; you write "My explanation".
3. `pnpm watch <problem> --open`: edit `solution.py` (or use `--lang ts`) and watch the tests rerun on every save.
4. Stuck? Ask for a hint ("pista"). There are two levels, and neither includes code.
5. Green? Say "ya pasa" to get a complexity review. Giving up? Type `/give-up`.

## Commands

| Command | What it does |
|---|---|
| `pnpm watch <query> [--lang py\|ts] [--open]` | Reruns the tests on every save |
| `pnpm test <query> [--lang py\|ts\|all] [--json]` | Runs once |
| `pnpm fill-expected <query> --ref <file>` | Fills hidden expected values from a reference solution outside the repo |
| `pnpm leetcode <slug\|url>` | Prints a LeetCode problem as a JSON draft |
| `pnpm sync` | Regenerates the indexes and backlinks |
| `pnpm check` | Validates files and links |
| `pnpm verify` | Runs the tool tests and `check` |

`<query>` is an id (`lc-0001`, `hash-map/01`), a LeetCode number (`1`), or part of a folder name (`two-sum`).

## Map

- [Problems by pattern](INDEX.md)
- [Concepts and learning path](concepts/INDEX.md)
- [Rules for Claude](CLAUDE.md)
- [Design spec](docs/superpowers/specs/2026-09-27-algorithms-study-system-design.md)
