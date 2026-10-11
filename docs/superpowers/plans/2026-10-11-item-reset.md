# Item Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three per-item resets (clean code, discard the open attempt, erase everything) for problems and concept exercises, from the playground's work page and from `pnpm study reset`.

**Architecture:** One domain module, `study/reset.ts`, holds the preview and the three actions; it reuses the archive-and-stub half of `startAttempt`, extracted as `freshStubs`. The CLI and a Hono route call it; the web adds a "⋯" menu (`ResetMenu`) to the work page header and remounts the editor after a reset. The hook keeps both surfaces user-only.

**Tech Stack:** TypeScript, Drizzle on SQLite (`study/`), Hono + zod (`playground/server/`), React 19 + TanStack Query + Radix (`radix-ui` umbrella package) + sonner (`playground/web/`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-item-reset-design.md`

## Global Constraints

- Every file, comment, UI string and commit message in English.
- TDD: each test is written and seen failing before the code that makes it pass.
- Tests only touch temp repos (`makeCoachRepo`, `makeRepo`); never the real `.study/`.
- Domain errors are results, not throws: `{ reset: false, reason: "exam" | "no-open-attempt" }`. Only file-system failures throw (as `startAttempt` does).
- R6 exam lock: `attempt` and `all` are refused for any item with an attempt whose `exam_id` is not null; `code` is always allowed.
- Every reset ends with `refreshState(study)`.
- After the last task: `pnpm verify` exits 0, and `pnpm -s e2e -g "opening a problem"` passes.

## Review Focus

- Clean code on a file that equals the stub: no history entry, no `EEXIST`, still a fresh stub (Task 1, test "just replaces a stub").
- Reset while the editor holds unsaved text: the text is saved first, so Clean code archives what the user sees (Task 4, test "cleans the code at once, after saving").
- Exercise ids with a slash (`hash-map/01`) through the route (Task 3, test "takes exercise ids").
- Erase on an item that was never touched (no attempts, no folder): succeeds, nothing throws (Task 1, test "erases an item that was never touched").
- Exam-locked items at every surface: domain (Task 1), CLI (Task 2), route 409 (Task 3), disabled menu items with the reason (Task 4).

---

### Task 1: `study/reset.ts` — preview and the three actions

**Files:**
- Modify: `study/start.ts` (extract `freshStubs` from `startAttempt`)
- Create: `study/reset.ts`
- Test: `study/tests/reset.test.ts`; `study/tests/start.test.ts` must stay green

**Interfaces:**
- Produces:
  - `freshStubs(study: Study, target: Target, now: Date, options?: { lang?: Lang }): { archived: string[]; solutions: string[] }` in `study/start.ts`
  - `RESET_ACTIONS = ["code", "attempt", "all"] as const`, `type ResetAction`
  - `interface ResetPreview { open: { hints: number; minutes: number } | null; attempts: number; hints: number; versions: number; examLocked: boolean }`
  - `type ResetResult = { reset: true; action: ResetAction; archived: string[]; solutions: string[]; before: ResetPreview } | { reset: false; reason: "exam" | "no-open-attempt" }`
  - `resetPreview(study: Study, target: Target): ResetPreview`
  - `resetItem(study: Study, target: Target, action: ResetAction, now: Date): ResetResult`

- [ ] **Step 1: Extract `freshStubs` (refactor, no behavior change)**

In `study/start.ts`, replace the body of `startAttempt` between `const caseFile = …` and `try {` with a call to a new exported function, and move that code into it:

```ts
/**
 * Archives each current solution to history/<timestamp>.<lang> (a solution equal to the stub is just removed), then
 * writes a fresh stub in every language that had a solution (or `lang`, or the profile's language). Never overwrites
 * history: a clash throws EEXIST before anything is deleted. Start review and the item reset share it.
 */
export function freshStubs(study: Study, target: Target, now: Date, options: { lang?: Lang } = {}): { archived: string[]; solutions: string[] } {
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
  return { archived, solutions };
}
```

and in `startAttempt`:

```ts
  if (!gate && progress.status === "todo") return { started: false, reason: "new" };
  const { archived, solutions } = freshStubs(study, target, now, options);
  try {
```

Update `startAttempt`'s doc comment steps 1–2 to say "1–2. `freshStubs`".

- [ ] **Step 2: Run the start tests: they stay green**

Run: `pnpm -s vitest run study/tests/start.test.ts`
Expected: PASS (all tests).

- [ ] **Step 3: Write the failing tests**

Create `study/tests/reset.test.ts`:

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
import { storedCards } from "../fsrs.ts";
import { initStudy } from "../init.ts";
import { ensurePlan } from "../plan.ts";
import { recordHint, recordWork } from "../record.ts";
import { resetItem, resetPreview } from "../reset.ts";
import { attemptEvents, attempts } from "../schema.ts";
import { startAttempt } from "../start.ts";
import { itemProgress } from "../status.ts";
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

/** A repo on disk (resets move files): .study initialized in TZ, the coach started on demo-list. */
function repo(): Repo {
  const root = makeCoachRepo();
  const clock = fixedClock(MONDAY);
  initStudy(root, { clock, timezone: TZ });
  const study = openStudy(root, { clock });
  setCurriculum(study, root, "demo-list", clock.now());
  return { root, study, clock, target: (id) => listTargets(root).find((t) => t.id === id)! };
}

const OLD_WORK = "# my earlier work\n";
const STAMP = "2026-10-05T14-00-00-000Z"; // MONDAY, as a history file name
const edit = (r: Repo, id: string) => recordWork(r.study, id, { type: "save", lang: "py", differsFromStub: true }, "playground");
const solve = (r: Repo, id: string) => recordWork(r.study, id, { type: "run", lang: "py", green: true }, "cli");
const stubOf = (r: Repo, id: string) => renderStub(loadCaseFile(r.target(id).dir), "py");
const writeSolution = (r: Repo, id: string, code: string) => put(r.root, path.relative(r.root, studySolutionPath(r.target(id), "py")), code);
const historyOf = (r: Repo, id: string) => {
  const dir = path.join(studySolutionDir(r.target(id)), "history");
  return existsSync(dir) ? readdirSync(dir) : [];
};

describe("resetPreview (item reset spec §4)", () => {
  it("counts the open attempt's hints and active minutes, every attempt's hints, and the saved versions", () => {
    const r = repo();
    expect(resetPreview(r.study, r.target("lc-9101"))).toEqual({ open: null, attempts: 0, hints: 0, versions: 0, examLocked: false });
    edit(r, "lc-9101");
    r.clock.advance(4 * 60_000);
    edit(r, "lc-9101");
    recordHint(r.study, "lc-9101");
    put(r.root, path.relative(r.root, path.join(studySolutionDir(r.target("lc-9101")), "history", "old.py")), OLD_WORK);
    expect(resetPreview(r.study, r.target("lc-9101"))).toEqual({ open: { hints: 1, minutes: 4 }, attempts: 1, hints: 1, versions: 1, examLocked: false });
    r.study.close();
  });
});

describe("code: clean the editor (spec §3.1)", () => {
  it("archives the code, writes a fresh stub and leaves the open attempt open", () => {
    const r = repo();
    const target = r.target("lc-9101");
    writeSolution(r, "lc-9101", OLD_WORK);
    edit(r, "lc-9101");
    const result = resetItem(r.study, target, "code", r.clock.now());
    expect(result).toMatchObject({
      reset: true,
      action: "code",
      archived: [path.join(studySolutionDir(target), "history", `${STAMP}.py`)],
      solutions: [studySolutionPath(target, "py")],
    });
    expect(readFileSync(studySolutionPath(target, "py"), "utf8")).toBe(stubOf(r, "lc-9101"));
    expect(itemProgress(r.study, "lc-9101").status).toBe("in_progress");
    r.study.close();
  });

  it("just replaces a stub, and keeps an untried item to do", () => {
    const r = repo();
    writeSolution(r, "lc-9102", stubOf(r, "lc-9102"));
    expect(resetItem(r.study, r.target("lc-9102"), "code", r.clock.now())).toMatchObject({ reset: true, archived: [] });
    expect(historyOf(r, "lc-9102")).toEqual([]);
    expect(readFileSync(studySolutionPath(r.target("lc-9102"), "py"), "utf8")).toBe(stubOf(r, "lc-9102"));
    expect(itemProgress(r.study, "lc-9102").status).toBe("todo");
    r.study.close();
  });
});

describe("attempt: discard the open attempt (spec §3.2)", () => {
  it("discards a first attempt: the item is to do again, its code in the history", () => {
    const r = repo();
    writeSolution(r, "lc-9101", OLD_WORK);
    edit(r, "lc-9101");
    recordHint(r.study, "lc-9101");
    expect(resetItem(r.study, r.target("lc-9101"), "attempt", r.clock.now())).toMatchObject({ reset: true, action: "attempt", before: { open: { hints: 1, minutes: 0 } } });
    expect(itemProgress(r.study, "lc-9101")).toMatchObject({ status: "todo", open: null, hints: 0 });
    expect(r.study.db.select().from(attempts).all()).toEqual([]);
    expect(r.study.db.select().from(attemptEvents).all()).toEqual([]);
    expect(historyOf(r, "lc-9101")).toEqual([`${STAMP}.py`]);
    r.study.close();
  });

  it("discards a review: the item is solved again and its card does not move", () => {
    const r = repo();
    solve(r, "lc-9101");
    const due = storedCards(r.study.db).get("lc-9101")!.due;
    r.clock.advance(30 * DAY);
    edit(r, "lc-9101"); // opens a review attempt
    expect(itemProgress(r.study, "lc-9101").status).toBe("in_progress");
    expect(resetItem(r.study, r.target("lc-9101"), "attempt", r.clock.now())).toMatchObject({ reset: true });
    expect(itemProgress(r.study, "lc-9101")).toMatchObject({ status: "solved", open: null });
    expect(storedCards(r.study.db).get("lc-9101")!.due).toEqual(due);
    r.study.close();
  });

  it("refuses when no attempt is open", () => {
    const r = repo();
    expect(resetItem(r.study, r.target("lc-9101"), "attempt", r.clock.now())).toEqual({ reset: false, reason: "no-open-attempt" });
    r.study.close();
  });
});

describe("all: factory reset (spec §3.3)", () => {
  it("erases attempts, events, the card and the whole solution folder, and nothing of other items", () => {
    const r = repo();
    const target = r.target("lc-9101");
    writeSolution(r, "lc-9101", OLD_WORK);
    solve(r, "lc-9101");
    r.clock.advance(30 * DAY);
    edit(r, "lc-9101");
    recordHint(r.study, "lc-9101");
    put(r.root, path.relative(r.root, path.join(studySolutionDir(target), "history", "old.py")), OLD_WORK);
    edit(r, "lc-9102");
    expect(resetItem(r.study, target, "all", r.clock.now())).toMatchObject({ reset: true, action: "all", before: { attempts: 2, hints: 1, versions: 1 } });
    expect(itemProgress(r.study, "lc-9101")).toMatchObject({ status: "todo", everGreen: false, open: null, nextDue: null });
    expect(storedCards(r.study.db).has("lc-9101")).toBe(false);
    expect(existsSync(studySolutionDir(target))).toBe(false);
    expect(r.study.db.select({ itemId: attempts.itemId }).from(attempts).all()).toEqual([{ itemId: "lc-9102" }]);
    expect(r.study.db.select().from(attemptEvents).all()).toHaveLength(1);
    r.study.close();
  });

  it("erases an item that was never touched without complaint", () => {
    const r = repo();
    expect(resetItem(r.study, r.target("lc-9103"), "all", r.clock.now())).toMatchObject({ reset: true, before: { attempts: 0, versions: 0 } });
    r.study.close();
  });
});

describe("exam lock (spec R6)", () => {
  it("refuses to discard or erase an item with an exam attempt, and still cleans its code", () => {
    const r = repo();
    forcePhase(r.study, "master", r.clock.now());
    const first = ensurePlan(r.study, r.root, r.clock.now())!.items[0].itemId;
    expect(startAttempt(r.study, r.root, r.target(first), r.clock.now())).toMatchObject({ started: true, kind: "exam" });
    expect(resetPreview(r.study, r.target(first)).examLocked).toBe(true);
    expect(resetItem(r.study, r.target(first), "attempt", r.clock.now())).toEqual({ reset: false, reason: "exam" });
    expect(resetItem(r.study, r.target(first), "all", r.clock.now())).toEqual({ reset: false, reason: "exam" });
    expect(resetItem(r.study, r.target(first), "code", r.clock.now())).toMatchObject({ reset: true, action: "code" });
    expect(itemProgress(r.study, first).status).toBe("in_progress");
    r.study.close();
  });
});
```

- [ ] **Step 4: Run them to see them fail**

Run: `pnpm -s vitest run study/tests/reset.test.ts`
Expected: FAIL — `Failed to resolve import "../reset.ts"`.

- [ ] **Step 5: Write `study/reset.ts`**

```ts
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { studySolutionDir } from "../runner/src/paths.ts";
import type { Target } from "../runner/src/types.ts";
import { rebuildCard } from "./fsrs.ts";
import { attemptEvents, attempts, attemptStats, complexityNotes } from "./schema.ts";
import { freshStubs } from "./start.ts";
import { refreshState } from "./state.ts";
import { itemProgress } from "./status.ts";
import { inTransaction, type Study, type StudyTx } from "./store.ts";

/** The three resets of an item (item reset spec §3): clean the code, discard the open attempt, erase everything. */
export const RESET_ACTIONS = ["code", "attempt", "all"] as const;
export type ResetAction = (typeof RESET_ACTIONS)[number];

/** What each reset would cost (spec §4), for the playground's dialogs and the CLI's summary. */
export interface ResetPreview {
  /** The open attempt: its hints and active minutes (rounded), or null. */
  open: { hints: number; minutes: number } | null;
  /** Every attempt of the item, and their hints in total. */
  attempts: number;
  hints: number;
  /** Files in the item's history/ folder. */
  versions: number;
  /** Spec R6: the item has an exam attempt, so attempt and all are refused. */
  examLocked: boolean;
}

export type ResetResult =
  | { reset: true; action: ResetAction; archived: string[]; solutions: string[]; before: ResetPreview }
  /** exam: the item has an exam attempt (spec R6); no-open-attempt: there is nothing to discard. */
  | { reset: false; reason: "exam" | "no-open-attempt" };

export function resetPreview(study: Study, target: Target): ResetPreview {
  const rows = study.db
    .select({ attemptId: attemptStats.attemptId, hints: attemptStats.hints, activeMs: attemptStats.activeMs })
    .from(attemptStats)
    .where(eq(attemptStats.itemId, target.id))
    .all();
  const open = itemProgress(study, target.id).open;
  const openRow = open ? rows.find((row) => row.attemptId === open.attemptId) : undefined;
  const history = path.join(studySolutionDir(target), "history");
  const examAttempt = study.db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.itemId, target.id), isNotNull(attempts.examId)))
    .limit(1)
    .get();
  return {
    open: open ? { hints: open.hints, minutes: Math.round((openRow?.activeMs ?? 0) / 60_000) } : null,
    attempts: rows.length,
    hints: rows.reduce((sum, row) => sum + row.hints, 0),
    versions: existsSync(history) ? readdirSync(history).length : 0,
    examLocked: examAttempt !== undefined,
  };
}

/** Deletes attempts and what hangs off them, children first: every foreign key is ON DELETE NO ACTION. */
function deleteAttempts(tx: StudyTx, ids: number[]): void {
  if (ids.length === 0) return;
  tx.delete(attemptEvents).where(inArray(attemptEvents.attemptId, ids)).run();
  tx.delete(complexityNotes).where(inArray(complexityNotes.attemptId, ids)).run();
  tx.delete(attempts).where(inArray(attempts.id, ids)).run();
}

/**
 * `pnpm study reset` and `POST /api/study/reset/<id>` (item reset spec §3). The user's only: the hook denies both
 * to Claude.
 * - code: archive and stub (`freshStubs`); attempts untouched.
 * - attempt: archive and stub, then delete the open attempt; the item falls back to what its other attempts say.
 * - all: delete every attempt, rebuild (drop) the card, then remove the item's solution folder, history included.
 */
export function resetItem(study: Study, target: Target, action: ResetAction, now: Date): ResetResult {
  const before = resetPreview(study, target);
  if (action !== "code" && before.examLocked) return { reset: false, reason: "exam" };
  if (action === "attempt" && !before.open) return { reset: false, reason: "no-open-attempt" };
  if (action === "all") {
    inTransaction(study, (tx) => {
      const ids = tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.itemId, target.id)).all();
      deleteAttempts(tx, ids.map((row) => row.id));
      rebuildCard(tx, target.id);
    });
    rmSync(studySolutionDir(target), { recursive: true, force: true });
    refreshState(study);
    return { reset: true, action, archived: [], solutions: [], before };
  }
  const { archived, solutions } = freshStubs(study, target, now);
  if (action === "attempt") {
    const open = itemProgress(study, target.id).open!;
    inTransaction(study, (tx) => deleteAttempts(tx, [open.attemptId]));
  }
  refreshState(study);
  return { reset: true, action, archived, solutions, before };
}
```

If `rebuildCard(tx, …)` does not type-check (its parameter is `StudyQueries`), check how `close-hook.ts` passes its `tx` to it and do the same.

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm -s vitest run study/tests/reset.test.ts study/tests/start.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add study/start.ts study/reset.ts study/tests/reset.test.ts
git commit -m "feat(study): add item reset (clean code, discard attempt, erase)"
```

---

### Task 2: `pnpm study reset`, the hook, and the docs

**Files:**
- Modify: `study/commands.ts` (USAGE, dispatch, `resetCommand`)
- Modify: `.claude/hooks/guard-solution.mjs:62-73`
- Modify: `CLAUDE.md` (Commands section), `.claude/skills/coach/SKILL.md` (§11 table)
- Test: `study/tests/coach-cli.test.ts`, `scripts/tests/hooks.test.ts`

**Interfaces:**
- Consumes: `RESET_ACTIONS`, `ResetPreview`, `resetPreview`, `resetItem` from Task 1.

- [ ] **Step 1: Write the failing CLI tests**

Add to `study/tests/coach-cli.test.ts` (it already imports `put`, `recordWork`, `DAY`; add any missing import):

```ts
describe("pnpm study reset (item reset spec §5.1)", () => {
  it("needs exactly one action", async () => {
    const r = repo();
    expect(await r.cli("reset", "lc-9101")).toMatchObject({ code: 1, err: expect.stringContaining("Pass exactly one of --code, --attempt or --all") });
    expect(await r.cli("reset", "lc-9101", "--code", "--all")).toMatchObject({ code: 1 });
  });

  it("cleans the code: the old solution goes to history/", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    put(r.root, ".study/solutions/problems/lc-9101/solution.py", "# my earlier work\n");
    expect(await r.cli("reset", "lc-9101", "--code")).toMatchObject({
      code: 0,
      out: "Cleaned the code of lc-9101.\nArchived: .study/solutions/problems/lc-9101/history/2026-10-05T14-00-00-000Z.py.\nFresh stub: .study/solutions/problems/lc-9101/solution.py.\n",
    });
  });

  it("discards the open attempt, and says so when there is none", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    expect(await r.cli("reset", "lc-9101", "--attempt")).toMatchObject({ code: 1, err: "lc-9101 has no open attempt to discard.\n" });
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "save", lang: "py", differsFromStub: true }, "playground"));
    expect(await r.cli("reset", "lc-9101", "--attempt")).toMatchObject({
      code: 0,
      out: "Discarded the open attempt of lc-9101 (0 hints, 0 min).\nFresh stub: .study/solutions/problems/lc-9101/solution.py.\n",
    });
  });

  it("erases only with --yes, after saying what goes", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "run", lang: "py", green: true }, "cli"));
    expect(await r.cli("reset", "lc-9101", "--all")).toMatchObject({
      code: 1,
      err: "This erases lc-9101 for good: 1 attempt, 0 hints, its review schedule and 0 saved versions.\nRun it again with --yes to erase it.\n",
    });
    expect((await r.cli("status", "lc-9101", "--json")).json()).toMatchObject({ status: "solved" });
    expect(await r.cli("reset", "lc-9101", "--all", "--yes")).toMatchObject({
      code: 0,
      out: "Erased lc-9101: 1 attempt, 0 hints, its review schedule and 0 saved versions.\n",
    });
    expect((await r.cli("status", "lc-9101", "--json")).json()).toMatchObject({ status: "todo" });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm -s vitest run study/tests/coach-cli.test.ts -t "pnpm study reset"`
Expected: FAIL — the usage error for an unknown command instead of the expected output.

- [ ] **Step 3: Implement `resetCommand`**

In `study/commands.ts`:

1. Import: `import { RESET_ACTIONS, type ResetPreview, resetItem, resetPreview } from "./reset.ts";`
2. USAGE, after the `start` line:

```
  pnpm study reset <id> (--code | --attempt | --all [--yes])    (the user's: cleans the code, discards the open attempt, or erases the item)
```

3. Dispatch, after `case "start":`:

```ts
      case "reset":
        return resetCommand(rest, io);
```

4. The command, after `startCommand`:

```ts
const count = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;
const describeErase = (p: ResetPreview): string =>
  `${count(p.attempts, "attempt")}, ${count(p.hints, "hint")}, its review schedule and ${count(p.versions, "saved version")}`;

/** `pnpm study reset <id> --code | --attempt | --all [--yes]` (the user's only, item reset spec §5.1). */
function resetCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({
      args,
      strict: true,
      allowPositionals: true,
      options: {
        code: { type: "boolean", default: false },
        attempt: { type: "boolean", default: false },
        all: { type: "boolean", default: false },
        yes: { type: "boolean", default: false },
      },
    }),
  );
  const actions = RESET_ACTIONS.filter((action) => values[action]);
  if (actions.length !== 1) throw new UsageError(`Pass exactly one of --code, --attempt or --all.\n\n${USAGE}`);
  const action = actions[0];
  const target = exactTarget(io.root, positionals[0]);
  return withStudy(io, (study) => {
    const preview = resetPreview(study, target);
    if (action !== "code" && preview.examLocked) {
      io.err(`${target.id} has an exam attempt: only --code is allowed (exam results come from its attempts).\n`);
      return 1;
    }
    if (action === "all" && !values.yes) {
      io.err(`This erases ${target.id} for good: ${describeErase(preview)}.\nRun it again with --yes to erase it.\n`);
      return 1;
    }
    const result = resetItem(study, target, action, io.clock.now());
    if (!result.reset) {
      io.err(`${target.id} has no open attempt to discard.\n`);
      return 1;
    }
    if (action === "all") {
      io.out(`Erased ${target.id}: ${describeErase(result.before)}.\n`);
      return 0;
    }
    const archived = result.archived.map((file) => displayPath(io.root, file));
    const open = result.before.open;
    io.out(
      (action === "code" ? `Cleaned the code of ${target.id}.\n` : `Discarded the open attempt of ${target.id} (${count(open!.hints, "hint")}, ${open!.minutes} min).\n`) +
        (archived.length ? `Archived: ${archived.join(", ")}.\n` : "") +
        `Fresh stub: ${result.solutions.map((file) => displayPath(io.root, file)).join(", ")}.\n`,
    );
    return 0;
  });
}
```

- [ ] **Step 4: Run the CLI tests to see them pass**

Run: `pnpm -s vitest run study/tests/coach-cli.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing hook tests**

