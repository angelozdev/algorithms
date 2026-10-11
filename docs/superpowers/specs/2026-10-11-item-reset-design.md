# Item reset — design

Date: 2026-10-11. Status: approved in chat (brainstorming session, 2026-10-11).

## 1. Goal

Let the user put a problem or a concept exercise back to an earlier state, from the playground and from the terminal:

- clean the editor without losing the open attempt;
- undo an attempt that started by accident;
- wipe an item back to its factory state.

Success: each of these takes one action, never breaks the study coach (plan, phase, reviews, exams), and never touches another item.

Related fix shipped first, in the same session: the work page header read "In progress" for an item that was only opened (the stub that opening writes counted as work there, `WorkHeader.tsx`). It now reads `TargetData.inProgress`, the same value the home page uses. Opening an item never starts anything, as on every platform we looked at (LeetCode, Codewars, Exercism, AlgoExpert, Anki).

## 2. Decisions

| # | Decision |
|---|---|
| R1 | Three actions per item: **code** (clean the editor), **attempt** (discard the open attempt), **all** (erase everything). |
| R2 | They apply to problems and to concept exercises alike (same `Target` shape, same store). |
| R3 | Two surfaces: a "⋯" menu in the work page header, and `pnpm study reset <id> --code \| --attempt \| --all [--yes]`. Both are the user's only: the hook denies the CLI subcommand and the `/api/study/reset` routes to Claude, like `start`, `pause` and `resume`. |
| R4 | Escalating confirmation. code: none (the old code goes to `history/`). attempt: a dialog that says what is lost (hints, minutes). all: a dialog where the user types the item id. CLI: `--all` without `--yes` prints the summary and exits 1. |
| R5 | **all is a real erase**, not a soft reset: attempts, their events, complexity notes, the FSRS card, the solution files and the item's whole `history/` folder. It cannot be undone. |
| R6 | **Exams:** attempt and all are refused for an item that has any exam attempt (open or closed). Exam results are derived live from attempts (`study/exam.ts` `examResult`): deleting one would put the item back in the exam's `remaining`, reopen a finished exam, and let a failed first try be retaken. code is always allowed. |
| R7 | The phase never goes down (`syncPhase`, `phase.ts`: "It never moves back"). A reset can make a concept no longer `learned` or a problem no longer solved; the phase stays. |
| R8 | Reset works on `.study/` only and needs the study database: before `pnpm study migrate` it is refused. |

## 3. The three actions

All three run in `study/reset.ts`, called by the CLI and the playground route. File work happens before the database transaction for code and attempt (an archive is verified before anything is deleted), and after it for all (nothing is deleted if the transaction fails). Every action ends with `refreshState(study)`, so `state.json` changes and the playground receives a `progress` event.

### 3.1 code — clean the editor

1. For each language with a solution file: if it differs from the stub, archive it to `history/<timestamp>.<lang>` (copy, verify bytes, delete); if it equals the stub, delete it.
2. Write a fresh stub in each of those languages (none existed: the profile's language).
3. Attempts are untouched: an open attempt stays open, an untried item stays `todo` (a stub-equal file is not work, `record.ts`).

This is the archive-and-stub half of `startAttempt` (`study/start.ts`); it is extracted into a shared helper `freshStubs` that both use.

### 3.2 attempt — discard the open attempt

1. Refused when the item has no open attempt, or has any exam attempt (R6).
2. Archive and stub, as in 3.1 (the discarded attempt's code stays recoverable in `history/`).
3. In one transaction: delete the open attempt's `attempt_events`, its `complexity_notes` (none expected: notes only follow a green close) and the attempt row, children first (every FK is `ON DELETE NO ACTION`).
4. The item's status falls back to what its other attempts say: a first attempt → `todo`; a review → `solved`, with its card unchanged (open attempts are never rated, so the card does not move).

### 3.3 all — factory reset

1. Refused when the item has any exam attempt (R6).
2. In one transaction: delete the `attempt_events` and `complexity_notes` of every attempt of the item, then its attempts, then `rebuildCard(db, itemId)`, which deletes the card when no rated attempt remains (`fsrs.ts` `writeCard`).
3. After the commit: remove the item's solution folder (`studySolutionDir`), `history/` included.
4. Self-healing elsewhere, nothing to do: today's plan derives `done` from attempts (`plan-store.ts` `itemsDone`); `plan_items` and other item references are plain text, not FKs.

## 4. Preview

`resetPreview(study, root, id)` returns what each action would cost, for the dialogs and the CLI summary:

```ts
interface ResetPreview {
  /** The open attempt: its hints and active minutes (rounded), or null. */
  open: { hints: number; minutes: number } | null;
  /** Every attempt of the item, and their hints in total. */
  attempts: number;
  hints: number;
  /** Files in the item's history/ folder. */
  versions: number;
  /** R6: the item has an exam attempt, so attempt and all are refused. */
  examLocked: boolean;
}
```

## 5. Surfaces

### 5.1 CLI

`pnpm study reset <id> --code | --attempt | --all [--yes]`, exactly one action flag.

- code, attempt: run and print what was archived and which stubs were written.
- all: without `--yes`, print what would be erased (from the preview) and exit 1; with `--yes`, erase and print a summary.
- Refusals (no open attempt, exam-locked, no database) print a reason and exit 1.

### 5.2 Playground

- `GET /api/study/reset/:id` → `ResetPreview`; `POST /api/study/reset/:id` with `{ action: "code" | "attempt" | "all" }` → `{ action }`. Errors: 404 unknown id, 409 no database / no open attempt / exam-locked, 422 broken `cases.json`.
- The work page header gets a "⋯" button (right cluster, next to Run) that opens a menu with **Clean code**, **Discard attempt** and **Erase everything**. Discard is disabled without an open attempt; Discard and Erase are disabled when exam-locked. A disabled item shows its reason in small text under its label.
- Clean code runs at once. Discard opens a dialog ("You lose 2 hints and 14 min of this attempt."). Erase opens a dialog that lists what goes (attempts, hints, reviews, versions), says it cannot be undone, and enables its button only when the typed text equals the item id.
- After a reset the page invalidates the target, home, today and concept queries, and remounts the editor (a generation key in `WorkPage`) so it loads the fresh stub with an empty undo history. A pending autosave of the old text cannot overwrite the stub: saves carry a base version and the server refuses a stale one.
- New UI kit pieces: `dropdown-menu.tsx` and `alert-dialog.tsx` (shadcn, on the `radix-ui` package the project already uses).

### 5.3 Hook

`.claude/hooks/guard-solution.mjs`: add `reset` to `USER_ONLY_STUDY`, and `reset` to the `PLAYGROUND_FILES` and `PLAYGROUND_STUDY` route patterns; the reason string names it.

## 6. Docs

- `CLAUDE.md`: the user alone runs `pnpm study … reset`.
- `.claude/skills/coach/SKILL.md` §11: a row for resetting an item.

## 7. Testing

- `study/tests/reset.test.ts`: each action on a new, an in-progress, a solved-with-review and an exam item; history and stubs on disk; status, hints and card after; refusals.
- `study/tests/start.test.ts` stays green after the `freshStubs` extraction.
- CLI: `reset` flags, `--yes`, exit codes.
- `scripts/tests/hooks.test.ts`: the CLI subcommand and both routes are denied.
- `playground/tests/server/study.test.ts`: the routes, their errors.
- `playground/tests/web/`: the menu (disabled states), both dialogs (the typed-id gate), and the editor remount.
- `pnpm verify`, and the e2e suite's work spec.
