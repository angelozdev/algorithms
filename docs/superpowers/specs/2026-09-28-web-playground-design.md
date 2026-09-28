# Web Playground — Design (Sub-project B)

- **Date:** 2026-09-28
- **Status:** Design approved in brainstorming. Not implemented.
- **Builds on:** [Sub-project A](2026-09-27-algorithms-study-system-design.md) (knowledge base, Claude layer, test engine). Every term used here (`Target`, `RunResult`, `cases.json`, "in progress", statuses) is defined there.
- **Scope:** A local web app to read problems and concepts, write solutions, and run the tests of sub-project A's engine in the browser.

## 1. Intent

**What the user asked for**

1. A local page with a code editor that has no AI and no autocomplete.
2. A ▶ Run button, with tests and console panels, for Python and TypeScript.
3. The problem statement and the concept notes rendered next to the editor, with links that navigate between them.
4. A local server that reads and writes the `solution.*` files in the repo.
5. It reuses sub-project A's engine; nothing is judged twice.
6. Use modern libraries instead of hand-written code whenever a library already solves the problem.

**Assumptions accepted by the user**

- Personal use on one machine (`127.0.0.1`), in a desktop browser. Nothing is deployed.
- Claude Code stays in the terminal for hints, `/review` and `/give-up`. The playground has no chat and no AI of any kind.
- The file on disk is the source of truth. What the user types is saved to `solution.py`/`solution.ts`, so the browser, `pnpm test` and Claude always see the same code.
- The anti-spoiler rule holds: no expected value of a hidden case ever reaches the browser.
- All code and UI text are in English.

**Success criteria (definition of done)**

1. `pnpm play` opens a home page listing every problem, concept and exercise with its status.
2. A problem can be solved end to end without VS Code: read the statement, open a concept note, write code, and see it saved to disk. Run shows the same result as `pnpm test --json`, and a green banner at the end.
3. Typing in the editor never shows a suggestion, completion or tooltip.
4. No expected value of a hidden case appears in any API response.
5. "My explanation" can be written from the concept page, and the rest of the README stays byte-identical.
6. A change made outside the browser reloads the editor, and a conflict never silently loses text.
7. `pnpm verify` and `pnpm e2e` pass.

## 2. Decisions log

| Topic | Decision |
|---|---|
| Entry point | Full app with a home page: `pnpm play` opens the home page, `pnpm play <query>` opens one target directly. |
| Save and run | Autosave after 500 ms without typing. Tests run only on ▶ Run (`⌘↵`). |
| Editor aids | "Interview mode": syntax colors, line numbers, auto-indent, bracket matching and auto-close, undo, `Tab`, and `⌘/` to comment. No autocomplete, lint, hover or tooltips. Live error checking may be added later as a CodeMirror extension. |
| Custom input | Yes: a panel that runs the user's code on their own input and shows the output, the time and the prints, never an expected value. |
| Markdown editing | Only the "My explanation" section of a concept is editable. Everything else is read-only. |
| Architecture | React single-page app and a Hono API in one Vite dev server process, on one port. |
| Editor | CodeMirror 6, which only contains the features that are imported. Monaco ships IntelliSense that would have to be switched off flag by flag. |
| Libraries | Adopt a maintained library for every solved problem (§3.4). Hand-written code is limited to what is specific to this repo. |
| Status ownership | The playground never writes frontmatter. Status, hints and `solved_in` stay with Claude's skills. |

## 3. Architecture

### 3.1 Process

```
pnpm play [query]
  └─ playground/cli.ts ── starts a Vite dev server on 127.0.0.1:4173 (next free port if taken)
       ├─ /api/*  → Hono app (playground/server/app.ts), mounted by @hono/vite-dev-server
       │             └─ calls the engine: runTarget, runCustom, listTargets, ensureSolution, scanRepo
       └─ /*      → React app (playground/web)
```

- The Vite dev server is the runtime; there is no production build. The first start pre-bundles dependencies, and later starts reuse Vite's cache.
- The server needs to exist because a web page cannot run the real Python and TypeScript harnesses and should not receive `cases.json` (hidden answers). The engine stays in Node exactly as in sub-project A.
- The content root is `contentRoot()`, so `ALGO_ROOT` and `ALGO_PYTHON` work as in sub-project A.

### 3.2 CLI