In `scripts/tests/hooks.test.ts`, add to the list in "denies the study commands that belong to the user, in every launcher form":

```ts
        "pnpm study reset lc-0001 --code",
        "pnpm -s study reset lc-0001 --all --yes",
        "npx tsx study/cli.ts reset hash-map/01 --attempt",
```

and to the list in "denies the playground routes that start or pause study time":

```ts
        "curl -X POST http://127.0.0.1:4173/api/study/reset/lc-0001",
        "curl http://127.0.0.1:4173/api/study/reset/lc-0001",
```

- [ ] **Step 6: Run them to see them fail**

Run: `pnpm -s vitest run scripts/tests/hooks.test.ts`
Expected: FAIL — the reset commands are allowed.

- [ ] **Step 7: Update the hook**

In `.claude/hooks/guard-solution.mjs`:

```js
const STUDY_COMMAND_REASON =
  "Blocked by the study rules: this study command is for the user only (migrate, start, pause, resume, reset, phase set), " +
  "whether run through the CLI or the playground's /api/study/start|pause|resume|reset routes. Ask the user to run it.";
```

```js
/** Playground routes that touch the user's files or study time (reading a solution creates its stub). */
const PLAYGROUND_FILES = /\/api\/(?:solution|concept\/explanation|study\/(?:start|pause|resume|reset))\b/;
/** The playground routes that start, pause, resume or reset: same user-only rule as the CLI verbs. */
const PLAYGROUND_STUDY = /\/api\/study\/(?:start|pause|resume|reset)\b/;
/** Study subcommands only the user runs; phase only with `set`. `curriculum set` stays allowed (spec §6.5). */
const USER_ONLY_STUDY = new Set(["migrate", "start", "pause", "resume", "reset"]);
```

