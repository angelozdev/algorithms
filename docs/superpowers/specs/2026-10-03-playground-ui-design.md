# Playground UI — Design

- **Date:** 2026-10-03
- **Status:** Design approved in brainstorming. Not implemented.
- **Builds on:** [Web Playground](2026-09-28-web-playground-design.md) (sub-project B). Routes, API, data flow, security and the anti-spoiler rules defined there stay as they are, except where §8 says otherwise.
- **Scope:** A visual redesign of the playground with the full shadcn/ui setup. The home list also learns to group, sort and filter. No change to how solutions are saved, run or judged.

## 1. Intent

**What the user asked for**

1. Adopt shadcn/ui fully, with the official components, lucide icons and theme tokens, instead of hand-written look-alikes.
2. Make the playground look more polished while it is used the same way: icons instead of emojis, better typography and spacing, tooltips with shortcuts, and a theme with an accent color.
3. Polish the work view: a compact header with a breadcrumb, test results as chips per case, and empty states that show the shortcuts.
4. On the home page, group, filter or sort problems by category (pattern), concept, difficulty, pending status and LeetCode number.
5. Use modern libraries instead of hand-written code whenever a library already solves the problem.

**Explicitly not wanted:** a ⌘K command palette and a sidebar.

**Assumptions accepted by the user**

- Dark mode keeps following the operating system. There is no manual theme switch.
- Fonts are self-hosted, so the playground keeps working offline.
- The logic for autosave, conflicts, the unsaved-text guard and reconnection is not rewritten. Only its presentation changes.

**Success looks like**

- Every screen uses the tokens and components below, and no emoji remains in the UI.
- From the home page, the user can answer "what is pending?", "what have I done on two pointers?" and "show me problem 35" in one or two clicks, and the view survives a reload.
- In the work view, a failing run shows at a glance which cases failed and how expected and got differ.
- All existing behavior tests still pass. Only selectors that matched emojis change.

## 2. Decisions log

| Question | Decision |
|---|---|
| UI library | shadcn/ui, full setup: CLI, `components.json`, official components |
| Goals | Polish the whole UI and the work view. No palette and no sidebar. |
| Visual direction | "Compact editor": slate greys, blue accent, IBM Plex Sans + JetBrains Mono, 6 px radius, dense. Dark mode uses the GitHub Dark colors, the same as the editor and code blocks. |
| Work view layout | A header with the breadcrumb and Run. A VS Code-like status bar with connection, language, save state and shortcuts. Chips summarize the results, and a table shows the failures. |
| Home list | One compact grouped table (Linear-like). "Group by" splits it into collapsible sections, column headers sort within each section, and faceted filters narrow it. |
| Approach | shadcn through its CLI, then the redesign screen by screen. The existing behavior tests are the safety net. Rejected: copying shadcn by hand (drifts from upstream), and rewriting the web layer from a template (risks tested logic). |

## 3. Foundations

### 3.1 shadcn setup

- **Running the CLI:** `shadcn init` runs non-interactively from the repo root with flags, and writes `components.json` there.
  - Its Tailwind CSS entry is `playground/web/styles.css`.
  - Components go to `playground/web/components/ui/`.
  - The `utils` alias points at the existing `playground/web/lib/cn.ts`, so `cn` is not duplicated.
- **Style:** the style is chosen when planning, by probe. The requirements are Radix primitives through the `radix-ui` package (already a dependency) and the tokens in §3.2, whatever the style ships.
- **Import alias:** `@/` maps to `playground/web/`. It goes in `playground/tsconfig.json` (`paths`, no `baseUrl`, since TS 7 rejects it), in Vite and in Vitest, because the generated components import through it. Existing relative imports may stay.
- **Official components added:** `button`, `badge`, `tabs`, `tooltip`, `table`, `select`, `toggle-group`, `collapsible`, `breadcrumb`, `kbd`, `input`, `textarea`, `alert`, `skeleton`, `progress`, `sonner`, `popover`, `command`, `checkbox` and `separator`. The last four are what shadcn's faceted filter is built from.
- The three hand-written components (`button`, `badge`, `tabs`) are replaced by the official ones. Their call sites are adapted.
- A component may be edited after `shadcn add`, as shadcn intends, but only to add variants such as a `success` badge, never to fork its behavior.

