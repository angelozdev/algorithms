# Web Playground (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web app (`pnpm play`) where the user reads problems and concept notes, writes `solution.py`/`solution.ts` in an editor with no AI and no autocomplete, and runs sub-project A's test engine from the browser.

**Architecture:** A Vite dev server on `127.0.0.1` serves a React single-page app and mounts a Hono API under `/api` (through `@hono/vite-dev-server`), all in one process. The API calls the existing engine (`runTarget`, a new `runCustom`, `listTargets`, `scanRepo`), writes only `solution.{py,ts}` and the "My explanation" section of concept READMEs, and streams file changes as Server-Sent Events. The browser uses a typed Hono client with TanStack Query and Router, CodeMirror 6, and `react-markdown` with Shiki.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 7 (`tsc`), Vite 8, React 19, Hono 4, TanStack Router + Query, CodeMirror 6 (`@uiw/react-codemirror`), react-markdown + remark-gfm + Shiki, Tailwind CSS 4, Radix (`radix-ui`), chokidar 5, zod 4, vitest 5 + Testing Library + jsdom, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-web-playground-design.md` (read it with sub-project A's spec, `docs/superpowers/specs/2026-09-27-algorithms-study-system-design.md`, which defines `Target`, `RunResult`, `cases.json` and the statuses).

## Global Constraints

- Every file in the repo is written in **English**. Claude chats with the user in **Spanish**.
- Claude configuration is **project-level only** (`algorithms/.claude/`). Nothing goes to `~/.claude/`.
- Runtimes: Node.js ≥ 24, pnpm 11, Python 3.13 through `uv` (as in sub-project A). TypeScript 7: `baseUrl` no longer exists; do not add it.
- **Work in a git worktree** on a new branch `playground` created from `restructure` (superpowers:using-git-worktrees). The main checkout has uncommitted user work (`concepts/INDEX.md`, four problem READMEs, `concepts/two-pointers/`): never touch, stage, revert or commit it. Stage files by explicit path; never `git add -A` or `git add .`. Never run `pnpm sync` on the real content.
- The server listens on **`127.0.0.1` only**. The API takes ids and slugs, never file paths, and matches them **exactly** (no fuzzy search).
- **No expected value of a hidden case ever leaves the server.** `cases.json` and `stress.ts` are never served.
- The playground **never writes frontmatter**. Its only writes are `solution.{py,ts}` of a known target and the "My explanation" section of a known concept.
- Editor: **no autocompletion, no lint, no hover tooltips**; the editable area carries `spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"`, `writingsuggestions="false"`.
- Autosave **500 ms** after the last keystroke. Tests run only on ▶ Run / `⌘↵`. Custom input wall clock **5000 ms**. Prints cut to **20 lines** (the engine's `truncateLines`).
- Prefer a maintained library over hand-written code. Hand-written code is limited to `routeForLink`, the content-version check, `runCustom`, the Host/Origin guard, and glue.
- Tests exercise behavior through public interfaces: module entry points, HTTP routes (`app.request`), rendered components, and the running app (Playwright).
- Commit messages follow Conventional Commits.

## Review Focus

These five inputs are implied by the spec but no requirement names them. Each has a test in the task that owns the code:

1. **Spanish and emoji text** (`ñandú 🎵 — café`) in a solution or in "My explanation" round-trips byte for byte, and its version hash is stable. → Task 5 and Task 6.
2. **Switching language or leaving the page less than 500 ms after typing** still saves the last edit. → Task 13, unmount test.
3. **Python-style literals in the custom input** (`['a', True]`, `None`) show "not valid JSON" under the field and send nothing. → Task 11.
4. **A print flood in a custom run** (`print` in a 10⁵ loop) comes back cut to 20 lines plus a "… N more lines" note. → Task 1.
5. **"My explanation" as the last section of a README with no trailing newline** is replaced without touching anything before it. → Task 6.

## Deviations from the spec (decided while planning)

| Spec says | Plan does | Why |
|---|---|---|
| shadcn/ui components "copied into `web/components/ui/`" | Three small shadcn-style components (`Button`, `Badge`, `Tabs`) written by hand in the plan, using the same libraries shadcn uses (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`) | The shadcn CLI now asks interactive questions (component library, overwrite) and does not recognise a sub-folder without its own `package.json` (verified). |
| `hono/csrf` "rejects foreign Origins on unsafe methods" | `guard.ts` also rejects any unsafe request whose `Origin` is not local; `hono/csrf` stays for form-encoded requests | `hono/csrf` only checks form-like content types (verified in its source); a JSON `PUT` with a foreign `Origin` would pass it. |
| Host allowlist `127.0.0.1:<port>` / `localhost:<port>` | Any port on `127.0.0.1` or `localhost` | The port can change (next free port). DNS rebinding changes the host name, not the port. |
| `ConceptData.markdown` | `ConceptData.before`, `explanation`, `after` | The concept page renders the editable section between two read-only parts without parsing Markdown again in the browser. |
| `HomeData` has problems and concepts | Adds `groups: { pattern, ids }[]` from a new shared `problemGroups()` | The grouping rule lives in one place, shared with `INDEX.md`. |
| — | `GET /api/health` → `{ ok: true }` | Readiness check for the CLI test and Playwright. |
| `pnpm play [query] [--no-open]` | Adds `--port <n>`; `startPlayground` takes `strictPort` | The end-to-end server needs a known port. |
| `react-resizable-panels` `autoSaveId` | v4 API: `Group`/`Panel`/`Separator` with `useDefaultLayout({ id, storage: localStorage })` | `autoSaveId` no longer exists in v4 (verified). |
| Keyboard shortcuts | Inside the editor, a CodeMirror keymap with `Prec.highest`; outside it, `react-hotkeys-hook` | CodeMirror's default keymap binds `Mod-Enter` to "insert blank line", so the editor must handle ⌘↵ itself. |
| `problemIdFromFolder` lives in `lib/repo.ts` | Moves with `exerciseIdFromFolder` to a Node-free `lib/ids.ts`, re-exported by `lib/repo.ts` | The browser's `routeForLink` needs the same rule, and `lib/repo.ts` imports `node:fs`. |
| `pnpm verify` = vitest + `tsc -p playground` + check | Also runs the root `tsc --noEmit` | Moving the formatters touches the engine. The root type check passed before this plan (verified). |
| Custom input "`⇧⌘↵` runs it" | The Custom input panel stays mounted (hidden when its tab is inactive) and exposes `submit()` | Its fields and last result survive tab switches, and the shortcut works from the editor too. |

## File Structure

```
algorithms/
├── package.json · vitest.config.ts · tsconfig.json (modified)          (Task 3)
├── lib/ids.ts                  problemIdFromFolder, exerciseIdFromFolder (Node-free)   (Task 9)
├── lib/repo.ts                 + isInProgress(entry)                                   (Task 2)
├── scripts/lib/render.ts       + problemGroups(repo)                                   (Task 2)
├── runner/src/format.ts        formatInput/formatNamedInput/formatOutput (Node-free)   (Task 1)
├── runner/src/custom.ts        runCustom(target, lang, input) → CustomResult           (Task 1)
├── playground/
│   ├── cli.ts                  pnpm play [query] [--no-open] [--port n]                (Task 3)
│   ├── start.ts                startPlayground(), routeFor()                           (Task 3)
│   ├── vite.config.ts          React + Tailwind + @hono/vite-dev-server                (Task 3)
│   ├── tsconfig.json           DOM + JSX + bundler resolution                          (Task 3)
│   ├── playwright.config.ts                                                            (Task 14)
│   ├── server/
│   │   ├── app.ts              createApp({ root }), default app, AppType               (Tasks 3–7)
│   │   ├── guard.ts            Host allowlist, Origin check, hono/csrf                 (Task 3)
│   │   ├── validate.ts         valid(target, schema) → 400 { error }                   (Task 3)
│   │   ├── types.ts            API data types                                          (Task 4)
│   │   ├── targets.ts          findTarget, homeData, targetData, targetRoutes          (Task 4)
│   │   ├── solutions.ts        contentVersion, read/writeSolution, solutionRoutes      (Task 5)
│   │   ├── explanation.ts      splitExplanation, joinExplanation, explanationIssues    (Task 6)
│   │   ├── concepts.ts         findConcept, conceptData, conceptRoutes                 (Task 6)
│   │   └── events.ts           classify, EventHub, eventRoutes                         (Task 7)
│   ├── web/
│   │   ├── index.html · main.tsx · router.tsx · styles.css                             (Tasks 3, 8)
│   │   ├── api.ts              typed client, fetchers, query options                   (Task 8)
│   │   ├── events.tsx          EventsProvider, useConnected, useRepoEvents             (Task 8)
│   │   ├── links.ts            AppLink, targetLink, routeForLink                       (Tasks 8, 9)
│   │   ├── lang.ts             pickLang, remembered language                           (Task 14)
│   │   ├── lib/cn.ts · lib/theme.ts                                                    (Tasks 8, 12)
│   │   ├── hooks/useSolutionSync.ts                                                    (Task 13)
│   │   ├── components/ui/{button,badge,tabs}.tsx                                       (Task 8)
│   │   ├── components/{ConnectionBanner,NotFound,StatusIcon}.tsx                       (Task 8)
│   │   ├── components/Markdown.tsx                                                     (Task 9)
│   │   ├── components/{TestsPanel,ConsolePanel}.tsx                                    (Task 10)
│   │   ├── components/CustomInputPanel.tsx                                             (Task 11)
│   │   ├── components/{CodeEditor,ConceptView}.tsx                                     (Task 12)
│   │   └── routes/{home,concept,work}.tsx                                              (Tasks 8, 12, 14)
│   ├── tests/server/*.test.ts  (node)   ·   tests/web/*.test.{ts,tsx} (jsdom)          (Tasks 3–14)
│   └── e2e/{fixture,serve}.ts · *.spec.ts                                              (Tasks 14, 15)
├── .claude/hooks/guard-solution.mjs (modified) · CLAUDE.md · README.md · skills        (Task 16)
└── .gitignore (modified)                                                               (Tasks 14, 16)
```

**Working directory for every command:** the root of the `playground` worktree.

---

### Task 1: Engine — shared value formatting and custom runs

**Files:**
- Create: `runner/src/format.ts`, `runner/src/custom.ts`
- Modify: `runner/src/reporter.ts:1-29` (formatters move out), `runner/src/run.ts` (`timeoutError` exported), `runner/src/types.ts` (add `CustomResult`)
- Test: `runner/tests/format.test.ts`, `runner/tests/custom.test.ts`

**Interfaces:**
- Consumes (sub-project A): `runHarness(lang, request, { wallLimitMs })` → `HarnessOutcome`; `loadCaseFile(dir)`; `inputIssues(signature, input, where)`; `ensureSolution(dir, cf, lang)`; `truncateLines(text)`; test helpers `tempDir`, `removeTemp`, `makeProblem`, `write` from `runner/tests/helpers.ts`.
- Produces:
  - `runner/src/format.ts`: `MAX_VALUE = 100`, `truncate(text, max?)`, `formatInput(input, max?)`, `formatNamedInput(names, input, max?)`, `formatOutput(output, max?)`. No Node imports, so the browser can use it.
  - `runner/src/types.ts`: `interface CustomResult { fatal: HarnessError | null; output?: unknown; error?: HarnessError; ms?: number; stdout: string }`.
  - `runner/src/custom.ts`: `CUSTOM_WALL_MS = 5000`, `class CustomInputError extends Error { issues: string[] }`, `runCustom(target: Target, lang: Lang, input: unknown, options?: { wallMs?: number }): Promise<CustomResult>`. Throws `CaseFileError` for a broken `cases.json`.
  - `runner/src/run.ts`: `export function timeoutError(limitMs: number): HarnessError`.

- [ ] **Step 1: Write the failing format test**

Create `runner/tests/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatInput, formatNamedInput, formatOutput } from "../src/format.ts";

describe("format", () => {
  it("names the arguments when there is one value per name", () => {
    expect(formatNamedInput(["nums", "target"], [[3, 2, 4], 6])).toBe("nums=[3,2,4], target=6");
    expect(formatNamedInput(["nums"], [[1], 2])).toBe("[1], 2");
    expect(formatNamedInput([], { ops: ["A"], args: [[]] })).toBe('{"ops":["A"],"args":[[]]}');
  });

  it("cuts long values at the given length", () => {
    expect(formatOutput("x".repeat(300))).toHaveLength(100);
    expect(formatOutput("x".repeat(300), 2000)).toBe(JSON.stringify("x".repeat(300)));
    expect(formatInput([["y".repeat(500)]], 50)).toHaveLength(50);
    expect(formatInput([["y".repeat(500)]], 50).endsWith("…")).toBe(true);
  });

  it("shows in-place results as the returned value and the array", () => {
    expect(formatOutput({ ret: 2, param: [1, 2, 2] })).toBe("returned 2, array is now [1,2,2]");
  });
});
```

- [ ] **Step 2: Write the failing custom-run test**

Create `runner/tests/custom.test.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CustomInputError, runCustom } from "../src/custom.ts";
import { CaseFileError } from "../src/schema.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const SUM = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [{ input: [[1, 2]], expected: 3 }],
  hidden: [],
};

describe("runCustom", () => {
  it("returns the output and the prints in Python and TypeScript", async () => {
    const target = makeProblem(root, "lc-0101-custom", SUM, {
      "solution.py":
        "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        print('got', nums)\n        return sum(nums)\n",
      "solution.ts":
        "export default function solve(nums: number[]): number {\n  console.log('got', nums.length);\n  return nums.reduce((a, b) => a + b, 0);\n}\n",
    });
    const py = await runCustom(target, "py", [[4, 5, 6]]);
    expect(py).toMatchObject({ fatal: null, output: 15, stdout: "got [4, 5, 6]\n" });
    expect(py.ms).toBeGreaterThanOrEqual(0);
    const ts = await runCustom(target, "ts", [[4, 5, 6]]);
    expect(ts).toMatchObject({ fatal: null, output: 15, stdout: "got 3\n" });
  });

  it("returns the value and the modified parameter for in-place problems", async () => {
    const target = makeProblem(
      root,
      "lc-0102-inplace",
      {
        entry: "removeValue",
        params: [
          { name: "nums", type: "int[]" },
          { name: "val", type: "int" },
        ],
        returns: "int",
        inPlace: { param: "nums", prefix: "return" },
        examples: [{ input: [[3, 2, 2, 3], 3], expected: [2, 2] }],
        hidden: [],
      },
      {
        "solution.py":
          "class Solution:\n    def removeValue(self, nums: list[int], val: int) -> int:\n        nums[:] = [n for n in nums if n != val]\n        return len(nums)\n",
      },
    );
    expect((await runCustom(target, "py", [[1, 3, 1], 3])).output).toEqual({ ret: 2, param: [1, 1] });
  });

  it("runs class problems from ops and args", async () => {
    const target = makeProblem(
      root,
      "lc-0103-class",
      {
        mode: "class",
        entry: "Counter",
        examples: [{ input: { ops: ["Counter", "add", "get"], args: [[], [2], []] }, expected: [null, null, 2] }],
        hidden: [],
      },
      {
        "solution.py":
          "class Counter:\n    def __init__(self) -> None:\n        self.total = 0\n\n    def add(self, n: int) -> None:\n        self.total += n\n\n    def get(self) -> int:\n        return self.total\n",
      },
    );
    const result = await runCustom(target, "py", { ops: ["Counter", "add", "add", "get"], args: [[], [2], [3], []] });
    expect(result.output).toEqual([null, null, null, 5]);
  });

  it("reports an exception with its trace, a load error as fatal, and a loop as a timeout", async () => {
    const target = makeProblem(root, "lc-0104-errors", SUM, {
      "solution.py": "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return nums[10]\n",
    });
    const thrown = await runCustom(target, "py", [[1]]);
    expect(thrown.fatal).toBeNull();
    expect(thrown.error?.kind).toBe("exception");
    expect(thrown.error?.message).toMatch(/IndexError/);
    expect(thrown.error?.trace).toContain("line 3");

    write(target.dir, "solution.py", "class Solution:\n    def solve(self, nums)\n        return 0\n");
    expect((await runCustom(target, "py", [[1]])).fatal?.kind).toBe("load");

    write(target.dir, "solution.py", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        while True:\n            pass\n");
    const loop = await runCustom(target, "py", [[1]], { wallMs: 1500 });
    expect(loop.error?.kind).toBe("timeout");
  });

  it("rejects an input that does not fit the signature before running anything", async () => {
    const target = makeProblem(root, "lc-0105-mismatch", SUM);
    await expect(runCustom(target, "py", [[1], 2])).rejects.toThrow(CustomInputError);
    await expect(runCustom(target, "py", [[1], 2])).rejects.toMatchObject({
      issues: ["custom.input: expected 1 params, got 2"],
    });
    expect(existsSync(path.join(target.dir, "solution.py"))).toBe(false);
    write(target.dir, "cases.json", "{ nope");
    await expect(runCustom(target, "py", [[1]])).rejects.toThrow(CaseFileError);
  });

  it("keeps a print flood to 20 lines", async () => {
    const target = makeProblem(root, "lc-0106-flood", SUM, {
      "solution.py":
        "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        for i in range(100000):\n            print(i)\n        return 0\n",
    });
    const result = await runCustom(target, "py", [[1]]);
    expect(result.output).toBe(0);
    const lines = result.stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(21);
    expect(lines[20]).toMatch(/^… \d+ more lines$/);
  });
});
```

- [ ] **Step 3: Run both tests to see them fail**

Run: `pnpm exec vitest run runner/tests/format.test.ts runner/tests/custom.test.ts`
Expected: FAIL: `Cannot find module '../src/format.ts'` and `'../src/custom.ts'`.

- [ ] **Step 4: Create `runner/src/format.ts`**

```ts
/** Longest value text before it is cut with "…". The terminal keeps the default; the web app passes more. */
export const MAX_VALUE = 100;

export function truncate(text: string, max = MAX_VALUE): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Positional arguments as the user would write them: `[2,7,11,15], 9`. */
export function formatInput(input: unknown, max = MAX_VALUE): string {
  const text = Array.isArray(input) ? input.map((arg) => JSON.stringify(arg)).join(", ") : JSON.stringify(input);
  return truncate(text ?? "undefined", max);
}

/** Named arguments, `nums=[3,2,4], target=6`, when the input has one value per name; otherwise formatInput. */
export function formatNamedInput(names: readonly string[], input: unknown, max = MAX_VALUE): string {
  if (names.length === 0 || !Array.isArray(input) || input.length !== names.length) return formatInput(input, max);
  return truncate(input.map((arg, i) => `${names[i]}=${JSON.stringify(arg)}`).join(", "), max);
}

export function formatOutput(output: unknown, max = MAX_VALUE): string {
  if (output && typeof output === "object" && !Array.isArray(output) && "param" in output) {
    const { ret, param } = output as { ret: unknown; param: unknown };
    return truncate(`returned ${JSON.stringify(ret)}, array is now ${JSON.stringify(param)}`, max);
  }
  return truncate(JSON.stringify(output) ?? "undefined", max);
}
```

- [ ] **Step 5: Make `reporter.ts` use it**

In `runner/src/reporter.ts`, delete `const MAX_VALUE = 100;`, the `truncate` function, and the `formatInput` and `formatOutput` functions (lines 8–29). Add these two lines right after the existing imports:

```ts
import { formatInput, formatOutput, truncate } from "./format.ts";

export { formatInput, formatOutput };
```

The rest of `reporter.ts` keeps calling `formatInput`, `formatOutput` and `truncate` exactly as before, and `runner/tests/reporter.test.ts` keeps importing them from `reporter.ts`.

- [ ] **Step 6: Export `timeoutError` and add `CustomResult`**

In `runner/src/run.ts`, change `function timeoutError(limitMs: number): HarnessError {` to:

```ts
export function timeoutError(limitMs: number): HarnessError {
```

Append to `runner/src/types.ts`:

```ts
/** One run of the user's code on an input of their own. Nothing is judged, so there is no expected value. */
export interface CustomResult {
  /** The solution did not load (syntax error, missing entry…). */
  fatal: HarnessError | null;
  output?: unknown;
  error?: HarnessError;
  ms?: number;
  /** Prints, cut to 20 lines. */
  stdout: string;
}
```

- [ ] **Step 7: Create `runner/src/custom.ts`**

```ts
import { runHarness } from "./executor.ts";
import { timeoutError, truncateLines } from "./run.ts";
import { inputIssues, loadCaseFile } from "./schema.ts";
import { ensureSolution } from "./stubs.ts";
import type { CustomResult, Lang, Target } from "./types.ts";

export const CUSTOM_WALL_MS = 5000;

/** The input does not fit the signature in cases.json (wrong number of params, malformed class calls). */
export class CustomInputError extends Error {
  constructor(readonly issues: string[]) {
    super(`the input does not match the signature:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "CustomInputError";
  }
}

/**
 * Runs the user's solution on one input of their own and reports what it returned, threw or printed.
 * Nothing is judged. Throws CaseFileError for a broken cases.json and CustomInputError for a bad input.
 */
export async function runCustom(
  target: Target,
  lang: Lang,
  input: unknown,
  options: { wallMs?: number } = {},
): Promise<CustomResult> {
  const wallMs = options.wallMs ?? CUSTOM_WALL_MS;
  const cf = loadCaseFile(target.dir);
  const issues = inputIssues(cf, input, "custom");
  if (issues.length > 0) throw new CustomInputError(issues);
  const solutionPath = ensureSolution(target.dir, cf, lang).path;
  const outcome = await runHarness(
    lang,
    {
      solutionPath,
      mode: cf.mode,
      entry: cf.entry,
      params: cf.params,
      returns: cf.returns,
      inPlace: cf.inPlace,
      discardOutput: false,
      cases: [{ id: "c1", input }],
    },
    { wallLimitMs: wallMs },
  );
  if (outcome.fatal) return { fatal: outcome.fatal, stdout: "" };
  const run = outcome.runs.get("c1");
  // runHarness records a crash during the case as a failed run, so a missing run means the time ran out.
  if (!run) return { fatal: null, error: timeoutError(wallMs), stdout: "" };
  if (!run.ok) return { fatal: null, error: run.error, ms: run.ms, stdout: truncateLines(run.stdout) };
  return { fatal: null, output: run.output, ms: run.ms, stdout: truncateLines(run.stdout) };
}
```

- [ ] **Step 8: Run the tests**

Run: `pnpm exec vitest run runner/tests/format.test.ts runner/tests/custom.test.ts runner/tests/reporter.test.ts`
Expected: PASS (3 files).

Run: `pnpm verify`
Expected: every test passes, then `0 error(s)` from check.

- [ ] **Step 9: Commit**

```bash
git add runner/src/format.ts runner/src/custom.ts runner/src/reporter.ts runner/src/run.ts runner/src/types.ts runner/tests/format.test.ts runner/tests/custom.test.ts
git commit -m "feat(runner): run a solution on a custom input and share value formatting"
```

---

### Task 2: Repo model — "in progress" and problem groups

**Files:**
- Modify: `lib/repo.ts` (add `isInProgress`), `scripts/lib/render.ts:58-78` (extract `problemGroups`)
- Test: `scripts/tests/render.test.ts`

**Interfaces:**
- Consumes: `scanRepo(root)`, `DocEntry`, `ProblemEntry`, `strList` from `lib/repo.ts`; fixture helpers `makeStudyRepo`, `put`, `problemReadme`, `cleanupTempDirs` from `scripts/tests/fixture.ts` (`makeStudyRepo` has `lc-0001` solved with pattern `arrays-hashing` and `lc-0020` solving with pattern `stack`).
- Produces:
  - `lib/repo.ts`: `isInProgress(entry: Pick<DocEntry, "dir" | "data">): boolean`. True for `status: solving`, or `status: todo` with `solution.py`/`solution.ts` in `entry.dir`.
  - `scripts/lib/render.ts`: `NO_PATTERN = "(no pattern yet)"`, `interface ProblemGroup { pattern: string; problems: ProblemEntry[] }`, `problemGroups(repo: RepoModel): ProblemGroup[]`. Patterns are sorted; a problem with several patterns appears in each group.

- [ ] **Step 1: Write the failing test**

Create `scripts/tests/render.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { isInProgress, scanRepo } from "../../lib/repo.ts";
import { problemGroups } from "../lib/render.ts";
import { cleanupTempDirs, makeStudyRepo, problemReadme, put } from "./fixture.ts";

afterEach(cleanupTempDirs);

const readme = (id: string, title: string, patterns: string[], status: string) =>
  problemReadme({ id, title, slug: title.toLowerCase(), patterns, concepts: [], status, solvedIn: [] });

describe("problemGroups", () => {
  it("sorts the patterns and lists a problem under each of its patterns", () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0042-trap/README.md", readme("lc-0042", "Trap", ["two-pointers", "stack"], "todo"));
    put(root, "problems/lc-0050-bare/README.md", readme("lc-0050", "Bare", [], "todo"));
    const groups = problemGroups(scanRepo(root)).map((group) => [group.pattern, group.problems.map((p) => p.folderId)]);
    expect(groups).toEqual([
      ["(no pattern yet)", ["lc-0050"]],
      ["arrays-hashing", ["lc-0001"]],
      ["stack", ["lc-0020", "lc-0042"]],
      ["two-pointers", ["lc-0042"]],
    ]);
  });
});

describe("isInProgress", () => {
  it("counts solving items, and todo items that already have a solution file", () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0070-stairs/README.md", readme("lc-0070", "Stairs", ["dp-1d"], "todo"));
    put(root, "problems/lc-0071-path/README.md", readme("lc-0071", "Path", ["dp-2d"], "todo"));
    put(root, "problems/lc-0071-path/solution.ts", "export default function f() {}\n");
    const byId = Object.fromEntries(scanRepo(root).problems.map((p) => [p.folderId, isInProgress(p)]));
    expect(byId).toEqual({ "lc-0001": false, "lc-0020": true, "lc-0070": false, "lc-0071": true });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run scripts/tests/render.test.ts`
Expected: FAIL: `problemGroups` and `isInProgress` are not exported.

- [ ] **Step 3: Add `isInProgress` to `lib/repo.ts`**

Append (the file already imports `existsSync` and `path`):

```ts
/**
 * In progress: status solving, or todo with a solution file (created by pnpm watch or the playground).
 * The reminder hook (.claude/hooks/reminder.mjs) applies the same rule in plain JavaScript.
 */
export function isInProgress(entry: Pick<DocEntry, "dir" | "data">): boolean {
  if (entry.data.status === "solving") return true;
  return (
    entry.data.status === "todo" &&
    ["solution.py", "solution.ts"].some((name) => existsSync(path.join(entry.dir, name)))
  );
}
```

- [ ] **Step 4: Extract `problemGroups` in `scripts/lib/render.ts`**

Replace the whole `renderProblemIndex` function with:

```ts
export const NO_PATTERN = "(no pattern yet)";

export interface ProblemGroup {
  pattern: string;
  problems: ProblemEntry[];
}

/** Problems by pattern, patterns sorted. A problem with several patterns appears in each group. Shared with the playground. */
export function problemGroups(repo: RepoModel): ProblemGroup[] {
  const groups = new Map<string, ProblemEntry[]>();
  for (const problem of repo.problems) {
    const patterns = strList(problem.data.patterns);
    for (const pattern of patterns.length > 0 ? patterns : [NO_PATTERN]) {
      groups.set(pattern, [...(groups.get(pattern) ?? []), problem]);
    }
  }
  return [...groups.keys()].sort().map((pattern) => ({ pattern, problems: groups.get(pattern)! }));
}

export function renderProblemIndex(repo: RepoModel): string {
  const groups = problemGroups(repo);
  const lines = ["# Problems", "", GENERATED_NOTE, "", "Status: ✓ solved · … solving · ↺ revealed · ○ todo", ""];
  if (groups.length === 0) lines.push("_No problems yet. Paste one into Claude Code to start._", "");
  for (const { pattern, problems: items } of groups) {
    const solved = items.filter((p) => p.data.status === "solved").length;
    lines.push(`## ${pattern} (${solved}/${items.length})`, "");
    for (const p of items) {
      lines.push(`- ${mark(p.data.status)} [${p.folderId} · ${titleOf(p)}](problems/${p.folder}/README.md) · ${str(p.data.difficulty, "?")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run scripts/tests/render.test.ts scripts/tests/sync.test.ts`
Expected: PASS. `sync.test.ts` proves `INDEX.md` is unchanged.

Run: `pnpm verify`
Expected: all tests pass, `0 error(s)`.

- [ ] **Step 6: Commit**

```bash
git add lib/repo.ts scripts/lib/render.ts scripts/tests/render.test.ts
git commit -m "refactor(lib): share the in-progress rule and problem grouping"
```

---

### Task 3: Playground skeleton — `pnpm play`, a guarded API, and the test setup

**Files:**
- Modify: `package.json` (dependencies, `play` and `verify` scripts), `tsconfig.json` (exclude web code), `vitest.config.ts` (node and web projects)
- Create: `playground/tsconfig.json`, `playground/vite.config.ts`, `playground/start.ts`, `playground/cli.ts`, `playground/server/validate.ts`, `playground/server/guard.ts`, `playground/server/app.ts`, `playground/web/index.html`, `playground/web/main.tsx`, `playground/tests/web/setup.ts`, `playground/tests/server/helpers.ts`
- Test: `playground/tests/server/guard.test.ts`, `playground/tests/server/cli.test.ts`

**Interfaces:**
- Consumes: `contentRoot()`, `REPO_ROOT`, `TSX_BIN` from `runner/src/paths.ts`; `listTargets`, `resolveQuery`, `QueryError` from `runner/src/resolver.ts`; `Target` from `runner/src/types.ts`; `tempDir`, `makeProblem` from `runner/tests/helpers.ts`.
- Produces:
  - `playground/server/app.ts`: `interface ServerContext { root: string }`, `createApp(ctx: ServerContext)` (a Hono app; later tasks add `.route("/api", …)` calls to its chain), `type AppType = ReturnType<typeof createApp>`, and `export default createApp({ root: contentRoot() })`. Route: `GET /api/health` → `200 { ok: true }`. Errors: `HTTPException` → its response; anything else → `500 { error }` and `console.error`.
  - `playground/server/validate.ts`: `valid(target, schema)`: `@hono/zod-validator` with a hook that answers `400 { error: string }`.
  - `playground/server/guard.ts`: `isLocalHost(host)`, `isLocalOrigin(origin)`, `hostGuard` middleware (`403 { error }`), `formCsrf` (`hono/csrf`).
  - `playground/start.ts`: `DEFAULT_PORT = 4173`, `routeFor(target): string` (`/p/<id>` or `/e/<id>`), `startPlayground({ route, open, port?, strictPort? }): Promise<{ url: string; close(): Promise<void> }>`.
  - `playground/tests/server/helpers.ts`: `HOST`, `ORIGIN`, `type App`, `call(app, url, init?)`: adds `Host: 127.0.0.1:4173`, and for JSON bodies `content-type` and a local `Origin` unless the test sets one.

- [ ] **Step 1: Install the playground's dependencies**

```bash
pnpm add hono @hono/vite-dev-server @hono/zod-validator vite @vitejs/plugin-react tailwindcss @tailwindcss/vite react react-dom @tanstack/react-router @tanstack/react-query @uiw/react-codemirror @uiw/codemirror-theme-github @codemirror/lang-python @codemirror/lang-javascript @codemirror/lang-markdown @codemirror/view @codemirror/state @codemirror/language react-markdown remark-gfm @shikijs/rehype shiki mdast-util-from-markdown mdast-util-to-string react-resizable-panels use-debounce sonner radix-ui class-variance-authority clsx tailwind-merge lucide-react react-hotkeys-hook
pnpm add -D @types/react @types/react-dom @types/mdast jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected: both finish with `Done`. Versions verified while planning: vite 8.3, hono 4.13, @hono/vite-dev-server 0.26, react 19.3, @tanstack/react-router 1.170, @tanstack/react-query 5.104, @uiw/react-codemirror 4.25, react-markdown 10.1, shiki 4.4, react-resizable-panels 4.14, tailwindcss 4.3, radix-ui 1.6, vitest 5.0 runs on vite 8. If pnpm stops with `ERR_PNPM_IGNORED_BUILDS`, add the package it names under `allowBuilds:` in `pnpm-workspace.yaml` (as was done for esbuild) and install again.

- [ ] **Step 2: Configure TypeScript, vitest and the scripts**

In the root `tsconfig.json`, replace the `exclude` line with:

```json
  "exclude": ["node_modules", "archive", "playground/web", "playground/tests/web", "playground/e2e/.tmp"]
```

Create `playground/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "types": ["node", "vite/client"]
  },
  "include": ["./**/*.ts", "./**/*.tsx"],
  "exclude": ["./e2e/.tmp"]
}
```

Replace `vitest.config.ts` with:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["runner/tests/**/*.test.ts", "scripts/tests/**/*.test.ts", "playground/tests/server/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["playground/tests/web/**/*.test.{ts,tsx}"],
          setupFiles: ["playground/tests/web/setup.ts"],
        },
      },
    ],
  },
});
```

In `package.json` `scripts`, add `"play": "tsx playground/cli.ts",` and change `verify` to:

```json
    "verify": "vitest run && tsc --noEmit && tsc -p playground && tsx scripts/check.ts"
```

Create `playground/tests/web/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
// jsdom has no scrollTo; TanStack Router calls it after navigating.
window.scrollTo = () => {};
```

- [ ] **Step 3: Write the failing tests**

Create `playground/tests/server/helpers.ts`:

```ts
import type { createApp } from "../../server/app.ts";

export const HOST = "127.0.0.1:4173";
export const ORIGIN = `http://${HOST}`;
export type App = ReturnType<typeof createApp>;

/** Calls the app the way the browser does: a local Host header, and for JSON bodies a local Origin. */
export function call(
  app: App,
  url: string,
  init: { method?: string; json?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { host: HOST, ...init.headers };
  let body: string | undefined;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    headers.origin ??= ORIGIN;
    body = JSON.stringify(init.json);
  }
  return Promise.resolve(app.request(url, { method: init.method ?? (body ? "POST" : "GET"), headers, body }));
}
```

Create `playground/tests/server/guard.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { removeTemp, tempDir } from "../../../runner/tests/helpers.ts";
import { createApp } from "../../server/app.ts";
import { call, HOST } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));
const app = createApp({ root });

describe("guard", () => {
  it("answers requests addressed to this machine", async () => {
    const res = await call(app, "/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await call(app, "/api/health", { headers: { host: "localhost:5000" } })).status).toBe(200);
  });

  it("rejects any other Host (DNS rebinding) and requests without one", async () => {
    for (const host of ["evil.com", "evil.com:4173", "127.0.0.1.evil.com:4173"]) {
      expect((await call(app, "/api/health", { headers: { host } })).status, host).toBe(403);
    }
    expect((await app.request("/api/health")).status).toBe(403);
  });

  it("rejects writes sent from another origin, JSON or form", async () => {
    const json = await call(app, "/api/health", { method: "PUT", json: {}, headers: { origin: "http://evil.com" } });
    expect(json.status).toBe(403);
    const form = await app.request("/api/health", {
      method: "POST",
      headers: { host: HOST, "content-type": "application/x-www-form-urlencoded" },
      body: "a=1",
    });
    expect(form.status).toBe(403);
  });
});
```

Create `playground/tests/server/cli.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../../runner/src/paths.ts";
import { makeProblem, removeTemp, tempDir } from "../../../runner/tests/helpers.ts";
import { startPlayground } from "../../start.ts";

const root = tempDir();
afterAll(() => removeTemp(root));
const CASES = { entry: "solve", params: [{ name: "n", type: "int" }], returns: "int", examples: [], hidden: [] };
makeProblem(root, "lc-0001-sum-a", CASES);
makeProblem(root, "lc-0002-sum-b", CASES);

describe("pnpm play", () => {
  it("exits 1 and lists the candidates for an ambiguous query, before starting anything", () => {
    const run = spawnSync(TSX_BIN, ["playground/cli.ts", "sum", "--no-open"], {
      cwd: REPO_ROOT,
      env: { ...process.env, ALGO_ROOT: root },
      encoding: "utf8",
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"sum" matches 2');
    expect(run.stderr).toContain("lc-0002");
  });

  it("serves the app and the API on 127.0.0.1", async () => {
    const server = await startPlayground({ route: "/p/lc-0001", open: false, port: 4390 });
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/p\/lc-0001$/);
      expect(await (await fetch(new URL("/api/health", server.url))).json()).toEqual({ ok: true });
      expect(await (await fetch(server.url)).text()).toContain('<div id="root"></div>');
    } finally {
      await server.close();
    }
  });
});
```

- [ ] **Step 4: Run them to see them fail**

Run: `pnpm exec vitest run playground/tests/server`
Expected: FAIL: `Cannot find module '../../server/app.ts'` and `'../../start.ts'`.

- [ ] **Step 5: Create the server core**

Create `playground/server/validate.ts`:

```ts
import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";

/** zod validation for a request part; a bad request gets `400 { error }` with a readable message. */
export function valid<Target extends keyof ValidationTargets, Schema extends z.ZodType>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) return c.json({ error: z.prettifyError(result.error) }, 400);
  });
}
```

Create `playground/server/guard.ts`:

```ts
import type { MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";

const LOCAL_NAMES = new Set(["127.0.0.1", "localhost"]);
const SAFE_METHOD = /^(GET|HEAD|OPTIONS)$/;

/** `127.0.0.1:4173` or `localhost`, any port. A rebinding attack changes the name, not the port. */
export function isLocalHost(host: string | undefined): boolean {
  const name = host === undefined ? undefined : /^([^:]+)(?::\d+)?$/.exec(host)?.[1];
  return name !== undefined && LOCAL_NAMES.has(name);
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && LOCAL_NAMES.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Only this machine may use the API: the Host must be local (blocks DNS rebinding), and a write that says
 * where it comes from must come from a local page. hono/csrf alone only checks form-encoded requests.
 */
export const hostGuard: MiddlewareHandler = async (c, next) => {
  if (!isLocalHost(c.req.header("host"))) return c.json({ error: "Forbidden: not a local host" }, 403);
  const origin = c.req.header("origin");
  if (origin !== undefined && !SAFE_METHOD.test(c.req.method) && !isLocalOrigin(origin)) {
    return c.json({ error: "Forbidden: request from another site" }, 403);
  }
  await next();
};

/** Form posts from other sites (no Origin needed to reject them). */
export const formCsrf = csrf({ origin: (origin) => isLocalOrigin(origin) });
```

Create `playground/server/app.ts`:

```ts
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { contentRoot } from "../../runner/src/paths.ts";
import { formCsrf, hostGuard } from "./guard.ts";

export interface ServerContext {
  /** Folder that contains problems/ and concepts/. */
  root: string;
}

export function createApp(ctx: ServerContext) {
  const app = new Hono().use("/api/*", hostGuard, formCsrf).get("/api/health", (c) => c.json({ ok: true as const }, 200));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    console.error(error);
    return c.json({ error: error.message }, 500);
  });
  return app;
}

export type AppType = ReturnType<typeof createApp>;

/** The app Vite serves (@hono/vite-dev-server loads the default export). */
export default createApp({ root: contentRoot() });
```

(`ctx` is unused until Task 4 adds the first route that reads `ctx.root`.)

- [ ] **Step 6: Create the Vite config, the web entry and the CLI**

Create `playground/vite.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import devServer from "@hono/vite-dev-server";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = (file: string): string => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  root: here("./web"),
  plugins: [
    react(),
    tailwindcss(),
    // Only /api/* reaches Hono. Every other path is the React app: Vite answers app routes with index.html.
    devServer({ entry: here("./server/app.ts"), exclude: [/^(?!\/api(?:\/|\?|$))/], injectClientScript: false }),
  ],
});
```

Create `playground/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Algorithms playground</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Create `playground/web/main.tsx` (Task 8 replaces it with the real app):