- [ ] **Step 8: Run the hook tests to see them pass**

Run: `pnpm -s vitest run scripts/tests/hooks.test.ts`
Expected: PASS.

- [ ] **Step 9: Update the docs**

`CLAUDE.md`, Commands, the `pnpm -s study record …` bullet: replace "The user alone runs `pnpm study migrate|start|pause|resume` and `pnpm study phase set`" with "The user alone runs `pnpm study migrate|start|pause|resume|reset` and `pnpm study phase set`".

`.claude/skills/coach/SKILL.md` §11, add a row after "start a review or an exam from a terminal":

```
| reset an item: clean its code, discard its open attempt, or erase it | `pnpm study reset <id> --code`, `--attempt` or `--all --yes`, or the "⋯" menu on the item's page. Erasing cannot be undone, and items with an exam attempt only allow `--code` |
```

- [ ] **Step 10: Commit**

```bash
git add study/commands.ts study/tests/coach-cli.test.ts .claude/hooks/guard-solution.mjs scripts/tests/hooks.test.ts CLAUDE.md .claude/skills/coach/SKILL.md
git commit -m "feat(study): add pnpm study reset, user-only"
```

---

### Task 3: the playground routes

**Files:**
- Modify: `playground/server/study.ts`, `playground/server/types.ts`
- Test: `playground/tests/server/study.test.ts`