### 3.2 Theme tokens

The tokens are CSS variables with shadcn's names, set in `styles.css` and exposed to Tailwind through `@theme inline`. Two tokens are added: `--success` and `--warning`, each with a foreground.

| Token | Light | Dark (GitHub Dark) |
|---|---|---|
| `--background` | `#f8fafc` | `#0d1117` |
| `--foreground` | `#0f172a` | `#e6edf3` |
| `--card`, `--popover` | `#ffffff` | `#161b22` |
| `--card-foreground`, `--popover-foreground` | `#0f172a` | `#e6edf3` |
| `--primary` | `#2563eb` | `#58a6ff` |
| `--primary-foreground` | `#ffffff` | `#0d1117` |
| `--secondary`, `--muted` | `#f1f5f9` | `#21262d` |
| `--secondary-foreground` | `#0f172a` | `#e6edf3` |
| `--muted-foreground` | `#64748b` | `#8b949e` |
| `--accent` (hover surfaces) | `#f1f5f9` | `#1f2630` |
| `--accent-foreground` | `#0f172a` | `#e6edf3` |
| `--destructive` | `#dc2626` | `#f85149` |
| `--success` | `#16a34a` | `#3fb950` |
| `--warning` | `#d97706` | `#d29922` |
| `--border`, `--input` | `#e2e8f0` | `#30363d` |
| `--ring` | `#2563eb` | `#58a6ff` |
| `--radius` | `0.375rem` | `0.375rem` |

- **Dark mode follows the system.** The dark values live under `@media (prefers-color-scheme: dark)`.
  - Tailwind's `dark:` variant stays media-based. If the CLI adds a `.dark` class variant, it is replaced, so the generated components' `dark:` classes still apply.
  - `usePrefersDark` (`lib/theme.ts`) keeps choosing the CodeMirror theme.
  - Sonner's `Toaster` uses `theme="system"`.
- CodeMirror (`@uiw/codemirror-theme-github`) and Shiki already use the GitHub themes, so they need no color change.

### 3.3 Typography

- IBM Plex Sans for the interface and JetBrains Mono for ids, numbers, code, values and `kbd`. Both are self-hosted with Fontsource packages (`@fontsource-variable/*` where a variable build exists, otherwise `@fontsource/*` with weights 400, 500 and 600). No request goes to a font CDN.
- The editor uses JetBrains Mono.
- The base size is 13 px in the work view and the tables, and 14 px for statement and concept prose.
- Markdown (statement, concept notes, "My explanation") is styled with `@tailwindcss/typography` (`prose prose-sm`, with `dark:prose-invert` mapped to our tokens), replacing hand-written Markdown styles.

### 3.4 Icons

`lucide-react` replaces every emoji. Each status icon has an accessible name (`aria-label` or visually hidden text) equal to its status word. Tests and screen readers never depend on the drawing.

| Meaning | Before | Icon | Color |
|---|---|---|---|
| To do | ○ | `Circle` | muted |
| In progress | ⏳ | `Clock` | warning |
| Solved / test passed | ✅ | `CircleCheck` | success |
| Revealed | 👁 | `Eye` | muted |
| Failed | ❌ | `CircleX` | destructive |
| Skipped | ⏸ | `CirclePause` | muted |
| Too slow | 🐢 | `Snail` | warning |
| Timeout | ⏱ | `Timer` | destructive |
| Broken file / warning | ⚠ | `TriangleAlert` | warning |
| Run | ▶ | `Play` | — |

### 3.5 Shortcuts display

- Shortcuts are shown with the `kbd` component.
- The modifier is rendered as `⌘` on Apple platforms and as `Ctrl` elsewhere, by one helper.
- The shortcuts themselves do not change: Mod-Enter runs the tests, Shift-Mod-Enter runs the custom input, Mod-S saves.

## 4. Home (`/`)