```tsx
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(<p>Playground is starting…</p>);
```

Create `playground/start.ts`:

```ts
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import type { Target } from "../runner/src/types.ts";

export const DEFAULT_PORT = 4173;
const CONFIG = fileURLToPath(new URL("./vite.config.ts", import.meta.url));

/** App route of a problem or an exercise: /p/lc-0001 or /e/hash-map/01. */
export function routeFor(target: Target): string {
  return target.kind === "problem" ? `/p/${target.id}` : `/e/${target.id}`;
}

export interface Playground {
  url: string;
  close(): Promise<void>;
}

/** Starts the Vite dev server (React app + /api) on 127.0.0.1. Takes the next free port unless strictPort. */
export async function startPlayground(options: {
  route: string;
  open: boolean;
  port?: number;
  strictPort?: boolean;
}): Promise<Playground> {
  const server = await createServer({
    configFile: CONFIG,
    logLevel: "warn",
    server: {
      host: "127.0.0.1",
      port: options.port ?? DEFAULT_PORT,
      strictPort: options.strictPort ?? false,
      open: options.open ? options.route : false,
    },
  });
  await server.listen();
  const base = server.resolvedUrls?.local[0];
  if (!base) {
    await server.close();
    throw new Error("the playground server did not report its address");
  }
  return { url: new URL(options.route, base).href, close: () => server.close() };
}
```

Create `playground/cli.ts`:

```ts
import { parseArgs } from "node:util";
import { contentRoot } from "../runner/src/paths.ts";
import { listTargets, QueryError, resolveQuery } from "../runner/src/resolver.ts";
import { DEFAULT_PORT, routeFor, startPlayground } from "./start.ts";

const USAGE = `Usage: pnpm play [query] [--no-open] [--port <n>]

<query>: an id (lc-0001, hash-map/01), a LeetCode number (1), or part of a folder name (two-sum).`;

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    strict: true,
    options: { open: { type: "boolean", default: true }, port: { type: "string" } },
  });
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`--port must be a port number (got "${values.port}")`);
  const query = positionals.join(" ").trim();
  // Resolved before the server starts, so a bad query never leaves a server running.
  const route = query ? routeFor(resolveQuery(listTargets(contentRoot()), query)) : "/";
  const playground = await startPlayground({ route, open: values.open, port });
  process.stdout.write(`Playground: ${playground.url}  (Ctrl+C to stop)\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof QueryError) {
    const list = error.candidates.map((t) => `  ${t.id.padEnd(16)} ${t.title}`).join("\n");
    process.stderr.write(`${error.message}\n${list}${list ? "\n" : ""}`);
  } else {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}\n`);
  }
  process.exitCode = 1;
});
```

- [ ] **Step 7: Run the tests**

Run: `pnpm exec vitest run playground/tests/server`
Expected: PASS (2 files, 5 tests).

Run: `pnpm verify`
Expected: all tests pass, both `tsc` runs print nothing, `0 error(s)`.

- [ ] **Step 8: Smoke-test the real command**

```bash
pnpm play two-sum --no-open --port 4380 > /tmp/play.log 2>&1 &
sleep 5; cat /tmp/play.log; curl -s http://127.0.0.1:4380/api/health; echo
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: evil.com" http://127.0.0.1:4380/api/health
kill %1
```

Expected: `Playground: http://127.0.0.1:4380/p/lc-0001  (Ctrl+C to stop)`, then `{"ok":true}`, then `403`.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.ts playground/tsconfig.json playground/vite.config.ts playground/start.ts playground/cli.ts playground/server/validate.ts playground/server/guard.ts playground/server/app.ts playground/web/index.html playground/web/main.tsx playground/tests/web/setup.ts playground/tests/server/helpers.ts playground/tests/server/guard.test.ts playground/tests/server/cli.test.ts
git commit -m "feat(playground): serve a guarded API and the web app with pnpm play"
```

(`pnpm-workspace.yaml` only changes if Step 1 needed a new `allowBuilds` entry; `git add` of an unchanged file is harmless.)

---

### Task 4: API — home and target data

**Files:**
- Create: `playground/server/types.ts`, `playground/server/targets.ts`
- Modify: `playground/server/app.ts` (mount `targetRoutes`), `playground/tests/server/helpers.ts` (add `makeRepo`, `removeRepos`, `SUM_CASES`, `PY_SUM`)
- Test: `playground/tests/server/targets.test.ts`

**Interfaces:**
- Consumes: `scanRepo`, `isInProgress`, `str`, `strList`, `ProblemEntry`, `ExerciseEntry` (`lib/repo.ts`); `problemGroups` (`scripts/lib/render.ts`, Task 2); `listTargets` (`runner/src/resolver.ts`); `loadCaseFile`, `assertHiddenFilled`, `CaseFileError` (`runner/src/schema.ts`); `solutionPath` (`runner/src/stubs.ts`); `valid` (Task 3); fixture builders `put`, `problemReadme`, `conceptReadme`, `exerciseReadme` (`scripts/tests/fixture.ts`).
- Produces:
  - `playground/server/types.ts`: `ItemStatus`, `ConceptStatus`, `HomeProblem`, `HomeExercise`, `HomeConcept`, `HomeData`, `Signature`, `TargetData`, `SolutionData`, `ConceptData`, `RepoEvent`, `ApiErrorBody` (exact definitions below; Tasks 5–14 use them).
  - `playground/server/targets.ts`: `itemStatus(value)`, `conceptStatus(value)`, `findTarget(root, id): Target | null` (exact id only), `homeData(root): HomeData`, `targetData(root, target): TargetData`, `targetRoutes(root)` with `GET /home` and `GET /target?id=`.
  - `helpers.ts`: `SUM_CASES`, `PY_SUM`, `makeRepo(): string` (problems `lc-0001` solved/`arrays-hashing`/concept `hash-map`, `lc-0020` todo/`stack`; concept `hash-map` learning; exercise `hash-map/01` todo; all with `SUM_CASES`), `removeRepos()`.

- [ ] **Step 1: Add the repo builder to the test helpers**

Append to `playground/tests/server/helpers.ts`:

```ts
import { removeTemp, tempDir } from "../../../runner/tests/helpers.ts";
import { conceptReadme, exerciseReadme, problemReadme, put } from "../../../scripts/tests/fixture.ts";

export const SUM_CASES = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [
    { input: [[1, 2]], expected: 3 },
    { input: [[]], expected: 0 },
  ],
  hidden: [{ input: [[5, 5]], expected: 10 }],
};
export const PY_SUM = "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n";

const repos: string[] = [];

/** A small study repo inside the project (so TypeScript solutions resolve "lc"). removeRepos() deletes it. */
export function makeRepo(): string {
  const root = tempDir();
  repos.push(root);
  const cases = JSON.stringify(SUM_CASES);
  put(root, "problems/lc-0001-two-sum/README.md", problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved", solvedIn: ["py"] }));
  put(root, "problems/lc-0001-two-sum/cases.json", cases);
  put(root, "problems/lc-0020-valid-parentheses/README.md", problemReadme({ id: "lc-0020", title: "Valid Parentheses", slug: "valid-parentheses", patterns: ["stack"], concepts: [], status: "todo", solvedIn: [] }));
  put(root, "problems/lc-0020-valid-parentheses/cases.json", cases);
  put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", status: "learning", requires: [] }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", exerciseReadme({ id: "hash-map/01", title: "First repeat", concept: "hash-map", status: "todo", solvedIn: [] }));
  put(root, "concepts/hash-map/exercises/01-first-repeat/cases.json", cases);
  return root;
}

export function removeRepos(): void {
  for (const root of repos.splice(0)) removeTemp(root);
}
```

Move the two new `import` lines to the top of the file, next to the existing `import type { createApp }`.

- [ ] **Step 2: Write the failing test**

Create `playground/tests/server/targets.test.ts`:

```ts
import { writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, PY_SUM, removeRepos, SUM_CASES } from "./helpers.ts";

afterEach(removeRepos);

const json = async (res: Response) => ({ status: res.status, body: await res.json() });

describe("GET /api/home", () => {
  it("lists problems with status and in-progress, the pattern groups, and concepts with their exercises", async () => {
    const root = makeRepo();
    put(root, "problems/lc-0020-valid-parentheses/solution.py", PY_SUM);
    const { status, body } = await json(await call(createApp({ root }), "/api/home"));
    expect(status).toBe(200);
    expect(body.problems).toEqual([
      { id: "lc-0001", title: "Two Sum", difficulty: "easy", patterns: ["arrays-hashing"], status: "solved", inProgress: false, error: null },
      { id: "lc-0020", title: "Valid Parentheses", difficulty: "easy", patterns: ["stack"], status: "todo", inProgress: true, error: null },
    ]);
    expect(body.groups).toEqual([
      { pattern: "arrays-hashing", ids: ["lc-0001"] },
      { pattern: "stack", ids: ["lc-0020"] },
    ]);
    expect(body.concepts).toEqual([
      {
        slug: "hash-map",
        title: "Hash map",
        status: "learning",
        error: null,
        exercises: [{ id: "hash-map/01", title: "First repeat", status: "todo", inProgress: false, error: null }],
      },
    ]);
  });

  it("marks a README with broken frontmatter instead of failing", async () => {
    const root = makeRepo();
    put(root, "problems/lc-0030-broken/README.md", "---\ntitle: [unclosed\n---\n# Broken\n");
    const { body } = await json(await call(createApp({ root }), "/api/home"));
    const broken = body.problems.find((p: { id: string }) => p.id === "lc-0030");
    expect(broken.title).toBe("lc-0030-broken");
    expect(broken.error).toMatch(/^frontmatter:/);
  });

  it("works on an empty repo", async () => {
    const root = makeRepo();
    const empty = path.join(root, "empty");
    const { body } = await json(await call(createApp({ root: empty }), "/api/home"));
    expect(body).toEqual({ problems: [], groups: [], concepts: [] });
  });
});