**Interfaces:**
- Consumes: `RESET_ACTIONS`, `resetItem`, `resetPreview` from Task 1.
- Produces: `GET /api/study/reset/:id{.+}` → `ResetPreview`; `POST /api/study/reset/:id{.+}` with `{ action: ResetAction }` → `{ action: ResetAction }`. `server/types.ts` re-exports `ResetAction` and `ResetPreview` for the web.

- [ ] **Step 1: Write the failing tests**

Add to `playground/tests/server/study.test.ts`:

```ts
describe("/api/study/reset/:id (item reset spec §5.2)", () => {
  it("previews and runs the three resets", async () => {
    const root = coachRepo(); // lc-0020 solved, its solution PY_SUM on disk
    const app = createApp({ root });
    const folder = path.join(root, ".study/solutions/problems/lc-0020");
    expect((await json(await call(app, "/api/study/reset/lc-0020"))).body).toEqual({ open: null, attempts: 1, hints: 0, versions: 0, examLocked: false });
    expect(await json(await call(app, "/api/study/reset/lc-0020", { method: "POST", json: { action: "attempt" } }))).toEqual({
      status: 409,
      body: { error: "lc-0020 has no open attempt to discard." },
    });
    expect(await json(await call(app, "/api/study/reset/lc-0020", { method: "POST", json: { action: "code" } }))).toEqual({ status: 200, body: { action: "code" } });
    expect(readFileSync(path.join(folder, "solution.py"), "utf8")).not.toBe(PY_SUM);
    expect(readdirSync(path.join(folder, "history"))).toHaveLength(1);
    expect(await json(await call(app, "/api/study/reset/lc-0020", { method: "POST", json: { action: "all" } }))).toEqual({ status: 200, body: { action: "all" } });
    expect(existsSync(folder)).toBe(false);
    expect((await json(await call(app, "/api/target?id=lc-0020"))).body).toMatchObject({ status: "todo", inProgress: false });
  });

  it("takes exercise ids, and answers 404, 400 and 409 for an unknown id, a bad action and no database", async () => {
    const app = createApp({ root: coachRepo() });
    expect((await call(app, "/api/study/reset/hash-map/01", { method: "POST", json: { action: "all" } })).status).toBe(200);
    expect((await call(app, "/api/study/reset/lc-9999")).status).toBe(404);
    expect((await call(app, "/api/study/reset/lc-0020", { method: "POST", json: { action: "nuke" } })).status).toBe(400);
    expect((await call(createApp({ root: makeRepo({ study: false }) }), "/api/study/reset/lc-0001")).status).toBe(409);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm -s vitest run playground/tests/server/study.test.ts -t "api/study/reset"`