```
┌ ▣ Algorithms   [⌕ Search…]                         16/19 solved ▬▬▬▬▬▬▬▭ ┐
│ Continue                                                                   │
│ ┌ ◷ lc-0026 Easy ───────┐ ┌ ◷ lc-0035 Easy ───────┐ ┌ ◷ lc-2181 Medium ─┐ │
│ │ Remove Duplicates …   │ │ Search Insert Position│ │ Merge Nodes …     │ │
│ │ Two pointers Continue›│ │ Binary search Continue│ │ Linked list  …    │ │
│ └───────────────────────┘ └───────────────────────┘ └───────────────────┘ │
│ Problems  Group by [Status ▾]  [All|Pending|Solved]  ⊕Difficulty ⊕Pattern ⊕Concept  Reset │
│ ┌──┬──────┬──────────────────────────────┬──────────┬────────────┬───────┐ │
│ │  │ # ↑  │ Title ⇅                      │ Difficulty⇅│ Patterns │Concepts│ │
│ │ ˅ In progress 3                                                        │ │
│ │◷ │ 26   │ Remove Duplicates from Sor…  │ Easy     │ Two pointers│ …     │ │
│ │ ˅ Solved 16                                                            │ │
│ │✓ │ 1    │ Two Sum                      │ Easy     │ Arrays & h… │ hash… │ │
│ └──┴──────┴──────────────────────────────┴──────────┴────────────┴───────┘ │
│ Concepts                                                                   │
│ 📖 Hash map  Learning  0/3 exercises ▭▭▭▭                         Open ›  │
│      ○ hash-map/01 First repeat …                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Header

- The logo mark and "Algorithms".
- The search box. A problem or exercise matches when the query is a case-insensitive substring of its id (`lc-0001`), its title, or its LeetCode number as text (`35`). It filters all three sections, as today.
- The global progress, "solved/total problems", with a progress bar.

### 4.2 Continue

- **Contents:** one card per problem or exercise for which `isInProgress` is true. Each card shows:
  - the status icon, id and difficulty badge;
  - the title;
  - the first pattern's label, or the concept's title for an exercise;
  - "Continue ›".
  The whole card links to the work view.
- **Layout:** cards sit in a grid of up to three columns. The row is hidden when nothing is in progress.
- **Filters:** Continue does not react to the list's group or filters, only to the search.

### 4.3 Problems: the grouped table

The table is built from a pure list model (filter, facets, sort, group) and shadcn's `table` component. TanStack Table is not used (amendment A4, §13).

**Columns**

| Column | Content | Sortable |
|---|---|---|
| Status | Status icon (§3.4); `TriangleAlert` with the parse error in a tooltip when the README is broken | no |
| # | LeetCode number derived from the id: `lc-0001` → `1`. Other ids show the id. | yes |
| Title | Title, linking to the work view | yes |
| Difficulty | Badge: Easy (success), Medium (warning), Hard (destructive) | yes |
| Patterns | One badge per pattern label | no |
| Concepts | Concept labels, muted, `·`-separated, truncated with a tooltip | no |

**Group by:** None, Pattern (default), Concept, Difficulty or Status.

- **Multi-membership:** a problem with several patterns or concepts appears once in each of its groups, as `INDEX.md` does today. The table works on one row per (group, problem) membership. Counts and the header's progress count distinct problems.
- **Group order:**
  - **Status:** In progress, To do, Revealed, Solved.
    - "In progress" is `inProgress` true.
    - "To do" is `todo` and not in progress.
  - **Difficulty:** Easy, Medium, Hard, then "No difficulty".
  - **Pattern and concept:** alphabetical by label. "(no pattern yet)" and "(no concept yet)" come last.
- **Empty groups:** not shown.
- **Group header:** a chevron, the label and the count of problems. A concept group whose concept has a page in `concepts/` also links to `/c/<slug>`.
- **Collapsing:** groups use `collapsible`. The collapsed state lives in component state only and resets on reload.

**Sort**

- Clicking the # header, Title header or Difficulty header sorts ascending, then descending. Sorting applies within each group. The default is # ascending.
- Difficulty sorts as Easy < Medium < Hard < none.
- **Ids without a LeetCode number:** they sort after the numbered ones, by id.

**Filters**

| Filter | Control | Behavior |
|---|---|---|
| Status | Segmented control: All / Pending / Solved | Pending is every problem whose status is not `solved`. |
| Difficulty | Faceted multi-select with counts | — |
| Pattern | Faceted multi-select with counts | — |
| Concept | Faceted multi-select with counts | — |

- A "Reset" button appears when any filter or the search is set.
- **No match:** when filters leave nothing, the table shows "No problems match" with a "Clear filters" button.
- **No problems:** when the repo has no problems, the current message ("No problems yet. Paste one into Claude Code to start.") stays, with an icon.

**URL state**

The view lives in the URL search params. They are validated by a zod schema in the router (`validateSearch`), and TanStack Router's `stripSearchParams` keeps the defaults out of the URL.

| Param | Values | Default |
|---|---|---|
| `q` | string | `""` |
| `group` | `none` \| `pattern` \| `concept` \| `difficulty` \| `status` | `pattern` |
| `sort` | `num` \| `title` \| `difficulty` | `num` |
| `dir` | `asc` \| `desc` | `asc` |
| `status` | `all` \| `pending` \| `solved` | `all` |
| `difficulty` | list of `easy` \| `medium` \| `hard` | `[]` |
| `pattern` | list of pattern slugs | `[]` |
| `concept` | list of concept slugs | `[]` |

- **Invalid values:** an invalid value for a single param falls back to its default (`.catch()`), and invalid list entries are dropped.
- **Unknown slugs:** a slug that matches no problem is kept and yields "No problems match", so a stale link explains itself.
- **History:** reloading or going back restores the view. The search box updates the URL with `replace`, so typing does not flood the history.

### 4.4 Concepts

- **Concept rows:** one row per concept with:
  - the `BookOpen` icon;
  - its title, linking to `/c/<slug>`;
  - a status badge (new, learning or mastered);
  - "done/total exercises" with a small progress bar;
  - the `TriangleAlert` icon with the error when the README is broken.
- **Exercises:** listed under their concept with the same row style as the table (status icon, id, title).

### 4.5 Labels

- **Pattern labels:** a small map in the web layer covers every pattern listed in `CLAUDE.md`:

  | Slug | Label |
  |---|---|
  | `arrays-hashing` | Arrays & hashing |
  | `two-pointers` | Two pointers |
  | `sliding-window` | Sliding window |
  | `stack` | Stack |
  | `binary-search` | Binary search |
  | `linked-list` | Linked list |
  | `trees` | Trees |
  | `tries` | Tries |
  | `heap` | Heap / priority queue |
  | `backtracking` | Backtracking |
  | `graphs` | Graphs |
  | `dp-1d` | 1-D DP |
  | `dp-2d` | 2-D DP |
  | `greedy` | Greedy |
  | `intervals` | Intervals |
  | `math` | Math |
  | `bit-manipulation` | Bit manipulation |
  | `strings` | Strings |

  An unknown slug is prettified: hyphens become spaces and the first letter is capitalized.
- **Concept labels:** a concept slug uses the title of its concept page when `HomeData.concepts` has it, and is otherwise prettified the same way.

## 5. Work view (`/p/<id>` and `/e/<concept>/<NN>`)

```
┌ ▣ Algorithms › Arrays & hashing › lc-0001 Two Sum  Easy Solved  💡0 hints ↗   [py|ts] [▶ Run] ┐
│ ┌ statement (prose) ────────┐│ editor                                                      │
│ │ 1. Two Sum                ││ 1 class Solution: …                                         │
│ │ …                         │├─────────────────────────────────────────────────────────────┤
│ │                           ││ Tests 1/3 · Custom input · Console                          │
│ │                           ││ [✓1] [✗2] [✗3] [⏸ Hidden] [⏸ Stress]                        │
│ │                           ││ Case │ Input                     │ Expected │ Got          │
│ │                           ││ 2    │ nums = [3,2,4], target = 6│ [1,2]    │ [0,0]        │
│ └───────────────────────────┘│ 3    │ nums = [3,3], target = 6  │ [0,1]    │ [0,0]        │
├ ● Connected  Python · solution.py  ✓ Saved             ⌘↵ Run  ⇧⌘↵ Custom  ⌘S Save ┤
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Header (one row, about 40 px)