```
pnpm play                 → opens http://127.0.0.1:4173/
pnpm play two-sum         → opens http://127.0.0.1:4173/p/lc-0001
pnpm play hash-map/01     → opens http://127.0.0.1:4173/e/hash-map/01
pnpm play --no-open       → starts without opening a browser (used by the end-to-end tests)
```

- The query resolves with `resolveQuery` (exact id → LeetCode number → substring). An ambiguous or unknown query prints the message and the candidates, then exits with code 1, before any server starts.
- Vite opens the browser (`server.open` with the route) and picks the next free port (`strictPort: false`).
- It prints `Playground: <url>  (Ctrl+C to stop)`.
- `pnpm watch` keeps working, and both can run at the same time.

### 3.3 Layout

```
playground/
├── cli.ts                    pnpm play [query] [--no-open]
├── vite.config.ts            React, Tailwind and @hono/vite-dev-server (only /api/* goes to Hono)
├── tsconfig.json             DOM + JSX + bundler resolution for web/; server/ follows the root config
├── server/
│   ├── app.ts                Hono routes; exports `type AppType` for the typed client
│   ├── guard.ts              Host allowlist + hono/csrf
│   ├── targets.ts            id → Target (exact match only), home data, target data
│   ├── solutions.ts          read/write solution files with content versions
│   ├── explanation.ts        read/replace the "My explanation" section (mdast)
│   └── events.ts             chokidar → Server-Sent Events
├── web/
│   ├── index.html · main.tsx · router.tsx
│   ├── api.ts                hono/client instance + TanStack Query hooks
│   ├── links.ts              routeForLink(readmePath, href)
│   ├── routes/               home, problem/exercise work view, concept page, 404
│   └── components/           Editor, Markdown, TestsPanel, CustomInputPanel, ConsolePanel, ui/ (shadcn)
├── tests/                    vitest: server/ (node) and web/ (jsdom)
└── e2e/                      Playwright specs + fixture setup
```

**Engine changes (`runner/`, `lib/`)**

| Change | Why |
|---|---|
| New `runner/src/custom.ts`: `runCustom(target, lang, input, options?)` → `CustomResult` | Custom input runs the harness on one input without judging it (§6.3). |
| `formatInput`/`formatOutput` move from `reporter.ts` to a new Node-free `runner/src/format.ts`, with an optional `max` length. `reporter.ts` imports them | The web app formats values exactly like the terminal. `reporter.ts` imports `node:util`, which a browser bundle cannot load. |
| New `isInProgress(entry)` in `lib/repo.ts` | The home page uses the same "in progress" rule as the reminder hook. The hook keeps its own plain-JS copy because hooks are `.mjs` files without TypeScript. |
| The root `tsconfig.json` excludes `playground/web` | The web code compiles with its own DOM/JSX config. |

Everything else in the engine is used as it is: `runTarget`, `listTargets`, `resolveQuery`, `ensureSolution`, `solutionPath`, `loadCaseFile`, `assertHiddenFilled`, `inputIssues`, `truncateLines`, `scanRepo` and `parseMarkdown`.

### 3.4 Libraries

| Need | Library |
|---|---|
| UI | `react`, `react-dom` |
| Build and dev server | `vite`, `@vitejs/plugin-react` |
| API inside Vite | `hono`, `@hono/vite-dev-server`, `@hono/zod-validator` (with the existing `zod`) |
| Typed API client | `hono/client` |
| Rejecting cross-site requests | `hono/csrf` |
| Server-Sent Events | `streamSSE` from `hono/streaming`, and the browser's `EventSource` |
| Routes | `@tanstack/react-router` |
| Server state, and running one Run at a time | `@tanstack/react-query` (`useMutation({ scope: { id } })` runs mutations in order) |
| Editor | `@uiw/react-codemirror` with `basicSetup={{ autocompletion: false, completionKeymap: false, lintKeymap: false, foldGutter: false }}` (every other basic-setup feature stays on), `@codemirror/lang-python`, `@codemirror/lang-javascript`, `@codemirror/lang-markdown`, `@uiw/codemirror-theme-github` |
| Markdown rendering | `react-markdown`, `remark-gfm` (tables), `@shikijs/rehype` (code colors, through `rehypeShikiFromHighlighter` with one highlighter created at startup, because `react-markdown` runs plugins synchronously) |
| Replacing a Markdown section safely | `mdast-util-from-markdown` |
| Resizable panes that remember their size | `react-resizable-panels` (`autoSaveId`) |
| Waiting 500 ms before saving | `use-debounce` (TanStack Pacer was not chosen because it is still 0.x) |
| Notifications | `sonner` |
| Styling and UI primitives | `tailwindcss` 4 + `@tailwindcss/vite`, shadcn/ui components (Radix) copied into `web/components/ui/` |
| File watching | `chokidar` (already a dependency) |
| Tests | `@testing-library/react`, `jsdom`, `@playwright/test` |