Expected: FAIL — 404 for the unknown routes.

- [ ] **Step 3: Add the routes**

In `playground/server/study.ts`, import `import { RESET_ACTIONS, resetItem, resetPreview } from "../../study/reset.ts";`, extend the doc comment's last line to "Claude never calls start, pause, resume or reset: the hook denies these routes", and add after the `/study/start/:id{.+}` route:

```ts
    .get("/study/reset/:id{.+}", (c) => {
      const id = c.req.param("id");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      return c.json(resetPreview(study, target), 200);
    })
    .post("/study/reset/:id{.+}", valid("json", z.object({ action: z.enum(RESET_ACTIONS) })), (c) => {
      const id = c.req.param("id");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      try {
        const result = resetItem(study, target, c.req.valid("json").action, envClock().now());
        if (result.reset) return c.json({ action: result.action }, 200);
        const reason = result.reason === "exam" ? `${id} has an exam attempt: only its code can be cleaned.` : `${id} has no open attempt to discard.`;
        return c.json({ error: reason }, 409);
      } catch (error) {
        if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
        throw error;
      }
    })
```

In `playground/server/types.ts`, next to the `TodayJson` re-export:

```ts
export type { ResetAction, ResetPreview } from "../../study/reset.ts";
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm -s vitest run playground/tests/server/study.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add playground/server/study.ts playground/server/types.ts playground/tests/server/study.test.ts
git commit -m "feat(playground): add the item reset routes"
```