- **Breadcrumb** (shadcn `breadcrumb`):
  - **Problem:** "Algorithms › <first pattern label> › `<id>` <title>". "Algorithms" links to `/`. The pattern crumb links to `/?pattern=<slug>` and is left out when the problem has no pattern.
  - **Exercise:** "Algorithms › Concepts › <concept title> › `<NN>` <title>". The concept crumb links to `/c/<slug>`. "Concepts" links to `/` and is plain text.
  - The pattern list and the concept title come from the home data (`homeQuery`), which is cached and kept fresh by live events. Until it loads, the middle crumbs are left out.
- **Badges:**
  - Difficulty, colored as in §4.3.
  - Status: To do (outline), In progress (warning), Solved (primary), Revealed (muted).
- **Hints:** "N hints", with `Lightbulb`.
- **Original link:** `ExternalLink`, with the tooltip "Open the original problem". Hidden when `url` is null.
- **Language switch:** py|ts as a `toggle-group`. When it is locked (conflict, unsaved text while disconnected or failing), it is disabled, and a tooltip gives the existing lock reason.
- **Run:** the primary button with `Play` and "Run", and the tooltip "Run the tests ⌘↵". While running it shows a spinner and "Running… 1.2 s".
- The save indicator moves out of the header, into the status bar.