describe("GET /api/target", () => {
  it("returns the statement without frontmatter, the signature and which solution files exist", async () => {
    const root = makeRepo();
    put(root, "problems/lc-0001-two-sum/solution.py", PY_SUM);
    const { status, body } = await json(await call(createApp({ root }), "/api/target?id=lc-0001"));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: "lc-0001",
      kind: "problem",
      title: "Two Sum",
      readme: "problems/lc-0001-two-sum/README.md",
      readmeError: null,
      difficulty: "easy",
      url: "https://leetcode.com/problems/two-sum/",
      status: "solved",
      hints: 0,
      signature: { mode: "function", entry: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int" },
      exampleInput: [[1, 2]],
      caseError: null,
      solutions: { py: true, ts: false },
    });
    expect(body.markdown).toMatch(/^# Two Sum\n/);
    expect(body.markdown).not.toContain("status: solved");
  });

  it("finds an exercise by its id", async () => {
    const { body } = await json(await call(createApp({ root: makeRepo() }), "/api/target?id=hash-map%2F01"));
    expect(body).toMatchObject({ id: "hash-map/01", kind: "exercise", title: "First repeat", difficulty: null, url: null, status: "todo" });
  });

  it("reports a broken cases.json and hidden cases that have no expected value", async () => {
    const root = makeRepo();
    writeFileSync(path.join(root, "problems/lc-0001-two-sum/cases.json"), "{ nope");
    writeFileSync(
      path.join(root, "problems/lc-0020-valid-parentheses/cases.json"),
      JSON.stringify({ ...SUM_CASES, hidden: [{ input: [[1]] }] }),
    );
    const app = createApp({ root });
    const broken = (await json(await call(app, "/api/target?id=lc-0001"))).body;
    expect(broken.signature).toBeNull();
    expect(broken.caseError).toMatch(/cases\.json is invalid/);
    const unfilled = (await json(await call(app, "/api/target?id=lc-0020"))).body;
    expect(unfilled.signature).not.toBeNull();
    expect(unfilled.caseError).toContain("pnpm fill-expected");
  });

  it("answers 404 for anything that is not an exact id, and 400 without an id", async () => {
    const app = createApp({ root: makeRepo() });
    for (const id of ["lc-9999", "two-sum", "1", "../../etc", "lc-0001-two-sum"]) {
      expect((await call(app, `/api/target?id=${encodeURIComponent(id)}`)).status, id).toBe(404);
    }
    expect((await call(app, "/api/target")).status).toBe(400);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/server/targets.test.ts`
Expected: FAIL with `404` responses (no `/api/home` route yet).

- [ ] **Step 4: Create `playground/server/types.ts`**

```ts
import type { Lang, Param } from "../../runner/src/types.ts";

export type ItemStatus = "todo" | "solving" | "solved" | "revealed";
export type ConceptStatus = "new" | "learning" | "mastered";

export interface HomeProblem {
  id: string;
  title: string;
  difficulty: string | null;
  patterns: string[];
  status: ItemStatus;
  inProgress: boolean;
  /** README missing or its frontmatter unparsable. */
  error: string | null;
}

export interface HomeExercise {
  id: string;
  title: string;
  status: ItemStatus;
  inProgress: boolean;
  error: string | null;
}

export interface HomeConcept {
  slug: string;
  title: string;
  status: ConceptStatus;
  error: string | null;
  exercises: HomeExercise[];
}

export interface HomeData {
  problems: HomeProblem[];
  /** Same grouping as INDEX.md: patterns sorted, a problem under each of its patterns. */
  groups: { pattern: string; ids: string[] }[];
  concepts: HomeConcept[];
}

export interface Signature {
  mode: "function" | "class";
  entry: string;
  params: Param[];
  returns: string | null;
}

export interface TargetData {
  id: string;
  kind: "problem" | "exercise";
  title: string;
  /** Repo-relative README path, for resolving the links inside it. */
  readme: string;
  /** README body without the frontmatter ("" when readmeError is set). */
  markdown: string;
  readmeError: string | null;
  difficulty: string | null;
  url: string | null;
  status: ItemStatus;
  hints: number;
  /** null when cases.json is invalid. */
  signature: Signature | null;
  /** Input of Example 1, to fill the custom input (null when there is none). */
  exampleInput: unknown;
  /** Invalid cases.json, or hidden cases without expected values. */
  caseError: string | null;
  solutions: Record<Lang, boolean>;
}

export interface SolutionData {
  code: string;
  /** Content hash: equal versions mean equal bytes. */
  version: string;
}

export interface ConceptData {
  slug: string;
  title: string;
  status: ConceptStatus;
  readme: string;
  /** README body up to the "## My explanation" heading (the whole body when the section is missing). */
  before: string;
  /** The user's text without the section's leading HTML comments; null when the section is missing. */
  explanation: string | null;
  /** From the next heading to the end ("" when the section is last or missing). */
  after: string;
  /** Version of the whole README file. */
  version: string;
  readmeError: string | null;
}

export type RepoEvent =
  | { kind: "solution"; target: string; lang: Lang; version: string }
  | { kind: "readme"; target?: string; concept?: string }
  | { kind: "cases" | "stress"; target: string };

export interface ApiErrorBody {
  error: string;
  issues?: string[];
}
```

- [ ] **Step 5: Create `playground/server/targets.ts`**

```ts
import { existsSync } from "node:fs";
import { Hono } from "hono";
import { z } from "zod";
import { isInProgress, scanRepo, str, strList } from "../../lib/repo.ts";
import { listTargets } from "../../runner/src/resolver.ts";
import { assertHiddenFilled, CaseFileError, loadCaseFile } from "../../runner/src/schema.ts";
import { solutionPath } from "../../runner/src/stubs.ts";
import type { Target } from "../../runner/src/types.ts";
import { problemGroups } from "../../scripts/lib/render.ts";
import type { ConceptStatus, HomeData, ItemStatus, TargetData } from "./types.ts";
import { valid } from "./validate.ts";

const ITEM_STATUSES: readonly ItemStatus[] = ["todo", "solving", "solved", "revealed"];
const CONCEPT_STATUSES: readonly ConceptStatus[] = ["new", "learning", "mastered"];

export function itemStatus(value: unknown): ItemStatus {
  return ITEM_STATUSES.find((status) => status === value) ?? "todo";
}

export function conceptStatus(value: unknown): ConceptStatus {
  return CONCEPT_STATUSES.find((status) => status === value) ?? "new";
}

/** The problem or exercise with exactly this id. Never a fuzzy match: ids come from the app, not from a person. */
export function findTarget(root: string, id: string): Target | null {
  return listTargets(root).find((target) => target.id === id) ?? null;
}

export function homeData(root: string): HomeData {
  const repo = scanRepo(root);
  return {
    problems: repo.problems.map((p) => ({
      id: p.folderId,
      title: str(p.data.title, p.folder),
      difficulty: str(p.data.difficulty) || null,
      patterns: strList(p.data.patterns),
      status: itemStatus(p.data.status),
      inProgress: isInProgress(p),
      error: p.error,
    })),
    groups: problemGroups(repo).map((group) => ({ pattern: group.pattern, ids: group.problems.map((p) => p.folderId) })),
    concepts: repo.concepts.map((c) => ({
      slug: c.slug,
      title: str(c.data.title, c.slug),
      status: conceptStatus(c.data.status),
      error: c.error,
      exercises: repo.exercises
        .filter((e) => e.concept === c.slug)
        .map((e) => ({
          id: e.folderId,
          title: str(e.data.title, e.folder),
          status: itemStatus(e.data.status),
          inProgress: isInProgress(e),
          error: e.error,
        })),
    })),
  };
}

export function targetData(root: string, target: Target): TargetData {
  const repo = scanRepo(root);
  const entry = [...repo.problems, ...repo.exercises].find((e) => e.dir === target.dir);
  const data = entry?.data ?? {};
  let signature: TargetData["signature"] = null;
  let exampleInput: unknown = null;
  let caseError: string | null = null;
  try {
    const cf = loadCaseFile(target.dir);
    signature = { mode: cf.mode, entry: cf.entry, params: cf.params, returns: cf.returns };
    exampleInput = cf.examples[0]?.input ?? null;
    assertHiddenFilled(cf);
  } catch (error) {
    if (!(error instanceof CaseFileError)) throw error;
    caseError = error.message;
  }
  return {
    id: target.id,
    kind: target.kind,
    title: target.title,
    readme: entry?.rel ?? "",
    markdown: entry && !entry.error ? entry.body : "",
    readmeError: entry ? entry.error : "README.md is missing",
    difficulty: str(data.difficulty) || null,
    url: str(data.url) || null,
    status: itemStatus(data.status),
    hints: typeof data.hints === "number" ? data.hints : 0,
    signature,
    exampleInput,
    caseError,
    solutions: { py: existsSync(solutionPath(target.dir, "py")), ts: existsSync(solutionPath(target.dir, "ts")) },
  };
}

export const unknownTarget = (id: string) => ({ error: `There is no problem or exercise with id "${id}".` });

export function targetRoutes(root: string) {
  return new Hono()
    .get("/home", (c) => c.json(homeData(root), 200))
    .get("/target", valid("query", z.object({ id: z.string().min(1) })), (c) => {
      const { id } = c.req.valid("query");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      return c.json(targetData(root, target), 200);
    });
}
```

- [ ] **Step 6: Mount the routes**

In `playground/server/app.ts`, add `import { targetRoutes } from "./targets.ts";` and extend the chain:

```ts
  const app = new Hono()
    .use("/api/*", hostGuard, formCsrf)
    .get("/api/health", (c) => c.json({ ok: true as const }, 200))
    .route("/api", targetRoutes(ctx.root));
```

- [ ] **Step 7: Run the tests**

Run: `pnpm exec vitest run playground/tests/server`
Expected: PASS.

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add playground/server/types.ts playground/server/targets.ts playground/server/app.ts playground/tests/server/helpers.ts playground/tests/server/targets.test.ts
git commit -m "feat(playground): serve home and target data"
```

---

### Task 5: API — solutions, runs and custom runs

**Files:**
- Create: `playground/server/solutions.ts`
- Modify: `playground/server/app.ts` (mount `solutionRoutes`)
- Test: `playground/tests/server/solutions.test.ts`

**Interfaces:**
- Consumes: `findTarget`, `unknownTarget` (Task 4); `runTarget` (`runner/src/run.ts`); `runCustom`, `CustomInputError` (Task 1); `loadCaseFile`, `CaseFileError`; `ensureSolution`, `solutionPath`; `valid` (Task 3); `SolutionData` (Task 4).
- Produces:
  - `contentVersion(text: string): string`: first 16 hex characters of the SHA-256 of the UTF-8 bytes.
  - `readSolution(target, lang): SolutionData`: creates the stub first when the file is missing; throws `CaseFileError` when it cannot.
  - `type WriteResult = { ok: true; version: string } | { ok: false; current: SolutionData }`, `writeSolution(target, lang, code, baseVersion): WriteResult`.
  - `solutionRoutes(root)`: `GET /solution?id=&lang=` → `200 SolutionData` | `404` | `422 { error }`; `PUT /solution { id, lang, code, baseVersion }` → `200 { version }` | `409 SolutionData` | `404`; `POST /run { id, lang }` → `200 RunResult` | `404` | `422 { error }`; `POST /run-custom { id, lang, input }` → `200 CustomResult` | `404` | `422 { error, issues? }`.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/server/solutions.test.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, PY_SUM, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

const SOLUTION = "problems/lc-0001-two-sum/solution.py";

describe("GET/PUT /api/solution", () => {
  it("creates the stub on first read, then saves new code when the version matches", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await (await call(app, "/api/solution?id=lc-0001&lang=py")).json();
    expect(first.code).toContain("def solve(self, nums: list[int]) -> int:");
    expect(readFileSync(path.join(root, SOLUTION), "utf8")).toBe(first.code);

    const saved = await call(app, "/api/solution", {
      method: "PUT",
      json: { id: "lc-0001", lang: "py", code: PY_SUM, baseVersion: first.version },
    });
    expect(saved.status).toBe(200);
    const { version } = await saved.json();
    expect(readFileSync(path.join(root, SOLUTION), "utf8")).toBe(PY_SUM);
    expect(await (await call(app, "/api/solution?id=lc-0001&lang=py")).json()).toEqual({ code: PY_SUM, version });
  });

  it("never overwrites a file that changed on disk, and returns what is there", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await (await call(app, "/api/solution?id=lc-0001&lang=py")).json();
    writeFileSync(path.join(root, SOLUTION), "# edited in VS Code\n");
    const res = await call(app, "/api/solution", {
      method: "PUT",
      json: { id: "lc-0001", lang: "py", code: PY_SUM, baseVersion: first.version },
    });
    expect(res.status).toBe(409);
    const current = await res.json();
    expect(current.code).toBe("# edited in VS Code\n");
    expect(current.version).not.toBe(first.version);
    expect(readFileSync(path.join(root, SOLUTION), "utf8")).toBe("# edited in VS Code\n");
  });

  it("keeps Spanish and emoji text byte for byte", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await (await call(app, "/api/solution?id=lc-0001&lang=py")).json();
    const code = "# ñandú 🎵 — café\nclass Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)  # «suma»\n";
    const { version } = await (
      await call(app, "/api/solution", { method: "PUT", json: { id: "lc-0001", lang: "py", code, baseVersion: first.version } })
    ).json();
    expect(readFileSync(path.join(root, SOLUTION))).toEqual(Buffer.from(code, "utf8"));
    expect(await (await call(app, "/api/solution?id=lc-0001&lang=py")).json()).toEqual({ code, version });
  });

  it("answers 422 when the stub cannot be made from a broken cases.json, 404 for unknown ids, 400 for a bad language", async () => {
    const root = makeRepo();
    writeFileSync(path.join(root, "problems/lc-0001-two-sum/cases.json"), "{ nope");
    const app = createApp({ root });
    const broken = await call(app, "/api/solution?id=lc-0001&lang=py");
    expect(broken.status).toBe(422);
    expect((await broken.json()).error).toMatch(/cases\.json is invalid/);
    expect((await call(app, "/api/solution?id=lc-9999&lang=py")).status).toBe(404);
    expect((await call(app, "/api/solution?id=lc-0001&lang=rs")).status).toBe(400);
  });
});

describe("POST /api/run", () => {
  it("returns the engine's RunResult", async () => {
    const root = makeRepo();
    put(root, SOLUTION, PY_SUM);
    const res = await call(createApp({ root }), "/api/run", { json: { id: "lc-0001", lang: "py" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "lc-0001",
      lang: "py",
      fatal: null,
      examples: { passed: 2, total: 2 },
      hidden: { status: "pass", passed: 1, total: 1, firstFailure: null },
      green: true,
    });
  });

  it("answers 422 for a broken cases.json", async () => {
    const root = makeRepo();
    put(root, SOLUTION, PY_SUM);
    writeFileSync(path.join(root, "problems/lc-0001-two-sum/cases.json"), "{ nope");
    const res = await call(createApp({ root }), "/api/run", { json: { id: "lc-0001", lang: "py" } });
    expect(res.status).toBe(422);
  });
});

describe("POST /api/run-custom", () => {
  it("runs one input without judging it", async () => {
    const root = makeRepo();
    put(root, SOLUTION, "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        print(len(nums))\n        return sum(nums)\n");
    const res = await call(createApp({ root }), "/api/run-custom", { json: { id: "lc-0001", lang: "py", input: [[7, 8]] } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ fatal: null, output: 15, stdout: "2\n" });
  });

  it("lists the issues when the input does not fit the signature, and needs an input", async () => {
    const app = createApp({ root: makeRepo() });
    const res = await call(app, "/api/run-custom", { json: { id: "lc-0001", lang: "py", input: [[1], 2] } });
    expect(res.status).toBe(422);
    expect((await res.json()).issues).toEqual(["custom.input: expected 1 params, got 2"]);
    expect((await call(app, "/api/run-custom", { json: { id: "lc-0001", lang: "py" } })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/server/solutions.test.ts`
Expected: FAIL with `404` responses.

- [ ] **Step 3: Create `playground/server/solutions.ts`**

```ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Hono } from "hono";
import { z } from "zod";
import { CustomInputError, runCustom } from "../../runner/src/custom.ts";
import { runTarget } from "../../runner/src/run.ts";
import { CaseFileError, loadCaseFile } from "../../runner/src/schema.ts";
import { ensureSolution, solutionPath } from "../../runner/src/stubs.ts";
import type { Lang, Target } from "../../runner/src/types.ts";
import { findTarget, unknownTarget } from "./targets.ts";
import type { SolutionData } from "./types.ts";
import { valid } from "./validate.ts";

/** Short content hash: two reads give the same version exactly when the bytes are the same. */
export function contentVersion(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

/** Reads solution.<lang>, creating the stub first when it is missing (throws CaseFileError when it cannot). */
export function readSolution(target: Target, lang: Lang): SolutionData {
  const file = solutionPath(target.dir, lang);
  if (!existsSync(file)) ensureSolution(target.dir, loadCaseFile(target.dir), lang);
  const code = readFileSync(file, "utf8");
  return { code, version: contentVersion(code) };
}

export type WriteResult = { ok: true; version: string } | { ok: false; current: SolutionData };

/**
 * Writes only when the file on disk is still the version the editor started from.
 * Read, compare and write are synchronous, so two saves can never interleave.
 */
export function writeSolution(target: Target, lang: Lang, code: string, baseVersion: string): WriteResult {
  const file = solutionPath(target.dir, lang);
  const disk = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (contentVersion(disk) !== baseVersion) return { ok: false, current: { code: disk, version: contentVersion(disk) } };
  writeFileSync(file, code);
  return { ok: true, version: contentVersion(code) };
}

const id = z.string().min(1);
const lang = z.enum(["py", "ts"]);

export function solutionRoutes(root: string) {
  return new Hono()
    .get("/solution", valid("query", z.object({ id, lang })), (c) => {
      const query = c.req.valid("query");
      const target = findTarget(root, query.id);
      if (!target) return c.json(unknownTarget(query.id), 404);
      try {
        return c.json(readSolution(target, query.lang), 200);
      } catch (error) {
        if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
        throw error;
      }
    })
    .put("/solution", valid("json", z.object({ id, lang, code: z.string(), baseVersion: z.string() })), (c) => {
      const body = c.req.valid("json");
      const target = findTarget(root, body.id);
      if (!target) return c.json(unknownTarget(body.id), 404);
      const result = writeSolution(target, body.lang, body.code, body.baseVersion);
      return result.ok ? c.json({ version: result.version }, 200) : c.json(result.current, 409);
    })
    .post("/run", valid("json", z.object({ id, lang })), async (c) => {
      const body = c.req.valid("json");
      const target = findTarget(root, body.id);
      if (!target) return c.json(unknownTarget(body.id), 404);
      try {
        return c.json(await runTarget(target, body.lang, { root }), 200);
      } catch (error) {
        if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
        throw error;
      }
    })
    .post(
      "/run-custom",
      valid("json", z.object({ id, lang, input: z.unknown().refine((value) => value !== undefined, "input is required") })),
      async (c) => {
        const body = c.req.valid("json");
        const target = findTarget(root, body.id);
        if (!target) return c.json(unknownTarget(body.id), 404);
        try {
          return c.json(await runCustom(target, body.lang, body.input), 200);
        } catch (error) {
          if (error instanceof CustomInputError) return c.json({ error: error.message, issues: error.issues }, 422);
          if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
          throw error;
        }
      },
    );
}
```

- [ ] **Step 4: Mount the routes**

In `playground/server/app.ts`, add `import { solutionRoutes } from "./solutions.ts";` and append `.route("/api", solutionRoutes(ctx.root))` to the chain after `targetRoutes`.

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run playground/tests/server`
Expected: PASS.

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add playground/server/solutions.ts playground/server/app.ts playground/tests/server/solutions.test.ts
git commit -m "feat(playground): read and save solutions and run the tests from the API"
```

---

### Task 6: API — concepts and "My explanation"

**Files:**
- Create: `playground/server/explanation.ts`, `playground/server/concepts.ts`
- Modify: `playground/server/app.ts` (mount `conceptRoutes`)
- Test: `playground/tests/server/explanation.test.ts`, `playground/tests/server/concepts.test.ts`, `playground/tests/server/spoiler.test.ts`

**Interfaces:**
- Consumes: `scanRepo`, `str`, `ConceptEntry` (`lib/repo.ts`); `parseMarkdown` (`lib/frontmatter.ts`: `{ head, data, body }`, where `head` includes both `---` fences and the trailing newline); `contentVersion` (Task 5); `conceptStatus` (Task 4); `valid`; `ConceptData`.
- Produces:
  - `explanation.ts`: `EXPLANATION_HEADING = "My explanation"`, `interface ExplanationSplit { before; heading; comments: string[]; text; after }`, `splitExplanation(body): ExplanationSplit | null`, `joinExplanation(split, text): string`, `explanationIssues(split, text): string[]`.
  - `concepts.ts`: `findConcept(root, slug): ConceptEntry | null` (exact slug), `conceptData(concept): ConceptData`, `conceptRoutes(root)` with `GET /concept?slug=` → `200 ConceptData` | `404`, and `PUT /concept/explanation { slug, text, baseVersion }` → `200 { version }` | `409 ConceptData` | `422 { error, issues? }` | `404`.

The fixture concept README (`conceptReadme` in `scripts/tests/fixture.ts`) has this body after its frontmatter:

```
# Hash map

## Intuition

An analogy.

## Exercises

<!-- auto:exercises -->
<!-- /auto -->

## My explanation

<!-- USER: in your own words -->

## Problems

<!-- auto:problems -->
<!-- /auto -->
```

- [ ] **Step 1: Write the failing unit test**

Create `playground/tests/server/explanation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { explanationIssues, joinExplanation, splitExplanation } from "../../server/explanation.ts";

const BODY =
  "# Hash map\n\n## Intuition\n\nAn analogy.\n\n## My explanation\n\n<!-- USER: in your own words -->\n\n## Problems\n\n- one\n";

describe("splitExplanation", () => {
  it("cuts the body around the section and gives it back unchanged when joined with the same text", () => {
    const split = splitExplanation(BODY)!;
    expect(split).toEqual({
      before: "# Hash map\n\n## Intuition\n\nAn analogy.\n\n",
      heading: "## My explanation",
      comments: ["<!-- USER: in your own words -->"],
      text: "",
      after: "## Problems\n\n- one\n",
    });
    expect(joinExplanation(split, "")).toBe(BODY);
  });

  it("ignores a '## My explanation' line inside a code block", () => {
    const body = "# X\n\n```md\n## My explanation\n```\n\n## Other\n";
    expect(splitExplanation(body)).toBeNull();
  });

  it("keeps a '## ' line inside a code block as part of the text", () => {
    const text = "Example:\n\n```md\n## not a heading\n```";
    const split = splitExplanation(BODY)!;
    const joined = joinExplanation(split, text);
    expect(splitExplanation(joined)!.text).toBe(text);
    expect(splitExplanation(joined)!.after).toBe(split.after);
  });
});

describe("explanationIssues", () => {
  const split = splitExplanation(BODY)!;

  it("accepts prose, lists and ### headings", () => {
    expect(explanationIssues(split, "A hash map turns keys into positions.\n\n### Cost\n\n- O(1) average")).toEqual([]);
  });

  it("rejects headings that would end the section, auto markers and an open code block", () => {
    expect(explanationIssues(split, "## Mine")[0]).toMatch(/### or deeper/);
    expect(explanationIssues(split, "# Mine")[0]).toMatch(/### or deeper/);
    expect(explanationIssues(split, "Title\n---")[0]).toMatch(/### or deeper/);
    expect(explanationIssues(split, "<!-- /auto -->")[0]).toMatch(/auto/);
    expect(explanationIssues(split, "```python\nx = 1")[0]).toMatch(/code block/);
  });
});
```

- [ ] **Step 2: Write the failing route tests**

Create `playground/tests/server/concepts.test.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { createApp } from "../../server/app.ts";
import { contentVersion } from "../../server/solutions.ts";
import { call, makeRepo, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

const README = "concepts/hash-map/README.md";
const putExplanation = async (app: ReturnType<typeof createApp>, text: string, baseVersion: string) =>
  call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "hash-map", text, baseVersion } });

describe("GET /api/concept", () => {
  it("returns the note split around My explanation, and the README version", async () => {
    const root = makeRepo();
    const res = await call(createApp({ root }), "/api/concept?slug=hash-map");
    expect(res.status).toBe(200);
    const concept = await res.json();
    expect(concept).toMatchObject({ slug: "hash-map", title: "Hash map", status: "learning", readme: README, explanation: "", readmeError: null });
    expect(concept.before).toMatch(/^# Hash map\n\n## Intuition/);
    expect(concept.before).not.toContain("My explanation");
    expect(concept.after).toBe("## Problems\n\n<!-- auto:problems -->\n<!-- /auto -->\n");
    expect(concept.version).toBe(contentVersion(readFileSync(path.join(root, README), "utf8")));
  });

  it("answers 404 for unknown slugs", async () => {
    const app = createApp({ root: makeRepo() });
    for (const slug of ["nope", "../hash-map", "hash"]) {
      expect((await call(app, `/api/concept?slug=${encodeURIComponent(slug)}`)).status, slug).toBe(404);
    }
  });
});

describe("PUT /api/concept/explanation", () => {
  it("replaces only the section's text: every other byte of the README stays the same", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const original = readFileSync(path.join(root, README), "utf8");
    const res = await putExplanation(app, "A hash map turns keys into positions.", contentVersion(original));
    expect(res.status).toBe(200);
    const updated = readFileSync(path.join(root, README), "utf8");
    expect(updated).toBe(
      original.replace(
        "<!-- USER: in your own words -->\n\n## Problems",
        "<!-- USER: in your own words -->\n\nA hash map turns keys into positions.\n\n## Problems",
      ),
    );
    expect((await res.json()).version).toBe(contentVersion(updated));
    expect((await (await call(app, "/api/concept?slug=hash-map")).json()).explanation).toBe("A hash map turns keys into positions.");
  });

  it("keeps Spanish and emoji text byte for byte", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const text = "Un mapa hash es como el guardarropa 🎟️: la clave da la posición. ¡Ñandú!";
    const version = contentVersion(readFileSync(path.join(root, README), "utf8"));
    expect((await putExplanation(app, text, version)).status).toBe(200);
    expect(readFileSync(path.join(root, README)).includes(Buffer.from(text, "utf8"))).toBe(true);
    expect((await (await call(app, "/api/concept?slug=hash-map")).json()).explanation).toBe(text);
  });

  it("works when the section is the last one and the file has no trailing newline", async () => {
    const root = makeRepo();
    const original = "---\nslug: last\ntitle: Last\nstatus: new\nrequires: []\nrelated: []\n---\n# Last\n\n## Intuition\n\nx\n\n## My explanation\n\n<!-- c -->";
    put(root, "concepts/last/README.md", original);
    const res = await call(createApp({ root }), "/api/concept/explanation", {
      method: "PUT",
      json: { slug: "last", text: "Mine.", baseVersion: contentVersion(original) },
    });
    expect(res.status).toBe(200);
    expect(readFileSync(path.join(root, "concepts/last/README.md"), "utf8")).toBe(`${original}\n\nMine.\n`);
  });

  it("rejects text that would break the README, and leaves the file alone", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const original = readFileSync(path.join(root, README), "utf8");
    for (const text of ["## Mine", "Title\n---", "<!-- auto:problems -->", "```python\nx = 1"]) {
      const res = await putExplanation(app, text, contentVersion(original));
      expect(res.status, text).toBe(422);
      expect((await res.json()).issues.length, text).toBeGreaterThan(0);
    }
    expect(readFileSync(path.join(root, README), "utf8")).toBe(original);
  });

  it("answers 409 with the fresh concept when the README changed since it was loaded", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const stale = contentVersion(readFileSync(path.join(root, README), "utf8"));
    writeFileSync(path.join(root, README), readFileSync(path.join(root, README), "utf8").replace("An analogy.", "A better analogy."));
    const res = await putExplanation(app, "Mine.", stale);
    expect(res.status).toBe(409);
    const fresh = await res.json();
    expect(fresh.before).toContain("A better analogy.");
    expect(fresh.version).not.toBe(stale);
  });

  it("answers 422 when the README has no My explanation section, and 404 for unknown slugs", async () => {
    const root = makeRepo();
    const text = "---\nslug: bare\ntitle: Bare\nstatus: new\nrequires: []\nrelated: []\n---\n# Bare\n\n## Intuition\n\nx\n";
    put(root, "concepts/bare/README.md", text);
    const app = createApp({ root });
    const concept = await (await call(app, "/api/concept?slug=bare")).json();
    expect(concept.explanation).toBeNull();
    expect(concept.before).toBe("# Bare\n\n## Intuition\n\nx\n");
    const res = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "bare", text: "x", baseVersion: contentVersion(text) } });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("pnpm check");
    const missing = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "nope", text: "x", baseVersion: "0" } });
    expect(missing.status).toBe(404);
  });
});
```

Create `playground/tests/server/spoiler.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { problemReadme, put } from "../../../scripts/tests/fixture.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

const SECRET = "SECRET-4242";
const ECHO = {
  entry: "echo",
  params: [{ name: "s", type: "string" }],
  returns: "string",
  examples: [{ input: ["a"], expected: "a" }],
  hidden: [{ input: ["b"], expected: SECRET }],
};

function echoProblem(root: string, folder: string, id: string, solution: string): void {
  put(root, `problems/${folder}/README.md`, problemReadme({ id, title: folder, slug: folder, patterns: ["strings"], concepts: [], status: "solving", solvedIn: [] }));
  put(root, `problems/${folder}/cases.json`, JSON.stringify(ECHO));
  put(root, `problems/${folder}/solution.py`, solution);
}