---

### Task 4: the "⋯" menu and its dialogs

**Files:**
- Create: `playground/web/components/ui/dropdown-menu.tsx`, `playground/web/components/ui/alert-dialog.tsx`
- Modify: `playground/web/api.ts` (client functions, query key)
- Create: `playground/web/work/ResetMenu.tsx`
- Test: `playground/tests/web/reset-menu.test.tsx`

**Interfaces:**
- Consumes: the Task 3 routes; `ResetAction`, `ResetPreview` from `playground/server/types.ts`.
- Produces: `getResetPreview(id: string): Promise<ResetPreview>`, `postReset(id: string, action: ResetAction): Promise<{ action: ResetAction }>`, `keys.reset(id)`; `ResetMenu({ target, prepare, onReset }: { target: TargetData; prepare(): Promise<unknown>; onReset(): void })`.

- [ ] **Step 1: Add the UI kit pieces (shadcn, on `radix-ui`)**

`playground/web/components/ui/dropdown-menu.tsx`:

```tsx
import * as React from "react"
import { cn } from "cn"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger }
```

`playground/web/components/ui/alert-dialog.tsx`:

```tsx
import * as React from "react"
import { cn } from "cn"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { buttonVariants } from "@/components/ui/button"

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 isolate z-50 bg-black/80 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-1", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title data-slot="alert-dialog-title" className={cn("text-sm font-medium", className)} {...props} />
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description data-slot="alert-dialog-description" className={cn("text-xs/relaxed text-muted-foreground", className)} {...props} />
}

function AlertDialogAction({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & { variant?: "default" | "destructive" }) {
  return <AlertDialogPrimitive.Action className={cn(buttonVariants({ variant }), className)} {...props} />
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
}
```

- [ ] **Step 2: Add the client functions and the query key**

In `playground/web/api.ts`: import `ResetAction`, `ResetPreview` in the existing `../server/types.ts` type import; add after `startReview`:

```ts
/** What each reset of an item would cost (item reset spec §4). */
export async function getResetPreview(id: string): Promise<ResetPreview> {
  const res = await client.api.study.reset[":id{.+}"].$get({ param: { id } });
  if (!res.ok) return fail(res);
  return res.json();
}

/** Item reset (spec §3): clean the code, discard the open attempt, or erase everything. */
export async function postReset(id: string, action: ResetAction): Promise<{ action: ResetAction }> {
  const res = await client.api.study.reset[":id{.+}"].$post({ param: { id }, json: { action } });
  if (!res.ok) return fail(res);
  return res.json();
}
```

and in `keys`: `reset: (id: string) => ["reset", id] as const,`

- [ ] **Step 3: Write the failing tests**