### 5.2 Status bar (about 24 px, bottom of the work view)

- **Left:**
  - **Connection:** a green dot with "Connected", or an amber dot with "Reconnecting…".
  - **Language and file:** "Python · solution.py".
  - **Save state:** Saved, Saving…, Not saved (destructive) or Conflict (warning). Each maps from the existing save states and connection rule, with icons instead of ✓ ✕ ⚠.
- **Right:** `⌘↵ Run · ⇧⌘↵ Custom · ⌘S Save`, using `kbd`.
- The full-width disconnection banner stays (§7), because not being able to save must be loud.

### 5.3 Notices under the header

- **Conflict:** the existing conflict message becomes an amber `Alert`, keeping "Use disk version" and "Keep mine" and their behavior.
- **Save error:** the save-error and not-saved messages become red `Alert`s.

### 5.4 Panels

- **Layout:** the layout and `react-resizable-panels` stay. Separators are 1 px lines in `--border`, and they turn `--primary` on hover or drag.
- **Statement panel:** Markdown with `prose`, and Shiki code blocks as today. When a concept link in the statement opens that concept inside the panel, the existing concept trail (← Back, and a link to the full concept page) stays above it.

### 5.5 Tests tab

- **Tab label:** "Tests" plus a count badge: "passed/total" examples, success when all pass, destructive otherwise. No badge before a run.
- **Before any run (empty state):** `FlaskConical`, then "Run the tests" with `⌘↵`, and a secondary line "Or try your own input" with `⇧⌘↵`.
- **While running:** "Running… 1.2 s" with a spinner. The previous result stays visible and dimmed, as today.

**With a result**, top to bottom:

1. **Stale cases:** a warning badge, "Cases changed — run again", when they changed after this result.
2. **Green:** a success `Alert`, "Green in <lang>. Ask Claude for `/review` in the terminal to mark it solved."
3. **Fatal error** (the solution could not load): a destructive `Alert` titled "Could not load solution.<ext>", with the error. It replaces items 4–6.
4. **Chips:**
   - One chip per example, labelled with its number, with the icon and color of its status.
   - One "Hidden" chip ("Hidden 12/15" or skipped).
   - One chip per stress case, labelled with its name.
   - Each chip has a tooltip and an accessible name such as "Example 2: failed, 0.1 ms".
   - The chip of a failing case is a button that scrolls to and briefly highlights its row in the failures table.
