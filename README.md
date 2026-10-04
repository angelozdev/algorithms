# Algorithms

Study algorithms (LeetCode and similar) with Claude Code as a study partner that **never hands you the solution**. It names the concepts a problem needs, helps you learn them, gives escalating hints only when you ask, and reviews your solution once it is green.

## Requirements

- Node.js 24+ and pnpm 11
- [uv](https://docs.astral.sh/uv/) (provides Python 3.13 for the runner)
- VS Code (optional, for `--open`)
- A desktop browser (Chrome, Firefox or Safari) for the web playground

## Setup

```bash
pnpm install
uv python install 3.13   # only if `uv python find` finds nothing
```

**Start Claude Code from this folder.** The anti-spoiler hooks in `.claude/settings.json` only load when Claude Code starts here.

## Daily flow

1. Paste a problem statement or a LeetCode link into Claude Code. You get back only the concepts you need.
2. A concept is missing? Say "creemos el concepto". Claude writes the note and the exercises; you write "My explanation".
3. `pnpm play <problem>` opens the web playground: statement and concept notes on the left, the editor on the right, ▶ Run (⌘↵) for the tests. Prefer the terminal? `pnpm watch <problem> --open` reruns the tests on every save in VS Code.
4. Stuck? Ask for a hint ("pista"). There are two levels, and neither includes code.
5. Green? Say "ya pasa" to get a complexity review. Giving up? Type `/give-up`.

## Commands

| Command | What it does |
|---|---|
| `pnpm play [query] [--no-open] [--port <n>]` | Opens the web playground (home page, or the problem you name) |
| `pnpm e2e` | Runs the playground's browser tests (first time: `pnpm exec playwright install chromium`) |
| `pnpm watch <query> [--lang py\|ts] [--open]` | Reruns the tests on every save |
| `pnpm test <query> [--lang py\|ts\|all] [--json]` | Runs once |
| `pnpm fill-expected <query> --ref <file>` | Fills hidden expected values from a reference solution outside the repo |
| `pnpm leetcode <slug\|url>` | Prints a LeetCode problem as a JSON draft |
| `pnpm leetcode --list <slug\|url>` | Prints a LeetCode problem list (for example Grind 75) as JSON |
| `pnpm leetcode --check-paraphrase <README>` | Flags runs of 10+ words a problem README copies from LeetCode's statement |
| `pnpm sync` | Regenerates the indexes and backlinks |
| `pnpm check` | Validates files and links |
| `pnpm verify` | Runs the tool tests, the type checks and `check` |

`<query>` is an id (`lc-0001`, `hash-map/01`), a LeetCode number (`1`), or part of a folder name (`two-sum`).

## Web playground

`pnpm play` starts a local server on `127.0.0.1` (port 4173, or the next free one) and opens the browser.

- **Home:** work in progress, problems by pattern, concepts with their exercises. Status badges update live when Claude edits a README.
- **Work view:** the statement with clickable concept links (a concept opens next to the editor), an editor with syntax colors, auto-indent and bracket matching, but no autocomplete, no suggestions and no AI. Your code is saved to `solution.py` / `solution.ts` 500 ms after you stop typing, so Claude always reads what you see.
- **Run (⌘↵):** the same examples, hidden and stress cases as `pnpm test`. Hidden answers never reach the browser.
- **Custom input (⇧⌘↵):** run your code on your own input and see what it returns and prints.
- **Concept page:** read the note and write "My explanation" (the only part of a README the playground edits).

When you are green, ask Claude for `/review` in the terminal: the playground never changes a problem's status.

Browser tests: `pnpm e2e` (first time, install its browser once with `pnpm exec playwright install chromium`).

## Map

- [Problems by pattern](INDEX.md)
- [Concepts and learning path](concepts/INDEX.md)
- [Rules for Claude](CLAUDE.md)
- [Design spec](docs/superpowers/specs/2026-09-27-algorithms-study-system-design.md)
- [Web playground spec](docs/superpowers/specs/2026-09-28-web-playground-design.md)