Create `playground/tests/web/reset-menu.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResetPreview, TargetData } from "../../server/types.ts";
import { ResetMenu } from "../../web/work/ResetMenu.tsx";

const TARGET = { id: "lc-0020" } as TargetData;
let preview: ResetPreview;
let order: string[];
let posts: unknown[];
const prepare = vi.fn(async () => {
  order.push("prepare");
  return true;
});

beforeEach(() => {
  preview = { open: null, attempts: 1, hints: 0, versions: 0, examLocked: false };
  order = [];
  posts = [];
  prepare.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.pathname !== "/api/study/reset/lc-0020") return Response.json({ error: "unexpected request" }, { status: 500 });
      if (method === "GET") return Response.json(preview);
      const body = JSON.parse(String(init?.body)) as { action: string };
      order.push("post");
      posts.push(body);
      return Response.json({ action: body.action });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onReset = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ResetMenu target={TARGET} prepare={prepare} onReset={onReset} />
    </QueryClientProvider>,
  );
  return { onReset };
}

/** Radix opens a menu on pointerdown, which jsdom's click does not send. */
async function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Reset options" }), { button: 0, ctrlKey: false });
  await screen.findByRole("menu");
}

async function enabledItem(name: RegExp) {
  const item = await screen.findByRole("menuitem", { name });
  await waitFor(() => expect(item).not.toHaveAttribute("aria-disabled"));
  return item;
}

describe("ResetMenu (item reset spec §5.2)", () => {
  it("cleans the code at once, after saving the editor's text", async () => {
    const { onReset } = renderMenu();
    await openMenu();
    await userEvent.click(await enabledItem(/^Clean code/));
    await waitFor(() => expect(onReset).toHaveBeenCalled());
    expect(posts).toEqual([{ action: "code" }]);
    expect(order).toEqual(["prepare", "post"]);
  });

  it("says why Discard attempt is off when no attempt is open", async () => {
    renderMenu();
    await openMenu();
    const discard = await screen.findByRole("menuitem", { name: /^Discard attempt/ });
    await waitFor(() => expect(discard).toHaveTextContent("No attempt is open."));
    expect(discard).toHaveAttribute("aria-disabled", "true");
  });

  it("asks before discarding, with what the attempt loses", async () => {
    preview = { ...preview, open: { hints: 2, minutes: 14 } };
    renderMenu();
    await openMenu();
    await userEvent.click(await enabledItem(/^Discard attempt/));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("You lose 2 hints and 14 min of this attempt.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(posts).toEqual([{ action: "attempt" }]));
  });

  it("erases only once the id is typed", async () => {
    renderMenu();
    await openMenu();
    await userEvent.click(await enabledItem(/^Erase everything/));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("This erases 1 attempt, 0 hints, its review schedule and 0 saved versions. It cannot be undone.");
    const erase = within(dialog).getByRole("button", { name: "Erase" });
    expect(erase).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Type lc-0020 to confirm/ }), "lc-0020");
    expect(erase).toBeEnabled();
    await userEvent.click(erase);
    await waitFor(() => expect(posts).toEqual([{ action: "all" }]));
  });

  it("locks Discard and Erase for an item with an exam attempt, and keeps Clean code", async () => {
    preview = { ...preview, open: { hints: 0, minutes: 3 }, examLocked: true };
    renderMenu();
    await openMenu();
    for (const name of [/^Discard attempt/, /^Erase everything/]) {
      const item = await screen.findByRole("menuitem", { name });
      await waitFor(() => expect(item).toHaveTextContent("Exam attempts are kept: only the code can be cleaned."));
      expect(item).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByRole("menuitem", { name: /^Clean code/ })).not.toHaveAttribute("aria-disabled");
  });
});
```

- [ ] **Step 4: Run them to see them fail**

Run: `pnpm -s vitest run playground/tests/web/reset-menu.test.tsx`
Expected: FAIL — `Failed to resolve import "../../web/work/ResetMenu.tsx"`.

- [ ] **Step 5: Write `ResetMenu`**

`playground/web/work/ResetMenu.tsx`:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Eraser, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ResetAction, TargetData } from "../../server/types.ts";
import { getResetPreview, keys, postReset } from "../api.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog.tsx";
import { Button } from "../components/ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu.tsx";
import { Input } from "../components/ui/input.tsx";

const EXAM_LOCK = "Exam attempts are kept: only the code can be cleaned.";
const DONE: Record<ResetAction, string> = {
  code: "Code cleaned: the old version is in the history.",
  attempt: "Attempt discarded.",
  all: "Erased: back to its first day.",
};
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A menu item's label, with the reason it is off under it. */
function ItemText({ text, off }: { text: string; off: string | null }) {
  return (
    <span className="flex flex-col">
      {text}
      {off && <span className="text-[0.625rem] text-muted-foreground">{off}</span>}
    </span>
  );
}

/**
 * The work page's "⋯" menu (item reset spec §5.2): Clean code at once, Discard attempt after a dialog, Erase everything
 * after typing the id. `prepare` saves the editor's text first, so Clean code archives what the user sees.
 */