5. **Failures table**, with the columns Case | Input | Expected | Got:
   - **Failed example:** the formatted input, the expected value in success color, and the value it got in destructive color on a tinted cell.
   - **Timeout:** the Got cell says "timeout".
   - **Exception:** the Got cell says "error", and a full-width row below shows the error with its trace, in mono (the existing `ErrorBox`, restyled).
   - **Hidden first failure:** Case is "Hidden", and Expected shows `Lock` with "hidden". The hidden expected value still never leaves the server. Got shows the value or the error.
   - The table is omitted when nothing failed.
6. **Stress table:** Case | Time | Limit | Status, with `Snail` for too slow and `Timer` for timeout. When there are no stress cases, the line "No stress cases" replaces the table.

- **Case file error:** the existing destructive `Alert` ("Case file error — not your code…") stays above everything.
- Input and value formatting reuse `runner/src/format.ts` and `DISPLAY_MAX`, as today.

### 5.6 Custom input tab

- One mono `textarea` per parameter, labelled with the parameter name.
- The "Run custom" button shows `⇧⌘↵`.
- The result shows below as "output", plus the prints of that run.
- The parsing, validation and error behavior stay as they are.

### 5.7 Console tab

- Prints in mono.
- **Empty state:** "Nothing printed yet — print() / console.log output shows up here."

## 6. Concept page (`/c/<slug>`)

- **Header:** the same structure as §5.1.
  - The breadcrumb reads "Algorithms › Concepts › <title>".
  - The concept status badge.
  - "done/total exercises", read from the home data.
- **Content:** a centered reading column, about 768 px wide, styled with `prose`.
- **"My explanation"** is its own card.
  - **Reading:** the rendered text and an "Edit" button with `Pencil`.
  - **Editing:** the editor and a live preview side by side, with "Save ⌘S" and "Cancel".
  - The warnings about a broken README, a missing section or a conflict become `Alert`s with the existing text and behavior.
- **Status bar:** like §5.2, showing the connection, "My explanation" with its save state, and `⌘S Save`.
- **No logic change.** The fixes in commits 3f9e876 and c17363e (a fresh page per slug, and a draft that is kept when the README changes) are preserved as they are.

## 7. Shared pieces

| Piece | Design |
|---|---|
| Loading | `skeleton` rows in the shape of the content (home table, statement, editor) instead of "Loading…". |
| Not found | A centered empty state: `SearchX`, "Not found" and a "Back to Algorithms" link. |
| Load errors | A destructive `Alert` with the server's message. |
| Disconnected | A warning `Alert` pinned at the top with the existing text, plus the status bar dot. |
| Toasts | Sonner, themed by the tokens, same messages as today. |
| Tooltips | One `TooltipProvider` at the root. Tooltips never carry information that is not also in an accessible name or visible text. |
| Focus | shadcn's focus rings in `--ring`. Every existing `aria-label` and role is kept. |

## 8. Data and API changes

- `HomeProblem` gains `concepts: string[]`. It is read from the frontmatter `concepts`, and it is `[]` when the field is missing or not a list of strings.
- Nothing else in the API changes:
  - The work view and the concept page read their breadcrumb and progress from the existing home query.
  - No new endpoint.
  - No new data leaves the server; in particular, the hidden expected values still do not.

## 9. Testing

Behavior is tested through public interfaces, as in sub-project B.

**Pure units (Vitest)**

- **The home list model:**
  - rows per membership;
  - group order for each "Group by";
  - empty groups dropped;
  - sorting within groups, including ids without a number;
  - each filter, and the counts of distinct problems.
- **The search schema:**
  - defaults;
  - an invalid single value falls back to its default;
  - invalid list entries are dropped;
  - defaults are stripped from the URL.
- **Labels:** a known slug, an unknown slug prettified, and a concept title taken from the home data.
- **The LeetCode number from the id.**
- **The chip summary built from a `RunResult`:** pass, fail, timeout, error, skipped, hidden and stress.

**Components (jsdom + Testing Library)**

- **Home:**
  - changing group, sort and filter updates the URL and the rows;
  - a group collapses;
  - "No problems match" and "Clear filters";
  - a broken README shows its error.