Hand-written code is limited to `routeForLink`, the content-version check, `runCustom`, the Host allowlist, and glue code.

## 4. User interface

### 4.1 Home (`/`)

```
┌ Algorithms ──────────────────────── [ search… ]   16/19 solved ┐
│ In progress                                                    │
│   ⏳ lc-0026 Remove Duplicates from Sorted Array · easy        │
│   ⏳ hash-map/02 Most frequent                                  │
│ Problems                                                       │
│   Arrays & hashing                                             │
│     ✅ lc-0001 Two Sum · easy                                  │
│     ○  lc-0217 Contains Duplicate · easy                       │
│   Two pointers …                                               │
│ Concepts                                                       │
│   Hash map · learning · 1/3 exercises                          │
│   Two pointers · new · 0/2 exercises                           │
└────────────────────────────────────────────────────────────────┘
○ todo   ⏳ in progress   ✅ solved   👁 revealed
```

- **In progress** lists problems and exercises for which `isInProgress` is true.
- **Problems** are grouped by pattern, in the same order and with the same rules as `INDEX.md`.
- **Concepts** show their status and how many exercises are solved. Clicking a concept opens `/c/<slug>`.
- The search box filters the lists by id or title, in the browser.
- An entry with a broken README shows ⚠ and the parse error. The rest of the page still works.

### 4.2 Work view (`/p/<id>` and `/e/<concept>/<NN>`)

```
┌ ← Home  lc-0001 Two Sum · easy · solving · hints 1 ↗   [py|ts]  ✓ saved  [▶ Run ⌘↵] ┐
├─────────────────────────┬─────────────────────────────────────────────────────────┤
│ Statement › Hash map  ← │  1 class Solution:                                      │
│ (rendered README)       │  2     def twoSum(self, nums, target):                  │
│                         │  3         seen = {}                                    │
│ Concepts                │                                                         │
│  • Hash map →           ├─────────────────────────────────────────────────────────┤
│                         │ [Tests 2/3] [Custom input] [Console]                    │
│                         │ ✅ Example 1   0.2 ms                                   │
│                         │ ❌ Example 2   nums=[3,2,4], target=6                   │
│                         │                expected [1,2]   got [0,0]               │
│                         │ ⏸  Hidden · skipped until the examples pass            │
│                         │ ⏸  Stress · skipped                                    │
└─────────────────────────┴─────────────────────────────────────────────────────────┘
```

**Header**
- Id, title, difficulty (for problems), status, hint count, and ↗ to the original URL (for problems).
- The `py | ts` switch, the save indicator (`✓ saved` · `saving…` · `✕ not saved`), and ▶ Run.

**Left pane**
- Shows the README body rendered, without the frontmatter.
- A link to a concept opens the concept note **in the same pane**, with a breadcrumb (`Statement › Hash map ←`). The editor is not affected.
- A link to another problem or exercise navigates to its page, saving any pending change first.

**Tests tab** (same content as the terminal reporter)
- **Examples:** one row per case, with its status and time. A case that did not pass shows the input, the expected value, the user's output, and the error with its trace.
- **Hidden:** `passed/total`. When a case fails, it shows the first failure: its input and the user's output or error. **Never an expected value**, because `RunResult` does not carry one.
- **Stress:** one row per case, for example `83 ms / 2000 ms ✅`, `2400 ms / 2000 ms 🐢 slow` or `timeout`.
- **Fatal error** (syntax, import, missing entry): a red box with the kind, the message and the trace.
- **While running:** `Running… 1.2 s`, with the previous results dimmed.
- **Green:** `✅ Green in py. Ask Claude for /review in the terminal to mark it solved.`
- **Stale:** when `cases.json` or `stress.ts` changed after the last run, the result shows `cases changed — run again`.