describe("anti-spoiler", () => {
  it("no route ever sends the expected value of a hidden case", async () => {
    const root = makeRepo();
    echoProblem(root, "lc-0100-echo-fail", "lc-0100", "class Solution:\n    def echo(self, s: str) -> str:\n        return s\n");
    // Builds the answer at run time, so the secret is not in the source either.
    echoProblem(root, "lc-0101-echo-pass", "lc-0101", "class Solution:\n    def echo(self, s: str) -> str:\n        return 'SECRET-' + str(4242) if s == 'b' else s\n");
    const app = createApp({ root });
    const responses = await Promise.all([
      call(app, "/api/home"),
      call(app, "/api/target?id=lc-0100"),
      call(app, "/api/target?id=lc-0101"),
      call(app, "/api/solution?id=lc-0100&lang=py"),
      call(app, "/api/solution?id=lc-0101&lang=py"),
      call(app, "/api/run", { json: { id: "lc-0100", lang: "py" } }),
      call(app, "/api/run", { json: { id: "lc-0101", lang: "py" } }),
      call(app, "/api/run-custom", { json: { id: "lc-0100", lang: "py", input: ["z"] } }),
      call(app, "/api/concept?slug=hash-map"),
    ]);
    const texts = await Promise.all(responses.map((res) => res.text()));
    expect(JSON.parse(texts[5]).hidden.status).toBe("fail");
    expect(JSON.parse(texts[6]).hidden.status).toBe("pass");
    for (const text of texts) expect(text).not.toContain(SECRET);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm exec vitest run playground/tests/server/explanation.test.ts playground/tests/server/concepts.test.ts playground/tests/server/spoiler.test.ts`
Expected: FAIL: `explanation.ts` does not exist and `/api/concept` answers 404.

- [ ] **Step 4: Create `playground/server/explanation.ts`**

```ts
import type { RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";

export const EXPLANATION_HEADING = "My explanation";

/** A README body cut around its "## My explanation" section. joinExplanation(split, split.text) gives the body back. */
export interface ExplanationSplit {
  /** Everything before the heading. */
  before: string;
  /** The heading line as written. */
  heading: string;
  /** HTML comments at the start of the section (the "write it yourself" note). */
  comments: string[];
  /** The user's text, trimmed. */
  text: string;
  /** From the next heading of depth ≤ 2 to the end ("" when the section is last). */
  after: string;
}

const startOf = (node: RootContent): number => node.position!.start.offset!;
const endOf = (node: RootContent): number => node.position!.end.offset!;
const isComment = (node: RootContent): boolean => node.type === "html" && /^<!--[\s\S]*-->$/.test(node.value.trim());
const endsSection = (node: RootContent): boolean => node.type === "heading" && node.depth <= 2;

/** Finds the section from the real Markdown structure, so a "## " line inside a code block is not a heading. */
export function splitExplanation(body: string): ExplanationSplit | null {
  const nodes = fromMarkdown(body).children;
  const index = nodes.findIndex(
    (node) => node.type === "heading" && node.depth === 2 && toString(node, { includeHtml: false }).trim() === EXPLANATION_HEADING,
  );
  if (index < 0) return null;
  const next = nodes.findIndex((node, i) => i > index && endsSection(node));
  const sectionEnd = next < 0 ? body.length : startOf(nodes[next]);
  const inner = nodes.slice(index + 1, next < 0 ? undefined : next);
  let first = 0;
  while (first < inner.length && isComment(inner[first])) first++;
  const textStart = first < inner.length ? startOf(inner[first]) : sectionEnd;
  return {
    before: body.slice(0, startOf(nodes[index])),
    heading: body.slice(startOf(nodes[index]), endOf(nodes[index])),
    comments: inner.slice(0, first).map((node) => body.slice(startOf(node), endOf(node))),
    text: body.slice(textStart, sectionEnd).trim(),
    after: body.slice(sectionEnd),
  };
}

/** The body with the section's text replaced. The heading, the leading comments and everything else are kept. */
export function joinExplanation(split: ExplanationSplit, text: string): string {
  const blocks = [split.heading, ...split.comments, ...(text.trim() ? [text.trim()] : [])];
  return `${split.before}${blocks.join("\n\n")}${split.after ? "\n\n" : "\n"}${split.after}`;
}

/** Why `text` cannot be saved into the section, or [] when it can. */
export function explanationIssues(split: ExplanationSplit, text: string): string[] {
  const issues: string[] = [];
  if (fromMarkdown(text).children.some(endsSection)) {
    issues.push("Use ### or deeper for headings: a # or ## heading (or a line of --- under text) would end the section.");
  }
  if (/<!--\s*\/?auto/.test(text)) issues.push("Remove the <!-- auto --> markers: those blocks belong to pnpm sync.");
  if (issues.length === 0) {
    const again = splitExplanation(joinExplanation(split, text));
    if (!again || again.before !== split.before || again.after !== split.after) {
      issues.push("The text would change the rest of the README. Is a code block left open (``` without its closing ```)?");
    }
  }
  return issues;
}
```

- [ ] **Step 5: Create `playground/server/concepts.ts`**

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Hono } from "hono";
import { z } from "zod";
import { parseMarkdown } from "../../lib/frontmatter.ts";
import { type ConceptEntry, scanRepo, str } from "../../lib/repo.ts";
import { explanationIssues, joinExplanation, splitExplanation } from "./explanation.ts";
import { contentVersion } from "./solutions.ts";
import { conceptStatus } from "./targets.ts";
import type { ConceptData } from "./types.ts";
import { valid } from "./validate.ts";

/** The concept with exactly this slug. */
export function findConcept(root: string, slug: string): ConceptEntry | null {
  return scanRepo(root).concepts.find((concept) => concept.slug === slug) ?? null;
}

const readRaw = (concept: ConceptEntry): string => (existsSync(concept.readme) ? readFileSync(concept.readme, "utf8") : "");

export function conceptData(concept: ConceptEntry): ConceptData {
  const base = {
    slug: concept.slug,
    title: str(concept.data.title, concept.slug),
    status: conceptStatus(concept.data.status),
    readme: concept.rel,
    version: contentVersion(readRaw(concept)),
  };
  if (concept.error) return { ...base, readmeError: concept.error, before: "", explanation: null, after: "" };
  const split = splitExplanation(concept.body);
  if (!split) return { ...base, readmeError: null, before: concept.body, explanation: null, after: "" };
  return { ...base, readmeError: null, before: split.before, explanation: split.text, after: split.after };
}

const unknownConcept = (slug: string) => ({ error: `There is no concept "${slug}".` });

export function conceptRoutes(root: string) {
  return new Hono()
    .get("/concept", valid("query", z.object({ slug: z.string().min(1) })), (c) => {
      const { slug } = c.req.valid("query");
      const concept = findConcept(root, slug);
      if (!concept) return c.json(unknownConcept(slug), 404);
      return c.json(conceptData(concept), 200);
    })
    .put(
      "/concept/explanation",
      valid("json", z.object({ slug: z.string().min(1), text: z.string(), baseVersion: z.string() })),
      (c) => {
        const request = c.req.valid("json");
        const concept = findConcept(root, request.slug);
        if (!concept) return c.json(unknownConcept(request.slug), 404);
        const raw = readRaw(concept);
        if (contentVersion(raw) !== request.baseVersion) return c.json(conceptData(concept), 409);
        if (concept.error) return c.json({ error: `${concept.rel}: ${concept.error}` }, 422);
        const { head, body } = parseMarkdown(raw);
        const split = splitExplanation(body);
        if (!split) return c.json({ error: `${concept.rel} has no "## My explanation" section. Run pnpm check.` }, 422);
        const issues = explanationIssues(split, request.text);
        if (issues.length > 0) return c.json({ error: issues.join(" "), issues }, 422);
        const next = head + joinExplanation(split, request.text);
        writeFileSync(concept.readme, next);
        return c.json({ version: contentVersion(next) }, 200);
      },
    );
}
```

- [ ] **Step 6: Mount the routes**

In `playground/server/app.ts`, add `import { conceptRoutes } from "./concepts.ts";` and append `.route("/api", conceptRoutes(ctx.root))` to the chain after `solutionRoutes`.

- [ ] **Step 7: Run the tests**

Run: `pnpm exec vitest run playground/tests/server`
Expected: PASS.

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add playground/server/explanation.ts playground/server/concepts.ts playground/server/app.ts playground/tests/server/explanation.test.ts playground/tests/server/concepts.test.ts playground/tests/server/spoiler.test.ts
git commit -m "feat(playground): serve concept notes and save My explanation safely"
```

---

### Task 7: API — live file events

**Files:**
- Create: `playground/server/events.ts`
- Modify: `playground/server/app.ts` (one `EventHub` per app, mount `eventRoutes`)
- Test: `playground/tests/server/events.test.ts`

**Interfaces:**
- Consumes: `problemIdFromFolder`, `exerciseIdFromFolder` (`lib/repo.ts`); `contentVersion` (Task 5); `RepoEvent` (Task 4); chokidar's `watch`.
- Produces:
  - `classify(root, file): RepoEvent | null`: `problems/<folder>/{README.md,cases.json,stress.ts,solution.{py,ts}}` and `concepts/<slug>/exercises/<folder>/…` map to the target; `concepts/<slug>/README.md` maps to `{ kind: "readme", concept }`; anything else is `null`. Solution events carry the file's `contentVersion` (`contentVersion("")` once deleted).
  - `class EventHub { constructor(root); subscribe(listener): Promise<() => void> }`: one chokidar watcher, started by the first subscriber and closed after the last one leaves; the promise resolves once changes are being reported.
  - `eventRoutes(hub)`: `GET /events` → `text/event-stream`. First an `event: ready` message, then one default message per `RepoEvent` (`data:` is its JSON), and a `: ping` comment every 25 s.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/server/events.test.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.ts";
import { classify } from "../../server/events.ts";
import { contentVersion } from "../../server/solutions.ts";
import { type App, call, makeRepo, PY_SUM, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

/** Reads Server-Sent Events from a response body, skipping comments. */
async function openEvents(app: App) {
  const res = await call(app, "/api/events");
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const next = async (): Promise<{ event: string; data: string }> => {
    for (;;) {
      const end = buffer.indexOf("\n\n");
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (block.startsWith(":")) continue;
        return { event: /^event: (.*)$/m.exec(block)?.[1] ?? "message", data: /^data: (.*)$/m.exec(block)?.[1] ?? "" };
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("the event stream ended");
      buffer += value;
    }
  };
  return { next, close: () => reader.cancel() };
}

describe("classify", () => {
  const root = "/repo";
  it("maps files the app cares about to events", () => {
    expect(classify(root, "/repo/problems/lc-0001-two-sum/README.md")).toEqual({ kind: "readme", target: "lc-0001" });
    expect(classify(root, "/repo/concepts/hash-map/README.md")).toEqual({ kind: "readme", concept: "hash-map" });
    expect(classify(root, "/repo/concepts/hash-map/exercises/01-first-repeat/cases.json")).toEqual({ kind: "cases", target: "hash-map/01" });
    expect(classify(root, "/repo/problems/lc-0001-two-sum/stress.ts")).toEqual({ kind: "stress", target: "lc-0001" });
  });

  it("ignores everything else", () => {
    for (const file of [
      "/repo/problems/lc-0001-two-sum/notes.txt",
      "/repo/problems/lc-0001-two-sum/__pycache__/solution.cpython-313.pyc",
      "/repo/concepts/hash-map/cases.json",
      "/repo/INDEX.md",
      "/repo/runner/src/run.ts",
    ]) {
      expect(classify(root, file), file).toBeNull();
    }
  });
});

describe("GET /api/events", () => {
  it("says when it is ready, then reports README, solution and case changes", async () => {
    const root = makeRepo();
    const events = await openEvents(createApp({ root }));
    try {
      expect((await events.next()).event).toBe("ready");
      writeFileSync(path.join(root, "problems/lc-0001-two-sum/README.md"), "changed\n");
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "readme", target: "lc-0001" });
      writeFileSync(path.join(root, "concepts/hash-map/exercises/01-first-repeat/solution.py"), PY_SUM);
      expect(JSON.parse((await events.next()).data)).toEqual({
        kind: "solution",
        target: "hash-map/01",
        lang: "py",
        version: contentVersion(PY_SUM),
      });
      writeFileSync(path.join(root, "problems/lc-0020-valid-parentheses/cases.json"), "{}\n");
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "cases", target: "lc-0020" });
      writeFileSync(path.join(root, "concepts/hash-map/README.md"), "changed\n");
      expect(JSON.parse((await events.next()).data)).toEqual({ kind: "readme", concept: "hash-map" });
    } finally {
      await events.close();
    }
  });

  it("works on a repo that has no problems or concepts yet", async () => {
    const root = makeRepo();
    const empty = path.join(root, "empty");
    mkdirSync(empty);
    const events = await openEvents(createApp({ root: empty }));
    try {
      expect((await events.next()).event).toBe("ready");
    } finally {
      await events.close();
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/server/events.test.ts`
Expected: FAIL: `events.ts` does not exist.

- [ ] **Step 3: Create `playground/server/events.ts`**

```ts
import { existsSync, readFileSync, type Stats } from "node:fs";
import path from "node:path";
import { type FSWatcher, watch } from "chokidar";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { exerciseIdFromFolder, problemIdFromFolder } from "../../lib/repo.ts";
import { contentVersion } from "./solutions.ts";
import type { RepoEvent } from "./types.ts";

export const HEARTBEAT_MS = 25_000;
const IGNORED_PART = /(^|[/\\])(__pycache__|node_modules|\.[^/\\]+)([/\\]|$)/;

/** What a changed file means for the app, or null when the app does not show it. */
export function classify(root: string, file: string): RepoEvent | null {
  const parts = path.relative(root, file).split(path.sep);
  let target: string | undefined;
  let concept: string | undefined;
  let name: string;
  if (parts[0] === "problems" && parts.length === 3) {
    target = problemIdFromFolder(parts[1]);
    name = parts[2];
  } else if (parts[0] === "concepts" && parts.length === 3) {
    concept = parts[1];
    name = parts[2];
  } else if (parts[0] === "concepts" && parts.length === 5 && parts[2] === "exercises") {
    target = exerciseIdFromFolder(parts[1], parts[3]);
    name = parts[4];
  } else {
    return null;
  }
  if (name === "README.md") return target ? { kind: "readme", target } : { kind: "readme", concept };
  if (!target) return null;
  if (name === "cases.json") return { kind: "cases", target };
  if (name === "stress.ts") return { kind: "stress", target };
  const lang = /^solution\.(py|ts)$/.exec(name)?.[1];
  if (lang !== "py" && lang !== "ts") return null;
  return { kind: "solution", target, lang, version: contentVersion(existsSync(file) ? readFileSync(file, "utf8") : "") };
}

type Listener = (event: RepoEvent) => void;

/** One chokidar watcher shared by every open page: started by the first subscriber, closed after the last one leaves. */
export class EventHub {
  private readonly listeners = new Set<Listener>();
  private watcher: FSWatcher | null = null;
  private ready: Promise<void> = Promise.resolve();
  /** Last seen version per file: macOS reports one save twice. */
  private readonly seen = new Map<string, string>();

  constructor(private readonly root: string) {}

  /** Resolves once file changes are being reported to `listener`. Call the returned function to stop. */
  async subscribe(listener: Listener): Promise<() => void> {
    this.listeners.add(listener);
    if (!this.watcher) this.start();
    await this.ready;
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private start(): void {
    // Watching the root (not problems/ and concepts/) keeps working when those folders do not exist yet.
    const watcher = watch(this.root, {
      ignoreInitial: true,
      alwaysStat: true,
      ignored: (file) => {
        const rel = path.relative(this.root, file);
        if (rel === "") return false;
        const top = rel.split(path.sep)[0];
        return (top !== "problems" && top !== "concepts") || IGNORED_PART.test(rel);
      },
    });
    this.watcher = watcher;
    // chokidar is ready once its fs watchers exist; libuv arms them a loop turn later.
    this.ready = new Promise((resolve) => watcher.once("ready", () => setImmediate(() => setImmediate(resolve))));
    watcher.on("all", (kind, file, stats) => this.changed(kind, file, stats));
  }

  private stop(): void {
    void this.watcher?.close();
    this.watcher = null;
    this.seen.clear();
  }

  private changed(kind: string, file: string, stats: Stats | undefined): void {
    const version = kind === "unlink" ? "missing" : stats ? `${stats.size}:${stats.mtimeMs}` : `${Date.now()}`;
    if (this.seen.get(file) === version) return;
    this.seen.set(file, version);
    const event = classify(this.root, file);
    if (event) for (const listener of this.listeners) listener(event);
  }
}

export function eventRoutes(hub: EventHub) {
  return new Hono().get("/events", (c) =>
    streamSSE(c, async (stream) => {
      const subscription = hub.subscribe((event) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      });
      stream.onAbort(() => {
        void subscription.then((unsubscribe) => unsubscribe());
      });
      await subscription;
      await stream.writeSSE({ event: "ready", data: "" });
      while (!stream.aborted) {
        await stream.sleep(HEARTBEAT_MS);
        if (!stream.aborted) await stream.write(": ping\n\n");
      }
    }),
  );
}
```

- [ ] **Step 4: Mount the routes**

In `playground/server/app.ts`, add `import { EventHub, eventRoutes } from "./events.ts";`. The final `createApp` is:

```ts
export function createApp(ctx: ServerContext) {
  const hub = new EventHub(ctx.root);
  const app = new Hono()
    .use("/api/*", hostGuard, formCsrf)
    .get("/api/health", (c) => c.json({ ok: true as const }, 200))
    .route("/api", targetRoutes(ctx.root))
    .route("/api", solutionRoutes(ctx.root))
    .route("/api", conceptRoutes(ctx.root))
    .route("/api", eventRoutes(hub));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    console.error(error);
    return c.json({ error: error.message }, 500);
  });
  return app;
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run playground/tests/server`
Expected: PASS.

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add playground/server/events.ts playground/server/app.ts playground/tests/server/events.test.ts
git commit -m "feat(playground): stream file changes to the browser"
```

---

### Task 8: Web shell and home page

**Files:**
- Create: `playground/web/styles.css`, `playground/web/lib/cn.ts`, `playground/web/components/ui/button.tsx`, `playground/web/components/ui/badge.tsx`, `playground/web/components/ui/tabs.tsx`, `playground/web/api.ts`, `playground/web/events.tsx`, `playground/web/links.ts`, `playground/web/router.tsx`, `playground/web/components/ConnectionBanner.tsx`, `playground/web/components/NotFound.tsx`, `playground/web/components/StatusIcon.tsx`, `playground/web/routes/home.tsx`, `playground/tests/web/render.tsx`
- Modify: `playground/web/main.tsx` (the real app)
- Test: `playground/tests/web/home.test.tsx`

**Interfaces:**
- Consumes: `AppType` (Task 3/7); `HomeData`, `TargetData`, `SolutionData`, `ConceptData`, `RepoEvent`, `ItemStatus` (Task 4); `RunResult`, `CustomResult`, `Lang` (`runner/src/types.ts`).
- Produces (later tasks use these exact names):
  - `lib/cn.ts`: `cn(...classes)`.
  - `components/ui/button.tsx`: `Button` (props of `<button>` + `variant: "default" | "outline" | "ghost"`, `size: "default" | "sm"`; `type="button"` unless given).
  - `components/ui/badge.tsx`: `Badge` (props of `<span>` + `tone: "neutral" | "green" | "amber" | "red"`).
  - `components/ui/tabs.tsx`: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (Radix, styled).
  - `api.ts`: `client`, `class ApiError extends Error { status: number; issues: string[] }`, `getHome()`, `getTarget(id)`, `getSolution(id, lang)`, `type SaveResult = { ok: true; version: string } | { ok: false; current: SolutionData }`, `putSolution(id, lang, code, baseVersion)` (sent with `keepalive`), `runTests(id, lang): Promise<RunResult>`, `runCustomInput(id, lang, input): Promise<CustomResult>`, `getConcept(slug)`, `type ExplanationSave = { ok: true; version: string } | { ok: false; current: ConceptData }`, `putExplanation(slug, text, baseVersion)`, `keys.{home,target(id),concept(slug)}`, `homeQuery()`, `targetQuery(id)`, `conceptQuery(slug)`.
  - `events.tsx`: `EventsProvider`, `useConnected(): boolean`, `useRepoEvents(listener: (event: RepoEvent) => void): void`.
  - `links.ts`: `type AppLink` (`{ to: "/" }` | `{ to: "/p/$id"; params: { id } }` | `{ to: "/e/$concept/$nn"; params: { concept; nn } }` | `{ to: "/c/$slug"; params: { slug } }`), `targetLink(id): AppLink`.
  - `router.tsx`: `rootRoute`, `homeRoute`, `problemRoute` (`/p/$id`), `exerciseRoute` (`/e/$concept/$nn`), `conceptRoute` (`/c/$slug`), `routeTree`, `router`, and the `Register` declaration. The problem, exercise and concept routes get their `component` in Tasks 12 and 14.
  - `components/NotFound.tsx`: `NotFound({ message? })`. `components/StatusIcon.tsx`: `statusMark(status, inProgress)`, `StatusIcon`.
  - `routes/home.tsx`: `HomeView({ data: HomeData })`, `HomePage()`.
  - `tests/web/render.tsx`: `renderWithRouter(ui, path?)`, which renders `ui` inside a memory router so `<Link>`s work.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/web/render.tsx`:

```tsx
import { act, render } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Renders `ui` inside a memory router, so TanStack Router <Link>s get their hrefs. */
export async function renderWithRouter(ui: ReactNode, path = "/") {
  const rootRoute = createRootRoute({ component: () => <>{ui}</> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: [path] }) });
  await act(() => router.load());
  return { router, ...render(<RouterProvider router={router} />) };
}
```

Create `playground/tests/web/home.test.tsx`:

```tsx
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { HomeData } from "../../server/types.ts";
import { HomeView } from "../../web/routes/home.tsx";
import { renderWithRouter } from "./render.tsx";

const DATA: HomeData = {
  problems: [
    { id: "lc-0001", title: "Two Sum", difficulty: "easy", patterns: ["arrays-hashing"], status: "solved", inProgress: false, error: null },
    { id: "lc-0026", title: "Remove Duplicates", difficulty: "easy", patterns: ["two-pointers"], status: "solving", inProgress: true, error: null },
    { id: "lc-0030", title: "lc-0030-broken", difficulty: null, patterns: [], status: "todo", inProgress: false, error: "frontmatter: bad" },
  ],
  groups: [
    { pattern: "(no pattern yet)", ids: ["lc-0030"] },
    { pattern: "arrays-hashing", ids: ["lc-0001"] },
    { pattern: "two-pointers", ids: ["lc-0026"] },
  ],
  concepts: [
    {
      slug: "hash-map",
      title: "Hash map",
      status: "learning",
      error: null,
      exercises: [
        { id: "hash-map/01", title: "First repeat", status: "solved", inProgress: false, error: null },
        { id: "hash-map/02", title: "Most frequent", status: "todo", inProgress: true, error: null },
        { id: "hash-map/03", title: "Same letters", status: "todo", inProgress: false, error: null },
      ],
    },
  ],
};

describe("HomeView", () => {
  it("shows work in progress first, problems by pattern, and concepts with their progress", async () => {
    await renderWithRouter(<HomeView data={DATA} />);
    const progress = screen.getByRole("region", { name: "In progress" });
    expect(within(progress).getByRole("link", { name: "lc-0026 Remove Duplicates" })).toHaveAttribute("href", "/p/lc-0026");
    expect(within(progress).getByRole("link", { name: "hash-map/02 Most frequent" })).toHaveAttribute("href", "/e/hash-map/02");
    expect(screen.getByText("1/3 solved")).toBeInTheDocument();
    const problems = screen.getByRole("region", { name: "Problems" });
    expect(within(problems).getByRole("heading", { name: "two-pointers" })).toBeInTheDocument();
    expect(within(problems).getByText(/frontmatter: bad/)).toBeInTheDocument();
    const concepts = screen.getByRole("region", { name: "Concepts" });
    expect(within(concepts).getByRole("link", { name: "Hash map" })).toHaveAttribute("href", "/c/hash-map");
    expect(within(concepts).getByText(/1\/3 exercises/)).toBeInTheDocument();
  });

  it("filters by id or title", async () => {
    await renderWithRouter(<HomeView data={DATA} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "two");
    expect(screen.getByRole("link", { name: "lc-0001 Two Sum" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /lc-0026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "In progress" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run --project web`
Expected: FAIL: `Cannot find module '../../web/routes/home.tsx'`.

- [ ] **Step 3: Create the styles and UI primitives**

Create `playground/web/styles.css`:

```css
@import "tailwindcss" source(".");

@theme {
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

body {
  @apply bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100;
}

/* Code blocks colored by Shiki with both themes; the operating system picks one. */
.shiki,
.shiki span {
  color: var(--shiki-light);
  background-color: var(--shiki-light-bg);
}
@media (prefers-color-scheme: dark) {
  .shiki,
  .shiki span {
    color: var(--shiki-dark);
    background-color: var(--shiki-dark-bg);
  }
}

/* Rendered README Markdown. */
.markdown {
  @apply text-sm leading-relaxed;
}
.markdown h1 {
  @apply mb-3 text-xl font-semibold;
}
.markdown h2 {
  @apply mt-6 mb-2 text-base font-semibold;
}
.markdown h3 {
  @apply mt-4 mb-2 font-semibold;
}
.markdown p,
.markdown ul,
.markdown ol,
.markdown table,
.markdown pre {
  @apply my-2;
}
.markdown ul {
  @apply list-disc pl-5;
}
.markdown ol {
  @apply list-decimal pl-5;
}
.markdown :not(pre) > code {
  @apply rounded bg-neutral-100 px-1 font-mono text-[0.85em] dark:bg-neutral-800;
}
.markdown pre {
  @apply overflow-x-auto rounded-md p-3 font-mono text-xs;
}
.markdown table {
  @apply border-collapse text-xs;
}
.markdown th,
.markdown td {
  @apply border border-neutral-300 px-2 py-1 dark:border-neutral-700;
}
.markdown a,
.markdown .concept-link {
  @apply text-blue-700 underline dark:text-blue-400;
}
```

Create `playground/web/lib/cn.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names; later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Create `playground/web/components/ui/button.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300",
        outline: "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
        ghost: "hover:bg-neutral-100 dark:hover:bg-neutral-800",
      },
      size: { default: "h-8 px-3", sm: "h-7 px-2 text-xs" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, ...props }: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button type="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

Create `playground/web/components/ui/badge.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

const badgeVariants = cva("inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
      green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
      amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
      red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
```

Create `playground/web/components/ui/tabs.tsx`:

```tsx
import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/cn.ts";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("flex gap-1 border-b border-neutral-200 px-2 dark:border-neutral-800", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px border-b-2 border-transparent px-2 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 data-[state=active]:border-neutral-900 data-[state=active]:text-neutral-900 dark:hover:text-neutral-100 dark:data-[state=active]:border-neutral-100 dark:data-[state=active]:text-neutral-100",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden", className)} {...props} />;
}
```

- [ ] **Step 4: Create the API client, the live events and the links**

Create `playground/web/api.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { hc } from "hono/client";
import type { CustomResult, Lang, RunResult } from "../../runner/src/types.ts";
import type { AppType } from "../server/app.ts";
import type { ConceptData, HomeData, SolutionData, TargetData } from "../server/types.ts";

export const client = hc<AppType>("/");

/** A request the server refused. `issues` lists what to fix (custom input, My explanation). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(res: { status: number; json(): Promise<unknown> }): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: string[] };
  throw new ApiError(res.status, body.error ?? `The request failed (${res.status}).`, body.issues ?? []);
}

export async function getHome(): Promise<HomeData> {
  const res = await client.api.home.$get();
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getTarget(id: string): Promise<TargetData> {
  const res = await client.api.target.$get({ query: { id } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getSolution(id: string, lang: Lang): Promise<SolutionData> {
  const res = await client.api.solution.$get({ query: { id, lang } });
  if (!res.ok) return fail(res);
  return res.json();
}

export type SaveResult = { ok: true; version: string } | { ok: false; current: SolutionData };

/** Sent with keepalive, so a save started while the page closes still arrives. */
export async function putSolution(id: string, lang: Lang, code: string, baseVersion: string): Promise<SaveResult> {
  const res = await client.api.solution.$put({ json: { id, lang, code, baseVersion } }, { init: { keepalive: true } });
  if (res.status === 409) return { ok: false, current: await res.json() };
  if (!res.ok) return fail(res);
  return { ok: true, version: (await res.json()).version };
}

export async function runTests(id: string, lang: Lang): Promise<RunResult> {
  const res = await client.api.run.$post({ json: { id, lang } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function runCustomInput(id: string, lang: Lang, input: unknown): Promise<CustomResult> {
  const res = await client.api["run-custom"].$post({ json: { id, lang, input } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getConcept(slug: string): Promise<ConceptData> {
  const res = await client.api.concept.$get({ query: { slug } });
  if (!res.ok) return fail(res);
  return res.json();
}

export type ExplanationSave = { ok: true; version: string } | { ok: false; current: ConceptData };

export async function putExplanation(slug: string, text: string, baseVersion: string): Promise<ExplanationSave> {
  const res = await client.api.concept.explanation.$put({ json: { slug, text, baseVersion } });
  if (res.status === 409) return { ok: false, current: await res.json() };
  if (!res.ok) return fail(res);
  return { ok: true, version: (await res.json()).version };
}

export const keys = {
  home: ["home"] as const,
  target: (id: string) => ["target", id] as const,
  concept: (slug: string) => ["concept", slug] as const,
};

export const homeQuery = () => queryOptions({ queryKey: keys.home, queryFn: getHome });
export const targetQuery = (id: string) => queryOptions({ queryKey: keys.target(id), queryFn: () => getTarget(id) });
export const conceptQuery = (slug: string) => queryOptions({ queryKey: keys.concept(slug), queryFn: () => getConcept(slug) });
```

Create `playground/web/events.tsx`:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { RepoEvent } from "../server/types.ts";
import { keys } from "./api.ts";

type Listener = (event: RepoEvent) => void;

interface EventsValue {
  connected: boolean;
  subscribe(listener: Listener): () => void;
}

const EventsContext = createContext<EventsValue>({ connected: true, subscribe: () => () => {} });

/**
 * One EventSource for the whole app. It refreshes the queries a change affects (badges update when Claude
 * edits a README) and passes every event to the pages that listen.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("ready", () => setConnected(true));
    source.onerror = () => setConnected(false);
    source.onmessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as RepoEvent;
      if (event.kind === "readme") {
        void queryClient.invalidateQueries({ queryKey: keys.home });
        if (event.target) void queryClient.invalidateQueries({ queryKey: keys.target(event.target) });
        if (event.concept) void queryClient.invalidateQueries({ queryKey: keys.concept(event.concept) });
      } else if (event.kind === "cases") {
        void queryClient.invalidateQueries({ queryKey: keys.target(event.target) });
      } else if (event.kind === "solution") {
        // A new stub turns a todo item into "in progress".
        void queryClient.invalidateQueries({ queryKey: keys.home });
      }
      for (const listener of listeners.current) listener(event);
    };
    return () => source.close();
  }, [queryClient]);

  const value = useMemo<EventsValue>(
    () => ({
      connected,
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [connected],
  );
  return <EventsContext value={value}>{children}</EventsContext>;
}

/** False while the playground server cannot be reached. */
export function useConnected(): boolean {
  return useContext(EventsContext).connected;
}

/** Calls `listener` for every file change the server reports while the component is mounted. */
export function useRepoEvents(listener: Listener): void {
  const { subscribe } = useContext(EventsContext);
  const onEvent = useEffectEvent(listener);
  useEffect(() => subscribe((event) => onEvent(event)), [subscribe]);
}
```

Create `playground/web/links.ts`:

```ts
/** Where an app link goes, typed against the router's routes. */
export type AppLink =
  | { to: "/" }
  | { to: "/p/$id"; params: { id: string } }
  | { to: "/e/$concept/$nn"; params: { concept: string; nn: string } }
  | { to: "/c/$slug"; params: { slug: string } };

/** Link to a problem (lc-0001) or an exercise (hash-map/01). */
export function targetLink(id: string): AppLink {
  const slash = id.indexOf("/");
  if (slash < 0) return { to: "/p/$id", params: { id } };
  return { to: "/e/$concept/$nn", params: { concept: id.slice(0, slash), nn: id.slice(slash + 1) } };
}
```

- [ ] **Step 5: Create the router, the shared components and the home page**

Create `playground/web/components/NotFound.tsx`:

```tsx
import { Link } from "@tanstack/react-router";

export function NotFound({ message }: { message?: string }) {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-neutral-500">{message ?? "This page does not exist."}</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Back to the home page
      </Link>
    </main>
  );
}
```

Create `playground/web/components/ConnectionBanner.tsx`:

```tsx
import { useConnected } from "../events.tsx";

export function ConnectionBanner() {
  if (useConnected()) return null;
  return (
    <div role="alert" className="bg-red-600 px-3 py-1.5 text-center text-sm text-white">
      Disconnected — run <code>pnpm play</code> again. Unsaved changes stay in this tab and are saved when it reconnects.
    </div>
  );
}
```

Create `playground/web/components/StatusIcon.tsx`:

```tsx
import type { ItemStatus } from "../../server/types.ts";

export function statusMark(status: ItemStatus, inProgress: boolean): { icon: string; label: string } {
  if (status === "solved") return { icon: "✅", label: "solved" };
  if (status === "revealed") return { icon: "👁", label: "revealed" };
  if (inProgress) return { icon: "⏳", label: "in progress" };
  return { icon: "○", label: "todo" };
}

export function StatusIcon({ status, inProgress }: { status: ItemStatus; inProgress: boolean }) {
  const mark = statusMark(status, inProgress);
  return (
    <span role="img" aria-label={mark.label} title={mark.label} className="inline-block w-5 text-center">
      {mark.icon}
    </span>
  );
}
```

Create `playground/web/router.tsx`:

```tsx
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ConnectionBanner } from "./components/ConnectionBanner.tsx";
import { NotFound } from "./components/NotFound.tsx";
import { HomePage } from "./routes/home.tsx";

export const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-dvh flex-col">
      <ConnectionBanner />
      <Outlet />
      <Toaster position="bottom-right" theme="system" richColors />
    </div>
  ),
  notFoundComponent: () => <NotFound />,
});

