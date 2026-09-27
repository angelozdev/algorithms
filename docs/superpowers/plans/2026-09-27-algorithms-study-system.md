# Algorithms Study System (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `algorithms/` repo into a spoiler-free study system: a Markdown knowledge base of problems and concepts, a TypeScript test engine with Python/TypeScript harnesses and a terminal watch mode, index/validation scripts, and a project-level Claude layer (rules, skills, hooks).

**Architecture:** A TypeScript orchestrator (`runner/src`) loads `cases.json`, spawns a per-language harness (`runner/harness/{python,ts}`) that talks JSON over fd 3 and never sees expected values, compares results, and reports to the terminal or as JSON. Scripts (`scripts/`) read Markdown frontmatter through a shared repo model (`lib/`) to generate indexes/backlinks and validate the repo. Claude behavior lives in `CLAUDE.md`, five project skills, and two hooks under `.claude/`.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript (run with tsx), vitest, zod 4, yaml; Python 3.13 via uv.

**Spec:** `docs/superpowers/specs/2026-09-27-algorithms-study-system-design.md`

## Global Constraints

- Every file in the repo is written in **English**. Claude chats with the user in **Spanish**.
- Claude configuration is **project-level only** (`algorithms/.claude/`). Nothing goes to `~/.claude/`.
- Runtimes: Node.js ≥ 24, pnpm 11, Python **3.13** resolved with `uv python find` (pinned by `.python-version`).
- Dependencies: prefer well-maintained libraries over hand-rolled code when they remove real complexity or flakiness (amended during execution: `chokidar` for watch mode, `node-html-markdown` for LeetCode statements). Keep native `fetch`, `node:util` `parseArgs`/`styleText`, `yaml` + the small frontmatter parser, `zod`, the custom `node:child_process` executor, and pnpm scripts; the Python harness stays stdlib-only.
- The harness request **never includes `expected`**. No terminal or JSON output ever contains a hidden case's expected value.
- Limits: examples + hidden process wall clock **5000 ms**; stress **2000 ms per case** (default), stress process wall clock = sum of stress limits **+ 2000 ms**; captured stdout shown truncated to **20 lines**.
- Default language is `py`.
- The repo is **public on GitHub**: problem statements are short English paraphrases + examples + constraints + URL, never verbatim copies.
- Naming: problem folder `<platform>-<NNNN>-<slug>` (e.g. `lc-0001-two-sum`), problem id `lc-0001`; exercise folder `concepts/<concept>/exercises/<NN>-<slug>/`, exercise id `<concept>/<NN>`.
- Frontmatter is the source of truth; only `<!-- auto:<name> -->` … `<!-- /auto -->` sections and the two `INDEX.md` files are machine-written.
- Reference solutions (used to compute expected values) are **never** written inside the repo.
- Tests exercise behavior through public interfaces (module entry points, the CLI, hook stdin/stdout), not internals.
- Commit messages follow Conventional Commits.

## Review Focus

These five inputs are implied by the spec but no requirement names them. Each has a test in the task that owns the code:

1. **Editors that save by writing a temp file and renaming it** (atomic save). Watch mode must still rerun. → Task 10, `watchFiles` rename test.
2. **Runaway prints** (a `print` inside a 10⁶ loop). The harness caps captured output at 64 KB, the report shows at most 20 lines, and the run still completes. → Task 2 and Task 3 flood tests, Task 8 truncation test.
3. **Return values that are not JSON** (Python `set`, TypeScript `Map`, `NaN`). The case reports a `serialization` error instead of crashing the harness. → Task 2 and Task 3.
4. **Non-ASCII strings** (`ñandú 🎵`). They round-trip unchanged through both harnesses. → Task 2 and Task 3.
5. **`cases.json` broken while watch is running.** Watch prints a case-file error and keeps watching. → Task 10, `renderRun` test.

## Deviations from the spec (decided while planning)

| Spec says | Plan does | Why |
|---|---|---|
| Layout lists `runner/` and `scripts/` | Adds a small shared `lib/` (frontmatter parser, repo scanner, frontmatter schemas) | The runner, sync and check all read the same Markdown model. |
| Migration statements "pulled via LeetCode GraphQL" | Adds `pnpm leetcode <slug>` (`scripts/leetcode.ts`), which prints a JSON draft (statement text, signature, examples) | The `problem` skill reuses it for every LeetCode problem, not only during migration. |
| "Hidden runs only if all examples pass" | Examples and hidden run in the **same** harness process; hidden results are reported as `skipped` when an example fails | Saves one process start per save (~300 ms for TS). What the user sees is identical. |
| TS harness run by `tsx` | Run as `node --import <tsx loader> harness.ts` with `TSX_TSCONFIG_PATH` | The `tsx` CLI runs the script in a child process that does not inherit fd 3 (verified: `ENXIO`). |
| User prints "attributed to the case that was running" | Captured in-process per case (`redirect_stdout`/`redirect_stderr` in Python; `process.stdout.write`/`process.stderr.write` patched in TS) | Exact attribution without racing two pipes. |
| — | `give-up` skill has `disable-model-invocation: true` | Revealing a solution must only happen when the user types `/give-up`. |
| Rules 6–7 of spec §6.1 are language and style | `CLAUDE.md` gives language and profile their own sections, and makes two more hard rules explicit: no approach or complexity target volunteered before green, and reference solutions only in `$TMPDIR` | Both were agreed during brainstorming. Numbering them makes them checkable. |
| — | `.claude/settings.json` also allow-lists `pnpm -s test/sync/check/leetcode/fill-expected` | The skills run these constantly; approving each call would break the flow. |
| — | `pnpm-workspace.yaml` with `allowBuilds: { esbuild: true }` | pnpm 11 fails `install` with `ERR_PNPM_IGNORED_BUILDS` otherwise (verified). |
| — | Env overrides `ALGO_ROOT` (content root) and `ALGO_PYTHON` (interpreter) | Lets tests point the CLI at a temporary repo. |
| Example `patterns: [hashing]` | Fixed pattern vocabulary: `arrays-hashing, two-pointers, sliding-window, stack, binary-search, linked-list, trees, tries, heap, backtracking, graphs, dp-1d, dp-2d, greedy, intervals, math, bit-manipulation, strings` | `INDEX.md` groups stay consistent, and `check` rejects typos. |
| Migration hidden `expected` via `fill-expected` | The 19 migrated `cases.json` files are embedded in this plan, with hidden expected values precomputed during planning by reference solutions that lived outside the repo | No reference solution ever enters the repo or the plan. The values are already verified. |

## File Structure

```
algorithms/
├── package.json · pnpm-workspace.yaml · tsconfig.json · vitest.config.ts   (Task 1)
├── pyproject.toml · .python-version · .gitignore (modified)                 (Task 1)
├── lib/
│   ├── frontmatter.ts      parseMarkdown(text) → { head, data, body }        (Task 6)
│   ├── repo.ts             scanRepo(root) → problems/exercises/concepts      (Task 6)
│   └── schemas.ts          zod frontmatter schemas + PATTERNS               (Task 13)
├── runner/
│   ├── src/
│   │   ├── types.ts        shared types (CaseFile, Target, RunResult, …)    (Task 1)
│   │   ├── paths.ts        REPO_ROOT, HARNESS_DIR, contentRoot()            (Task 1)
│   │   ├── schema.ts       parse/validate/format cases.json                 (Task 1)
│   │   ├── executor.ts     runHarness(lang, request, {wallLimitMs})         (Task 2)
│   │   ├── compare.ts      matches / judgedValue / compareValue             (Task 4)
│   │   ├── stress.ts       Rng, StressCase, loadStressCases                 (Task 5)
│   │   ├── resolver.ts     listTargets / resolveQuery                        (Task 6)
│   │   ├── stubs.ts        renderStub / ensureSolution                       (Task 7)
│   │   ├── run.ts          runTarget(target, lang, options)                  (Task 8)
│   │   ├── reporter.ts     formatTerminal(result)                            (Task 9)
│   │   ├── cli.ts          watch | test | fill-expected                      (Tasks 9–11)
│   │   ├── watcher.ts      watchFiles / renderRun / watchTarget             (Task 10)
│   │   └── fill-expected.ts fillExpected(target, refPath, root)             (Task 11)
│   ├── harness/
│   │   ├── python/{harness.py, lc.py}                                        (Task 2)
│   │   └── ts/{harness.ts, lc.ts}                                            (Task 3)
│   └── tests/              vitest suites + helpers.ts (temp dirs in .tmp/)  (Tasks 1–11)
├── scripts/
│   ├── lib/{auto.ts, render.ts, sync.ts, checks.ts, leetcode.ts}            (Tasks 12–14)
│   ├── sync.ts · check.ts · leetcode.ts   thin CLIs                          (Tasks 12–14)
│   └── tests/              fixture + sync, check, leetcode, claude-layer, hooks suites (Tasks 12–14, 18, 19)
├── problems/lc-NNNN-*/     19 migrated problems                             (Tasks 15–17)
├── concepts/hash-map/      first concept + 3 exercises                      (Task 20)
├── INDEX.md · concepts/INDEX.md   generated                                 (Task 12+)
├── CLAUDE.md · README.md · .vscode/settings.json                            (Task 18)
├── .claude/skills/{problem,concept,hint,review,give-up}/SKILL.md            (Task 18)
├── .claude/settings.json · .claude/hooks/{guard-solution,reminder}.mjs      (Task 19)
├── AGENTS.md -> CLAUDE.md                                                    (Task 19)
└── archive/                legacy rust/, swift/, ts data structures, configs (Task 15)
```

**Working directory for every command:** `/Users/angelozdev/me/algorithms`, on branch `restructure`.