- **Tests panel:**
  - chips and tables for each result kind;
  - a failing chip scrolls to its row;
  - the hidden row never shows an expected value (the existing sentinel test is extended);
  - the empty state shows the shortcuts.
- **Status bar:** each save state and the connection state.
- **Status icons:** each exposes its status word as an accessible name.

**Server:** `concepts` is read from the frontmatter, and a problem without it gets `[]`.

**End to end (Playwright, scratch fixture)**

- The home group, sort and filter survive a reload.
- A failing run shows the chips and the failures table.
- The status bar shows the shortcuts.
- A dark-mode smoke run with `colorScheme: "dark"`.

**Existing tests:** all 298 unit tests and 17 e2e tests keep passing. Only selectors that matched emojis or old text change, and they move to accessible names.

**Visual walk:** at the end, a `playwright-cli` walk in light and dark mode on a scratch repo (never the user's content), with screenshots for the user.

## 10. Delivery order

Each step ends with `pnpm verify` and `pnpm e2e` green.

1. **Foundations:**
   - shadcn init, `components.json`, the `@/` alias, tokens, fonts, `lucide-react` and `@tailwindcss/typography`;
   - the official button, badge and tabs replace the hand-written ones;
   - emojis become icons.

   No layout change yet.
2. **Home:** the `concepts` field, the list model, the search schema, the grouped table, the Continue cards and the Concepts section.
3. **Work view:** the header, the status bar, the notices, the tests tab, custom input, the console and prose.
4. **Concept page and shared pieces.**
5. **Final visual walk.**

## 11. Risks to probe when planning

- **shadcn CLI:** that `shadcn init` and `shadcn add` run non-interactively from the repo root with Tailwind 4.3, Vite 8 and TypeScript 7 `paths`, and which style to pick.
- **The `@/` alias:** whether Vite resolves it from `tsconfig` natively or needs `resolve.alias`, and the same question for Vitest.
- **Grouping:** that TanStack Table's grouping works with the row-per-membership input. The fallback is to group in the list model and use TanStack Table only to sort and filter each group.
- **Fonts:** that Fontsource has variable builds of IBM Plex Sans and JetBrains Mono. Otherwise, use the static builds.
- **Dark mode:** that the generated components' `dark:` classes behave with the media-based dark variant.

## 12. Out of scope

- A ⌘K command palette, a sidebar, and a manual light/dark switch.
- Persisting collapsed groups.
- A mobile layout. The playground targets a desktop browser, as before.
- New runner or API features beyond `concepts`.
- The minors deferred by the reconnection fixes:
  - stale marks for cases changed while the server was down;
  - retrying a first load that failed;
  - a heartbeat for a hung server;
  - a "restarted, reload" toast.

## 13. Amendments (2026-10-03, approved by the user with the implementation plan)

These come from the probes run while planning. They take precedence over the sections above. Details: the plan's "Deviations from the spec" table, `docs/superpowers/plans/2026-10-03-playground-ui.md`.

| # | Amendment |
|---|---|
| A1 | `components.json` is written by hand (shadcn's manual setup), and components are added with `shadcn add`. `shadcn init` cannot detect Vite inside `playground/`. |
| A2 | `cn` comes from shadcn's `cn` package, which the 4.21 CLI imports in every component. `lib/cn.ts`, `clsx` and `tailwind-merge` are removed. |
| A3 | `collapsible` and `checkbox` are not added. Groups fold with a disclosure button (`aria-expanded`), because a Radix Collapsible `<div>` is invalid inside `<table>`. The faceted filter uses a check icon. |
| A4 | No TanStack Table. A pure model (`web/home/model.ts`) filters, sorts and groups, and shadcn's `table` renders. |
| A5 | Each tooltip wrapper (`Hint`) brings its own `TooltipProvider` instead of one at the root, so components work on their own in tests. |
| A6 | Ligatures are off for mono text and in the editor (`->` and `<=` stay as typed). |
| A7 | The generated `sonner.tsx` drops `next-themes` and uses `theme="system"`. |