**Custom input tab**
- One JSON field per parameter (`nums`, `target`), filled with the input of Example 1. For class problems, the fields are `ops` and `args`.
- The fields are remembered per target in `localStorage`, and `Reset` restores Example 1.
- Invalid JSON is shown under its field, and nothing is sent. A value that does not match the signature returns the issues from `inputIssues`.
- `⇧⌘↵` runs it. It shows the output (formatted by `formatOutput`; in-place problems show the returned value and the modified array), the time, the prints, and the error with its trace.

**Console tab**
- The prints of the last Run, grouped by case (`Example 1 ▸ …`, `Hidden · first failure ▸ …`).
- Prints are cut to 20 lines per case, as the engine already does.

**Keyboard**

| Keys | Action |
|---|---|
| `⌘↵` / `Ctrl+↵` | Run |
| `⇧⌘↵` / `Shift+Ctrl+↵` | Run custom input |
| `⌘S` / `Ctrl+S` | Save now (and do not open the browser's "save page" dialog) |

**Language on open**
- If exactly one solution file exists, open that language.
- Otherwise, use the last language used (`localStorage`), and if there is none, `py`.
- Switching language loads that file, and creates its stub if it is missing.

### 4.3 Editor

- **Included:** line numbers, syntax colors, active-line highlight, auto-indent (4 spaces in Python, 2 in TypeScript), bracket matching, auto-closing brackets and quotes, undo/redo, `Tab`/`Shift+Tab`, `⌘/` to toggle comments, and `⌘F` to search.
- **Excluded:** autocompletion and its keymap, lint, hover tooltips, and signature help.
- **Browser aids off:** the editable area has `spellcheck="false"`, `autocorrect="off"`, `autocapitalize="off"` and `writingsuggestions="false"`, so the browser adds nothing either.
- **Theme:** light or dark, following the operating system. Pane sizes are remembered.

### 4.4 Concept page (`/c/<slug>`)

- The concept note rendered with colored code blocks. Its generated sections already list the exercises with their status and the problems that use the concept, and their links become `/e/…` and `/p/…` routes (§4.5).
- **My explanation** shows the user's text and a `✎ Edit` button.
  - Edit opens the same editor in Markdown mode, with the same restrictions, plus a preview rendered by the same Markdown component.
  - Saving is explicit (`Save` / `Cancel`), with no autosave, because this is prose the user should review.

### 4.5 Links inside Markdown

`routeForLink(readmePath, href)` resolves a relative link against the README's folder, then maps it:

| Resolved path | Route |
|---|---|
| `problems/<folder>/README.md` | `/p/<id>` (`problemIdFromFolder`) |
| `concepts/<slug>/README.md` | `/c/<slug>` |
| `concepts/<slug>/exercises/<folder>/README.md` | `/e/<slug>/<NN>` |
| `INDEX.md`, `concepts/INDEX.md` | `/` |
| `http(s)://…` | an external link that opens in a new tab |
| anything else (for example `solution.py`) | plain text, not a link |

Internal links render as TanStack Router `<Link>`s, so navigation happens inside the app.

## 5. API

All routes live under `/api`. Every request body is JSON and is validated with zod (`@hono/zod-validator`). Ids go in the query string or the body, because exercise ids contain `/`. The server resolves an id by **exact** match against `listTargets` and answers `404` for anything else. It never accepts a file path.

| Method | Route | Request | Response |
|---|---|---|---|
| GET | `/home` | — | `HomeData` |
| GET | `/target` | `?id=` | `TargetData` |
| GET | `/solution` | `?id=&lang=` | `SolutionData`. Creates the stub (`ensureSolution`) if the file is missing, and answers `422` when `cases.json` is invalid and no file exists |
| PUT | `/solution` | `{ id, lang, code, baseVersion }` | `200 { version }`, or `409 SolutionData` (what is on disk) |
| POST | `/run` | `{ id, lang }` | `RunResult` (from `runTarget`), or `422 { error }` for a case-file error |
| POST | `/run-custom` | `{ id, lang, input }` | `CustomResult`, or `422 { error, issues? }` |
| GET | `/concept` | `?slug=` | `ConceptData` |
| PUT | `/concept/explanation` | `{ slug, text, baseVersion }` | `200 { version }`, `409 ConceptData`, or `422 { error }` |
| GET | `/events` | — | `text/event-stream` of `RepoEvent` |

```ts
type ItemStatus = "todo" | "solving" | "solved" | "revealed";

interface HomeData {
  problems: { id: string; title: string; difficulty: string; patterns: string[]; status: ItemStatus; inProgress: boolean; error: string | null }[];
  concepts: {
    slug: string; title: string; status: "new" | "learning" | "mastered"; error: string | null;
    exercises: { id: string; title: string; status: ItemStatus; inProgress: boolean }[];
  }[];
}

interface TargetData {
  id: string; kind: "problem" | "exercise"; title: string;
  readme: string;                 // repo-relative README path, for routeForLink
  markdown: string;               // README body without the frontmatter
  difficulty: string | null; url: string | null; status: ItemStatus; hints: number;
  signature: { mode: "function" | "class"; entry: string; params: Param[]; returns: string | null } | null;
  exampleInput: unknown | null;   // input of Example 1, to fill the custom input
  caseError: string | null;       // invalid cases.json, or hidden cases without expected values
  readmeError: string | null;     // README missing or its frontmatter unparsable; markdown is "" then
  solutions: { py: boolean; ts: boolean };
}

interface SolutionData { code: string; version: string }

interface CustomResult {
  fatal: HarnessError | null;     // the solution did not load
  output?: unknown; error?: HarnessError; ms?: number;
  stdout: string;                 // cut to 20 lines
}

interface ConceptData {
  slug: string; title: string; status: "new" | "learning" | "mastered";
  readme: string; markdown: string;
  explanation: string;            // "My explanation" without HTML comments
  version: string;                // version of the whole README
}

type RepoEvent =
  | { kind: "solution"; target: string; lang: Lang; version: string }
  | { kind: "readme"; target?: string; concept?: string }
  | { kind: "cases" | "stress"; target: string };
```

- `version` is a SHA-256 hash of the file content (hex, first 16 characters).
- In `TargetData`, `caseError` disables ▶ Run, but not the custom input, which does not need the hidden cases. When `signature` is `null` (invalid `cases.json`), both are disabled.

## 6. Data flow

### 6.1 Autosave and versions

```
typing → 500 ms pause → PUT /solution { code, baseVersion }
  server: read the file; is its version still baseVersion?
     yes → write, answer the new version                  ✓ saved
     no  → 409 with the content on disk                   ⚠ conflict banner
```

- The read, the comparison and the write happen synchronously in one request handler, so two saves cannot interleave.
- A pending save is sent right away on `⌘S`, on ▶ Run, on route change, and on `pagehide` (using `fetch` with `keepalive`).
- **Conflict banner:** `solution.py changed on disk.` It offers `[Use disk version]`, which replaces the buffer, and `[Keep mine]`, which saves again with the disk version as `baseVersion`. Text is never lost silently.

### 6.2 Run

```
⌘↵ → wait for the pending save → POST /run { id, lang } → runTarget() → RunResult → Tests + Console
```

- The Run mutation uses `scope: { id: "<id>:<lang>" }`, so a second Run waits for the first. The button is disabled while running.
- The server does not queue runs.

### 6.3 Custom input

`runCustom(target, lang, input, { wallMs = 5000 })`:

1. Load `cases.json` (a `CaseFileError` → `422`).
2. Check the input with `inputIssues(signature, input, "input")` (issues → `422` with the list).
3. `ensureSolution`.
4. Run the harness with one case and `discardOutput: false`.
5. Return `CustomResult`, with prints cut by `truncateLines`.

No expected value is involved, so nothing is judged.

### 6.4 Live events

- One chokidar watcher on `<root>/problems` and `<root>/concepts`, ignoring `__pycache__`, `node_modules` and dotfiles, turns file changes into `RepoEvent`s.
- `/events` streams them with `streamSSE`, sending a comment every 25 s to keep the connection open.
- **What the client does with each event:**

| Event | Client reaction |
|---|---|
| `readme` | Invalidates `home` and that target's or concept's query. The badges update live, for example after Claude's `/review` marks a problem solved. |
| `cases` / `stress` | Invalidates the target and marks the last result as stale. |
| `solution` with a version the editor already has | Ignored. It is the editor's own save. |
| `solution` with a new version, and no pending local edits | The editor loads the file and shows `Reloaded from disk`. |
| `solution` with a new version, and pending local edits | The next save gets a `409`, and the conflict banner appears. |

- When the `EventSource` connection fails, the page shows `Disconnected — run pnpm play again`, and the save indicator shows `✕ not saved`. Edits stay in memory. When the connection comes back, pending saves are sent, still protected by the version check.

### 6.5 Markdown

- The server sends the README body without the frontmatter, plus the README path.
- The browser renders it with `react-markdown` and `remark-gfm`, with `skipHtml` on, so raw HTML and the `<!-- auto -->` comments are dropped. `@shikijs/rehype` colors the code blocks (Python, TypeScript, JavaScript and plain text), and `routeForLink` turns links into routes (§4.5).
- The statement, the concept notes and the "My explanation" preview all use the same component.

### 6.6 "My explanation"

- **Read:**
  - The body is split from its frontmatter with `parseMarkdown` and parsed with `mdast-util-from-markdown`.
  - The section starts at the depth-2 heading `My explanation` and ends at the next heading of depth ≤ 2, or at the end of the file.
  - Its text is returned without its HTML comment nodes.
- **Write** (`PUT /concept/explanation`):
  1. Compare the README version with `baseVersion` (a mismatch → `409`).
  2. Parse the new text. Reject it with `422` if it contains a heading of depth ≤ 2, or an `<!-- auto:` / `<!-- /auto -->` marker.
  3. Rebuild the section as: the heading, the section's leading HTML comments unchanged (for example `<!-- Write this yourself… -->`), then the new text, trimmed.
  4. Keep every byte outside the section (frontmatter, other sections, auto blocks), and write the file.
- An empty text is allowed; it leaves only the comments. A README without the section answers `422` with `run pnpm check`.
- Headings inside code blocks are ignored, because the parser reads the real Markdown structure.

## 7. Security

The server runs code and writes files, so other origins must not reach it.

| Risk | Protection |
|---|---|
| Another machine on the network | Vite listens on `127.0.0.1` only. |
| A page in another tab sends `POST 127.0.0.1:4173/api/run` | `hono/csrf` rejects foreign `Origin`s on unsafe methods, the JSON validator rejects other content types, and no CORS headers are sent, so other pages cannot read responses. |
| DNS rebinding (`evil.com` resolving to `127.0.0.1`) | The first Hono middleware accepts only `Host: 127.0.0.1:<port>` and `localhost:<port>`, and answers `403` to anything else. It does not rely on Vite's own host check covering middleware routes. |
| A crafted id or slug (`../../x`) | Ids and slugs are matched exactly against the scanned repo (`404` otherwise). The API never takes a path. The only writes are `solution.{py,ts}` of a known target and the "My explanation" section of a known concept. |
| Spoilers | `cases.json` and `stress.ts` are never served. `RunResult` has no hidden expected values, and `CustomResult` has none at all. |
| Claude writing a solution through the API (`curl -X PUT …/api/solution`) | The Bash guard (`.claude/hooks/guard-solution.mjs`) also denies `curl`, `wget`, `http` and `xh` commands that mention `/api/solution` or `/api/concept/explanation`. As in sub-project A, the guard is best effort. |

The user's code runs with the user's permissions, as it does with `pnpm test`. There is no sandbox.

## 8. Error handling

| Situation | What the user sees |
|---|---|
| Invalid `cases.json` | A banner in Tests with the engine's message. Run and Custom input are disabled; the editor keeps working. |
| Hidden cases without expected values | A banner in Tests (`run pnpm fill-expected`). Run is disabled; Custom input works. |
| Syntax or import error, or a missing entry | A red fatal box with the kind, message and trace. |
| A case over the time limit, or a stuck stress generator | The case shows `timeout`, or the stress section shows the generator's error. |
| Invalid custom input | An error under the field, or the list of `inputIssues`. |
| `pnpm play` stopped | The `Disconnected` banner, `✕ not saved`, and edits kept in memory (§6.4). |
| A save that fails for another reason | `✕ not saved` and a notification with the message. The next edit or `⌘S` retries. |
| A broken README frontmatter | The home page marks the item with ⚠. The target page shows the parse error instead of the statement. |
| Unknown id, slug or route | A 404 page with a link to the home page. |
| An unexpected server error | `500 { error }`, a notification with the message, and the stack trace in the `pnpm play` terminal. |

## 9. Changes to the Claude layer and docs

- **`README.md`:** a "Web playground" section (`pnpm play`, `pnpm e2e`, and the one-time `pnpm exec playwright install chromium`) and the new rows in the commands table.
- **`CLAUDE.md`:** list `pnpm play [query]` under the user's commands (Claude does not start it). State that the playground writes the same `solution.*` files and never writes frontmatter.
- **`problem` and `concept` skills:** their closing message offers `pnpm play <id>` next to `pnpm watch <id> --open`.
- **`guard-solution.mjs`:** add the API rule from §7, with tests in `scripts/tests/hooks.test.ts`.
- **`.gitignore`:** add `test-results/`, `playwright-report/` and `playground/e2e/.tmp/`.

## 10. Testing

Tests go through public interfaces: module entry points, HTTP routes, rendered components and the running app.

**Engine** (`runner/tests/custom.test.ts`, Python and TypeScript)
- `runCustom` returns the output and the prints.
- In-place problems return the returned value and the modified parameter; class mode works with `ops`/`args`.
- An exception gives an error with a trace, and an infinite loop gives a timeout.
- An input that does not match the signature is rejected before the harness starts.
- `format.ts` is tested through the existing reporter tests, plus the `max` option.

**API** (`playground/tests/server/*.test.ts`)
- Every test calls `app.request(…)` against a temporary repo built with the existing fixture helpers; no port is opened.
- `/home` returns the statuses and "in progress" as defined in sub-project A.
- `/solution`:
  - `GET` creates the stub;
  - `PUT` writes the file;
  - `PUT` with an old `baseVersion` answers `409` with the content on disk.
- `/run` returns the same `RunResult` as `runTarget`. `/run-custom` returns a `CustomResult`.
- **Anti-spoiler:** a hidden case whose expected value is the sentinel `"SECRET-4242"`. The test calls every route, including a failing run and a custom run, and checks that the sentinel appears in no response.
- **"My explanation":**
  - saving changes only the section, and the rest of the file is byte-identical;
  - leading comments are kept;
  - a `## ` inside a code block is kept;
  - a real depth-2 heading gives `422`, and an old `baseVersion` gives `409`.
- **Security:**
  - `Host: evil.com` gives `403`, and `Origin: http://evil.com` on a `PUT` gives `403`;
  - `id=../../x` gives `404`, and a non-JSON body is rejected.
- **`/events`:** writing a README and a `solution.py` in the temporary repo emits the matching events.

**Client logic** (`playground/tests/web/links.test.ts`)
- `routeForLink` is tested with a table of links: problem, concept, exercise, `INDEX.md`, external, and a file that is not a README, starting from different README folders.

**Components** (`playground/tests/web/*.test.tsx`, Testing Library + jsdom)
- The Tests panel is rendered from `RunResult` fixtures: fatal, example failure, hidden failure (checking that no expected value is shown), slow stress, stale, and green with the `/review` banner.
- The Custom input panel: invalid JSON, prefill from Example 1, and reset.

**End to end** (`playground/e2e/*.spec.ts`, Playwright with Chromium)
- Playwright starts `tsx playground/cli.ts --no-open` on a temporary repo (`ALGO_ROOT`), on its own port. The temporary repo lives inside the project (`playground/e2e/.tmp/`), as the runner tests do, so the `lc` path alias applies to TypeScript solutions.
- Home → problem → type a correct solution → `⌘↵` → green banner.
- Autosave reaches the file on disk.
- **No autocomplete:** type `nums.` and wait 1 s. No `.cm-tooltip` element appears, and the editable area has `spellcheck="false"` and `writingsuggestions="false"`.
- Changing `solution.py` on disk reloads the editor.
- A concept link opens in the left pane. Saving "My explanation" writes the README.

**Commands**
- `pnpm verify` = `vitest run` (engine, scripts, server and web projects) + `tsc -p playground --noEmit` + `pnpm check`. The type check catches wrong uses of the typed Hono client.
- `pnpm e2e` = `playwright test`. It is separate because it takes about 30 s and needs the browser.
- The vitest config switches to `projects`: `node` (runner, scripts, server tests) and `web` (jsdom).

**Manual acceptance**
1. Solve a real problem end to end in Chrome without opening VS Code.
2. Check the dark theme.
3. With `pnpm play` running, ask Claude for `/review` and watch the status badge update.

## 11. Out of scope

- Live error checking in the editor (the "errors while typing" option). It can be added later with `@codemirror/lint`.
- Vim or Emacs key bindings.
- Editing any Markdown other than "My explanation", and writing frontmatter or statuses from the playground.
- A production build, remote access, several users, and a mobile layout.
- Languages other than Python and TypeScript.
- Any AI or chat in the browser.