export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
export const problemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/p/$id" });
export const exerciseRoute = createRoute({ getParentRoute: () => rootRoute, path: "/e/$concept/$nn" });
export const conceptRoute = createRoute({ getParentRoute: () => rootRoute, path: "/c/$slug" });

export const routeTree = rootRoute.addChildren([homeRoute, problemRoute, exerciseRoute, conceptRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

Create `playground/web/routes/home.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { HomeData, HomeProblem, ItemStatus } from "../../server/types.ts";
import { homeQuery } from "../api.ts";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { targetLink } from "../links.ts";

interface Item {
  id: string;
  title: string;
  status: ItemStatus;
  inProgress: boolean;
  error: string | null;
  detail?: string | null;
}

const sectionTitle = "mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500";

function ItemRow({ item }: { item: Item }) {
  return (
    <li className="flex items-baseline gap-2 py-0.5 text-sm">
      <StatusIcon status={item.status} inProgress={item.inProgress} />
      <Link {...targetLink(item.id)} className="hover:underline">
        {item.id} {item.title}
      </Link>
      {item.detail && <span className="text-xs text-neutral-500">· {item.detail}</span>}
      {item.error && (
        <span className="text-xs text-amber-700 dark:text-amber-400" title={item.error}>
          ⚠ {item.error}
        </span>
      )}
    </li>
  );
}

export function HomeView({ data }: { data: HomeData }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matches = (id: string, title: string) =>
    query === "" || id.toLowerCase().includes(query) || title.toLowerCase().includes(query);
  const problems = new Map(data.problems.map((p) => [p.id, p]));
  const exercises = data.concepts.flatMap((c) => c.exercises);
  const inProgress: Item[] = [...data.problems, ...exercises].filter((item) => item.inProgress && matches(item.id, item.title));
  const solved = data.problems.filter((p) => p.status === "solved").length;
  const concepts = data.concepts.filter((c) => matches(c.slug, c.title) || c.exercises.some((e) => matches(e.id, e.title)));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
      <header className="mb-8 flex items-center gap-4">
        <h1 className="text-xl font-semibold">Algorithms</h1>
        <input
          type="search"
          aria-label="Search"
          placeholder="Search…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-8 w-56 rounded-md border border-neutral-300 bg-transparent px-2 text-sm dark:border-neutral-700"
        />
        <span className="ml-auto text-sm text-neutral-500">
          {solved}/{data.problems.length} solved
        </span>
      </header>

      {inProgress.length > 0 && (
        <section aria-labelledby="home-in-progress" className="mb-8">
          <h2 id="home-in-progress" className={sectionTitle}>
            In progress
          </h2>
          <ul>
            {inProgress.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="home-problems" className="mb-8">
        <h2 id="home-problems" className={sectionTitle}>
          Problems
        </h2>
        {data.problems.length === 0 && <p className="text-sm text-neutral-500">No problems yet. Paste one into Claude Code to start.</p>}
        {data.groups.map((group) => {
          const items = group.ids
            .map((id) => problems.get(id))
            .filter((p): p is HomeProblem => p !== undefined && matches(p.id, p.title));
          if (items.length === 0) return null;
          return (
            <div key={group.pattern} className="mb-4">
              <h3 className="mb-1 text-sm font-medium">{group.pattern}</h3>
              <ul>
                {items.map((p) => (
                  <ItemRow key={p.id} item={{ ...p, detail: p.difficulty }} />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="home-concepts" className="mb-8">
        <h2 id="home-concepts" className={sectionTitle}>
          Concepts
        </h2>
        {data.concepts.length === 0 && <p className="text-sm text-neutral-500">No concepts yet.</p>}
        <ul>
          {concepts.map((c) => {
            const done = c.exercises.filter((e) => e.status === "solved").length;
            return (
              <li key={c.slug} className="py-0.5 text-sm">
                <Link to="/c/$slug" params={{ slug: c.slug }} className="hover:underline">
                  {c.title}
                </Link>
                <span className="text-xs text-neutral-500">
                  {" "}
                  · {c.status} · {done}/{c.exercises.length} exercises
                </span>
                {c.error && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">⚠ {c.error}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-neutral-500">○ todo · ⏳ in progress · ✅ solved · 👁 revealed</p>
    </main>
  );
}

export function HomePage() {
  const home = useQuery(homeQuery());
  if (home.isPending) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  if (home.isError) {
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {home.error.message}
      </p>
    );
  }
  return <HomeView data={home.data} />;
}
```

Replace `playground/web/main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EventsProvider } from "./events.tsx";
import { router } from "./router.tsx";
import "./styles.css";

// A 404 or a case-file error will not fix itself by retrying; live events refresh what changes.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <EventsProvider>
        <RouterProvider router={router} />
      </EventsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run --project web`
Expected: PASS (1 file, 2 tests).

Run: `pnpm verify`
Expected: all green; `tsc -p playground` type-checks the typed client against the server routes.

- [ ] **Step 7: Check the home page in the real server**

```bash
pnpm play --no-open --port 4380 > /tmp/play.log 2>&1 &
sleep 5; curl -s http://127.0.0.1:4380/ | grep -c 'id="root"'; curl -s http://127.0.0.1:4380/api/home | head -c 200; echo
kill %1
```

Expected: `1`, then JSON that starts with `{"problems":[{"id":"lc-0001"`.

- [ ] **Step 8: Commit**

```bash
git add playground/web playground/tests/web/render.tsx playground/tests/web/home.test.tsx
git commit -m "feat(playground): add the web shell, live events and the home page"
```

---

### Task 9: Markdown rendering and README links

**Files:**
- Create: `lib/ids.ts`, `playground/web/components/Markdown.tsx`
- Modify: `lib/repo.ts` (move the two id functions to `lib/ids.ts`), `playground/web/links.ts` (add `routeForLink`)
- Test: `playground/tests/web/links.test.ts`, `playground/tests/web/markdown.test.tsx`

**Interfaces:**
- Consumes: `AppLink`, `targetLink` (Task 8); `cn` (Task 8); `renderWithRouter` (Task 8).
- Produces:
  - `lib/ids.ts`: `problemIdFromFolder(folder)`, `exerciseIdFromFolder(concept, folder)`, with no Node imports. `lib/repo.ts` re-exports both, so existing imports keep working.
  - `links.ts`: `type LinkTarget = { kind: "app"; link: AppLink } | { kind: "external"; href: string } | { kind: "none" }`, `routeForLink(readmePath, href): LinkTarget`.
  - `components/Markdown.tsx`: `Markdown({ source, readmePath, onConcept?, className? })`. Renders GFM with `skipHtml` (raw HTML and `<!-- -->` comments are dropped), code blocks colored by Shiki, internal links as router `<Link>`s, external links in a new tab, other links as plain text. With `onConcept`, concept links become buttons that call it.

- [ ] **Step 1: Write the failing tests**

Create `playground/tests/web/links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { exerciseIdFromFolder, problemIdFromFolder } from "../../../lib/repo.ts";
import { type LinkTarget, routeForLink } from "../../web/links.ts";

const PROBLEM = "problems/lc-0001-two-sum/README.md";
const CONCEPT = "concepts/hash-map/README.md";
const EXERCISE = "concepts/hash-map/exercises/01-first-repeat/README.md";
const conceptLink = (slug: string): LinkTarget => ({ kind: "app", link: { to: "/c/$slug", params: { slug } } });
const problemLink = (id: string): LinkTarget => ({ kind: "app", link: { to: "/p/$id", params: { id } } });

const CASES: [readme: string, href: string, expected: LinkTarget][] = [
  [PROBLEM, "../../concepts/hash-map/README.md", conceptLink("hash-map")],
  [CONCEPT, "../../problems/lc-0001-two-sum/README.md", problemLink("lc-0001")],
  [CONCEPT, "../../problems/lc-0001-two-sum/README.md#log", problemLink("lc-0001")],
  [CONCEPT, "exercises/01-first-repeat/README.md", { kind: "app", link: { to: "/e/$concept/$nn", params: { concept: "hash-map", nn: "01" } } }],
  [EXERCISE, "../../README.md", conceptLink("hash-map")],
  ["README.md", "INDEX.md", { kind: "app", link: { to: "/" } }],
  [CONCEPT, "../INDEX.md", { kind: "app", link: { to: "/" } }],
  [PROBLEM, "https://leetcode.com/problems/two-sum/", { kind: "external", href: "https://leetcode.com/problems/two-sum/" }],
  [PROBLEM, "solution.py", { kind: "none" }],
  [PROBLEM, "../../problems/", { kind: "none" }],
  [PROBLEM, "../../../../etc/passwd", { kind: "none" }],
  [PROBLEM, "#statement", { kind: "none" }],
  [PROBLEM, "mailto:someone@example.com", { kind: "none" }],
];

describe("routeForLink", () => {
  it.each(CASES)("%s → %s", (readme, href, expected) => {
    expect(routeForLink(readme, href)).toEqual(expected);
  });

  it("uses the same id rules as the repo scanner", () => {
    expect(problemIdFromFolder("lc-0217-contains-duplicate")).toBe("lc-0217");
    expect(exerciseIdFromFolder("greedy", "02-coins")).toBe("greedy/02");
  });
});
```

Create `playground/tests/web/markdown.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "../../web/components/Markdown.tsx";
import { renderWithRouter } from "./render.tsx";

const SOURCE = [
  "# Two Sum",
  "",
  "<!-- auto:concepts -->",
  "- [Hash map](../../concepts/hash-map/README.md) · learning",
  "<!-- /auto -->",
  "",
  "| n | answer |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "```python",
  "seen = {}",
  "```",
  "",
  "<b>raw html</b> stays text",
  "",
  "[LeetCode](https://leetcode.com/problems/two-sum/) and [your file](solution.py)",
].join("\n");
const README = "problems/lc-0001-two-sum/README.md";

describe("Markdown", () => {
  it("renders GFM with colored code, app links, external links, and drops raw HTML", async () => {
    const { container } = await renderWithRouter(<Markdown source={SOURCE} readmePath={README} />);
    expect(screen.getByRole("heading", { name: "Two Sum" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hash map" })).toHaveAttribute("href", "/c/hash-map");
    const external = screen.getByRole("link", { name: "LeetCode" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("link", { name: "your file" })).not.toBeInTheDocument();
    expect(screen.getByText("your file")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
    expect(container.querySelector("pre.shiki")).not.toBeNull();
    expect(container.innerHTML).not.toContain("<b>");
    expect(container.innerHTML).not.toContain("auto:concepts");
  });

  it("turns concept links into buttons when the page opens concepts itself", async () => {
    const onConcept = vi.fn();
    await renderWithRouter(<Markdown source={SOURCE} readmePath={README} onConcept={onConcept} />);
    await userEvent.click(screen.getByRole("button", { name: "Hash map" }));
    expect(onConcept).toHaveBeenCalledWith("hash-map");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run --project web`
Expected: FAIL: `routeForLink` is not exported and `Markdown.tsx` does not exist.

- [ ] **Step 3: Move the id rules to a Node-free module**

Create `lib/ids.ts`:

```ts
// Id rules with no Node imports: the repo scanner and the browser share them.

/** "lc-0001-two-sum" → "lc-0001"; folders without a number keep their full name. */
export function problemIdFromFolder(folder: string): string {
  return /^([a-z]+-\d{4})-/.exec(folder)?.[1] ?? folder;
}

/** ("greedy", "01-coins") → "greedy/01" */
export function exerciseIdFromFolder(concept: string, folder: string): string {
  return `${concept}/${/^(\d{2})-/.exec(folder)?.[1] ?? folder}`;
}
```

In `lib/repo.ts`, delete the `problemIdFromFolder` and `exerciseIdFromFolder` functions and their comments, and add after the existing imports:

```ts
import { exerciseIdFromFolder, problemIdFromFolder } from "./ids.ts";

export { exerciseIdFromFolder, problemIdFromFolder };
```

- [ ] **Step 4: Add `routeForLink`**

Append to `playground/web/links.ts`:

```ts
import { exerciseIdFromFolder, problemIdFromFolder } from "../../lib/ids.ts";

export type LinkTarget = { kind: "app"; link: AppLink } | { kind: "external"; href: string } | { kind: "none" };

/**
 * Where a link inside a README goes. Relative links resolve from the README's folder. READMEs of problems,
 * concepts and exercises become app routes, http(s) links stay external, and anything else (a solution
 * file, a folder, an anchor) is not a link.
 */
export function routeForLink(readmePath: string, href: string): LinkTarget {
  if (/^https?:\/\//i.test(href)) return { kind: "external", href };
  if (href === "" || href.startsWith("#") || href.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(href)) return { kind: "none" };
  const url = new URL(href, `file:///repo/${readmePath}`);
  if (!url.pathname.startsWith("/repo/")) return { kind: "none" };
  const rel = decodeURIComponent(url.pathname.slice("/repo/".length));
  if (rel === "INDEX.md" || rel === "concepts/INDEX.md") return { kind: "app", link: { to: "/" } };
  const parts = rel.split("/");
  if (parts.at(-1) !== "README.md") return { kind: "none" };
  if (parts.length === 3 && parts[0] === "problems") return { kind: "app", link: targetLink(problemIdFromFolder(parts[1])) };
  if (parts.length === 3 && parts[0] === "concepts") return { kind: "app", link: { to: "/c/$slug", params: { slug: parts[1] } } };
  if (parts.length === 5 && parts[0] === "concepts" && parts[2] === "exercises") {
    return { kind: "app", link: targetLink(exerciseIdFromFolder(parts[1], parts[3])) };
  }
  return { kind: "none" };
}
```

Move the new `import` line to the top of `links.ts`.

- [ ] **Step 5: Create `playground/web/components/Markdown.tsx`**

```tsx
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import typescript from "shiki/langs/typescript.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { cn } from "../lib/cn.ts";
import { routeForLink } from "../links.ts";

// Created once, synchronously: react-markdown runs its plugins synchronously.
const highlighter = createHighlighterCoreSync({
  themes: [githubLight, githubDark],
  langs: [python, typescript, javascript, json, markdown],
  engine: createJavaScriptRegexEngine(),
});
const SHIKI = { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false, fallbackLanguage: "text" } as const;

interface MarkdownProps {
  source: string;
  /** Repo-relative path of the README the text comes from; relative links resolve from its folder. */
  readmePath: string;
  /** When set, concept links call it instead of navigating (the work view opens them in its side pane). */
  onConcept?: (slug: string) => void;
  className?: string;
}

function MarkdownLink({ href, readmePath, onConcept, children }: { href: string; readmePath: string; onConcept?: (slug: string) => void; children: ReactNode }) {
  const target = routeForLink(readmePath, href);
  if (target.kind === "external") {
    return (
      <a href={target.href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  if (target.kind === "none") return <span>{children}</span>;
  const { link } = target;
  if (onConcept && link.to === "/c/$slug") {
    return (
      <button type="button" className="concept-link" onClick={() => onConcept(link.params.slug)}>
        {children}
      </button>
    );
  }
  return <Link {...link}>{children}</Link>;
}

export function Markdown({ source, readmePath, onConcept, className }: MarkdownProps) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeShikiFromHighlighter, highlighter, SHIKI]]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <MarkdownLink href={href ?? ""} readmePath={readmePath} onConcept={onConcept}>
              {children}
            </MarkdownLink>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run --project web`
Expected: PASS.

Run: `pnpm verify`
Expected: all green (the root `tsc` and the runner/scripts tests prove `lib/repo.ts` still exports the id functions).

- [ ] **Step 7: Commit**

```bash
git add lib/ids.ts lib/repo.ts playground/web/links.ts playground/web/components/Markdown.tsx playground/tests/web/links.test.ts playground/tests/web/markdown.test.tsx
git commit -m "feat(playground): render READMEs with working links and colored code"
```

---

### Task 10: Tests and Console panels

**Files:**
- Create: `playground/web/components/RunDetails.tsx`, `playground/web/components/TestsPanel.tsx`, `playground/web/components/ConsolePanel.tsx`
- Test: `playground/tests/web/tests-panel.test.tsx`

**Interfaces:**
- Consumes: `RunResult`, `ExampleResult`, `StressCaseResult`, `HarnessError` (`runner/src/types.ts`); `formatNamedInput`, `formatOutput` (Task 1); `Badge`, `cn` (Task 8).
- Produces:
  - `RunDetails.tsx`: `DISPLAY_MAX = 2000`, `formatMs(ms?: number): string` (`"0.20 ms"`, `"83 ms"`), `ErrorBox({ title?, error })` (`role="alert"`, shows `kind: message` and the trace).
  - `TestsPanel({ result, running, elapsedMs, stale, caseError, paramNames })`, where `result: RunResult | null`, `paramNames: readonly string[]`.
  - `ConsolePanel({ result })`.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/web/tests-panel.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunResult } from "../../../runner/src/types.ts";
import { ConsolePanel } from "../../web/components/ConsolePanel.tsx";
import { TestsPanel, type TestsPanelProps } from "../../web/components/TestsPanel.tsx";

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: "lc-0001",
    title: "Two Sum",
    lang: "py",
    readme: "problems/lc-0001-two-sum/README.md",
    solution: "problems/lc-0001-two-sum/solution.py",
    fatal: null,
    examples: {
      passed: 2,
      total: 2,
      cases: [
        { id: 1, status: "pass", input: [[2, 7, 11, 15], 9], expected: [0, 1], output: [0, 1], ms: 0.2, stdout: "" },
        { id: 2, status: "pass", input: [[3, 2, 4], 6], expected: [1, 2], output: [1, 2], ms: 83.4, stdout: "" },
      ],
    },
    hidden: { status: "pass", passed: 3, total: 3, firstFailure: null },
    stress: { status: "none", cases: [] },
    green: true,
    ...overrides,
  };
}

const panel = (props: Partial<TestsPanelProps>) =>
  render(<TestsPanel result={null} running={false} elapsedMs={0} stale={false} caseError={null} paramNames={["nums", "target"]} {...props} />);

describe("TestsPanel", () => {
  it("invites a first run", () => {
    panel({});
    expect(screen.getByText(/Press ▶ Run/)).toBeInTheDocument();
  });

  it("shows a green run and points to /review", () => {
    panel({ result: result() });
    expect(screen.getByText(/Green in py/)).toBeInTheDocument();
    expect(screen.getByText("/review")).toBeInTheDocument();
    expect(screen.getByText("0.20 ms")).toBeInTheDocument();
    expect(screen.getByText("83 ms")).toBeInTheDocument();
  });

  it("shows a failing example with named input, expected and got, and skips hidden", () => {
    const failing = result({
      green: false,
      examples: {
        passed: 1,
        total: 2,
        cases: [
          { id: 1, status: "pass", input: [[2, 7, 11, 15], 9], expected: [0, 1], output: [0, 1], ms: 0.2, stdout: "" },
          { id: 2, status: "fail", input: [[3, 2, 4], 6], expected: [1, 2], output: [0, 0], ms: 0.3, stdout: "" },
        ],
      },
      hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
      stress: { status: "skipped", cases: [] },
    });
    panel({ result: failing });
    expect(screen.getByText("nums=[3,2,4], target=6")).toBeInTheDocument();
    expect(screen.getByText("[1,2]")).toBeInTheDocument();
    expect(screen.getByText("[0,0]")).toBeInTheDocument();
    expect(screen.getByText(/Hidden · skipped until the examples pass/)).toBeInTheDocument();
    expect(screen.queryByText(/Green/)).not.toBeInTheDocument();
  });

  it("shows the first hidden failure with the input and the user's output, never an expected value", () => {
    panel({
      result: result({
        green: false,
        hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [[5, 5], 10], output: [0, 0], stdout: "" } },
        stress: { status: "skipped", cases: [] },
      }),
    });
    expect(screen.getByText(/Hidden · 2\/3 passed/)).toBeInTheDocument();
    expect(screen.getByText("nums=[5,5], target=10")).toBeInTheDocument();
    expect(screen.getByText("[0,0]")).toBeInTheDocument();
    expect(screen.queryByText("expected", { exact: true })).not.toBeInTheDocument();
  });

  it("shows a load error with its trace", () => {
    panel({
      result: result({
        green: false,
        fatal: { kind: "load", message: "SyntaxError: expected ':'", trace: 'File "solution.py", line 2' },
        examples: { passed: 0, total: 2, cases: [] },
        hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
        stress: { status: "skipped", cases: [] },
      }),
    });
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Could not load solution.py")).toBeInTheDocument();
    expect(within(alert).getByText("load: SyntaxError: expected ':'")).toBeInTheDocument();
    expect(within(alert).getByText('File "solution.py", line 2')).toBeInTheDocument();
  });

  it("shows stress timings, slow cases and timeouts", () => {
    panel({
      result: result({
        green: false,
        stress: {
          status: "fail",
          cases: [
            { name: "n=1e5 random", status: "pass", ms: 83, limitMs: 2000 },
            { name: "n=1e5 sorted", status: "slow", ms: 2400, limitMs: 2000 },
            { name: "worst case", status: "timeout", limitMs: 2000 },
          ],
        },
      }),
    });
    expect(screen.getByText("83 ms / 2000 ms")).toBeInTheDocument();
    expect(screen.getByText("2400 ms / 2000 ms · too slow")).toBeInTheDocument();
    expect(screen.getByText("timeout (> 2000 ms)")).toBeInTheDocument();
  });

  it("shows a case-file error, a stale result and the running time", () => {
    panel({ result: result(), caseError: "cases.json is invalid:\n  - entry: required", stale: true, running: true, elapsedMs: 1234 });
    expect(screen.getByText(/Case file error/)).toBeInTheDocument();
    expect(screen.getByText(/entry: required/)).toBeInTheDocument();
    expect(screen.getByText("cases changed — run again")).toBeInTheDocument();
    expect(screen.getByText("Running… 1.2 s")).toBeInTheDocument();
  });
});

describe("ConsolePanel", () => {
  it("groups the prints by case", () => {
    const run = result({
      examples: {
        passed: 2,
        total: 2,
        cases: [
          { id: 1, status: "pass", input: [[1], 1], expected: [], output: [], ms: 1, stdout: "seen={}\n" },
          { id: 2, status: "pass", input: [[2], 2], expected: [], output: [], ms: 1, stdout: "" },
        ],
      },
      hidden: { status: "fail", passed: 0, total: 1, firstFailure: { input: [[3], 3], output: [], stdout: "hidden print\n" } },
    });
    render(<ConsolePanel result={run} />);
    expect(within(screen.getByRole("region", { name: "Example 1" })).getByText("seen={}")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Example 2" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Hidden · first failure" })).getByText("hidden print")).toBeInTheDocument();
  });

  it("explains where prints appear", () => {
    render(<ConsolePanel result={null} />);
    expect(screen.getByText(/Prints from your code appear here/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/web/tests-panel.test.tsx`
Expected: FAIL: the components do not exist.

- [ ] **Step 3: Create `playground/web/components/RunDetails.tsx`**

```tsx
import type { HarnessError } from "../../../runner/src/types.ts";

/** Values are shown in full up to this length (the terminal cuts at 100). */
export const DISPLAY_MAX = 2000;

export function formatMs(ms: number | undefined): string {
  if (ms === undefined) return "";
  return `${ms < 1 ? ms.toFixed(2) : Math.round(ms)} ms`;
}

export function ErrorBox({ title, error }: { title?: string; error: HarnessError }) {
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm dark:border-red-800 dark:bg-red-950">
      {title && <p className="font-medium">{title}</p>}
      <p className="font-mono text-xs">
        {error.kind}: {error.message}
      </p>
      {error.trace && <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{error.trace}</pre>}
    </div>
  );
}
```

- [ ] **Step 4: Create `playground/web/components/TestsPanel.tsx`**

```tsx
import { formatNamedInput, formatOutput } from "../../../runner/src/format.ts";
import type { ExampleResult, RunResult, StressCaseResult } from "../../../runner/src/types.ts";
import { cn } from "../lib/cn.ts";
import { DISPLAY_MAX, ErrorBox, formatMs } from "./RunDetails.tsx";
import { Badge } from "./ui/badge.tsx";

export interface TestsPanelProps {
  result: RunResult | null;
  running: boolean;
  /** Time since ▶ Run, shown while running. */
  elapsedMs: number;
  /** cases.json or stress.ts changed after this result was produced. */
  stale: boolean;
  caseError: string | null;
  paramNames: readonly string[];
}

type Format = (value: unknown) => string;

const muted = "text-xs text-neutral-500";

function Values({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="ml-6 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-neutral-500">{label}</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExampleRow({ example, input }: { example: ExampleResult; input: Format }) {
  const label = `Example ${example.id}`;
  if (example.status === "pass") {
    return (
      <li>
        ✅ {label} <span className={muted}>{formatMs(example.ms)}</span>
      </li>
    );
  }
  if (example.status === "skipped") return <li className="text-neutral-500">⏸ {label} · skipped</li>;
  const rows: [string, string][] = [["input", input(example.input)]];
  if (example.status === "fail") {
    rows.push(["expected", formatOutput(example.expected, DISPLAY_MAX)], ["got", formatOutput(example.output, DISPLAY_MAX)]);
  }
  return (
    <li className="space-y-1">
      <p>
        ❌ {label}
        {example.status === "timeout" && " · timeout"} <span className={muted}>{formatMs(example.ms)}</span>
      </p>
      <Values rows={rows} />
      {example.error && (
        <div className="ml-6">
          <ErrorBox error={example.error} />
        </div>
      )}
    </li>
  );
}

function Hidden({ result, input }: { result: RunResult; input: Format }) {
  const hidden = result.hidden;
  if (hidden.status === "skipped") {
    return <p className="text-neutral-500">⏸ Hidden · {result.fatal ? "skipped" : "skipped until the examples pass"}</p>;
  }
  if (hidden.status === "pass") {
    return (
      <p>
        ✅ Hidden · {hidden.passed}/{hidden.total} passed
      </p>
    );
  }
  const failure = hidden.firstFailure;
  return (
    <div className="space-y-1">
      <p>
        ❌ Hidden · {hidden.passed}/{hidden.total} passed
      </p>
      {failure && (
        <>
          <p className={cn(muted, "ml-6")}>First failing case (its answer stays hidden):</p>
          <Values rows={failure.error ? [["input", input(failure.input)]] : [["input", input(failure.input)], ["got", formatOutput(failure.output, DISPLAY_MAX)]]} />
          {failure.error && (
            <div className="ml-6">
              <ErrorBox error={failure.error} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STRESS_MARK: Record<StressCaseResult["status"], string> = { pass: "✅", slow: "🐢", timeout: "⏱", error: "❌", skipped: "⏸" };

function stressDetail(c: StressCaseResult): string {
  if (c.status === "pass") return `${formatMs(c.ms)} / ${c.limitMs} ms`;
  if (c.status === "slow") return `${formatMs(c.ms)} / ${c.limitMs} ms · too slow`;
  if (c.status === "timeout") return `timeout (> ${c.limitMs} ms)`;
  return c.status;
}

function Stress({ result }: { result: RunResult }) {
  const stress = result.stress;
  if (stress.status === "none") return <p className="text-neutral-500">· Stress · no stress cases</p>;
  if (stress.status === "skipped") return <p className="text-neutral-500">⏸ Stress · skipped</p>;
  return (
    <ul className="space-y-1">
      {stress.cases.map((c) => (
        <li key={c.name}>
          {STRESS_MARK[c.status]} Stress · {c.name} <span className={muted}>{stressDetail(c)}</span>
          {c.error && (
            <div className="ml-6">
              <ErrorBox error={c.error} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TestsPanel({ result, running, elapsedMs, stale, caseError, paramNames }: TestsPanelProps) {
  const input: Format = (value) => formatNamedInput(paramNames, value, DISPLAY_MAX);
  return (
    <div className="space-y-3 p-3 text-sm">
      {caseError && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950">
          <p className="font-medium">Case file error — not your code. Fix the problem files, or ask Claude.</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{caseError}</pre>
        </div>
      )}
      {running && (
        <p role="status" className="text-neutral-500">
          Running… {(elapsedMs / 1000).toFixed(1)} s
        </p>
      )}
      {!result && !running && !caseError && <p className="text-neutral-500">Press ▶ Run (⌘↵) to test your code.</p>}
      {result && (
        <div className={cn("space-y-3", running && "opacity-50")}>
          {stale && <Badge tone="amber">cases changed — run again</Badge>}
          {result.green && (
            <p className="rounded-md bg-green-50 p-2 font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
              ✅ Green in {result.lang}. Ask Claude for <code>/review</code> in the terminal to mark it solved.
            </p>
          )}
          {result.fatal ? (
            <ErrorBox title={`Could not load ${result.solution.split("/").at(-1)}`} error={result.fatal} />
          ) : (
            <ul className="space-y-2">
              {result.examples.cases.map((example) => (
                <ExampleRow key={example.id} example={example} input={input} />
              ))}
            </ul>
          )}
          <Hidden result={result} input={input} />
          <Stress result={result} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `playground/web/components/ConsolePanel.tsx`**

```tsx
import type { RunResult } from "../../../runner/src/types.ts";

export function ConsolePanel({ result }: { result: RunResult | null }) {
  const blocks = result
    ? [
        ...result.examples.cases.filter((c) => c.stdout).map((c) => ({ label: `Example ${c.id}`, text: c.stdout })),
        ...(result.hidden.firstFailure?.stdout ? [{ label: "Hidden · first failure", text: result.hidden.firstFailure.stdout }] : []),
      ]
    : [];
  if (blocks.length === 0) {
    return (
      <p className="p-3 text-xs text-neutral-500">
        {result ? "No prints in the last run." : "Prints from your code appear here after ▶ Run."}
      </p>
    );
  }
  return (
    <div className="space-y-3 p-3 font-mono text-xs">
      {blocks.map((block) => (
        <section key={block.label} aria-label={block.label}>
          <h3 className="text-neutral-500">{block.label} ▸</h3>
          <pre className="whitespace-pre-wrap">{block.text}</pre>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run playground/tests/web/tests-panel.test.tsx`
Expected: PASS.

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add playground/web/components/RunDetails.tsx playground/web/components/TestsPanel.tsx playground/web/components/ConsolePanel.tsx playground/tests/web/tests-panel.test.tsx
git commit -m "feat(playground): show test results and prints"
```

---

### Task 11: Custom input panel

**Files:**
- Create: `playground/web/components/CustomInputPanel.tsx`
- Test: `playground/tests/web/custom-input.test.tsx`

**Interfaces:**
- Consumes: `Signature` (Task 4); `CustomResult` (Task 1); `formatOutput` (Task 1); `ApiError` (Task 8); `Button` (Task 8); `ErrorBox`, `formatMs`, `DISPLAY_MAX` (Task 10).
- Produces:
  - `interface CustomInputHandle { submit(): Promise<void> }`.
  - `CustomInputPanel({ targetId, signature, exampleInput, run, ref? })`, where `run: (input: unknown) => Promise<CustomResult>` (throws `ApiError`). There is one JSON field per parameter, or `ops` and `args` for class problems. The fields start from Example 1, are remembered per target in `localStorage` (`algo.custom.<id>`), and `Reset` restores Example 1. Invalid JSON shows an error under its field and sends nothing. The panel registers no keyboard shortcut; the work view calls `submit()` through `ref` (Task 14).
  - Exported helpers: `fieldNames(signature)`, `exampleTexts(signature, exampleInput)`.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/web/custom-input.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomResult } from "../../../runner/src/types.ts";
import type { Signature } from "../../server/types.ts";
import { ApiError } from "../../web/api.ts";
import { CustomInputPanel } from "../../web/components/CustomInputPanel.tsx";

const SIG: Signature = {
  mode: "function",
  entry: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
};
const EXAMPLE = [[2, 7, 11, 15], 9];
const ok = (output: unknown, stdout = ""): CustomResult => ({ fatal: null, output, ms: 0.4, stdout });

async function replace(field: HTMLElement, text: string) {
  const user = userEvent.setup();
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

beforeEach(() => localStorage.clear());

describe("CustomInputPanel", () => {
  it("starts from Example 1 and runs the parsed JSON", async () => {
    const run = vi.fn(async () => ok([0, 1], "seen={3: 0}\n"));
    render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
    expect(screen.getByRole("textbox", { name: "target" })).toHaveValue("9");
    await replace(screen.getByRole("textbox", { name: "nums" }), "[3,3]");
    await replace(screen.getByRole("textbox", { name: "target" }), "6");
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(run).toHaveBeenCalledWith([[3, 3], 6]);
    expect(await screen.findByText("[0,1]")).toBeInTheDocument();
    expect(screen.getByText("seen={3: 0}")).toBeInTheDocument();
  });

  it("shows Python-style literals as invalid JSON and sends nothing", async () => {
    const run = vi.fn(async () => ok(null));
    render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    await replace(screen.getByRole("textbox", { name: "nums" }), "['a', True]");
    await replace(screen.getByRole("textbox", { name: "target" }), "None");
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Not valid JSON/)).toHaveLength(2);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveAttribute("aria-invalid", "true");
  });

  it("remembers edits per problem, and Reset brings back Example 1", async () => {
    const run = vi.fn(async () => ok(null));
    const first = render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    await replace(screen.getByRole("textbox", { name: "nums" }), "[5]");
    first.unmount();

    const again = render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[5]");
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
    again.unmount();

    render(<CustomInputPanel targetId="lc-0002" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
  });

  it("uses ops and args for class problems", async () => {
    const run = vi.fn(async () => ok([null, null, 3]));
    const signature: Signature = { mode: "class", entry: "MinStack", params: [], returns: null };
    render(
      <CustomInputPanel targetId="lc-0155" signature={signature} exampleInput={{ ops: ["MinStack", "push", "getMin"], args: [[], [3], []] }} run={run} />,
    );
    expect(screen.getByRole("textbox", { name: "ops" })).toHaveValue('["MinStack","push","getMin"]');
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(run).toHaveBeenCalledWith({ ops: ["MinStack", "push", "getMin"], args: [[], [3], []] });
  });

  it("lists the issues the server found, and shows errors raised by the code", async () => {
    const run = vi
      .fn<(input: unknown) => Promise<CustomResult>>()
      .mockRejectedValueOnce(new ApiError(422, "the input does not match the signature", ["custom.input: expected 2 params, got 1"]))
      .mockResolvedValueOnce({ fatal: null, error: { kind: "exception", message: "IndexError: list index out of range", trace: "line 3, in twoSum" }, ms: 1, stdout: "" });
    render(<CustomInputPanel targetId="lc-0001" signature={SIG} exampleInput={EXAMPLE} run={run} />);
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(await screen.findByText("custom.input: expected 2 params, got 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Run custom input/ }));
    expect(await screen.findByText("exception: IndexError: list index out of range")).toBeInTheDocument();
    expect(screen.getByText("line 3, in twoSum")).toBeInTheDocument();
  });

  it("explains that it needs a valid cases.json", () => {
    render(<CustomInputPanel targetId="lc-0001" signature={null} exampleInput={null} run={vi.fn()} />);
    expect(screen.getByText(/needs a valid cases\.json/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/web/custom-input.test.tsx`
Expected: FAIL: `CustomInputPanel.tsx` does not exist.

- [ ] **Step 3: Create `playground/web/components/CustomInputPanel.tsx`**

```tsx
import { type Ref, useId, useImperativeHandle, useState } from "react";
import { formatOutput } from "../../../runner/src/format.ts";
import type { CustomResult } from "../../../runner/src/types.ts";
import type { Signature } from "../../server/types.ts";
import { ApiError } from "../api.ts";
import { DISPLAY_MAX, ErrorBox, formatMs } from "./RunDetails.tsx";
import { Button } from "./ui/button.tsx";

export interface CustomInputHandle {
  submit(): Promise<void>;
}

interface CustomInputPanelProps {
  targetId: string;
  signature: Signature | null;
  exampleInput: unknown;
  run: (input: unknown) => Promise<CustomResult>;
  ref?: Ref<CustomInputHandle>;
}

type Texts = Record<string, string>;

/** Keeps the browser from correcting or suggesting inside the JSON fields. */
const NO_WRITING_AIDS = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", writingsuggestions: "false" } as const;
const storageKey = (id: string) => `algo.custom.${id}`;

export function fieldNames(signature: Signature): string[] {
  return signature.mode === "class" ? ["ops", "args"] : signature.params.map((param) => param.name);
}

export function exampleTexts(signature: Signature, exampleInput: unknown): Texts {
  if (signature.mode === "class") {
    const call = (exampleInput ?? {}) as { ops?: unknown; args?: unknown };
    return { ops: JSON.stringify(call.ops ?? []), args: JSON.stringify(call.args ?? []) };
  }
  const values = Array.isArray(exampleInput) ? exampleInput : [];
  return Object.fromEntries(fieldNames(signature).map((name, i) => [name, i < values.length ? JSON.stringify(values[i]) : ""]));
}

function savedTexts(id: string, signature: Signature, exampleInput: unknown): Texts {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(id)) ?? "null");
    if (saved && typeof saved === "object" && fieldNames(signature).every((name) => typeof (saved as Texts)[name] === "string")) {
      return saved as Texts;
    }
  } catch {
    // Storage blocked or unreadable: start from the example.
  }
  return exampleTexts(signature, exampleInput);
}

function CustomResultView({ result }: { result: CustomResult }) {
  if (result.fatal) return <ErrorBox title="Could not load the solution" error={result.fatal} />;
  return (
    <div className="space-y-2">
      {result.error ? (
        <ErrorBox error={result.error} />
      ) : (
        <p>
          <span className="text-neutral-500">Output</span> <code className="font-mono">{formatOutput(result.output, DISPLAY_MAX)}</code>{" "}
          <span className="text-xs text-neutral-500">{formatMs(result.ms)}</span>
        </p>
      )}
      {result.stdout && (
        <pre aria-label="Prints" className="whitespace-pre-wrap rounded bg-neutral-100 p-2 font-mono text-xs dark:bg-neutral-900">
          {result.stdout}
        </pre>
      )}
    </div>
  );
}

function CustomInputForm({ targetId, signature, exampleInput, run, ref }: CustomInputPanelProps & { signature: Signature }) {
  const id = useId();
  const names = fieldNames(signature);
  const [texts, setTexts] = useState<Texts>(() => savedTexts(targetId, signature, exampleInput));
  const [errors, setErrors] = useState<Texts>({});
  const [result, setResult] = useState<CustomResult | null>(null);
  const [failure, setFailure] = useState<{ message: string; issues: string[] } | null>(null);
  const [pending, setPending] = useState(false);

  const update = (name: string, value: string) => {
    const next = { ...texts, [name]: value };
    setTexts(next);
    try {
      localStorage.setItem(storageKey(targetId), JSON.stringify(next));
    } catch {
      // Not remembered; the field still works.
    }
  };

  const reset = () => {
    setTexts(exampleTexts(signature, exampleInput));
    setErrors({});
    try {
      localStorage.removeItem(storageKey(targetId));
    } catch {
      // Nothing to forget.
    }
  };

  const submit = async () => {
    const values: unknown[] = [];
    const nextErrors: Texts = {};
    for (const name of names) {
      try {
        values.push(JSON.parse(texts[name] ?? ""));
      } catch {
        nextErrors[name] = 'Not valid JSON. Write it like [1,2], "text", true, false or null.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const input = signature.mode === "class" ? { ops: values[0], args: values[1] } : values;
    setPending(true);
    setFailure(null);
    try {
      setResult(await run(input));
    } catch (error) {
      setResult(null);
      setFailure({ message: (error as Error).message, issues: error instanceof ApiError ? error.issues : [] });
    } finally {
      setPending(false);
    }
  };

  useImperativeHandle(ref, () => ({ submit }));

  return (
    <form
      className="space-y-3 p-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {names.map((name) => (
        <div key={name}>
          <label htmlFor={`${id}-${name}`} className="font-mono text-xs text-neutral-500">
            {name}
          </label>
          <textarea
            id={`${id}-${name}`}
            value={texts[name] ?? ""}
            onChange={(event) => update(name, event.target.value)}
            rows={1}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
            className="mt-0.5 block w-full resize-y rounded-md border border-neutral-300 bg-transparent p-1.5 font-mono text-xs dark:border-neutral-700"
            {...NO_WRITING_AIDS}
          />
          {errors[name] && (
            <p id={`${id}-${name}-error`} className="mt-0.5 text-xs text-red-600">
              {errors[name]}
            </p>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Running…" : "Run custom input"} <kbd className="text-xs opacity-70">⇧⌘↵</kbd>
        </Button>
        <Button variant="outline" onClick={reset}>
          Reset
        </Button>
      </div>
      {failure && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-xs dark:border-red-800 dark:bg-red-950">
          <p>{failure.issues.length > 0 ? "The server could not use this input:" : failure.message}</p>
          {failure.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-mono">
              {failure.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result && <CustomResultView result={result} />}
    </form>
  );
}

export function CustomInputPanel(props: CustomInputPanelProps) {
  if (!props.signature) {
    return <p className="p-3 text-sm text-neutral-500">Custom input needs a valid cases.json. See the Tests tab.</p>;
  }
  return <CustomInputForm {...props} signature={props.signature} />;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm exec vitest run playground/tests/web/custom-input.test.tsx`
Expected: PASS.

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add playground/web/components/CustomInputPanel.tsx playground/tests/web/custom-input.test.tsx
git commit -m "feat(playground): run a solution on a custom input from the browser"
```

---

### Task 12: Code editor and concept page

**Files:**
- Create: `playground/web/lib/theme.ts`, `playground/web/components/CodeEditor.tsx`, `playground/web/components/ConceptView.tsx`, `playground/web/routes/concept.tsx`
- Modify: `playground/web/router.tsx` (give `conceptRoute` its component)
- Test: `playground/tests/web/concept-view.test.tsx`

**Interfaces:**
- Consumes: `ConceptData` (Task 4); `Markdown` (Task 9); `Button`, `Badge` (Task 8); `ApiError`, `conceptQuery`, `putExplanation`, `keys` (Task 8); `NotFound` (Task 8).
- Produces:
  - `lib/theme.ts`: `usePrefersDark(): boolean`.
  - `components/CodeEditor.tsx`: `type EditorLanguage = "py" | "ts" | "md"`, `BASIC_SETUP`, `CodeEditor({ value, onChange, lang, bindings?, ariaLabel, className?, autoFocus? })`. `bindings: readonly KeyBinding[]` run before CodeMirror's defaults. The editable area has `aria-label={ariaLabel}`, `spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"` and `writingsuggestions="false"`. There is no autocompletion, lint or fold gutter.
  - `components/ConceptView.tsx`: `CONFLICT_MESSAGE`, `ConceptView({ concept, editable, onConcept?, save? })`, where `save: (text: string) => Promise<void>` throws `ApiError`. It renders `before`, the "My explanation" section and `after`. With `editable`, the section has ✎ Edit, a Markdown editor with a live preview, Cancel and Save.
  - `routes/concept.tsx`: `ConceptPage()` for `/c/$slug`.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/web/concept-view.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConceptData } from "../../server/types.ts";
import { ApiError } from "../../web/api.ts";
import { ConceptView } from "../../web/components/ConceptView.tsx";
import { renderWithRouter } from "./render.tsx";

// CodeMirror needs layout APIs that jsdom lacks; a textarea stands in for it here. The end-to-end tests use the real editor.
vi.mock("../../web/components/CodeEditor.tsx", async () => {
  const { createElement } = await import("react");
  return {
    CodeEditor: ({ value, onChange, ariaLabel }: { value: string; onChange(value: string): void; ariaLabel: string }) =>
      createElement("textarea", { "aria-label": ariaLabel, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) }),
  };
});

const CONCEPT: ConceptData = {
  slug: "hash-map",
  title: "Hash map",
  status: "learning",
  readme: "concepts/hash-map/README.md",
  before: "# Hash map\n\n## Intuition\n\nA coat check.\n\n",
  explanation: "",
  after: "## Problems\n\n- ✓ [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)\n",
  version: "v1",
  readmeError: null,
};

describe("ConceptView", () => {
  it("shows the note around the section; read-only in the side pane", async () => {
    await renderWithRouter(<ConceptView concept={CONCEPT} editable={false} />);
    expect(screen.getByRole("heading", { name: "Intuition" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My explanation" })).toBeInTheDocument();
    expect(screen.getByText("Not written yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "lc-0001 · Two Sum" })).toHaveAttribute("href", "/p/lc-0001");
    expect(screen.queryByRole("button", { name: "✎ Edit" })).not.toBeInTheDocument();
  });

  it("edits the explanation with a live preview and saves it", async () => {
    const save = vi.fn(async () => {});
    await renderWithRouter(<ConceptView concept={{ ...CONCEPT, explanation: "Old text." }} editable save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "✎ Edit" }));
    const editor = screen.getByRole("textbox", { name: "My explanation" });
    expect(editor).toHaveValue("Old text.");
    await userEvent.clear(editor);
    await userEvent.type(editor, "Keys become **positions**.");
    expect(screen.getByRole("region", { name: "Preview" })).toHaveTextContent("Keys become positions.");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("Keys become **positions**.");
    expect(screen.queryByRole("textbox", { name: "My explanation" })).not.toBeInTheDocument();
  });

  it("keeps the draft and shows why the server refused it", async () => {
    const save = vi.fn(async () => {
      throw new ApiError(422, "Use ### or deeper for headings.", ["Use ### or deeper for headings."]);
    });
    await renderWithRouter(<ConceptView concept={CONCEPT} editable save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "✎ Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "My explanation" }), "## Mine");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use ### or deeper for headings.");
    expect(screen.getByRole("textbox", { name: "My explanation" })).toHaveValue("## Mine");
  });

  it("explains a missing section and a broken README", async () => {
    const view = await renderWithRouter(<ConceptView concept={{ ...CONCEPT, explanation: null }} editable />);
    expect(screen.getByText(/has no "My explanation" section/)).toBeInTheDocument();
    view.unmount();
    await renderWithRouter(<ConceptView concept={{ ...CONCEPT, readmeError: "frontmatter: bad" }} editable />);
    expect(screen.getByRole("alert")).toHaveTextContent("frontmatter: bad");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/web/concept-view.test.tsx`
Expected: FAIL: `ConceptView.tsx` does not exist.

- [ ] **Step 3: Create the theme hook and the code editor**

Create `playground/web/lib/theme.ts`:

```ts
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-color-scheme: dark)";

/** Follows the operating system's light/dark setting. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
```

Create `playground/web/components/CodeEditor.tsx`:

```tsx
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, type KeyBinding, keymap } from "@codemirror/view";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, { type BasicSetupOptions } from "@uiw/react-codemirror";
import { useMemo } from "react";
import { usePrefersDark } from "../lib/theme.ts";

export type EditorLanguage = "py" | "ts" | "md";

/** "Interview mode": the basic setup without anything that suggests or judges code. */
export const BASIC_SETUP: BasicSetupOptions = {
  autocompletion: false,
  completionKeymap: false,
  lintKeymap: false,
  foldGutter: false,
  foldKeymap: false,
};

function language(lang: EditorLanguage): Extension {
  if (lang === "py") return python();
  if (lang === "ts") return javascript({ typescript: true });
  return [markdown(), EditorView.lineWrapping];
}

interface CodeEditorProps {
  value: string;
  onChange(value: string): void;
  lang: EditorLanguage;
  /** Checked before CodeMirror's defaults (its Mod-Enter would insert a blank line). Keep the array stable. */
  bindings?: readonly KeyBinding[];
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
}

const NO_BINDINGS: readonly KeyBinding[] = [];

export function CodeEditor({ value, onChange, lang, bindings = NO_BINDINGS, ariaLabel, className, autoFocus }: CodeEditorProps) {
  const dark = usePrefersDark();
  const extensions = useMemo(
    () => [
      language(lang),
      // Keep the browser from adding its own help (spellcheck, autocorrect, writing suggestions).
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
        writingsuggestions: "false",
      }),
      Prec.highest(keymap.of(bindings)),
    ],
    [lang, ariaLabel, bindings],
  );
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{ ...BASIC_SETUP, tabSize: lang === "py" ? 4 : 2 }}
      theme={dark ? githubDark : githubLight}
      height="100%"
      className={className}
      autoFocus={autoFocus}
      indentWithTab
    />
  );
}
```

- [ ] **Step 4: Create `playground/web/components/ConceptView.tsx`**

```tsx
import { useState } from "react";
import type { ConceptData } from "../../server/types.ts";
import { ApiError } from "../api.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { Markdown } from "./Markdown.tsx";
import { Button } from "./ui/button.tsx";

export const CONFLICT_MESSAGE =
  "The README changed on disk while you were editing. Your text is still here: press Save again to put it in My explanation, or Cancel to keep the version on disk.";

interface ConceptViewProps {
  concept: ConceptData;
  /** The concept page can edit "My explanation"; the work view's side pane cannot. */
  editable: boolean;
  onConcept?: (slug: string) => void;
  save?: (text: string) => Promise<void>;
}

function ExplanationSection({ text, readmePath, editable, save }: { text: string; readmePath: string; editable: boolean; save?: (text: string) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (draft === null || !save) return;
    setSaving(true);
    setError(null);
    try {
      await save(draft);
      setDraft(null);
    } catch (reason) {
      setError({ message: (reason as Error).message, issues: reason instanceof ApiError ? reason.issues : [] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="my-explanation" className="markdown">
      <h2 id="my-explanation" className="flex items-center gap-2">
        My explanation
        {editable && draft === null && (
          <Button size="sm" variant="outline" onClick={() => setDraft(text)}>
            ✎ Edit
          </Button>
        )}
      </h2>
      {draft === null ? (
        text ? (
          <Markdown source={text} readmePath={readmePath} />
        ) : (
          <p className="italic text-neutral-500">{editable ? "Not written yet. Explain the concept in your own words." : "Not written yet."}</p>
        )
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-64 overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
              <CodeEditor lang="md" value={draft} onChange={setDraft} ariaLabel="My explanation" className="h-full" autoFocus />
            </div>
            <section aria-label="Preview" className="h-64 overflow-y-auto rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
              <Markdown source={draft} readmePath={readmePath} />
            </section>
          </div>
          {error && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm dark:border-red-800 dark:bg-red-950">
              {error.issues.length > 0 ? (
                <ul className="list-disc pl-5">
                  {error.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                error.message
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ConceptView({ concept, editable, onConcept, save }: ConceptViewProps) {
  if (concept.readmeError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {concept.readme}: {concept.readmeError}
      </p>
    );
  }
  return (
    <article>
      <Markdown source={concept.before} readmePath={concept.readme} onConcept={onConcept} />
      {concept.explanation === null ? (
        <p className="my-4 text-sm text-amber-700 dark:text-amber-400">
          This concept has no "My explanation" section. Run <code>pnpm check</code>.
        </p>
      ) : (
        <ExplanationSection text={concept.explanation} readmePath={concept.readme} editable={editable} save={save} />
      )}
      <Markdown source={concept.after} readmePath={concept.readme} onConcept={onConcept} />
    </article>
  );
}
```

- [ ] **Step 5: Create the concept page and route it**

Create `playground/web/routes/concept.tsx`:

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError, conceptQuery, keys, putExplanation } from "../api.ts";
import { CONFLICT_MESSAGE, ConceptView } from "../components/ConceptView.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { Badge } from "../components/ui/badge.tsx";

export function ConceptPage() {
  const { slug } = useParams({ from: "/c/$slug" });
  const queryClient = useQueryClient();
  const concept = useQuery(conceptQuery(slug));

  if (concept.isPending) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  if (concept.isError) {
    if (concept.error instanceof ApiError && concept.error.status === 404) return <NotFound message={`There is no concept "${slug}".`} />;
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {concept.error.message}
      </p>
    );
  }

  const save = async (text: string) => {
    const result = await putExplanation(slug, text, concept.data.version);
    if (!result.ok) {
      // Show the fresh README; the next Save uses its version.
      queryClient.setQueryData(keys.concept(slug), result.current);
      throw new ApiError(409, CONFLICT_MESSAGE);
    }
    await queryClient.invalidateQueries({ queryKey: keys.concept(slug) });
    toast.success("My explanation saved");
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-6">
      <nav className="mb-4 flex items-center gap-3 text-sm">
        <Link to="/" className="text-neutral-500 hover:underline">
          ← Home
        </Link>
        <Badge>{concept.data.status}</Badge>
      </nav>
      <ConceptView concept={concept.data} editable save={save} />
    </main>
  );
}
```

In `playground/web/router.tsx`, add `import { ConceptPage } from "./routes/concept.tsx";` and give the concept route its component:

```tsx
export const conceptRoute = createRoute({ getParentRoute: () => rootRoute, path: "/c/$slug", component: ConceptPage });
```

- [ ] **Step 6: Run the tests**

Run: `pnpm exec vitest run --project web`
Expected: PASS.

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add playground/web/lib/theme.ts playground/web/components/CodeEditor.tsx playground/web/components/ConceptView.tsx playground/web/routes/concept.tsx playground/web/router.tsx playground/tests/web/concept-view.test.tsx
git commit -m "feat(playground): add the concept page with an editable My explanation"
```

---

### Task 13: Solution autosave hook

**Files:**
- Create: `playground/web/hooks/useSolutionSync.ts`
- Test: `playground/tests/web/use-solution-sync.test.tsx`

**Interfaces:**
- Consumes: `SolutionData` (Task 4); `SaveResult` (Task 8); `useDebouncedCallback` from `use-debounce` (with `flushOnExit`).
- Produces:
  - `AUTOSAVE_MS = 500`, `type SaveState = "loading" | "saved" | "pending" | "saving" | "error" | "conflict"`.
  - `interface SolutionSource { load(): Promise<SolutionData>; save(code: string, baseVersion: string): Promise<SaveResult> }`. The caller keeps the object stable per file.
  - `useSolutionSync(source, onReloaded?): SolutionSync`, where `SolutionSync = { code: string | null; state: SaveState; error: string | null; conflict: SolutionData | null; edit(code): void; flush(): Promise<boolean>; diskChanged(version): void; takeDisk(): void; keepMine(): Promise<boolean> }`.
  - Rules:
    - One save runs at a time, 500 ms after the last edit.
    - `flush()` saves now, waits for every queued save, and resolves `true` only when the disk has exactly what the editor shows.
    - A pending edit is saved when the component unmounts and when the tab closes (`pagehide`).
    - `diskChanged` reloads only a clean editor and ignores the editor's own saves.
    - A `409` enters `conflict`: no autosave until `takeDisk()` or `keepMine()`.

- [ ] **Step 1: Write the failing test**

Create `playground/tests/web/use-solution-sync.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveResult } from "../../web/api.ts";
import { AUTOSAVE_MS, type SolutionSource, useSolutionSync } from "../../web/hooks/useSolutionSync.ts";

/** An in-memory solution file that follows the server's version rules. */
function fakeFile(initial: string) {
  const file = { text: initial, saves: [] as string[] };
  const version = (text: string) => `v:${text}`;
  const source = {
    load: vi.fn(async () => ({ code: file.text, version: version(file.text) })),
    save: vi.fn(async (code: string, base: string): Promise<SaveResult> => {
      if (base !== version(file.text)) return { ok: false, current: { code: file.text, version: version(file.text) } };
      file.text = code;
      file.saves.push(code);
      return { ok: true, version: version(code) };
    }),
  } satisfies SolutionSource;
  /** Someone else (VS Code, git) writes the file. Returns the new version. */
  const writeOutside = (text: string) => {
    file.text = text;
    return version(text);
  };
  return { file, source, version, writeOutside };
}

/** Lets pending promise chains (loads, saves) finish. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await settle();
};

async function mount(source: SolutionSource, onReloaded?: () => void) {
  const hook = renderHook(() => useSolutionSync(source, onReloaded));
  await settle();
  return hook;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useSolutionSync", () => {
  it("loads the file, then saves once, 500 ms after the last edit", async () => {
    const { file, source } = fakeFile("start");
    const { result } = await mount(source);
    expect(result.current).toMatchObject({ code: "start", state: "saved" });
    act(() => result.current.edit("a"));
    await wait(300);
    act(() => result.current.edit("ab"));
    await wait(AUTOSAVE_MS - 1);
    expect(file.saves).toEqual([]);
    expect(result.current.state).toBe("pending");
    await wait(1);
    expect(file.saves).toEqual(["ab"]);
    expect(result.current.state).toBe("saved");
  });

  it("flush saves a pending edit right away and resolves true once it is on disk", async () => {
    const { file, source } = fakeFile("start");
    const { result } = await mount(source);
    act(() => result.current.edit("x"));
    let saved = false;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(true);
    expect(file.saves).toEqual(["x"]);
  });

  it("flush waits for a save that is already running (Run right after typing)", async () => {
    const { file, source } = fakeFile("start");
    let release = () => {};
    source.save.mockImplementationOnce(async (code: string) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      file.text = code;
      file.saves.push(code);
      return { ok: true, version: `v:${code}` };
    });
    const { result } = await mount(source);
    act(() => result.current.edit("slow"));
    await wait(AUTOSAVE_MS);
    expect(result.current.state).toBe("saving");
    let flushed: boolean | null = null;
    const flushing = result.current.flush().then((ok) => {
      flushed = ok;
    });
    await settle();
    expect(flushed).toBeNull();
    release();
    await act(async () => {
      await flushing;
    });
    expect(flushed).toBe(true);
    expect(file.saves).toEqual(["slow"]);
  });

  it("reloads a clean editor when the file changes on disk, and ignores its own saves", async () => {
    const { file, source, version, writeOutside } = fakeFile("start");
    const onReloaded = vi.fn();
    const { result } = await mount(source, onReloaded);
    act(() => result.current.edit("mine"));
    await wait(AUTOSAVE_MS);
    expect(file.saves).toEqual(["mine"]);
    act(() => result.current.diskChanged(version("mine")));
    await settle();
    expect(source.load).toHaveBeenCalledTimes(1);

    const outside = writeOutside("from VS Code");
    act(() => result.current.diskChanged(outside));
    await settle();
    expect(result.current).toMatchObject({ code: "from VS Code", state: "saved" });
    expect(onReloaded).toHaveBeenCalledTimes(1);
  });

  it("never overwrites a file that changed on disk: conflict, then the disk version or mine", async () => {
    const { file, source, writeOutside } = fakeFile("start");
    const { result } = await mount(source);
    act(() => result.current.edit("mine"));
    writeOutside("theirs");
    await wait(AUTOSAVE_MS);
    expect(result.current.state).toBe("conflict");
    expect(result.current.conflict?.code).toBe("theirs");
    act(() => result.current.edit("mine, still typing"));
    await wait(AUTOSAVE_MS);
    expect(file.saves).toEqual([]);
    expect(file.text).toBe("theirs");

    act(() => result.current.takeDisk());
    expect(result.current).toMatchObject({ code: "theirs", state: "saved", conflict: null });

    act(() => result.current.edit("mine again"));
    writeOutside("theirs again");
    await wait(AUTOSAVE_MS);
    expect(result.current.state).toBe("conflict");
    await act(async () => {
      await result.current.keepMine();
    });
    expect(file.text).toBe("mine again");
    expect(result.current.state).toBe("saved");
  });

  it("saves the last edit when the editor closes (route change or language switch)", async () => {
    const { file, source } = fakeFile("start");
    const { result, unmount } = await mount(source);
    act(() => result.current.edit("typed just before leaving"));
    unmount();
    await settle();
    expect(file.saves).toEqual(["typed just before leaving"]);
  });

  it("saves the last edit when the tab closes", async () => {
    const { file, source } = fakeFile("start");
    const { result } = await mount(source);
    act(() => result.current.edit("typed just before closing"));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await settle();
    expect(file.saves).toEqual(["typed just before closing"]);
  });

  it("reports a failed save and retries on flush", async () => {
    const { file, source } = fakeFile("start");
    source.save.mockRejectedValueOnce(new Error("server offline"));
    const { result } = await mount(source);
    act(() => result.current.edit("x"));
    await wait(AUTOSAVE_MS);
    expect(result.current).toMatchObject({ state: "error", error: "server offline" });
    let saved = false;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(true);
    expect(file.saves).toEqual(["x"]);
    expect(result.current.state).toBe("saved");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/web/use-solution-sync.test.tsx`
Expected: FAIL: `useSolutionSync.ts` does not exist.

- [ ] **Step 3: Create `playground/web/hooks/useSolutionSync.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { SolutionData } from "../../server/types.ts";
import type { SaveResult } from "../api.ts";

export const AUTOSAVE_MS = 500;

export type SaveState = "loading" | "saved" | "pending" | "saving" | "error" | "conflict";

export interface SolutionSource {
  load(): Promise<SolutionData>;
  save(code: string, baseVersion: string): Promise<SaveResult>;
}

export interface SolutionSync {
  /** What the editor shows; null until the file is loaded. */
  code: string | null;
  state: SaveState;
  error: string | null;
  /** What is on disk while state is "conflict". */
  conflict: SolutionData | null;
  edit(code: string): void;
  /** Saves any pending edit now. Resolves true when the disk has exactly what the editor shows. */
  flush(): Promise<boolean>;
  /** A solution event from the server: the file on disk now has `version`. */
  diskChanged(version: string): void;
  /** Resolve a conflict by loading what is on disk. */
  takeDisk(): void;
  /** Resolve a conflict by saving the editor's text over it. */
  keepMine(): Promise<boolean>;
}

/** Synchronous bookkeeping, so decisions never wait for a React render. */
interface Tracked {
  loaded: boolean;
  code: string;
  /** Version of the file on disk that `code` is based on. */
  base: string;
  /** The editor has text that is not on disk yet (true until a save of it answers). */
  dirty: boolean;
  conflict: SolutionData | null;
}

/**
 * Keeps one solution file and the editor in step: autosave 500 ms after the last edit, one save at a time,
 * never overwriting a file that changed on disk, and reloading a clean editor when someone else edits the file.
 */
export function useSolutionSync(source: SolutionSource, onReloaded?: () => void): SolutionSync {
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SolutionData | null>(null);
  const tracked = useRef<Tracked>({ loaded: false, code: "", base: "", dirty: false, conflict: null });
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const latest = useRef({ source, onReloaded });
  useEffect(() => {
    latest.current = { source, onReloaded };
  });

  useEffect(() => {
    let cancelled = false;
    source.load().then(
      (data) => {
        if (cancelled) return;
        tracked.current = { loaded: true, code: data.code, base: data.version, dirty: false, conflict: null };
        setCode(data.code);
        setState("saved");
      },
      (reason: unknown) => {
        if (cancelled) return;
        setError((reason as Error).message);
        setState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source]);

  const save = useCallback(async (): Promise<boolean> => {
    const t = tracked.current;
    if (!t.loaded || t.conflict) return false;
    if (!t.dirty) return true;
    const sent = t.code;
    setState("saving");
    try {
      const result = await latest.current.source.save(sent, t.base);
      if (!result.ok) {
        t.conflict = result.current;
        setConflict(result.current);
        setState("conflict");
        return false;
      }
      t.base = result.version;
      if (t.code === sent) t.dirty = false;
      setError(null);
      setState(t.dirty ? "pending" : "saved");
      return !t.dirty;
    } catch (reason) {
      setError((reason as Error).message);
      setState("error");
      return false;
    }
  }, []);

  /** Saves run one after another, each with the base version the previous one produced. */
  const queueSave = useCallback((): Promise<boolean> => {
    const next = queue.current.then(save, save);
    queue.current = next;
    return next;
  }, [save]);

  // flushOnExit: leaving the page or switching language saves the last edit.
  const debounced = useDebouncedCallback(queueSave, AUTOSAVE_MS, { flushOnExit: true });

  // Closing the tab does not unmount React, so pagehide sends the pending save (keepalive lets it finish).
  useEffect(() => {
    const onHide = () => {
      if (debounced.isPending()) debounced.flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [debounced]);

  const edit = useCallback(
    (next: string) => {
      const t = tracked.current;
      if (!t.loaded || next === t.code) return;
      t.code = next;
      t.dirty = true;
      setCode(next);
      if (t.conflict) return; // no autosave until the conflict is resolved
      setState("pending");
      debounced();
    },
    [debounced],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    const t = tracked.current;
    if (!t.loaded || t.conflict) return false;
    if (debounced.isPending()) debounced.flush();
    else if (t.dirty) void queueSave();
    await queue.current;
    return !tracked.current.dirty && !tracked.current.conflict;
  }, [debounced, queueSave]);

  const diskChanged = useCallback(
    (version: string) => {
      const t = tracked.current;
      // Own saves come back with the version we already have; dirty covers a save still on its way.
      if (!t.loaded || version === t.base || t.conflict || t.dirty || debounced.isPending()) return;
      latest.current.source.load().then(
        (data) => {
          const now = tracked.current;
          if (now.dirty || now.conflict || data.version === now.base) return;
          now.code = data.code;
          now.base = data.version;
          setCode(data.code);
          setState("saved");
          latest.current.onReloaded?.();
        },
        () => {},
      );
    },
    [debounced],
  );

  const takeDisk = useCallback(() => {
    const t = tracked.current;
    if (!t.conflict) return;
    debounced.cancel();
    t.code = t.conflict.code;
    t.base = t.conflict.version;
    t.dirty = false;
    t.conflict = null;
    setCode(t.code);
    setConflict(null);
    setState("saved");
  }, [debounced]);

  const keepMine = useCallback(async (): Promise<boolean> => {
    const t = tracked.current;
    if (!t.conflict) return true;
    t.base = t.conflict.version;
    t.conflict = null;
    t.dirty = true;
    setConflict(null);
    return queueSave();
  }, [queueSave]);

  return { code, state, error, conflict, edit, flush, diskChanged, takeDisk, keepMine };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm exec vitest run playground/tests/web/use-solution-sync.test.tsx`
Expected: PASS (8 tests).

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add playground/web/hooks/useSolutionSync.ts playground/tests/web/use-solution-sync.test.tsx
git commit -m "feat(playground): autosave solutions without ever overwriting changes on disk"
```

---

### Task 14: Work view, plus the end-to-end test setup

**Files:**
- Create: `playground/web/lang.ts`, `playground/web/routes/work.tsx`, `playground/playwright.config.ts`, `playground/e2e/fixture.ts`, `playground/e2e/serve.ts`, `playground/e2e/helpers.ts`, `playground/e2e/work.spec.ts`
- Modify: `playground/web/router.tsx` (problem and exercise components), `package.json` (`@playwright/test`, `e2e` script), `.gitignore`
- Test: `playground/tests/web/lang.test.ts`, `playground/e2e/work.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 8–13: `targetQuery`, `conceptQuery`, `getSolution`, `putSolution`, `runTests`, `runCustomInput`, `keys`, `ApiError`; `useRepoEvents`, `useConnected`; `useSolutionSync`, `SaveState`; `CodeEditor`; `Markdown`; `ConceptView`; `TestsPanel`; `ConsolePanel`; `CustomInputPanel`, `CustomInputHandle`; `Tabs*`, `Button`, `Badge`, `NotFound`, `cn`; `startPlayground` (Task 3).
- Produces:
  - `lang.ts`: `pickLang(solutions: Record<Lang, boolean>, remembered: Lang | null): Lang`, `readRememberedLang()`, `rememberLang(lang)` (`localStorage` key `algo.lang`).
  - `routes/work.tsx`: `ProblemPage()` (`/p/$id`), `ExercisePage()` (`/e/$concept/$nn`).
  - `e2e/fixture.ts`: `E2E_PORT = 4391`, `E2E_ROOT` (`playground/e2e/.tmp/repo/`), `repoFile(rel)`, `resetRepo()`, `TWO_SUM_PY`. `e2e/helpers.ts`: `replaceCode(page, code, label?)`.
  - The editable area of the solution editor is `role="textbox"` named `solution.py` / `solution.ts`. The Run button's text starts with `▶ Run`. The save indicator is `role="status"` named `Save status`.

- [ ] **Step 1: Write the failing unit test**

Create `playground/tests/web/lang.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickLang } from "../../web/lang.ts";

describe("pickLang", () => {
  it("opens the only language that already has a file", () => {
    expect(pickLang({ py: false, ts: true }, "py")).toBe("ts");
    expect(pickLang({ py: true, ts: false }, "ts")).toBe("py");
  });

  it("otherwise uses the last language the user chose, then Python", () => {
    expect(pickLang({ py: true, ts: true }, "ts")).toBe("ts");
    expect(pickLang({ py: false, ts: false }, "ts")).toBe("ts");
    expect(pickLang({ py: false, ts: false }, null)).toBe("py");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run playground/tests/web/lang.test.ts`
Expected: FAIL: `lang.ts` does not exist.

- [ ] **Step 3: Create `playground/web/lang.ts`**

```ts
import type { Lang } from "../../runner/src/types.ts";

const KEY = "algo.lang";

/** The only language with a file; otherwise the last one the user chose; otherwise Python. */
export function pickLang(solutions: Record<Lang, boolean>, remembered: Lang | null): Lang {
  if (solutions.py !== solutions.ts) return solutions.py ? "py" : "ts";
  return remembered ?? "py";
}

export function readRememberedLang(): Lang | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "py" || value === "ts" ? value : null;
  } catch {
    return null;
  }
}

export function rememberLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Not remembered: the next page opens with the default.
  }
}
```

Run: `pnpm exec vitest run playground/tests/web/lang.test.ts`
Expected: PASS.

- [ ] **Step 4: Create `playground/web/routes/work.tsx`**

```tsx
import type { KeyBinding } from "@codemirror/view";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { toast } from "sonner";
import type { Lang } from "../../../runner/src/types.ts";
import type { TargetData } from "../../server/types.ts";
import { ApiError, conceptQuery, getSolution, keys, putSolution, runCustomInput, runTests, targetQuery } from "../api.ts";
import { CodeEditor } from "../components/CodeEditor.tsx";
import { ConceptView } from "../components/ConceptView.tsx";
import { ConsolePanel } from "../components/ConsolePanel.tsx";
import { type CustomInputHandle, CustomInputPanel } from "../components/CustomInputPanel.tsx";
import { Markdown } from "../components/Markdown.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { TestsPanel } from "../components/TestsPanel.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs.tsx";
import { useConnected, useRepoEvents } from "../events.tsx";
import { type SaveState, useSolutionSync } from "../hooks/useSolutionSync.ts";
import { pickLang, readRememberedLang, rememberLang } from "../lang.ts";
import { cn } from "../lib/cn.ts";

type PanelTab = "tests" | "custom" | "console";

const NOT_SAVED = "Your code is not saved yet, so it was not run. Resolve the message at the top, then try again.";

export function ProblemPage() {
  const { id } = useParams({ from: "/p/$id" });
  return <WorkPage key={id} id={id} />;
}

export function ExercisePage() {
  const { concept, nn } = useParams({ from: "/e/$concept/$nn" });
  const id = `${concept}/${nn}`;
  return <WorkPage key={id} id={id} />;
}

function WorkPage({ id }: { id: string }) {
  const target = useQuery(targetQuery(id));
  const [chosen, setChosen] = useState<Lang | null>(null);
  if (target.isPending) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  if (target.isError) {
    if (target.error instanceof ApiError && target.error.status === 404) {
      return <NotFound message={`There is no problem or exercise "${id}".`} />;
    }
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {target.error.message}
      </p>
    );
  }
  const lang = chosen ?? pickLang(target.data.solutions, readRememberedLang());
  // Freeze the first choice: a solution file created later must not switch the editor's language.
  if (chosen === null) setChosen(lang);
  const choose = (next: Lang) => {
    rememberLang(next);
    setChosen(next);
  };
  return <Workspace key={lang} target={target.data} lang={lang} onLang={choose} />;
}

function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = performance.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(performance.now() - started), 100);
    return () => clearInterval(timer);
  }, [active]);
  return elapsed;
}

const SAVE_LABEL: Record<SaveState, string> = {
  loading: "loading…",
  saved: "✓ saved",
  pending: "saving…",
  saving: "saving…",
  error: "✕ not saved",
  conflict: "⚠ not saved",
};

function SaveIndicator({ state, connected }: { state: SaveState; connected: boolean }) {
  const label = !connected && (state === "pending" || state === "saving") ? "✕ not saved" : SAVE_LABEL[state];
  const bad = label.startsWith("✕") || label.startsWith("⚠");
  return (
    <span role="status" aria-label="Save status" className={cn("text-xs", bad ? "text-red-600" : "text-neutral-500")}>
      {label}
    </span>
  );
}

function statusTone(status: TargetData["status"]) {
  if (status === "solved") return "green" as const;
  if (status === "revealed") return "amber" as const;
  return "neutral" as const;
}

function WorkHeader(props: {
  target: TargetData;
  lang: Lang;
  onLang(lang: Lang): void;
  saveState: SaveState;
  connected: boolean;
  running: boolean;
  canRun: boolean;
  onRun(): void;
}) {
  const { target } = props;
  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
      <Link to="/" className="text-neutral-500 hover:underline">
        ← Home
      </Link>
      <h1 className="font-semibold">
        {target.id} {target.title}
      </h1>
      {target.difficulty && <Badge>{target.difficulty}</Badge>}
      <Badge tone={statusTone(target.status)}>{target.status}</Badge>
      <span className="text-xs text-neutral-500">hints {target.hints}</span>
      {target.url && (
        <a href={target.url} target="_blank" rel="noreferrer" aria-label="Open the original problem" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          ↗
        </a>
      )}
      <div className="ml-auto flex items-center gap-3">
        <Tabs value={props.lang} onValueChange={(value) => props.onLang(value as Lang)}>
          <TabsList aria-label="Language" className="border-b-0">
            <TabsTrigger value="py">py</TabsTrigger>
            <TabsTrigger value="ts">ts</TabsTrigger>
          </TabsList>
        </Tabs>
        <SaveIndicator state={props.saveState} connected={props.connected} />
        <Button onClick={props.onRun} disabled={!props.canRun} title="Run the tests (⌘↵)">
          {props.running ? "Running…" : "▶ Run"} <kbd className="text-xs opacity-70">⌘↵</kbd>
        </Button>
      </div>
    </header>
  );
}

function ConflictBanner({ file, onDisk, onMine }: { file: string; onDisk(): void; onMine(): void }) {
  return (
    <div role="alert" className="flex items-center gap-3 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span>{file} changed on disk.</span>
      <Button size="sm" variant="outline" onClick={onDisk}>
        Use disk version
      </Button>
      <Button size="sm" variant="outline" onClick={onMine}>
        Keep mine
      </Button>
    </div>
  );
}

function SideConcept({ slug, onConcept }: { slug: string; onConcept(slug: string): void }) {
  const concept = useQuery(conceptQuery(slug));
  if (concept.isPending) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (concept.isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {concept.error.message}
      </p>
    );
  }
  return <ConceptView concept={concept.data} editable={false} onConcept={onConcept} />;
}

function StatementPane({ target, trail, onConcept, onBack }: { target: TargetData; trail: string[]; onConcept(slug: string): void; onBack(): void }) {
  const slug = trail.at(-1);
  if (slug) {
    return (
      <div>
        <nav aria-label="Concept trail" className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
          <Button size="sm" variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <span>Statement › {trail.join(" › ")}</span>
          <Link to="/c/$slug" params={{ slug }} className="ml-auto underline">
            Open the concept page
          </Link>
        </nav>
        <SideConcept key={slug} slug={slug} onConcept={onConcept} />
      </div>
    );
  }
  if (target.readmeError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {target.readme || "README.md"}: {target.readmeError}
      </p>
    );
  }
  return <Markdown source={target.markdown} readmePath={target.readme} onConcept={onConcept} />;
}

function Workspace({ target, lang, onLang }: { target: TargetData; lang: Lang; onLang(lang: Lang): void }) {
  const queryClient = useQueryClient();
  const connected = useConnected();
  const source = useMemo(
    () => ({
      load: () => getSolution(target.id, lang),
      save: (code: string, baseVersion: string) => putSolution(target.id, lang, code, baseVersion),
    }),
    [target.id, lang],
  );
  const sync = useSolutionSync(source, () => toast("Reloaded from disk"));
  const [tab, setTab] = useState<PanelTab>("tests");
  const [stale, setStale] = useState(false);
  const [trail, setTrail] = useState<string[]>([]);
  const custom = useRef<CustomInputHandle>(null);
  const columns = useDefaultLayout({ id: "work-columns", storage: localStorage });
  const rows = useDefaultLayout({ id: "work-rows", storage: localStorage });

  useRepoEvents((event) => {
    if (event.kind === "solution" && event.target === target.id && event.lang === lang) sync.diskChanged(event.version);
    if ((event.kind === "cases" || event.kind === "stress") && event.target === target.id) setStale(true);
  });

  // Saves what piled up while the server was unreachable.
  const { flush } = sync;
  useEffect(() => {
    if (connected) void flush();
  }, [connected, flush]);

  const run = useMutation({
    scope: { id: `${target.id}:${lang}` },
    mutationFn: async () => {
      if (!(await flush())) throw new Error(NOT_SAVED);
      return runTests(target.id, lang);
    },
    onMutate: () => setTab("tests"),
    onSuccess: () => {
      setStale(false);
      void queryClient.invalidateQueries({ queryKey: keys.target(target.id) });
    },
    onError: (error) => toast.error(error.message),
  });
  const elapsed = useElapsed(run.isPending);
  const canRun = target.caseError === null && sync.code !== null && !run.isPending;

  const runCustom = async (input: unknown) => {
    if (!(await flush())) throw new Error(NOT_SAVED);
    return runCustomInput(target.id, lang, input);
  };

  const actions = {
    run: () => {
      if (canRun) run.mutate();
    },
    custom: () => {
      setTab("custom");
      void custom.current?.submit();
    },
    save: () => {
      void flush();
    },
  };
  const latest = useRef(actions);
  useLayoutEffect(() => {
    latest.current = actions;
  });
  // Inside the editor. CodeMirror's own Mod-Enter would insert a blank line, so these take precedence.
  const bindings = useMemo<KeyBinding[]>(
    () => [
      { key: "Mod-Enter", run: () => (latest.current.run(), true) },
      { key: "Shift-Mod-Enter", run: () => (latest.current.custom(), true) },
      { key: "Mod-s", run: () => (latest.current.save(), true), preventDefault: true },
    ],
    [],
  );
  // Outside the editor. react-hotkeys-hook ignores content-editable targets, so the editor never runs twice.
  useHotkeys("mod+enter", () => latest.current.run(), { preventDefault: true });
  useHotkeys("mod+shift+enter", () => latest.current.custom(), { preventDefault: true, enableOnFormTags: true });
  useHotkeys("mod+s", () => latest.current.save(), { preventDefault: true, enableOnFormTags: true });

  const separator = "bg-neutral-200 transition-colors hover:bg-blue-400 dark:bg-neutral-800";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkHeader
        target={target}
        lang={lang}
        onLang={onLang}
        saveState={sync.state}
        connected={connected}
        running={run.isPending}
        canRun={canRun}
        onRun={actions.run}
      />
      {sync.conflict && <ConflictBanner file={`solution.${lang}`} onDisk={sync.takeDisk} onMine={() => void sync.keepMine()} />}
      {sync.state === "error" && sync.error && (
        <p role="alert" className="bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Not saved: {sync.error}
        </p>
      )}
      <Group orientation="horizontal" className="min-h-0 flex-1" defaultLayout={columns.defaultLayout} onLayoutChanged={columns.onLayoutChanged}>
        <Panel id="statement" defaultSize="40%" minSize="20%" className="overflow-y-auto p-4">
          <StatementPane
            target={target}
            trail={trail}
            onConcept={(slug) => setTrail((current) => (current.at(-1) === slug ? current : [...current, slug]))}
            onBack={() => setTrail((current) => current.slice(0, -1))}
          />
        </Panel>
        <Separator className={cn("w-1", separator)} />
        <Panel id="code" minSize="30%">
          <Group orientation="vertical" defaultLayout={rows.defaultLayout} onLayoutChanged={rows.onLayoutChanged}>
            <Panel id="editor" defaultSize="60%" minSize="20%">
              {sync.code === null ? (
                <p className="p-4 text-sm text-neutral-500">{sync.error ?? "Loading…"}</p>
              ) : (
                <CodeEditor lang={lang} value={sync.code} onChange={sync.edit} bindings={bindings} ariaLabel={`solution.${lang}`} className="h-full" autoFocus />
              )}
            </Panel>
            <Separator className={cn("h-1", separator)} />
            <Panel id="panels" minSize="15%">
              <Tabs value={tab} onValueChange={(value) => setTab(value as PanelTab)} className="flex h-full flex-col">
                <TabsList>
                  <TabsTrigger value="tests">Tests{run.data ? ` ${run.data.examples.passed}/${run.data.examples.total}` : ""}</TabsTrigger>
                  <TabsTrigger value="custom">Custom input</TabsTrigger>
                  <TabsTrigger value="console">Console</TabsTrigger>
                </TabsList>
                <TabsContent value="tests">
                  <TestsPanel
                    result={run.data ?? null}
                    running={run.isPending}
                    elapsedMs={elapsed}
                    stale={stale}
                    caseError={target.caseError}
                    paramNames={target.signature?.params.map((param) => param.name) ?? []}
                  />
                </TabsContent>
                {/* Always mounted, so its fields and last result survive tab switches and ⇧⌘↵ works from the editor. */}
                <TabsContent value="custom" forceMount>
                  <CustomInputPanel ref={custom} targetId={target.id} signature={target.signature} exampleInput={target.exampleInput} run={runCustom} />
                </TabsContent>
                <TabsContent value="console">
                  <ConsolePanel result={run.data ?? null} />
                </TabsContent>
              </Tabs>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
```

In `playground/web/router.tsx`, add `import { ExercisePage, ProblemPage } from "./routes/work.tsx";` and give the two routes their components:

```tsx
export const problemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/p/$id", component: ProblemPage });
export const exerciseRoute = createRoute({ getParentRoute: () => rootRoute, path: "/e/$concept/$nn", component: ExercisePage });
```

- [ ] **Step 5: Check the unit tests and types**

Run: `pnpm verify`
Expected: all green.

- [ ] **Step 6: Install Playwright and add the end-to-end setup**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

In `package.json` `scripts`, add:

```json
    "e2e": "playwright test -c playground/playwright.config.ts",
```

Append to `.gitignore`:

```
# Playwright
test-results/
playwright-report/
playground/e2e/.tmp/
```

Create `playground/e2e/fixture.ts`:

```ts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_PORT = 4391;
/** Inside the project, so TypeScript solutions resolve "lc" like everywhere else. */
export const E2E_ROOT = fileURLToPath(new URL("./.tmp/repo/", import.meta.url));

export const repoFile = (rel: string): string => path.join(E2E_ROOT, rel);

export const TWO_SUM_PY = [
  "class Solution:",
  "    def twoSum(self, nums: list[int], target: int) -> list[int]:",
  "        seen = {}",
  "        for i, n in enumerate(nums):",
  "            if target - n in seen:",
  "                return [seen[target - n], i]",
  "            seen[n] = i",
  "        return []",
  "",
].join("\n");

const PROBLEM_README = `---
id: lc-0001
title: Two Sum
source: leetcode
url: https://leetcode.com/problems/two-sum/
difficulty: easy
patterns: [arrays-hashing]
concepts: [hash-map]
status: todo
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 1. Two Sum

## Statement

Return the indices of the two numbers in \`nums\` that add up to \`target\`.

## Concepts

<!-- auto:concepts -->
- [Hash map](../../concepts/hash-map/README.md) · learning
<!-- /auto -->

## Log

- 2026-09-28 · created for the end-to-end tests
`;

const CASES = {
  entry: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
  compare: "unordered",
  examples: [
    { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
    { input: [[3, 2, 4], 6], expected: [1, 2] },
  ],
  hidden: [
    { input: [[3, 3], 6], expected: [0, 1] },
    { input: [[-1, -2, -3, -4, -5], -8], expected: [2, 4] },
  ],
};

export const EXPLANATION_NOTE = "<!-- Write this yourself, in your own words. Claude never fills this section. -->";

const CONCEPT_README = `---
slug: hash-map
title: Hash map
status: learning
requires: []
related: []
---
# Hash map

## Intuition

A coat check: the ticket number tells you the hook.

## Exercises

<!-- auto:exercises -->
<!-- /auto -->

## My explanation

${EXPLANATION_NOTE}

## Problems

<!-- auto:problems -->
- ○ [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)
<!-- /auto -->
`;

const FILES: Record<string, string> = {
  "problems/lc-0001-two-sum/README.md": PROBLEM_README,
  "problems/lc-0001-two-sum/cases.json": `${JSON.stringify(CASES, null, 2)}\n`,
  "concepts/hash-map/README.md": CONCEPT_README,
};

/** Puts the e2e repo back in its starting state without deleting folders the server is watching. */
export function resetRepo(): void {
  for (const lang of ["py", "ts"]) rmSync(repoFile(`problems/lc-0001-two-sum/solution.${lang}`), { force: true });
  for (const [rel, content] of Object.entries(FILES)) {
    mkdirSync(path.dirname(repoFile(rel)), { recursive: true });
    writeFileSync(repoFile(rel), content);
  }
}
```

Create `playground/e2e/serve.ts`:

```ts
import { startPlayground } from "../start.ts";
import { E2E_PORT, E2E_ROOT, resetRepo } from "./fixture.ts";

// The API reads ALGO_ROOT when Vite first loads it, which happens on the first request after this.
resetRepo();
process.env.ALGO_ROOT = E2E_ROOT;
const playground = await startPlayground({ route: "/", open: false, port: E2E_PORT, strictPort: true });
process.stdout.write(`e2e playground: ${playground.url}\n`);
```

Create `playground/e2e/helpers.ts`:

```ts
import type { Page } from "@playwright/test";

/** Replaces the editor's content the way a paste would (no auto-indent or bracket closing on the way in). */
export async function replaceCode(page: Page, code: string, label = "solution.py"): Promise<void> {
  await page.getByRole("textbox", { name: label }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
}
```

Create `playground/playwright.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./e2e/fixture.ts";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../test-results",
  // One server and one repo on disk: tests run one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${E2E_PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec tsx playground/e2e/serve.ts",
    cwd: REPO_ROOT,
    url: `http://127.0.0.1:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

- [ ] **Step 7: Write the end-to-end test**

Create `playground/e2e/work.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { repoFile, resetRepo, TWO_SUM_PY } from "./fixture.ts";
import { replaceCode } from "./helpers.ts";

test.beforeEach(() => resetRepo());

test("goes from the home page to a green run with ⌘↵", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "lc-0001 Two Sum" }).click();
  await expect(page).toHaveURL(/\/p\/lc-0001$/);
  await expect(page.getByRole("heading", { name: "1. Two Sum" })).toBeVisible();
  await replaceCode(page, TWO_SUM_PY);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText(/Green in py/)).toBeVisible({ timeout: 20_000 });
  expect(readFileSync(repoFile("problems/lc-0001-two-sum/solution.py"), "utf8")).toBe(TWO_SUM_PY);
});

test("shows what a failing example expected and what the code returned", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        return [0, 0]\n");
  await page.getByRole("button", { name: /^▶ Run/ }).click();
  await expect(page.getByText("nums=[3,2,4], target=6")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Hidden · skipped until the examples pass/)).toBeVisible();
});

test("the editor never suggests anything", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toHaveAttribute("spellcheck", "false");
  await expect(editor).toHaveAttribute("autocorrect", "off");
  await expect(editor).toHaveAttribute("autocapitalize", "off");
  await expect(editor).toHaveAttribute("writingsuggestions", "false");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\nnums.");
  await page.waitForTimeout(1000);
  await expect(page.locator(".cm-tooltip")).toHaveCount(0);
});

test("switching to TypeScript opens solution.ts with its stub", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await page.getByRole("tab", { name: "ts", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "solution.ts" })).toContainText("export default function twoSum");
});
```

- [ ] **Step 8: Run the end-to-end tests**

Run: `pnpm e2e`
Expected: 4 passed. (If Chromium is missing, run `pnpm exec playwright install chromium` first.)

- [ ] **Step 9: Commit**

```bash
git add playground/web/lang.ts playground/web/routes/work.tsx playground/web/router.tsx playground/tests/web/lang.test.ts playground/playwright.config.ts playground/e2e/fixture.ts playground/e2e/serve.ts playground/e2e/helpers.ts playground/e2e/work.spec.ts package.json pnpm-lock.yaml .gitignore
git commit -m "feat(playground): add the work view with editor, panels and shortcuts"
```

---

### Task 15: End-to-end — files on disk, conflicts and concepts

**Files:**
- Create: `playground/e2e/live.spec.ts`

**Interfaces:**
- Consumes: `resetRepo`, `repoFile`, `TWO_SUM_PY`, `EXPLANATION_NOTE` (`playground/e2e/fixture.ts`); `replaceCode` (`playground/e2e/helpers.ts`); the accessible names from Task 14 (`solution.py` textbox, `▶ Run` button, `Save status`) and Task 12 (`✎ Edit`, `My explanation` textbox, `Save`).
- Produces: browser coverage for spec §10 "End to end": autosave to disk, reload after an outside change, a conflict that loses nothing, the concept side pane, and saving "My explanation".

- [ ] **Step 1: Write the tests**

Create `playground/e2e/live.spec.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { EXPLANATION_NOTE, repoFile, resetRepo, TWO_SUM_PY } from "./fixture.ts";
import { replaceCode } from "./helpers.ts";

const SOLUTION = repoFile("problems/lc-0001-two-sum/solution.py");
const readSolution = () => readFileSync(SOLUTION, "utf8");

test.beforeEach(() => resetRepo());

test("autosave writes the file on disk without pressing anything", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, TWO_SUM_PY);
  await expect.poll(readSolution).toBe(TWO_SUM_PY);
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("✓ saved");
});

test("a change made outside the browser reloads the editor", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  // Written again until the page has picked it up: the live connection may still be opening.
  await expect(async () => {
    writeFileSync(SOLUTION, "# written in VS Code\n");
    await expect(editor).toContainText("# written in VS Code", { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("Reloaded from disk")).toBeVisible();
});

test("a conflict keeps both versions until the user picks one", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const editor = page.getByRole("textbox", { name: "solution.py" });
  await expect(editor).toContainText("def twoSum");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n# mine\n");
  writeFileSync(SOLUTION, "# theirs\n"); // lands before the 500 ms autosave
  await expect(page.getByText("solution.py changed on disk.")).toBeVisible();
  await expect(editor).toContainText("# mine");
  expect(readSolution()).toBe("# theirs\n");
  await page.getByRole("button", { name: "Keep mine" }).click();
  await expect.poll(readSolution).toContain("# mine");
});

test("a concept link opens next to the editor, and Back returns to the statement", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await page.getByRole("button", { name: "Hash map" }).click();
  await expect(page.getByRole("heading", { name: "Intuition" })).toBeVisible();
  await expect(page.getByText("Statement › hash-map")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "solution.py" })).toBeVisible();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.getByRole("heading", { name: "1. Two Sum" })).toBeVisible();
});

test("My explanation is saved into the README and nothing else changes", async ({ page }) => {
  const before = readFileSync(repoFile("concepts/hash-map/README.md"), "utf8");
  const text = "Un mapa hash convierte la clave en una posición. 🎟️";
  await page.goto("/c/hash-map");
  await page.getByRole("button", { name: "✎ Edit" }).click();
  await page.getByRole("textbox", { name: "My explanation" }).click();
  await page.keyboard.insertText(text);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "✎ Edit" })).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();
  expect(readFileSync(repoFile("concepts/hash-map/README.md"), "utf8")).toBe(
    before.replace(`${EXPLANATION_NOTE}\n\n## Problems`, `${EXPLANATION_NOTE}\n\n${text}\n\n## Problems`),
  );
});
```

- [ ] **Step 2: Run them**

Run: `pnpm e2e`
Expected: 9 passed (4 from Task 14, 5 here).

If a test fails, read Playwright's trace (`pnpm exec playwright show-trace test-results/<test>/trace.zip`) and fix the app, not the assertion, unless the assertion contradicts the spec.

- [ ] **Step 3: Commit**

```bash
git add playground/e2e/live.spec.ts
git commit -m "test(playground): cover autosave, outside edits, conflicts and concepts in the browser"
```

---

### Task 16: Claude layer and docs

**Files:**
- Modify: `.claude/hooks/guard-solution.mjs`, `scripts/tests/hooks.test.ts`, `README.md`, `CLAUDE.md`, `.claude/skills/problem/SKILL.md`, `.claude/skills/concept/SKILL.md`

**Interfaces:**
- Consumes: the guard's `segmentReason`, `inlineCodeWrites` and `commandOf` (`.claude/hooks/guard-solution.mjs`), and the test helpers `expectBash` and `bashReason` in `scripts/tests/hooks.test.ts`.
- Produces: the guard denies `curl`, `wget`, `http`, `https`, `xh` and `xhs` commands that mention `/api/solution` or `/api/concept/explanation`, and inline interpreter code (`node -e`, `python -c`…) that mentions them. The docs describe `pnpm play` and `pnpm e2e`.

- [ ] **Step 1: Write the failing hook test**

In `scripts/tests/hooks.test.ts`, add inside `describe("guard-solution hook", …)`:

```ts
  it("denies calls to the playground API that would read or write the user's files", () => {
    expectBash(
      [
        `curl -X PUT http://127.0.0.1:4173/api/solution -H 'content-type: application/json' -d '{"id":"lc-0001"}'`,
        `curl -s "http://localhost:4173/api/solution?id=lc-0001&lang=py"`,
        `wget --method=PUT http://127.0.0.1:4173/api/concept/explanation`,
        `http PUT :4173/api/solution id=lc-0001`,
        `node -e "fetch('http://127.0.0.1:4173/api/solution', { method: 'PUT' })"`,
      ],
      "deny",
    );
    expect(bashReason(`curl -X PUT http://127.0.0.1:4173/api/solution`)).toContain("playground API");
    expectBash([`curl -s http://127.0.0.1:4173/api/home`, `curl -s -X POST http://127.0.0.1:4173/api/run -d '{}'`], "allow");
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run scripts/tests/hooks.test.ts`
Expected: FAIL: the new commands are allowed.

- [ ] **Step 3: Extend the guard**

In `.claude/hooks/guard-solution.mjs`, add after the `DISCARD_REASON` constant:

```js
const PLAYGROUND_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): the playground API (pnpm play) reads and writes the user's solution files " +
  'and their "My explanation". Do not call /api/solution or /api/concept/explanation. If the user asked for help, follow the hint skill.';
/** Playground routes that touch the user's files (reading a solution creates its stub). */
const PLAYGROUND_FILES = /\/api\/(?:solution|concept\/explanation)\b/;
const HTTP_CLIENTS = new Set(["curl", "wget", "http", "https", "xh", "xhs"]);
```

In `segmentReason`, add this line right before `if (inlineCodeWrites(segment, index, command, stage)) return WRITE_REASON;`:

```js
    if (HTTP_CLIENTS.has(command.name) && command.args.some((arg) => PLAYGROUND_FILES.test(arg))) return PLAYGROUND_REASON;
```

In `inlineCodeWrites`, change its doc comment to `/** Does an interpreter in stage \`index\` run inline or stdin code that names a solution file or the playground API? */` and its last line to:

```js
  return code.some((text) => MENTIONS_SOLUTION.test(text) || PLAYGROUND_FILES.test(text));
```

- [ ] **Step 4: Run the hook tests**

Run: `pnpm exec vitest run scripts/tests/hooks.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `README.md`**

In **Requirements**, add a line: `- A desktop browser (Chrome, Firefox or Safari) for the web playground`.

In **Daily flow**, replace step 3 with:

```markdown
3. `pnpm play <problem>` opens the web playground: statement and concept notes on the left, the editor on the right, ▶ Run (⌘↵) for the tests. Prefer the terminal? `pnpm watch <problem> --open` reruns the tests on every save in VS Code.
```

In **Commands**, add these rows at the top of the table, and change the `pnpm verify` row:

```markdown
| `pnpm play [query] [--no-open] [--port <n>]` | Opens the web playground (home page, or the problem you name) |
| `pnpm e2e` | Runs the playground's browser tests (first time: `pnpm exec playwright install chromium`) |
| `pnpm verify` | Runs the tool tests, the type checks and `check` |
```

Add a section before **Map**:

```markdown
## Web playground

`pnpm play` starts a local server on `127.0.0.1` (port 4173, or the next free one) and opens the browser.

- **Home:** work in progress, problems by pattern, concepts with their exercises. Status badges update live when Claude edits a README.
- **Work view:** the statement with clickable concept links (a concept opens next to the editor), an editor with syntax colors, auto-indent and bracket matching, but no autocomplete, no suggestions and no AI. Your code is saved to `solution.py` / `solution.ts` 500 ms after you stop typing, so Claude always reads what you see.
- **Run (⌘↵):** the same examples, hidden and stress cases as `pnpm test`. Hidden answers never reach the browser.
- **Custom input (⇧⌘↵):** run your code on your own input and see what it returns and prints.
- **Concept page:** read the note and write "My explanation" (the only part of a README the playground edits).

When you are green, ask Claude for `/review` in the terminal: the playground never changes a problem's status.
```

In **Map**, add: `- [Web playground spec](docs/superpowers/specs/2026-09-28-web-playground-design.md)`.

- [ ] **Step 6: Update `CLAUDE.md` and the two skills**

In `CLAUDE.md` **Repo map**, add after the `runner/` line:

```markdown
- `playground/`: the web playground (`pnpm play`): a Vite + React app and a Hono API that call the runner.
```

In `CLAUDE.md` **Commands**, add after the `pnpm watch` line:

```markdown
- `pnpm play [query]`: the web playground, for the user. Do not start it. It writes the same `solution.*` files the user would (autosave) and the "My explanation" section, and never frontmatter: treat what it writes as the user's own edits.
```

In `.claude/skills/problem/SKILL.md`, step 8, replace the first bullet with:

```markdown
- The problem title, its folder, and how to start: `pnpm play <id>` (web) or `pnpm watch <id> --open` (terminal; add `--lang ts` for TypeScript).
```

In `.claude/skills/concept/SKILL.md`, step 6, replace the exercise-list bullet with:

```markdown
   - The exercise list, each with `pnpm play <slug>/<NN>` (web) or `pnpm watch <slug>/<NN> --open` (terminal).
```

- [ ] **Step 7: Run everything**

Run: `pnpm verify`
Expected: all tests pass (including `claude-layer.test.ts`), both type checks are clean, `0 error(s)`.

Run: `pnpm e2e`
Expected: 9 passed.

- [ ] **Step 8: Commit**

```bash
git add .claude/hooks/guard-solution.mjs scripts/tests/hooks.test.ts README.md CLAUDE.md .claude/skills/problem/SKILL.md .claude/skills/concept/SKILL.md
git commit -m "docs(playground): document pnpm play and guard its API from Claude"
```

---

## Final verification (after Task 16)

- [ ] `pnpm verify`: all vitest projects pass, `tsc --noEmit` and `tsc -p playground` print nothing, `pnpm check` reports `0 error(s)`.
- [ ] `pnpm e2e`: 9 passed.
- [ ] `git status` in the worktree is clean, and `git log restructure..playground --oneline` shows the 16 task commits.
- [ ] Spec coverage, section by section:
  - §3.2 CLI → Task 3.
  - §4.1 Home → Task 8.
  - §4.2 Work view → Tasks 10, 11 and 14.
  - §4.3 Editor → Tasks 12 and 14.
  - §4.4 Concept page → Task 12.
  - §4.5 Links → Task 9.
  - §5 API → Tasks 3–7.
  - §6.1 Autosave → Task 13.
  - §6.2 Run and §6.3 Custom input → Tasks 1, 5 and 14.
  - §6.4 Live events → Tasks 7 and 8.
  - §6.5 Markdown → Task 9.
  - §6.6 "My explanation" → Task 6.
  - §7 Security → Tasks 3, 6 and 16.
  - §8 Errors → Tasks 8, 10, 12 and 14.
  - §9 Claude layer and docs → Task 16.
  - §10 Tests → every task.

**Manual acceptance for the user (spec §10):**
1. `pnpm play two-sum` in Chrome. Solve it without opening VS Code: read the statement, open the Hash map note from the statement, write the code, ⌘↵, and see the green banner.
2. Type `nums.` in the editor: nothing pops up. Switch the operating system to dark mode: the page and the editor follow.
3. With `pnpm play` running, ask Claude for `/review` in the terminal and watch the status badge change without reloading.