---
### Task 1: Tooling baseline and the `cases.json` schema

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `pyproject.toml`, `.python-version`
- Modify: `.gitignore` (append)
- Create: `runner/src/types.ts`, `runner/src/paths.ts`, `runner/src/schema.ts`
- Test: `runner/tests/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `runner/src/types.ts`: every shared type (`Lang`, `LANGS`, `CompareMode`, `Param`, `InPlace`, `CaseEntry`, `CaseFile`, `TargetKind`, `Target`, `HarnessErrorKind`, `HarnessError`, `HarnessRequest`, `HarnessMessage`, `CaseRun`, `HarnessOutcome`, `CaseStatus`, `ExampleResult`, `HiddenFailure`, `HiddenResult`, `StressStatus`, `StressCaseResult`, `StressResult`, `RunResult`), exactly as written below.
  - `runner/src/paths.ts`: `REPO_ROOT: string`, `HARNESS_DIR: string`, `TSX_BIN: string`, `contentRoot(): string`.
  - `runner/src/schema.ts`: `class CaseFileError extends Error { issues: string[] }`, `isValueType(type: string): boolean`, `formatPath(segments: readonly PropertyKey[]): string`, `parseCaseFile(raw: unknown): CaseFile`, `loadRawCaseFile(dir: string): Record<string, unknown>`, `loadCaseFile(dir: string): CaseFile`, `assertHiddenFilled(cf: CaseFile): void`, `formatCasesJson(obj: Record<string, unknown>): string`.

- [ ] **Step 1: Create the tooling files**

`package.json`:

```json
{
  "name": "algorithms",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Study algorithms with Claude Code without spoilers: concepts, problems, and a local test runner.",
  "license": "MIT",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "watch": "tsx runner/src/cli.ts watch",
    "test": "tsx runner/src/cli.ts test",
    "fill-expected": "tsx runner/src/cli.ts fill-expected",
    "leetcode": "tsx scripts/leetcode.ts",
    "sync": "tsx scripts/sync.ts",
    "check": "tsx scripts/check.ts",
    "verify": "vitest run && tsx scripts/check.ts"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "types": ["node"],
    "paths": {
      "lc": ["./runner/harness/ts/lc.ts"]
    }
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "archive"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["runner/tests/**/*.test.ts", "scripts/tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

`pyproject.toml`:

```toml
[project]
name = "algorithms"
version = "1.0.0"
requires-python = ">=3.13"

[tool.ruff]
line-length = 88
target-version = "py313"
extend-exclude = ["archive"]

[tool.ruff.lint]
select = ["E", "W", "F", "I", "UP", "B", "C4", "SIM"]

[tool.ruff.lint.isort]
known-first-party = ["lc"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

`.python-version`:

```
3.13
```

Append to `.gitignore`:

```
# Runner test scratch space
runner/tests/.tmp/
```

- [ ] **Step 2: Install dependencies and check the Python toolchain**

Run:

```bash
pnpm add zod yaml && pnpm add -D typescript tsx vitest @types/node
uv python find
```

Expected: pnpm finishes with exit code 0 (no `ERR_PNPM_IGNORED_BUILDS`, thanks to `pnpm-workspace.yaml`). `uv python find` prints a path containing `3.13`. If it prints nothing or fails, run `uv python install 3.13` and repeat.

- [ ] **Step 3: Write the shared types and paths**

`runner/src/types.ts`:

```ts
export type Lang = "py" | "ts";
export const LANGS: readonly Lang[] = ["py", "ts"];

export type CompareMode = "exact" | "unordered" | "float" | "any-of";

export interface Param {
  name: string;
  type: string;
}

export interface InPlace {
  param: string;
  prefix?: "return";
}

/** One entry of `examples` or `hidden`. `expected === undefined` means "not filled yet". */
export interface CaseEntry {
  input: unknown;
  expected?: unknown;
}

/** Normalized cases.json (defaults applied). */
export interface CaseFile {
  mode: "function" | "class";
  entry: string;
  params: Param[];
  returns: string | null;
  compare: CompareMode;
  inPlace: InPlace | null;
  examples: CaseEntry[];
  hidden: CaseEntry[];
}

export type TargetKind = "problem" | "exercise";

/** A runnable folder (it has a cases.json): a problem or a concept exercise. */
export interface Target {
  id: string;
  kind: TargetKind;
  dir: string;
  title: string;
}

export type HarnessErrorKind =
  | "load"
  | "missing-entry"
  | "exception"
  | "serialization"
  | "timeout"
  | "crash";

export interface HarnessError {
  kind: HarnessErrorKind;
  message: string;
  trace: string;
}

/** Sent to a harness on stdin. Never contains expected values. */
export interface HarnessRequest {
  solutionPath: string;
  mode: "function" | "class";
  entry: string;
  params: Param[];
  returns: string | null;
  inPlace: InPlace | null;
  discardOutput: boolean;
  cases: { id: string; input: unknown }[];
}

/** One JSON line written by a harness on fd 3. */
export type HarnessMessage =
  | { type: "ready" }
  | { type: "fatal"; error: HarnessError }
  | { type: "start"; id: string }
  | { type: "case"; id: string; ok: true; output: unknown; ms: number; stdout: string }
  | { type: "case"; id: string; ok: false; error: HarnessError; ms: number; stdout: string };

export interface CaseRun {
  id: string;
  ok: boolean;
  output?: unknown;
  error?: HarnessError;
  ms: number;
  stdout: string;
}

export interface HarnessOutcome {
  fatal: HarnessError | null;
  runs: Map<string, CaseRun>;
  /** Case that was running when the wall-clock limit killed the process. */
  timedOutCase: string | null;
  stderr: string;
}

export type CaseStatus = "pass" | "fail" | "error" | "timeout" | "skipped";

export interface ExampleResult {
  id: number;
  status: CaseStatus;
  input: unknown;
  expected: unknown;
  output?: unknown;
  error?: HarnessError;
  ms?: number;
  stdout: string;
}

/** Never carries an expected value: hidden answers stay inside the orchestrator. */
export interface HiddenFailure {
  input: unknown;
  output?: unknown;
  error?: HarnessError;
  stdout: string;
}

export interface HiddenResult {
  status: "pass" | "fail" | "skipped";
  passed: number;
  total: number;
  firstFailure: HiddenFailure | null;
}

export type StressStatus = "pass" | "slow" | "timeout" | "error" | "skipped";

export interface StressCaseResult {
  name: string;
  status: StressStatus;
  ms?: number;
  limitMs: number;
  error?: HarnessError;
}

export interface StressResult {
  status: "pass" | "fail" | "skipped" | "none";
  cases: StressCaseResult[];
}

export interface RunResult {
  id: string;
  title: string;
  lang: Lang;
  readme: string;
  solution: string;
  fatal: HarnessError | null;
  examples: { passed: number; total: number; cases: ExampleResult[] };
  hidden: HiddenResult;
  stress: StressResult;
  green: boolean;
}
```

`runner/src/paths.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root: where package.json, runner/ and the harnesses live. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const HARNESS_DIR = path.join(REPO_ROOT, "runner", "harness");
export const TSX_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");

/** Folder that contains problems/ and concepts/. Tests point it elsewhere with ALGO_ROOT. */
export function contentRoot(): string {
  return process.env.ALGO_ROOT ? path.resolve(process.env.ALGO_ROOT) : REPO_ROOT;
}
```

- [ ] **Step 4: Write the failing schema tests**

`runner/tests/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  assertHiddenFilled,
  CaseFileError,
  formatCasesJson,
  parseCaseFile,
} from "../src/schema.ts";

const valid = {
  entry: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
  examples: [{ input: [[2, 7, 11, 15], 9], expected: [0, 1] }],
  hidden: [{ input: [[3, 3], 6] }],
};

function issuesOf(raw: unknown): string[] {
  try {
    parseCaseFile(raw);
  } catch (error) {
    if (error instanceof CaseFileError) return error.issues;
    throw error;
  }
  return [];
}

describe("parseCaseFile", () => {
  it("applies defaults and keeps unfilled hidden expected values undefined", () => {
    const cf = parseCaseFile(valid);
    expect(cf.mode).toBe("function");
    expect(cf.compare).toBe("exact");
    expect(cf.inPlace).toBeNull();
    expect(cf.hidden[0].expected).toBeUndefined();
  });

  it("keeps null as a real expected value", () => {
    const cf = parseCaseFile({ ...valid, hidden: [{ input: [[3, 3], 6], expected: null }] });
    expect(cf.hidden[0].expected).toBeNull();
  });

  it("points at the exact field when an input has the wrong arity", () => {
    const issues = issuesOf({
      ...valid,
      hidden: [{ input: [[1, 2], 3] }, { input: [[1]] }],
    });
    expect(issues).toEqual(["hidden[1].input: expected 2 params, got 1"]);
  });

  it("rejects unknown types", () => {
    const issues = issuesOf({ ...valid, params: [{ name: "nums", type: "list" }, valid.params[1]] });
    expect(issues[0]).toMatch(/^params\[0\]\.type: unknown type/);
  });

  it("requires expected on every example", () => {
    const issues = issuesOf({ ...valid, examples: [{ input: [[1], 1] }] });
    expect(issues).toContain("examples[0].expected: required");
  });

  it("rejects unknown top-level keys", () => {
    expect(issuesOf({ ...valid, extra: true }).join("\n")).toMatch(/Unrecognized key/);
  });

  it("checks that inPlace.param is a declared param", () => {
    const issues = issuesOf({ ...valid, inPlace: { param: "arr", prefix: "return" } });
    expect(issues).toContain('inPlace.param: "arr" is not a param name');
  });

  it("validates class-mode inputs", () => {
    const issues = issuesOf({
      mode: "class",
      entry: "MinStack",
      examples: [{ input: { ops: ["Stack", "push"], args: [[], [1]] }, expected: [null, null] }],
      hidden: [{ input: { ops: ["MinStack"], args: [] } }],
    });
    expect(issues).toContain('examples[0].input.ops[0]: expected "MinStack"');
    expect(issues).toContain("hidden[0].input: ops and args must be non-empty and the same length");
  });
});

describe("assertHiddenFilled", () => {
  it("lists every hidden case without an expected value", () => {
    const cf = parseCaseFile(valid);
    expect(() => assertHiddenFilled(cf)).toThrow(CaseFileError);
    try {
      assertHiddenFilled(cf);
    } catch (error) {
      expect((error as CaseFileError).issues).toEqual([
        "hidden[0].expected: missing (run pnpm fill-expected)",
      ]);
    }
  });
});

describe("formatCasesJson", () => {
  it("writes one case per line and round-trips", () => {
    const raw = {
      entry: "f",
      params: [{ name: "n", type: "int" }],
      returns: "int",
      examples: [{ input: [1], expected: 2 }],
      hidden: [],
    };
    const text = formatCasesJson(raw);
    expect(text).toBe(
      [
        "{",
        '  "entry": "f",',
        '  "params": [',
        '    {"name":"n","type":"int"}',
        "  ],",
        '  "returns": "int",',
        '  "examples": [',
        '    {"input":[1],"expected":2}',
        "  ],",
        '  "hidden": []',
        "}",
        "",
      ].join("\n"),
    );
    expect(JSON.parse(text)).toEqual(raw);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/schema.test.ts`
Expected: FAIL — `Failed to load url ../src/schema.ts` (or "Cannot find module").

- [ ] **Step 6: Implement `runner/src/schema.ts`**

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { CaseEntry, CaseFile } from "./types.ts";

export class CaseFileError extends Error {
  constructor(
    readonly issues: string[],
    file = "cases.json",
  ) {
    super(`${file} is invalid:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "CaseFileError";
  }
}

const BASE_TYPES = new Set(["int", "float", "bool", "string", "ListNode", "TreeNode"]);
const TYPE_HINT = "int | float | bool | string | ListNode | TreeNode, with optional [] suffixes";

export function isValueType(type: string): boolean {
  let base = type;
  while (base.endsWith("[]")) base = base.slice(0, -2);
  return BASE_TYPES.has(base);
}

const valueType = z
  .string()
  .refine(isValueType, { message: `unknown type (expected ${TYPE_HINT})` });
const returnType = z
  .string()
  .refine((type) => type === "void" || isValueType(type), {
    message: `unknown type (expected void or ${TYPE_HINT})`,
  });
const required = z.custom<unknown>((value) => value !== undefined, { message: "required" });

const caseEntrySchema = z.object({ input: required, expected: z.unknown().optional() }).strict();

const caseFileSchema = z
  .object({
    mode: z.enum(["function", "class"]).optional(),
    entry: z.string().min(1),
    params: z.array(z.object({ name: z.string().min(1), type: valueType }).strict()).optional(),
    returns: returnType.optional(),
    compare: z.enum(["exact", "unordered", "float", "any-of"]).optional(),
    inPlace: z
      .object({ param: z.string().min(1), prefix: z.literal("return").optional() })
      .strict()
      .optional(),
    examples: z.array(caseEntrySchema).min(1),
    hidden: z.array(caseEntrySchema),
  })
  .strict();

/** ["hidden", 3, "input"] → "hidden[3].input" */
export function formatPath(segments: readonly PropertyKey[]): string {
  let out = "";
  for (const segment of segments) {
    if (typeof segment === "number") out += `[${segment}]`;
    else out += out ? `.${String(segment)}` : String(segment);
  }
  return out || "(root)";
}

export function parseCaseFile(raw: unknown): CaseFile {
  const parsed = caseFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CaseFileError(
      parsed.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`),
    );
  }
  const data = parsed.data;
  const mode = data.mode ?? "function";
  const examples = data.examples as CaseEntry[];
  const hidden = data.hidden as CaseEntry[];
  const lists: [string, CaseEntry[]][] = [
    ["examples", examples],
    ["hidden", hidden],
  ];
  const issues: string[] = [];

  examples.forEach((entry, i) => {
    if (entry.expected === undefined) issues.push(`examples[${i}].expected: required`);
  });

  if (mode === "function") {
    if (!data.params) issues.push("params: required in function mode");
    if (!data.returns) issues.push("returns: required in function mode");
    const count = data.params?.length ?? 0;
    for (const [key, list] of lists) {
      list.forEach((entry, i) => {
        if (!Array.isArray(entry.input)) {
          issues.push(`${key}[${i}].input: expected an array of ${count} params`);
        } else if (entry.input.length !== count) {
          issues.push(`${key}[${i}].input: expected ${count} params, got ${entry.input.length}`);
        }
      });
    }
    const inPlace = data.inPlace;
    if (inPlace && !data.params?.some((param) => param.name === inPlace.param)) {
      issues.push(`inPlace.param: "${inPlace.param}" is not a param name`);
    }
  } else {
    if (data.params) issues.push("params: not allowed in class mode");
    if (data.returns) issues.push("returns: not allowed in class mode");
    if (data.inPlace) issues.push("inPlace: not allowed in class mode");
    for (const [key, list] of lists) {
      list.forEach((entry, i) => {
        const where = `${key}[${i}]`;
        const input = entry.input as { ops?: unknown; args?: unknown } | null;
        if (
          typeof input !== "object" ||
          input === null ||
          !Array.isArray(input.ops) ||
          !Array.isArray(input.args)
        ) {
          issues.push(`${where}.input: expected { "ops": [...], "args": [...] }`);
          return;
        }
        if (input.ops.length === 0 || input.ops.length !== input.args.length) {
          issues.push(`${where}.input: ops and args must be non-empty and the same length`);
        } else if (input.ops[0] !== data.entry) {
          issues.push(`${where}.input.ops[0]: expected "${data.entry}"`);
        }
        if (!input.args.every(Array.isArray)) {
          issues.push(`${where}.input.args: every entry must be an array`);
        }
        if (
          entry.expected !== undefined &&
          (!Array.isArray(entry.expected) || entry.expected.length !== input.ops.length)
        ) {
          issues.push(`${where}.expected: expected one value per op (${input.ops.length})`);
        }
      });
    }
  }

  if (data.compare === "any-of") {
    for (const [key, list] of lists) {
      list.forEach((entry, i) => {
        if (
          entry.expected !== undefined &&
          (!Array.isArray(entry.expected) || entry.expected.length === 0)
        ) {
          issues.push(`${key}[${i}].expected: any-of needs a non-empty list of acceptable answers`);
        }
      });
    }
  }

  if (issues.length > 0) throw new CaseFileError(issues);
  return {
    mode,
    entry: data.entry,
    params: data.params ?? [],
    returns: data.returns ?? null,
    compare: data.compare ?? "exact",
    inPlace: data.inPlace ?? null,
    examples,
    hidden,
  };
}

export function loadRawCaseFile(dir: string): Record<string, unknown> {
  const file = path.join(dir, "cases.json");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new CaseFileError(["file not found"], file);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new CaseFileError([`invalid JSON: ${(error as Error).message}`]);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new CaseFileError(["the top level must be a JSON object"]);
  }
  return raw as Record<string, unknown>;
}

export function loadCaseFile(dir: string): CaseFile {
  return parseCaseFile(loadRawCaseFile(dir));
}

export function assertHiddenFilled(cf: CaseFile): void {
  const missing = cf.hidden.flatMap((entry, i) =>
    entry.expected === undefined ? [`hidden[${i}].expected: missing (run pnpm fill-expected)`] : [],
  );
  if (missing.length > 0) throw new CaseFileError(missing);
}

const ONE_ITEM_PER_LINE = new Set(["params", "examples", "hidden"]);

/** Pretty JSON with one param/case per line (compact inside), keeping key order. */
export function formatCasesJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj);
  const lines = ["{"];
  keys.forEach((key, i) => {
    const comma = i < keys.length - 1 ? "," : "";
    const value = obj[key];
    if (ONE_ITEM_PER_LINE.has(key) && Array.isArray(value) && value.length > 0) {
      lines.push(`  ${JSON.stringify(key)}: [`);
      value.forEach((item, j) => {
        lines.push(`    ${JSON.stringify(item)}${j < value.length - 1 ? "," : ""}`);
      });
      lines.push(`  ]${comma}`);
    } else {
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`);
    }
  });
  lines.push("}");
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/schema.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.ts pyproject.toml .python-version .gitignore runner/src/types.ts runner/src/paths.ts runner/src/schema.ts runner/tests/schema.test.ts
git commit -m "feat(runner): add tooling baseline and cases.json schema"
```

---

### Task 2: Python harness and the process executor

**Files:**
- Create: `runner/harness/python/lc.py`, `runner/harness/python/harness.py`
- Create: `runner/src/executor.ts`
- Create: `runner/tests/helpers.ts`
- Test: `runner/tests/executor-py.test.ts`

**Interfaces:**
- Consumes (Task 1): `HarnessRequest`, `HarnessOutcome`, `HarnessMessage`, `CaseRun`, `HarnessError`, `Lang` from `types.ts`; `REPO_ROOT`, `HARNESS_DIR` from `paths.ts`.
- Produces:
  - `executor.ts`: `resolvePython(): string`, `runHarness(lang: Lang, request: HarnessRequest, options: { wallLimitMs: number }): Promise<HarnessOutcome>`.
  - `tests/helpers.ts`: `tempDir(): string` (a fresh dir under `runner/tests/.tmp/`), `write(dir: string, relativePath: string, content: string): string` (returns the absolute path), `harnessRequest(solutionPath: string, overrides?: Partial<HarnessRequest>): HarnessRequest`, `removeTemp(dir: string): void`.
  - **Protocol contract (both harnesses):**
    - Read one JSON `HarnessRequest` from stdin.
    - Write JSON lines to fd 3, in this order: `{"type":"fatal"}` (then exit) **or** `{"type":"ready"}`, followed for each case by `{"type":"start","id"}` then `{"type":"case",…}`.
    - Case outputs in function mode: the serialized return value, or `{"ret", "param"}` when `inPlace` is set.
    - Case outputs in class mode: the list of op results, with `null` for the constructor.
    - `discardOutput: true` → `output` is `null`.
    - `ListNode` ⇄ array, `TreeNode` ⇄ level-order array (trailing `null`s trimmed; an empty list or tree is `[]`).
    - Captured stdout+stderr per case, capped at 64 KB with the marker `\n… output truncated\n`.
    - Error kinds: `load`, `missing-entry`, `exception`, `serialization`.

- [ ] **Step 1: Write the test helpers**

`runner/tests/helpers.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../src/paths.ts";
import type { HarnessRequest } from "../src/types.ts";

/** Temp dirs live inside the repo so the tsconfig "lc" path alias applies to them. */
export const TMP_BASE = path.join(REPO_ROOT, "runner", "tests", ".tmp");

export function tempDir(): string {
  mkdirSync(TMP_BASE, { recursive: true });
  return mkdtempSync(path.join(TMP_BASE, "t-"));
}

export function removeTemp(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function write(dir: string, relativePath: string, content: string): string {
  const file = path.join(dir, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

export function harnessRequest(
  solutionPath: string,
  overrides: Partial<HarnessRequest> = {},
): HarnessRequest {
  return {
    solutionPath,
    mode: "function",
    entry: "solve",
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    inPlace: null,
    discardOutput: false,
    cases: [],
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing Python harness tests**

`runner/tests/executor-py.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { runHarness } from "../src/executor.ts";
import { harnessRequest, removeTemp, tempDir, write } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

function solution(name: string, code: string): string {
  return write(dir, `${name}/solution.py`, code);
}

describe("python harness", () => {
  it("runs each case and captures prints per case", async () => {
    const file = solution(
      "sum",
      [
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        print('len', len(nums))",
        "        return sum(nums)",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        cases: [
          { id: "e1", input: [[1, 2, 3]] },
          { id: "e2", input: [[]] },
        ],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("e1")).toMatchObject({ ok: true, output: 6, stdout: "len 3\n" });
    expect(outcome.runs.get("e2")).toMatchObject({ ok: true, output: 0, stdout: "len 0\n" });
    expect(outcome.runs.get("e1")!.ms).toBeGreaterThanOrEqual(0);
  });

  it("converts ListNode and TreeNode in both directions", async () => {
    const lists = solution(
      "reverse",
      [
        "from lc import ListNode",
        "",
        "",
        "class Solution:",
        "    def solve(self, head: ListNode | None) -> ListNode | None:",
        "        prev = None",
        "        while head:",
        "            head.next, prev, head = prev, head, head.next",
        "        return prev",
        "",
      ].join("\n"),
    );
    const listOutcome = await runHarness(
      "py",
      harnessRequest(lists, {
        params: [{ name: "head", type: "ListNode" }],
        returns: "ListNode",
        cases: [
          { id: "a", input: [[1, 2, 3]] },
          { id: "b", input: [[]] },
        ],
      }),
      { wallLimitMs: 5000 },
    );
    expect(listOutcome.runs.get("a")?.output).toEqual([3, 2, 1]);
    expect(listOutcome.runs.get("b")?.output).toEqual([]);

    const trees = solution(
      "invert",
      [
        "from lc import TreeNode",
        "",
        "",
        "class Solution:",
        "    def solve(self, root: TreeNode | None) -> TreeNode | None:",
        "        if root:",
        "            root.left, root.right = self.solve(root.right), self.solve(root.left)",
        "        return root",
        "",
      ].join("\n"),
    );
    const treeOutcome = await runHarness(
      "py",
      harnessRequest(trees, {
        params: [{ name: "root", type: "TreeNode" }],
        returns: "TreeNode",
        cases: [{ id: "t", input: [[4, 2, 7, 1, null, 6, 9]] }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(treeOutcome.runs.get("t")?.output).toEqual([4, 7, 2, 9, 6, null, 1]);
  });

  it("reports the return value and the mutated param for in-place problems", async () => {
    const file = solution(
      "dedupe",
      [
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        k = 0",
        "        for n in nums:",
        "            if k == 0 or nums[k - 1] != n:",
        "                nums[k] = n",
        "                k += 1",
        "        return k",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        inPlace: { param: "nums", prefix: "return" },
        cases: [{ id: "a", input: [[1, 1, 2]] }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("a")?.output).toEqual({ ret: 2, param: [1, 2, 2] });
  });

  it("drives class-mode problems op by op", async () => {
    const file = solution(
      "counter",
      [
        "class Counter:",
        "    def __init__(self, start: int) -> None:",
        "        self.value = start",
        "",
        "    def add(self, n: int) -> None:",
        "        self.value += n",
        "",
        "    def get(self) -> int:",
        "        return self.value",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        mode: "class",
        entry: "Counter",
        params: [],
        returns: null,
        cases: [{ id: "c", input: { ops: ["Counter", "add", "get"], args: [[5], [2], []] } }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("c")?.output).toEqual([null, null, 7]);
  });

  it("reports syntax errors as a fatal load error", async () => {
    const file = solution("syntax", "class Solution:\n    def solve(self, nums)\n        return 1\n");
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 5000,
    });
    expect(outcome.fatal?.kind).toBe("load");
    expect(outcome.fatal?.message).toMatch(/SyntaxError/);
    expect(outcome.runs.size).toBe(0);
  });

  it("reports a missing entry point", async () => {
    const file = solution("missing", "class Solution:\n    def other(self):\n        return 1\n");
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 5000,
    });
    expect(outcome.fatal).toEqual({
      kind: "missing-entry",
      message: 'expected method "solve" in class Solution',
      trace: "",
    });
  });

  it("reports runtime exceptions with frames from the user's file only", async () => {
    const file = solution(
      "boom",
      "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return nums[10]\n",
    );
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 5000,
    });
    const run = outcome.runs.get("a");
    expect(run?.ok).toBe(false);
    expect(run?.error?.kind).toBe("exception");
    expect(run?.error?.message).toMatch(/IndexError/);
    expect(run?.error?.trace).toContain("line 3, in solve: return nums[10]");
    expect(run?.error?.trace).not.toContain("harness.py");
  });

  it("reports non-JSON return values as serialization errors", async () => {
    const file = solution(
      "set",
      "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return set(nums)\n",
    );
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1, 2]] }] }), {
      wallLimitMs: 5000,
    });
    expect(outcome.runs.get("a")?.error?.kind).toBe("serialization");
    expect(outcome.runs.get("a")?.error?.message).toMatch(/set/);
  });

  it("round-trips non-ASCII strings", async () => {
    const file = solution(
      "unicode",
      "class Solution:\n    def solve(self, s: str) -> str:\n        return s[::-1]\n",
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        params: [{ name: "s", type: "string" }],
        returns: "string",
        cases: [{ id: "a", input: ["ñandú 🎵"] }],
      }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("a")?.output).toBe("🎵 údnañ");
  });

  it("caps runaway prints and still finishes the case", async () => {
    const file = solution(
      "flood",
      [
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        for i in range(200_000):",
        "            print('line', i)",
        "        return 1",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness("py", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    const run = outcome.runs.get("a");
    expect(run?.ok).toBe(true);
    expect(run?.stdout.length).toBeLessThan(70 * 1024);
    expect(run?.stdout).toMatch(/… output truncated\n$/);
  });

  it("kills infinite loops at the wall-clock limit and names the case in flight", async () => {
    const file = solution(
      "loop",
      "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        while nums[0] == 0:\n            pass\n        return 1\n",
    );
    const outcome = await runHarness(
      "py",
      harnessRequest(file, {
        cases: [
          { id: "ok", input: [[1]] },
          { id: "stuck", input: [[0]] },
          { id: "never", input: [[1]] },
        ],
      }),
      { wallLimitMs: 1500 },
    );
    expect(outcome.runs.get("ok")?.ok).toBe(true);
    expect(outcome.timedOutCase).toBe("stuck");
    expect(outcome.runs.has("never")).toBe(false);
  });

  it("returns null outputs when discardOutput is set", async () => {
    const file = solution("discard", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return 5\n");
    const outcome = await runHarness(
      "py",
      harnessRequest(file, { discardOutput: true, cases: [{ id: "a", input: [[1]] }] }),
      { wallLimitMs: 5000 },
    );
    expect(outcome.runs.get("a")).toMatchObject({ ok: true, output: null });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/executor-py.test.ts`
Expected: FAIL — `../src/executor.ts` cannot be loaded.

- [ ] **Step 4: Write `runner/harness/python/lc.py`**

```python
"""LeetCode-style node classes. Solutions import them with `from lc import ListNode`."""

from __future__ import annotations


class ListNode:
    def __init__(self, val: int = 0, next: ListNode | None = None) -> None:
        self.val = val
        self.next = next

    def __repr__(self) -> str:
        values: list[str] = []
        node: ListNode | None = self
        while node is not None and len(values) < 20:
            values.append(repr(node.val))
            node = node.next
        tail = " -> …" if node is not None else ""
        return f"ListNode({' -> '.join(values)}{tail})"


class TreeNode:
    def __init__(
        self,
        val: int = 0,
        left: TreeNode | None = None,
        right: TreeNode | None = None,
    ) -> None:
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self) -> str:
        return f"TreeNode({self.val!r})"
```

- [ ] **Step 5: Write `runner/harness/python/harness.py`**

```python
"""Runs a user's Python solution against test inputs.

Protocol: one JSON request on stdin, JSON lines on fd 3 (never stdout, so user
prints cannot corrupt it). Expected values are never sent here: this process
only executes and reports what the solution returned.
"""

import contextlib
import importlib.util
import io
import json
import os
import sys
import time
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lc import ListNode, TreeNode  # noqa: E402

sys.setrecursionlimit(10_000)

MAX_NODES = 1_000_000
CAPTURE_LIMIT = 64 * 1024
PROTOCOL = os.fdopen(3, "w", buffering=1, encoding="utf-8")


class MissingEntryError(Exception):
    pass


class SerializationError(Exception):
    pass


class CappedBuffer(io.TextIOBase):
    """Collects printed text, keeping at most CAPTURE_LIMIT characters."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.size = 0
        self.truncated = False

    def writable(self) -> bool:
        return True

    def write(self, text: str) -> int:
        room = CAPTURE_LIMIT - self.size
        if len(text) > room:
            self.truncated = True
        if room > 0:
            self.parts.append(text[:room])
            self.size += min(len(text), room)
        return len(text)

    def getvalue(self) -> str:
        text = "".join(self.parts)
        return text + "\n… output truncated\n" if self.truncated else text


def emit(message: dict) -> None:
    PROTOCOL.write(json.dumps(message, allow_nan=False) + "\n")
    PROTOCOL.flush()


def error(kind: str, message: str, trace: str = "") -> dict:
    return {"kind": kind, "message": message, "trace": trace}


def user_trace(exc: BaseException, solution_path: str) -> str:
    frames = [
        frame
        for frame in traceback.extract_tb(exc.__traceback__)
        if os.path.abspath(frame.filename) == solution_path
    ]
    return "\n".join(
        f"  line {frame.lineno}, in {frame.name}: {(frame.line or '').strip()}"
        for frame in frames
    )


def to_list_node(values):
    dummy = ListNode()
    tail = dummy
    for value in values or []:
        tail.next = ListNode(value)
        tail = tail.next
    return dummy.next


def to_tree_node(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue = [root]
    head, i = 0, 1
    while i < len(values) and head < len(queue):
        node = queue[head]
        head += 1
        if values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = TreeNode(values[i])
            queue.append(node.right)
        i += 1
    return root


def deserialize(value, type_name: str):
    if type_name.endswith("[]"):
        return [deserialize(item, type_name[:-2]) for item in value]
    if type_name == "ListNode":
        return to_list_node(value)
    if type_name == "TreeNode":
        return to_tree_node(value)
    if type_name == "float":
        return float(value)
    return value


def from_list_node(node) -> list:
    values = []
    while node is not None:
        values.append(plain(node.val))
        node = node.next
        if len(values) > MAX_NODES:
            raise SerializationError("linked list has a cycle or more than 10^6 nodes")
    return values


def from_tree_node(root) -> list:
    if root is None:
        return []
    values: list = []
    queue = [root]
    head = 0
    while head < len(queue):
        node = queue[head]
        head += 1
        if node is None:
            values.append(None)
            continue
        values.append(plain(node.val))
        queue.append(node.left)
        queue.append(node.right)
        if len(queue) > 2 * MAX_NODES + 1:
            raise SerializationError("tree has a cycle or more than 10^6 nodes")
    while values and values[-1] is None:
        values.pop()
    return values


def plain(value):
    """Converts a returned value to JSON-friendly data (duck-typed nodes, tuples)."""
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    if hasattr(value, "val") and hasattr(value, "left") and hasattr(value, "right"):
        return from_tree_node(value)
    if hasattr(value, "val") and hasattr(value, "next"):
        return from_list_node(value)
    return value


def serialize(value, type_name):
    if type_name == "ListNode":
        return from_list_node(value)
    if type_name == "TreeNode":
        return from_tree_node(value)
    if type_name and type_name.endswith("[]") and isinstance(value, (list, tuple)):
        return [serialize(item, type_name[:-2]) for item in value]
    return plain(value)


def load_module(path: str):
    spec = importlib.util.spec_from_file_location("solution", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def resolve_entry(module, request: dict):
    entry = request["entry"]
    if request["mode"] == "function":
        solution = getattr(module, "Solution", None)
        if not isinstance(solution, type) or not callable(getattr(solution, entry, None)):
            raise MissingEntryError(f'expected method "{entry}" in class Solution')
        return solution
    cls = getattr(module, entry, None)
    if not isinstance(cls, type):
        raise MissingEntryError(f'expected class "{entry}"')
    return cls


def run_function(solution_cls, request: dict, raw_input):
    params = request["params"]
    args = [
        deserialize(value, param["type"])
        for value, param in zip(raw_input, params, strict=True)
    ]
    method = getattr(solution_cls(), request["entry"])
    started = time.perf_counter()
    returned = method(*args)
    ms = (time.perf_counter() - started) * 1000
    if request["discardOutput"]:
        return None, ms
    in_place = request.get("inPlace")
    if in_place:
        index = next(i for i, p in enumerate(params) if p["name"] == in_place["param"])
        output = {
            "ret": plain(returned),
            "param": serialize(args[index], params[index]["type"]),
        }
        return output, ms
    return serialize(returned, request["returns"]), ms


def run_class(cls, request: dict, raw_input):
    ops, args = raw_input["ops"], raw_input["args"]
    started = time.perf_counter()
    instance = cls(*args[0])
    results = [None]
    for op, op_args in zip(ops[1:], args[1:], strict=True):
        results.append(getattr(instance, op)(*op_args))
    ms = (time.perf_counter() - started) * 1000
    if request["discardOutput"]:
        return None, ms
    return [plain(result) for result in results], ms


def run_case(target, request: dict, case: dict, solution_path: str) -> None:
    runner = run_function if request["mode"] == "function" else run_class
    buffer = CappedBuffer()
    started = time.perf_counter()

    def fail(failure: dict) -> None:
        ms = (time.perf_counter() - started) * 1000
        emit(
            {
                "type": "case",
                "id": case["id"],
                "ok": False,
                "error": failure,
                "ms": round(ms, 3),
                "stdout": buffer.getvalue(),
            }
        )

    try:
        with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(buffer):
            output, ms = runner(target, request, case["input"])
    except SerializationError as exc:
        fail(error("serialization", str(exc)))
        return
    except (Exception, SystemExit) as exc:
        name = type(exc).__name__
        fail(error("exception", f"{name}: {exc}", user_trace(exc, solution_path)))
        return
    message = {
        "type": "case",
        "id": case["id"],
        "ok": True,
        "output": output,
        "ms": round(ms, 3),
        "stdout": buffer.getvalue(),
    }
    try:
        emit(message)
    except (TypeError, ValueError) as exc:
        fail(error("serialization", f"return value is not JSON-serializable: {exc}"))


def main() -> None:
    request = json.loads(sys.stdin.read())
    solution_path = os.path.abspath(request["solutionPath"])
    try:
        with (
            contextlib.redirect_stdout(CappedBuffer()),
            contextlib.redirect_stderr(CappedBuffer()),
        ):
            module = load_module(solution_path)
    except SyntaxError as exc:
        trace = f"  line {exc.lineno}: {(exc.text or '').strip()}"
        emit({"type": "fatal", "error": error("load", f"SyntaxError: {exc.msg}", trace)})
        return
    except (Exception, SystemExit) as exc:
        message = f"{type(exc).__name__}: {exc}"
        emit({"type": "fatal", "error": error("load", message, user_trace(exc, solution_path))})
        return
    try:
        target = resolve_entry(module, request)
    except MissingEntryError as exc:
        emit({"type": "fatal", "error": error("missing-entry", str(exc))})
        return
    emit({"type": "ready"})
    for case in request["cases"]:
        emit({"type": "start", "id": case["id"]})
        run_case(target, request, case, solution_path)


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Write `runner/src/executor.ts`**

```ts
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import type { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { HARNESS_DIR, REPO_ROOT } from "./paths.ts";
import type {
  CaseRun,
  HarnessError,
  HarnessMessage,
  HarnessOutcome,
  HarnessRequest,
  Lang,
} from "./types.ts";

let cachedPython: string | null = null;

/** Python from `uv python find` (honors .python-version = 3.13). ALGO_PYTHON overrides it. */
export function resolvePython(): string {
  if (process.env.ALGO_PYTHON) return process.env.ALGO_PYTHON;
  if (cachedPython) return cachedPython;
  try {
    cachedPython = execFileSync("uv", ["python", "find"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      "Could not find Python with `uv python find`. Install uv (https://docs.astral.sh/uv/) or set ALGO_PYTHON.",
    );
  }
  return cachedPython;
}

/** tsx loaded in-process (`node --import`), so the harness keeps fd 3. */
const TSX_LOADER = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;

function command(lang: Lang): { file: string; args: string[]; env: NodeJS.ProcessEnv } {
  if (lang === "py") {
    return {
      file: resolvePython(),
      args: [path.join(HARNESS_DIR, "python", "harness.py")],
      env: process.env,
    };
  }
  return {
    file: process.execPath,
    args: ["--import", TSX_LOADER, path.join(HARNESS_DIR, "ts", "harness.ts")],
    env: { ...process.env, TSX_TSCONFIG_PATH: path.join(REPO_ROOT, "tsconfig.json") },
  };
}

function crash(message: string, stderr: string): HarnessError {
  return { kind: "crash", message, trace: stderr.trim().split("\n").slice(-10).join("\n") };
}

/** Spawns the language harness, streams its fd-3 messages, and enforces a wall-clock limit. */
export function runHarness(
  lang: Lang,
  request: HarnessRequest,
  options: { wallLimitMs: number },
): Promise<HarnessOutcome> {
  const { file, args, env } = command(lang);
  return new Promise((resolve) => {
    const child = spawn(file, args, { cwd: REPO_ROOT, env, stdio: ["pipe", "pipe", "pipe", "pipe"] });
    const runs = new Map<string, CaseRun>();
    let fatal: HarnessError | null = null;
    let ready = false;
    let inFlight: string | null = null;
    let timedOut = false;
    let settled = false;
    let stderr = "";
    let pending = "";

    const finish = (outcome: HarnessOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    const handle = (message: HarnessMessage): void => {
      if (message.type === "ready") ready = true;
      else if (message.type === "fatal") fatal = message.error;
      else if (message.type === "start") inFlight = message.id;
      else {
        runs.set(
          message.id,
          message.ok
            ? { id: message.id, ok: true, output: message.output, ms: message.ms, stdout: message.stdout }
            : { id: message.id, ok: false, error: message.error, ms: message.ms, stdout: message.stdout },
        );
        inFlight = null;
      }
    };

    const protocol = child.stdio[3] as Readable;
    protocol.setEncoding("utf8");
    protocol.on("data", (chunk: string) => {
      pending += chunk;
      let newline = pending.indexOf("\n");
      while (newline >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (line.trim()) handle(JSON.parse(line) as HarnessMessage);
        newline = pending.indexOf("\n");
      }
    });

    child.stdout.resume();
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.stdin.on("error", () => {
      // The harness may exit before reading the whole request (e.g. a fatal load error).
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.wallLimitMs);

    child.on("error", (error) => {
      finish({
        fatal: crash(`could not start the ${lang} harness: ${error.message}`, ""),
        runs,
        timedOutCase: null,
        stderr,
      });
    });

    child.on("close", (code) => {
      if (timedOut && !ready && !fatal) {
        fatal = {
          kind: "timeout",
          message: `the solution did not finish loading within ${options.wallLimitMs} ms`,
          trace: "",
        };
      }
      if (!timedOut && !fatal && !ready) {
        fatal = crash(`the ${lang} harness exited before loading the solution (code ${code})`, stderr);
      }
      if (!timedOut && inFlight && !runs.has(inFlight)) {
        runs.set(inFlight, {
          id: inFlight,
          ok: false,
          error: crash(`the process exited during this case (code ${code})`, stderr),
          ms: 0,
          stdout: "",
        });
      }
      finish({ fatal, runs, timedOutCase: timedOut ? inFlight : null, stderr });
    });

    child.stdin.end(JSON.stringify(request));
  });
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/executor-py.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 8: Commit**

```bash
git add runner/harness/python runner/src/executor.ts runner/tests/helpers.ts runner/tests/executor-py.test.ts
git commit -m "feat(runner): add python harness and process executor"
```

---

### Task 3: TypeScript harness

**Files:**
- Create: `runner/harness/ts/lc.ts`, `runner/harness/ts/harness.ts`
- Test: `runner/tests/executor-ts.test.ts`

**Interfaces:**
- Consumes (Task 2): `runHarness("ts", …)` (the command is already wired: `node --import <tsx> runner/harness/ts/harness.ts` with `TSX_TSCONFIG_PATH`); the protocol contract from Task 2; `tempDir`, `write`, `harnessRequest`, `removeTemp` from `tests/helpers.ts`.
- Produces:
  - `runner/harness/ts/lc.ts`: `class ListNode { val: number; next: ListNode | null }` and `class TreeNode { val: number; left: TreeNode | null; right: TreeNode | null }`, both with LeetCode-style optional constructor params.
  - Solutions import them with `import { ListNode } from "lc"` (resolved by the `tsconfig.json` `paths` alias).
  - TS solution contract: `export default function <entry>(…)` in function mode, `export default class` in class mode.

- [ ] **Step 1: Write the failing TypeScript harness tests**

`runner/tests/executor-ts.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { runHarness } from "../src/executor.ts";
import { harnessRequest, removeTemp, tempDir, write } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

function solution(name: string, code: string): string {
  return write(dir, `${name}/solution.ts`, code);
}

describe("typescript harness", () => {
  it("runs cases and captures console.log, console.error and log from 'console'", async () => {
    const file = solution(
      "sum",
      [
        'import { log } from "console";',
        "export default function solve(nums: number[]): number {",
        '  console.log("len", nums.length);',
        '  console.error("err");',
        '  log("via log");',
        "  return nums.reduce((a, b) => a + b, 0);",
        "}",
        "",
      ].join("\n"),
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, { cases: [{ id: "e1", input: [[1, 2, 3]] }] }),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.fatal).toBeNull();
    expect(outcome.runs.get("e1")).toMatchObject({
      ok: true,
      output: 6,
      stdout: "len 3\nerr\nvia log\n",
    });
  });

  it("resolves `lc` and converts ListNode and TreeNode", async () => {
    const lists = solution(
      "reverse",
      [
        'import { ListNode } from "lc";',
        "export default function solve(head: ListNode | null): ListNode | null {",
        "  let prev: ListNode | null = null;",
        "  while (head) { const next: ListNode | null = head.next; head.next = prev; prev = head; head = next; }",
        "  return prev;",
        "}",
        "",
      ].join("\n"),
    );
    const listOutcome = await runHarness(
      "ts",
      harnessRequest(lists, {
        params: [{ name: "head", type: "ListNode" }],
        returns: "ListNode",
        cases: [
          { id: "a", input: [[1, 2, 3]] },
          { id: "b", input: [[]] },
        ],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(listOutcome.fatal).toBeNull();
    expect(listOutcome.runs.get("a")?.output).toEqual([3, 2, 1]);
    expect(listOutcome.runs.get("b")?.output).toEqual([]);

    const trees = solution(
      "invert",
      [
        'import { TreeNode } from "lc";',
        "export default function solve(root: TreeNode | null): TreeNode | null {",
        "  if (root) { const left = root.left; root.left = solve(root.right); root.right = solve(left); }",
        "  return root;",
        "}",
        "",
      ].join("\n"),
    );
    const treeOutcome = await runHarness(
      "ts",
      harnessRequest(trees, {
        params: [{ name: "root", type: "TreeNode" }],
        returns: "TreeNode",
        cases: [{ id: "t", input: [[4, 2, 7, 1, null, 6, 9]] }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(treeOutcome.runs.get("t")?.output).toEqual([4, 7, 2, 9, 6, null, 1]);
  });

  it("reports in-place results and class-mode results", async () => {
    const dedupe = solution(
      "dedupe",
      [
        "export default function solve(nums: number[]): number {",
        "  let k = 0;",
        "  for (const n of nums) if (k === 0 || nums[k - 1] !== n) nums[k++] = n;",
        "  return k;",
        "}",
        "",
      ].join("\n"),
    );
    const inPlace = await runHarness(
      "ts",
      harnessRequest(dedupe, {
        inPlace: { param: "nums", prefix: "return" },
        cases: [{ id: "a", input: [[1, 1, 2]] }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(inPlace.runs.get("a")?.output).toEqual({ ret: 2, param: [1, 2, 2] });

    const counter = solution(
      "counter",
      [
        "export default class Counter {",
        "  value: number;",
        "  constructor(start: number) { this.value = start; }",
        "  add(n: number): void { this.value += n; }",
        "  get(): number { return this.value; }",
        "}",
        "",
      ].join("\n"),
    );
    const classMode = await runHarness(
      "ts",
      harnessRequest(counter, {
        mode: "class",
        entry: "Counter",
        params: [],
        returns: null,
        cases: [{ id: "c", input: { ops: ["Counter", "add", "get"], args: [[5], [2], []] } }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(classMode.runs.get("c")?.output).toEqual([null, null, 7]);
  });

  it("reports load errors and missing default exports", async () => {
    const broken = solution("broken", "export default function solve(nums: number[] {\n  return 1;\n}\n");
    const load = await runHarness("ts", harnessRequest(broken, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(load.fatal?.kind).toBe("load");

    const named = solution("named", "export function solve(nums: number[]): number {\n  return 1;\n}\n");
    const missing = await runHarness("ts", harnessRequest(named, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(missing.fatal).toEqual({
      kind: "missing-entry",
      message: 'expected default export function "solve"',
      trace: "",
    });
  });

  it("reports runtime errors with frames from the user's file", async () => {
    const file = solution(
      "boom",
      "export default function solve(nums: number[]): number {\n  return (nums as any).missing.length;\n}\n",
    );
    const outcome = await runHarness("ts", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    const run = outcome.runs.get("a");
    expect(run?.error?.kind).toBe("exception");
    expect(run?.error?.message).toMatch(/TypeError/);
    expect(run?.error?.trace).toContain("solution.ts:2");
    expect(run?.error?.trace).not.toContain("harness.ts");
  });

  it("reports Map and NaN return values as serialization errors", async () => {
    const map = solution("map", "export default function solve(nums: number[]): unknown {\n  return new Map();\n}\n");
    const mapOutcome = await runHarness("ts", harnessRequest(map, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(mapOutcome.runs.get("a")?.error?.kind).toBe("serialization");
    expect(mapOutcome.runs.get("a")?.error?.message).toMatch(/Map/);

    const nan = solution("nan", "export default function solve(nums: number[]): number {\n  return 0 / 0;\n}\n");
    const nanOutcome = await runHarness("ts", harnessRequest(nan, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 10_000,
    });
    expect(nanOutcome.runs.get("a")?.error?.kind).toBe("serialization");
  });

  it("round-trips non-ASCII strings", async () => {
    const file = solution(
      "unicode",
      "export default function solve(s: string): string {\n  return [...s].reverse().join('');\n}\n",
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, {
        params: [{ name: "s", type: "string" }],
        returns: "string",
        cases: [{ id: "a", input: ["ñandú 🎵"] }],
      }),
      { wallLimitMs: 10_000 },
    );
    expect(outcome.runs.get("a")?.output).toBe("🎵 údnañ");
  });

  it("caps runaway prints and still finishes the case", async () => {
    const file = solution(
      "flood",
      "export default function solve(nums: number[]): number {\n  for (let i = 0; i < 200_000; i++) console.log('line', i);\n  return 1;\n}\n",
    );
    const outcome = await runHarness("ts", harnessRequest(file, { cases: [{ id: "a", input: [[1]] }] }), {
      wallLimitMs: 15_000,
    });
    const run = outcome.runs.get("a");
    expect(run?.ok).toBe(true);
    expect(run?.stdout.length).toBeLessThan(70 * 1024);
    expect(run?.stdout).toMatch(/… output truncated\n$/);
  });

  it("kills infinite loops at the wall-clock limit", async () => {
    const file = solution(
      "loop",
      "export default function solve(nums: number[]): number {\n  while (nums[0] === 0) {}\n  return 1;\n}\n",
    );
    const outcome = await runHarness(
      "ts",
      harnessRequest(file, {
        cases: [
          { id: "ok", input: [[1]] },
          { id: "stuck", input: [[0]] },
        ],
      }),
      { wallLimitMs: 3000 },
    );
    expect(outcome.runs.get("ok")?.ok).toBe(true);
    expect(outcome.timedOutCase).toBe("stuck");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/executor-ts.test.ts`
Expected: FAIL. Every `outcome.fatal` is a `crash` because `runner/harness/ts/harness.ts` does not exist (for example `expected null, received { kind: 'crash', … }`).

- [ ] **Step 3: Write `runner/harness/ts/lc.ts`**

```ts
/** LeetCode-style linked list node. Solutions import it with `import { ListNode } from "lc"`. */
export class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val?: number, next?: ListNode | null) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
  }
}

/** LeetCode-style binary tree node. Solutions import it with `import { TreeNode } from "lc"`. */
export class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;

  constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {
    this.val = val === undefined ? 0 : val;
    this.left = left === undefined ? null : left;
    this.right = right === undefined ? null : right;
  }
}
```

- [ ] **Step 4: Write `runner/harness/ts/harness.ts`**

```ts
/**
 * Runs a user's TypeScript solution against test inputs.
 *
 * Protocol: one JSON request on stdin, JSON lines on fd 3 (never stdout, so user
 * prints cannot corrupt it). Expected values are never sent here: this process
 * only executes and reports what the solution returned.
 */
import { readFileSync, writeSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ListNode, TreeNode } from "./lc.ts";

interface Param {
  name: string;
  type: string;
}

interface Request {
  solutionPath: string;
  mode: "function" | "class";
  entry: string;
  params: Param[];
  returns: string | null;
  inPlace: { param: string; prefix?: "return" } | null;
  discardOutput: boolean;
  cases: { id: string; input: unknown }[];
}

type Linked = { val: unknown; next: Linked | null };
type Tree = { val: unknown; left: Tree | null; right: Tree | null };
type Callable = (...args: unknown[]) => unknown;
type Constructor = new (...args: unknown[]) => Record<string, unknown>;

const MAX_NODES = 1_000_000;
const CAPTURE_LIMIT = 64 * 1024;

class SerializationError extends Error {}

function emit(message: unknown): void {
  const buffer = Buffer.from(`${JSON.stringify(message)}\n`);
  let offset = 0;
  while (offset < buffer.length) {
    try {
      offset += writeSync(3, buffer, offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
    }
  }
}

/** Redirects stdout/stderr writes (console.* included) into a capped buffer. */
function capture(): () => string {
  let text = "";
  let truncated = false;
  const push = (chunk: unknown): void => {
    const piece =
      typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8");
    const room = CAPTURE_LIMIT - text.length;
    if (piece.length > room) truncated = true;
    if (room > 0) text += piece.slice(0, room);
  };
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: unknown) => {
    push(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => {
    push(chunk);
    return true;
  }) as typeof process.stderr.write;
  return () => {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
    return truncated ? `${text}\n… output truncated\n` : text;
  };
}

function toListNode(values: unknown): ListNode | null {
  const dummy = new ListNode();
  let tail = dummy;
  for (const value of (values as number[] | null) ?? []) {
    tail.next = new ListNode(value);
    tail = tail.next;
  }
  return dummy.next;
}

function toTreeNode(values: unknown): TreeNode | null {
  const list = (values as (number | null)[] | null) ?? [];
  if (list.length === 0 || list[0] === null) return null;
  const root = new TreeNode(list[0]);
  const queue: TreeNode[] = [root];
  let head = 0;
  let i = 1;
  while (i < list.length && head < queue.length) {
    const node = queue[head++];
    const left = list[i++];
    if (left !== null && left !== undefined) {
      node.left = new TreeNode(left);
      queue.push(node.left);
    }
    if (i < list.length) {
      const right = list[i++];
      if (right !== null && right !== undefined) {
        node.right = new TreeNode(right);
        queue.push(node.right);
      }
    }
  }
  return root;
}

function deserialize(value: unknown, type: string): unknown {
  if (type.endsWith("[]")) return (value as unknown[]).map((item) => deserialize(item, type.slice(0, -2)));
  if (type === "ListNode") return toListNode(value);
  if (type === "TreeNode") return toTreeNode(value);
  return value;
}

function fromListNode(node: Linked | null | undefined): unknown[] {
  const values: unknown[] = [];
  let current = node;
  while (current) {
    values.push(plain(current.val));
    current = current.next;
    if (values.length > MAX_NODES) {
      throw new SerializationError("linked list has a cycle or more than 10^6 nodes");
    }
  }
  return values;
}

function fromTreeNode(root: Tree | null | undefined): unknown[] {
  if (!root) return [];
  const values: unknown[] = [];
  const queue: (Tree | null)[] = [root];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (!node) {
      values.push(null);
      continue;
    }
    values.push(plain(node.val));
    queue.push(node.left ?? null, node.right ?? null);
    if (queue.length > 2 * MAX_NODES + 1) {
      throw new SerializationError("tree has a cycle or more than 10^6 nodes");
    }
  }
  while (values.length > 0 && values[values.length - 1] === null) values.pop();
  return values;
}

/** Converts a returned value to JSON-friendly data (duck-typed nodes included). */
function plain(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new SerializationError(`return value contains ${value}`);
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(plain);
  if (value instanceof Map || value instanceof Set) {
    throw new SerializationError(`return value is a ${value.constructor.name}; return an array`);
  }
  if (typeof value === "object") {
    if ("val" in value && "left" in value && "right" in value) return fromTreeNode(value as Tree);
    if ("val" in value && "next" in value) return fromListNode(value as Linked);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  throw new SerializationError(`return value of type ${typeof value} is not supported`);
}

function serialize(value: unknown, type: string | null): unknown {
  if (type === "ListNode") return fromListNode(value as Linked | null);
  if (type === "TreeNode") return fromTreeNode(value as Tree | null);
  if (type?.endsWith("[]") && Array.isArray(value)) {
    return value.map((item) => serialize(item, type.slice(0, -2)));
  }
  return plain(value);
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function userTrace(error: unknown, solutionPath: string): string {
  const stack = error instanceof Error && error.stack ? error.stack : "";
  const url = pathToFileURL(solutionPath).href;
  const base = path.basename(solutionPath);
  return stack
    .split("\n")
    .filter((line) => line.includes(solutionPath) || line.includes(url))
    .map((line) => `  ${line.trim().replace(url, base).replace(solutionPath, base)}`)
    .join("\n");
}

function runFunction(fn: Callable, request: Request, input: unknown): { output: unknown; ms: number } {
  const args = request.params.map((param, i) => deserialize((input as unknown[])[i], param.type));
  const started = performance.now();
  const returned = fn(...args);
  const ms = performance.now() - started;
  if (request.discardOutput) return { output: null, ms };
  const inPlace = request.inPlace;
  if (inPlace) {
    const index = request.params.findIndex((param) => param.name === inPlace.param);
    return {
      output: { ret: plain(returned), param: serialize(args[index], request.params[index].type) },
      ms,
    };
  }
  return { output: serialize(returned, request.returns), ms };
}

function runClass(Cls: Constructor, request: Request, input: unknown): { output: unknown; ms: number } {
  const { ops, args } = input as { ops: string[]; args: unknown[][] };
  const started = performance.now();
  const instance = new Cls(...args[0]);
  const results: unknown[] = [null];
  for (let i = 1; i < ops.length; i++) {
    const method = instance[ops[i]];
    if (typeof method !== "function") throw new Error(`method "${ops[i]}" not found on ${request.entry}`);
    results.push((method as Callable).apply(instance, args[i]));
  }
  const ms = performance.now() - started;
  return { output: request.discardOutput ? null : results.map(plain), ms };
}

async function main(): Promise<void> {
  const request = JSON.parse(readFileSync(0, "utf8")) as Request;
  const solutionPath = path.resolve(request.solutionPath);

  let exported: unknown;
  const stopLoadCapture = capture();
  try {
    exported = ((await import(pathToFileURL(solutionPath).href)) as { default?: unknown }).default;
  } catch (error) {
    stopLoadCapture();
    emit({ type: "fatal", error: { kind: "load", message: describe(error), trace: userTrace(error, solutionPath) } });
    return;
  }
  stopLoadCapture();

  if (typeof exported !== "function") {
    const what = request.mode === "function" ? "function" : "class";
    emit({
      type: "fatal",
      error: { kind: "missing-entry", message: `expected default export ${what} "${request.entry}"`, trace: "" },
    });
    return;
  }

  emit({ type: "ready" });
  for (const testCase of request.cases) {
    emit({ type: "start", id: testCase.id });
    const stop = capture();
    const started = performance.now();
    try {
      const { output, ms } =
        request.mode === "function"
          ? runFunction(exported as Callable, request, testCase.input)
          : runClass(exported as Constructor, request, testCase.input);
      const stdout = stop();
      emit({ type: "case", id: testCase.id, ok: true, output, ms: Number(ms.toFixed(3)), stdout });
    } catch (error) {
      const stdout = stop();
      const serialization = error instanceof SerializationError;
      emit({
        type: "case",
        id: testCase.id,
        ok: false,
        error: {
          kind: serialization ? "serialization" : "exception",
          message: serialization ? (error as Error).message : describe(error),
          trace: serialization ? "" : userTrace(error, solutionPath),
        },
        ms: Number((performance.now() - started).toFixed(3)),
        stdout,
      });
    }
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`harness failure: ${describe(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/executor-ts.test.ts`
Expected: PASS (9 tests).

If the `lc` test fails with `Cannot find package 'lc'`, the `paths` alias did not apply. Confirm that `TSX_TSCONFIG_PATH` is set in `executor.ts` and that the temp dir is inside the repo (`runner/tests/.tmp/`). Both were verified during planning with tsx 4.23.

- [ ] **Step 6: Commit**

```bash
git add runner/harness/ts runner/tests/executor-ts.test.ts
git commit -m "feat(runner): add typescript harness"
```

---

### Task 4: Comparator

**Files:**
- Create: `runner/src/compare.ts`
- Test: `runner/tests/compare.test.ts`

**Interfaces:**
- Consumes (Task 1): `CaseFile`, `CompareMode`.
- Produces:
  - `FLOAT_TOLERANCE = 1e-5`.
  - `canonical(value: unknown): string`.
  - `compareValue(mode: CompareMode, expected: unknown, output: unknown): boolean`.
  - `judgedValue(cf: Pick<CaseFile, "inPlace">, output: unknown): { value: unknown } | null`: the part of the output that is judged (prefix of the mutated param for `prefix: "return"`). Returns `null` if the in-place output is malformed.
  - `matches(cf: Pick<CaseFile, "compare" | "inPlace">, expected: unknown, output: unknown): boolean`.

- [ ] **Step 1: Write the failing tests**

`runner/tests/compare.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canonical, compareValue, judgedValue, matches } from "../src/compare.ts";

describe("compareValue", () => {
  it("exact: deep equality, key order and -0 do not matter", () => {
    expect(compareValue("exact", [1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(compareValue("exact", [1, 2], [2, 1])).toBe(false);
    expect(compareValue("exact", { a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(compareValue("exact", 0, -0)).toBe(true);
    expect(compareValue("exact", null, null)).toBe(true);
    expect(compareValue("exact", true, 1)).toBe(false);
  });

  it("unordered: same multiset at the top level", () => {
    expect(compareValue("unordered", [0, 1], [1, 0])).toBe(true);
    expect(compareValue("unordered", [[1, 2], [3]], [[3], [1, 2]])).toBe(true);
    expect(compareValue("unordered", [1, 1, 2], [1, 2, 2])).toBe(false);
    expect(compareValue("unordered", [1], 1)).toBe(false);
  });

  it("float: tolerance 1e-5, element-wise", () => {
    expect(compareValue("float", 0.1 + 0.2, 0.3)).toBe(true);
    expect(compareValue("float", [1.000001, 2], [1, 2])).toBe(true);
    expect(compareValue("float", 1, 1.001)).toBe(false);
  });

  it("any-of: matches one of the acceptable answers", () => {
    expect(compareValue("any-of", [[0, 1], [1, 0]], [1, 0])).toBe(true);
    expect(compareValue("any-of", [[0, 1]], [1, 0])).toBe(false);
  });
});

describe("in-place judging", () => {
  const prefix = { compare: "exact" as const, inPlace: { param: "nums", prefix: "return" as const } };

  it("judges only the first k elements of the mutated param", () => {
    expect(judgedValue(prefix, { ret: 2, param: [1, 2, 9] })).toEqual({ value: [1, 2] });
    expect(matches(prefix, [1, 2], { ret: 2, param: [1, 2, 9] })).toBe(true);
  });

  it("fails when k does not match the expected length", () => {
    expect(matches(prefix, [1, 2], { ret: 3, param: [1, 2, 9] })).toBe(false);
  });

  it("treats a non-integer k (e.g. returning the array) as malformed", () => {
    expect(judgedValue(prefix, { ret: [1, 2], param: [1, 2] })).toBeNull();
    expect(matches(prefix, [1, 2], { ret: [1, 2], param: [1, 2] })).toBe(false);
  });

  it("compares the whole param when there is no prefix", () => {
    const whole = { compare: "exact" as const, inPlace: { param: "nums" } };
    expect(matches(whole, [3, 2, 1], { ret: null, param: [3, 2, 1] })).toBe(true);
  });

  it("uses the compare mode on the judged prefix", () => {
    const unordered = { compare: "unordered" as const, inPlace: { param: "nums", prefix: "return" as const } };
    expect(matches(unordered, [0, 1, 4], { ret: 3, param: [4, 0, 1, 7] })).toBe(true);
  });
});

describe("canonical", () => {
  it("sorts object keys", () => {
    expect(canonical({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/compare.test.ts`
Expected: FAIL — `../src/compare.ts` cannot be loaded.

- [ ] **Step 3: Implement `runner/src/compare.ts`**

```ts
import type { CaseFile, CompareMode } from "./types.ts";

export const FLOAT_TOLERANCE = 1e-5;

/** JSON text with sorted object keys: equal values give equal strings (-0 and 0 included). */
export function canonical(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          )
        : item,
    ) ?? "undefined"
  );
}

function floatEqual(expected: unknown, output: unknown): boolean {
  if (typeof expected === "number" && typeof output === "number") {
    return Math.abs(expected - output) <= FLOAT_TOLERANCE;
  }
  if (Array.isArray(expected) && Array.isArray(output)) {
    return expected.length === output.length && expected.every((item, i) => floatEqual(item, output[i]));
  }
  return canonical(expected) === canonical(output);
}

function unorderedEqual(expected: unknown, output: unknown): boolean {
  if (!Array.isArray(expected) || !Array.isArray(output) || expected.length !== output.length) return false;
  const a = expected.map(canonical).sort();
  const b = output.map(canonical).sort();
  return a.every((item, i) => item === b[i]);
}

export function compareValue(mode: CompareMode, expected: unknown, output: unknown): boolean {
  switch (mode) {
    case "exact":
      return canonical(expected) === canonical(output);
    case "float":
      return floatEqual(expected, output);
    case "unordered":
      return unorderedEqual(expected, output);
    case "any-of":
      return Array.isArray(expected) && expected.some((candidate) => canonical(candidate) === canonical(output));
  }
}

/** The part of a harness output that is judged. null when an in-place output is malformed. */
export function judgedValue(cf: Pick<CaseFile, "inPlace">, output: unknown): { value: unknown } | null {
  if (!cf.inPlace) return { value: output };
  if (typeof output !== "object" || output === null || !("param" in output)) return null;
  const { ret, param } = output as { ret: unknown; param: unknown };
  if (cf.inPlace.prefix !== "return") return { value: param };
  if (typeof ret !== "number" || !Number.isInteger(ret) || ret < 0) return null;
  if (!Array.isArray(param) || ret > param.length) return null;
  return { value: param.slice(0, ret) };
}

export function matches(
  cf: Pick<CaseFile, "compare" | "inPlace">,
  expected: unknown,
  output: unknown,
): boolean {
  const judged = judgedValue(cf, output);
  return judged !== null && compareValue(cf.compare, expected, judged.value);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/compare.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add runner/src/compare.ts runner/tests/compare.test.ts
git commit -m "feat(runner): add output comparator"
```

---

### Task 5: Stress cases (seeded generator + loader)

**Files:**
- Create: `runner/src/stress.ts`
- Test: `runner/tests/stress.test.ts`

**Interfaces:**
- Consumes (Task 1): `CaseFileError` from `schema.ts`; `tempDir`, `write`, `removeTemp` from `tests/helpers.ts` (Task 2).
- Produces:
  - `DEFAULT_STRESS_LIMIT_MS = 2000`.
  - `interface Rng { next(): number; int(min, max): number; pick<T>(items): T; shuffle<T>(items: T[]): T[]; intArray(length, min, max): number[] }`.
  - `interface StressCase { name: string; input: unknown; limitMs?: number }`.
  - `seedFromId(id: string): number`, `createRng(seed: number): Rng`.
  - `loadStressCases(dir: string, id: string): Promise<StressCase[] | null>`: `null` when the folder has no `stress.ts`; throws `CaseFileError` (file label `stress.ts`) when the file is invalid.
  - **Contract for `stress.ts` files:** `export default function stress(rng: Rng): StressCase[]`, importing types with `import type { Rng, StressCase } from "<relative>/runner/src/stress.ts"`.

- [ ] **Step 1: Write the failing tests**

`runner/tests/stress.test.ts`:

```ts
import { utimesSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CaseFileError } from "../src/schema.ts";
import { createRng, loadStressCases, seedFromId } from "../src/stress.ts";
import { removeTemp, tempDir, write } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

describe("createRng", () => {
  it("is deterministic for a seed and respects bounds", () => {
    const a = createRng(seedFromId("lc-0001"));
    const b = createRng(seedFromId("lc-0001"));
    const first = a.intArray(1000, -5, 5);
    expect(b.intArray(1000, -5, 5)).toEqual(first);
    expect(Math.min(...first)).toBe(-5);
    expect(Math.max(...first)).toBe(5);
    expect(createRng(seedFromId("lc-0002")).intArray(1000, -5, 5)).not.toEqual(first);
  });

  it("shuffles in place into a permutation", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const shuffled = createRng(7).shuffle([...items]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });
});

describe("loadStressCases", () => {
  it("returns null when the folder has no stress.ts", async () => {
    expect(await loadStressCases(path.join(dir, "none"), "x")).toBeNull();
  });

  it("calls the default export with a seeded rng", async () => {
    const folder = path.join(dir, "ok");
    write(
      folder,
      "stress.ts",
      [
        'import type { Rng, StressCase } from "../../../../src/stress.ts";',
        "export default function stress(rng: Rng): StressCase[] {",
        '  return [{ name: "big", input: [rng.intArray(5, 0, 9)], limitMs: 50 }];',
        "}",
        "",
      ].join("\n"),
    );
    const cases = await loadStressCases(folder, "lc-0001");
    expect(cases).toEqual([
      { name: "big", input: [createRng(seedFromId("lc-0001")).intArray(5, 0, 9)], limitMs: 50 },
    ]);
  });

  it("reloads the file after it changes", async () => {
    const folder = path.join(dir, "reload");
    const file = write(folder, "stress.ts", 'export default () => [{ name: "v1", input: [1] }];\n');
    expect((await loadStressCases(folder, "x"))?.[0].name).toBe("v1");
    write(folder, "stress.ts", 'export default () => [{ name: "v2", input: [1] }];\n');
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
    expect((await loadStressCases(folder, "x"))?.[0].name).toBe("v2");
  });

  it("rejects files without a default function or with bad cases", async () => {
    const noDefault = path.join(dir, "no-default");
    write(noDefault, "stress.ts", "export const x = 1;\n");
    await expect(loadStressCases(noDefault, "x")).rejects.toBeInstanceOf(CaseFileError);

    const bad = path.join(dir, "bad");
    write(bad, "stress.ts", 'export default () => [{ input: [1], limitMs: -1 }];\n');
    await expect(loadStressCases(bad, "x")).rejects.toThrow(/\[0\]\.name: required/);
  });
});
```

The relative import in the fixture points from `runner/tests/.tmp/t-XXXX/ok/stress.ts` to `runner/src/stress.ts`: four `..` segments reach `runner/`, then `src/stress.ts`. It is a type-only import and is erased at runtime.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/stress.test.ts`
Expected: FAIL — `../src/stress.ts` cannot be loaded.

- [ ] **Step 3: Implement `runner/src/stress.ts`**

```ts
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CaseFileError } from "./schema.ts";

export const DEFAULT_STRESS_LIMIT_MS = 2000;

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Shuffles in place and returns the same array. */
  shuffle<T>(items: T[]): T[];
  intArray(length: number, min: number, max: number): number[];
}

export interface StressCase {
  name: string;
  input: unknown;
  limitMs?: number;
}

/** FNV-1a 32-bit hash: a stable seed per problem id. */
export function seedFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, deterministic. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(0, i);
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
    intArray: (length, min, max) => Array.from({ length }, () => int(min, max)),
  };
}

export async function loadStressCases(dir: string, id: string): Promise<StressCase[] | null> {
  const file = path.join(dir, "stress.ts");
  if (!existsSync(file)) return null;
  // The mtime query busts the ESM cache so watch mode sees edits.
  const url = `${pathToFileURL(file).href}?mtime=${statSync(file).mtimeMs}`;
  const mod = (await import(url)) as { default?: unknown };
  if (typeof mod.default !== "function") {
    throw new CaseFileError(["expected a default export function (rng) => StressCase[]"], "stress.ts");
  }
  const cases = (mod.default as (rng: Rng) => unknown)(createRng(seedFromId(id)));
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new CaseFileError(["must return a non-empty array of { name, input, limitMs? }"], "stress.ts");
  }
  const issues: string[] = [];
  cases.forEach((item: Partial<StressCase> | null, i) => {
    if (typeof item?.name !== "string" || item.name === "") issues.push(`[${i}].name: required`);
    if (item?.input === undefined) issues.push(`[${i}].input: required`);
    if (item?.limitMs !== undefined && !(typeof item.limitMs === "number" && item.limitMs > 0)) {
      issues.push(`[${i}].limitMs: must be a positive number`);
    }
  });
  if (issues.length > 0) throw new CaseFileError(issues, "stress.ts");
  return cases as StressCase[];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/stress.test.ts`
Expected: PASS (6 tests).

The reload test depends on the ESM loader treating `?mtime=` as part of the module id. Under tsx (how watch mode runs), Node's loader does this. If only the vitest reload test fails because the old module comes back, do not weaken the loader. Instead, confirm reloading under tsx: run `TSX_TSCONFIG_PATH=tsconfig.json node --import tsx --input-type=module -e "…"` with a two-step import of the same file, and mark the vitest case `it.skipIf(!!process.env.VITEST)` with a comment explaining why.

- [ ] **Step 5: Commit**

```bash
git add runner/src/stress.ts runner/tests/stress.test.ts
git commit -m "feat(runner): add seeded stress case loader"
```

---
### Task 6: Repo model (frontmatter + scanner) and the query resolver

**Files:**
- Create: `lib/frontmatter.ts`, `lib/repo.ts`, `runner/src/resolver.ts`
- Test: `runner/tests/resolver.test.ts`

**Interfaces:**
- Consumes (Task 1): `Target` from `types.ts`. (Task 2): `tempDir`, `write`, `removeTemp` from `tests/helpers.ts`.
- Produces:
  - `lib/frontmatter.ts`: `interface ParsedMarkdown { head: string; data: Record<string, unknown>; body: string }` and `parseMarkdown(text: string): ParsedMarkdown`. `head` is the frontmatter block including both `---` fences and its trailing newline, or `""`. It throws on invalid YAML or a non-mapping.
  - `lib/repo.ts`:
    - `interface DocEntry { dir; folder; readme; rel; head; data; body; error: string | null }` (`rel` is the README path relative to the root, with `/` separators).
    - `interface ProblemEntry extends DocEntry { kind: "problem"; folderId: string }`.
    - `interface ExerciseEntry extends DocEntry { kind: "exercise"; concept: string; folderId: string }`.
    - `interface ConceptEntry extends DocEntry { kind: "concept"; slug: string }`.
    - `interface RepoModel { root; problems; exercises; concepts }`.
    - `problemIdFromFolder(folder): string`, `exerciseIdFromFolder(concept, folder): string`, `scanRepo(root): RepoModel` (entries sorted by folder name).
    - `str(value: unknown, fallback?: string): string`, `strList(value: unknown): string[]`.
  - `runner/src/resolver.ts`: `class QueryError extends Error { candidates: Target[] }`, `listTargets(root: string): Target[]` (only folders with `cases.json`), `resolveQuery(targets: Target[], query: string): Target`.

- [ ] **Step 1: Write the failing tests**

`runner/tests/resolver.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { parseMarkdown } from "../../lib/frontmatter.ts";
import { scanRepo } from "../../lib/repo.ts";
import { listTargets, QueryError, resolveQuery } from "../src/resolver.ts";
import { removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

function problem(folder: string, title: string, withCases = true): void {
  write(root, `problems/${folder}/README.md`, `---\ntitle: ${title}\nstatus: todo\n---\n# ${title}\n`);
  if (withCases) write(root, `problems/${folder}/cases.json`, "{}");
}
problem("lc-0001-two-sum", "Two Sum");
problem("lc-0010-regular-expression-matching", "Regular Expression Matching");
problem("lc-0015-3sum", "3Sum");
problem("lc-0020-valid-parentheses", "Valid Parentheses", false);
write(root, "concepts/greedy/README.md", "---\nslug: greedy\ntitle: Greedy\n---\n# Greedy\n");
write(root, "concepts/greedy/exercises/01-coins/README.md", "---\ntitle: Coins\n---\n");
write(root, "concepts/greedy/exercises/01-coins/cases.json", "{}");
write(root, "concepts/greedy/exercises/02-intervals/README.md", "---\ntitle: Intervals\n---\n");
write(root, "concepts/greedy/exercises/02-intervals/cases.json", "{}");
write(root, "problems/lc-0099-no-readme/cases.json", "{}");

function candidatesOf(query: string): string[] {
  try {
    resolveQuery(listTargets(root), query);
  } catch (error) {
    if (error instanceof QueryError) return error.candidates.map((t) => t.id);
    throw error;
  }
  return [];
}

describe("parseMarkdown", () => {
  it("splits frontmatter and body, keeping the raw head", () => {
    const text = "---\ntitle: A\nlist: [x, y]\n---\n# A\n";
    const parsed = parseMarkdown(text);
    expect(parsed.data).toEqual({ title: "A", list: ["x", "y"] });
    expect(parsed.head + parsed.body).toBe(text);
    expect(parsed.body).toBe("# A\n");
  });

  it("returns an empty head when there is no frontmatter", () => {
    expect(parseMarkdown("# Hi\n")).toEqual({ head: "", data: {}, body: "# Hi\n" });
  });

  it("throws on invalid YAML", () => {
    expect(() => parseMarkdown("---\ntitle: [unclosed\n---\n")).toThrow();
  });
});

describe("scanRepo", () => {
  it("finds problems, concepts and exercises with their ids", () => {
    const repo = scanRepo(root);
    expect(repo.problems.map((p) => p.folderId)).toEqual(["lc-0001", "lc-0010", "lc-0015", "lc-0020", "lc-0099"]);
    expect(repo.concepts.map((c) => c.slug)).toEqual(["greedy"]);
    expect(repo.exercises.map((e) => e.folderId)).toEqual(["greedy/01", "greedy/02"]);
    expect(repo.problems[0].rel).toBe("problems/lc-0001-two-sum/README.md");
    expect(repo.problems.find((p) => p.folderId === "lc-0099")?.error).toBe("README.md is missing");
  });
});

describe("resolveQuery", () => {
  const targets = () => listTargets(root);

  it("lists only folders that have cases.json", () => {
    expect(targets().map((t) => t.id)).toEqual(["lc-0001", "lc-0010", "lc-0015", "lc-0099", "greedy/01", "greedy/02"]);
    expect(targets()[0]).toMatchObject({ kind: "problem", title: "Two Sum" });
  });

  it("matches exact ids, LeetCode numbers and slug fragments", () => {
    expect(resolveQuery(targets(), "lc-0015").title).toBe("3Sum");
    expect(resolveQuery(targets(), "1").id).toBe("lc-0001");
    expect(resolveQuery(targets(), "0010").id).toBe("lc-0010");
    expect(resolveQuery(targets(), "two").id).toBe("lc-0001");
    expect(resolveQuery(targets(), "greedy/01").title).toBe("Coins");
    expect(resolveQuery(targets(), "INTERVALS").id).toBe("greedy/02");
  });

  it("lists candidates instead of guessing", () => {
    expect(candidatesOf("sum")).toEqual(["lc-0001", "lc-0015"]);
    expect(candidatesOf("greedy")).toEqual(["greedy/01", "greedy/02"]);
  });

  it("explains when nothing matches", () => {
    expect(() => resolveQuery(targets(), "nope")).toThrow('Nothing matches "nope".');
    expect(() => resolveQuery(targets(), " ")).toThrow(QueryError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/resolver.test.ts`
Expected: FAIL — `../../lib/frontmatter.ts` cannot be loaded.

- [ ] **Step 3: Implement `lib/frontmatter.ts`**

```ts
import { parse } from "yaml";

export interface ParsedMarkdown {
  /** Frontmatter block including both `---` fences and the trailing newline ("" if none). */
  head: string;
  data: Record<string, unknown>;
  body: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function parseMarkdown(text: string): ParsedMarkdown {
  const match = FENCE.exec(text);
  if (!match) return { head: "", data: {}, body: text };
  const data: unknown = parse(match[1]) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("frontmatter must be a YAML mapping");
  }
  return { head: match[0], data: data as Record<string, unknown>, body: text.slice(match[0].length) };
}
```

- [ ] **Step 4: Implement `lib/repo.ts`**

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseMarkdown } from "./frontmatter.ts";

export interface DocEntry {
  /** Absolute folder path. */
  dir: string;
  folder: string;
  /** Absolute README.md path. */
  readme: string;
  /** README path relative to the repo root, with "/" separators. */
  rel: string;
  head: string;
  data: Record<string, unknown>;
  body: string;
  /** README missing or unparsable. */
  error: string | null;
}

export interface ProblemEntry extends DocEntry {
  kind: "problem";
  folderId: string;
}

export interface ExerciseEntry extends DocEntry {
  kind: "exercise";
  concept: string;
  folderId: string;
}

export interface ConceptEntry extends DocEntry {
  kind: "concept";
  slug: string;
}

export interface RepoModel {
  root: string;
  problems: ProblemEntry[];
  exercises: ExerciseEntry[];
  concepts: ConceptEntry[];
}

/** "lc-0001-two-sum" → "lc-0001"; folders without a number keep their full name. */
export function problemIdFromFolder(folder: string): string {
  return /^([a-z]+-\d{4})-/.exec(folder)?.[1] ?? folder;
}

/** ("greedy", "01-coins") → "greedy/01" */
export function exerciseIdFromFolder(concept: string, folder: string): string {
  return `${concept}/${/^(\d{2})-/.exec(folder)?.[1] ?? folder}`;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function subdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith(".") && statSync(path.join(dir, name)).isDirectory())
    .sort();
}

function readDoc(root: string, dir: string): DocEntry {
  const readme = path.join(dir, "README.md");
  const base = {
    dir,
    folder: path.basename(dir),
    readme,
    rel: path.relative(root, readme).split(path.sep).join("/"),
  };
  if (!existsSync(readme)) return { ...base, head: "", data: {}, body: "", error: "README.md is missing" };
  try {
    return { ...base, ...parseMarkdown(readFileSync(readme, "utf8")), error: null };
  } catch (error) {
    return { ...base, head: "", data: {}, body: "", error: `frontmatter: ${(error as Error).message}` };
  }
}

export function scanRepo(root: string): RepoModel {
  const problems = subdirs(path.join(root, "problems")).map(
    (folder): ProblemEntry => ({
      ...readDoc(root, path.join(root, "problems", folder)),
      kind: "problem",
      folderId: problemIdFromFolder(folder),
    }),
  );
  const concepts: ConceptEntry[] = [];
  const exercises: ExerciseEntry[] = [];
  for (const slug of subdirs(path.join(root, "concepts"))) {
    const conceptDir = path.join(root, "concepts", slug);
    concepts.push({ ...readDoc(root, conceptDir), kind: "concept", slug });
    for (const folder of subdirs(path.join(conceptDir, "exercises"))) {
      exercises.push({
        ...readDoc(root, path.join(conceptDir, "exercises", folder)),
        kind: "exercise",
        concept: slug,
        folderId: exerciseIdFromFolder(slug, folder),
      });
    }
  }
  return { root, problems, exercises, concepts };
}
```

- [ ] **Step 5: Implement `runner/src/resolver.ts`**

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { scanRepo, str } from "../../lib/repo.ts";
import type { Target } from "./types.ts";

export class QueryError extends Error {
  constructor(
    message: string,
    readonly candidates: Target[] = [],
  ) {
    super(message);
    this.name = "QueryError";
  }
}

/** Every runnable folder (it has cases.json): problems first, then exercises. */
export function listTargets(root: string): Target[] {
  const repo = scanRepo(root);
  const targets: Target[] = [
    ...repo.problems.map((p) => ({ id: p.folderId, kind: "problem" as const, dir: p.dir, title: str(p.data.title, p.folder) })),
    ...repo.exercises.map((e) => ({ id: e.folderId, kind: "exercise" as const, dir: e.dir, title: str(e.data.title, e.folder) })),
  ];
  return targets.filter((target) => existsSync(path.join(target.dir, "cases.json")));
}

/** Exact id → LeetCode number → substring of id or folder name. Never guesses between several. */
export function resolveQuery(targets: Target[], query: string): Target {
  const q = query.trim().toLowerCase();
  if (!q) {
    throw new QueryError("Give a problem or exercise: an id (lc-0001, greedy/01), a number, or part of the name.");
  }
  const exact = targets.filter((target) => target.id.toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  if (/^\d{1,4}$/.test(q)) {
    const byNumber = targets.filter((target) => target.id === `lc-${q.padStart(4, "0")}`);
    if (byNumber.length === 1) return byNumber[0];
  }
  const partial = targets.filter(
    (target) => target.id.toLowerCase().includes(q) || path.basename(target.dir).toLowerCase().includes(q),
  );
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new QueryError(`Nothing matches "${query}".`);
  throw new QueryError(`"${query}" matches ${partial.length} problems/exercises — be more specific:`, partial);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/resolver.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/frontmatter.ts lib/repo.ts runner/src/resolver.ts runner/tests/resolver.test.ts
git commit -m "feat(lib): add repo model and query resolver"
```

---

### Task 7: Solution stubs

**Files:**
- Create: `runner/src/stubs.ts`
- Test: `runner/tests/stubs.test.ts`

**Interfaces:**
- Consumes (Task 1): `CaseFile`, `Lang`.
- Produces:
  - `pyType(type: string): string`, `tsType(type: string): string`.
  - `renderStub(cf: CaseFile, lang: Lang): string`.
  - `solutionPath(dir: string, lang: Lang): string` → `<dir>/solution.<lang>`.
  - `ensureSolution(dir: string, cf: CaseFile, lang: Lang): { path: string; created: boolean }`. It never overwrites an existing file.

- [ ] **Step 1: Write the failing tests**

`runner/tests/stubs.test.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ensureSolution, pyType, renderStub, tsType } from "../src/stubs.ts";
import type { CaseFile } from "../src/types.ts";
import { removeTemp, tempDir } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

const base: CaseFile = {
  mode: "function",
  entry: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
  compare: "exact",
  inPlace: null,
  examples: [],
  hidden: [],
};

describe("type mapping", () => {
  it("maps nested and nullable types", () => {
    expect(pyType("string[][]")).toBe("list[list[str]]");
    expect(pyType("ListNode[]")).toBe("list[ListNode | None]");
    expect(pyType("void")).toBe("None");
    expect(tsType("int[][]")).toBe("number[][]");
    expect(tsType("ListNode[]")).toBe("(ListNode | null)[]");
    expect(tsType("bool")).toBe("boolean");
  });
});

describe("renderStub", () => {
  it("renders LeetCode-shaped function stubs", () => {
    expect(renderStub(base, "py")).toBe(
      "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        raise NotImplementedError\n",
    );
    expect(renderStub(base, "ts")).toBe(
      'export default function twoSum(nums: number[], target: number): number[] {\n  throw new Error("Not implemented");\n}\n',
    );
  });

  it("imports node classes from lc only when the signature uses them", () => {
    const merge: CaseFile = {
      ...base,
      entry: "mergeTwoLists",
      params: [
        { name: "list1", type: "ListNode" },
        { name: "list2", type: "ListNode" },
      ],
      returns: "ListNode",
    };
    expect(renderStub(merge, "py")).toBe(
      "from lc import ListNode  # delete this line when pasting into LeetCode\n\n\n" +
        "class Solution:\n    def mergeTwoLists(self, list1: ListNode | None, list2: ListNode | None) -> ListNode | None:\n        raise NotImplementedError\n",
    );
    expect(renderStub(merge, "ts")).toBe(
      'import { ListNode } from "lc"; // delete this line when pasting into LeetCode\n\n' +
        'export default function mergeTwoLists(list1: ListNode | null, list2: ListNode | null): ListNode | null {\n  throw new Error("Not implemented");\n}\n',
    );
  });

  it("renders empty classes in class mode", () => {
    const design: CaseFile = { ...base, mode: "class", entry: "MinStack", params: [], returns: null };
    expect(renderStub(design, "py")).toBe("class MinStack:\n    def __init__(self) -> None:\n        pass\n");
    expect(renderStub(design, "ts")).toBe("export default class MinStack {\n  constructor() {}\n}\n");
  });
});

describe("ensureSolution", () => {
  it("creates the file once and never overwrites it", () => {
    const first = ensureSolution(dir, base, "py");
    expect(first).toEqual({ path: path.join(dir, "solution.py"), created: true });
    writeFileSync(first.path, "# my work\n");
    const second = ensureSolution(dir, { ...base, entry: "other" }, "py");
    expect(second.created).toBe(false);
    expect(readFileSync(first.path, "utf8")).toBe("# my work\n");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/stubs.test.ts`
Expected: FAIL — `../src/stubs.ts` cannot be loaded.

- [ ] **Step 3: Implement `runner/src/stubs.ts`**

```ts
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CaseFile, Lang } from "./types.ts";

const PY_BASE: Record<string, string> = {
  int: "int",
  float: "float",
  bool: "bool",
  string: "str",
  ListNode: "ListNode | None",
  TreeNode: "TreeNode | None",
  void: "None",
};

const TS_BASE: Record<string, string> = {
  int: "number",
  float: "number",
  bool: "boolean",
  string: "string",
  ListNode: "ListNode | null",
  TreeNode: "TreeNode | null",
  void: "void",
};

export function pyType(type: string): string {
  return type.endsWith("[]") ? `list[${pyType(type.slice(0, -2))}]` : PY_BASE[type];
}

export function tsType(type: string): string {
  if (!type.endsWith("[]")) return TS_BASE[type];
  const inner = tsType(type.slice(0, -2));
  return inner.includes("|") ? `(${inner})[]` : `${inner}[]`;
}

function nodeClassesUsed(cf: CaseFile): string[] {
  const bases = [...cf.params.map((param) => param.type), cf.returns ?? ""].map((type) =>
    type.replace(/(\[\])+$/, ""),
  );
  return ["ListNode", "TreeNode"].filter((name) => bases.includes(name));
}

export function renderStub(cf: CaseFile, lang: Lang): string {
  const nodes = nodeClassesUsed(cf);
  if (lang === "py") {
    const header = nodes.length
      ? `from lc import ${nodes.join(", ")}  # delete this line when pasting into LeetCode\n\n\n`
      : "";
    if (cf.mode === "class") return `${header}class ${cf.entry}:\n    def __init__(self) -> None:\n        pass\n`;
    const params = ["self", ...cf.params.map((param) => `${param.name}: ${pyType(param.type)}`)].join(", ");
    return `${header}class Solution:\n    def ${cf.entry}(${params}) -> ${pyType(cf.returns ?? "void")}:\n        raise NotImplementedError\n`;
  }
  const header = nodes.length
    ? `import { ${nodes.join(", ")} } from "lc"; // delete this line when pasting into LeetCode\n\n`
    : "";
  if (cf.mode === "class") return `${header}export default class ${cf.entry} {\n  constructor() {}\n}\n`;
  const params = cf.params.map((param) => `${param.name}: ${tsType(param.type)}`).join(", ");
  return `${header}export default function ${cf.entry}(${params}): ${tsType(cf.returns ?? "void")} {\n  throw new Error("Not implemented");\n}\n`;
}

export function solutionPath(dir: string, lang: Lang): string {
  return path.join(dir, `solution.${lang}`);
}

/** Creates solution.<lang> from the signature when it does not exist yet. Never overwrites. */
export function ensureSolution(dir: string, cf: CaseFile, lang: Lang): { path: string; created: boolean } {
  const file = solutionPath(dir, lang);
  if (existsSync(file)) return { path: file, created: false };
  writeFileSync(file, renderStub(cf, lang), { flag: "wx" });
  return { path: file, created: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/stubs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add runner/src/stubs.ts runner/tests/stubs.test.ts
git commit -m "feat(runner): generate solution stubs from signatures"
```

---

### Task 8: Orchestrator (`runTarget`)

**Files:**
- Create: `runner/src/run.ts`
- Modify: `runner/tests/helpers.ts` (add `makeProblem`)
- Test: `runner/tests/run.test.ts`

**Interfaces:**
- Consumes: `loadCaseFile`, `assertHiddenFilled`, `CaseFileError` (Task 1); `runHarness` (Task 2); `matches` (Task 4); `loadStressCases`, `DEFAULT_STRESS_LIMIT_MS` (Task 5); `ensureSolution` (Task 7); `contentRoot` (Task 1).
- Produces:
  - `EXAMPLES_WALL_MS = 5000`, `STRESS_EXTRA_MS = 2000`, `STDOUT_MAX_LINES = 20`.
  - `truncateLines(text: string, max?: number): string`.
  - `interface RunOptions { examplesWallMs?: number; root?: string }` (`root` defaults to `contentRoot()` and is used for the relative `readme`/`solution` paths).
  - `runTarget(target: Target, lang: Lang, options?: RunOptions): Promise<RunResult>`.
    - Throws `CaseFileError` for invalid `cases.json` / `stress.ts` or missing hidden `expected`.
    - Creates the stub when the solution file is missing.
  - `tests/helpers.ts`: `makeProblem(root: string, folder: string, cases: Record<string, unknown>, files?: Record<string, string>): Target`.

- [ ] **Step 1: Add `makeProblem` to `runner/tests/helpers.ts`**

Append:

```ts
import { problemIdFromFolder } from "../../lib/repo.ts";
import type { Target } from "../src/types.ts";

/** Creates problems/<folder>/ with a README, cases.json and any extra files (solution.py, stress.ts…). */
export function makeProblem(
  root: string,
  folder: string,
  cases: Record<string, unknown>,
  files: Record<string, string> = {},
): Target {
  const dir = path.join(root, "problems", folder);
  write(root, `problems/${folder}/README.md`, `---\ntitle: ${folder}\n---\n# ${folder}\n`);
  write(root, `problems/${folder}/cases.json`, JSON.stringify(cases, null, 2));
  for (const [name, content] of Object.entries(files)) write(dir, name, content);
  return { id: problemIdFromFolder(folder), kind: "problem", dir, title: folder };
}
```

Move the two new `import` lines to the top of the file, next to the existing imports.

- [ ] **Step 2: Write the failing tests**

`runner/tests/run.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runTarget } from "../src/run.ts";
import { CaseFileError } from "../src/schema.ts";
import { makeProblem, removeTemp, tempDir } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const SUM = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [
    { input: [[1, 2, 3]], expected: 6 },
    { input: [[]], expected: 0 },
  ],
  hidden: [
    { input: [[5, 5]], expected: 10 },
    { input: [[-1, 1]], expected: 0 },
    { input: [[100]], expected: 100 },
  ],
};
const SENTINEL = 987654321;
const SUM_WITH_SENTINEL = { ...SUM, hidden: [{ input: [[5, 5]], expected: 10 }, { input: [[-1, 1]], expected: SENTINEL }] };

const PY = {
  correct: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n",
  length: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        print('debug', nums)\n        return len(nums)\n",
  positives: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(n for n in nums if n > 0)\n",
  sleepy: "import time\n\n\nclass Solution:\n    def solve(self, nums: list[int]) -> int:\n        time.sleep(0.2)\n        return sum(nums)\n",
  loop: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        while nums == [1, 2, 3]:\n            pass\n        return sum(nums)\n",
  chatty: "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        for i in range(30):\n            print('line', i)\n        return sum(nums)\n",
  broken: "class Solution:\n    def solve(self, nums)\n        return 0\n",
};
const TS_CORRECT = "export default function solve(nums: number[]): number {\n  return nums.reduce((a, b) => a + b, 0);\n}\n";
const STRESS = 'export default () => [{ name: "n=1e5", input: [Array.from({ length: 100000 }, (_, i) => i % 7)], limitMs: 100 }];\n';

describe("runTarget", () => {
  it("is green in both languages when everything passes", async () => {
    const target = makeProblem(root, "lc-0001-green", SUM, { "solution.py": PY.correct, "solution.ts": TS_CORRECT });
    for (const lang of ["py", "ts"] as const) {
      const result = await runTarget(target, lang, { root });
      expect(result.fatal).toBeNull();
      expect(result.examples).toMatchObject({ passed: 2, total: 2 });
      expect(result.hidden).toEqual({ status: "pass", passed: 3, total: 3, firstFailure: null });
      expect(result.stress).toEqual({ status: "none", cases: [] });
      expect(result.green).toBe(true);
      expect(result.readme).toBe("problems/lc-0001-green/README.md");
      expect(result.solution).toBe(`problems/lc-0001-green/solution.${lang}`);
    }
  });

  it("runs stress cases and flags slow solutions", async () => {
    const fast = makeProblem(root, "lc-0002-stress-fast", SUM, { "solution.py": PY.correct, "stress.ts": STRESS });
    const fastResult = await runTarget(fast, "py", { root });
    expect(fastResult.stress.status).toBe("pass");
    expect(fastResult.stress.cases[0]).toMatchObject({ name: "n=1e5", status: "pass", limitMs: 100 });
    expect(fastResult.green).toBe(true);

    const slow = makeProblem(root, "lc-0003-stress-slow", SUM, { "solution.py": PY.sleepy, "stress.ts": STRESS });
    const slowResult = await runTarget(slow, "py", { root });
    expect(slowResult.stress.status).toBe("fail");
    expect(slowResult.stress.cases[0].status).toBe("slow");
    expect(slowResult.green).toBe(false);
  });

  it("skips hidden and stress when an example fails", async () => {
    const target = makeProblem(root, "lc-0004-example-fail", SUM, { "solution.py": PY.length, "stress.ts": STRESS });
    const result = await runTarget(target, "py", { root });
    expect(result.examples.passed).toBe(1);
    expect(result.examples.cases[0]).toMatchObject({ status: "fail", output: 3, expected: 6, stdout: "debug [1, 2, 3]\n" });
    expect(result.hidden).toEqual({ status: "skipped", passed: 0, total: 3, firstFailure: null });
    expect(result.stress.status).toBe("skipped");
    expect(result.green).toBe(false);
  });

  it("reports only the first failing hidden input and the user's output", async () => {
    const target = makeProblem(root, "lc-0005-hidden-fail", SUM, { "solution.py": PY.positives, "stress.ts": STRESS });
    const result = await runTarget(target, "py", { root });
    expect(result.hidden.status).toBe("fail");
    expect(result.hidden.passed).toBe(2);
    expect(result.hidden.firstFailure).toEqual({ input: [[-1, 1]], output: 1, stdout: "" });
    expect(result.stress.status).toBe("skipped");
  });

  it("never leaks hidden expected values", async () => {
    const target = makeProblem(root, "lc-0006-leak", SUM_WITH_SENTINEL, { "solution.py": PY.correct });
    const result = await runTarget(target, "py", { root });
    expect(result.hidden.status).toBe("fail");
    expect(JSON.stringify(result)).not.toContain(String(SENTINEL));
  });

  it("marks the example in flight as timeout and the rest as skipped", async () => {
    const target = makeProblem(root, "lc-0007-loop", SUM, { "solution.py": PY.loop });
    const result = await runTarget(target, "py", { root, examplesWallMs: 1500 });
    expect(result.examples.cases[0].status).toBe("timeout");
    expect(result.examples.cases[0].error?.kind).toBe("timeout");
    expect(result.examples.cases[1].status).toBe("skipped");
    expect(result.green).toBe(false);
  });

  it("reports load errors as fatal", async () => {
    const target = makeProblem(root, "lc-0008-broken", SUM, { "solution.py": PY.broken });
    const result = await runTarget(target, "py", { root });
    expect(result.fatal?.kind).toBe("load");
    expect(result.examples.cases.every((c) => c.status === "skipped")).toBe(true);
    expect(result.green).toBe(false);
  });

  it("creates a stub when the solution file is missing", async () => {
    const target = makeProblem(root, "lc-0009-stub", SUM);
    const result = await runTarget(target, "py", { root });
    const file = path.join(target.dir, "solution.py");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("def solve(self, nums: list[int]) -> int:");
    expect(result.examples.cases[0].status).toBe("error");
    expect(result.examples.cases[0].error?.message).toMatch(/NotImplementedError/);
  });

  it("truncates captured stdout to 20 lines", async () => {
    const target = makeProblem(root, "lc-0010-chatty", SUM, { "solution.py": PY.chatty });
    const result = await runTarget(target, "py", { root });
    const lines = result.examples.cases[0].stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(21);
    expect(lines[19]).toBe("line 19");
    expect(lines[20]).toBe("… 10 more lines");
  });

  it("refuses to run with unfilled hidden expected values", async () => {
    const target = makeProblem(root, "lc-0011-unfilled", { ...SUM, hidden: [{ input: [[1]] }] }, { "solution.py": PY.correct });
    await expect(runTarget(target, "py", { root })).rejects.toBeInstanceOf(CaseFileError);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/run.test.ts`
Expected: FAIL — `../src/run.ts` cannot be loaded.

- [ ] **Step 4: Implement `runner/src/run.ts`**

```ts
import path from "node:path";
import { matches } from "./compare.ts";
import { runHarness } from "./executor.ts";
import { contentRoot } from "./paths.ts";
import { assertHiddenFilled, loadCaseFile } from "./schema.ts";
import { DEFAULT_STRESS_LIMIT_MS, loadStressCases } from "./stress.ts";
import { ensureSolution } from "./stubs.ts";
import type {
  CaseFile,
  CaseRun,
  CaseStatus,
  ExampleResult,
  HarnessError,
  HarnessOutcome,
  HiddenResult,
  Lang,
  RunResult,
  StressCaseResult,
  StressResult,
  Target,
} from "./types.ts";

export const EXAMPLES_WALL_MS = 5000;
export const STRESS_EXTRA_MS = 2000;
export const STDOUT_MAX_LINES = 20;

export interface RunOptions {
  /** Wall-clock limit for the examples + hidden process (default 5000 ms). */
  examplesWallMs?: number;
  /** Root used for the relative paths in the result (default: contentRoot()). */
  root?: string;
}

export function truncateLines(text: string, max = STDOUT_MAX_LINES): string {
  if (text === "") return "";
  const lines = text.replace(/\n$/, "").split("\n");
  if (lines.length <= max) return text;
  return `${lines.slice(0, max).join("\n")}\n… ${lines.length - max} more lines\n`;
}

function timeoutError(limitMs: number): HarnessError {
  return { kind: "timeout", message: `exceeded the ${limitMs} ms time limit`, trace: "" };
}

interface Judged {
  status: CaseStatus;
  output?: unknown;
  error?: HarnessError;
  ms?: number;
  stdout: string;
}

function judge(
  cf: CaseFile,
  id: string,
  expected: unknown,
  outcome: HarnessOutcome,
  limitMs: number,
): Judged {
  const run: CaseRun | undefined = outcome.runs.get(id);
  if (!run) {
    return outcome.timedOutCase === id
      ? { status: "timeout", error: timeoutError(limitMs), stdout: "" }
      : { status: "skipped", stdout: "" };
  }
  if (!run.ok) return { status: "error", error: run.error, ms: run.ms, stdout: truncateLines(run.stdout) };
  return {
    status: matches(cf, expected, run.output) ? "pass" : "fail",
    output: run.output,
    ms: run.ms,
    stdout: truncateLines(run.stdout),
  };
}

export async function runTarget(target: Target, lang: Lang, options: RunOptions = {}): Promise<RunResult> {
  const root = options.root ?? contentRoot();
  const wallMs = options.examplesWallMs ?? EXAMPLES_WALL_MS;
  const cf = loadCaseFile(target.dir);
  assertHiddenFilled(cf);
  const solution = ensureSolution(target.dir, cf, lang).path;
  const rel = (file: string): string => path.relative(root, file).split(path.sep).join("/");
  const request = {
    solutionPath: solution,
    mode: cf.mode,
    entry: cf.entry,
    params: cf.params,
    returns: cf.returns,
    inPlace: cf.inPlace,
  };

  const result: RunResult = {
    id: target.id,
    title: target.title,
    lang,
    readme: rel(path.join(target.dir, "README.md")),
    solution: rel(solution),
    fatal: null,
    examples: { passed: 0, total: cf.examples.length, cases: [] },
    hidden: { status: "skipped", passed: 0, total: cf.hidden.length, firstFailure: null },
    stress: { status: "skipped", cases: [] },
    green: false,
  };

  // Examples and hidden share one process; hidden results are only reported when every example passes.
  const outcome = await runHarness(
    lang,
    {
      ...request,
      discardOutput: false,
      cases: [
        ...cf.examples.map((entry, i) => ({ id: `e${i + 1}`, input: entry.input })),
        ...cf.hidden.map((entry, i) => ({ id: `h${i + 1}`, input: entry.input })),
      ],
    },
    { wallLimitMs: wallMs },
  );

  if (outcome.fatal) {
    result.fatal = outcome.fatal;
    result.examples.cases = cf.examples.map((entry, i) => ({
      id: i + 1,
      status: "skipped",
      input: entry.input,
      expected: entry.expected,
      stdout: "",
    }));
    return result;
  }

  result.examples.cases = cf.examples.map(
    (entry, i): ExampleResult => ({
      id: i + 1,
      input: entry.input,
      expected: entry.expected,
      ...judge(cf, `e${i + 1}`, entry.expected, outcome, wallMs),
    }),
  );
  result.examples.passed = result.examples.cases.filter((c) => c.status === "pass").length;
  if (result.examples.passed < result.examples.total) return result;

  const hidden: HiddenResult = { status: "pass", passed: 0, total: cf.hidden.length, firstFailure: null };
  cf.hidden.forEach((entry, i) => {
    const judged = judge(cf, `h${i + 1}`, entry.expected, outcome, wallMs);
    if (judged.status === "pass") {
      hidden.passed++;
      return;
    }
    hidden.status = "fail";
    // Only the input and the user's own output/error: never entry.expected.
    hidden.firstFailure ??= {
      input: entry.input,
      ...(judged.output !== undefined ? { output: judged.output } : {}),
      ...(judged.error ? { error: judged.error } : {}),
      stdout: judged.stdout,
    };
  });
  result.hidden = hidden;
  if (hidden.status !== "pass") return result;

  const stressCases = await loadStressCases(target.dir, target.id);
  if (!stressCases) {
    result.stress = { status: "none", cases: [] };
    result.green = true;
    return result;
  }
  const limits = stressCases.map((c) => c.limitMs ?? DEFAULT_STRESS_LIMIT_MS);
  const stressOutcome = await runHarness(
    lang,
    {
      ...request,
      discardOutput: true,
      cases: stressCases.map((c, i) => ({ id: `s${i + 1}`, input: c.input })),
    },
    { wallLimitMs: limits.reduce((sum, limit) => sum + limit, 0) + STRESS_EXTRA_MS },
  );
  const stress: StressResult = {
    status: "pass",
    cases: stressCases.map((c, i): StressCaseResult => {
      const limitMs = limits[i];
      if (stressOutcome.fatal) return { name: c.name, status: "error", limitMs, error: stressOutcome.fatal };
      const run = stressOutcome.runs.get(`s${i + 1}`);
      if (!run) {
        return stressOutcome.timedOutCase === `s${i + 1}`
          ? { name: c.name, status: "timeout", limitMs }
          : { name: c.name, status: "skipped", limitMs };
      }
      if (!run.ok) return { name: c.name, status: "error", ms: run.ms, limitMs, error: run.error };
      return { name: c.name, status: run.ms <= limitMs ? "pass" : "slow", ms: run.ms, limitMs };
    }),
  };
  stress.status = stress.cases.every((c) => c.status === "pass") ? "pass" : "fail";
  result.stress = stress;
  result.green = stress.status === "pass";
  return result;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/run.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add runner/src/run.ts runner/tests/helpers.ts runner/tests/run.test.ts
git commit -m "feat(runner): orchestrate examples, hidden and stress phases"
```

---

### Task 9: Terminal reporter and the `pnpm test` CLI

**Files:**
- Create: `runner/src/reporter.ts`, `runner/src/cli.ts`
- Test: `runner/tests/reporter.test.ts`, `runner/tests/cli.test.ts`

**Interfaces:**
- Consumes: `RunResult` and friends (Task 1); `runTarget` (Task 8); `listTargets`, `resolveQuery`, `QueryError` (Task 6); `solutionPath` (Task 7); `CaseFileError` (Task 1); `contentRoot`, `TSX_BIN`, `REPO_ROOT` (Task 1); `makeProblem` (Task 8 helpers).
- Produces:
  - `reporter.ts`: `formatInput(input: unknown): string`, `formatOutput(output: unknown): string`, `formatTerminal(result: RunResult): string`.
  - `cli.ts`: `pnpm test <query> [--lang py|ts|all] [--json]`.
    - Exit codes: 0 when every result is green; 1 when not green or on usage/query errors; 2 on a case-file error.
    - `--json` prints one object for a single language, or an array for `--lang all`.
    - `--lang all` runs only the languages whose solution file exists.
  - The `watch` and `fill-expected` commands are added in Tasks 10 and 11.

- [ ] **Step 1: Write the failing reporter tests**

`runner/tests/reporter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatInput, formatOutput, formatTerminal } from "../src/reporter.ts";
import type { RunResult } from "../src/types.ts";

const strip = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: "lc-0001",
    title: "Two Sum",
    lang: "py",
    readme: "problems/lc-0001-two-sum/README.md",
    solution: "problems/lc-0001-two-sum/solution.py",
    fatal: null,
    examples: {
      passed: 1,
      total: 1,
      cases: [{ id: 1, status: "pass", input: [[2, 7, 11, 15], 9], expected: [0, 1], output: [0, 1], ms: 0.01, stdout: "" }],
    },
    hidden: { status: "pass", passed: 3, total: 3, firstFailure: null },
    stress: { status: "none", cases: [] },
    green: true,
    ...overrides,
  };
}

describe("formatInput / formatOutput", () => {
  it("joins positional arguments and shows in-place results", () => {
    expect(formatInput([[2, 7, 11, 15], 9])).toBe("[2,7,11,15], 9");
    expect(formatOutput({ ret: 2, param: [1, 2, 2] })).toBe("returned 2, array is now [1,2,2]");
    expect(formatOutput("x".repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe("formatTerminal", () => {
  it("renders a green run", () => {
    const text = strip(formatTerminal(result()));
    expect(text).toContain("lc-0001 · Two Sum · py");
    expect(text).toContain("problems/lc-0001-two-sum/README.md");
    expect(text).toContain("✓ example 1   [2,7,11,15], 9 → [0,1]");
    expect(text).toContain("0.01ms");
    expect(text).toContain("✓ hidden      3/3 passed");
    expect(text).toContain("· stress      no stress cases");
    expect(text).toContain("1/1 examples · 3/3 hidden · GREEN ✓");
  });

  it("renders a failing example with expected, got and stdout, and skips later phases", () => {
    const text = strip(
      formatTerminal(
        result({
          examples: {
            passed: 0,
            total: 1,
            cases: [{ id: 1, status: "fail", input: [[3, 3], 6], expected: [0, 1], output: [0, 0], ms: 0.02, stdout: "seen {3: 0}\nnext\n" }],
          },
          hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
          stress: { status: "skipped", cases: [] },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✗ example 1   [3,3], 6");
    expect(text).toContain("    expected  [0,1]");
    expect(text).toContain("    got       [0,0]");
    expect(text).toContain("    stdout    > seen {3: 0}");
    expect(text).toContain("              > next");
    expect(text).toContain("– hidden      skipped (fix examples first)");
    expect(text).toContain("– stress      skipped");
    expect(text).not.toContain("GREEN");
  });

  it("renders the first hidden failure without an expected line", () => {
    const text = strip(
      formatTerminal(
        result({
          hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [[-1, 1]], output: 1, stdout: "" } },
          stress: { status: "skipped", cases: [] },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✗ hidden      2/3 passed");
    expect(text).toContain("    input     [-1,1]");
    expect(text).toContain("    got       1");
    expect(text).toContain("– stress      skipped (fix hidden cases first)");
    expect(text.split("expected").length).toBe(1);
  });

  it("renders stress timings and slow cases", () => {
    const text = strip(
      formatTerminal(
        result({
          stress: {
            status: "fail",
            cases: [
              { name: "n=1e5", status: "pass", ms: 12, limitMs: 2000 },
              { name: "n=1e6", status: "slow", ms: 2500, limitMs: 2000 },
            ],
          },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✓ stress      n=1e5");
    expect(text).toContain("12ms / 2000ms");
    expect(text).toContain("✗ stress      n=1e6 — too slow");
    expect(text).toContain("2500ms / 2000ms");
  });

  it("renders load errors", () => {
    const text = strip(
      formatTerminal(
        result({
          fatal: { kind: "load", message: "SyntaxError: expected ':'", trace: "  line 2: def solve(self)" },
          examples: { passed: 0, total: 1, cases: [{ id: 1, status: "skipped", input: [[1], 1], expected: [0], stdout: "" }] },
          hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
          stress: { status: "skipped", cases: [] },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✗ load        could not load solution.py");
    expect(text).toContain("    error     SyntaxError: expected ':'");
    expect(text).toContain("line 2: def solve(self)");
    expect(text).not.toContain("example 1");
  });
});
```

- [ ] **Step 2: Write the failing CLI tests**

`runner/tests/cli.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../src/paths.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const CASES = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [{ input: [[1, 2]], expected: 3 }],
  hidden: [{ input: [[4]], expected: 4 }, { input: [[-1, 1]], expected: 123456789 }],
};
const PY = "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n";
const TS = "export default function solve(nums: number[]): number {\n  return nums.reduce((a, b) => a + b, 0);\n}\n";

makeProblem(root, "lc-0001-sum", { ...CASES, hidden: [{ input: [[4]], expected: 4 }] }, { "solution.py": PY, "solution.ts": TS });
makeProblem(root, "lc-0002-sum-leak", CASES, { "solution.py": PY });
makeProblem(root, "lc-0003-empty", { ...CASES, hidden: [] });
write(root, "problems/lc-0004-broken/README.md", "---\ntitle: Broken\n---\n");
write(root, "problems/lc-0004-broken/cases.json", "{ not json");

function cli(...args: string[]) {
  return spawnSync(TSX_BIN, ["runner/src/cli.ts", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ALGO_ROOT: root },
    encoding: "utf8",
  });
}

describe("pnpm test", () => {
  it("prints JSON for one language and exits 0 when green", () => {
    const run = cli("test", "lc-0001", "--json");
    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout);
    expect(parsed).toMatchObject({ id: "lc-0001", lang: "py", green: true });
  });

  it("prints an array for --lang all with every language that has a solution", () => {
    const run = cli("test", "lc-0001", "--lang", "all", "--json");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout).map((r: { lang: string }) => r.lang)).toEqual(["py", "ts"]);
  });

  it("exits 1 when not green and never prints hidden expected values", () => {
    const json = cli("test", "lc-0002", "--json");
    expect(json.status).toBe(1);
    expect(json.stdout).not.toContain("123456789");
    const terminal = cli("test", "lc-0002");
    expect(terminal.status).toBe(1);
    expect(terminal.stdout).not.toContain("123456789");
    expect(terminal.stdout).toContain("1/2 passed");
  });

  it("lists candidates for ambiguous queries", () => {
    const run = cli("test", "sum");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"sum" matches 2');
    expect(run.stderr).toContain("lc-0001");
    expect(run.stderr).toContain("lc-0002");
  });

  it("explains --lang all without solutions", () => {
    const run = cli("test", "lc-0003", "--lang", "all");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("has no solution files yet");
  });

  it("exits 2 on case-file errors", () => {
    const run = cli("test", "lc-0004");
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("Case file error");
    expect(run.stderr).toContain("invalid JSON");
  });

  it("rejects unknown flags with the usage text", () => {
    const run = cli("test", "lc-0001", "--nope");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Usage:");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/reporter.test.ts runner/tests/cli.test.ts`
Expected: FAIL — `../src/reporter.ts` cannot be loaded, and the CLI exits with "Cannot find module".

- [ ] **Step 4: Implement `runner/src/reporter.ts`**

```ts
import path from "node:path";
import { styleText } from "node:util";
import type { ExampleResult, HarnessError, RunResult, StressCaseResult } from "./types.ts";

type Paint = (text: string) => string;

const WIDTH = 77;
const MAX_VALUE = 100;
const green: Paint = (text) => styleText("green", text);
const red: Paint = (text) => styleText("red", text);
const dim: Paint = (text) => styleText("gray", text);

function truncate(text: string, max = MAX_VALUE): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Positional arguments as the user would write them: `[2,7,11,15], 9`. */
export function formatInput(input: unknown): string {
  const text = Array.isArray(input) ? input.map((arg) => JSON.stringify(arg)).join(", ") : JSON.stringify(input);
  return truncate(text ?? "undefined");
}

export function formatOutput(output: unknown): string {
  if (output && typeof output === "object" && !Array.isArray(output) && "param" in output) {
    const { ret, param } = output as { ret: unknown; param: unknown };
    return truncate(`returned ${JSON.stringify(ret)}, array is now ${JSON.stringify(param)}`);
  }
  return truncate(JSON.stringify(output) ?? "undefined");
}

function ms(value: number | undefined): string {
  if (value === undefined) return "";
  return `${value < 1 ? value.toFixed(2) : Math.round(value)}ms`;
}

/** "✓ label       text ............ right" with the mark colored and the right part dimmed. */
function row(mark: string, paint: Paint, label: string, text: string, right = ""): string {
  const body = `${label.padEnd(11)} ${text}`;
  const plainLength = 2 + body.length;
  const gap = right ? " ".repeat(Math.max(2, WIDTH - plainLength - right.length)) : "";
  return `${paint(mark)} ${body}${gap}${right ? dim(right) : ""}`;
}

function detail(label: string, text: string): string {
  return `    ${label.padEnd(9)} ${text}`;
}

function stdoutLines(stdout: string): string[] {
  if (!stdout) return [];
  return stdout
    .replace(/\n$/, "")
    .split("\n")
    .map((line, i) => (i === 0 ? detail("stdout", `> ${line}`) : `              > ${line}`));
}

function errorLines(error: HarnessError): string[] {
  const lines = [detail(error.kind === "timeout" ? "timeout" : "error", error.message)];
  if (error.trace) lines.push(...error.trace.split("\n").map((line) => `      ${line.trim()}`));
  return lines;
}

function exampleLines(c: ExampleResult): string[] {
  const label = `example ${c.id}`;
  switch (c.status) {
    case "pass":
      return [row("✓", green, label, `${formatInput(c.input)} → ${formatOutput(c.output)}`, ms(c.ms)), ...stdoutLines(c.stdout)];
    case "fail":
      return [
        row("✗", red, label, formatInput(c.input)),
        detail("expected", truncate(JSON.stringify(c.expected) ?? "undefined")),
        detail("got", formatOutput(c.output)),
        ...stdoutLines(c.stdout),
      ];
    case "error":
    case "timeout":
      return [row("✗", red, label, formatInput(c.input)), ...(c.error ? errorLines(c.error) : []), ...stdoutLines(c.stdout)];
    case "skipped":
      return [row("–", dim, label, "skipped")];
  }
}

function hiddenLines(r: RunResult): string[] {
  const h = r.hidden;
  if (h.status === "skipped") return [row("–", dim, "hidden", r.fatal ? "skipped" : "skipped (fix examples first)")];
  if (h.status === "pass") return [row("✓", green, "hidden", `${h.passed}/${h.total} passed`)];
  const lines = [row("✗", red, "hidden", `${h.passed}/${h.total} passed`)];
  const failure = h.firstFailure;
  if (failure) {
    lines.push(detail("input", formatInput(failure.input)));
    if (failure.error) lines.push(...errorLines(failure.error));
    else lines.push(detail("got", formatOutput(failure.output)));
    lines.push(...stdoutLines(failure.stdout));
  }
  return lines;
}

function stressRow(c: StressCaseResult): string[] {
  const timing = `${ms(c.ms) || "—"} / ${c.limitMs}ms`;
  switch (c.status) {
    case "pass":
      return [row("✓", green, "stress", c.name, timing)];
    case "slow":
      return [row("✗", red, "stress", `${c.name} — too slow`, timing)];
    case "timeout":
      return [row("✗", red, "stress", `${c.name} — timeout`, `> ${c.limitMs}ms`)];
    case "error":
      return [row("✗", red, "stress", c.name), ...(c.error ? errorLines(c.error) : [])];
    case "skipped":
      return [row("–", dim, "stress", `${c.name} — skipped`)];
  }
}

function stressLines(r: RunResult): string[] {
  const s = r.stress;
  if (s.status === "none") return [row("·", dim, "stress", "no stress cases")];
  if (s.status === "skipped") {
    const examplesPassed = !r.fatal && r.examples.passed === r.examples.total;
    return [row("–", dim, "stress", examplesPassed && r.hidden.status === "fail" ? "skipped (fix hidden cases first)" : "skipped")];
  }
  return s.cases.flatMap(stressRow);
}

function summary(r: RunResult): string {
  if (r.fatal) return red("could not load the solution");
  const parts = [`${r.examples.passed}/${r.examples.total} examples`];
  if (r.hidden.status !== "skipped") parts.push(`${r.hidden.passed}/${r.hidden.total} hidden`);
  if (r.stress.status === "pass" || r.stress.status === "fail") parts.push(`stress ${r.stress.status === "pass" ? "ok" : "failed"}`);
  return `${parts.join(" · ")}${r.green ? ` · ${green("GREEN ✓")}` : ""}`;
}

export function formatTerminal(r: RunResult): string {
  const header = `${r.id} · ${r.title} · ${r.lang}`;
  const rule = dim("─".repeat(WIDTH));
  const lines = [`${header}${" ".repeat(Math.max(2, WIDTH - header.length - r.readme.length))}${dim(r.readme)}`, rule];
  if (r.fatal) {
    lines.push(row("✗", red, "load", `could not load ${path.basename(r.solution)}`), ...errorLines(r.fatal));
  } else {
    lines.push(...r.examples.cases.flatMap(exampleLines));
  }
  lines.push(...hiddenLines(r), ...stressLines(r), rule, summary(r));
  return lines.join("\n");
}
```

- [ ] **Step 5: Implement `runner/src/cli.ts`**

```ts
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { contentRoot } from "./paths.ts";
import { formatTerminal } from "./reporter.ts";
import { listTargets, QueryError, resolveQuery } from "./resolver.ts";
import { runTarget } from "./run.ts";
import { CaseFileError } from "./schema.ts";
import { solutionPath } from "./stubs.ts";
import { LANGS, type Lang, type RunResult, type Target } from "./types.ts";

const USAGE = `Usage:
  pnpm watch <query> [--lang py|ts] [--open]
  pnpm test <query> [--lang py|ts|all] [--json]
  pnpm fill-expected <query> --ref <path outside the repo>

<query>: an id (lc-0001, greedy/01), a LeetCode number (1), or part of a folder name (two-sum).`;

class UsageError extends Error {}

function parseLang(value: string | undefined, allowAll: boolean): Lang | "all" {
  const lang = value ?? "py";
  if (lang === "py" || lang === "ts" || (allowAll && lang === "all")) return lang;
  throw new UsageError(`--lang must be py, ts${allowAll ? " or all" : ""} (got "${lang}")`);
}

async function testCommand(target: Target, lang: Lang | "all", json: boolean, root: string): Promise<number> {
  const langs = lang === "all" ? LANGS.filter((l) => existsSync(solutionPath(target.dir, l))) : [lang];
  if (langs.length === 0) {
    throw new UsageError(`${target.id} has no solution files yet. Start with: pnpm watch ${target.id} --open`);
  }
  const results: RunResult[] = [];
  for (const l of langs) results.push(await runTarget(target, l, { root }));
  if (json) process.stdout.write(`${JSON.stringify(lang === "all" ? results : results[0], null, 2)}\n`);
  else process.stdout.write(`${results.map(formatTerminal).join("\n\n")}\n`);
  return results.every((r) => r.green) ? 0 : 1;
}

function parseFlags(args: string[]) {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        lang: { type: "string" },
        open: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        ref: { type: "string" },
      },
    });
  } catch (error) {
    throw new UsageError(`${(error as Error).message}\n\n${USAGE}`);
  }
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { values, positionals } = parseFlags(rest);
  if (command !== "test") throw new UsageError(USAGE);
  const root = contentRoot();
  const target = resolveQuery(listTargets(root), positionals.join(" "));
  return testCommand(target, parseLang(values.lang, true), values.json, root);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    if (error instanceof QueryError) {
      const list = error.candidates.map((t) => `  ${t.id.padEnd(16)} ${t.title}`).join("\n");
      process.stderr.write(`${error.message}\n${list}${list ? "\n" : ""}`);
      process.exitCode = 1;
    } else if (error instanceof CaseFileError) {
      process.stderr.write(`Case file error (not your code — fix the problem files):\n${error.message}\n`);
      process.exitCode = 2;
    } else if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
      process.exitCode = 1;
    }
  },
);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/reporter.test.ts runner/tests/cli.test.ts`
Expected: PASS (6 + 7 tests).

- [ ] **Step 7: Commit**

```bash
git add runner/src/reporter.ts runner/src/cli.ts runner/tests/reporter.test.ts runner/tests/cli.test.ts
git commit -m "feat(runner): add terminal reporter and test command"
```

---

### Task 10: Watch mode and `--open`

**Files:**
- Create: `runner/src/watcher.ts`
- Modify: `runner/src/cli.ts` (add the `watch` command)
- Test: `runner/tests/watcher.test.ts`

**Interfaces:**
- Consumes: `runTarget` (Task 8), `formatTerminal` (Task 9), `CaseFileError`/`loadCaseFile` (Task 1), `ensureSolution` (Task 7).
- Produces:
  - `interface Watcher { close(): void }`.
  - `watchFiles(dir: string, names: readonly string[], onChange: () => void, debounceMs?: number): Watcher` (default debounce 100 ms; reacts to writes **and** renames onto a watched name).
  - `renderRun(target: Target, lang: Lang, root: string): Promise<string>`: terminal text; a case-file error becomes text instead of a throw.
  - `openInEditor(file: string): void`.
  - `watchTarget(target: Target, lang: Lang, options: { open: boolean; root: string }): Promise<Watcher>`.
  - CLI: `pnpm watch <query> [--lang py|ts] [--open]`.

- [ ] **Step 1: Write the failing tests**

`runner/tests/watcher.test.ts`:

```ts
import { renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { renderRun, watchFiles } from "../src/watcher.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("watchFiles", () => {
  it("debounces bursts of writes into one call", async () => {
    const dir = path.join(root, "burst");
    write(dir, "solution.py", "a");
    await sleep(150); // let the creation event settle before watching
    let calls = 0;
    const watcher = watchFiles(dir, ["solution.py"], () => calls++, 100);
    writeFileSync(path.join(dir, "solution.py"), "b");
    writeFileSync(path.join(dir, "solution.py"), "c");
    await sleep(400);
    watcher.close();
    expect(calls).toBe(1);
  });

  it("reacts to atomic saves (temp file renamed onto the solution)", async () => {
    const dir = path.join(root, "atomic");
    write(dir, "solution.py", "a");
    await sleep(150); // let the creation event settle before watching
    let calls = 0;
    const watcher = watchFiles(dir, ["solution.py"], () => calls++, 50);
    writeFileSync(path.join(dir, ".solution.py.swp"), "b");
    renameSync(path.join(dir, ".solution.py.swp"), path.join(dir, "solution.py"));
    await sleep(300);
    watcher.close();
    expect(calls).toBe(1);
  });

  it("ignores files it does not watch", async () => {
    const dir = path.join(root, "ignore");
    write(dir, "solution.py", "a");
    await sleep(150); // let the creation event settle before watching
    let calls = 0;
    const watcher = watchFiles(dir, ["solution.py"], () => calls++, 50);
    writeFileSync(path.join(dir, "notes.txt"), "x");
    await sleep(300);
    watcher.close();
    expect(calls).toBe(0);
  });
});

describe("renderRun", () => {
  it("renders a normal run", async () => {
    const target = makeProblem(
      root,
      "lc-0001-render",
      {
        entry: "solve",
        params: [{ name: "n", type: "int" }],
        returns: "int",
        examples: [{ input: [2], expected: 4 }],
        hidden: [],
      },
      { "solution.py": "class Solution:\n    def solve(self, n: int) -> int:\n        return n * 2\n" },
    );
    const text = await renderRun(target, "py", root);
    expect(text).toContain("example 1");
    expect(text).toContain("GREEN");
  });

  it("shows case-file errors as text so watch keeps going", async () => {
    const target = makeProblem(root, "lc-0002-broken", {});
    write(target.dir, "cases.json", "{ oops");
    const text = await renderRun(target, "py", root);
    expect(text).toContain("Case file error");
    expect(text).toContain("invalid JSON");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/watcher.test.ts`
Expected: FAIL — `../src/watcher.ts` cannot be loaded.

- [ ] **Step 3: Implement `runner/src/watcher.ts`**

```ts
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { formatTerminal } from "./reporter.ts";
import { runTarget } from "./run.ts";
import { CaseFileError, loadCaseFile } from "./schema.ts";
import { ensureSolution } from "./stubs.ts";
import type { Lang, Target } from "./types.ts";

export interface Watcher {
  close(): void;
}

/** Calls onChange (debounced) when one of `names` inside `dir` is written or replaced by a rename. */
export function watchFiles(
  dir: string,
  names: readonly string[],
  onChange: () => void,
  debounceMs = 100,
): Watcher {
  let timer: NodeJS.Timeout | null = null;
  const watcher = watch(dir, (_event, filename) => {
    if (!filename || !names.includes(path.basename(filename.toString()))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  });
  return {
    close: () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}

/** One run as terminal text. Case-file problems are shown, not thrown, so watch keeps going. */
export async function renderRun(target: Target, lang: Lang, root: string): Promise<string> {
  try {
    return formatTerminal(await runTarget(target, lang, { root }));
  } catch (error) {
    if (error instanceof CaseFileError) {
      return `Case file error (not your code — fix the problem files):\n${error.message}`;
    }
    throw error;
  }
}

export function openInEditor(file: string): void {
  const child = spawn("code", [file], { stdio: "ignore", detached: true });
  child.on("error", () => {
    process.stderr.write(`warning: "code" is not on your PATH — open ${file} yourself.\n`);
  });
  child.unref();
}

export async function watchTarget(
  target: Target,
  lang: Lang,
  options: { open: boolean; root: string },
): Promise<Watcher> {
  const solution = ensureSolution(target.dir, loadCaseFile(target.dir), lang).path;
  if (options.open) openInEditor(solution);
  let running = false;
  let again = false;
  const cycle = async (): Promise<void> => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    do {
      again = false;
      const text = await renderRun(target, lang, options.root).catch(
        (error: unknown) => `Runner error: ${(error as Error).message}`,
      );
      process.stdout.write(
        `\x1b[2J\x1b[H${text}\n\nwatching ${path.relative(options.root, solution)} … (Ctrl+C to stop)\n`,
      );
    } while (again);
    running = false;
  };
  await cycle();
  return watchFiles(target.dir, [path.basename(solution), "cases.json", "stress.ts"], () => void cycle());
}
```

- [ ] **Step 4: Wire `watch` into `runner/src/cli.ts`**

Add the import next to the others:

```ts
import { watchTarget } from "./watcher.ts";
```

Replace the command dispatch in `main` (from `if (command !== "test") throw new UsageError(USAGE);` to the final `return testCommand(...)`) with:

```ts
  if (command !== "test" && command !== "watch") throw new UsageError(USAGE);
  const root = contentRoot();
  const target = resolveQuery(listTargets(root), positionals.join(" "));
  if (command === "watch") {
    await watchTarget(target, parseLang(values.lang, false) as Lang, { open: values.open, root });
    return 0;
  }
  return testCommand(target, parseLang(values.lang, true), values.json, root);
```

The watcher keeps the process alive; Ctrl+C stops it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run runner/tests/watcher.test.ts runner/tests/cli.test.ts`
Expected: PASS (5 + 7 tests).

- [ ] **Step 6: Smoke-test watch mode by hand**

```bash
mkdir -p runner/tests/.tmp/smoke/problems/lc-0001-double
printf -- '---\ntitle: Double\n---\n# Double\n' > runner/tests/.tmp/smoke/problems/lc-0001-double/README.md
printf '{"entry":"solve","params":[{"name":"n","type":"int"}],"returns":"int","examples":[{"input":[2],"expected":4}],"hidden":[]}\n' > runner/tests/.tmp/smoke/problems/lc-0001-double/cases.json
( ALGO_ROOT=runner/tests/.tmp/smoke pnpm watch double & PID=$!; sleep 4; printf 'class Solution:\n    def solve(self, n: int) -> int:\n        return n * 2\n' > runner/tests/.tmp/smoke/problems/lc-0001-double/solution.py; sleep 3; kill $PID )
rm -rf runner/tests/.tmp/smoke
```

Expected: first a screen with `✗ example 1 … error NotImplementedError` (the stub was created). After the file is written, the screen clears and shows `✓ example 1   2 → 4 … GREEN ✓` with `watching problems/lc-0001-double/solution.py …`.

- [ ] **Step 7: Commit**

```bash
git add runner/src/watcher.ts runner/src/cli.ts runner/tests/watcher.test.ts
git commit -m "feat(runner): add watch mode with --open"
```

---

### Task 11: `fill-expected`

**Files:**
- Create: `runner/src/fill-expected.ts`
- Modify: `runner/src/cli.ts` (add the `fill-expected` command)
- Test: `runner/tests/fill-expected.test.ts`

**Interfaces:**
- Consumes: `runHarness` (Task 2), `judgedValue`/`matches` (Task 4), `loadRawCaseFile`/`parseCaseFile`/`formatCasesJson` (Task 1), `TSX_BIN`/`REPO_ROOT` (Task 1).
- Produces:
  - `FILL_WALL_MS = 10_000`.
  - `class FillError extends Error`.
  - `fillExpected(target: Target, refPath: string, root: string): Promise<{ filled: number; warnings: string[] }>`:
    - Refuses a reference inside `root`.
    - Refuses when the reference disagrees with any example, and writes nothing in that case.
    - Fills only missing hidden `expected` values and verifies existing ones.
    - In-place problems get the judged prefix; `any-of` problems get `[value]` plus a warning.
  - CLI: `pnpm fill-expected <query> --ref <path>` prints `Filled N hidden expected value(s) in <path>.`

- [ ] **Step 1: Write the failing tests**

`runner/tests/fill-expected.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FillError, fillExpected } from "../src/fill-expected.ts";
import { REPO_ROOT, TSX_BIN } from "../src/paths.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
const refs = tempDir();
afterAll(() => {
  removeTemp(root);
  removeTemp(refs);
});

const CASES = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [{ input: [[1, 2]], expected: 3 }],
  hidden: [{ input: [[4, 4]] }, { input: [[]], expected: 0 }],
};
const SUM_REF = write(refs, "sum/ref.py", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n");
const WRONG_REF = write(refs, "wrong/ref.py", "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return len(nums)\n");

const casesOf = (dir: string) => JSON.parse(readFileSync(path.join(dir, "cases.json"), "utf8"));

describe("fillExpected", () => {
  it("fills missing hidden values, keeps existing ones, and formats the file", async () => {
    const target = makeProblem(root, "lc-0001-fill", CASES);
    const result = await fillExpected(target, SUM_REF, root);
    expect(result).toEqual({ filled: 1, warnings: [] });
    expect(casesOf(target.dir).hidden).toEqual([{ input: [[4, 4]], expected: 8 }, { input: [[]], expected: 0 }]);
    expect(readFileSync(path.join(target.dir, "cases.json"), "utf8")).toContain('    {"input":[[4,4]],"expected":8},');
  });

  it("refuses a reference that lives inside the repo", async () => {
    const target = makeProblem(root, "lc-0002-inside", CASES);
    const inside = write(root, "ref.py", "class Solution:\n    def solve(self, nums):\n        return sum(nums)\n");
    await expect(fillExpected(target, inside, root)).rejects.toThrow(/outside the repo/);
  });

  it("refuses a reference that disagrees with an example and writes nothing", async () => {
    const target = makeProblem(root, "lc-0003-disagree", CASES);
    const before = readFileSync(path.join(target.dir, "cases.json"), "utf8");
    await expect(fillExpected(target, WRONG_REF, root)).rejects.toThrow(/disagrees with examples\[0\]/);
    expect(readFileSync(path.join(target.dir, "cases.json"), "utf8")).toBe(before);
  });

  it("stores the judged prefix for in-place problems", async () => {
    const target = makeProblem(root, "lc-0004-inplace", {
      entry: "solve",
      params: [{ name: "nums", type: "int[]" }],
      returns: "int",
      inPlace: { param: "nums", prefix: "return" },
      examples: [{ input: [[1, 1, 2]], expected: [1, 2] }],
      hidden: [{ input: [[3, 3, 3, 4]] }],
    });
    const ref = write(
      refs,
      "dedupe/ref.py",
      [
        "class Solution:",
        "    def solve(self, nums: list[int]) -> int:",
        "        k = 0",
        "        for n in nums:",
        "            if k == 0 or nums[k - 1] != n:",
        "                nums[k] = n",
        "                k += 1",
        "        return k",
        "",
      ].join("\n"),
    );
    await fillExpected(target, ref, root);
    expect(casesOf(target.dir).hidden[0].expected).toEqual([3, 4]);
  });

  it("wraps any-of answers and warns", async () => {
    const target = makeProblem(root, "lc-0005-anyof", {
      ...CASES,
      compare: "any-of",
      examples: [{ input: [[1, 2]], expected: [3] }],
      hidden: [{ input: [[5]] }],
    });
    const result = await fillExpected(target, SUM_REF, root);
    expect(casesOf(target.dir).hidden[0].expected).toEqual([5]);
    expect(result.warnings[0]).toMatch(/any-of/);
  });

  it("is available from the CLI", () => {
    makeProblem(root, "lc-0006-cli", CASES);
    const run = spawnSync(TSX_BIN, ["runner/src/cli.ts", "fill-expected", "lc-0006", "--ref", SUM_REF], {
      cwd: REPO_ROOT,
      env: { ...process.env, ALGO_ROOT: root },
      encoding: "utf8",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Filled 1 hidden expected value(s) in problems/lc-0006-cli/cases.json.");
  });

  it("uses a FillError for reference problems", async () => {
    const target = makeProblem(root, "lc-0007-ext", CASES);
    const bad = write(refs, "ref.rb", "puts 1\n");
    await expect(fillExpected(target, bad, root)).rejects.toBeInstanceOf(FillError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run runner/tests/fill-expected.test.ts`
Expected: FAIL — `../src/fill-expected.ts` cannot be loaded.

- [ ] **Step 3: Implement `runner/src/fill-expected.ts`**

```ts
import { writeFileSync } from "node:fs";
import path from "node:path";
import { judgedValue, matches } from "./compare.ts";
import { runHarness } from "./executor.ts";
import { formatCasesJson, loadRawCaseFile, parseCaseFile } from "./schema.ts";
import type { Lang, Target } from "./types.ts";

export const FILL_WALL_MS = 10_000;

export class FillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FillError";
  }
}

function langOf(refPath: string): Lang {
  const ext = path.extname(refPath);
  if (ext === ".py") return "py";
  if (ext === ".ts") return "ts";
  throw new FillError(`the reference must be a .py or .ts file (got "${ext || "no extension"}")`);
}

/** Runs a reference solution (outside the repo) and writes the missing hidden expected values. */
export async function fillExpected(
  target: Target,
  refPath: string,
  root: string,
): Promise<{ filled: number; warnings: string[] }> {
  const relative = path.relative(root, refPath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new FillError(`the reference solution must live outside the repo (got ${refPath})`);
  }
  const lang = langOf(refPath);
  const raw = loadRawCaseFile(target.dir);
  const cf = parseCaseFile(raw);

  const outcome = await runHarness(
    lang,
    {
      solutionPath: refPath,
      mode: cf.mode,
      entry: cf.entry,
      params: cf.params,
      returns: cf.returns,
      inPlace: cf.inPlace,
      discardOutput: false,
      cases: [
        ...cf.examples.map((entry, i) => ({ id: `e${i + 1}`, input: entry.input })),
        ...cf.hidden.map((entry, i) => ({ id: `h${i + 1}`, input: entry.input })),
      ],
    },
    { wallLimitMs: FILL_WALL_MS },
  );
  if (outcome.fatal) throw new FillError(`the reference failed to load: ${outcome.fatal.message}`);

  cf.examples.forEach((entry, i) => {
    const run = outcome.runs.get(`e${i + 1}`);
    if (!run?.ok) {
      throw new FillError(`the reference failed on examples[${i}]: ${run?.error?.message ?? "no result (timeout?)"}`);
    }
    if (!matches(cf, entry.expected, run.output)) {
      throw new FillError(
        `the reference disagrees with examples[${i}]: expected ${JSON.stringify(entry.expected)}, got ${JSON.stringify(run.output)}. The example is the truth — fix the reference.`,
      );
    }
  });

  const hiddenRaw = raw.hidden as Record<string, unknown>[];
  let filled = 0;
  cf.hidden.forEach((entry, i) => {
    const run = outcome.runs.get(`h${i + 1}`);
    if (!run?.ok) {
      throw new FillError(`the reference failed on hidden[${i}]: ${run?.error?.message ?? "no result (timeout?)"}`);
    }
    const judged = judgedValue(cf, run.output);
    if (!judged) throw new FillError(`the reference returned a malformed in-place result on hidden[${i}]`);
    if (entry.expected === undefined) {
      hiddenRaw[i].expected = cf.compare === "any-of" ? [judged.value] : judged.value;
      filled++;
    } else if (!matches(cf, entry.expected, run.output)) {
      throw new FillError(
        `hidden[${i}] already expects ${JSON.stringify(entry.expected)} but the reference returned ${JSON.stringify(judged.value)}`,
      );
    }
  });

  const warnings =
    cf.compare === "any-of" && filled > 0
      ? ["compare is any-of: only the reference's answer was recorded for each filled hidden case — add other valid answers by hand if needed."]
      : [];
  writeFileSync(path.join(target.dir, "cases.json"), formatCasesJson(raw));
  return { filled, warnings };
}
```

- [ ] **Step 4: Wire `fill-expected` into `runner/src/cli.ts`**

Add the imports:

```ts
import path from "node:path";
import { FillError, fillExpected } from "./fill-expected.ts";
```

Replace the dispatch block from Task 10 with:

```ts
  if (command !== "test" && command !== "watch" && command !== "fill-expected") throw new UsageError(USAGE);
  const root = contentRoot();
  const target = resolveQuery(listTargets(root), positionals.join(" "));
  if (command === "watch") {
    await watchTarget(target, parseLang(values.lang, false) as Lang, { open: values.open, root });
    return 0;
  }
  if (command === "fill-expected") {
    if (!values.ref) throw new UsageError("fill-expected needs --ref <path to a reference solution outside the repo>");
    const result = await fillExpected(target, path.resolve(values.ref), root);
    const file = path.relative(root, path.join(target.dir, "cases.json")).split(path.sep).join("/");
    process.stdout.write(`Filled ${result.filled} hidden expected value(s) in ${file}.\n`);
    for (const warning of result.warnings) process.stdout.write(`warning: ${warning}\n`);
    return 0;
  }
  return testCommand(target, parseLang(values.lang, true), values.json, root);
```

In the error handler, add a branch before the final `else`:

```ts
    } else if (error instanceof FillError) {
      process.stderr.write(`fill-expected: ${error.message}\n`);
      process.exitCode = 1;
```

- [ ] **Step 5: Run the whole runner suite**

Run: `pnpm exec vitest run runner/tests`
Expected: PASS (every runner test, including the 7 new ones).

- [ ] **Step 6: Commit**

```bash
git add runner/src/fill-expected.ts runner/src/cli.ts runner/tests/fill-expected.test.ts
git commit -m "feat(runner): add fill-expected from an out-of-repo reference"
```

---
### Task 12: `pnpm sync` (indexes, backlinks, auto sections)

**Files:**
- Create: `scripts/lib/auto.ts`, `scripts/lib/render.ts`, `scripts/lib/sync.ts`, `scripts/sync.ts`
- Create: `scripts/tests/fixture.ts`
- Test: `scripts/tests/sync.test.ts`

**Interfaces:**
- Consumes (Task 6): `scanRepo`, `str`, `strList`, `RepoModel`, `ProblemEntry`, `ExerciseEntry`, `ConceptEntry`. (Task 1): `contentRoot`, `TSX_BIN`, `REPO_ROOT`.
- Produces:
  - `scripts/lib/auto.ts`: `replaceAuto(body: string, name: string, content: string): string | null`. Returns `null` when the `<!-- auto:<name> -->` … `<!-- /auto -->` markers are missing.
  - `scripts/lib/render.ts`:
    - `STATUS_MARK`, `GENERATED_NOTE`.
    - `conceptBySlug(repo): Map<string, ConceptEntry>`.
    - `learningPath(concepts: ConceptEntry[]): string[]`.
    - `missingConcepts(repo): Map<string, string[]>` (slug → ids/slugs that reference it).
    - `renderProblemIndex(repo): string`, `renderConceptIndex(repo): string`.
    - `renderProblemConcepts(problem, bySlug): string`, `renderConceptExercises(concept, repo): string`, `renderConceptProblems(concept, repo): string`.
  - `scripts/lib/sync.ts`: `sync(root: string): string[]`. Returns the relative paths it changed; idempotent.
  - `scripts/sync.ts`: CLI that prints `Updated:` + paths, or `Everything is in sync.`
  - `scripts/tests/fixture.ts`: `put(root, rel, content)`, `CASES_JSON`, `problemReadme(fields)`, `conceptReadme(fields)`, `exerciseReadme(fields)`, `makeStudyRepo(): string` (a temp repo with 2 problems, 2 concepts and 1 exercise).

- [ ] **Step 1: Write the shared test fixture**

`scripts/tests/fixture.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function put(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

export const CASES_JSON = JSON.stringify({
  entry: "f",
  params: [{ name: "n", type: "int" }],
  returns: "int",
  examples: [{ input: [1], expected: 1 }],
  hidden: [{ input: [2], expected: 2 }],
});

export function problemReadme(fields: {
  id: string;
  title: string;
  slug: string;
  patterns: string[];
  concepts: string[];
  status: string;
  solvedIn: string[];
}): string {
  return [
    "---",
    `id: ${fields.id}`,
    `title: ${fields.title}`,
    "source: leetcode",
    `url: https://leetcode.com/problems/${fields.slug}/`,
    "difficulty: easy",
    `patterns: [${fields.patterns.join(", ")}]`,
    `concepts: [${fields.concepts.join(", ")}]`,
    `status: ${fields.status}`,
    "hints: 0",
    "solution_revealed: false",
    `solved_in: [${fields.solvedIn.join(", ")}]`,
    "complexity: null",
    "---",
    `# ${fields.title}`,
    "",
    "## Statement",
    "",
    "Short paraphrase.",
    "",
    "## Concepts",
    "",
    "<!-- auto:concepts -->",
    "<!-- /auto -->",
    "",
    "## Log",
    "",
  ].join("\n");
}

export function conceptReadme(fields: {
  slug: string;
  title: string;
  status: string;
  requires: string[];
  explanation?: string;
}): string {
  return [
    "---",
    `slug: ${fields.slug}`,
    `title: ${fields.title}`,
    `status: ${fields.status}`,
    `requires: [${fields.requires.join(", ")}]`,
    "related: []",
    "---",
    `# ${fields.title}`,
    "",
    "## Intuition",
    "",
    "An analogy.",
    "",
    "## Exercises",
    "",
    "<!-- auto:exercises -->",
    "<!-- /auto -->",
    "",
    "## My explanation",
    "",
    "<!-- USER: in your own words -->",
    ...(fields.explanation ? [fields.explanation] : []),
    "",
    "## Problems",
    "",
    "<!-- auto:problems -->",
    "<!-- /auto -->",
    "",
  ].join("\n");
}

export function exerciseReadme(fields: { id: string; title: string; concept: string; status: string; solvedIn: string[] }): string {
  return [
    "---",
    `id: ${fields.id}`,
    `title: ${fields.title}`,
    `concept: ${fields.concept}`,
    `status: ${fields.status}`,
    "hints: 0",
    "solution_revealed: false",
    `solved_in: [${fields.solvedIn.join(", ")}]`,
    "---",
    `# ${fields.title}`,
    "",
    "## Statement",
    "",
    "Short.",
    "",
    "## Log",
    "",
  ].join("\n");
}

/** A small, valid study repo in the OS temp dir. */
export function makeStudyRepo(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "algo-repo-"));
  put(
    root,
    "problems/lc-0001-two-sum/README.md",
    problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved", solvedIn: ["py"] }),
  );
  put(root, "problems/lc-0001-two-sum/cases.json", CASES_JSON);
  put(
    root,
    "problems/lc-0020-valid-parentheses/README.md",
    problemReadme({ id: "lc-0020", title: "Valid Parentheses", slug: "valid-parentheses", patterns: ["stack"], concepts: ["stack"], status: "solving", solvedIn: [] }),
  );
  put(root, "problems/lc-0020-valid-parentheses/cases.json", CASES_JSON);
  put(root, "concepts/arrays/README.md", conceptReadme({ slug: "arrays", title: "Arrays", status: "mastered", requires: [], explanation: "Contiguous memory with O(1) indexing." }));
  put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", status: "learning", requires: ["arrays"] }));
  put(
    root,
    "concepts/hash-map/exercises/01-first-repeat/README.md",
    exerciseReadme({ id: "hash-map/01", title: "First repeat", concept: "hash-map", status: "solved", solvedIn: ["py"] }),
  );
  put(root, "concepts/hash-map/exercises/01-first-repeat/cases.json", CASES_JSON);
  return root;
}
```

- [ ] **Step 2: Write the failing sync tests**

`scripts/tests/sync.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../runner/src/paths.ts";
import { sync } from "../lib/sync.ts";
import { makeStudyRepo, put } from "./fixture.ts";

const read = (root: string, rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("sync", () => {
  it("writes the problem index grouped by pattern", () => {
    const root = makeStudyRepo();
    sync(root);
    expect(read(root, "INDEX.md")).toBe(
      [
        "# Problems",
        "",
        "<!-- Generated by `pnpm sync`. Do not edit by hand. -->",
        "",
        "Status: ✓ solved · … solving · ↺ revealed · ○ todo",
        "",
        "## arrays-hashing (1/1)",
        "",
        "- ✓ [lc-0001 · Two Sum](problems/lc-0001-two-sum/README.md) · easy",
        "",
        "## stack (0/1)",
        "",
        "- … [lc-0020 · Valid Parentheses](problems/lc-0020-valid-parentheses/README.md) · easy",
        "",
      ].join("\n"),
    );
  });

  it("writes the concept index with a learning path and missing concepts", () => {
    const root = makeStudyRepo();
    sync(root);
    expect(read(root, "concepts/INDEX.md")).toBe(
      [
        "# Concepts",
        "",
        "<!-- Generated by `pnpm sync`. Do not edit by hand. -->",
        "",
        "## Learning path",
        "",
        "1. [Arrays](arrays/README.md) · mastered",
        "2. [Hash map](hash-map/README.md) · learning — requires: arrays",
        "",
        "## By status",
        "",
        "### mastered (1)",
        "",
        "- [Arrays](arrays/README.md)",
        "",
        "### learning (1)",
        "",
        "- [Hash map](hash-map/README.md)",
        "",
        "### new (0)",
        "",
        "## Missing",
        "",
        "- stack — referenced by lc-0020",
        "",
      ].join("\n"),
    );
  });

  it("fills the auto sections of problems and concepts", () => {
    const root = makeStudyRepo();
    sync(root);
    expect(read(root, "problems/lc-0001-two-sum/README.md")).toContain(
      "<!-- auto:concepts -->\n- [Hash map](../../concepts/hash-map/README.md) · learning\n<!-- /auto -->",
    );
    expect(read(root, "problems/lc-0020-valid-parentheses/README.md")).toContain(
      "<!-- auto:concepts -->\n- stack (missing)\n<!-- /auto -->",
    );
    const hashMap = read(root, "concepts/hash-map/README.md");
    expect(hashMap).toContain("<!-- auto:exercises -->\n- ✓ [01 · First repeat](exercises/01-first-repeat/README.md)\n<!-- /auto -->");
    expect(hashMap).toContain("<!-- auto:problems -->\n- ✓ [lc-0001 · Two Sum](../../problems/lc-0001-two-sum/README.md)\n<!-- /auto -->");
    const arrays = read(root, "concepts/arrays/README.md");
    expect(arrays).toContain("<!-- auto:exercises -->\n_No exercises yet._\n<!-- /auto -->");
    expect(arrays).toContain("<!-- auto:problems -->\n_No problems yet._\n<!-- /auto -->");
    expect(hashMap.startsWith("---\nslug: hash-map\n")).toBe(true);
  });

  it("is idempotent and reports what changed", () => {
    const root = makeStudyRepo();
    expect(sync(root)).toEqual([
      "problems/lc-0001-two-sum/README.md",
      "problems/lc-0020-valid-parentheses/README.md",
      "concepts/arrays/README.md",
      "concepts/hash-map/README.md",
      "INDEX.md",
      "concepts/INDEX.md",
    ]);
    expect(sync(root)).toEqual([]);
  });

  it("leaves files without markers untouched", () => {
    const root = makeStudyRepo();
    const custom = "---\nid: lc-0001\ntitle: Two Sum\n---\n# no markers here\n";
    put(root, "problems/lc-0001-two-sum/README.md", custom);
    sync(root);
    expect(read(root, "problems/lc-0001-two-sum/README.md")).toBe(custom);
  });

  it("runs from the CLI", () => {
    const root = makeStudyRepo();
    const run = (...args: string[]) =>
      spawnSync(TSX_BIN, ["scripts/sync.ts", ...args], { cwd: REPO_ROOT, env: { ...process.env, ALGO_ROOT: root }, encoding: "utf8" });
    expect(run().stdout).toContain("Updated:\n  problems/lc-0001-two-sum/README.md");
    expect(run().stdout).toContain("Everything is in sync.");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run scripts/tests/sync.test.ts`
Expected: FAIL — `../lib/sync.ts` cannot be loaded.

- [ ] **Step 4: Implement `scripts/lib/auto.ts`**

```ts
/** Replaces the content between `<!-- auto:<name> -->` and the next `<!-- /auto -->`. null if the markers are missing. */
export function replaceAuto(body: string, name: string, content: string): string | null {
  const open = `<!-- auto:${name} -->`;
  const start = body.indexOf(open);
  if (start < 0) return null;
  const end = body.indexOf("<!-- /auto -->", start + open.length);
  if (end < 0) return null;
  return `${body.slice(0, start)}${open}\n${content}\n${body.slice(end)}`;
}
```

- [ ] **Step 5: Implement `scripts/lib/render.ts`**

```ts
import {
  type ConceptEntry,
  type ExerciseEntry,
  type ProblemEntry,
  type RepoModel,
  str,
  strList,
} from "../../lib/repo.ts";

export const STATUS_MARK: Record<string, string> = { solved: "✓", solving: "…", revealed: "↺", todo: "○" };
export const GENERATED_NOTE = "<!-- Generated by `pnpm sync`. Do not edit by hand. -->";

const mark = (status: unknown): string => STATUS_MARK[str(status)] ?? "?";
const titleOf = (entry: ProblemEntry | ExerciseEntry | ConceptEntry): string => str(entry.data.title, entry.folder);

export function conceptBySlug(repo: RepoModel): Map<string, ConceptEntry> {
  return new Map(repo.concepts.map((concept) => [concept.slug, concept]));
}

/** Topological order of `requires` (alphabetical within a level). Cycle members go last. */
export function learningPath(concepts: ConceptEntry[]): string[] {
  const slugs = concepts.map((concept) => concept.slug);
  const known = new Set(slugs);
  const requires = new Map(concepts.map((c) => [c.slug, strList(c.data.requires).filter((r) => known.has(r))]));
  const done = new Set<string>();
  const order: string[] = [];
  while (order.length < slugs.length) {
    const ready = slugs.filter((s) => !done.has(s) && requires.get(s)!.every((r) => done.has(r))).sort();
    if (ready.length === 0) {
      order.push(...slugs.filter((s) => !done.has(s)).sort());
      break;
    }
    for (const slug of ready) {
      done.add(slug);
      order.push(slug);
    }
  }
  return order;
}

/** Concept slugs referenced by problems (concepts) or concepts (requires/related) that do not exist. */
export function missingConcepts(repo: RepoModel): Map<string, string[]> {
  const known = new Set(repo.concepts.map((concept) => concept.slug));
  const missing = new Map<string, string[]>();
  const note = (slug: string, by: string): void => {
    if (known.has(slug)) return;
    const list = missing.get(slug) ?? [];
    if (!list.includes(by)) list.push(by);
    missing.set(slug, list);
  };
  for (const problem of repo.problems) for (const slug of strList(problem.data.concepts)) note(slug, problem.folderId);
  for (const concept of repo.concepts) {
    for (const slug of [...strList(concept.data.requires), ...strList(concept.data.related)]) note(slug, concept.slug);
  }
  return missing;
}

export function renderProblemIndex(repo: RepoModel): string {
  const groups = new Map<string, ProblemEntry[]>();
  for (const problem of repo.problems) {
    const patterns = strList(problem.data.patterns);
    for (const pattern of patterns.length > 0 ? patterns : ["(no pattern yet)"]) {
      groups.set(pattern, [...(groups.get(pattern) ?? []), problem]);
    }
  }
  const lines = ["# Problems", "", GENERATED_NOTE, "", "Status: ✓ solved · … solving · ↺ revealed · ○ todo", ""];
  if (groups.size === 0) lines.push("_No problems yet. Paste one into Claude Code to start._", "");
  for (const pattern of [...groups.keys()].sort()) {
    const items = groups.get(pattern)!;
    const solved = items.filter((p) => p.data.status === "solved").length;
    lines.push(`## ${pattern} (${solved}/${items.length})`, "");
    for (const p of items) {
      lines.push(`- ${mark(p.data.status)} [${p.folderId} · ${titleOf(p)}](problems/${p.folder}/README.md) · ${str(p.data.difficulty, "?")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderConceptIndex(repo: RepoModel): string {
  const bySlug = conceptBySlug(repo);
  const lines = ["# Concepts", "", GENERATED_NOTE, "", "## Learning path", ""];
  const order = learningPath(repo.concepts);
  if (order.length === 0) lines.push("_No concepts yet._");
  order.forEach((slug, i) => {
    const concept = bySlug.get(slug)!;
    const requires = strList(concept.data.requires);
    lines.push(
      `${i + 1}. [${titleOf(concept)}](${slug}/README.md) · ${str(concept.data.status, "?")}${requires.length ? ` — requires: ${requires.join(", ")}` : ""}`,
    );
  });
  lines.push("", "## By status", "");
  for (const status of ["mastered", "learning", "new"]) {
    const items = repo.concepts.filter((concept) => concept.data.status === status);
    lines.push(`### ${status} (${items.length})`, "");
    for (const concept of items) lines.push(`- [${titleOf(concept)}](${concept.slug}/README.md)`);
    if (items.length > 0) lines.push("");
  }
  const missing = missingConcepts(repo);
  lines.push("## Missing", "");
  if (missing.size === 0) lines.push("_None._");
  for (const slug of [...missing.keys()].sort()) lines.push(`- ${slug} — referenced by ${missing.get(slug)!.join(", ")}`);
  lines.push("");
  return lines.join("\n");
}

export function renderProblemConcepts(problem: ProblemEntry, bySlug: Map<string, ConceptEntry>): string {
  const slugs = strList(problem.data.concepts);
  if (slugs.length === 0) return "_No concepts linked yet._";
  return slugs
    .map((slug) => {
      const concept = bySlug.get(slug);
      return concept
        ? `- [${titleOf(concept)}](../../concepts/${slug}/README.md) · ${str(concept.data.status, "?")}`
        : `- ${slug} (missing)`;
    })
    .join("\n");
}

export function renderConceptExercises(concept: ConceptEntry, repo: RepoModel): string {
  const items = repo.exercises.filter((exercise) => exercise.concept === concept.slug);
  if (items.length === 0) return "_No exercises yet._";
  return items
    .map((e) => `- ${mark(e.data.status)} [${e.folderId.split("/")[1]} · ${titleOf(e)}](exercises/${e.folder}/README.md)`)
    .join("\n");
}

export function renderConceptProblems(concept: ConceptEntry, repo: RepoModel): string {
  const items = repo.problems.filter((problem) => strList(problem.data.concepts).includes(concept.slug));
  if (items.length === 0) return "_No problems yet._";
  return items
    .map((p) => `- ${mark(p.data.status)} [${p.folderId} · ${titleOf(p)}](../../problems/${p.folder}/README.md)`)
    .join("\n");
}
```

- [ ] **Step 6: Implement `scripts/lib/sync.ts` and `scripts/sync.ts`**

`scripts/lib/sync.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type DocEntry, scanRepo } from "../../lib/repo.ts";
import { replaceAuto } from "./auto.ts";
import {
  conceptBySlug,
  renderConceptExercises,
  renderConceptIndex,
  renderConceptProblems,
  renderProblemConcepts,
  renderProblemIndex,
} from "./render.ts";

/** Regenerates auto sections and both indexes. Returns the relative paths that changed. */
export function sync(root: string): string[] {
  const repo = scanRepo(root);
  const bySlug = conceptBySlug(repo);
  const changed: string[] = [];

  const writeIfChanged = (file: string, content: string): void => {
    if (existsSync(file) && readFileSync(file, "utf8") === content) return;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    changed.push(path.relative(root, file).split(path.sep).join("/"));
  };

  const updateSections = (entry: DocEntry, sections: [string, string][]): void => {
    if (entry.error) return;
    let body = entry.body;
    for (const [name, content] of sections) body = replaceAuto(body, name, content) ?? body;
    writeIfChanged(entry.readme, entry.head + body);
  };

  for (const problem of repo.problems) updateSections(problem, [["concepts", renderProblemConcepts(problem, bySlug)]]);
  for (const concept of repo.concepts) {
    updateSections(concept, [
      ["exercises", renderConceptExercises(concept, repo)],
      ["problems", renderConceptProblems(concept, repo)],
    ]);
  }
  writeIfChanged(path.join(root, "INDEX.md"), renderProblemIndex(repo));
  writeIfChanged(path.join(root, "concepts", "INDEX.md"), renderConceptIndex(repo));
  return changed;
}
```

`scripts/sync.ts`:

```ts
import { contentRoot } from "../runner/src/paths.ts";
import { sync } from "./lib/sync.ts";

const changed = sync(contentRoot());
console.log(changed.length > 0 ? `Updated:\n${changed.map((file) => `  ${file}`).join("\n")}` : "Everything is in sync.");
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run scripts/tests/sync.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/auto.ts scripts/lib/render.ts scripts/lib/sync.ts scripts/sync.ts scripts/tests/fixture.ts scripts/tests/sync.test.ts
git commit -m "feat(scripts): add sync for indexes and backlinks"
```

---

### Task 13: `pnpm check` (repo validation)

**Files:**
- Create: `lib/schemas.ts`, `scripts/lib/checks.ts`, `scripts/check.ts`
- Test: `scripts/tests/check.test.ts`

**Interfaces:**
- Consumes: `scanRepo`, `str`, `strList`, `DocEntry` (Task 6); `loadCaseFile`, `assertHiddenFilled`, `CaseFileError`, `formatPath` (Task 1); `missingConcepts` (Task 12); `sync` and the fixtures (Task 12).
- Produces:
  - `lib/schemas.ts`: `PATTERNS` (readonly tuple), `problemFrontmatter`, `exerciseFrontmatter`, `conceptFrontmatter` (zod, strict).
  - `scripts/lib/checks.ts`:
    - `interface Issue { file: string; message: string }`, `interface CheckReport { errors: Issue[]; warnings: Issue[] }`.
    - `sectionText(body: string, heading: string): string | null` (HTML comments stripped, trimmed).
    - `checkRepo(root: string): CheckReport`.
  - `scripts/check.ts`: prints `✗ <file>: <message>` for errors and `! <file>: <message>` for warnings, then `N error(s), M warning(s)`. Exit code 1 when there are errors.

- [ ] **Step 1: Write the failing tests**

`scripts/tests/check.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../runner/src/paths.ts";
import { checkRepo, sectionText } from "../lib/checks.ts";
import { sync } from "../lib/sync.ts";
import { conceptReadme, makeStudyRepo, problemReadme, put } from "./fixture.ts";

const messages = (root: string) => checkRepo(root).errors.map((e) => `${e.file}: ${e.message}`);
const edit = (root: string, rel: string, from: string, to: string) =>
  put(root, rel, readFileSync(path.join(root, rel), "utf8").replace(from, to));

describe("checkRepo", () => {
  it("accepts a synced valid repo and warns about missing concepts", () => {
    const root = makeStudyRepo();
    sync(root);
    const report = checkRepo(root);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([{ file: "concepts", message: '"stack" is referenced but not created (lc-0020)' }]);
  });

  it("reports broken links but ignores links inside code", () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "Short paraphrase.", "See [x](../nowhere.md) and `[y](../code.md)`.\n\n```md\n[z](../fence.md)\n```");
    expect(messages(root)).toEqual(["problems/lc-0001-two-sum/README.md: broken link: ../nowhere.md"]);
  });

  it("validates frontmatter against the schema and the pattern vocabulary", () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "hints: 0", "hints: 5");
    edit(root, "problems/lc-0001-two-sum/README.md", "patterns: [arrays-hashing]", "patterns: [hashing]");
    const errors = messages(root);
    expect(errors.some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter hints:"))).toBe(true);
    expect(errors.some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter patterns[0]:"))).toBe(true);
  });

  it("checks that ids match folders", () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "id: lc-0001", "id: lc-0002");
    expect(messages(root)).toContain('problems/lc-0001-two-sum/README.md: id "lc-0002" does not match the folder id "lc-0001"');
  });

  it("detects requires cycles", () => {
    const root = makeStudyRepo();
    edit(root, "concepts/arrays/README.md", "requires: []", "requires: [hash-map]");
    expect(messages(root)).toContain("concepts: requires has a cycle: arrays → hash-map → arrays");
  });

  it("requires every hidden expected value", () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0001-two-sum/cases.json", JSON.stringify({ entry: "f", params: [{ name: "n", type: "int" }], returns: "int", examples: [{ input: [1], expected: 1 }], hidden: [{ input: [2] }] }));
    expect(messages(root)).toContain("problems/lc-0001-two-sum/cases.json: hidden[0].expected: missing (run pnpm fill-expected)");
  });

  it("checks status consistency", () => {
    const root = makeStudyRepo();
    put(root, "concepts/hash-map/README.md", conceptReadme({ slug: "hash-map", title: "Hash map", status: "mastered", requires: ["arrays"] }));
    edit(root, "problems/lc-0001-two-sum/README.md", "solved_in: [py]", "solved_in: []");
    const errors = messages(root);
    expect(errors).toContain('concepts/hash-map/README.md: status is mastered but "My explanation" is empty');
    expect(errors).toContain("problems/lc-0001-two-sum/README.md: status is solved but solved_in is empty");
  });

  it("requires the auto sections", () => {
    const root = makeStudyRepo();
    put(
      root,
      "problems/lc-0001-two-sum/README.md",
      problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: [], status: "todo", solvedIn: [] }).replace("<!-- auto:concepts -->\n<!-- /auto -->\n", ""),
    );
    expect(messages(root)).toContain("problems/lc-0001-two-sum/README.md: missing <!-- auto:concepts --> … <!-- /auto --> section");
  });

  it("exits 1 from the CLI when there are errors", () => {
    const root = makeStudyRepo();
    const run = () => spawnSync(TSX_BIN, ["scripts/check.ts"], { cwd: REPO_ROOT, env: { ...process.env, ALGO_ROOT: root }, encoding: "utf8" });
    const clean = run();
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain("0 error(s), 1 warning(s)");
    edit(root, "problems/lc-0001-two-sum/README.md", "id: lc-0001", "id: nope");
    const broken = run();
    expect(broken.status).toBe(1);
    expect(broken.stdout).toContain('✗ problems/lc-0001-two-sum/README.md: id "nope" does not match');
  });
});

describe("sectionText", () => {
  it("returns a section's text without HTML comments", () => {
    const body = "## A\n\n<!-- hint -->\nhello\n\n## B\nbye\n";
    expect(sectionText(body, "A")).toBe("hello");
    expect(sectionText(body, "B")).toBe("bye");
    expect(sectionText(body, "C")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run scripts/tests/check.test.ts`
Expected: FAIL — `../lib/checks.ts` cannot be loaded.

- [ ] **Step 3: Implement `lib/schemas.ts`**

```ts
import { z } from "zod";

export const PATTERNS = [
  "arrays-hashing",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
  "linked-list",
  "trees",
  "tries",
  "heap",
  "backtracking",
  "graphs",
  "dp-1d",
  "dp-2d",
  "greedy",
  "intervals",
  "math",
  "bit-manipulation",
  "strings",
] as const;

const workFields = {
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["todo", "solving", "solved", "revealed"]),
  hints: z.number().int().min(0).max(2),
  solution_revealed: z.boolean(),
  solved_in: z.array(z.enum(["py", "ts"])),
};

export const problemFrontmatter = z
  .object({
    ...workFields,
    source: z.string().min(1),
    url: z.string().regex(/^https?:\/\//, "must be an http(s) URL"),
    difficulty: z.enum(["easy", "medium", "hard"]),
    patterns: z.array(z.enum(PATTERNS)),
    concepts: z.array(z.string().min(1)),
    complexity: z
      .object({ time: z.string().min(1), space: z.string().min(1), optimal: z.boolean() })
      .strict()
      .nullable(),
  })
  .strict();

export const exerciseFrontmatter = z.object({ ...workFields, concept: z.string().min(1) }).strict();

export const conceptFrontmatter = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    status: z.enum(["new", "learning", "mastered"]),
    requires: z.array(z.string().min(1)),
    related: z.array(z.string().min(1)),
  })
  .strict();
```

- [ ] **Step 4: Implement `scripts/lib/checks.ts`**

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import { type DocEntry, type RepoModel, scanRepo, str, strList } from "../../lib/repo.ts";
import { conceptFrontmatter, exerciseFrontmatter, problemFrontmatter } from "../../lib/schemas.ts";
import { assertHiddenFilled, CaseFileError, formatPath, loadCaseFile } from "../../runner/src/schema.ts";
import { missingConcepts } from "./render.ts";

export interface Issue {
  file: string;
  message: string;
}

export interface CheckReport {
  errors: Issue[];
  warnings: Issue[];
}

const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** Text of a "## heading" section, HTML comments removed and trimmed. null if the heading is absent. */
export function sectionText(body: string, heading: string): string | null {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
}

function markdownFiles(root: string): string[] {
  const files = ["INDEX.md", "README.md", "CLAUDE.md"].map((name) => path.join(root, name)).filter((file) => existsSync(file));
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".md")) files.push(full);
    }
  };
  walk(path.join(root, "problems"));
  walk(path.join(root, "concepts"));
  return files;
}

function findCycle(repo: RepoModel): string[] | null {
  const graph = new Map(repo.concepts.map((concept) => [concept.slug, strList(concept.data.requires)]));
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const visit = (slug: string): string[] | null => {
    if (!graph.has(slug) || state.get(slug) === "done") return null;
    if (state.get(slug) === "visiting") return [...stack.slice(stack.indexOf(slug)), slug];
    state.set(slug, "visiting");
    stack.push(slug);
    for (const next of graph.get(slug)!) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(slug, "done");
    return null;
  };
  for (const slug of [...graph.keys()].sort()) {
    const cycle = visit(slug);
    if (cycle) return cycle;
  }
  return null;
}

export function checkRepo(root: string): CheckReport {
  const repo = scanRepo(root);
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const rel = (file: string): string => path.relative(root, file).split(path.sep).join("/");
  const error = (file: string, message: string): void => {
    errors.push({ file, message });
  };

  const validate = (entry: DocEntry, schema: z.ZodType): boolean => {
    if (entry.error) {
      error(entry.rel, entry.error);
      return false;
    }
    const parsed = schema.safeParse(entry.data);
    if (parsed.success) return true;
    for (const issue of parsed.error.issues) error(entry.rel, `frontmatter ${formatPath(issue.path)}: ${issue.message}`);
    return false;
  };

  const requireAuto = (entry: DocEntry, names: string[]): void => {
    if (entry.error) return;
    for (const name of names) {
      if (!entry.body.includes(`<!-- auto:${name} -->`)) error(entry.rel, `missing <!-- auto:${name} --> … <!-- /auto --> section`);
    }
  };

  const requireCases = (entry: DocEntry): void => {
    const file = path.join(entry.dir, "cases.json");
    if (!existsSync(file)) {
      error(entry.rel, "cases.json is missing");
      return;
    }
    try {
      assertHiddenFilled(loadCaseFile(entry.dir));
    } catch (caught) {
      if (!(caught instanceof CaseFileError)) throw caught;
      for (const issue of caught.issues) error(rel(file), issue);
    }
  };

  const requireSolvedIn = (entry: DocEntry): void => {
    if (entry.data.status === "solved" && strList(entry.data.solved_in).length === 0) {
      error(entry.rel, "status is solved but solved_in is empty");
    }
  };

  for (const problem of repo.problems) {
    if (validate(problem, problemFrontmatter)) {
      if (problem.data.id !== problem.folderId) {
        error(problem.rel, `id "${str(problem.data.id)}" does not match the folder id "${problem.folderId}"`);
      }
      requireSolvedIn(problem);
    }
    requireAuto(problem, ["concepts"]);
    requireCases(problem);
  }

  for (const exercise of repo.exercises) {
    if (validate(exercise, exerciseFrontmatter)) {
      if (exercise.data.id !== exercise.folderId) {
        error(exercise.rel, `id "${str(exercise.data.id)}" does not match the folder id "${exercise.folderId}"`);
      }
      if (exercise.data.concept !== exercise.concept) {
        error(exercise.rel, `concept "${str(exercise.data.concept)}" does not match the parent folder "${exercise.concept}"`);
      }
      requireSolvedIn(exercise);
    }
    requireCases(exercise);
  }

  for (const concept of repo.concepts) {
    if (validate(concept, conceptFrontmatter)) {
      if (concept.data.slug !== concept.slug) {
        error(concept.rel, `slug "${str(concept.data.slug)}" does not match the folder "${concept.slug}"`);
      }
      if (concept.data.status === "mastered" && !sectionText(concept.body, "My explanation")) {
        error(concept.rel, 'status is mastered but "My explanation" is empty');
      }
    }
    requireAuto(concept, ["exercises", "problems"]);
  }

  const cycle = findCycle(repo);
  if (cycle) error("concepts", `requires has a cycle: ${cycle.join(" → ")}`);

  for (const file of markdownFiles(root)) {
    const text = readFileSync(file, "utf8")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`\n]*`/g, "");
    for (const match of text.matchAll(LINK)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
      const clean = decodeURI(target.split("#")[0]);
      if (!existsSync(path.resolve(path.dirname(file), clean))) error(rel(file), `broken link: ${target}`);
    }
  }

  for (const [slug, by] of missingConcepts(repo)) {
    warnings.push({ file: "concepts", message: `"${slug}" is referenced but not created (${by.join(", ")})` });
  }
  return { errors, warnings };
}
```

- [ ] **Step 5: Implement `scripts/check.ts`**

```ts
import { contentRoot } from "../runner/src/paths.ts";
import { checkRepo } from "./lib/checks.ts";

const report = checkRepo(contentRoot());
for (const issue of report.errors) console.log(`✗ ${issue.file}: ${issue.message}`);
for (const issue of report.warnings) console.log(`! ${issue.file}: ${issue.message}`);
console.log(`${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
process.exitCode = report.errors.length > 0 ? 1 : 0;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run scripts/tests/check.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/schemas.ts scripts/lib/checks.ts scripts/check.ts scripts/tests/check.test.ts
git commit -m "feat(scripts): add repo validation (pnpm check)"
```

---

### Task 14: LeetCode draft helper (`pnpm leetcode`)

**Files:**
- Create: `scripts/lib/leetcode.ts`, `scripts/leetcode.ts`
- Test: `scripts/tests/leetcode.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. It emits `cases.json`-shaped drafts in the Task 1 schema.
- Produces:
  - `interface LeetCodeQuestion { questionFrontendId; title; titleSlug; difficulty; content; exampleTestcases; metaData }` (all strings).
  - `mapLeetCodeType(type: string): string | null`, `htmlToText(html: string): string`, `parseOutputs(text: string): string[]`, `slugFrom(arg: string): string`.
  - `interface Draft { id; folder; title; slug; difficulty; url; statement; cases; warnings }` and `buildDraft(question: LeetCodeQuestion): Draft`.
  - CLI: `pnpm -s leetcode <slug | url>` prints the `Draft` as JSON; it exits 1 with a message for premium or unknown slugs and network errors.

- [ ] **Step 1: Write the failing tests**

`scripts/tests/leetcode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDraft, htmlToText, type LeetCodeQuestion, mapLeetCodeType, parseOutputs, slugFrom } from "../lib/leetcode.ts";

const twoSum: LeetCodeQuestion = {
  questionFrontendId: "1",
  title: "Two Sum",
  titleSlug: "two-sum",
  difficulty: "Easy",
  content: [
    "<p>Given an array of integers <code>nums</code>&nbsp;and an integer <code>target</code>, return indices.</p>",
    "<p>You can return the answer in any order.</p>",
    "<pre>",
    "<strong>Input:</strong> nums = [2,7,11,15], target = 9",
    "<strong>Output:</strong> [0,1]",
    "</pre>",
    "<pre>",
    "<strong>Input:</strong> nums = [3,2,4], target = 6",
    "<strong>Output:</strong> [1,2]",
    "</pre>",
    "<ul><li><code>2 &lt;= nums.length &lt;= 10<sup>4</sup></code></li></ul>",
  ].join("\n"),
  exampleTestcases: "[2,7,11,15]\n9\n[3,2,4]\n6",
  metaData: JSON.stringify({
    name: "twoSum",
    params: [
      { name: "nums", type: "integer[]" },
      { name: "target", type: "integer" },
    ],
    return: { type: "integer[]", size: 2 },
  }),
};

const removeElement: LeetCodeQuestion = {
  questionFrontendId: "27",
  title: "Remove Element",
  titleSlug: "remove-element",
  difficulty: "Easy",
  content: "<pre><strong>Output:</strong> 2, nums = [2,2,_,_]</pre><pre><strong>Output:</strong> 5, nums = [0,1,4,0,3,_,_,_]</pre>",
  exampleTestcases: "[3,2,2,3]\n3\n[0,1,2,2,3,0,4,2]\n2",
  metaData: JSON.stringify({
    name: "removeElement",
    params: [
      { name: "nums", type: "integer[]" },
      { name: "val", type: "integer" },
    ],
    return: { type: "integer" },
    output: { paramindex: 0, size: "ret" },
  }),
};

const minStack: LeetCodeQuestion = {
  questionFrontendId: "155",
  title: "Min Stack",
  titleSlug: "min-stack",
  difficulty: "Medium",
  content: '<pre>\n<strong>Input</strong>\n["MinStack","push","getMin"]\n[[],[-2],[]]\n\n<strong>Output</strong>\n[null,null,-2]\n</pre>',
  exampleTestcases: '["MinStack","push","getMin"]\n[[],[-2],[]]',
  metaData: JSON.stringify({ classname: "MinStack", constructor: { params: [] }, methods: [], systemdesign: true }),
};

describe("helpers", () => {
  it("maps LeetCode types to the runner grammar", () => {
    expect(mapLeetCodeType("integer[]")).toBe("int[]");
    expect(mapLeetCodeType("list<list<integer>>")).toBe("int[][]");
    expect(mapLeetCodeType("character[][]")).toBe("string[][]");
    expect(mapLeetCodeType("double")).toBe("float");
    expect(mapLeetCodeType("long[]")).toBe("int[]");
    expect(mapLeetCodeType("ListNode")).toBe("ListNode");
    expect(mapLeetCodeType("Node")).toBeNull();
  });

  it("turns HTML into readable text", () => {
    expect(htmlToText("<p>a&nbsp;&lt;b&gt;</p><ul><li><code>10<sup>4</sup></code></li></ul>")).toBe("a <b>\n- 10^4");
  });

  it("finds outputs with or without a colon", () => {
    expect(parseOutputs("Output: [0,1]\nOutput\n[null,1]")).toEqual(["[0,1]", "[null,1]"]);
  });

  it("extracts slugs from URLs", () => {
    expect(slugFrom("https://leetcode.com/problems/two-sum/description/")).toBe("two-sum");
    expect(slugFrom("Two-Sum")).toBe("two-sum");
  });
});

describe("buildDraft", () => {
  it("drafts a function problem", () => {
    const draft = buildDraft(twoSum);
    expect(draft).toMatchObject({
      id: "lc-0001",
      folder: "lc-0001-two-sum",
      title: "Two Sum",
      difficulty: "easy",
      url: "https://leetcode.com/problems/two-sum/",
    });
    expect(draft.cases).toEqual({
      mode: "function",
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
      hidden: [],
    });
    expect(draft.statement).toContain("2 <= nums.length <= 10^4");
    expect(draft.warnings.join("\n")).toMatch(/any order/);
  });

  it("drafts an in-place problem with prefix expectations", () => {
    const draft = buildDraft(removeElement);
    expect(draft.cases.inPlace).toEqual({ param: "nums", prefix: "return" });
    expect(draft.cases.examples).toEqual([
      { input: [[3, 2, 2, 3], 3], expected: [2, 2] },
      { input: [[0, 1, 2, 2, 3, 0, 4, 2], 2], expected: [0, 1, 4, 0, 3] },
    ]);
  });

  it("drafts a class-design problem", () => {
    const draft = buildDraft(minStack);
    expect(draft.cases).toEqual({
      mode: "class",
      entry: "MinStack",
      compare: "exact",
      examples: [{ input: { ops: ["MinStack", "push", "getMin"], args: [[], [-2], []] }, expected: [null, null, -2] }],
      hidden: [],
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run scripts/tests/leetcode.test.ts`
Expected: FAIL — `../lib/leetcode.ts` cannot be loaded.

- [ ] **Step 3: Implement `scripts/lib/leetcode.ts`**

```ts
export interface LeetCodeQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  content: string;
  exampleTestcases: string;
  metaData: string;
}

interface LeetCodeMeta {
  name?: string;
  params?: { name: string; type: string }[];
  return?: { type: string };
  output?: { paramindex: number; size?: string };
  classname?: string;
}

type Example = { input: unknown; expected?: unknown };

export interface CasesDraft {
  mode: "function" | "class";
  entry: string;
  params?: { name: string; type: string }[];
  returns?: string;
  compare: "exact" | "unordered";
  inPlace?: { param: string; prefix?: "return" };
  examples: Example[];
  hidden: never[];
}

export interface Draft {
  id: string;
  folder: string;
  title: string;
  slug: string;
  difficulty: string;
  url: string;
  statement: string;
  cases: CasesDraft;
  warnings: string[];
}

const TYPE_MAP: Record<string, string> = {
  integer: "int",
  long: "int",
  double: "float",
  float: "float",
  boolean: "bool",
  string: "string",
  character: "string",
  ListNode: "ListNode",
  TreeNode: "TreeNode",
  void: "void",
};

export function mapLeetCodeType(type: string): string | null {
  let base = type.trim();
  let depth = 0;
  for (;;) {
    const list = /^list<(.+)>$/.exec(base);
    if (list) {
      base = list[1].trim();
      depth++;
    } else if (base.endsWith("[]")) {
      base = base.slice(0, -2);
      depth++;
    } else {
      break;
    }
  }
  const mapped = TYPE_MAP[base];
  return mapped ? mapped + "[]".repeat(depth) : null;
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<sup>(.*?)<\/sup>/g, "^$1")
    .replace(/<li>/g, "- ")
    .replace(/<\/(p|li|pre|div)>|<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;|&#\d+;/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Values after "Output:" (function problems) or on the line after "Output" (design problems). */
export function parseOutputs(text: string): string[] {
  return [...text.matchAll(/Output:?[ \t]*\n?[ \t]*(\S.*)/g)].map((match) => match[1].trim());
}

export function slugFrom(arg: string): string {
  const match = /leetcode\.com\/problems\/([^/?#]+)/.exec(arg);
  return (match ? match[1] : arg).trim().toLowerCase();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** "2, nums = [2,2,_,_]" → [2, 2] */
function prefixFromOutput(raw: string): unknown {
  const match = /\[([^\]]*)\]\s*$/.exec(raw);
  if (!match) return undefined;
  const items = match[1].split(",").map((item) => item.trim()).filter((item) => item !== "" && item !== "_");
  return parseJson(`[${items.join(",")}]`);
}

function withExpected(input: unknown, expected: unknown): Example {
  return expected === undefined ? { input } : { input, expected };
}

function functionDraft(meta: LeetCodeMeta, lines: unknown[], outputs: string[], statement: string, warnings: string[]): CasesDraft {
  const params = (meta.params ?? []).map((param) => {
    const type = mapLeetCodeType(param.type);
    if (!type) warnings.push(`unknown LeetCode type "${param.type}" for param "${param.name}"`);
    return { name: param.name, type: type ?? param.type };
  });
  const rawReturn = meta.return?.type ?? "void";
  const returns = mapLeetCodeType(rawReturn);
  if (!returns) warnings.push(`unknown LeetCode return type "${rawReturn}"`);
  const prefix = meta.output?.size === "ret";
  const inPlace = meta.output
    ? prefix
      ? { param: params[meta.output.paramindex].name, prefix: "return" as const }
      : { param: params[meta.output.paramindex].name }
    : undefined;
  const examples: Example[] = [];
  const n = params.length;
  for (let i = 0; n > 0 && i + n <= lines.length; i += n) {
    const raw = outputs[i / n];
    const expected = raw === undefined ? undefined : prefix ? prefixFromOutput(raw) : parseJson(raw);
    examples.push(withExpected(lines.slice(i, i + n), expected));
  }
  const unordered = /any order/i.test(statement);
  if (unordered) warnings.push('the statement says "any order": compare is set to unordered — double-check it');
  return {
    mode: "function",
    entry: meta.name ?? "",
    params,
    returns: returns ?? rawReturn,
    compare: unordered ? "unordered" : "exact",
    ...(inPlace ? { inPlace } : {}),
    examples,
    hidden: [],
  };
}

function classDraft(meta: LeetCodeMeta, lines: unknown[], outputs: string[]): CasesDraft {
  const examples: Example[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const raw = outputs[i / 2];
    examples.push(withExpected({ ops: lines[i], args: lines[i + 1] }, raw === undefined ? undefined : parseJson(raw)));
  }
  return { mode: "class", entry: meta.classname ?? "", compare: "exact", examples, hidden: [] };
}

export function buildDraft(question: LeetCodeQuestion): Draft {
  const meta = JSON.parse(question.metaData) as LeetCodeMeta;
  const statement = htmlToText(question.content);
  const outputs = parseOutputs(statement);
  const lines = question.exampleTestcases
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJson);
  const warnings: string[] = [];
  const cases = meta.classname ? classDraft(meta, lines, outputs) : functionDraft(meta, lines, outputs, statement, warnings);
  cases.examples.forEach((example, i) => {
    if (!("expected" in example)) warnings.push(`could not parse the expected output of example ${i + 1} — fill it from the statement`);
  });
  const number = question.questionFrontendId.padStart(4, "0");
  return {
    id: `lc-${number}`,
    folder: `lc-${number}-${question.titleSlug}`,
    title: question.title,
    slug: question.titleSlug,
    difficulty: question.difficulty.toLowerCase(),
    url: `https://leetcode.com/problems/${question.titleSlug}/`,
    statement,
    cases,
    warnings,
  };
}
```

- [ ] **Step 4: Implement `scripts/leetcode.ts`**

```ts
import { buildDraft, type LeetCodeQuestion, slugFrom } from "./lib/leetcode.ts";

const QUERY = `query question($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug difficulty content exampleTestcases metaData
  }
}`;

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: pnpm -s leetcode <slug | url>");
    process.exitCode = 1;
    return;
  }
  const slug = slugFrom(arg);
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
  });
  if (!response.ok) throw new Error(`LeetCode answered HTTP ${response.status}`);
  const body = (await response.json()) as { data?: { question: LeetCodeQuestion | null } };
  const question = body.data?.question;
  if (!question?.content) {
    console.error(`No public problem found for "${slug}" (premium, or a wrong slug?).`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(buildDraft(question), null, 2));
}

main().catch((error: unknown) => {
  console.error(`Could not fetch from LeetCode: ${(error as Error).message}`);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run scripts/tests/leetcode.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Smoke-test against the real API**

Run: `pnpm -s leetcode two-sum | head -30`
Expected: JSON starting with `"id": "lc-0001"` whose `cases.examples` contains the three LeetCode examples. If the network is unavailable, note it and continue; the unit tests cover the parsing.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/leetcode.ts scripts/leetcode.ts scripts/tests/leetcode.test.ts
git commit -m "feat(scripts): add leetcode draft helper"
```

---
### Task 15: Archive the legacy layout and move the solutions into `problems/`

**Files:**
- Move: `rust/` → `archive/rust/`, `swift/` → `archive/swift/`, `ts/src/data-structures/` → `archive/ts-legacy/data-structures/`, `ts/{package.json,pnpm-lock.yaml,tsconfig.json,src/index.ts}` → `archive/ts-legacy/`, `python/{pyproject.toml,.vscode/}` → `archive/python-legacy/`
- Move and adapt: the 10 files in `python/` and 11 files in `ts/src/leetcode/` → `problems/<folder>/solution.{py,ts}`

**Interfaces:**
- Consumes: the harness contract from Tasks 2–3 (Python: `class Solution` with the entry method; TypeScript: `export default function`; `ListNode` imported from `lc`).
- Produces: 19 problem folders, each holding only `solution.py` and/or `solution.ts`. Tasks 16–17 add the README and `cases.json` files.

**Rule for this task:** only the wrapper changes. That means adding `export default`, replacing self-defined `ListNode` classes with the `lc` import, and deleting top-level test code that would run on import. **Never touch the algorithm lines**, not even obvious bugs (Task 17 re-verifies every solution and records failures honestly).

- [ ] **Step 1: Archive what is not migrated**

```bash
mkdir -p archive/ts-legacy archive/python-legacy
git mv rust archive/rust
git mv swift archive/swift
git mv ts/src/data-structures archive/ts-legacy/data-structures
git mv ts/src/index.ts archive/ts-legacy/index.ts
git mv ts/package.json archive/ts-legacy/package.json
git mv ts/pnpm-lock.yaml archive/ts-legacy/pnpm-lock.yaml
git mv ts/tsconfig.json archive/ts-legacy/tsconfig.json
git mv python/pyproject.toml archive/python-legacy/pyproject.toml
git mv python/.vscode archive/python-legacy/.vscode
```

- [ ] **Step 2: Move every solution with `git mv` (keeps history)**

```bash
mkdir -p problems/lc-0001-two-sum
mkdir -p problems/lc-0009-palindrome-number
mkdir -p problems/lc-0020-valid-parentheses
mkdir -p problems/lc-0021-merge-two-sorted-lists
mkdir -p problems/lc-0026-remove-duplicates-from-sorted-array
mkdir -p problems/lc-0027-remove-element
mkdir -p problems/lc-0028-find-the-index-of-the-first-occurrence-in-a-string
mkdir -p problems/lc-0035-search-insert-position
mkdir -p problems/lc-0058-length-of-last-word
mkdir -p problems/lc-0066-plus-one
mkdir -p problems/lc-0070-climbing-stairs
mkdir -p problems/lc-1672-richest-customer-wealth
mkdir -p problems/lc-1920-build-array-from-permutation
mkdir -p problems/lc-2181-merge-nodes-in-between-zeros
mkdir -p problems/lc-2807-insert-greatest-common-divisors-in-linked-list
mkdir -p problems/lc-2894-divisible-and-non-divisible-sums-difference
mkdir -p problems/lc-2942-find-words-containing-character
mkdir -p problems/lc-3110-score-of-a-string
mkdir -p problems/lc-3280-convert-date-to-binary
git mv python/1_two_sum.py problems/lc-0001-two-sum/solution.py
git mv python/9_palindrome_number.py problems/lc-0009-palindrome-number/solution.py
git mv python/20_valid_parentheses.py problems/lc-0020-valid-parentheses/solution.py
git mv python/26_remove_duplicates_from_sorted_array.py problems/lc-0026-remove-duplicates-from-sorted-array/solution.py
git mv python/27_remove_element.py problems/lc-0027-remove-element/solution.py
git mv python/28_find_the_index_of_the_first_occurrence_in_a_string.py problems/lc-0028-find-the-index-of-the-first-occurrence-in-a-string/solution.py
git mv python/35_search_insert_position.py problems/lc-0035-search-insert-position/solution.py
git mv python/55_lenght_of_the_world.py problems/lc-0058-length-of-last-word/solution.py
git mv python/66_plus_one.py problems/lc-0066-plus-one/solution.py
git mv python/70_climbing_stairs.py problems/lc-0070-climbing-stairs/solution.py
git mv ts/src/leetcode/1_two_sum.ts problems/lc-0001-two-sum/solution.ts
git mv ts/src/leetcode/9_palindrome_number.ts problems/lc-0009-palindrome-number/solution.ts
git mv ts/src/leetcode/21_merge_two_sorted_list.ts problems/lc-0021-merge-two-sorted-lists/solution.ts
git mv ts/src/leetcode/1672_richest_customer_wealth.ts problems/lc-1672-richest-customer-wealth/solution.ts
git mv ts/src/leetcode/1920_build_array_from_permutation.ts problems/lc-1920-build-array-from-permutation/solution.ts
git mv ts/src/leetcode/2181_merge_nodes_in_between_zeros.ts problems/lc-2181-merge-nodes-in-between-zeros/solution.ts
git mv ts/src/leetcode/2807_insert_greatest_common_divisors.ts problems/lc-2807-insert-greatest-common-divisors-in-linked-list/solution.ts
git mv ts/src/leetcode/2894_divisible_and_non_divisible_sums_difference.ts problems/lc-2894-divisible-and-non-divisible-sums-difference/solution.ts
git mv ts/src/leetcode/2942_findwords_containing_character.ts problems/lc-2942-find-words-containing-character/solution.ts
git mv ts/src/leetcode/3110_score_of_string.ts problems/lc-3110-score-of-a-string/solution.ts
git mv ts/src/leetcode/3280_convert_date_to_binary.ts problems/lc-3280-convert-date-to-binary/solution.ts
find ts python -type d -empty -delete
git status --short | head -50
```

Expected: `git status` lists only renames (`R  …`), and the `ts/` and `python/` folders are gone. `python/55_lenght_of_the_world.py` is LeetCode **58** (Length of Last Word): its signature is `lengthOfLastWord`, which confirms it.

- [ ] **Step 3: Remove top-level test code from the Python solutions**

Overwrite each file with exactly this content. It is the original code minus the trailing `if __name__ == "__main__":` / `sol = Solution()` / `print(...)` block; the class bodies are byte-for-byte unchanged.

`problems/lc-0001-two-sum/solution.py`:

```python
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}

        for i, num in enumerate(nums):
            complement = target - num
            if complement in seen:
                return [seen[complement], i]
            seen[num] = i

        raise ValueError("No two sum solution found")
```

`problems/lc-0009-palindrome-number/solution.py`:

```python
class Solution:
    def isPalindrome(self, x: int) -> bool:
        if x < 0:
            return False

        original = x
        reversed_num = 0

        while x > 0:
            reversed_num = reversed_num * 10 + x % 10
            x //= 10

        return original == reversed_num
```

`problems/lc-0020-valid-parentheses/solution.py`:

```python
class Solution:
    def isValid(self, s: str) -> bool:
        dic = {
            "(": ")",
            "[": "]",
            "{": "}"
        }

        stack = []
        for c in s:
            if c in dic:
                stack.append(dic[c])
                continue;

            if len(stack) == 0:
                return False

            d = stack.pop()
            if d != c:
                return False

        return len(stack) == 0
```

`problems/lc-0026-remove-duplicates-from-sorted-array/solution.py`:

```python
class Solution(object):
    def removeDuplicates(self, nums: list[int]):
        """
        :type nums: List[int]
        :rtype: int
        """
        head = 0

        for i, n in enumerate(nums):
            if n > nums[head]:
                head = head + 1
                nums[i], nums[head] = nums[head], nums[i]

        return nums
```

`problems/lc-0027-remove-element/solution.py`:

```python
class Solution:
    def removeElement(self, nums: list[int], val: int) -> int:
        k = 0

        for n in nums:
            if n != val:
                nums[k] = n
                k += 1

        return k
```

`problems/lc-0028-find-the-index-of-the-first-occurrence-in-a-string/solution.py`:

```python
class Solution:
    def strStr(self, haystack: str, needle: str) -> int:
        for i in range(len(haystack) - len(needle) + 1):
            if needle == haystack[i : (i + len(needle))]:
                return i

        return -1
```

`problems/lc-0035-search-insert-position/solution.py`:

```python
class Solution:
    def searchInsert(self, nums: list[int], target: int) -> int:
        left = 0
        mid = len(nums) // 2
        right = len(nums) - 1
        print("l=", nums[left], "mid=", nums[mid], "r=", nums[right], "target=", target)

        if nums[mid] == target:
            return mid

        if mid >= right:
            return mid

        if nums[mid] < target:
            return self.searchInsert(nums[mid:right], target)
        else:
            return self.searchInsert(nums[left:mid], target)
```

`problems/lc-0058-length-of-last-word/solution.py`:

```python
class Solution:
    def lengthOfLastWord(self, s: str) -> int:
        l = 0

        for i in range(len(s)):
            c = s[-(i + 1)]
            if c == " ":
                if l > 0:
                    return l
            else:
                l += 1
        return l
```

`problems/lc-0066-plus-one/solution.py`:

```python
class Solution:
    def plusOne(self, digits: list[int]) -> list[int]:
        for i in reversed(range(len(digits))):
            print(digits[i])
            if digits[i] == 9:
                digits[i] = 0
            else:
                digits[i] += 1
                return digits
        digits.insert(0, 1)
        return digits
```

`problems/lc-0070-climbing-stairs/solution.py`:

```python
class Solution:
    def climbStairs(self, n: int) -> int:
        a, b = 0, 1
        for _ in range(n):
            a, b = b, a + b
        return b
```

- [ ] **Step 4: Adapt the TypeScript wrappers**

These five files change; the other six (`lc-1672`, `lc-1920`, `lc-2894`, `lc-2942`, `lc-3110`, `lc-3280`) already use `export default` and have no top-level test code, so they stay as moved.

`problems/lc-0001-two-sum/solution.ts`:

```ts
export default function twoSum(nums: number[], target: number): number[] {
  const seen: Map<number, number> = new Map();

  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    const complement = target - num;
    if (seen.get(complement) !== undefined) {
      return [seen.get(complement)!, i];
    }
    seen.set(num, i);
  }

  throw new Error("No two sum solution found");
}
```

`problems/lc-0009-palindrome-number/solution.ts`:

```ts
export default function isPalindrome(x: number): boolean {
  if (x < 0) return false;

  const original = x;
  let reversedNumber = 0;

  while (x > 0) {
    const lastNumber = x % 10;
    x = Math.floor(x / 10);
    reversedNumber = reversedNumber * 10 + lastNumber;
  }

  return original === reversedNumber;
}
```

`problems/lc-0021-merge-two-sorted-lists/solution.ts`:

```ts
import { ListNode } from "lc"; // delete this line when pasting into LeetCode

/**
 * Definition for singly-linked list.
 * class ListNode {
 *     val: number
 *     next: ListNode | null
 *     constructor(val?: number, next?: ListNode | null) {
 *         this.val = (val===undefined ? 0 : val)
 *         this.next = (next===undefined ? null : next)
 *     }
 * }
 **/

type TNode = ListNode | null;

function mergeTwoLists(list1: TNode, list2: TNode): TNode {
  let a: TNode = list1;
  let b: TNode = list2;
  const result = new ListNode();
  let current = result;

  while (a?.val !== undefined && b?.val !== undefined) {
    if (a?.val > b?.val) {
      current.next = b;
      b = b?.next || null;
    } else {
      current.next = a;
      a = a?.next || null;
    }

    current = current.next;
  }

  if (a) current.next = a;
  if (b) current.next = b;

  return result.next;
}

export default mergeTwoLists;
```

`problems/lc-2181-merge-nodes-in-between-zeros/solution.ts`:

```ts
import { log } from "console";
import { ListNode } from "lc"; // delete this line when pasting into LeetCode

function mergeNodes(head: ListNode | null): ListNode | null {
  if (!head) return null;

  let prev = head;
  let current = head.next;
  let sum = 0;

  while (current !== null) {
    if (current.val !== 0) {
      sum += current.val;
    } else {
      current.val = sum;
      prev.next = current;
      prev = current;
    }

    current = current.next;
  }

  return head.next;
}

export default mergeNodes;
```

`problems/lc-2807-insert-greatest-common-divisors-in-linked-list/solution.ts`:

```ts
import { log } from "console";
import { ListNode } from "lc"; // delete this line when pasting into LeetCode

function gcd(n: number, m: number): number {
  while (m !== 0) {
    let temp = m;
    m = n % m;
    n = temp;
  }

  return n;
}

function insertGreatestCommonDivisors(
  head: ListNode | null,
): ListNode | null {
  let currentNode = head;

  while (
    currentNode?.val !== null &&
    currentNode?.next &&
    currentNode.next?.val !== null
  ) {
    const newNode = new ListNode(gcd(currentNode.val, currentNode.next.val));
    log(newNode);
    newNode.next = currentNode.next;
    currentNode.next = newNode;
    currentNode = newNode.next;
  }

  return head;
}

export default insertGreatestCommonDivisors;
```

What changed: `lc-0001` and `lc-0009` gained `export default` and lost their top-level `console.log`/`assert` calls. `lc-0021`, `lc-2181` and `lc-2807` import `ListNode` from `lc` instead of defining it, and `lc-2807` uses the non-generic `ListNode` type. `lc-0021` gained `export default mergeTwoLists` and lost its top-level demo code.

- [ ] **Step 5: Check that everything still parses**

```bash
for f in problems/*/solution.py; do "$(uv python find)" -m py_compile "$f" || echo "FAIL $f"; done
for f in problems/*/solution.ts; do TSX_TSCONFIG_PATH=tsconfig.json node --import tsx --input-type=module -e "await import('./$f')" || echo "FAIL $f"; done
```

Expected: no `FAIL` lines (the `lc` import resolves through the `tsconfig.json` path alias).

- [ ] **Step 6: Commit**

```bash
git add -A archive problems
git status --short | grep -vE '^(R |M |A |RM)' || true   # nothing unexpected left unstaged
git commit -m "refactor: move legacy solutions into problems/ and archive the rest"
```

---

### Task 16: Problem files for the ten problems with Python solutions

**Files:**
- Create: `README.md` + `cases.json` in `problems/lc-0001-two-sum/`, `lc-0009-palindrome-number/`, `lc-0020-valid-parentheses/`, `lc-0026-remove-duplicates-from-sorted-array/` (+ `stress.ts`), `lc-0027-remove-element/`, `lc-0028-find-the-index-of-the-first-occurrence-in-a-string/`, `lc-0035-search-insert-position/`, `lc-0058-length-of-last-word/`, `lc-0066-plus-one/`, `lc-0070-climbing-stairs/`

**Interfaces:**
- Consumes: the README format (spec §4.1, validated by `lib/schemas.ts` in Task 13), the `cases.json` schema (Task 1), the `stress.ts` contract (Task 5), and the folders from Task 15.
- Produces: complete problem folders. `status: solving` is provisional; Task 17 sets the real status from the runner.

**About the content:**
- Statements are English paraphrases, because the repo is public.
- Every `cases.json` below was generated during planning: examples come from LeetCode plus the legacy asserts, and hidden `expected` values were computed by reference solutions that lived **outside** the repo and were then discarded.
- Write the files exactly as given.
- The Log date is the migration day. If you run this on another day, update it afterwards with the `sed` in Step 3.

- [ ] **Step 1: Write the files**

#### `problems/lc-0001-two-sum/`

`README.md`:

````markdown
---
id: lc-0001
title: Two Sum
source: leetcode
url: https://leetcode.com/problems/two-sum/
difficulty: easy
patterns: [arrays-hashing]
concepts: [hash-map]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 1. Two Sum

## Statement

Given an integer array `nums` and an integer `target`, return the indices of the two numbers whose sum is `target`. Exactly one valid pair exists, the same element cannot be used twice, and the two indices may be returned in any order.

**Examples**

- `nums = [2,7,11,15], target = 9` → `[0,1]`
- `nums = [3,2,4], target = 6` → `[1,2]`
- `nums = [3,3], target = 6` → `[0,1]`

**Constraints:** `2 <= nums.length <= 10^4` · `-10^9 <= nums[i], target <= 10^9` · exactly one answer exists

**Follow-up:** Can you do better than O(n²) time?

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "twoSum",
  "params": [
    {"name":"nums","type":"int[]"},
    {"name":"target","type":"int"}
  ],
  "returns": "int[]",
  "compare": "unordered",
  "examples": [
    {"input":[[2,7,11,15],9],"expected":[0,1]},
    {"input":[[3,2,4],6],"expected":[1,2]},
    {"input":[[3,3],6],"expected":[0,1]},
    {"input":[[2,7,11,15],18],"expected":[1,2]},
    {"input":[[2,7,11,15],22],"expected":[1,3]},
    {"input":[[2,7,11,15],26],"expected":[2,3]}
  ],
  "hidden": [
    {"input":[[-3,4,3,90],0],"expected":[0,2]},
    {"input":[[0,4,3,0],0],"expected":[0,3]},
    {"input":[[-1,-2,-3,-4,-5],-8],"expected":[2,4]},
    {"input":[[1,5,1,5],10],"expected":[1,3]},
    {"input":[[5,75,25],100],"expected":[1,2]},
    {"input":[[1000000000,-999999997,5],3],"expected":[0,1]},
    {"input":[[2,5,5,11],10],"expected":[1,2]},
    {"input":[[3,2,95,4,-3],92],"expected":[2,4]}
  ]
}
```

#### `problems/lc-0009-palindrome-number/`

`README.md`:

````markdown
---
id: lc-0009
title: Palindrome Number
source: leetcode
url: https://leetcode.com/problems/palindrome-number/
difficulty: easy
patterns: [math]
concepts: [digit-manipulation]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 9. Palindrome Number

## Statement

Given an integer `x`, return `true` if it reads the same from left to right as from right to left, and `false` otherwise.

**Examples**

- `x = 121` → `true`
- `x = -121` → `false` (backwards it reads 121-)
- `x = 10` → `false`

**Constraints:** `-2^31 <= x <= 2^31 - 1`

**Follow-up:** Can you solve it without converting the integer to a string?

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "isPalindrome",
  "params": [
    {"name":"x","type":"int"}
  ],
  "returns": "bool",
  "compare": "exact",
  "examples": [
    {"input":[121],"expected":true},
    {"input":[-121],"expected":false},
    {"input":[10],"expected":false}
  ],
  "hidden": [
    {"input":[0],"expected":true},
    {"input":[1],"expected":true},
    {"input":[11],"expected":true},
    {"input":[1221],"expected":true},
    {"input":[12321],"expected":true},
    {"input":[123],"expected":false},
    {"input":[1000021],"expected":false},
    {"input":[2147447412],"expected":true},
    {"input":[2147483647],"expected":false},
    {"input":[-2147483648],"expected":false},
    {"input":[1000000001],"expected":true}
  ]
}
```

#### `problems/lc-0020-valid-parentheses/`

`README.md`:

````markdown
---
id: lc-0020
title: Valid Parentheses
source: leetcode
url: https://leetcode.com/problems/valid-parentheses/
difficulty: easy
patterns: [stack]
concepts: [stack]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 20. Valid Parentheses

## Statement

The string `s` contains only the characters `(`, `)`, `[`, `]`, `{` and `}`. Return `true` if every opening bracket is closed by a bracket of the same type, brackets close in the correct order, and every closing bracket has a matching opening one.

**Examples**

- `s = "()"` → `true`
- `s = "()[]{}"` → `true`
- `s = "(]"` → `false`
- `s = "([])"` → `true`
- `s = "([)]"` → `false`

**Constraints:** `1 <= s.length <= 10^4` · `s` only contains `()[]{}`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "isValid",
  "params": [
    {"name":"s","type":"string"}
  ],
  "returns": "bool",
  "compare": "exact",
  "examples": [
    {"input":["()"],"expected":true},
    {"input":["()[]{}"],"expected":true},
    {"input":["(]"],"expected":false},
    {"input":["([])"],"expected":true},
    {"input":["([)]"],"expected":false},
    {"input":[")"],"expected":false},
    {"input":["((("],"expected":false}
  ],
  "hidden": [
    {"input":["]"],"expected":false},
    {"input":["{[]}"],"expected":true},
    {"input":["(("],"expected":false},
    {"input":["){"],"expected":false},
    {"input":["([]{})"],"expected":true},
    {"input":["(((((((())))))))"],"expected":true},
    {"input":["[({})]("],"expected":false},
    {"input":["{[}]"],"expected":false},
    {"input":["(([]){})"],"expected":true}
  ]
}
```

#### `problems/lc-0026-remove-duplicates-from-sorted-array/`

`README.md`:

````markdown
---
id: lc-0026
title: Remove Duplicates from Sorted Array
source: leetcode
url: https://leetcode.com/problems/remove-duplicates-from-sorted-array/
difficulty: easy
patterns: [two-pointers]
concepts: [two-pointers, in-place-array-modification]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 26. Remove Duplicates from Sorted Array

## Statement

`nums` is sorted in non-decreasing order. Remove the duplicates **in place** so that each unique value appears only once, keeping their relative order, and return `k`, the number of unique values. The judge checks that the first `k` elements of `nums` hold the unique values in order; whatever comes after position `k` is ignored.

**Examples**

- `nums = [1,1,2]` → `2, nums = [1,2,_]`
- `nums = [0,0,1,1,1,2,2,3,3,4]` → `5, nums = [0,1,2,3,4,_,_,_,_,_]`

**Constraints:** `1 <= nums.length <= 3 * 10^4` · `-100 <= nums[i] <= 100` · `nums` is sorted in non-decreasing order

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "removeDuplicates",
  "params": [
    {"name":"nums","type":"int[]"}
  ],
  "returns": "int",
  "compare": "exact",
  "inPlace": {"param":"nums","prefix":"return"},
  "examples": [
    {"input":[[1,1,2]],"expected":[1,2]},
    {"input":[[0,0,1,1,1,2,2,3,3,4]],"expected":[0,1,2,3,4]}
  ],
  "hidden": [
    {"input":[[1]],"expected":[1]},
    {"input":[[1,2,3]],"expected":[1,2,3]},
    {"input":[[-100,-100,-100]],"expected":[-100]},
    {"input":[[-3,-1,-1,0,0,0,7]],"expected":[-3,-1,0,7]},
    {"input":[[5,5]],"expected":[5]},
    {"input":[[-100,100]],"expected":[-100,100]}
  ]
}
```

`stress.ts`:

```ts
import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const nums = rng.intArray(100_000, -100, 100).sort((a, b) => a - b);
  return [{ name: "n=1e5 sorted values in [-100, 100]", input: [nums] }];
}
```

#### `problems/lc-0027-remove-element/`

`README.md`:

````markdown
---
id: lc-0027
title: Remove Element
source: leetcode
url: https://leetcode.com/problems/remove-element/
difficulty: easy
patterns: [two-pointers]
concepts: [two-pointers, in-place-array-modification]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 27. Remove Element

## Statement

Remove every occurrence of `val` from `nums` **in place** and return `k`, the number of elements different from `val`. The judge checks that the first `k` elements of `nums` are exactly those elements, in any order; whatever comes after position `k` is ignored.

**Examples**

- `nums = [3,2,2,3], val = 3` → `2, nums = [2,2,_,_]`
- `nums = [0,1,2,2,3,0,4,2], val = 2` → `5, nums = [0,1,4,0,3,_,_,_]` (any order)

**Constraints:** `0 <= nums.length <= 100` · `0 <= nums[i] <= 50` · `0 <= val <= 100`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "removeElement",
  "params": [
    {"name":"nums","type":"int[]"},
    {"name":"val","type":"int"}
  ],
  "returns": "int",
  "compare": "unordered",
  "inPlace": {"param":"nums","prefix":"return"},
  "examples": [
    {"input":[[3,2,2,3],3],"expected":[2,2]},
    {"input":[[0,1,2,2,3,0,4,2],2],"expected":[0,1,4,0,3]}
  ],
  "hidden": [
    {"input":[[],0],"expected":[]},
    {"input":[[1],1],"expected":[]},
    {"input":[[1],2],"expected":[1]},
    {"input":[[4,4,4,4],4],"expected":[]},
    {"input":[[0,1,2,3],5],"expected":[0,1,2,3]},
    {"input":[[3,3,1,3,2],3],"expected":[1,2]},
    {"input":[[50,0,50,0],0],"expected":[50,50]}
  ]
}
```

#### `problems/lc-0028-find-the-index-of-the-first-occurrence-in-a-string/`

`README.md`:

````markdown
---
id: lc-0028
title: Find the Index of the First Occurrence in a String
source: leetcode
url: https://leetcode.com/problems/find-the-index-of-the-first-occurrence-in-a-string/
difficulty: easy
patterns: [strings]
concepts: [string-matching]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 28. Find the Index of the First Occurrence in a String

## Statement

Return the index where `needle` first appears inside `haystack`, or `-1` if `needle` is not part of `haystack`.

**Examples**

- `haystack = "sadbutsad", needle = "sad"` → `0`
- `haystack = "leetcode", needle = "leeto"` → `-1`

**Constraints:** `1 <= haystack.length, needle.length <= 10^4` · only lowercase English letters

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "strStr",
  "params": [
    {"name":"haystack","type":"string"},
    {"name":"needle","type":"string"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":["sadbutsad","sad"],"expected":0},
    {"input":["leetcode","leeto"],"expected":-1},
    {"input":["mississippi","issip"],"expected":4},
    {"input":["sad","sad"],"expected":0}
  ],
  "hidden": [
    {"input":["a","a"],"expected":0},
    {"input":["abc","c"],"expected":2},
    {"input":["aaa","aaaa"],"expected":-1},
    {"input":["aaaaab","aab"],"expected":3},
    {"input":["hello","ll"],"expected":2},
    {"input":["abcabcabd","abcabd"],"expected":3},
    {"input":["xyz","xyzz"],"expected":-1},
    {"input":["ababcaababcaabc","ababcaabc"],"expected":6}
  ]
}
```

#### `problems/lc-0035-search-insert-position/`

`README.md`:

````markdown
---
id: lc-0035
title: Search Insert Position
source: leetcode
url: https://leetcode.com/problems/search-insert-position/
difficulty: easy
patterns: [binary-search]
concepts: [binary-search]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 35. Search Insert Position

## Statement

`nums` is sorted in ascending order and has distinct values. Return the index of `target` if it is in `nums`; otherwise return the index where it would be inserted to keep the order. The algorithm must run in O(log n) time.

**Examples**

- `nums = [1,3,5,6], target = 5` → `2`
- `nums = [1,3,5,6], target = 2` → `1`
- `nums = [1,3,5,6], target = 7` → `4`

**Constraints:** `1 <= nums.length <= 10^4` · `-10^4 <= nums[i], target <= 10^4` · distinct values in ascending order

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "searchInsert",
  "params": [
    {"name":"nums","type":"int[]"},
    {"name":"target","type":"int"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[[1,3,5,6],5],"expected":2},
    {"input":[[1,3,5,6],2],"expected":1},
    {"input":[[1,3,5,6],7],"expected":4}
  ],
  "hidden": [
    {"input":[[1],0],"expected":0},
    {"input":[[1],1],"expected":0},
    {"input":[[1],2],"expected":1},
    {"input":[[1,3,5,6],0],"expected":0},
    {"input":[[-10,-5,0,5],-7],"expected":1},
    {"input":[[-10000,10000],10000],"expected":1},
    {"input":[[2,4,6,8,10],9],"expected":4},
    {"input":[[1,3],3],"expected":1},
    {"input":[[1,3,5],4],"expected":2}
  ]
}
```

#### `problems/lc-0058-length-of-last-word/`

`README.md`:

````markdown
---
id: lc-0058
title: Length of Last Word
source: leetcode
url: https://leetcode.com/problems/length-of-last-word/
difficulty: easy
patterns: [strings]
concepts: [string-traversal]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 58. Length of Last Word

## Statement

The string `s` is made of words (runs of letters) separated by spaces, possibly with extra spaces anywhere. Return the length of the last word.

**Examples**

- `s = "Hello World"` → `5`
- `s = "   fly me   to   the moon  "` → `4`
- `s = "luffy is still joyboy"` → `6`

**Constraints:** `1 <= s.length <= 10^4` · only English letters and spaces · at least one word

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "lengthOfLastWord",
  "params": [
    {"name":"s","type":"string"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":["Hello World"],"expected":5},
    {"input":["   fly me   to   the moon  "],"expected":4},
    {"input":["luffy is still joyboy"],"expected":6}
  ],
  "hidden": [
    {"input":["a"],"expected":1},
    {"input":["a "],"expected":1},
    {"input":["   a"],"expected":1},
    {"input":["day"],"expected":3},
    {"input":["b   a    "],"expected":1},
    {"input":["Today is a nice day"],"expected":3},
    {"input":["abc  de"],"expected":2},
    {"input":["   leading"],"expected":7}
  ]
}
```

#### `problems/lc-0066-plus-one/`

`README.md`:

````markdown
---
id: lc-0066
title: Plus One
source: leetcode
url: https://leetcode.com/problems/plus-one/
difficulty: easy
patterns: [math]
concepts: [carry-propagation]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 66. Plus One

## Statement

A large integer is given as an array `digits`, most significant digit first, with no leading zeros. Add one to the integer and return the resulting array of digits.

**Examples**

- `digits = [1,2,3]` → `[1,2,4]`
- `digits = [4,3,2,1]` → `[4,3,2,2]`
- `digits = [9]` → `[1,0]`

**Constraints:** `1 <= digits.length <= 100` · `0 <= digits[i] <= 9` · no leading zeros

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "plusOne",
  "params": [
    {"name":"digits","type":"int[]"}
  ],
  "returns": "int[]",
  "compare": "exact",
  "examples": [
    {"input":[[1,2,3]],"expected":[1,2,4]},
    {"input":[[4,3,2,1]],"expected":[4,3,2,2]},
    {"input":[[9]],"expected":[1,0]},
    {"input":[[9,9,9]],"expected":[1,0,0,0]}
  ],
  "hidden": [
    {"input":[[0]],"expected":[1]},
    {"input":[[8,9,9]],"expected":[9,0,0]},
    {"input":[[1,0,0]],"expected":[1,0,1]},
    {"input":[[9,8,9]],"expected":[9,9,0]},
    {"input":[[9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9]],"expected":[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {"input":[[4,9]],"expected":[5,0]}
  ]
}
```

#### `problems/lc-0070-climbing-stairs/`

`README.md`:

````markdown
---
id: lc-0070
title: Climbing Stairs
source: leetcode
url: https://leetcode.com/problems/climbing-stairs/
difficulty: easy
patterns: [dp-1d]
concepts: [dynamic-programming, recursion]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 70. Climbing Stairs

## Statement

A staircase has `n` steps and each move climbs either 1 or 2 steps. In how many distinct ways can you reach the top?

**Examples**

- `n = 2` → `2` (1+1, 2)
- `n = 3` → `3` (1+1+1, 1+2, 2+1)

**Constraints:** `1 <= n <= 45`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "climbStairs",
  "params": [
    {"name":"n","type":"int"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[2],"expected":2},
    {"input":[3],"expected":3},
    {"input":[4],"expected":5},
    {"input":[5],"expected":8}
  ],
  "hidden": [
    {"input":[1],"expected":1},
    {"input":[10],"expected":89},
    {"input":[20],"expected":10946},
    {"input":[30],"expected":1346269},
    {"input":[44],"expected":1134903170},
    {"input":[45],"expected":1836311903}
  ]
}
```

- [ ] **Step 2: Spot-check with the runner**

```bash
pnpm test two-sum --lang all
pnpm test climbing-stairs
```

Expected: `lc-0001` is `GREEN ✓` in py and ts. `lc-0070` is `GREEN ✓`. A red result here is **not** something to fix: it is recorded in Task 17.

- [ ] **Step 3: Align the Log date (only if today is not 2026-09-27)**

```bash
TODAY=$(date +%F); sed -i '' "s/^- 2026-09-27 · migrated from the legacy repo$/- $TODAY · migrated from the legacy repo/" problems/*/README.md
```

- [ ] **Step 4: Validate**

Run: `pnpm check`
Expected: exactly `18 error(s)`, all of them `README.md is missing` or `cases.json is missing` for the nine TypeScript-only folders that Task 17 fills. There are also warnings for concepts that do not exist yet.

- [ ] **Step 5: Commit**

```bash
git add problems
git commit -m "feat(problems): add statements and cases for the python problems"
```

---

### Task 17: Problem files for the nine TypeScript-only problems, then record the real statuses

**Files:**
- Create: `README.md` + `cases.json` in `problems/lc-0021-merge-two-sorted-lists/`, `lc-1672-richest-customer-wealth/`, `lc-1920-build-array-from-permutation/`, `lc-2181-merge-nodes-in-between-zeros/` (+ `stress.ts`), `lc-2807-insert-greatest-common-divisors-in-linked-list/`, `lc-2894-divisible-and-non-divisible-sums-difference/`, `lc-2942-find-words-containing-character/`, `lc-3110-score-of-a-string/`, `lc-3280-convert-date-to-binary/`
- Modify: all 19 `problems/*/README.md` (`status`, `solved_in`, Log)
- Generate: `INDEX.md`, `concepts/INDEX.md`

**Interfaces:**
- Consumes: Tasks 12–16 (`pnpm test --json`, `pnpm sync`, `pnpm check`).
- Produces: a fully migrated, validated `problems/` tree with honest statuses.

- [ ] **Step 1: Write the files**

#### `problems/lc-0021-merge-two-sorted-lists/`

`README.md`:

````markdown
---
id: lc-0021
title: Merge Two Sorted Lists
source: leetcode
url: https://leetcode.com/problems/merge-two-sorted-lists/
difficulty: easy
patterns: [linked-list, two-pointers]
concepts: [linked-list, two-pointers, dummy-node]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 21. Merge Two Sorted Lists

## Statement

You get the heads of two linked lists, each sorted in non-decreasing order. Merge them into one sorted list by splicing together the nodes of both lists, and return the head of the merged list.

**Examples**

- `list1 = [1,2,4], list2 = [1,3,4]` → `[1,1,2,3,4,4]`
- `list1 = [], list2 = []` → `[]`
- `list1 = [], list2 = [0]` → `[0]`

**Constraints:** each list has `0` to `50` nodes · `-100 <= Node.val <= 100` · both lists are sorted in non-decreasing order

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "mergeTwoLists",
  "params": [
    {"name":"list1","type":"ListNode"},
    {"name":"list2","type":"ListNode"}
  ],
  "returns": "ListNode",
  "compare": "exact",
  "examples": [
    {"input":[[1,2,4],[1,3,4]],"expected":[1,1,2,3,4,4]},
    {"input":[[],[]],"expected":[]},
    {"input":[[],[0]],"expected":[0]},
    {"input":[[1,2],[3,4,5]],"expected":[1,2,3,4,5]}
  ],
  "hidden": [
    {"input":[[5],[1,2,4]],"expected":[1,2,4,5]},
    {"input":[[-100,0,100],[-50,50]],"expected":[-100,-50,0,50,100]},
    {"input":[[1,1,1],[1,1]],"expected":[1,1,1,1,1]},
    {"input":[[],[1]],"expected":[1]},
    {"input":[[2],[1]],"expected":[1,2]},
    {"input":[[-3,-1,4],[-2,-2,5,6]],"expected":[-3,-2,-2,-1,4,5,6]}
  ]
}
```

#### `problems/lc-1672-richest-customer-wealth/`

`README.md`:

````markdown
---
id: lc-1672
title: Richest Customer Wealth
source: leetcode
url: https://leetcode.com/problems/richest-customer-wealth/
difficulty: easy
patterns: [arrays-hashing]
concepts: [matrix-traversal]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 1672. Richest Customer Wealth

## Statement

`accounts[i][j]` is the amount of money customer `i` has in bank `j`. A customer's wealth is the total across all their banks. Return the wealth of the richest customer.

**Examples**

- `accounts = [[1,2,3],[3,2,1]]` → `6`
- `accounts = [[1,5],[7,3],[3,5]]` → `10`
- `accounts = [[2,8,7],[7,1,3],[1,9,5]]` → `17`

**Constraints:** `1 <= m, n <= 50` · `1 <= accounts[i][j] <= 100`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "maximumWealth",
  "params": [
    {"name":"accounts","type":"int[][]"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[[[1,2,3],[3,2,1]]],"expected":6},
    {"input":[[[1,5],[7,3],[3,5]]],"expected":10},
    {"input":[[[2,8,7],[7,1,3],[1,9,5]]],"expected":17}
  ],
  "hidden": [
    {"input":[[[1]]],"expected":1},
    {"input":[[[1,1],[1,1]]],"expected":2},
    {"input":[[[5],[10],[3]]],"expected":10},
    {"input":[[[1,2],[3,4],[5,6]]],"expected":11},
    {"input":[[[100,100,100],[1,1,1]]],"expected":300},
    {"input":[[[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100],[100,100,100,100,100,100,100,100,100,100]]],"expected":1000}
  ]
}
```

#### `problems/lc-1920-build-array-from-permutation/`

`README.md`:

````markdown
---
id: lc-1920
title: Build Array from Permutation
source: leetcode
url: https://leetcode.com/problems/build-array-from-permutation/
difficulty: easy
patterns: [arrays-hashing]
concepts: [in-place-array-modification, modular-arithmetic]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 1920. Build Array from Permutation

## Statement

`nums` is a permutation of `0 .. n-1`. Build and return the array `ans` where `ans[i] = nums[nums[i]]` for every `i`.

**Examples**

- `nums = [0,2,1,5,3,4]` → `[0,1,2,4,5,3]`
- `nums = [5,0,1,2,3,4]` → `[4,5,0,1,2,3]`

**Constraints:** `1 <= nums.length <= 1000` · `0 <= nums[i] < nums.length` · all values are distinct

**Follow-up:** Can you solve it with O(1) extra memory?

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "buildArray",
  "params": [
    {"name":"nums","type":"int[]"}
  ],
  "returns": "int[]",
  "compare": "exact",
  "examples": [
    {"input":[[0,2,1,5,3,4]],"expected":[0,1,2,4,5,3]},
    {"input":[[5,0,1,2,3,4]],"expected":[4,5,0,1,2,3]}
  ],
  "hidden": [
    {"input":[[0]],"expected":[0]},
    {"input":[[1,0]],"expected":[0,1]},
    {"input":[[2,0,1]],"expected":[1,2,0]},
    {"input":[[0,1,2,3]],"expected":[0,1,2,3]},
    {"input":[[3,2,1,0]],"expected":[0,1,2,3]},
    {"input":[[1,2,3,4,0]],"expected":[2,3,4,0,1]}
  ]
}
```

#### `problems/lc-2181-merge-nodes-in-between-zeros/`

`README.md`:

````markdown
---
id: lc-2181
title: Merge Nodes in Between Zeros
source: leetcode
url: https://leetcode.com/problems/merge-nodes-in-between-zeros/
difficulty: medium
patterns: [linked-list]
concepts: [linked-list, two-pointers]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 2181. Merge Nodes in Between Zeros

## Statement

A linked list starts and ends with a node of value `0`, and no two zeros are adjacent. Replace every run of nodes between two consecutive zeros with a single node holding their sum, drop all the zeros, and return the head of the new list.

**Examples**

- `head = [0,3,1,0,4,5,2,0]` → `[4,11]`
- `head = [0,1,0,3,0,2,2,0]` → `[1,3,4]`

**Constraints:** `3 <= number of nodes <= 2 * 10^5` · `0 <= Node.val <= 1000` · no two consecutive zeros · the first and last nodes are `0`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "mergeNodes",
  "params": [
    {"name":"head","type":"ListNode"}
  ],
  "returns": "ListNode",
  "compare": "exact",
  "examples": [
    {"input":[[0,3,1,0,4,5,2,0]],"expected":[4,11]},
    {"input":[[0,1,0,3,0,2,2,0]],"expected":[1,3,4]}
  ],
  "hidden": [
    {"input":[[0,1,0]],"expected":[1]},
    {"input":[[0,1000,1000,0]],"expected":[2000]},
    {"input":[[0,5,0,6,0,7,0]],"expected":[5,6,7]},
    {"input":[[0,1,2,3,4,0]],"expected":[10]}
  ]
}
```

`stress.ts`:

```ts
import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const values = [0];
  while (values.length < 199_998) {
    values.push(rng.int(1, 1000));
    if (rng.int(0, 3) === 0) values.push(0);
  }
  if (values[values.length - 1] !== 0) values.push(0);
  return [{ name: "n≈2e5 nodes", input: [values] }];
}
```

#### `problems/lc-2807-insert-greatest-common-divisors-in-linked-list/`

`README.md`:

````markdown
---
id: lc-2807
title: Insert Greatest Common Divisors in Linked List
source: leetcode
url: https://leetcode.com/problems/insert-greatest-common-divisors-in-linked-list/
difficulty: medium
patterns: [linked-list, math]
concepts: [linked-list, gcd]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 2807. Insert Greatest Common Divisors in Linked List

## Statement

Between every pair of adjacent nodes in the linked list, insert a new node whose value is the greatest common divisor of those two values. Return the head of the resulting list.

**Examples**

- `head = [18,6,10,3]` → `[18,6,6,2,10,1,3]`
- `head = [7]` → `[7]`

**Constraints:** `1 <= number of nodes <= 5000` · `1 <= Node.val <= 1000`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "insertGreatestCommonDivisors",
  "params": [
    {"name":"head","type":"ListNode"}
  ],
  "returns": "ListNode",
  "compare": "exact",
  "examples": [
    {"input":[[18,6,10,3]],"expected":[18,6,6,2,10,1,3]},
    {"input":[[7]],"expected":[7]}
  ],
  "hidden": [
    {"input":[[1,1]],"expected":[1,1,1]},
    {"input":[[2,4]],"expected":[2,2,4]},
    {"input":[[7,13]],"expected":[7,1,13]},
    {"input":[[1000,1000,1000]],"expected":[1000,1000,1000,1000,1000]},
    {"input":[[12,18,27]],"expected":[12,6,18,9,27]},
    {"input":[[5,10,15,20]],"expected":[5,5,10,5,15,5,20]}
  ]
}
```

#### `problems/lc-2894-divisible-and-non-divisible-sums-difference/`

`README.md`:

````markdown
---
id: lc-2894
title: Divisible and Non-divisible Sums Difference
source: leetcode
url: https://leetcode.com/problems/divisible-and-non-divisible-sums-difference/
difficulty: easy
patterns: [math]
concepts: [arithmetic-series]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 2894. Divisible and Non-divisible Sums Difference

## Statement

For positive integers `n` and `m`, let `num1` be the sum of the integers in `[1, n]` that are **not** divisible by `m`, and `num2` the sum of those that **are**. Return `num1 - num2`.

**Examples**

- `n = 10, m = 3` → `19`
- `n = 5, m = 6` → `15`
- `n = 5, m = 1` → `-15`

**Constraints:** `1 <= n, m <= 1000`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "differenceOfSums",
  "params": [
    {"name":"n","type":"int"},
    {"name":"m","type":"int"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[10,3],"expected":19},
    {"input":[5,6],"expected":15},
    {"input":[5,1],"expected":-15}
  ],
  "hidden": [
    {"input":[1,1],"expected":-1},
    {"input":[1,2],"expected":1},
    {"input":[1000,1000],"expected":498500},
    {"input":[1000,1],"expected":-500500},
    {"input":[7,7],"expected":14},
    {"input":[100,7],"expected":3580}
  ]
}
```

#### `problems/lc-2942-find-words-containing-character/`

`README.md`:

````markdown
---
id: lc-2942
title: Find Words Containing Character
source: leetcode
url: https://leetcode.com/problems/find-words-containing-character/
difficulty: easy
patterns: [strings]
concepts: [string-traversal]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 2942. Find Words Containing Character

## Statement

Given a list of `words` and a character `x`, return the indices of the words that contain `x`. The indices may be returned in any order.

**Examples**

- `words = ["leet","code"], x = "e"` → `[0,1]`
- `words = ["abc","bcd","aaaa","cbc"], x = "a"` → `[0,2]`
- `words = ["abc","bcd","aaaa","cbc"], x = "z"` → `[]`

**Constraints:** `1 <= words.length <= 50` · `1 <= words[i].length <= 50` · lowercase English letters

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "findWordsContaining",
  "params": [
    {"name":"words","type":"string[]"},
    {"name":"x","type":"string"}
  ],
  "returns": "int[]",
  "compare": "unordered",
  "examples": [
    {"input":[["leet","code"],"e"],"expected":[0,1]},
    {"input":[["abc","bcd","aaaa","cbc"],"a"],"expected":[0,2]},
    {"input":[["abc","bcd","aaaa","cbc"],"z"],"expected":[]}
  ],
  "hidden": [
    {"input":[["a"],"a"],"expected":[0]},
    {"input":[["b"],"a"],"expected":[]},
    {"input":[["abc","def","ghi","cab"],"c"],"expected":[0,3]},
    {"input":[["zzz","z","az"],"z"],"expected":[0,1,2]},
    {"input":[["leetcode"],"t"],"expected":[0]}
  ]
}
```

#### `problems/lc-3110-score-of-a-string/`

`README.md`:

````markdown
---
id: lc-3110
title: Score of a String
source: leetcode
url: https://leetcode.com/problems/score-of-a-string/
difficulty: easy
patterns: [strings]
concepts: [string-traversal]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 3110. Score of a String

## Statement

The score of a string is the sum of the absolute differences between the ASCII codes of every pair of adjacent characters. Return the score of `s`.

**Examples**

- `s = "hello"` → `13`
- `s = "zaz"` → `50`

**Constraints:** `2 <= s.length <= 100` · lowercase English letters

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "scoreOfString",
  "params": [
    {"name":"s","type":"string"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":["hello"],"expected":13},
    {"input":["zaz"],"expected":50}
  ],
  "hidden": [
    {"input":["ab"],"expected":1},
    {"input":["az"],"expected":25},
    {"input":["aa"],"expected":0},
    {"input":["abcdefghijklmnopqrstuvwxyz"],"expected":25},
    {"input":["zyxw"],"expected":3},
    {"input":["azaz"],"expected":75}
  ]
}
```

#### `problems/lc-3280-convert-date-to-binary/`

`README.md`:

````markdown
---
id: lc-3280
title: Convert Date to Binary
source: leetcode
url: https://leetcode.com/problems/convert-date-to-binary/
difficulty: easy
patterns: [strings, bit-manipulation]
concepts: [binary-representation]
status: solving
hints: 0
solution_revealed: false
solved_in: []
complexity: null
---
# 3280. Convert Date to Binary

## Statement

`date` is a string in the format `yyyy-mm-dd`. Write the year, the month and the day in binary without leading zeros and return them joined as `year-month-day`.

**Examples**

- `date = "2080-02-29"` → `"100000100000-10-11101"`
- `date = "1900-01-01"` → `"11101101100-1-1"`

**Constraints:** `date.length == 10` · a valid date between `1900-01-01` and `2100-12-31`

## Concepts

<!-- auto:concepts -->
<!-- /auto -->

## Log

- 2026-09-27 · migrated from the legacy repo
````

`cases.json`:

```json
{
  "mode": "function",
  "entry": "convertDateToBinary",
  "params": [
    {"name":"date","type":"string"}
  ],
  "returns": "string",
  "compare": "exact",
  "examples": [
    {"input":["2080-02-29"],"expected":"100000100000-10-11101"},
    {"input":["1900-01-01"],"expected":"11101101100-1-1"}
  ],
  "hidden": [
    {"input":["1900-12-31"],"expected":"11101101100-1100-11111"},
    {"input":["2100-12-31"],"expected":"100000110100-1100-11111"},
    {"input":["2000-01-01"],"expected":"11111010000-1-1"},
    {"input":["2024-02-29"],"expected":"11111101000-10-11101"},
    {"input":["1999-10-10"],"expected":"11111001111-1010-1010"}
  ]
}
```

- [ ] **Step 2: Align the Log date (only if today is not 2026-09-27)**

```bash
TODAY=$(date +%F); sed -i '' "s/^- 2026-09-27 · migrated from the legacy repo$/- $TODAY · migrated from the legacy repo/" problems/*/README.md
```

- [ ] **Step 3: Run every migrated solution and record the outcome**

Save this one-off script **outside the repo** as `$TMPDIR/apply-migration-status.mjs`:

```js
// One-off: runs every migrated problem and records the result in its README.
// Run from the repo root: node "$TMPDIR/apply-migration-status.mjs"
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const today = new Date().toISOString().slice(0, 10);

function phase(result) {
  if (result.fatal) return "to load";
  if (result.examples.passed < result.examples.total) return "examples";
  if (result.hidden.status !== "pass") return "hidden cases";
  return "stress";
}

for (const folder of readdirSync("problems").sort()) {
  const id = folder.slice(0, 7);
  let results;
  try {
    results = JSON.parse(execFileSync("pnpm", ["-s", "test", id, "--lang", "all", "--json"], { encoding: "utf8" }));
  } catch (error) {
    results = JSON.parse(error.stdout);
  }
  const green = results.filter((r) => r.green).map((r) => r.lang);
  const failing = results.filter((r) => !r.green).map((r) => `${r.lang} fails ${phase(r)}`);
  const summary = [green.length ? `green in ${green.join(", ")}` : "", ...failing].filter(Boolean).join("; ");
  const file = `problems/${folder}/README.md`;
  let text = readFileSync(file, "utf8");
  if (green.length) {
    text = text.replace(/^status: solving$/m, "status: solved").replace(/^solved_in: \[\]$/m, `solved_in: [${green.join(", ")}]`);
  }
  text = `${text.trimEnd()}\n- ${today} · migration check: ${summary}\n`;
  writeFileSync(file, text);
  console.log(`${id}  ${summary}`);
}
```

Run:

```bash
node "$TMPDIR/apply-migration-status.mjs"
rm "$TMPDIR/apply-migration-status.mjs"
```

Expected: one line per problem. Most read `green in …`. Based on the legacy code, expect at least these to fail, and leave them failing:
- `lc-0026` (`py fails examples`: it returns the array instead of `k`)
- `lc-0035` (`py fails examples`: the recursive slice loses the absolute index)
- `lc-2181` (`ts fails examples`: the running sum is never reset)

Do **not** fix any solution. They belong to the user and now show as `… solving` in `INDEX.md`.

- [ ] **Step 4: Generate the indexes and validate**

```bash
pnpm sync
pnpm check
```

Expected: `pnpm sync` lists the 19 READMEs plus `INDEX.md` and `concepts/INDEX.md`. `pnpm check` ends with `0 error(s)` and one warning per missing concept (for example `"hash-map" is referenced but not created (lc-0001)`).

- [ ] **Step 5: Commit**

```bash
git add problems INDEX.md concepts/INDEX.md
git commit -m "feat(problems): migrate typescript problems and record verified statuses"
```

---
### Task 18: Claude layer — `CLAUDE.md`, README, the five skills, VS Code settings

**Files:**
- Create: `CLAUDE.md`, `README.md`
- Create: `.claude/skills/problem/SKILL.md`, `.claude/skills/concept/SKILL.md`, `.claude/skills/hint/SKILL.md`, `.claude/skills/review/SKILL.md`, `.claude/skills/give-up/SKILL.md`
- Create: `.vscode/settings.json`
- Test: `scripts/tests/claude-layer.test.ts`

**Interfaces:**
- Consumes: every command from Tasks 9–14 (`pnpm -s test … --json`, `pnpm watch`, `pnpm -s fill-expected`, `pnpm -s leetcode`, `pnpm -s sync`, `pnpm -s check`), the formats from Tasks 1, 12 and 13, and `parseMarkdown` (Task 6).
- Produces: the rules and workflows Claude follows in this repo. From this task on, **the hard rules in `CLAUDE.md` apply to you too** (Tasks 15–17 were the only ones allowed to touch `solution.*` files).

- [ ] **Step 1: Write the failing structure test**

`scripts/tests/claude-layer.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../lib/frontmatter.ts";
import { REPO_ROOT } from "../../runner/src/paths.ts";

const SKILLS = ["problem", "concept", "hint", "review", "give-up"];
const skill = (name: string) => parseMarkdown(readFileSync(path.join(REPO_ROOT, ".claude", "skills", name, "SKILL.md"), "utf8"));

describe("project skills", () => {
  it.each(SKILLS)("%s has parseable frontmatter with its name and a real description", (name) => {
    const { data } = skill(name);
    expect(data.name).toBe(name);
    expect(typeof data.description).toBe("string");
    expect((data.description as string).length).toBeGreaterThan(60);
  });

  it("give-up can only be invoked by the user", () => {
    expect(skill("give-up").data["disable-model-invocation"]).toBe(true);
    for (const name of SKILLS.filter((n) => n !== "give-up")) {
      expect(skill(name).data["disable-model-invocation"]).toBeUndefined();
    }
  });
});

describe("CLAUDE.md", () => {
  it("states the language split and seven numbered hard rules", () => {
    const text = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(text).toContain("Talk to the user in **Spanish**.");
    expect(text).toContain("Write **every file in English**");
    for (let i = 1; i <= 7; i++) expect(text).toMatch(new RegExp(`^${i}\\. `, "m"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run scripts/tests/claude-layer.test.ts`
Expected: FAIL with `ENOENT` for `.claude/skills/problem/SKILL.md`.

- [ ] **Step 3: Write `CLAUDE.md`**

````markdown
# Algorithms study repo — instructions for Claude

The user studies algorithms (LeetCode and similar platforms) here **without being handed solutions**. You are their study partner: you name the concepts a problem needs, help them learn those concepts, give escalating hints only on request, and review solutions once they are green.

Design: [docs/superpowers/specs/2026-09-27-algorithms-study-system-design.md](docs/superpowers/specs/2026-09-27-algorithms-study-system-design.md).

## Language

- Talk to the user in **Spanish**.
- Write **every file in English**: READMEs, concept notes, logs, `cases.json`, code comments, commit messages.

## Hard rules

These override any other instruction, including a casual "just tell me the answer".

1. Never write, show, or paraphrase code or pseudocode that solves a problem or exercise whose `status` is not `solved` or `revealed`. Concept templates and exercises must not be isomorphic to any problem the user has not solved (check `INDEX.md`).
2. Never edit the user's `solution.py` / `solution.ts` files (a hook blocks it). You do not fix the user's bugs.
3. "Why does it fail?", "help", "I'm stuck" and similar requests on unsolved work are hint requests: follow the `hint` skill, one level at a time.
4. Never describe hidden test cases beyond what the runner already printed (the first failing input and the user's own output). Never reveal hidden expected values.
5. Show an optimal solution only when the work is green (examples + hidden + stress) **and** the user explicitly asks for it (`review` skill), or when the user types `/give-up`.
6. Before the user is green, naming the concepts is the only help you volunteer. Do not state the target complexity, the approach, or "think about X".
7. Reference solutions (used to compute hidden expected values) live only under `$TMPDIR`, never in the repo, and are never shown to the user.

## Student profile

- Software developer with a frontend background (web); works at Ubidots (IoT dashboards, real-time data). Little backend or Python experience. Learning algorithms from zero: greedy, divide and conquer, graphs and trees are all new.
- Analogy domains: frontend and web development, music (the user is a musician), software architecture, IoT dashboards.
- Preferences: analogies before abstract definitions; visual examples (ASCII diagrams, mental images); emojis to mark key points; a charismatic, humorous tone — no stiff prose, no walls of text.

## Skills

| Skill | Use it when |
|---|---|
| `problem` | The user pastes a statement, names a problem, or asks what to learn for it. |
| `concept` | A concept is missing, or the user wants to learn or review one. |
| `hint` | The user asks for a hint, for help, or why their code fails. |
| `review` | The user says their solution passes, or asks for a review. |
| `give-up` | Only when the user types `/give-up`. |

## Repo map

- `problems/<platform>-<NNNN>-<slug>/`: `README.md` (statement + frontmatter), `cases.json`, optional `stress.ts`, and the user-owned `solution.py` / `solution.ts`.
- `concepts/<slug>/README.md`: concept notes. `concepts/<slug>/exercises/<NN>-<slug>/`: runnable exercises with the same shape as problems.
- `INDEX.md` and `concepts/INDEX.md`: generated by `pnpm sync`. Never edit them by hand.
- `runner/`: test engine. `scripts/`: sync, check, leetcode. `lib/`: shared Markdown model.
- `archive/`: legacy code. Ignore it.

## Commands

Use `pnpm -s` whenever you parse output, so pnpm's banner does not corrupt the JSON.

- `pnpm -s test <query> [--lang py|ts|all] --json`: runs once. `green: true` means examples, hidden and stress all pass.
- `pnpm watch <query> [--lang py|ts] [--open]`: for the user. Do not start it yourself.
- `pnpm -s fill-expected <query> --ref <file outside the repo>`: fills hidden expected values.
- `pnpm -s leetcode <slug|url>`: JSON draft of a LeetCode problem (statement text, signature, examples).
- `pnpm -s sync`, then `pnpm -s check`: after any change to problems or concepts.
- `pnpm verify`: tool tests + check.

`<query>` is an id (`lc-0001`, `hash-map/01`), a LeetCode number, or part of a folder name.

## Vocabulary

- Problem/exercise `status`: `todo` · `solving` · `solved` · `revealed`. `hints`: 0–2.
- Concept `status`: `new` (created ahead of time) · `learning` · `mastered`.
- `patterns` (the groups in `INDEX.md`): arrays-hashing, two-pointers, sliding-window, stack, binary-search, linked-list, trees, tries, heap, backtracking, graphs, dp-1d, dp-2d, greedy, intervals, math, bit-manipulation, strings.
- Log lines: `- YYYY-MM-DD · <event>`, appended at the end of the README.

The full file formats are in spec §4 (problem README, `cases.json`, `stress.ts`, concept note).
````

- [ ] **Step 4: Write `README.md`**

````markdown
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
````

- [ ] **Step 5: Write `.claude/skills/problem/SKILL.md`**

````markdown
---
name: problem
description: Use when the user pastes an algorithm problem statement, names a problem ("two sum", "lc 42", a LeetCode URL), or asks what they need to learn to solve one — in Spanish or English ("tengo este problema", "¿qué necesito para resolver…?"). Registers the problem (README, cases.json, optional stress.ts) and replies ONLY with the concepts needed for the optimal solution. Never gives hints, approaches or solutions.
---

# problem — register a problem and name the concepts it needs

The hard rules in `CLAUDE.md` apply. Reply to the user in Spanish; write files in English.

## 1. Identify the problem

- **LeetCode** (URL, slug, or number + title): run `pnpm -s leetcode <slug>`. It prints JSON with `id`, `folder`, `title`, `difficulty`, `url`, `statement` (plain text), `cases` (a draft `cases.json` with the examples and no hidden cases) and `warnings`. If you only have a number, work out the slug from the title, and ask the user if you are unsure.
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
- Use `status: todo` instead of `solving` if the user says the problem is for later.

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

- Generate inputs only, and make them satisfy the problem's guarantees (for example "exactly one answer exists").
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

- The problem title, its folder, and how to start: `pnpm watch <id> --open` (add `--lang ts` for TypeScript).
- The concepts, one per line: `- two-pointers — learning` / `- greedy — **falta** → ¿lo creamos?`
- The prerequisites that are not mastered, if any.

Nothing else: no approach, no complexity target, no "piensa en…". Naming the concepts **is** the help at this stage.
````

- [ ] **Step 6: Write `.claude/skills/concept/SKILL.md`**

````markdown
---
name: concept
description: Use when a concept note is missing or the user wants to learn, create or review a concept (greedy, two pointers, BFS, hash map…) — "creemos el concepto", "enséñame greedy", "¿qué es divide y vencerás?", "revisa mi explicación", "¿ya domino X?". Creates concept notes with runnable exercises, teaches Socratically, and reviews mastery.
---

# concept — create, teach and review concept notes

The hard rules and the student profile in `CLAUDE.md` apply. Reply in Spanish; write files in English.

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
````

- [ ] **Step 7: Write `.claude/skills/hint/SKILL.md`**

````markdown
---
name: hint
description: Use when the user asks for a hint or help on a problem or concept exercise, or asks why their code fails — "pista", "dame una pista", "ayuda", "estoy atascado", "¿por qué falla?". Escalates exactly one level per request (Socratic question, then the key idea in words) and never gives code or pseudocode.
---

# hint — one level at a time

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

1. **Target:** the problem or exercise the user names. If they name none and exactly one item has `status: solving` (the reminder context lists them), use that one. Otherwise, ask which one.
2. **Read** its README: the frontmatter `hints` (0, 1 or 2) and the Log.
3. **Next level = `hints + 1`:**
   - **Level 1 — one Socratic question.** It points at the key insight without naming any steps. You may read the user's `solution.*` to aim the question at their current approach (for example, at what their inner loop keeps recomputing). Do not state the answer.
   - **Level 2 — the key idea in plain words**, in 1–3 sentences. No code, no pseudocode, no step-by-step algorithm, no variable names.
   - **Already at level 2:** no more hints. Point to the concept notes linked in the README and to their exercises, and mention that `/give-up` exists (the user has to type it).
4. **Already solved but not optimal** (`complexity.optimal: false`): the same ladder applies to reaching the better complexity, and the counter keeps going.
5. **"Why does it fail?":** use only what the runner printed, meaning the failing input and the user's own output. Never reveal other hidden inputs or any expected value.
6. **Record:** set `hints` to the new level and append `- YYYY-MM-DD · hint <level>` to the Log. Run `pnpm -s sync`.
7. **Reply** with the hint and nothing else.
````

- [ ] **Step 8: Write `.claude/skills/review/SKILL.md`**

````markdown
---
name: review
description: Use when the user says their solution passes or asks for a review of a problem or concept exercise — "ya pasa", "está en verde", "revisa mi solución", "review", "¿es óptima?". Confirms green with the runner, analyzes the complexity of the user's code, and records the result. Never explains how to reach a better complexity.
---

# review — confirm green, measure, record

The hard rules in `CLAUDE.md` apply. Reply in Spanish.

1. **Target:** as in the `hint` skill.
2. **Run** `pnpm -s test <id> --lang all --json` and parse the array.
3. **Not green in any language:** tell the user which phase fails in each language (load error, examples, hidden, stress) and stop. Debugging help goes through the `hint` skill.
4. **Green:** read `solution.<lang>` for each green language and work out its time and space complexity (Big-O in terms of the input names). Compare it with the best known complexity for this problem.
5. **Update the frontmatter:**
   - `status: solved` (also when it was `revealed`).
   - `solved_in`: the green languages.
   - Problems only: `complexity: { time: "O(…)", space: "O(…)", optimal: true|false }`.
   - Append a Log line: `- YYYY-MM-DD · green in py, O(n²) → better exists` or `- YYYY-MM-DD · green in py, O(n) ✓ optimal`.
6. **Reply:**
   - Give the complexity of their code.
   - If it is not optimal, say only "Existe una solución O(…) en tiempo" (or in space), and nothing about how to get there. Offer the `hint` skill if they want to go for it.
7. **Show the optimal solution** only if the user then explicitly asks to see it:
   - Show it **in chat**, with a short explanation.
   - Set `solution_revealed: true` and log `- YYYY-MM-DD · optimal solution shown`.
   - Never write it to a file.
8. **Sync:** `pnpm -s sync && pnpm -s check`.
````

- [ ] **Step 9: Write `.claude/skills/give-up/SKILL.md`**

````markdown
---
name: give-up
description: Reveal the optimal solution of a problem or concept exercise the user gives up on. Only runs when the user types /give-up.
disable-model-invocation: true
---

# give-up — reveal, record, plan a retry

Reply in Spanish.

1. **Target:** as in the `hint` skill.
2. **Ask once:** "¿Seguro? Te muestro la solución óptima y el problema queda marcado como revealed." Then wait. Anything other than a clear yes means stop.
3. **Explain in chat:**
   - the key insight;
   - the approach, step by step;
   - the optimal solution, in the language the user has been using;
   - its time and space complexity;
   - links to the relevant concept notes.

   Never write the solution to any file.
4. **Frontmatter:** set `status: revealed` and `solution_revealed: true`, and log `- YYYY-MM-DD · gave up, solution revealed`.
5. **Sync:** run `pnpm -s sync`.
6. **Suggest** retrying from scratch in a few days without looking at the solution. `INDEX.md` marks the problem with ↺.
````

- [ ] **Step 10: Write `.vscode/settings.json`**

```json
{
  "editor.quickSuggestions": { "other": "off", "comments": "off", "strings": "off" },
  "editor.suggestOnTriggerCharacters": false,
  "editor.wordBasedSuggestions": "off",
  "editor.parameterHints.enabled": false,
  "editor.inlineSuggest.enabled": false,
  "editor.acceptSuggestionOnEnter": "off",
  "editor.tabCompletion": "off",
  "editor.snippetSuggestions": "none",
  "github.copilot.enable": { "*": false },
  "github.copilot.nextEditSuggestions.enabled": false,
  "chat.disableAIFeatures": true,
  "editor.formatOnSave": true,
  "[python]": { "editor.defaultFormatter": "charliermarsh.ruff", "editor.tabSize": 4 },
  "python.analysis.extraPaths": ["runner/harness/python"]
}
```

- [ ] **Step 11: Run the tests and the repo check**

```bash
pnpm exec vitest run scripts/tests/claude-layer.test.ts
pnpm check
```

Expected: the test PASSES (7 tests). `pnpm check` reports `0 error(s)`, which proves the links in `CLAUDE.md` and `README.md` resolve.

- [ ] **Step 12: Verify the VS Code settings by hand**

Open the repo in VS Code and open `.vscode/settings.json`. Every key must be recognized, with no "Unknown Configuration Setting" underline. If VS Code (1.137 here) flags one, search the Settings UI for the same feature ("inline suggest", "AI features", "Copilot") and use the key it shows. Then open `problems/lc-0001-two-sum/solution.py`, type `nu`, and confirm that no suggestion popup appears and no grey inline completion shows.

- [ ] **Step 13: Commit**

```bash
git add CLAUDE.md README.md .claude/skills .vscode/settings.json scripts/tests/claude-layer.test.ts
git commit -m "feat(claude): add rules, study skills and a no-AI editor setup"
```

---

### Task 19: Hooks, permissions and `AGENTS.md`

**Files:**
- Create: `.claude/hooks/guard-solution.mjs`, `.claude/hooks/reminder.mjs`, `.claude/settings.json`
- Replace: `AGENTS.md` → symlink to `CLAUDE.md`
- Test: `scripts/tests/hooks.test.ts`

**Interfaces:**
- Consumes: the Claude Code hook protocol (JSON event on stdin; `CLAUDE_PROJECT_DIR` env). PreToolUse denies by printing `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":…}}`. UserPromptSubmit adds context by printing `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":…}}`. Also consumes `put` from `scripts/tests/fixture.ts` (Task 12).
- Produces: deterministic enforcement of rule 2, a per-prompt reminder of the rules and the work in progress, and allow-rules for the read-mostly commands the skills run.

- [ ] **Step 1: Write the failing hook tests**

`scripts/tests/hooks.test.ts`:

```ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { put } from "./fixture.ts";

const HOOKS = path.join(REPO_ROOT, ".claude", "hooks");
const PROJECT = "/work/algorithms";

function hook(name: string, input: unknown, projectDir: string) {
  const run = spawnSync(process.execPath, [path.join(HOOKS, name)], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf8",
  });
  expect(run.status).toBe(0);
  return run.stdout ? JSON.parse(run.stdout) : null;
}

function decision(input: unknown): string {
  return hook("guard-solution.mjs", input, PROJECT)?.hookSpecificOutput?.permissionDecision ?? "allow";
}

describe("guard-solution hook", () => {
  it("denies edits and writes to solution files", () => {
    expect(decision({ tool_name: "Edit", tool_input: { file_path: `${PROJECT}/problems/lc-0001-two-sum/solution.py` } })).toBe("deny");
    expect(decision({ tool_name: "Write", tool_input: { file_path: "concepts/hash-map/exercises/01-first-repeat/solution.ts" } })).toBe("deny");
    expect(decision({ tool_name: "MultiEdit", tool_input: { file_path: `${PROJECT}/problems/x/solution.ts` } })).toBe("deny");
  });

  it("allows other files, including references outside the repo and test scratch space", () => {
    expect(decision({ tool_name: "Edit", tool_input: { file_path: `${PROJECT}/problems/lc-0001-two-sum/README.md` } })).toBe("allow");
    expect(decision({ tool_name: "Write", tool_input: { file_path: "/tmp/algorithms-ref-lc-0001/ref.py" } })).toBe("allow");
    expect(decision({ tool_name: "Write", tool_input: { file_path: `${PROJECT}/runner/tests/.tmp/t-1/problems/p/solution.py` } })).toBe("allow");
  });

  it("denies shell commands that write to, move or delete solution files", () => {
    for (const command of [
      "cat > problems/lc-0001-two-sum/solution.py <<'EOF'\nx = 1\nEOF",
      "echo x >> problems/a/solution.ts",
      "sed -i '' 's/a/b/' problems/a/solution.py",
      "perl -pi -e 's/a/b/' problems/a/solution.py",
      "cp /tmp/ref.py problems/a/solution.py",
      "mv problems/a/solution.py /tmp/",
      "rm problems/a/solution.ts",
      "echo hi | tee problems/a/solution.py",
      "pnpm -s sync && rm -f concepts/x/exercises/01-y/solution.py",
    ]) {
      expect(decision({ tool_name: "Bash", tool_input: { command } }), command).toBe("deny");
    }
  });

  it("allows reading, running and git mv", () => {
    for (const command of [
      "cat problems/a/solution.py",
      "sed -n 1,20p problems/lc-0001-two-sum/solution.py",
      "pnpm -s test lc-0001 --json",
      "git mv python/1_two_sum.py problems/lc-0001-two-sum/solution.py",
      "git diff problems/a/solution.py",
      "python3 problems/a/solution.py",
    ]) {
      expect(decision({ tool_name: "Bash", tool_input: { command } }), command).toBe("allow");
    }
  });
});

describe("reminder hook", () => {
  it("lists work in progress with hint levels", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "algo-hook-"));
    put(root, "problems/lc-0001-two-sum/README.md", "---\nid: lc-0001\nstatus: solving\nhints: 1\n---\n");
    put(root, "problems/lc-0009-palindrome-number/README.md", "---\nid: lc-0009\nstatus: solved\nhints: 0\n---\n");
    put(root, "concepts/hash-map/README.md", "---\nslug: hash-map\nstatus: learning\n---\n");
    put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", "---\nid: hash-map/01\nstatus: solving\nhints: 0\n---\n");
    const output = hook("reminder.mjs", { prompt: "hola" }, root);
    expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    const context = output.hookSpecificOutput.additionalContext as string;
    expect(context).toContain("2. Never edit solution.py / solution.ts.");
    expect(context).toContain("In progress: lc-0001 (hints 1), hash-map/01 (hints 0).");
    expect(context).not.toContain("lc-0009");
  });

  it("says when nothing is in progress", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "algo-hook-"));
    const output = hook("reminder.mjs", { prompt: "hola" }, root);
    expect(output.hookSpecificOutput.additionalContext).toContain("In progress: nothing.");
  });
});

describe("settings.json", () => {
  it("registers both hooks with the project path", () => {
    const settings = JSON.parse(readFileSync(path.join(REPO_ROOT, ".claude", "settings.json"), "utf8"));
    const pre = settings.hooks.PreToolUse[0];
    expect(pre.matcher).toBe("Edit|Write|MultiEdit|NotebookEdit|Bash");
    expect(pre.hooks[0].command).toContain("$CLAUDE_PROJECT_DIR/.claude/hooks/guard-solution.mjs");
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toContain("$CLAUDE_PROJECT_DIR/.claude/hooks/reminder.mjs");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run scripts/tests/hooks.test.ts`
Expected: FAIL. `spawnSync` exits non-zero ("Cannot find module …guard-solution.mjs"), and `settings.json` is missing.

- [ ] **Step 3: Write `.claude/hooks/guard-solution.mjs`**

```js
#!/usr/bin/env node
// PreToolUse guard: Claude must never write to the user's solution files (CLAUDE.md rule 2).
import { readFileSync } from "node:fs";
import path from "node:path";

const SOLUTION_PATH = /^(problems|concepts)\/.+\/solution\.(py|ts)$/;
const NAME = String.raw`\S*solution\.(?:py|ts)\b`;
const BASH_WRITES = [
  new RegExp(String.raw`>>?\|?\s*${NAME}`), // redirection into the file
  new RegExp(String.raw`\btee\b[^|;&]*${NAME}`),
  new RegExp(String.raw`\b(?:sed|perl)\b[^|;&]*\s-[a-zA-Z]*i[a-zA-Z.]*\b[^|;&]*${NAME}`), // in-place edit
  new RegExp(String.raw`\b(?:rm|truncate|unlink|mv)\b[^|;&]*${NAME}`), // delete or move away
  new RegExp(String.raw`\b(?:cp|install|ln)\b[^|;&]*\s${NAME}\s*$`), // copy onto it
];
const REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): solution.py / solution.ts belong to the user. " +
  "Do not write, edit, move or delete them. If the user asked for help, follow the hint skill.";

function deny() {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: REASON },
    }),
  );
}

try {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const projectDir = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const input = event.tool_input ?? {};
  if (event.tool_name === "Bash") {
    const segments = String(input.command ?? "")
      .split(/&&|\|\||;|\n/)
      .map((segment) => segment.trim());
    const writes = segments.some((segment) => !/^git\s+mv\b/.test(segment) && BASH_WRITES.some((re) => re.test(segment)));
    if (writes) deny();
  } else {
    const target = input.file_path ?? input.notebook_path;
    if (target) {
      const relative = path.relative(projectDir, path.resolve(projectDir, String(target))).split(path.sep).join("/");
      if (SOLUTION_PATH.test(relative)) deny();
    }
  }
} catch (error) {
  process.stderr.write(`guard-solution hook failed: ${error.message}\n`);
}
```

- [ ] **Step 4: Write `.claude/hooks/reminder.mjs`**

```js
#!/usr/bin/env node
// UserPromptSubmit: keeps the study rules and the work in progress in Claude's context.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const RULES = [
  "[algorithms study rules — see CLAUDE.md]",
  "1. No solution code or pseudocode for problems/exercises that are not solved or revealed.",
  "2. Never edit solution.py / solution.ts.",
  "3. 'Help' or 'why does it fail' on unsolved work = the hint skill, one level at a time.",
  "4. Never describe hidden cases beyond the runner output.",
  "5. Optimal solution only when green AND explicitly asked, or via /give-up.",
  "Chat in Spanish; write files in English.",
];

function field(text, name) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const line = frontmatter && new RegExp(`^${name}:\\s*(.+)$`, "m").exec(frontmatter[1]);
  return line ? line[1].trim() : null;
}

function subdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function readmes(root) {
  const dirs = [...subdirs(path.join(root, "problems"))];
  for (const concept of subdirs(path.join(root, "concepts"))) dirs.push(...subdirs(path.join(concept, "exercises")));
  return dirs.map((dir) => path.join(dir, "README.md")).filter((file) => existsSync(file));
}

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const inProgress = readmes(root)
    .map((file) => readFileSync(file, "utf8"))
    .filter((text) => field(text, "status") === "solving")
    .map((text) => `${field(text, "id")} (hints ${field(text, "hints") ?? "0"})`);
  const context = [...RULES, inProgress.length ? `In progress: ${inProgress.join(", ")}.` : "In progress: nothing."].join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } }));
} catch (error) {
  process.stderr.write(`reminder hook failed: ${error.message}\n`);
}
```

- [ ] **Step 5: Write `.claude/settings.json`**

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm -s test:*)",
      "Bash(pnpm -s sync)",
      "Bash(pnpm -s check)",
      "Bash(pnpm -s leetcode:*)",
      "Bash(pnpm -s fill-expected:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit|Bash",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-solution.mjs\"" }]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/reminder.mjs\"" }]
      }
    ]
  }
}
```

- [ ] **Step 6: Replace `AGENTS.md` with a symlink**

```bash
git rm -q AGENTS.md
ln -s CLAUDE.md AGENTS.md
git add AGENTS.md
```

Its old content described the removed multi-language layout. Now agents that read `AGENTS.md` (OpenCode, Codex) get the same rules.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run scripts/tests/hooks.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add .claude/hooks .claude/settings.json AGENTS.md scripts/tests/hooks.test.ts
git commit -m "feat(claude): enforce solution ownership with hooks and remind rules each prompt"
```

---

### Task 20: First concept end to end (`hash-map`) and final verification

**Files:**
- Create: `concepts/hash-map/README.md`
- Create: `concepts/hash-map/exercises/01-first-repeat/{README.md,cases.json,stress.ts}`, `concepts/hash-map/exercises/02-most-frequent/{README.md,cases.json,stress.ts}`, `concepts/hash-map/exercises/03-same-letters/{README.md,cases.json}`
- Regenerate: `INDEX.md`, `concepts/INDEX.md`, the `auto:` sections

**Interfaces:**
- Consumes: the concept format (Task 18 `concept` skill; `check` rules from Task 13), the `stress.ts` contract (Task 5), and `pnpm sync`/`pnpm check`/`pnpm verify`.
- Produces: the success criterion "one concept exists end to end with runnable exercises", and a fully verified branch.

The hidden `expected` values below were computed during planning by references outside the repo. **Do not run `pnpm test` on these exercises:** it would create `solution.*` stubs, and those files belong to the user.

- [ ] **Step 1: Write `concepts/hash-map/README.md`**

````markdown
---
slug: hash-map
title: Hash map
status: learning
requires: []
related: []
---
# Hash map

## Intuition

Think of the coat check at a concert 🎟️. You hand over your coat, you get ticket #42, and at the end of the night the attendant walks straight to hook 42 — nobody searches through every coat. A hash map does the same for data: the **key** is turned into a position (its *hash*), so "is this here?" and "what is stored for this key?" take about the same time whether you stored 10 items or 10 million.

You already use one in frontend code: `usersById[id]` instead of `users.find((u) => u.id === id)`. The `find` walks the whole list every time; the lookup jumps straight to the answer. 🎯

## Diagram

```
put("sol", 5)   hash("sol") % 8 = 6   →  bucket 6: [sol→5]
put("la", 6)    hash("la")  % 8 = 2   →  bucket 2: [la→6]
put("do", 1)    hash("do")  % 8 = 6   →  bucket 6: [sol→5, do→1]   ← collision: both share bucket 6

buckets   0     1     2        3     4     5     6               7
        [   ] [   ] [la→6]  [   ] [   ] [   ] [sol→5, do→1]  [   ]

get("la")  → hash → bucket 2 → found in one step
get("re")  → hash → bucket 4 → empty → "not here", also one step
```

## Signals

- "Have I seen this value before?" (duplicates, the first repeat, pairs)
- "How many times does each … appear?" (frequencies, anagrams, majority)
- "Find two elements that …" where checking every pair would be O(n²)
- "Group the items by …" (same letters, same key)
- A nested loop whose inner loop only *searches* for something

## When it fails

- **Order matters:** a hash map keeps no order by value. "The k-th smallest" or "the next bigger value" needs sorting or a heap, not hashing.
- **Keys must be hashable and stable:** a Python `list` cannot be a key (use a `tuple`); in JavaScript two different arrays `[1, 2]` are two different `Map` keys, so build a string key first.
- **Memory:** you trade space for time. With 10^8 items, the extra O(n) memory may not fit.

## Typical complexity

| Operation | Average | Worst case (many collisions) |
|---|---|---|
| insert / lookup / delete | O(1) | O(n) |
| build from n items | O(n) | O(n²) |
| extra space | O(n) | O(n) |

With the built-in `dict` / `Map` / `Set`, treat single operations as O(1) in practice.

## Template

Counting occurrences — Python:

```python
def count(items: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item] = counts.get(item, 0) + 1
    return counts
```

Counting occurrences — TypeScript:

```ts
function count(items: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}
```

Membership with a set — Python and TypeScript:

```python
seen: set[str] = set()
seen.add("do")
"do" in seen   # True, O(1) on average
```

```ts
const seen = new Set<string>();
seen.add("do");
seen.has("do"); // true, O(1) on average
```

## Exercises

<!-- auto:exercises -->
<!-- /auto -->

## Quick checks

1. Why is `x in my_list` O(n) but `x in my_set` O(1) on average?
2. You must count how often each word appears in a one-million-word text. What would the keys and the values be?
3. Why can't a Python `list` be a dictionary key, and what would you use instead?
4. Name one problem where a hash map is the *wrong* tool, and say why.

## My explanation

<!-- Write this yourself, in your own words. Claude never fills this section. -->

## Problems

<!-- auto:problems -->
<!-- /auto -->
````

- [ ] **Step 2: Write exercise 01 — First repeat**

`concepts/hash-map/exercises/01-first-repeat/README.md`:

```markdown
---
id: hash-map/01
title: First repeat
concept: hash-map
status: todo
hints: 0
solution_revealed: false
solved_in: []
---
# First repeat

## Statement

Scan `nums` from left to right and return the first value that already appeared earlier in the array. Return `-1` if no value repeats.

**Examples**

- `nums = [2,5,1,2,3,5,1]` → `2` (at index 3, `2` was already seen)
- `nums = [1,2,3]` → `-1`
- `nums = [7,7]` → `7`

**Constraints:** `0 <= nums.length <= 10^5` · `0 <= nums[i] <= 10^9`

## Log

- 2026-09-27 · created
```

`concepts/hash-map/exercises/01-first-repeat/cases.json`:

```json
{
  "mode": "function",
  "entry": "firstRepeat",
  "params": [
    {"name":"nums","type":"int[]"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[[2,5,1,2,3,5,1]],"expected":2},
    {"input":[[1,2,3]],"expected":-1},
    {"input":[[7,7]],"expected":7}
  ],
  "hidden": [
    {"input":[[]],"expected":-1},
    {"input":[[5]],"expected":-1},
    {"input":[[1,2,3,4,1,2]],"expected":1},
    {"input":[[3,1,1,3]],"expected":1},
    {"input":[[0,0]],"expected":0},
    {"input":[[4,3,2,1,2,3,4]],"expected":2},
    {"input":[[1000000000,1,1000000000]],"expected":1000000000}
  ]
}
```

`concepts/hash-map/exercises/01-first-repeat/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const nums = rng.shuffle(Array.from({ length: 100_000 }, (_, i) => i * 7));
  nums.push(nums[0]);
  return [{ name: "n=1e5, only the last value repeats", input: [nums] }];
}
```

- [ ] **Step 3: Write exercise 02 — Most frequent**

`concepts/hash-map/exercises/02-most-frequent/README.md`:

```markdown
---
id: hash-map/02
title: Most frequent
concept: hash-map
status: todo
hints: 0
solution_revealed: false
solved_in: []
---
# Most frequent

## Statement

Return the value that appears most often in `nums`. If several values tie, return the smallest of them.

**Examples**

- `nums = [1,3,3,2,1,3]` → `3`
- `nums = [4,4,1,1]` → `1` (4 and 1 tie; 1 is smaller)
- `nums = [9]` → `9`

**Constraints:** `1 <= nums.length <= 10^5` · `-10^9 <= nums[i] <= 10^9`

## Log

- 2026-09-27 · created
```

`concepts/hash-map/exercises/02-most-frequent/cases.json`:

```json
{
  "mode": "function",
  "entry": "mostFrequent",
  "params": [
    {"name":"nums","type":"int[]"}
  ],
  "returns": "int",
  "compare": "exact",
  "examples": [
    {"input":[[1,3,3,2,1,3]],"expected":3},
    {"input":[[4,4,1,1]],"expected":1},
    {"input":[[9]],"expected":9}
  ],
  "hidden": [
    {"input":[[5,5,5]],"expected":5},
    {"input":[[2,1]],"expected":1},
    {"input":[[-1,-1,2,2,2,-1]],"expected":-1},
    {"input":[[0,1,0,1,0]],"expected":0},
    {"input":[[10,20,20,10,30]],"expected":10},
    {"input":[[7,-3,7,-3,0]],"expected":-3}
  ]
}
```

`concepts/hash-map/exercises/02-most-frequent/stress.ts`:

```ts
import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  return [{ name: "n=1e5 values in [0, 5e4]", input: [rng.intArray(100_000, 0, 50_000)] }];
}
```

- [ ] **Step 4: Write exercise 03 — Same letters**

`concepts/hash-map/exercises/03-same-letters/README.md`:

```markdown
---
id: hash-map/03
title: Same letters
concept: hash-map
status: todo
hints: 0
solution_revealed: false
solved_in: []
---
# Same letters

## Statement

Return `true` if `b` uses exactly the same letters as `a`, each one the same number of times (in other words, `b` is a rearrangement of `a`), and `false` otherwise.

**Examples**

- `a = "listen", b = "silent"` → `true`
- `a = "rat", b = "car"` → `false`
- `a = "aab", b = "abb"` → `false`

**Constraints:** `0 <= a.length, b.length <= 5 * 10^4` · lowercase English letters

## Log

- 2026-09-27 · created
```

`concepts/hash-map/exercises/03-same-letters/cases.json`:

```json
{
  "mode": "function",
  "entry": "sameLetters",
  "params": [
    {"name":"a","type":"string"},
    {"name":"b","type":"string"}
  ],
  "returns": "bool",
  "compare": "exact",
  "examples": [
    {"input":["listen","silent"],"expected":true},
    {"input":["rat","car"],"expected":false},
    {"input":["aab","abb"],"expected":false}
  ],
  "hidden": [
    {"input":["",""],"expected":true},
    {"input":["a","a"],"expected":true},
    {"input":["a","b"],"expected":false},
    {"input":["ab","a"],"expected":false},
    {"input":["aabbcc","cbacba"],"expected":true},
    {"input":["abc","abcc"],"expected":false},
    {"input":["zzzz","zzzz"],"expected":true}
  ]
}
```

If today is not 2026-09-27, replace the `created` date in the three exercise READMEs with `date +%F`.

- [ ] **Step 5: Sync and validate**

```bash
pnpm sync
pnpm check
```

Expected:
- `lc-0001-two-sum/README.md` now links `[Hash map](../../concepts/hash-map/README.md) · learning`.
- The concept page lists the three exercises (`○`) and the problem `lc-0001`.
- `concepts/INDEX.md` shows `1. [Hash map](hash-map/README.md) · learning`.
- `pnpm check` reports `0 error(s)`, and `"hash-map"` is no longer among the missing-concept warnings.

- [ ] **Step 6: Run the full verification**

Run: `pnpm verify`
Expected: every vitest suite passes (schema, executor-py, executor-ts, compare, stress, resolver, stubs, run, reporter, cli, watcher, fill-expected, sync, check, leetcode, claude-layer, hooks), then `0 error(s)` from `check`.

- [ ] **Step 7: Confirm that no stubs or references leaked into the repo**

```bash
git status --short
ls concepts/hash-map/exercises/*/solution.* 2>/dev/null || echo "no exercise solutions (expected)"
git ls-files | grep -E '(^|/)ref\.(py|ts)$' || echo "no reference files (expected)"
```

Expected: only the new `concepts/` files and the regenerated indexes/READMEs are pending, plus both "expected" messages.

- [ ] **Step 8: Commit**

```bash
git add concepts INDEX.md problems
git commit -m "feat(concepts): add hash-map concept with three exercises"
```

---

## Manual acceptance (the user, after execution)

Start a **fresh** Claude Code session from `algorithms/`, so the new `CLAUDE.md`, skills and hooks load. Then check each point:

1. **Paste the Contains Duplicate statement** (LeetCode 217). A folder `problems/lc-0217-contains-duplicate/` appears, `pnpm check` passes, and the reply lists only concepts (`hash-map — learning`).
2. **Ask "dame la solución" while it is `solving`.** Claude refuses and offers a hint.
3. **Ask for three hints in a row.** You get a Socratic question, then the idea in words, then a refusal that points to the concept and to `/give-up`.
4. **Ask Claude to "fix my solution.py".** The hook blocks the edit.
5. **Solve it in O(n²) and say "ya pasa".** The review says a better complexity exists, without saying how.
6. **Type `/give-up` on some problem.** Claude asks for confirmation, explains in chat, and the problem shows as `↺` in `INDEX.md`.
7. **Say "enséñame two pointers".** Claude creates `concepts/two-pointers/` with runnable exercises. Asking to review mastery with an empty "My explanation" does not mark it `mastered`.
8. **Run `pnpm watch two-sum --open`.** VS Code opens `solution.py` without suggestions, and saving reruns the tests.