export function ResetMenu({ target, prepare, onReset }: { target: TargetData; prepare(): Promise<unknown>; onReset(): void }) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<"attempt" | "all" | null>(null);
  const [typed, setTyped] = useState("");
  const preview = useQuery({
    queryKey: keys.reset(target.id),
    queryFn: () => getResetPreview(target.id),
    enabled: menuOpen || confirm !== null,
    staleTime: 0,
  });
  const reset = useMutation({
    mutationFn: async (action: ResetAction) => {
      await prepare();
      return postReset(target.id, action);
    },
    onSuccess: ({ action }) => {
      for (const queryKey of [keys.targets, keys.home, keys.today, keys.concepts, keys.reset(target.id)]) void queryClient.invalidateQueries({ queryKey });
      toast(DONE[action]);
      onReset();
    },
    onError: (error) => toast.error(error.message),
  });
  const p = preview.data;
  // "" while the preview loads: off, with no reason yet.
  const discardOff = !p ? "" : p.examLocked ? EXAM_LOCK : p.open ? null : "No attempt is open.";
  const eraseOff = !p ? "" : p.examLocked ? EXAM_LOCK : null;
  const closeDialog = (open: boolean) => {
    if (open) return;
    setConfirm(null);
    setTyped("");
  };
  return (
    <>
      {/* Not modal: a modal menu that opens a dialog can leave pointer-events: none on the body. */}
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Reset options" disabled={reset.isPending}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => reset.mutate("code")}>
            <Eraser aria-hidden />
            <ItemText text="Clean code" off={null} />
          </DropdownMenuItem>
          <DropdownMenuItem disabled={discardOff !== null} onSelect={() => setConfirm("attempt")}>
            <Undo2 aria-hidden />
            <ItemText text="Discard attempt" off={discardOff} />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={eraseOff !== null} onSelect={() => setConfirm("all")}>
            <Trash2 aria-hidden />
            <ItemText text="Erase everything" off={eraseOff} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm === "attempt"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              You lose {count(p?.open?.hints ?? 0, "hint")} and {p?.open?.minutes ?? 0} min of this attempt. Your code goes to the history and the editor
              starts with a fresh stub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => reset.mutate("attempt")}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirm === "all"} onOpenChange={closeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase {target.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This erases {count(p?.attempts ?? 0, "attempt")}, {count(p?.hints ?? 0, "hint")}, its review schedule and {count(p?.versions ?? 0, "saved version")}. It
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex flex-col gap-1.5">
            <span>
              Type <code className="font-mono">{target.id}</code> to confirm
            </span>
            <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={typed !== target.id} onClick={() => reset.mutate("all")}>
              Erase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

If the description text test fails only on whitespace from JSX line breaks, keep each sentence on one JSX line.

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm -s vitest run playground/tests/web/reset-menu.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add playground/web/components/ui/dropdown-menu.tsx playground/web/components/ui/alert-dialog.tsx playground/web/api.ts playground/web/work/ResetMenu.tsx playground/tests/web/reset-menu.test.tsx
git commit -m "feat(playground): add the reset menu and its dialogs"
```

---

### Task 5: wire the menu into the work page and reload the editor

**Files:**
- Modify: `playground/web/work/WorkHeader.tsx` (a `menu` slot), `playground/web/routes/work.tsx` (`WorkPage`, `GatedWorkspace`, `Workspace`)
- Test: `playground/tests/web/work-reset.test.tsx`

**Interfaces:**
- Consumes: `ResetMenu` from Task 4.
- Produces: `WorkHeaderProps.menu?: ReactNode`; `Workspace` gets `onReset(): void`.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/web/work-reset.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeData, TargetData } from "../../server/types.ts";
import { keys } from "../../web/api.ts";
import { routeTree } from "../../web/router.tsx";

// CodeMirror needs layout APIs that jsdom lacks; a textarea stands in for it (as in work-gate.test.tsx).
vi.mock("../../web/components/CodeEditor.tsx", async () => {
  const { createElement } = await import("react");
  return {
    CodeEditor: ({ value, onChange, ariaLabel }: { value: string; onChange(value: string): void; ariaLabel: string }) =>
      createElement("textarea", { "aria-label": ariaLabel, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) }),
  };
});

const OLD = "# my earlier work\n";
const STUB = "class Solution:\n    def isValid(self, s: str) -> bool:\n        raise NotImplementedError\n";
const TARGET: TargetData = {
  id: "lc-0020",
  kind: "problem",
  title: "Valid Parentheses",
  readme: "problems/lc-0020-valid-parentheses/README.md",
  markdown: "# 20. Valid Parentheses\n\nPlaceholder statement.\n",
  readmeError: null,
  difficulty: "easy",
  url: null,
  status: "solving",
  inProgress: true,
  hints: 0,
  signature: null,
  exampleInput: null,
  caseError: null,
  solutions: { py: true, ts: false },
  gate: null,
  freshStart: false,
};
const HOME: HomeData = { problems: [], groups: [], concepts: [] };
let cleaned = false;

beforeEach(() => {
  cleaned = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.pathname === "/api/target") return Response.json(TARGET);
      if (url.pathname === "/api/solution" && method === "GET") return Response.json(cleaned ? { code: STUB, version: "stub-v1" } : { code: OLD, version: "old-v1" });
      if (url.pathname === "/api/study/reset/lc-0020" && method === "GET") return Response.json({ open: { hints: 0, minutes: 1 }, attempts: 1, hints: 0, versions: 0, examLocked: false });
      if (url.pathname === "/api/study/reset/lc-0020" && method === "POST") {
        cleaned = true;
        return Response.json({ action: "code" });
      }
      return Response.json({ error: "unexpected request" }, { status: 500 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the work page's reset menu (item reset spec §5.2)", () => {
  it("reloads the editor on the fresh stub after Clean code", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
    client.setQueryData(keys.home, HOME);
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/p/lc-0020"] }) });
    await act(() => router.load());
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("textbox", { name: "solution.py" })).toHaveValue(OLD);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reset options" }), { button: 0, ctrlKey: false });
    await userEvent.click(await screen.findByRole("menuitem", { name: /^Clean code/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "solution.py" })).toHaveValue(STUB));
  });
});
```

If the page makes another request this stub does not answer (an EventSource, `/api/concept`…), copy how `work-gate.test.tsx` handles it rather than widening this test.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm -s vitest run playground/tests/web/work-reset.test.tsx`
Expected: FAIL — no button named "Reset options".

- [ ] **Step 3: Add the slot to `WorkHeader`**

In `playground/web/work/WorkHeader.tsx`: `import { Fragment, type ReactNode } from "react";`; in `WorkHeaderProps`:

```ts
  /** Item actions at the end of the header (the reset menu), or nothing. */
  menu?: ReactNode;
```

destructure `menu` in `WorkHeader(…)`, and render it as the last child of `<div className="ml-auto flex items-center gap-2">`, after the Run `<Hint>`:

```tsx
        {menu}
```

- [ ] **Step 4: Wire it in `routes/work.tsx`**

1. `import { ResetMenu } from "../work/ResetMenu.tsx";`
2. In `WorkPage`: `const [generation, setGeneration] = useState(0);` next to the other state (before any early return), and render the workspace with:

```tsx
  // A reset rewrites the solution on disk: a fresh Workspace loads it with an empty undo history (item reset spec §5.2).
  return <Workspace key={`${lang}:${generation}`} target={target.data} lang={lang} onLang={choose} onReset={() => setGeneration((n) => n + 1)} />;
```

3. `Workspace`'s props gain `onReset(): void`; its `<WorkHeader …>` gets:

```tsx
        menu={<ResetMenu target={target} prepare={flush} onReset={onReset} />}
```

4. `GatedWorkspace`'s `<WorkHeader …>` gets (no editor yet: nothing to save; the target refetch moves the gate):

```tsx
        menu={<ResetMenu target={target} prepare={async () => true} onReset={() => {}} />}
```

- [ ] **Step 5: Run the web tests to see them pass**

Run: `pnpm -s vitest run playground/tests/web/`
Expected: PASS (the new test, and `work-header`, `work-gate` unchanged).

- [ ] **Step 6: Full verification**

Run: `pnpm verify`
Expected: exit 0 — every Vitest suite passes, both `tsc` runs are clean, `check` reports 0 errors.

Run: `pnpm -s e2e -g "opening a problem"`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add playground/web/work/WorkHeader.tsx playground/web/routes/work.tsx playground/tests/web/work-reset.test.tsx
git commit -m "feat(playground): add the reset menu to the work page"
```
