# Playground UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the web playground with the full shadcn/ui setup and the "compact editor" theme, and let the home page group, sort and filter problems from the URL, without changing how solutions are saved, run or judged.

**Architecture:**
- **Components:** the official shadcn components (style `radix-mira`) are added with the shadcn CLI into `playground/web/components/ui/`, themed by CSS variables in `styles.css`.
- **Home list:** a pure model (`web/home/model.ts`) filters, sorts and groups the problems. Its state lives in validated URL search params (`web/home/search.ts`, zod + TanStack Router).
- **Work view:** gets a breadcrumb header and a VS Code-like status bar. The tests tab shows chips per case and a failures table built from a pure summary (`web/lib/run-summary.ts`).
- **Logic:** the autosave, conflict, guard and reconnection logic is not rewritten.

**Tech Stack:**
- **UI:** React 19.3, TanStack Router 1.170 and Query 5.104, Tailwind 4.3, shadcn CLI 4.21.1 (style `radix-mira`), `radix-ui`, `cn` (shadcn's class merger), `lucide-react`, `cmdk`, `tw-animate-css`, `@tailwindcss/typography`.
- **Fonts:** Fontsource variable fonts (IBM Plex Sans, JetBrains Mono).
- **Tests:** Vitest 5 (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-playground-ui-design.md`. It builds on `docs/superpowers/specs/2026-09-28-web-playground-design.md`.

## Global Constraints

- **Language and commits:** every file in the repo is written in English. Commit messages follow the existing style, `feat(playground): …` / `test(playground): …`.
- **Worktree:** work only in the worktree `/Users/angelozdev/me/algorithms-playground`, branch `playground`.
  - Never touch the main checkout `/Users/angelozdev/me/algorithms`.
  - Never use port 4173: the user's `pnpm play` runs there.
  - Never run `git stash`.
- **Staging:** never stage with `git add -A`, `git add .` or `git commit -a`. Always list the paths. The worktree holds the user's untracked `problems/lc-0026-remove-duplicates-from-sorted-array/solution.ts`, which must never be staged, edited or deleted.
- **shadcn components:** added only with `pnpm exec shadcn add <names> -y -o`, run from the repo root with the committed `components.json`.
  - Generated files under `playground/web/components/ui/` are vendored.
  - Edit them only where this plan says (added variants, the toaster's theme).
- **Class names:** `cn` comes from the `cn` package (`import { cn } from "cn"`). `clsx`, `tailwind-merge` and `lib/cn.ts` are removed.
- **Icons:** only from `lucide-react`. No emoji in UI strings or labels. README content rendered as Markdown is the user's content and is left alone.
- **Theme tokens:** exactly the values of spec §3.2. Dark mode follows the operating system (`prefers-color-scheme`), with no theme switch.
- **Fonts:** self-hosted with `@fontsource-variable/ibm-plex-sans` and `@fontsource-variable/jetbrains-mono`. No request to a font CDN. Code in the mono font has ligatures off: `->` and `<=` stay as typed.
- **Shortcuts:** they do not change. They are displayed through `shortcut()` (`web/lib/keys.ts`): `⌘↵` `⇧⌘↵` `⌘S` on Apple platforms, `Ctrl+Enter` `Ctrl+Shift+Enter` `Ctrl+S` elsewhere.
- **API:** no new endpoint. The only API change is `HomeProblem.concepts: string[]`. Hidden expected values are never rendered.
- **Tests:**
  - Test behavior through public interfaces (rendered roles, names, text, URL), not implementation details.
  - `pnpm verify` and `pnpm e2e` must both pass at the end of every task.
  - `pnpm e2e` uses port 4391 and the restart test uses 4392; both are fine.
- **Manual browser checks:** use `playwright-cli` only, and only against a scratch repo (`ALGO_ROOT` pointing outside the user's content), on a port other than 4173.
- **Imports:**
  - Our own code imports with relative paths and explicit extensions (`../components/ui/button.tsx`), like the rest of `playground/web`.
  - Generated shadcn files use the `@/` alias. Leave them as generated.

## Deviations from the spec (decided while planning, with the probe that settled each)

| # | Spec says | Plan does | Why |
|---|---|---|---|
| D1 | §3.1 `shadcn init` writes `components.json` | `components.json` is written by hand (shadcn's documented manual setup), then `shadcn add` | `init` stops at "We could not detect a supported framework": Vite lives in `playground/`, not at the root. With a hand-written `components.json`, `add` works (probe). |
| D2 | §3.1 the `utils` alias points at `lib/cn.ts` | Use the `cn` npm package; delete `lib/cn.ts`, `clsx` and `tailwind-merge` | The 4.21 CLI writes `import { cn } from "cn"` in every component, whatever `aliases.utils` says, and installs `cn` (published by shadcn, "drop-in replacement for clsx + tailwind-merge"). Fighting it would mean hand-editing every generated file. |
| D3 | §3.1 adds `collapsible` and `checkbox` | Neither is added | Radix Collapsible renders a `<div>`, which is invalid inside `<table>`. Groups use a disclosure button (`aria-expanded`) that shows or hides their rows. The faceted filter uses a check icon, as shadcn's own data-table example does. `dialog`, `input-group` and `toggle` arrive as dependencies of `command` and `toggle-group`. |
| D4 | §4.3 the table is built with TanStack Table | No TanStack Table. The pure list model (`home/model.ts`) filters, sorts and groups; shadcn's `table` renders. | `@tanstack/react-table` is now 9.x, with a new store-based API. Every piece this table needs would be custom in it anyway: grouping with multi-membership, counts of distinct problems, URL-owned state, and "missing values last" sorting. In a v9 probe, sorting worked but `column.getIsSorted` was missing from the column object. If the user wants TanStack Table later, the swap is contained in `ProblemTable.tsx` and `model.ts`. |
| D5 | §7 one `TooltipProvider` at the root | Each `Hint` (our tooltip wrapper) brings its own provider | Radix throws without a provider, and components are rendered on their own in unit tests. |
| D6 | §3.3 (not in spec) | Ligatures off in mono text and in the editor | Probe screenshot: JetBrains Mono turned `->` into an arrow and `<=` into ≤ inside the editor. |
| D7 | §3.2 Sonner uses `theme="system"` | The generated `sonner.tsx` is edited to drop `next-themes` and pass `theme="system"` | The playground has no theme provider. |

## Review Focus

The five failure modes most likely to bite a person using this. Each has its test in the owning task:

1. **A problem in several patterns or concepts.** It must appear in each group, but every count (header progress, "Hidden" aside) counts it once. (Task 4: `problemList` counts distinct problems; Task 5 checks the header.)
2. **A stale or hand-edited home URL** (unknown slug, invalid value, a number where text is expected, like `?q=20`). The page must open with the valid parts kept, and "No problems match" must offer "Clear filters". (Task 4 schema and router test; Task 6 empty state.)
3. **Typing fast in the home search box,** whose value is written to the URL. No character may be lost and the history must not fill up. (Task 5 page-level test types "two sum" through the real router.)
4. **The Reset button inside the custom-input form.** shadcn's `Button` has no default `type`, so a plain `<Button>` inside a `<form>` submits it. Reset must never run the code. (Task 1 adds the assertion; Task 9 keeps `type="button"`.)
5. **A locked language switch.** It must still say why (tooltip on hover) while its radios are disabled, and a hidden first failure must never show an expected value. (Task 7 header test and e2e; Task 8 tests-panel test.)

## File map

| Path | Responsibility | Task |
|---|---|---|
| `components.json` | shadcn CLI configuration (style, CSS file, aliases, icon library) | 1 |
| `tsconfig.json`, `playground/tsconfig.json`, `playground/vite.config.ts`, `vitest.config.ts` | `@/` alias for generated components | 1 |
| `playground/web/styles.css` | Tokens, fonts, Tailwind plugins, prose mapping, Shiki colors | 1 |
| `playground/web/components/ui/*` | Generated shadcn components (vendored) | 1 |
| `playground/web/components/Hint.tsx` | Tooltip wrapper with its own provider | 1 |
| `playground/server/types.ts`, `playground/server/targets.ts` | `HomeProblem.concepts` | 2 |
| `playground/web/lib/labels.ts` | Pattern/concept/difficulty/status vocabulary, LeetCode numbers | 3 |
| `playground/web/lib/keys.ts` | Shortcut labels per platform | 3 |
| `playground/web/components/StatusIcon.tsx`, `DifficultyBadge.tsx`, `ErrorMark.tsx`, `Logo.tsx` | Shared visual vocabulary | 3 |
| `playground/web/home/search.ts` | Home URL schema, defaults, `isFiltered`, `clearFilters` | 4 |
| `playground/web/home/model.ts` | Filter, facets, sort, group, Continue items, concept rows | 4 |
| `playground/web/router.tsx` | Home route validates and strips its search params | 4 |
| `playground/web/home/HomeHeader.tsx`, `SectionTitle.tsx`, `ContinueCards.tsx`, `ProblemTable.tsx`, `ConceptList.tsx` | Home page pieces | 5 |
| `playground/web/routes/home.tsx` | Home page: URL ↔ view | 5, 6 |
| `playground/web/home/ProblemToolbar.tsx`, `FacetFilter.tsx` | Group-by, status filter, facets, Reset | 6 |
| `playground/web/components/StatusBar.tsx` | Status bar and save labels | 7 |
| `playground/web/work/WorkHeader.tsx` | Breadcrumb header, language switch, Run | 7 |
| `playground/web/routes/work.tsx` | Work page wiring | 7, 8, 9 |
| `playground/web/lib/run-summary.ts` | Chips from a `RunResult` | 8 |
| `playground/web/components/TestsPanel.tsx`, `RunDetails.tsx` | Tests tab | 8 |
| `playground/web/components/CustomInputPanel.tsx`, `ConsolePanel.tsx` | Custom input and console tabs | 9 |
| `playground/web/routes/concept.tsx`, `components/ConceptView.tsx`, `NotFound.tsx`, `ConnectionBanner.tsx` | Concept page and shared pieces | 10 |
| `playground/e2e/*.spec.ts`, `playground/e2e/fixture.ts` | End-to-end tests | 1, 5, 6, 7, 8, 10, 11 |

---

### Task 1: shadcn foundations, theme and fonts

**Files:**
- Create: `components.json`, `playground/web/components/Hint.tsx`
- Generate: `playground/web/components/ui/{alert,badge,breadcrumb,button,command,dialog,input-group,input,kbd,popover,progress,select,separator,skeleton,sonner,table,tabs,textarea,toggle-group,toggle,tooltip}.tsx` (button, badge and tabs replace the hand-written ones)
- Modify: `tsconfig.json`, `playground/tsconfig.json`, `playground/vite.config.ts`, `vitest.config.ts`, `package.json`, `pnpm-lock.yaml`, `playground/web/styles.css`, `playground/web/router.tsx`, `playground/web/components/Markdown.tsx`, `playground/web/components/ConceptView.tsx`, `playground/web/components/CodeEditor.tsx`, `playground/web/components/TestsPanel.tsx`, `playground/web/components/CustomInputPanel.tsx`, `playground/web/routes/work.tsx`, `playground/web/routes/concept.tsx`, `playground/tests/web/setup.ts`
- Delete: `playground/web/lib/cn.ts`
- Test: `playground/tests/web/custom-input.test.tsx`, `playground/e2e/work.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - **Generated components** under `playground/web/components/ui/`. `Badge` gets `variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" | "success" | "warning"`. `Alert` gets `variant: "default" | "destructive" | "warning" | "success"`.
  - `Hint({ label: ReactNode; children: ReactElement; side?: "top" | "bottom" | "left" | "right" })` in `playground/web/components/Hint.tsx`.
  - **Tailwind colors** `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `input`, `ring` (with `-foreground` pairs where shadcn has them), plus `font-sans` / `font-mono`.
  - **CSS variable** `--font-mono-stack` (the mono font stack, for code outside Tailwind).

- [ ] **Step 1: Guard the custom-input Reset button**

The shadcn `Button` added below has no default `type`, so inside a `<form>` it submits. In `playground/tests/web/custom-input.test.tsx`, in the test `"remembers edits per problem, and Reset brings back Example 1"`, replace:

```tsx
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
```

with:

```tsx
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("textbox", { name: "nums" })).toHaveValue("[2,7,11,15]");
    expect(run).not.toHaveBeenCalled(); // Reset never runs the code
```

- [ ] **Step 2: Add the end-to-end checks for the editor font and the custom-input tab**

Append to `playground/e2e/work.spec.ts`:

```ts
test("the editor shows code exactly as typed, in the app's mono font", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const scroller = page.locator(".cm-scroller");
  await expect(scroller).toHaveCSS("font-family", /JetBrains Mono/);
  await expect(scroller).toHaveCSS("font-variant-ligatures", "none");
});

test("the custom input fields stay hidden until their tab is open", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await expect(page.getByRole("textbox", { name: "solution.py" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "nums" })).toBeHidden();
  await page.getByRole("tab", { name: "Custom input" }).click();
  await expect(page.getByRole("textbox", { name: "nums" })).toBeVisible();
});
```

- [ ] **Step 3: Run the new checks and see the font check fail**

Run: `pnpm e2e -g "mono font|stay hidden"`
Expected:
- FAIL for "the editor shows code exactly as typed…": the font family is `ui-monospace…` and the ligatures are `normal`.
- PASS for "the custom input fields stay hidden…". That test guards behavior the component swap could break.

- [ ] **Step 4: Install the packages**

Run, from the repo root:

```bash
pnpm add cn lucide-react tw-animate-css @fontsource-variable/ibm-plex-sans @fontsource-variable/jetbrains-mono @tailwindcss/typography
pnpm add -D shadcn@4.21.1
pnpm remove clsx tailwind-merge
```

Expected: the three commands succeed. `shadcn` is a dev dependency because it provides both the CLI and `shadcn/tailwind.css`, which `styles.css` imports.

- [ ] **Step 5: Write `components.json` and the `@/` alias**

Create `components.json` at the repo root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-mira",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "playground/web/styles.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

(`utils` must be present for the schema. The CLI imports `cn` from the `cn` package anyway, and no `lib/utils.ts` is created.)

In `tsconfig.json` (root), add the alias to the existing `paths` so the CLI can resolve `@/`:

```json
    "paths": {
      "lc": ["./runner/harness/ts/lc.ts"],
      "@/*": ["./playground/web/*"]
    }
```

In `playground/tsconfig.json`, add inside `compilerOptions` (after `"types"`):

```json
    "types": ["node", "vite/client"],
    "paths": { "@/*": ["./web/*"] }
```

In `playground/vite.config.ts`, add the alias right after `root`:

```ts
export default defineConfig({
  root: here("./web"),
  // Generated shadcn components import each other through "@/" (components.json).
  resolve: { alias: { "@": here("./web") } },
  server: {
```

In `vitest.config.ts`, import `fileURLToPath` and give the `web` project the same alias:

```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
```

```ts
      {
        extends: true,
        plugins: [react()],
        resolve: { alias: { "@": fileURLToPath(new URL("./playground/web", import.meta.url)) } },
        test: {
          name: "web",
```

- [ ] **Step 6: Generate the components**

Run from the repo root:

```bash
pnpm exec shadcn add button badge tabs tooltip table select toggle-group breadcrumb kbd input textarea alert skeleton progress sonner popover command separator -y -o
```

Expected: `playground/web/components/ui/` now holds `alert, badge, breadcrumb, button, command, dialog, input-group, input, kbd, popover, progress, select, separator, skeleton, sonner, table, tabs, textarea, toggle-group, toggle, tooltip` (`.tsx`).
- Check that `grep -l 'from "cn"' playground/web/components/ui/*.tsx | wc -l` prints `21`.
- `package.json` gains `cmdk` and `next-themes`.

If the CLI asks anything, the flags were not passed: rerun with `-y -o`.

- [ ] **Step 7: Add the variants and the system theme to the generated files**

In `playground/web/components/ui/badge.tsx`, inside `variants.variant`, add two entries after `destructive: …,`:

```tsx
        success: "bg-success/10 text-success dark:bg-success/20",
        warning: "bg-warning/10 text-warning dark:bg-warning/20",
```

In `playground/web/components/ui/alert.tsx`, inside `variants.variant`, add after `destructive: …,`:

```tsx
        warning: "border-warning/40 bg-warning/10 text-foreground *:[svg]:text-warning",
        success: "border-success/40 bg-success/10 text-foreground *:[svg]:text-success",
```

In `playground/web/components/ui/sonner.tsx`:
- delete the line `import { useTheme } from "next-themes"`;
- delete the line `const { theme = "system" } = useTheme()`;
- replace `theme={theme as ToasterProps["theme"]}` with `theme="system"`;
- add this comment above `const Toaster`:

```tsx
// Edited after `shadcn add`: the playground has no theme provider, so toasts follow the operating system.
```

Then run `pnpm remove next-themes`.

- [ ] **Step 8: Replace `lib/cn.ts` with the `cn` package**

Delete `playground/web/lib/cn.ts`. In each file that imports it, replace the import line with `import { cn } from "cn";`:
- `playground/web/components/Markdown.tsx` (`import { cn } from "../lib/cn.ts";`)
- `playground/web/components/TestsPanel.tsx` (`import { cn } from "../lib/cn.ts";`)
- `playground/web/routes/work.tsx` (`import { cn } from "../lib/cn.ts";`)

Check: `grep -rn "lib/cn" playground` prints nothing.

- [ ] **Step 9: Write the theme**

Replace `playground/web/styles.css` with:

```css
@import "tailwindcss" source(".");
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/ibm-plex-sans";
@import "@fontsource-variable/jetbrains-mono";
@plugin "@tailwindcss/typography";

/* Tailwind's dark: variant stays media-based: the playground follows the operating system (spec §3.2). */

@theme inline {
  --font-sans: var(--font-sans-stack);
  --font-mono: var(--font-mono-stack);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}

:root {
  /* Plain variables, so code outside Tailwind (the CodeMirror theme) can use the same fonts. */
  --font-sans-stack: "IBM Plex Sans Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono-stack: "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;
  --radius: 0.375rem;
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: #f1f5f9;
  --accent-foreground: #0f172a;
  --destructive: #dc2626;
  --success: #16a34a;
  --warning: #d97706;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #2563eb;
}

/* GitHub Dark: the same colors as the editor and the code blocks. */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0d1117;
    --foreground: #e6edf3;
    --card: #161b22;
    --card-foreground: #e6edf3;
    --popover: #161b22;
    --popover-foreground: #e6edf3;
    --primary: #58a6ff;
    --primary-foreground: #0d1117;
    --secondary: #21262d;
    --secondary-foreground: #e6edf3;
    --muted: #21262d;
    --muted-foreground: #8b949e;
    --accent: #1f2630;
    --accent-foreground: #e6edf3;
    --destructive: #f85149;
    --success: #3fb950;
    --warning: #d29922;
    --border: #30363d;
    --input: #30363d;
    --ring: #58a6ff;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    @apply font-sans;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
  /* Code is shown exactly as typed: no ligatures turning -> into an arrow or <= into ≤. */
  code,
  kbd,
  pre,
  samp,
  .font-mono {
    font-variant-ligatures: none;
  }
}

/* Markdown (statements, concept notes, My explanation) in the app's colors. */
.prose {
  --tw-prose-body: var(--foreground);
  --tw-prose-headings: var(--foreground);
  --tw-prose-lead: var(--muted-foreground);
  --tw-prose-links: var(--primary);
  --tw-prose-bold: var(--foreground);
  --tw-prose-counters: var(--muted-foreground);
  --tw-prose-bullets: var(--muted-foreground);
  --tw-prose-hr: var(--border);
  --tw-prose-quotes: var(--foreground);
  --tw-prose-quote-borders: var(--border);
  --tw-prose-captions: var(--muted-foreground);
  --tw-prose-kbd: var(--foreground);
  --tw-prose-code: var(--foreground);
  --tw-prose-pre-code: var(--foreground);
  --tw-prose-pre-bg: var(--muted);
  --tw-prose-th-borders: var(--border);
  --tw-prose-td-borders: var(--border);
}
/* Inline code as a chip, without the backticks the typography plugin adds around it. */
.prose :where(code):not(:where(pre *)) {
  @apply rounded bg-muted px-1 py-0.5 font-normal;
}
.prose :where(code):not(:where(pre *))::before,
.prose :where(code):not(:where(pre *))::after {
  content: none;
}
/* Concept links that open next to the editor are buttons styled as links. */
.prose .concept-link {
  @apply cursor-pointer text-primary underline underline-offset-2;
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
```

- [ ] **Step 10: Use the mono font in the editor**

In `playground/web/components/CodeEditor.tsx`, add this constant after `BASIC_SETUP`:

```ts
/** The app's mono font, without ligatures: `->` and `<=` stay as typed. */
const MONO_FONT = EditorView.theme({ ".cm-scroller": { fontFamily: "var(--font-mono-stack)", fontVariantLigatures: "none" } });
```

and add it to the `extensions` array, right after `language(lang),`:

```ts
      language(lang),
      MONO_FONT,
```

- [ ] **Step 11: Add the tooltip wrapper**

Create `playground/web/components/Hint.tsx`:

```tsx
import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.tsx";

/**
 * A tooltip around one element. Each hint brings its own provider, so components work (and are tested) on their
 * own. A hint repeats what the element's accessible name or visible text already says; it never carries
 * information found nowhere else.
 */
export function Hint({ label, children, side = "bottom" }: { label: ReactNode; children: ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 12: Give jsdom the browser APIs Radix and cmdk need**

Replace `playground/tests/web/setup.ts` with:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
// jsdom has no scrollTo; TanStack Router calls it after navigating.
window.scrollTo = () => {};

// Radix (tooltips, popovers, selects) and cmdk use browser APIs that jsdom lacks.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
```

- [ ] **Step 13: Adapt the call sites to the generated components**

In `playground/web/router.tsx`, import the generated toaster instead of Sonner's own:

```tsx
import { Toaster } from "./components/ui/sonner.tsx";
```

and render it as `<Toaster position="bottom-right" />` (drop `theme` and `richColors`: the wrapper sets the theme, and toast colors come from the tokens).

In `playground/web/components/Markdown.tsx`, the wrapper becomes:

```tsx
    <div className={cn("prose prose-sm max-w-none", className)}>
```

In `playground/web/components/ConceptView.tsx`, the `ExplanationSection` root becomes:

```tsx
    <section aria-labelledby="my-explanation" className="prose prose-sm max-w-none">
```

In `playground/web/components/TestsPanel.tsx`, the stale badge becomes:

```tsx
          {stale && <Badge variant="warning">cases changed — run again</Badge>}
```

In `playground/web/routes/concept.tsx`, the status badge becomes `<Badge variant="secondary">{concept.data.status}</Badge>`.

In `playground/web/components/CustomInputPanel.tsx`, give Reset an explicit type (the generated `Button` has no default `type`, so inside the form it would submit):

```tsx
        <Button type="button" variant="outline" onClick={reset}>
          Reset
        </Button>
```

In `playground/web/routes/work.tsx`:
- replace `statusTone` with:

```tsx
function statusVariant(status: TargetData["status"]) {
  if (status === "solved") return "success" as const;
  if (status === "revealed") return "warning" as const;
  return "outline" as const;
}
```

- in `WorkHeader`:
  - `{target.difficulty && <Badge variant="outline">{target.difficulty}</Badge>}`
  - `<Badge variant={statusVariant(target.status)}>{target.status}</Badge>`
  - `<TabsList aria-label="Language">` (drop `className="border-b-0"`)
- in `Workspace`, the panel tabs become:

```tsx
              <Tabs value={tab} onValueChange={(value) => setTab(value as PanelTab)} className="flex h-full flex-col gap-0">
                <TabsList variant="line" className="w-full justify-start border-b px-2">
```

  Give every `TabsContent` the overflow classes. Hide the force-mounted custom tab while it is inactive: the generated `TabsContent` no longer does it.

```tsx
                <TabsContent value="tests" className="min-h-0 overflow-auto">
```

```tsx
                <TabsContent value="custom" forceMount className="min-h-0 overflow-auto data-[state=inactive]:hidden">
```

```tsx
                <TabsContent value="console" className="min-h-0 overflow-auto">
```

- [ ] **Step 14: Run everything**

Run: `pnpm verify`
Expected: all Vitest projects pass (the Reset guard included), both `tsc` runs are clean, and `tsx scripts/check.ts` ends with `0 error(s)`.

Run: `pnpm e2e`
Expected: every test passes, including the two from Step 2.

- [ ] **Step 15: Commit**

```bash
git add components.json tsconfig.json playground/tsconfig.json playground/vite.config.ts vitest.config.ts package.json pnpm-lock.yaml \
  playground/web/styles.css playground/web/router.tsx playground/web/components playground/web/lib playground/web/routes \
  playground/tests/web/setup.ts playground/tests/web/custom-input.test.tsx playground/e2e/work.spec.ts
git commit -m "feat(playground): adopt shadcn/ui with the compact-editor theme"
```

(`git add playground/web/lib` records the deletion of `lib/cn.ts`.)

---

### Task 2: concepts on the home data

**Files:**
- Modify: `playground/server/types.ts:6-15`, `playground/server/targets.ts:30-40`
- Test: `playground/tests/server/targets.test.ts`, `playground/tests/web/home.test.tsx` (fixture only)

**Interfaces:**
- Consumes: `strList` from `lib/repo.ts`.
- Produces: `HomeProblem.concepts: string[]`, the concept slugs from the frontmatter, or `[]` when the field is missing or not a list.

- [ ] **Step 1: Write the failing server tests**

In `playground/tests/server/targets.test.ts`, in `"lists problems with status and in-progress, the pattern groups, and concepts with their exercises"`, the expected problems become:

```ts
    expect(body.problems).toEqual([
      { id: "lc-0001", title: "Two Sum", difficulty: "easy", patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved", inProgress: false, error: null },
      { id: "lc-0020", title: "Valid Parentheses", difficulty: "easy", patterns: ["stack"], concepts: [], status: "todo", inProgress: true, error: null },
    ]);
```

and add a test after `"marks a README with broken frontmatter instead of failing"`:

```ts
  it("gives a problem whose concepts field is not a list no concepts", async () => {
    const root = makeRepo();
    put(
      root,
      "problems/lc-0035-search-insert-position/README.md",
      "---\nid: lc-0035\ntitle: Search Insert Position\ndifficulty: easy\npatterns: [binary-search]\nconcepts: binary-search\nstatus: todo\n---\n# 35. Search Insert Position\n",
    );
    const { body } = await json(await call(createApp({ root }), "/api/home"));
    expect(body.problems.find((p: { id: string }) => p.id === "lc-0035").concepts).toEqual([]);
  });
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/server/targets.test.ts`
Expected: FAIL. The first test's diff shows `concepts` missing from the received problems; the new test reads `.concepts` of a problem without it (`undefined`, not `[]`).

- [ ] **Step 3: Add the field**

In `playground/server/types.ts`, `HomeProblem` becomes:

```ts
export interface HomeProblem {
  id: string;
  title: string;
  difficulty: string | null;
  patterns: string[];
  /** Concept slugs from the frontmatter; [] when the field is missing or not a list. */
  concepts: string[];
  status: ItemStatus;
  inProgress: boolean;
  /** README missing or its frontmatter unparsable. */
  error: string | null;
}
```

In `playground/server/targets.ts`, inside `homeData`, add the field after `patterns`:

```ts
      patterns: strList(p.data.patterns),
      concepts: strList(p.data.concepts),
```

In `playground/tests/web/home.test.tsx`, the `DATA` problems need the new field to type-check. Add `concepts: ["hash-map"]` to lc-0001, `concepts: ["two-pointers"]` to lc-0026 and `concepts: []` to lc-0030:

```ts
    { id: "lc-0001", title: "Two Sum", difficulty: "easy", patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved", inProgress: false, error: null },
    { id: "lc-0026", title: "Remove Duplicates", difficulty: "easy", patterns: ["two-pointers"], concepts: ["two-pointers"], status: "solving", inProgress: true, error: null },
    { id: "lc-0030", title: "lc-0030-broken", difficulty: null, patterns: [], concepts: [], status: "todo", inProgress: false, error: "frontmatter: bad" },
```

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm exec vitest run playground/tests/server/targets.test.ts playground/tests/web/home.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green.

```bash
git add playground/server/types.ts playground/server/targets.ts playground/tests/server/targets.test.ts playground/tests/web/home.test.tsx
git commit -m "feat(playground): send each problem's concepts with the home data"
```

---

### Task 3: shared vocabulary (labels, shortcuts, status icons, badges)

**Files:**
- Create: `playground/web/lib/labels.ts`, `playground/web/lib/keys.ts`, `playground/web/components/DifficultyBadge.tsx`, `playground/web/components/ErrorMark.tsx`, `playground/web/components/Logo.tsx`
- Modify: `playground/web/components/StatusIcon.tsx` (rewrite)
- Test: `playground/tests/web/labels.test.ts`, `playground/tests/web/keys.test.ts`, `playground/tests/web/status-icon.test.tsx`

**Interfaces:**
- Consumes:
  - `HomeConcept`, `ItemStatus` from `playground/server/types.ts`
  - `Hint` (Task 1)
  - `Badge` (Task 1)
- Produces, in `web/lib/labels.ts`:
  - `PATTERN_LABELS: Readonly<Record<string, string>>`
  - `prettifySlug(slug: string): string`
  - `patternLabel(slug: string): string`
  - `conceptLabel(slug: string, concepts: readonly Pick<HomeConcept, "slug" | "title">[]): string`
  - `leetcodeNumber(id: string): number | null`
  - `type Difficulty = "easy" | "medium" | "hard"`
  - `DIFFICULTIES: readonly Difficulty[]`
  - `difficultyOf(value: string | null): Difficulty | null`
  - `difficultyLabel(difficulty: Difficulty): string`
  - `type StatusKind = "in-progress" | "todo" | "revealed" | "solved"`
  - `statusKind(status: ItemStatus, inProgress: boolean): StatusKind`
  - `STATUS_LABEL: Record<StatusKind, string>`
- Produces, in `web/lib/keys.ts`:
  - `type ShortcutAction = "run" | "custom" | "save"`
  - `isApplePlatform(platform?: string): boolean`
  - `shortcut(action: ShortcutAction, apple?: boolean): string`
- Produces, components:
  - `StatusIcon({ status: ItemStatus; inProgress: boolean; className?: string })`: an element with `role="img"` named by `STATUS_LABEL`
  - `DifficultyBadge({ difficulty: string | null })`: renders nothing for an unknown difficulty
  - `ErrorMark({ error: string; label?: string })`: `role="img"` named `"<label>: <error>"`, where `label` defaults to `"Broken README"`
  - `Logo()`: the accent square with the `CodeXml` icon, `aria-hidden`

- [ ] **Step 1: Write the failing tests**

Create `playground/tests/web/labels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  conceptLabel,
  difficultyLabel,
  difficultyOf,
  leetcodeNumber,
  patternLabel,
  prettifySlug,
  STATUS_LABEL,
  statusKind,
} from "../../web/lib/labels.ts";

describe("labels", () => {
  it("names every known pattern and makes unknown slugs readable", () => {
    expect(patternLabel("arrays-hashing")).toBe("Arrays & hashing");
    expect(patternLabel("dp-1d")).toBe("1-D DP");
    expect(patternLabel("heap")).toBe("Heap / priority queue");
    expect(patternLabel("union-find")).toBe("Union find");
    expect(prettifySlug("in-place-array-modification")).toBe("In place array modification");
  });

  it("uses a concept page's title when there is one", () => {
    const concepts = [{ slug: "hash-map", title: "Hash map" }];
    expect(conceptLabel("hash-map", concepts)).toBe("Hash map");
    expect(conceptLabel("two-pointers", concepts)).toBe("Two pointers");
  });

  it("reads LeetCode numbers from ids, and nothing from other ids", () => {
    expect(leetcodeNumber("lc-0001")).toBe(1);
    expect(leetcodeNumber("lc-2181")).toBe(2181);
    expect(leetcodeNumber("hash-map/01")).toBeNull();
    expect(leetcodeNumber("cf-0001")).toBeNull();
  });

  it("knows the three difficulties", () => {
    expect(difficultyOf("easy")).toBe("easy");
    expect(difficultyOf("Medium")).toBe("medium");
    expect(difficultyOf("insane")).toBeNull();
    expect(difficultyOf(null)).toBeNull();
    expect(difficultyLabel("hard")).toBe("Hard");
  });

  it("reads a started to-do item as in progress", () => {
    expect(STATUS_LABEL[statusKind("todo", true)]).toBe("In progress");
    expect(STATUS_LABEL[statusKind("solving", false)]).toBe("In progress");
    expect(STATUS_LABEL[statusKind("todo", false)]).toBe("To do");
    expect(STATUS_LABEL[statusKind("revealed", true)]).toBe("Revealed");
    expect(STATUS_LABEL[statusKind("solved", false)]).toBe("Solved");
  });
});
```

Create `playground/tests/web/keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isApplePlatform, shortcut } from "../../web/lib/keys.ts";

describe("shortcut labels", () => {
  it("shows ⌘ on Apple platforms and Ctrl elsewhere", () => {
    expect(isApplePlatform("MacIntel")).toBe(true);
    expect(isApplePlatform("iPad")).toBe(true);
    expect(isApplePlatform("Win32")).toBe(false);
    expect(isApplePlatform("Linux x86_64")).toBe(false);
    expect([shortcut("run", true), shortcut("custom", true), shortcut("save", true)]).toEqual(["⌘↵", "⇧⌘↵", "⌘S"]);
    expect([shortcut("run", false), shortcut("custom", false), shortcut("save", false)]).toEqual([
      "Ctrl+Enter",
      "Ctrl+Shift+Enter",
      "Ctrl+S",
    ]);
  });
});
```

Create `playground/tests/web/status-icon.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DifficultyBadge } from "../../web/components/DifficultyBadge.tsx";
import { ErrorMark } from "../../web/components/ErrorMark.tsx";
import { StatusIcon } from "../../web/components/StatusIcon.tsx";

describe("status vocabulary", () => {
  it("names each status icon by its status, for screen readers and tests", () => {
    render(
      <>
        <StatusIcon status="todo" inProgress={false} />
        <StatusIcon status="todo" inProgress />
        <StatusIcon status="revealed" inProgress={false} />
        <StatusIcon status="solved" inProgress={false} />
      </>,
    );
    expect(screen.getAllByRole("img").map((icon) => icon.getAttribute("aria-label"))).toEqual(["To do", "In progress", "Revealed", "Solved"]);
  });

  it("shows a known difficulty and nothing for an unknown one", () => {
    render(<DifficultyBadge difficulty="medium" />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    const { container } = render(<DifficultyBadge difficulty={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names a broken file by its error", () => {
    render(<ErrorMark error="frontmatter: bad" />);
    expect(screen.getByRole("img", { name: "Broken README: frontmatter: bad" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/labels.test.ts playground/tests/web/keys.test.ts playground/tests/web/status-icon.test.tsx`
Expected: FAIL. The new modules (`labels.ts`, `keys.ts`, `DifficultyBadge.tsx`, `ErrorMark.tsx`) cannot be resolved, and `StatusIcon` still shows the old lowercase labels.

- [ ] **Step 3: Write the vocabulary**

Create `playground/web/lib/labels.ts`:

```ts
import type { HomeConcept, ItemStatus } from "../../server/types.ts";

/** Display names of the patterns listed in CLAUDE.md. */
export const PATTERN_LABELS: Readonly<Record<string, string>> = {
  "arrays-hashing": "Arrays & hashing",
  "two-pointers": "Two pointers",
  "sliding-window": "Sliding window",
  stack: "Stack",
  "binary-search": "Binary search",
  "linked-list": "Linked list",
  trees: "Trees",
  tries: "Tries",
  heap: "Heap / priority queue",
  backtracking: "Backtracking",
  graphs: "Graphs",
  "dp-1d": "1-D DP",
  "dp-2d": "2-D DP",
  greedy: "Greedy",
  intervals: "Intervals",
  math: "Math",
  "bit-manipulation": "Bit manipulation",
  strings: "Strings",
};

/** "bit-manipulation" → "Bit manipulation". */
export function prettifySlug(slug: string): string {
  const words = slug.replace(/-/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function patternLabel(slug: string): string {
  return PATTERN_LABELS[slug] ?? prettifySlug(slug);
}

/** A concept's name: the title of its page in concepts/ when it has one, otherwise its slug made readable. */
export function conceptLabel(slug: string, concepts: readonly Pick<HomeConcept, "slug" | "title">[]): string {
  return concepts.find((concept) => concept.slug === slug)?.title ?? prettifySlug(slug);
}

/** LeetCode's problem number from an id like "lc-0035", or null for any other id. */
export function leetcodeNumber(id: string): number | null {
  const match = /^lc-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

export function difficultyOf(value: string | null): Difficulty | null {
  const lower = value?.toLowerCase();
  return DIFFICULTIES.find((difficulty) => difficulty === lower) ?? null;
}

export function difficultyLabel(difficulty: Difficulty): string {
  return prettifySlug(difficulty);
}

/** How a status reads to a person. `solving`, and a `todo` with a solution file, both read "In progress". */
export type StatusKind = "in-progress" | "todo" | "revealed" | "solved";

export function statusKind(status: ItemStatus, inProgress: boolean): StatusKind {
  if (status === "solved") return "solved";
  if (status === "revealed") return "revealed";
  if (status === "solving" || inProgress) return "in-progress";
  return "todo";
}

export const STATUS_LABEL: Record<StatusKind, string> = {
  "in-progress": "In progress",
  todo: "To do",
  revealed: "Revealed",
  solved: "Solved",
};
```

Create `playground/web/lib/keys.ts`:

```ts
export type ShortcutAction = "run" | "custom" | "save";

export function isApplePlatform(platform: string = typeof navigator === "undefined" ? "" : navigator.platform): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

const APPLE: Record<ShortcutAction, string> = { run: "⌘↵", custom: "⇧⌘↵", save: "⌘S" };
const OTHERS: Record<ShortcutAction, string> = { run: "Ctrl+Enter", custom: "Ctrl+Shift+Enter", save: "Ctrl+S" };

/** How a shortcut is written on this platform. The keys themselves are bound with "Mod", which follows the same rule. */
export function shortcut(action: ShortcutAction, apple: boolean = isApplePlatform()): string {
  return (apple ? APPLE : OTHERS)[action];
}
```

- [ ] **Step 4: Write the components**

Replace `playground/web/components/StatusIcon.tsx` with:

```tsx
import { cn } from "cn";
import { Circle, CircleCheck, Clock, Eye, type LucideIcon } from "lucide-react";
import type { ItemStatus } from "../../server/types.ts";
import { STATUS_LABEL, type StatusKind, statusKind } from "../lib/labels.ts";

const LOOK: Record<StatusKind, { Icon: LucideIcon; className: string }> = {
  "in-progress": { Icon: Clock, className: "text-warning" },
  todo: { Icon: Circle, className: "text-muted-foreground" },
  revealed: { Icon: Eye, className: "text-muted-foreground" },
  solved: { Icon: CircleCheck, className: "text-success" },
};

/** The status of a problem or exercise as an icon, named by the status for screen readers and tests. */
export function StatusIcon({ status, inProgress, className }: { status: ItemStatus; inProgress: boolean; className?: string }) {
  const kind = statusKind(status, inProgress);
  const { Icon, className: tone } = LOOK[kind];
  return (
    <span role="img" aria-label={STATUS_LABEL[kind]} className={cn("inline-flex shrink-0", tone, className)}>
      <Icon aria-hidden className="size-4" />
    </span>
  );
}
```

Create `playground/web/components/DifficultyBadge.tsx`:

```tsx
import { type Difficulty, difficultyLabel, difficultyOf } from "../lib/labels.ts";
import { Badge } from "./ui/badge.tsx";

const VARIANT: Record<Difficulty, "success" | "warning" | "destructive"> = { easy: "success", medium: "warning", hard: "destructive" };

export function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  const known = difficultyOf(difficulty);
  if (!known) return null;
  return <Badge variant={VARIANT[known]}>{difficultyLabel(known)}</Badge>;
}
```

Create `playground/web/components/ErrorMark.tsx`:

```tsx
import { TriangleAlert } from "lucide-react";
import { Hint } from "./Hint.tsx";

/** A warning icon for a file that cannot be read; the error is its accessible name and its tooltip. */
export function ErrorMark({ error, label = "Broken README" }: { error: string; label?: string }) {
  return (
    <Hint label={error}>
      <span role="img" aria-label={`${label}: ${error}`} className="inline-flex shrink-0 text-warning">
        <TriangleAlert aria-hidden className="size-4" />
      </span>
    </Hint>
  );
}
```

Create `playground/web/components/Logo.tsx`:

```tsx
import { CodeXml } from "lucide-react";

export function Logo() {
  return (
    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
      <CodeXml className="size-3.5" />
    </span>
  );
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/labels.test.ts playground/tests/web/keys.test.ts playground/tests/web/status-icon.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green. The old home page still renders `StatusIcon` with the same props.

```bash
git add playground/web/lib/labels.ts playground/web/lib/keys.ts playground/web/components/StatusIcon.tsx playground/web/components/DifficultyBadge.tsx \
  playground/web/components/ErrorMark.tsx playground/web/components/Logo.tsx \
  playground/tests/web/labels.test.ts playground/tests/web/keys.test.ts playground/tests/web/status-icon.test.tsx
git commit -m "feat(playground): add the shared labels, shortcut names and status icons"
```

---
### Task 4: home list model and URL state

**Files:**
- Create: `playground/web/home/search.ts`, `playground/web/home/model.ts`
- Modify: `playground/web/router.tsx`
- Test: `playground/tests/web/home-search.test.ts`, `playground/tests/web/home-model.test.ts`

**Interfaces:**
- Consumes:
  - `HomeData`, `HomeProblem`, `HomeConcept`, `HomeExercise`, `ItemStatus` from `playground/server/types.ts`
  - everything in `web/lib/labels.ts` (Task 3)
- Produces, in `web/home/search.ts`:
  - `GROUP_BY = ["none", "pattern", "concept", "difficulty", "status"] as const` and `type GroupBy`
  - `SORT_KEYS = ["num", "title", "difficulty"] as const` and `type SortKey`
  - `type SortDir = "asc" | "desc"`
  - `STATUS_FILTERS = ["all", "pending", "solved"] as const` and `type StatusFilter`
  - `homeSearchSchema` (zod)
  - `type HomeSearch = { q: string; group: GroupBy; sort: SortKey; dir: SortDir; status: StatusFilter; difficulty: Difficulty[]; pattern: string[]; concept: string[] }`
  - `DEFAULT_SEARCH: HomeSearch`
  - `isFiltered(search: HomeSearch): boolean`
  - `clearFilters(search: HomeSearch): HomeSearch`
- Produces, in `web/home/model.ts`:
  - `NO_PATTERN_LABEL = "(no pattern yet)"`, `NO_CONCEPT_LABEL = "(no concept yet)"`, `NO_DIFFICULTY_LABEL = "No difficulty"`
  - `interface ProblemGroup { key: string; label: string; conceptSlug: string | null; problems: HomeProblem[] }`
  - `matchesQuery(item: { id: string; title: string }, q: string): boolean`
  - `filterProblems(problems: readonly HomeProblem[], search: HomeSearch): HomeProblem[]`
  - `type Facet = "difficulty" | "pattern" | "concept"`
  - `interface FacetOption { value: string; label: string; count: number }`
  - `facetOptions(data: HomeData, search: HomeSearch, facet: Facet): FacetOption[]`
  - `sortProblems(problems: readonly HomeProblem[], sort: SortKey, dir: SortDir): HomeProblem[]`
  - `groupProblems(problems: readonly HomeProblem[], by: GroupBy, concepts: readonly HomeConcept[]): ProblemGroup[]`
  - `interface ProblemList { groups: ProblemGroup[]; matching: number }`
  - `problemList(data: HomeData, search: HomeSearch): ProblemList`
  - `interface ContinueItem { id: string; title: string; status: ItemStatus; inProgress: boolean; difficulty: string | null; context: string | null }`
  - `continueItems(data: HomeData, q: string): ContinueItem[]`
  - `interface ConceptRow { concept: HomeConcept; exercises: HomeExercise[]; solved: number }`
  - `conceptRows(data: HomeData, q: string): ConceptRow[]`
- Produces, in `router.tsx`: the home route (`"/"`) validates its search params with `homeSearchSchema` and strips `DEFAULT_SEARCH` from built URLs. Read it with `getRouteApi("/").useSearch()`.

- [ ] **Step 1: Write the failing search tests**

Create `playground/tests/web/home-search.test.ts`:

```ts
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { clearFilters, DEFAULT_SEARCH, homeSearchSchema, isFiltered } from "../../web/home/search.ts";
import { routeTree } from "../../web/router.tsx";

describe("home search params", () => {
  it("falls back to the default for a value that does not parse, and drops list entries that are not allowed", () => {
    expect(homeSearchSchema.parse({})).toEqual(DEFAULT_SEARCH);
    expect(homeSearchSchema.parse({ group: "bogus", sort: 3, dir: "up", status: "done" })).toEqual(DEFAULT_SEARCH);
    expect(homeSearchSchema.parse({ difficulty: ["easy", "insane", 3], pattern: ["two-pointers", 7], concept: "hash-map" })).toEqual({
      ...DEFAULT_SEARCH,
      difficulty: ["easy"],
      pattern: ["two-pointers"],
    });
  });

  it("reads a number typed in the search box as text (the URL turns ?q=20 into a number)", () => {
    expect(homeSearchSchema.parse({ q: 20 }).q).toBe("20");
  });

  it("says whether anything narrows the list, and clears only the filters", () => {
    expect(isFiltered(DEFAULT_SEARCH)).toBe(false);
    expect(isFiltered({ ...DEFAULT_SEARCH, group: "status", sort: "title", dir: "desc" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_SEARCH, q: "  " })).toBe(false);
    expect(isFiltered({ ...DEFAULT_SEARCH, q: "two" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_SEARCH, concept: ["hash-map"] })).toBe(true);
    const busy = { ...DEFAULT_SEARCH, group: "status" as const, q: "two", status: "pending" as const, difficulty: ["easy" as const], pattern: ["stack"], concept: ["stack"] };
    expect(clearFilters(busy)).toEqual({ ...DEFAULT_SEARCH, group: "status" });
  });

  it("opens a hand-edited link with what is valid in it, and keeps the defaults out of built URLs", async () => {
    const history = createMemoryHistory({ initialEntries: ['/?group=status&dir=sideways&pattern=%5B%22stack%22%5D'] });
    const router = createRouter({ routeTree, history });
    await router.load();
    expect(router.state.matches.at(-1)?.search).toEqual({ ...DEFAULT_SEARCH, group: "status", pattern: ["stack"] });
    expect(router.buildLocation({ to: "/", search: DEFAULT_SEARCH }).href).toBe("/");
    expect(router.buildLocation({ to: "/", search: { ...DEFAULT_SEARCH, group: "status" } }).href).toBe("/?group=status");
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm exec vitest run playground/tests/web/home-search.test.ts`
Expected: FAIL. `../../web/home/search.ts` cannot be resolved.

- [ ] **Step 3: Write the schema and wire the route**

Create `playground/web/home/search.ts`:

```ts
import { z } from "zod";
import { DIFFICULTIES, type Difficulty } from "../lib/labels.ts";

export const GROUP_BY = ["none", "pattern", "concept", "difficulty", "status"] as const;
export type GroupBy = (typeof GROUP_BY)[number];
export const SORT_KEYS = ["num", "title", "difficulty"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
const SORT_DIRS = ["asc", "desc"] as const;
export type SortDir = (typeof SORT_DIRS)[number];
export const STATUS_FILTERS = ["all", "pending", "solved"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** A list from the URL: entries that are not allowed are dropped, the rest kept in order. */
function list<T extends string>(keep: (item: unknown) => item is T) {
  return z
    .array(z.unknown())
    .default([])
    .catch([])
    .transform((items) => items.filter(keep));
}
const isString = (item: unknown): item is string => typeof item === "string";
const isDifficulty = (item: unknown): item is Difficulty => DIFFICULTIES.includes(item as Difficulty);

/**
 * The home page's view, kept in the URL (spec §4.3). A value that does not parse falls back to its default, so a
 * stale or hand-edited link still opens the page. `q` is coerced because the router reads `?q=20` as a number.
 */
export const homeSearchSchema = z.object({
  q: z.coerce.string().default("").catch(""),
  group: z.enum(GROUP_BY).default("pattern").catch("pattern"),
  sort: z.enum(SORT_KEYS).default("num").catch("num"),
  dir: z.enum(SORT_DIRS).default("asc").catch("asc"),
  status: z.enum(STATUS_FILTERS).default("all").catch("all"),
  difficulty: list(isDifficulty),
  pattern: list(isString),
  concept: list(isString),
});

export type HomeSearch = z.output<typeof homeSearchSchema>;

export const DEFAULT_SEARCH: HomeSearch = {
  q: "",
  group: "pattern",
  sort: "num",
  dir: "asc",
  status: "all",
  difficulty: [],
  pattern: [],
  concept: [],
};

/** True when the search box or a filter narrows the list. Grouping and sorting do not count. */
export function isFiltered(search: HomeSearch): boolean {
  return (
    search.q.trim() !== "" ||
    search.status !== "all" ||
    search.difficulty.length > 0 ||
    search.pattern.length > 0 ||
    search.concept.length > 0
  );
}

/** The same view with the search box and every filter cleared. Grouping and sorting stay. */
export function clearFilters(search: HomeSearch): HomeSearch {
  return { ...search, q: "", status: "all", difficulty: [], pattern: [], concept: [] };
}
```

In `playground/web/router.tsx`:
- import `stripSearchParams` and the schema:

```tsx
import { createRootRoute, createRoute, createRouter, Outlet, stripSearchParams } from "@tanstack/react-router";
```

```tsx
import { DEFAULT_SEARCH, homeSearchSchema } from "./home/search.ts";
```

- the home route becomes:

```tsx
export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  // The list's grouping, sorting and filters live in the URL; defaults stay out of it (spec §4.3).
  validateSearch: homeSearchSchema,
  search: { middlewares: [stripSearchParams(DEFAULT_SEARCH)] },
});
```

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm exec vitest run playground/tests/web/home-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing model tests**

Create `playground/tests/web/home-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HomeData, HomeProblem } from "../../server/types.ts";
import {
  conceptRows,
  continueItems,
  facetOptions,
  filterProblems,
  groupProblems,
  problemList,
  sortProblems,
} from "../../web/home/model.ts";
import { DEFAULT_SEARCH, type HomeSearch } from "../../web/home/search.ts";

const problem = (id: string, title: string, extra: Partial<HomeProblem> = {}): HomeProblem => ({
  id,
  title,
  difficulty: "easy",
  patterns: [],
  concepts: [],
  status: "todo",
  inProgress: false,
  error: null,
  ...extra,
});

const DATA: HomeData = {
  problems: [
    problem("lc-0021", "Merge Two Sorted Lists", { patterns: ["linked-list", "two-pointers"], concepts: ["linked-list", "two-pointers"], status: "solved" }),
    problem("lc-0001", "Two Sum", { patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved" }),
    problem("lc-2181", "Merge Nodes in Between Zeros", { difficulty: "medium", patterns: ["linked-list", "two-pointers"], concepts: ["linked-list"], status: "solving", inProgress: true }),
    problem("lc-0035", "Search Insert Position", { patterns: ["binary-search"], concepts: ["binary-search"], inProgress: true }),
    problem("lc-0042", "Trapping Rain Water", { difficulty: "hard", patterns: ["two-pointers"], status: "revealed" }),
    problem("cf-0001", "Watermelon", { difficulty: null }),
  ],
  groups: [],
  concepts: [
    {
      slug: "hash-map",
      title: "Hash map",
      status: "learning",
      error: null,
      exercises: [
        { id: "hash-map/01", title: "First repeat", status: "solved", inProgress: false, error: null },
        { id: "hash-map/02", title: "Most frequent", status: "todo", inProgress: true, error: null },
      ],
    },
  ],
};

const search = (change: Partial<HomeSearch> = {}): HomeSearch => ({ ...DEFAULT_SEARCH, ...change });
const ids = (problems: readonly HomeProblem[]) => problems.map((p) => p.id);
const byNumber = sortProblems(DATA.problems, "num", "asc");

describe("home list model", () => {
  it("groups by pattern alphabetically, puts a problem in each of its patterns, and patternless ones last", () => {
    const groups = groupProblems(byNumber, "pattern", DATA.concepts);
    expect(groups.map((g) => g.label)).toEqual(["Arrays & hashing", "Binary search", "Linked list", "Two pointers", "(no pattern yet)"]);
    expect(ids(groups[2]!.problems)).toEqual(["lc-0021", "lc-2181"]);
    expect(ids(groups[3]!.problems)).toEqual(["lc-0021", "lc-0042", "lc-2181"]);
    expect(ids(groups[4]!.problems)).toEqual(["cf-0001"]);
  });

  it("groups by status in working order, reading a started to-do as in progress", () => {
    const groups = groupProblems(byNumber, "status", DATA.concepts);
    expect(groups.map((g) => [g.label, ids(g.problems)])).toEqual([
      ["In progress", ["lc-0035", "lc-2181"]],
      ["To do", ["cf-0001"]],
      ["Revealed", ["lc-0042"]],
      ["Solved", ["lc-0001", "lc-0021"]],
    ]);
  });

  it("groups by concept, links the concepts that have a page, and puts problems without one last", () => {
    const groups = groupProblems(byNumber, "concept", DATA.concepts);
    expect(groups.map((g) => [g.label, g.conceptSlug])).toEqual([
      ["Binary search", null],
      ["Hash map", "hash-map"],
      ["Linked list", null],
      ["Two pointers", null],
      ["(no concept yet)", null],
    ]);
  });

  it("groups by difficulty from easy to hard, then the ones without a difficulty", () => {
    expect(groupProblems(byNumber, "difficulty", DATA.concepts).map((g) => g.label)).toEqual(["Easy", "Medium", "Hard", "No difficulty"]);
    expect(groupProblems(byNumber, "none", DATA.concepts).map((g) => g.problems.length)).toEqual([6]);
  });

  it("sorts by LeetCode number either way, always with ids that have no number last", () => {
    expect(ids(sortProblems(DATA.problems, "num", "asc"))).toEqual(["lc-0001", "lc-0021", "lc-0035", "lc-0042", "lc-2181", "cf-0001"]);
    expect(ids(sortProblems(DATA.problems, "num", "desc"))).toEqual(["lc-2181", "lc-0042", "lc-0035", "lc-0021", "lc-0001", "cf-0001"]);
  });

  it("sorts by difficulty and by title, breaking ties by number and keeping unknown difficulties last", () => {
    expect(ids(sortProblems(DATA.problems, "difficulty", "asc"))).toEqual(["lc-0001", "lc-0021", "lc-0035", "lc-2181", "lc-0042", "cf-0001"]);
    expect(ids(sortProblems(DATA.problems, "difficulty", "desc"))).toEqual(["lc-0042", "lc-2181", "lc-0001", "lc-0021", "lc-0035", "cf-0001"]);
    expect(ids(sortProblems(DATA.problems, "title", "asc"))).toEqual(["lc-2181", "lc-0021", "lc-0035", "lc-0042", "lc-0001", "cf-0001"]);
  });

  it("filters by search text, number, status and facets; a problem passes a facet when any of its values is picked", () => {
    expect(ids(filterProblems(DATA.problems, search({ q: "35" })))).toEqual(["lc-0035"]);
    expect(ids(filterProblems(DATA.problems, search({ q: "MERGE" })))).toEqual(["lc-0021", "lc-2181"]);
    expect(ids(filterProblems(DATA.problems, search({ status: "pending" })))).toEqual(["lc-2181", "lc-0035", "lc-0042", "cf-0001"]);
    expect(ids(filterProblems(DATA.problems, search({ status: "solved" })))).toEqual(["lc-0021", "lc-0001"]);
    expect(ids(filterProblems(DATA.problems, search({ pattern: ["linked-list", "binary-search"] })))).toEqual(["lc-0021", "lc-2181", "lc-0035"]);
    expect(ids(filterProblems(DATA.problems, search({ difficulty: ["medium", "hard"], concept: ["linked-list"] })))).toEqual(["lc-2181"]);
  });

  it("counts each facet choice against the other filters, and keeps a picked value nobody has", () => {
    expect(facetOptions(DATA, search({ status: "pending", pattern: ["graphs"] }), "pattern")).toEqual([
      { value: "arrays-hashing", label: "Arrays & hashing", count: 0 },
      { value: "binary-search", label: "Binary search", count: 1 },
      { value: "graphs", label: "Graphs", count: 0 },
      { value: "linked-list", label: "Linked list", count: 1 },
      { value: "two-pointers", label: "Two pointers", count: 2 },
    ]);
    expect(facetOptions(DATA, search(), "difficulty")).toEqual([
      { value: "easy", label: "Easy", count: 3 },
      { value: "medium", label: "Medium", count: 1 },
      { value: "hard", label: "Hard", count: 1 },
    ]);
    expect(facetOptions(DATA, search(), "concept").find((o) => o.value === "hash-map")).toEqual({ value: "hash-map", label: "Hash map", count: 1 });
  });

  it("counts a problem once even when it sits in several groups", () => {
    const list = problemList(DATA, search({ pattern: ["two-pointers", "linked-list"] }));
    expect(list.groups.map((g) => [g.label, g.problems.length])).toEqual([
      ["Linked list", 2],
      ["Two pointers", 3],
    ]);
    expect(list.matching).toBe(3);
  });

  it("lists the work in progress to continue, problems first, with where each one belongs", () => {
    expect(continueItems(DATA, "").map((item) => [item.id, item.context])).toEqual([
      ["lc-2181", "Linked list"],
      ["lc-0035", "Binary search"],
      ["hash-map/02", "Hash map"],
    ]);
    expect(continueItems(DATA, "most").map((item) => item.id)).toEqual(["hash-map/02"]);
  });

  it("shows a concept when its name or one of its exercises matches the search", () => {
    expect(conceptRows(DATA, "").map((row) => [row.concept.slug, ids(row.exercises), row.solved])).toEqual([["hash-map", ["hash-map/01", "hash-map/02"], 1]]);
    expect(conceptRows(DATA, "repeat").map((row) => ids(row.exercises))).toEqual([["hash-map/01"]]);
    expect(conceptRows(DATA, "hash").map((row) => ids(row.exercises))).toEqual([["hash-map/01", "hash-map/02"]]);
    expect(conceptRows(DATA, "zzz")).toEqual([]);
  });
});
```

- [ ] **Step 6: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/home-model.test.ts`
Expected: FAIL. `../../web/home/model.ts` cannot be resolved.

- [ ] **Step 7: Write the model**

Create `playground/web/home/model.ts`:

```ts
import type { HomeConcept, HomeData, HomeExercise, HomeProblem, ItemStatus } from "../../server/types.ts";
import {
  conceptLabel,
  DIFFICULTIES,
  type Difficulty,
  difficultyLabel,
  difficultyOf,
  leetcodeNumber,
  patternLabel,
  STATUS_LABEL,
  type StatusKind,
  statusKind,
} from "../lib/labels.ts";
import type { GroupBy, HomeSearch, SortDir, SortKey } from "./search.ts";

export const NO_PATTERN_LABEL = "(no pattern yet)";
export const NO_CONCEPT_LABEL = "(no concept yet)";
export const NO_DIFFICULTY_LABEL = "No difficulty";
const STATUS_ORDER: readonly StatusKind[] = ["in-progress", "todo", "revealed", "solved"];

export interface ProblemGroup {
  /** Stable across renders, e.g. "pattern:two-pointers" or "status:solved". */
  key: string;
  label: string;
  /** The concept's slug when this is a concept group and the concept has a page in concepts/; otherwise null. */
  conceptSlug: string | null;
  problems: HomeProblem[];
}

/** True when the query is part of the id, the title, or the LeetCode number as text ("35" finds lc-0035). */
export function matchesQuery(item: { id: string; title: string }, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (query === "") return true;
  const number = leetcodeNumber(item.id);
  return item.id.toLowerCase().includes(query) || item.title.toLowerCase().includes(query) || (number !== null && String(number).includes(query));
}

export type Facet = "difficulty" | "pattern" | "concept";

const FACET_VALUES: Record<Facet, (problem: HomeProblem) => readonly string[]> = {
  difficulty: (problem) => {
    const difficulty = difficultyOf(problem.difficulty);
    return difficulty ? [difficulty] : [];
  },
  pattern: (problem) => problem.patterns,
  concept: (problem) => problem.concepts,
};
const FACETS: readonly Facet[] = ["difficulty", "pattern", "concept"];

/** The problems that the search box, the status filter and the facet filters let through, in their given order. */
export function filterProblems(problems: readonly HomeProblem[], search: HomeSearch): HomeProblem[] {
  return problems.filter((problem) => {
    if (!matchesQuery(problem, search.q)) return false;
    if (search.status === "solved" && problem.status !== "solved") return false;
    if (search.status === "pending" && problem.status === "solved") return false;
    return FACETS.every((facet) => {
      const picked: readonly string[] = search[facet];
      return picked.length === 0 || FACET_VALUES[facet](problem).some((value) => picked.includes(value));
    });
  });
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

/**
 * The choices of one facet filter. A count is how many problems the other filters let through with that value, so
 * it says what picking the value would show. A value picked in the URL stays listed even when no problem has it,
 * so it can be unpicked.
 */
export function facetOptions(data: HomeData, search: HomeSearch, facet: Facet): FacetOption[] {
  const values = FACET_VALUES[facet];
  const withoutThisFacet: HomeSearch = {
    ...search,
    difficulty: facet === "difficulty" ? [] : search.difficulty,
    pattern: facet === "pattern" ? [] : search.pattern,
    concept: facet === "concept" ? [] : search.concept,
  };
  const others = filterProblems(data.problems, withoutThisFacet);
  const all = new Set<string>([...data.problems.flatMap((problem) => values(problem)), ...search[facet]]);
  const label = (value: string): string => {
    if (facet === "difficulty") return difficultyLabel(value as Difficulty);
    if (facet === "pattern") return patternLabel(value);
    return conceptLabel(value, data.concepts);
  };
  const options = [...all].map((value) => ({ value, label: label(value), count: others.filter((problem) => values(problem).includes(value)).length }));
  if (facet === "difficulty") {
    return options.sort((a, b) => DIFFICULTIES.indexOf(a.value as Difficulty) - DIFFICULTIES.indexOf(b.value as Difficulty));
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/** Missing values (no LeetCode number, no difficulty) always come last, whatever the direction. */
function compareMissingLast(a: number | null, b: number | null, sign: number): number {
  if (a === null || b === null) {
    if (a === b) return 0;
    return a === null ? 1 : -1;
  }
  return sign * (a - b);
}

function difficultyRank(problem: HomeProblem): number | null {
  const difficulty = difficultyOf(problem.difficulty);
  return difficulty ? DIFFICULTIES.indexOf(difficulty) : null;
}

/** A sorted copy. Ties break by LeetCode number, ascending; ids without a number sort after the rest, by id. */
export function sortProblems(problems: readonly HomeProblem[], sort: SortKey, dir: SortDir): HomeProblem[] {
  const sign = dir === "asc" ? 1 : -1;
  const byNumber = (direction: number) => (a: HomeProblem, b: HomeProblem) =>
    compareMissingLast(leetcodeNumber(a.id), leetcodeNumber(b.id), direction) || a.id.localeCompare(b.id);
  const compare = (a: HomeProblem, b: HomeProblem): number => {
    if (sort === "title") return sign * a.title.localeCompare(b.title) || byNumber(1)(a, b);
    if (sort === "difficulty") return compareMissingLast(difficultyRank(a), difficultyRank(b), sign) || byNumber(1)(a, b);
    return byNumber(sign)(a, b);
  };
  return [...problems].sort(compare);
}

interface Bucket {
  key: string;
  label: string;
  conceptSlug: string | null;
  /** Orders groups before their labels do: special groups go last, statuses and difficulties keep their order. */
  rank: number;
}

function bucketsOf(problem: HomeProblem, by: GroupBy, concepts: readonly HomeConcept[]): Bucket[] {
  switch (by) {
    case "none":
      return [{ key: "all", label: "All problems", conceptSlug: null, rank: 0 }];
    case "pattern":
      if (problem.patterns.length === 0) return [{ key: "pattern:", label: NO_PATTERN_LABEL, conceptSlug: null, rank: 1 }];
      return problem.patterns.map((slug) => ({ key: `pattern:${slug}`, label: patternLabel(slug), conceptSlug: null, rank: 0 }));
    case "concept":
      if (problem.concepts.length === 0) return [{ key: "concept:", label: NO_CONCEPT_LABEL, conceptSlug: null, rank: 1 }];
      return problem.concepts.map((slug) => ({
        key: `concept:${slug}`,
        label: conceptLabel(slug, concepts),
        conceptSlug: concepts.some((concept) => concept.slug === slug) ? slug : null,
        rank: 0,
      }));
    case "difficulty": {
      const difficulty = difficultyOf(problem.difficulty);
      if (!difficulty) return [{ key: "difficulty:", label: NO_DIFFICULTY_LABEL, conceptSlug: null, rank: DIFFICULTIES.length }];
      return [{ key: `difficulty:${difficulty}`, label: difficultyLabel(difficulty), conceptSlug: null, rank: DIFFICULTIES.indexOf(difficulty) }];
    }
    case "status": {
      const kind = statusKind(problem.status, problem.inProgress);
      return [{ key: `status:${kind}`, label: STATUS_LABEL[kind], conceptSlug: null, rank: STATUS_ORDER.indexOf(kind) }];
    }
  }
}

/**
 * Splits problems (already filtered and sorted) into groups, keeping their order inside each group. A problem with
 * several patterns or concepts is in each of their groups. Only groups with problems are returned.
 */
export function groupProblems(problems: readonly HomeProblem[], by: GroupBy, concepts: readonly HomeConcept[]): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup & { rank: number }>();
  for (const problem of problems) {
    for (const bucket of bucketsOf(problem, by, concepts)) {
      const group = groups.get(bucket.key) ?? { ...bucket, problems: [] };
      if (!group.problems.includes(problem)) group.problems.push(problem);
      groups.set(bucket.key, group);
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map(({ key, label, conceptSlug, problems: members }) => ({ key, label, conceptSlug, problems: members }));
}

export interface ProblemList {
  groups: ProblemGroup[];
  /** Distinct problems that pass the filters (a problem in two groups counts once). */
  matching: number;
}

export function problemList(data: HomeData, search: HomeSearch): ProblemList {
  const shown = sortProblems(filterProblems(data.problems, search), search.sort, search.dir);
  return { groups: groupProblems(shown, search.group, data.concepts), matching: shown.length };
}

export interface ContinueItem {
  id: string;
  title: string;
  status: ItemStatus;
  inProgress: boolean;
  difficulty: string | null;
  /** The first pattern of a problem, or the concept of an exercise. */
  context: string | null;
}

/** Problems, then exercises, that are in progress and match the search box. */
export function continueItems(data: HomeData, q: string): ContinueItem[] {
  const problems = data.problems
    .filter((p) => p.inProgress)
    .map((p) => ({ id: p.id, title: p.title, status: p.status, inProgress: true, difficulty: p.difficulty, context: p.patterns[0] ? patternLabel(p.patterns[0]) : null }));
  const exercises = data.concepts.flatMap((concept) =>
    concept.exercises
      .filter((e) => e.inProgress)
      .map((e) => ({ id: e.id, title: e.title, status: e.status, inProgress: true, difficulty: null, context: concept.title })),
  );
  return [...problems, ...exercises].filter((item) => matchesQuery(item, q));
}

export interface ConceptRow {
  concept: HomeConcept;
  /** The exercises that match the search box. */
  exercises: HomeExercise[];
  /** Solved exercises of the concept, whatever the search. */
  solved: number;
}

/** A concept shows when its slug or title, or one of its exercises, matches the search box. */
export function conceptRows(data: HomeData, q: string): ConceptRow[] {
  return data.concepts.flatMap((concept) => {
    const exercises = concept.exercises.filter((e) => matchesQuery(e, q));
    const shown = matchesQuery({ id: concept.slug, title: concept.title }, q) || exercises.length > 0;
    return shown ? [{ concept, exercises, solved: concept.exercises.filter((e) => e.status === "solved").length }] : [];
  });
}
```

- [ ] **Step 8: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/home-model.test.ts playground/tests/web/home-search.test.ts`
Expected: PASS.

- [ ] **Step 9: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green. The old home page ignores the search params, so nothing visible changes yet.

```bash
git add playground/web/home/search.ts playground/web/home/model.ts playground/web/router.tsx \
  playground/tests/web/home-search.test.ts playground/tests/web/home-model.test.ts
git commit -m "feat(playground): model the home list and keep its view in the URL"
```

---

### Task 5: home page (header, Continue, grouped table, concepts)

**Files:**
- Create: `playground/web/home/SectionTitle.tsx`, `playground/web/home/HomeHeader.tsx`, `playground/web/home/ContinueCards.tsx`, `playground/web/home/ProblemTable.tsx`, `playground/web/home/ConceptList.tsx`
- Modify: `playground/web/routes/home.tsx` (rewrite)
- Test: `playground/tests/web/home.test.tsx` (rewrite), `playground/e2e/work.spec.ts` (one selector)

**Interfaces:**
- Consumes:
  - Task 4: `problemList`, `continueItems`, `conceptRows`, `ProblemGroup`, `ContinueItem`, `ConceptRow`, `HomeSearch`, `DEFAULT_SEARCH`, `SortKey`, `SortDir`
  - Task 3: `StatusIcon`, `DifficultyBadge`, `ErrorMark`, `Logo`, `patternLabel`, `conceptLabel`, `leetcodeNumber`, `prettifySlug`
  - Task 1: `Hint`, `Badge`, `Input`, `Progress`, `Table*`, `Skeleton`, `Alert*`
  - `targetLink` from `links.ts`
- Produces:
  - `HomeView({ data: HomeData; search: HomeSearch; onSearch(change: Partial<HomeSearch>): void })`
  - `HomePage()`
  - **Roles and names:**
    - regions "Continue", "Problems", "Concepts"
    - searchbox "Search"
    - a group toggle button per group with `aria-expanded`, named `"<label> <count>"`
    - sort buttons "Sort by number", "Sort by title", "Sort by difficulty" inside `columnheader`s carrying `aria-sort` (named so they never clash with the "Difficulty" facet filter of Task 6)
    - a title link per problem row, named by the title
    - a card link per in-progress item, named `"<id> <title>"`
    - an exercise link named `"<id> <title>"`
    - the progress bar "Problems solved"

- [ ] **Step 1: Write the failing tests**

Replace `playground/tests/web/home.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeData } from "../../server/types.ts";
import { keys } from "../../web/api.ts";
import { DEFAULT_SEARCH, type HomeSearch } from "../../web/home/search.ts";
import { HomeView } from "../../web/routes/home.tsx";
import { routeTree } from "../../web/router.tsx";
import { renderWithRouter } from "./render.tsx";

const DATA: HomeData = {
  problems: [
    { id: "lc-0001", title: "Two Sum", difficulty: "easy", patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved", inProgress: false, error: null },
    { id: "lc-0026", title: "Remove Duplicates", difficulty: "easy", patterns: ["two-pointers"], concepts: ["two-pointers"], status: "solving", inProgress: true, error: null },
    { id: "lc-0030", title: "lc-0030-broken", difficulty: null, patterns: [], concepts: [], status: "todo", inProgress: false, error: "frontmatter: bad" },
  ],
  groups: [],
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

/** The home view with its search kept in component state, as the URL keeps it in the app. */
function Harness({ data = DATA, initial = DEFAULT_SEARCH }: { data?: HomeData; initial?: HomeSearch }) {
  const [search, setSearch] = useState(initial);
  return <HomeView data={data} search={search} onSearch={(change) => setSearch((current) => ({ ...current, ...change }))} />;
}

const problemsRegion = () => screen.getByRole("region", { name: "Problems" });
const groupNames = () => within(problemsRegion()).getAllByRole("button", { expanded: true }).map((b) => b.textContent);
const rowTitles = () => within(problemsRegion()).getAllByRole("row").flatMap((row) => within(row).queryAllByRole("link").map((l) => l.textContent));

describe("HomeView", () => {
  it("shows the work in progress as cards, the overall progress, the problems by pattern, and the concepts", async () => {
    await renderWithRouter(<Harness />);
    const progress = screen.getByRole("region", { name: "Continue" });
    expect(within(progress).getByRole("link", { name: "lc-0026 Remove Duplicates" })).toHaveAttribute("href", "/p/lc-0026");
    expect(within(progress).getByRole("link", { name: "hash-map/02 Most frequent" })).toHaveAttribute("href", "/e/hash-map/02");
    expect(screen.getByText("1/3 solved")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Problems solved" })).toBeInTheDocument();

    expect(groupNames()).toEqual(["Arrays & hashing1", "Two pointers1", "(no pattern yet)1"]);
    expect(within(problemsRegion()).getByRole("link", { name: "Two Sum" })).toHaveAttribute("href", "/p/lc-0001");
    expect(within(problemsRegion()).getByRole("img", { name: "Broken README: frontmatter: bad" })).toBeInTheDocument();

    const concepts = screen.getByRole("region", { name: "Concepts" });
    expect(within(concepts).getByRole("link", { name: "Hash map" })).toHaveAttribute("href", "/c/hash-map");
    expect(within(concepts).getByText("1/3 exercises")).toBeInTheDocument();
    expect(within(concepts).getByRole("link", { name: "hash-map/03 Same letters" })).toHaveAttribute("href", "/e/hash-map/03");
  });

  it("sorts the rows when a column header is clicked, and says how they are sorted", async () => {
    await renderWithRouter(<Harness initial={{ ...DEFAULT_SEARCH, group: "none" }} />);
    expect(rowTitles()).toEqual(["Two Sum", "Remove Duplicates", "lc-0030-broken"]);
    expect(screen.getByRole("columnheader", { name: "Sort by number" })).toHaveAttribute("aria-sort", "ascending");

    await userEvent.click(screen.getByRole("button", { name: "Sort by title" }));
    expect(rowTitles()).toEqual(["lc-0030-broken", "Remove Duplicates", "Two Sum"]);
    expect(screen.getByRole("columnheader", { name: "Sort by title" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Sort by number" })).toHaveAttribute("aria-sort", "none");

    await userEvent.click(screen.getByRole("button", { name: "Sort by title" }));
    expect(rowTitles()).toEqual(["Two Sum", "Remove Duplicates", "lc-0030-broken"]);
    expect(screen.getByRole("columnheader", { name: "Sort by title" })).toHaveAttribute("aria-sort", "descending");
  });

  it("folds a group and opens it again", async () => {
    await renderWithRouter(<Harness />);
    const toggle = screen.getByRole("button", { name: /^Arrays & hashing/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Two Sum" })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Two Sum" })).toBeInTheDocument();
  });

  it("filters every section with the search box, and finds a problem by its number", async () => {
    await renderWithRouter(<Harness />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "two");
    expect(screen.getByRole("link", { name: "Two Sum" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Remove Duplicates" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hash map" })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox", { name: "Search" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "26");
    expect(rowTitles()).toEqual(["Remove Duplicates"]);
  });

  it("invites the first problem when there is none", async () => {
    await renderWithRouter(<Harness data={{ problems: [], groups: [], concepts: [] }} />);
    expect(screen.getByText(/No problems yet/)).toBeInTheDocument();
    expect(screen.getByText("No concepts yet.")).toBeInTheDocument();
  });
});

describe("home page", () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the app's toaster follows the system theme with it.
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  async function renderHome(path: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
    client.setQueryData(keys.home, DATA);
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
    await act(() => router.load());
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    return router;
  }

  it("reads the view from the URL, and writes what the user types back to it without losing a character", async () => {
    const router = await renderHome("/?q=remove&group=none");
    const box = await screen.findByRole("searchbox", { name: "Search" });
    expect(box).toHaveValue("remove");
    expect(rowTitles()).toEqual(["Remove Duplicates"]);

    await userEvent.clear(box);
    await userEvent.type(box, "two sum");
    expect(box).toHaveValue("two sum");
    await waitFor(() => expect(router.state.location.search).toEqual({ q: "two sum", group: "none" }));
    expect(rowTitles()).toEqual(["Two Sum"]);
    // Typing replaces the history entry instead of adding one per keystroke.
    expect(router.history.length).toBe(1);
  });
});
```

(`groupNames()` reads `textContent`, which joins the label and the count with no space: `"Arrays & hashing1"`.)

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/home.test.tsx`
Expected: FAIL. `HomeView` takes no `search` prop, there is no "Continue" region, and so on.

- [ ] **Step 3: Write the page pieces**

Create `playground/web/home/SectionTitle.tsx`:

```tsx
import type { ReactNode } from "react";

export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </h2>
  );
}
```

Create `playground/web/home/HomeHeader.tsx`:

```tsx
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "../components/Logo.tsx";
import { Input } from "../components/ui/input.tsx";
import { Progress } from "../components/ui/progress.tsx";

/**
 * The search box. Its text is written to the URL on every keystroke, and the URL's value comes back a moment later.
 * Echoes of what was typed are ignored, so a late echo never overwrites newer text. Any other change (Reset, Back)
 * replaces the text.
 */
function SearchBox({ query, onQuery }: { query: string; onQuery(query: string): void }) {
  const [text, setText] = useState(query);
  const sent = useRef<string[]>([]);
  useEffect(() => {
    const echo = sent.current.indexOf(query);
    if (echo >= 0) {
      sent.current = sent.current.slice(echo + 1);
      return;
    }
    setText(query);
  }, [query]);
  return (
    <div className="relative w-64">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Search"
        placeholder="Search problems…"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          sent.current.push(event.target.value);
          onQuery(event.target.value);
        }}
        className="h-8 pl-7"
      />
    </div>
  );
}

export function HomeHeader({ solved, total, query, onQuery }: { solved: number; total: number; query: string; onQuery(query: string): void }) {
  return (
    <header className="mb-6 flex items-center gap-4">
      <h1 className="flex items-center gap-2 text-base font-semibold">
        <Logo />
        Algorithms
      </h1>
      <SearchBox query={query} onQuery={onQuery} />
      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {solved}/{total} solved
        </span>
        <Progress value={total === 0 ? 0 : (solved / total) * 100} aria-label="Problems solved" className="w-28" />
      </div>
    </header>
  );
}
```

Create `playground/web/home/ContinueCards.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { DifficultyBadge } from "../components/DifficultyBadge.tsx";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { targetLink } from "../links.ts";
import type { ContinueItem } from "./model.ts";
import { SectionTitle } from "./SectionTitle.tsx";

export function ContinueCards({ items }: { items: ContinueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="home-continue" className="mb-8">
      <SectionTitle id="home-continue">Continue</SectionTitle>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              {...targetLink(item.id)}
              aria-label={`${item.id} ${item.title}`}
              className="flex h-full flex-col gap-1.5 rounded-lg border bg-card p-3 transition-colors hover:border-primary/60"
            >
              <span className="flex items-center gap-2">
                <StatusIcon status={item.status} inProgress={item.inProgress} />
                <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                <DifficultyBadge difficulty={item.difficulty} />
              </span>
              <span className="font-medium">{item.title}</span>
              <span className="mt-auto flex items-center text-xs text-muted-foreground">
                {item.context}
                <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-primary">
                  Continue
                  <ChevronRight aria-hidden className="size-3.5" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `playground/web/home/ProblemTable.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { HomeConcept, HomeProblem } from "../../server/types.ts";
import { DifficultyBadge } from "../components/DifficultyBadge.tsx";
import { ErrorMark } from "../components/ErrorMark.tsx";
import { Hint } from "../components/Hint.tsx";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table.tsx";
import { conceptLabel, leetcodeNumber, patternLabel } from "../lib/labels.ts";
import { targetLink } from "../links.ts";
import type { ProblemGroup } from "./model.ts";
import type { SortDir, SortKey } from "./search.ts";

const COLUMNS = 6;

interface ProblemTableProps {
  groups: ProblemGroup[];
  /** False when grouping is "None": the rows show without a group header. */
  grouped: boolean;
  concepts: readonly HomeConcept[];
  sort: SortKey;
  dir: SortDir;
  onSort(key: SortKey): void;
}

function SortHeader({ label, name, column, sort, dir, onSort, className }: { label: string; name: string; column: SortKey; sort: SortKey; dir: SortDir; onSort(key: SortKey): void; className?: string }) {
  const active = sort === column;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <button type="button" aria-label={name} onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <Icon aria-hidden className={cn("size-3", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function ProblemRow({ problem, concepts }: { problem: HomeProblem; concepts: readonly HomeConcept[] }) {
  const number = leetcodeNumber(problem.id);
  const conceptNames = problem.concepts.map((slug) => conceptLabel(slug, concepts)).join(" · ");
  return (
    <TableRow>
      <TableCell className="w-8">
        {problem.error ? <ErrorMark error={problem.error} /> : <StatusIcon status={problem.status} inProgress={problem.inProgress} />}
      </TableCell>
      <TableCell className="w-16 font-mono text-xs text-muted-foreground">{number ?? problem.id}</TableCell>
      <TableCell>
        <Link {...targetLink(problem.id)} className="font-medium hover:underline">
          {problem.title}
        </Link>
      </TableCell>
      <TableCell>
        <DifficultyBadge difficulty={problem.difficulty} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {problem.patterns.map((slug) => (
            <Badge key={slug} variant="outline">
              {patternLabel(slug)}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="max-w-56 text-xs text-muted-foreground">
        {conceptNames && (
          <Hint label={conceptNames}>
            <span className="block truncate">{conceptNames}</span>
          </Hint>
        )}
      </TableCell>
    </TableRow>
  );
}

function GroupRows({ group, grouped, concepts }: { group: ProblemGroup; grouped: boolean; concepts: readonly HomeConcept[] }) {
  // Folded state lives here only: it resets on reload, and a new grouping starts with every group open (spec §4.3).
  const [open, setOpen] = useState(true);
  return (
    <TableBody>
      {grouped && (
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableCell colSpan={COLUMNS} className="py-1">
            <div className="flex items-center gap-2">
              <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 font-semibold">
                {open ? <ChevronDown aria-hidden className="size-3.5" /> : <ChevronRight aria-hidden className="size-3.5" />}
                {group.label}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">{group.problems.length}</span>
              </button>
              {group.conceptSlug && (
                <Link to="/c/$slug" params={{ slug: group.conceptSlug }} aria-label={`Open the ${group.label} concept`} className="text-muted-foreground hover:text-foreground">
                  <BookOpen aria-hidden className="size-3.5" />
                </Link>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
      {open && group.problems.map((problem) => <ProblemRow key={problem.id} problem={problem} concepts={concepts} />)}
    </TableBody>
  );
}

/** The problems as one compact table: a section per group, and headers that sort inside every group. */
export function ProblemTable({ groups, grouped, concepts, sort, dir, onSort }: ProblemTableProps) {
  const header = { sort, dir, onSort };
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Status</span>
            </TableHead>
            <SortHeader label="#" name="Sort by number" column="num" className="w-16" {...header} />
            <SortHeader label="Title" name="Sort by title" column="title" {...header} />
            <SortHeader label="Difficulty" name="Sort by difficulty" column="difficulty" {...header} />
            <TableHead>Patterns</TableHead>
            <TableHead>Concepts</TableHead>
          </TableRow>
        </TableHeader>
        {groups.map((group) => (
          <GroupRows key={group.key} group={group} grouped={grouped} concepts={concepts} />
        ))}
      </Table>
    </div>
  );
}
```

Create `playground/web/home/ConceptList.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { ErrorMark } from "../components/ErrorMark.tsx";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Progress } from "../components/ui/progress.tsx";
import { prettifySlug } from "../lib/labels.ts";
import { targetLink } from "../links.ts";
import type { ConceptRow } from "./model.ts";
import { SectionTitle } from "./SectionTitle.tsx";

export function ConceptList({ rows, hasConcepts }: { rows: ConceptRow[]; hasConcepts: boolean }) {
  return (
    <section aria-labelledby="home-concepts" className="mb-8">
      <SectionTitle id="home-concepts">Concepts</SectionTitle>
      {!hasConcepts && <p className="text-muted-foreground">No concepts yet.</p>}
      {rows.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map(({ concept, exercises, solved }) => (
            <li key={concept.slug} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <BookOpen aria-hidden className="size-4 text-muted-foreground" />
                <Link to="/c/$slug" params={{ slug: concept.slug }} className="font-medium hover:underline">
                  {concept.title}
                </Link>
                <Badge variant="secondary">{prettifySlug(concept.status)}</Badge>
                {concept.error && <ErrorMark error={concept.error} />}
                <span className="ml-auto text-xs text-muted-foreground">
                  {solved}/{concept.exercises.length} exercises
                </span>
                <Progress
                  value={concept.exercises.length === 0 ? 0 : (solved / concept.exercises.length) * 100}
                  aria-label={`${concept.title} exercises solved`}
                  className="w-20"
                />
              </div>
              {exercises.length > 0 && (
                <ul className="mt-1.5 ml-6 space-y-1">
                  {exercises.map((exercise) => (
                    <li key={exercise.id} className="flex items-center gap-2">
                      <StatusIcon status={exercise.status} inProgress={exercise.inProgress} />
                      <Link {...targetLink(exercise.id)} className="hover:underline">
                        <span className="font-mono text-xs text-muted-foreground">{exercise.id}</span> {exercise.title}
                      </Link>
                      {exercise.error && <ErrorMark error={exercise.error} />}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Write the page**

Replace `playground/web/routes/home.tsx` with:

```tsx
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Inbox, TriangleAlert } from "lucide-react";
import type { HomeData } from "../../server/types.ts";
import { homeQuery } from "../api.ts";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { ConceptList } from "../home/ConceptList.tsx";
import { ContinueCards } from "../home/ContinueCards.tsx";
import { HomeHeader } from "../home/HomeHeader.tsx";
import { conceptRows, continueItems, problemList } from "../home/model.ts";
import { ProblemTable } from "../home/ProblemTable.tsx";
import type { HomeSearch, SortKey } from "../home/search.ts";
import { SectionTitle } from "../home/SectionTitle.tsx";

const route = getRouteApi("/");

export interface HomeViewProps {
  data: HomeData;
  search: HomeSearch;
  /** Changes part of the view; the page writes it to the URL. */
  onSearch(change: Partial<HomeSearch>): void;
}

export function HomeView({ data, search, onSearch }: HomeViewProps) {
  const list = problemList(data, search);
  const solved = data.problems.filter((problem) => problem.status === "solved").length;
  const sortBy = (key: SortKey) => onSearch(search.sort === key ? { dir: search.dir === "asc" ? "desc" : "asc" } : { sort: key, dir: "asc" });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-6 text-[13px]">
      <HomeHeader solved={solved} total={data.problems.length} query={search.q} onQuery={(q) => onSearch({ q })} />
      <ContinueCards items={continueItems(data, search.q)} />
      <section aria-labelledby="home-problems" className="mb-8">
        <SectionTitle id="home-problems">Problems</SectionTitle>
        {data.problems.length === 0 ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Inbox aria-hidden className="size-4" />
            No problems yet. Paste one into Claude Code to start.
          </p>
        ) : (
          <ProblemTable groups={list.groups} grouped={search.group !== "none"} concepts={data.concepts} sort={search.sort} dir={search.dir} onSort={sortBy} />
        )}
      </section>
      <ConceptList rows={conceptRows(data, search.q)} hasConcepts={data.concepts.length > 0} />
    </main>
  );
}

function HomeSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
      <Skeleton className="mb-6 h-8 w-80" />
      <div className="mb-8 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
    </main>
  );
}

export function HomePage() {
  const home = useQuery(homeQuery());
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/" });
  // The search box replaces the history entry, so typing does not add one per keystroke. Other changes push one,
  // so Back returns to the previous view.
  const onSearch = (change: Partial<HomeSearch>) => void navigate({ search: (current) => ({ ...current, ...change }), replace: "q" in change });

  if (home.isPending) return <HomeSkeleton />;
  if (home.isError) {
    return (
      <Alert variant="destructive" className="m-6 w-auto">
        <TriangleAlert aria-hidden />
        <AlertTitle>Could not load the problems</AlertTitle>
        <AlertDescription>{home.error.message}</AlertDescription>
      </Alert>
    );
  }
  return <HomeView data={home.data} search={search} onSearch={onSearch} />;
}
```

In `playground/e2e/work.spec.ts`, the first test's link becomes the title link:

```ts
  await page.getByRole("link", { name: "Two Sum" }).click();
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/home.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green.

```bash
git add playground/web/home playground/web/routes/home.tsx playground/tests/web/home.test.tsx playground/e2e/work.spec.ts
git commit -m "feat(playground): rebuild the home page as cards and a grouped, sortable table"
```

---

### Task 6: home toolbar (group by, status, facets, reset) and the empty result

**Files:**
- Create: `playground/web/home/FacetFilter.tsx`, `playground/web/home/ProblemToolbar.tsx`, `playground/e2e/home.spec.ts`
- Modify: `playground/web/routes/home.tsx`, `playground/e2e/fixture.ts`
- Test: `playground/tests/web/home.test.tsx` (append), `playground/e2e/home.spec.ts`

**Interfaces:**
- Consumes:
  - Task 4: `facetOptions`, `FacetOption`, `GROUP_BY`, `GroupBy`, `StatusFilter`, `isFiltered`, `clearFilters`
  - Task 3: `Difficulty`
  - Task 1: `Select*`, `ToggleGroup*`, `Popover*`, `Command*`, `Separator`, `Badge`, `Button`
- Produces:
  - `ProblemToolbar({ data: HomeData; search: HomeSearch; onSearch(change: Partial<HomeSearch>): void })`
  - `FacetFilter({ title: string; options: FacetOption[]; picked: readonly string[]; onChange(next: string[]): void })`
  - **Roles and names:**
    - combobox "Group by"
    - radiogroup "Status" with radios "All", "Pending", "Solved"
    - buttons "Difficulty", "Pattern", "Concept" (plus the picked labels)
    - options named `"<label> <count>"`
    - button "Reset"
    - text "No problems match" with button "Clear filters"

- [ ] **Step 1: Write the failing tests**

Append to `playground/tests/web/home.test.tsx`, inside `describe("HomeView", …)` (before its closing `});`):

```tsx
  it("regroups the problems by status", async () => {
    await renderWithRouter(<Harness />);
    await userEvent.click(screen.getByRole("combobox", { name: "Group by" }));
    await userEvent.click(await screen.findByRole("option", { name: "Status" }));
    expect(groupNames()).toEqual(["In progress1", "To do1", "Solved1"]);
  });

  it("shows only what is still pending", async () => {
    await renderWithRouter(<Harness />);
    await userEvent.click(screen.getByRole("radio", { name: "Pending" }));
    expect(rowTitles()).toEqual(["Remove Duplicates", "lc-0030-broken"]);
    expect(screen.getByRole("radio", { name: "Pending" })).toHaveAttribute("aria-checked", "true");
  });

  it("filters by difficulty, counting what each choice would show", async () => {
    await renderWithRouter(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Difficulty" }));
    await userEvent.click(await screen.findByRole("option", { name: "Easy 2" }));
    expect(rowTitles()).toEqual(["Two Sum", "Remove Duplicates"]);
    expect(screen.getByRole("button", { name: /^Difficulty/ })).toHaveTextContent("Easy");
  });

  it("Reset clears the search and the filters but keeps the grouping", async () => {
    await renderWithRouter(<Harness initial={{ ...DEFAULT_SEARCH, group: "status", q: "two", status: "solved" }} />);
    expect(rowTitles()).toEqual(["Two Sum"]);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
    expect(groupNames()).toEqual(["In progress1", "To do1", "Solved1"]);
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("says when nothing matches and clears the filters on request", async () => {
    await renderWithRouter(<Harness initial={{ ...DEFAULT_SEARCH, pattern: ["graphs"] }} />);
    expect(screen.getByText("No problems match")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowTitles()).toEqual(["Two Sum", "Remove Duplicates", "lc-0030-broken"]);
  });
```

Add `"problems/lc-0020-valid-parentheses/README.md"` to the e2e repo. In `playground/e2e/fixture.ts`, add this constant before `const FILES`:

```ts
const SECOND_README = `---
id: lc-0020
title: Valid Parentheses
source: leetcode
url: https://leetcode.com/problems/valid-parentheses/
difficulty: easy
patterns: [stack]
concepts: [stack]
status: solved
hints: 0
solution_revealed: false
solved_in: [py]
complexity: null
---
# 20. Valid Parentheses

## Statement

Say whether every bracket in \`s\` is closed in the right order.
`;
```

and add it to `FILES`:

```ts
  "problems/lc-0020-valid-parentheses/README.md": SECOND_README,
```

Create `playground/e2e/home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { resetRepo } from "./fixture.ts";

test.beforeEach(() => resetRepo());

test("the home view lives in the URL: grouping and filters survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Group by" }).click();
  await page.getByRole("option", { name: "Status" }).click();
  await expect(page).toHaveURL(/group=status/);
  await expect(page.getByRole("button", { name: /^To do/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Solved/ })).toBeVisible();

  await page.getByRole("radio", { name: "Pending" }).click();
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Group by" })).toHaveText("Status");
  await expect(page.getByRole("radio", { name: "Pending" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("link", { name: "Two Sum" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toHaveCount(0);
});

test("the search box finds a problem by its LeetCode number", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search" }).fill("20");
  await expect(page.getByRole("link", { name: "Valid Parentheses" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Two Sum" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveValue("20");
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/home.test.tsx`
Expected: FAIL. There is no combobox "Group by", no radio "Pending", no button "Difficulty", no "Reset" and no "No problems match".

Run: `pnpm e2e -g "home view lives|LeetCode number"`
Expected: FAIL. The first test cannot find the combobox "Group by".

- [ ] **Step 3: Write the facet filter**

Create `playground/web/home/FacetFilter.tsx`:

```tsx
import { cn } from "cn";
import { Check, CirclePlus } from "lucide-react";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../components/ui/command.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.tsx";
import { Separator } from "../components/ui/separator.tsx";
import type { FacetOption } from "./model.ts";

interface FacetFilterProps {
  title: string;
  options: FacetOption[];
  picked: readonly string[];
  onChange(next: string[]): void;
}

/** A multi-select filter with counts, as in shadcn's data-table example. */
export function FacetFilter({ title, options, picked, onChange }: FacetFilterProps) {
  const toggle = (value: string) => onChange(picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value]);
  const pickedLabels = options.filter((option) => picked.includes(option.value)).map((option) => option.label);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(picked.length === 0 && "border-dashed")}>
          <CirclePlus aria-hidden />
          {title}
          {picked.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-3.5" />
              <Badge variant="secondary">{picked.length > 2 ? `${picked.length} selected` : pickedLabels.join(", ")}</Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const on = picked.includes(option.value);
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <span
                      aria-hidden
                      className={cn("flex size-3.5 items-center justify-center rounded-sm border", on ? "border-primary bg-primary text-primary-foreground" : "opacity-60")}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span>{option.label}</span>{" "}
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">{option.count}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {picked.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className="justify-center">
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Write the toolbar**

Create `playground/web/home/ProblemToolbar.tsx`:

```tsx
import { X } from "lucide-react";
import type { HomeData } from "../../server/types.ts";
import { Button } from "../components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.tsx";
import type { Difficulty } from "../lib/labels.ts";
import { FacetFilter } from "./FacetFilter.tsx";
import { facetOptions } from "./model.ts";
import { clearFilters, GROUP_BY, type GroupBy, type HomeSearch, isFiltered, STATUS_FILTERS, type StatusFilter } from "./search.ts";

const GROUP_LABEL: Record<GroupBy, string> = { none: "None", pattern: "Pattern", concept: "Concept", difficulty: "Difficulty", status: "Status" };
const STATUS_LABEL: Record<StatusFilter, string> = { all: "All", pending: "Pending", solved: "Solved" };

interface ProblemToolbarProps {
  data: HomeData;
  search: HomeSearch;
  onSearch(change: Partial<HomeSearch>): void;
}

export function ProblemToolbar({ data, search, onSearch }: ProblemToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span aria-hidden className="text-xs text-muted-foreground">
        Group by
      </span>
      <Select value={search.group} onValueChange={(group) => onSearch({ group: group as GroupBy })}>
        <SelectTrigger size="sm" aria-label="Group by" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUP_BY.map((group) => (
            <SelectItem key={group} value={group}>
              {GROUP_LABEL[group]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Status"
        value={search.status}
        onValueChange={(status) => {
          // Radix lets a click on the active item clear the value; the filter always has one.
          if (status) onSearch({ status: status as StatusFilter });
        }}
      >
        {STATUS_FILTERS.map((status) => (
          <ToggleGroupItem key={status} value={status}>
            {STATUS_LABEL[status]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FacetFilter
        title="Difficulty"
        options={facetOptions(data, search, "difficulty")}
        picked={search.difficulty}
        onChange={(difficulty) => onSearch({ difficulty: difficulty as Difficulty[] })}
      />
      <FacetFilter title="Pattern" options={facetOptions(data, search, "pattern")} picked={search.pattern} onChange={(pattern) => onSearch({ pattern })} />
      <FacetFilter title="Concept" options={facetOptions(data, search, "concept")} picked={search.concept} onChange={(concept) => onSearch({ concept })} />
      {isFiltered(search) && (
        <Button variant="ghost" size="sm" onClick={() => onSearch(clearFilters(search))}>
          Reset
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Put the toolbar and the empty result on the page**

In `playground/web/routes/home.tsx`:
- add the imports:

```tsx
import { SearchX } from "lucide-react";
import { Button } from "../components/ui/button.tsx";
import { ProblemToolbar } from "../home/ProblemToolbar.tsx";
import { clearFilters } from "../home/search.ts";
```

  Merge `SearchX` into the existing `lucide-react` import: `import { Inbox, SearchX, TriangleAlert } from "lucide-react";`. Merge `clearFilters` into the `../home/search.ts` import as `import { clearFilters, type HomeSearch, type SortKey } from "../home/search.ts";`.
- replace the problems section's content (the `data.problems.length === 0 ? … : …` expression) with:

```tsx
        {data.problems.length === 0 ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Inbox aria-hidden className="size-4" />
            No problems yet. Paste one into Claude Code to start.
          </p>
        ) : (
          <>
            <ProblemToolbar data={data} search={search} onSearch={onSearch} />
            {list.matching === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <SearchX aria-hidden className="size-5 text-muted-foreground" />
                <p className="font-medium">No problems match</p>
                <Button variant="outline" size="sm" onClick={() => onSearch(clearFilters(search))}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <ProblemTable groups={list.groups} grouped={search.group !== "none"} concepts={data.concepts} sort={search.sort} dir={search.dir} onSort={sortBy} />
            )}
          </>
        )}
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/home.test.tsx`
Expected: PASS.

Run: `pnpm e2e -g "home view lives|LeetCode number"`
Expected: PASS.

- [ ] **Step 7: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green.

```bash
git add playground/web/home/FacetFilter.tsx playground/web/home/ProblemToolbar.tsx playground/web/routes/home.tsx \
  playground/tests/web/home.test.tsx playground/e2e/fixture.ts playground/e2e/home.spec.ts
git commit -m "feat(playground): group, filter and reset the home list from a toolbar"
```

---
### Task 7: work view header, status bar and notices

**Files:**
- Create: `playground/web/components/StatusBar.tsx`, `playground/web/work/WorkHeader.tsx`
- Modify: `playground/web/routes/work.tsx` (rewrite of the header, notices and layout; the workspace logic is unchanged)
- Test: `playground/tests/web/status-bar.test.tsx`, `playground/tests/web/work-header.test.tsx`, `playground/e2e/work.spec.ts`, `playground/e2e/live.spec.ts`, `playground/e2e/restart.spec.ts`

**Interfaces:**
- Consumes:
  - Task 3: `shortcut`, `STATUS_LABEL`, `statusKind`, `StatusKind`, `patternLabel`, `conceptLabel`, `DifficultyBadge`, `Logo`
  - Task 1: `Hint`, `Breadcrumb*`, `ToggleGroup*`, `Button`, `Badge`, `Kbd`, `Alert*`
  - `homeQuery` from `api.ts`
  - `useConnected` from `events.tsx`
  - `SaveState` from `hooks/useSolutionSync.ts`
  - `LANGS` from `runner/src/types.ts`
- Produces, in `components/StatusBar.tsx`:
  - `type SaveTone = "ok" | "busy" | "bad" | "warn"`
  - `interface SaveLabel { text: string; tone: SaveTone }`
  - `solutionSaveLabel(state: SaveState, connected: boolean): SaveLabel`
  - `interface Shortcut { keys: string; label: string }`
  - `StatusBar({ subject: string; save: SaveLabel; shortcuts: readonly Shortcut[] })`: a `<footer aria-label="Status bar">` holding `role="status"` named "Save status"
- Produces, in `work/WorkHeader.tsx`:
  - `interface WorkHeaderProps { target: TargetData; lang: Lang; onLang(lang: Lang): void; running: boolean; elapsedMs: number; canRun: boolean; onRun(): void; langLock: string | null }`
  - `WorkHeader(props: WorkHeaderProps)`
  - `middleCrumbs(target: TargetData, home: HomeData | undefined)`
  - **Roles and names:**
    - navigation "breadcrumb", with the link "Algorithms" and the page crumb `aria-current="page"`
    - radiogroup "Language" with radios "py" and "ts"
    - button "Run" (or "Running… 1.2 s")
    - link "Open the original problem"

- [ ] **Step 1: Write the failing tests**

Create `playground/tests/web/status-bar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { solutionSaveLabel, StatusBar } from "../../web/components/StatusBar.tsx";

describe("status bar", () => {
  it("says whether the file is saved, and that text typed while the server is down is not", () => {
    expect(solutionSaveLabel("saved", true)).toEqual({ text: "Saved", tone: "ok" });
    expect(solutionSaveLabel("pending", true)).toEqual({ text: "Saving…", tone: "busy" });
    expect(solutionSaveLabel("saving", true)).toEqual({ text: "Saving…", tone: "busy" });
    expect(solutionSaveLabel("pending", false)).toEqual({ text: "Not saved", tone: "bad" });
    expect(solutionSaveLabel("error", true)).toEqual({ text: "Not saved", tone: "bad" });
    expect(solutionSaveLabel("conflict", true)).toEqual({ text: "Conflict", tone: "warn" });
    expect(solutionSaveLabel("loading", true)).toEqual({ text: "Loading…", tone: "busy" });
  });

  it("shows the connection, the file, the save state and the shortcuts", () => {
    render(<StatusBar subject="Python · solution.py" save={{ text: "Saved", tone: "ok" }} shortcuts={[{ keys: "Ctrl+Enter", label: "Run" }]} />);
    const bar = screen.getByRole("contentinfo", { name: "Status bar" });
    expect(bar).toHaveTextContent("Connected");
    expect(bar).toHaveTextContent("Python · solution.py");
    expect(screen.getByRole("status", { name: "Save status" })).toHaveTextContent("Saved");
    expect(screen.getByText("Ctrl+Enter")).toBeInTheDocument();
  });
});
```

Create `playground/tests/web/work-header.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomeData, TargetData } from "../../server/types.ts";
import { keys } from "../../web/api.ts";
import { WorkHeader, type WorkHeaderProps } from "../../web/work/WorkHeader.tsx";
import { renderWithRouter } from "./render.tsx";

const target = (extra: Partial<TargetData> = {}): TargetData => ({
  id: "lc-0021",
  kind: "problem",
  title: "Merge Two Sorted Lists",
  readme: "problems/lc-0021-merge-two-sorted-lists/README.md",
  markdown: "",
  readmeError: null,
  difficulty: "medium",
  url: "https://leetcode.com/problems/merge-two-sorted-lists/",
  status: "solving",
  hints: 1,
  signature: null,
  exampleInput: null,
  caseError: null,
  solutions: { py: true, ts: false },
  ...extra,
});

const HOME: HomeData = {
  problems: [
    { id: "lc-0021", title: "Merge Two Sorted Lists", difficulty: "medium", patterns: ["linked-list", "two-pointers"], concepts: [], status: "solving", inProgress: true, error: null },
  ],
  groups: [],
  concepts: [{ slug: "hash-map", title: "Hash map", status: "learning", error: null, exercises: [] }],
};

afterEach(() => vi.unstubAllGlobals());

async function renderHeader(data: TargetData, home: HomeData | null, props: Partial<WorkHeaderProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  if (home) client.setQueryData(keys.home, home);
  else vi.stubGlobal("fetch", () => new Promise(() => {})); // the home data never arrives
  const handlers = { onLang: vi.fn(), onRun: vi.fn() };
  await renderWithRouter(
    <QueryClientProvider client={client}>
      <WorkHeader target={data} lang="py" running={false} elapsedMs={0} canRun langLock={null} {...handlers} {...props} />
    </QueryClientProvider>,
  );
  return handlers;
}

const trailLinks = () => within(screen.getByRole("navigation", { name: "breadcrumb" })).getAllByRole("link");

describe("WorkHeader", () => {
  it("shows where a problem sits: home, its first pattern, then the problem itself", async () => {
    await renderHeader(target(), HOME);
    const links = trailLinks();
    expect(links.map((link) => link.textContent)).toEqual(["Algorithms", "Linked list", "lc-0021 Merge Two Sorted Lists"]);
    expect(links[0]).toHaveAttribute("href", "/");
    expect(new URL(links[1]!.getAttribute("href")!, "http://localhost").searchParams.get("pattern")).toBe('["linked-list"]');
    expect(links[2]).toHaveAttribute("aria-current", "page");
  });

  it("shows where an exercise sits: home, Concepts, its concept, then the exercise", async () => {
    await renderHeader(target({ id: "hash-map/01", kind: "exercise", title: "First repeat", difficulty: null, url: null }), HOME);
    expect(trailLinks().map((link) => link.textContent)).toEqual(["Algorithms", "Hash map", "01 First repeat"]);
    expect(trailLinks()[1]).toHaveAttribute("href", "/c/hash-map");
    expect(within(screen.getByRole("navigation", { name: "breadcrumb" })).getByText("Concepts")).toBeInTheDocument();
  });

  it("leaves the middle of the trail out until the home data is there", async () => {
    await renderHeader(target(), null);
    expect(trailLinks().map((link) => link.textContent)).toEqual(["Algorithms", "lc-0021 Merge Two Sorted Lists"]);
  });

  it("shows the difficulty, the status, the hints and the original link", async () => {
    await renderHeader(target(), HOME);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("1 hint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the original problem" })).toHaveAttribute("href", "https://leetcode.com/problems/merge-two-sorted-lists/");
  });

  it("switches the language and runs the tests", async () => {
    const { onLang, onRun } = await renderHeader(target(), HOME);
    await userEvent.click(screen.getByRole("radio", { name: "ts" }));
    expect(onLang).toHaveBeenCalledWith("ts");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("locks the language switch and says why when nothing would save the text", async () => {
    await renderHeader(target(), HOME, { langLock: "Resolve the conflict first" });
    expect(screen.getByRole("radio", { name: "ts" })).toBeDisabled();
    await userEvent.hover(screen.getByRole("radiogroup", { name: "Language" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Resolve the conflict first");
  });

  it("shows the run time while the tests run", async () => {
    await renderHeader(target(), HOME, { running: true, canRun: false, elapsedMs: 1234 });
    expect(screen.getByRole("button", { name: "Running… 1.2 s" })).toBeDisabled();
  });
});
```

Update the end-to-end tests to the new names:

In `playground/e2e/work.spec.ts`:
- in `"shows what a failing example expected and what the code returned"`: `await page.getByRole("button", { name: "Run", exact: true }).click();`
- in `"switching to TypeScript opens solution.ts with its stub"`: `await page.getByRole("radio", { name: "ts" }).click();`
- the conflict test ends with:

```ts
  await expect(page.getByText(/changed on disk/)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("radio", { name: "ts" })).toBeDisabled();
  await page.getByRole("radiogroup", { name: "Language" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("Resolve the conflict first");
});
```

- append:

```ts
test("the status bar shows the connection, the file and the shortcuts", async ({ page }) => {
  await page.goto("/p/lc-0001");
  const bar = page.getByRole("contentinfo", { name: "Status bar" });
  await expect(bar).toContainText("Connected");
  await expect(bar).toContainText("Python · solution.py");
  await expect(bar).toContainText(/(⌘↵|Ctrl\+Enter)\s*Run/);
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
});
```

In `playground/e2e/live.spec.ts`:
- both `toHaveText("✓ saved")` become `toHaveText("Saved")`.
- `toHaveText("✕ not saved")` becomes `toHaveText("Not saved")`.
- in `"leaving with an edit the server could not save asks first…"`, replace the three `tsTab` lines with:

```ts
  await expect(page.getByRole("radio", { name: "ts" })).toBeDisabled();
  await page.getByRole("radiogroup", { name: "Language" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("Not saved yet: press ⌘S to retry first");
```

- both `page.getByRole("link", { name: "← Home" })` become `page.getByRole("link", { name: "Algorithms" })`.

In `playground/e2e/restart.spec.ts`:
- `toHaveText("✕ not saved")` becomes `toHaveText("Not saved")`.
- both `toHaveText("✓ saved")` become `toHaveText("Saved")`.
- `page.getByRole("tab", { name: "ts", exact: true })` becomes `page.getByRole("radio", { name: "ts" })`.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/status-bar.test.tsx playground/tests/web/work-header.test.tsx`
Expected: FAIL. `StatusBar.tsx` and `work/WorkHeader.tsx` cannot be resolved.

- [ ] **Step 3: Write the status bar**

Create `playground/web/components/StatusBar.tsx`:

```tsx
import { cn } from "cn";
import { Check, CircleX, LoaderCircle, type LucideIcon, TriangleAlert } from "lucide-react";
import { useConnected } from "../events.tsx";
import type { SaveState } from "../hooks/useSolutionSync.ts";
import { Kbd } from "./ui/kbd.tsx";

export type SaveTone = "ok" | "busy" | "bad" | "warn";

export interface SaveLabel {
  text: string;
  tone: SaveTone;
}

const TONE: Record<SaveTone, { Icon: LucideIcon; className: string; iconClassName: string }> = {
  ok: { Icon: Check, className: "text-muted-foreground", iconClassName: "text-success" },
  busy: { Icon: LoaderCircle, className: "text-muted-foreground", iconClassName: "animate-spin" },
  bad: { Icon: CircleX, className: "text-destructive", iconClassName: "" },
  warn: { Icon: TriangleAlert, className: "text-warning", iconClassName: "" },
};

/** What the status bar says about solution.<ext>. Text typed while the server is down is not saved, whatever the state. */
export function solutionSaveLabel(state: SaveState, connected: boolean): SaveLabel {
  if (!connected && (state === "pending" || state === "saving")) return { text: "Not saved", tone: "bad" };
  switch (state) {
    case "loading":
      return { text: "Loading…", tone: "busy" };
    case "saved":
      return { text: "Saved", tone: "ok" };
    case "pending":
    case "saving":
      return { text: "Saving…", tone: "busy" };
    case "error":
      return { text: "Not saved", tone: "bad" };
    case "conflict":
      return { text: "Conflict", tone: "warn" };
  }
}

export interface Shortcut {
  keys: string;
  label: string;
}

/** A VS Code-like bar at the bottom of a page that edits a file: connection, what is edited, save state, shortcuts. */
export function StatusBar({ subject, save, shortcuts }: { subject: string; save: SaveLabel; shortcuts: readonly Shortcut[] }) {
  const connected = useConnected();
  const { Icon, className, iconClassName } = TONE[save.tone];
  return (
    <footer aria-label="Status bar" className="flex h-6 shrink-0 items-center gap-4 border-t bg-card px-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-warning")} />
        {connected ? "Connected" : "Reconnecting…"}
      </span>
      <span>{subject}</span>
      <span role="status" aria-label="Save status" className={cn("flex items-center gap-1", className)}>
        <Icon aria-hidden className={cn("size-3", iconClassName)} />
        {save.text}
      </span>
      <span className="ml-auto flex items-center gap-3">
        {shortcuts.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <Kbd>{item.keys}</Kbd>
            {item.label}
          </span>
        ))}
      </span>
    </footer>
  );
}
```

- [ ] **Step 4: Write the header**

Create `playground/web/work/WorkHeader.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Lightbulb, LoaderCircle, Play } from "lucide-react";
import { Fragment } from "react";
import { type Lang, LANGS } from "../../../runner/src/types.ts";
import type { HomeData, TargetData } from "../../server/types.ts";
import { homeQuery } from "../api.ts";
import { DifficultyBadge } from "../components/DifficultyBadge.tsx";
import { Hint } from "../components/Hint.tsx";
import { Logo } from "../components/Logo.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/ui/breadcrumb.tsx";
import { Button } from "../components/ui/button.tsx";
import { Kbd } from "../components/ui/kbd.tsx";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.tsx";
import { shortcut } from "../lib/keys.ts";
import { conceptLabel, patternLabel, STATUS_LABEL, type StatusKind, statusKind } from "../lib/labels.ts";

export interface WorkHeaderProps {
  target: TargetData;
  lang: Lang;
  onLang(lang: Lang): void;
  running: boolean;
  /** Time since Run, shown on the button while running. */
  elapsedMs: number;
  canRun: boolean;
  onRun(): void;
  /** Why the language cannot change now (text that is not on disk and nothing will save by itself), or null. */
  langLock: string | null;
}

type Crumb = { label: string; pattern: string } | { label: string; concept: string } | { label: string };

/** The crumbs between "Algorithms" and the page. They need the home data (patterns, concept titles) and wait for it. */
export function middleCrumbs(target: TargetData, home: HomeData | undefined): Crumb[] {
  if (!home) return [];
  if (target.kind === "exercise") {
    const slug = target.id.slice(0, target.id.indexOf("/"));
    return [{ label: "Concepts" }, { label: conceptLabel(slug, home.concepts), concept: slug }];
  }
  const pattern = home.problems.find((problem) => problem.id === target.id)?.patterns[0];
  return pattern ? [{ label: patternLabel(pattern), pattern }] : [];
}

const STATUS_BADGE: Record<StatusKind, "warning" | "outline" | "secondary" | "default"> = {
  "in-progress": "warning",
  todo: "outline",
  revealed: "secondary",
  solved: "default",
};

function LanguageSwitch({ lang, onLang, lock }: { lang: Lang; onLang(lang: Lang): void; lock: string | null }) {
  const group = (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Language"
      value={lang}
      onValueChange={(value) => {
        // Radix lets a click on the active item clear the value; a language is always chosen.
        if (value === "py" || value === "ts") onLang(value);
      }}
    >
      {LANGS.map((value) => (
        <ToggleGroupItem key={value} value={value} disabled={lock !== null} className="font-mono">
          {value}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
  if (lock === null) return group;
  // Disabled buttons get no pointer events, so the reason hangs on a wrapper that does.
  return (
    <Hint label={lock}>
      <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        {group}
      </span>
    </Hint>
  );
}

export function WorkHeader({ target, lang, onLang, running, elapsedMs, canRun, onRun, langLock }: WorkHeaderProps) {
  const home = useQuery(homeQuery());
  const crumbs = middleCrumbs(target, home.data);
  const kind = statusKind(target.status, false);
  const short = target.kind === "exercise" ? target.id.slice(target.id.indexOf("/") + 1) : target.id;
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b bg-card px-3 text-[13px]">
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="flex items-center gap-2 font-medium text-foreground">
                <Logo />
                Algorithms
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.map((crumb) => (
            <Fragment key={crumb.label}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {"pattern" in crumb ? (
                  <BreadcrumbLink asChild>
                    <Link to="/" search={{ pattern: [crumb.pattern] }}>
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : "concept" in crumb ? (
                  <BreadcrumbLink asChild>
                    <Link to="/c/$slug" params={{ slug: crumb.concept }}>
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">
              <span className="font-mono text-xs font-normal text-muted-foreground">{short}</span> {target.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <DifficultyBadge difficulty={target.difficulty} />
      <Badge variant={STATUS_BADGE[kind]}>{STATUS_LABEL[kind]}</Badge>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lightbulb aria-hidden className="size-3.5" />
        {target.hints} {target.hints === 1 ? "hint" : "hints"}
      </span>
      {target.url && (
        <Hint label="Open the original problem">
          <a href={target.url} target="_blank" rel="noreferrer" aria-label="Open the original problem" className="text-muted-foreground hover:text-foreground">
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </Hint>
      )}
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitch lang={lang} onLang={onLang} lock={langLock} />
        <Hint
          label={
            <>
              Run the tests <Kbd>{shortcut("run")}</Kbd>
            </>
          }
        >
          <Button onClick={onRun} disabled={!canRun}>
            {running ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
            {running ? `Running… ${(elapsedMs / 1000).toFixed(1)} s` : "Run"}
          </Button>
        </Hint>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Use them in the work page**

In `playground/web/routes/work.tsx`:
- **Imports:**
  - remove the `Badge` import;
  - keep `Link` (the concept trail uses it), `TargetData` (`StatementPane` and `Workspace` use it), `cn` and `Button`;
  - add:

```tsx
import { CircleX, TriangleAlert } from "lucide-react";
import { solutionSaveLabel, StatusBar } from "../components/StatusBar.tsx";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { shortcut } from "../lib/keys.ts";
import { WorkHeader } from "../work/WorkHeader.tsx";
```

  and change `import { type SaveState, useSolutionSync } from "../hooks/useSolutionSync.ts";` to `import { useSolutionSync } from "../hooks/useSolutionSync.ts";`.
- **Delete:** `SAVE_LABEL`, `SaveIndicator`, `statusVariant`, the local `WorkHeader` function and `ConflictBanner`.
- **Add**, in their place:

```tsx
const LANG_NAME: Record<Lang, string> = { py: "Python", ts: "TypeScript" };

function ConflictAlert({ file, onDisk, onMine }: { file: string; onDisk(): void; onMine(): void }) {
  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <TriangleAlert aria-hidden />
      <AlertTitle>{file} changed on disk.</AlertTitle>
      <AlertDescription className="flex items-center gap-2">
        Keep one version:
        <Button size="sm" variant="outline" onClick={onDisk}>
          Use disk version
        </Button>
        <Button size="sm" variant="outline" onClick={onMine}>
          Keep mine
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

- **Workspace:** the `return` of `Workspace` keeps everything between the notices and the panels as it is. Its header, notices and end become:

```tsx
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkHeader
        target={target}
        lang={lang}
        onLang={onLang}
        running={run.isPending}
        elapsedMs={elapsed}
        canRun={canRun}
        onRun={actions.run}
        langLock={langLock}
      />
      {sync.conflict && <ConflictAlert file={`solution.${lang}`} onDisk={sync.takeDisk} onMine={() => void sync.keepMine()} />}
      {sync.state === "error" && sync.error && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <CircleX aria-hidden />
          <AlertDescription>Not saved: {sync.error}</AlertDescription>
        </Alert>
      )}
      <Group orientation="horizontal" className="min-h-0 flex-1" defaultLayout={columns.defaultLayout} onLayoutChanged={columns.onLayoutChanged}>
        {/* … the statement and code panels, unchanged … */}
      </Group>
      <StatusBar
        subject={`${LANG_NAME[lang]} · solution.${lang}`}
        save={solutionSaveLabel(sync.state, connected)}
        shortcuts={[
          { keys: shortcut("run"), label: "Run" },
          { keys: shortcut("custom"), label: "Custom" },
          { keys: shortcut("save"), label: "Save" },
        ]}
      />
    </div>
  );
```

(`elapsed` is the `useElapsed(run.isPending)` value already computed in `Workspace`; it now feeds the header.)

- [ ] **Step 6: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/status-bar.test.tsx playground/tests/web/work-header.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green, including the edited live and restart tests.

```bash
git add playground/web/components/StatusBar.tsx playground/web/work/WorkHeader.tsx playground/web/routes/work.tsx \
  playground/tests/web/status-bar.test.tsx playground/tests/web/work-header.test.tsx \
  playground/e2e/work.spec.ts playground/e2e/live.spec.ts playground/e2e/restart.spec.ts
git commit -m "feat(playground): give the work view a breadcrumb header and a status bar"
```

---

### Task 8: tests tab with chips and a failures table

**Files:**
- Create: `playground/web/lib/run-summary.ts`
- Modify: `playground/web/components/TestsPanel.tsx` (rewrite), `playground/web/components/RunDetails.tsx` (`ErrorBox`), `playground/web/routes/work.tsx` (the Tests tab label)
- Test: `playground/tests/web/run-summary.test.ts`, `playground/tests/web/tests-panel.test.tsx`, `playground/e2e/work.spec.ts`

**Interfaces:**
- Consumes:
  - `RunResult`, `CaseStatus`, `StressStatus`, `StressCaseResult`, `HarnessError` from `runner/src/types.ts`
  - `formatMs`, `DISPLAY_MAX` from `RunDetails.tsx`
  - `shortcut` (Task 3)
  - `Hint`, `Alert*`, `Badge`, `Kbd`, `Table*` (Task 1)
- Produces, in `lib/run-summary.ts`:
  - `type ChipState = "passed" | "failed" | "error" | "timeout" | "skipped" | "slow"`
  - `interface Chip { key: string; label: string; state: ChipState; description: string; rowId: string | null }`
  - `runChips(result: RunResult): Chip[]`
  - `stressDetail(c: StressCaseResult): string`
  - `exampleRowId(id: number): string`, `HIDDEN_ROW_ID`, `stressRowId(index: number): string`
- Produces, `TestsPanel` with the same props (`TestsPanelProps`). **Roles and names:**
  - list "Results": a chip per case. A button named by its description when it explains a failure, otherwise an `img` named by it.
  - table "Failures" with columns Case, Input, Expected, Got
  - table "Stress"
  - text "No stress cases"
  - the empty state's "Run the tests"

- [ ] **Step 1: Write the failing tests**

Create `playground/tests/web/run-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { RunResult } from "../../../runner/src/types.ts";
import { runChips } from "../../web/lib/run-summary.ts";

const base: RunResult = {
  id: "lc-0001",
  title: "Two Sum",
  lang: "py",
  readme: "problems/lc-0001-two-sum/README.md",
  solution: "problems/lc-0001-two-sum/solution.py",
  fatal: null,
  examples: { passed: 0, total: 0, cases: [] },
  hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
  stress: { status: "none", cases: [] },
  green: false,
};

describe("run chips", () => {
  it("gives every example a chip, and points the failing ones at their explanation", () => {
    const chips = runChips({
      ...base,
      examples: {
        passed: 1,
        total: 4,
        cases: [
          { id: 1, status: "pass", input: [], expected: 1, output: 1, ms: 0.2, stdout: "" },
          { id: 2, status: "fail", input: [], expected: 1, output: 2, ms: 0.3, stdout: "" },
          { id: 3, status: "timeout", input: [], expected: 1, stdout: "" },
          { id: 4, status: "error", input: [], expected: 1, error: { kind: "exception", message: "boom", trace: "" }, ms: 1, stdout: "" },
        ],
      },
    });
    expect(chips.map((chip) => [chip.label, chip.state, chip.description, chip.rowId])).toEqual([
      ["1", "passed", "Example 1: passed, 0.20 ms", null],
      ["2", "failed", "Example 2: failed, 0.30 ms", "case-2"],
      ["3", "timeout", "Example 3: timeout", "case-3"],
      ["4", "error", "Example 4: error, 1 ms", "case-4"],
      ["Hidden", "skipped", "Hidden: skipped until the examples pass", null],
    ]);
  });

  it("sums up the hidden cases and lists each stress case", () => {
    const chips = runChips({
      ...base,
      hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [], output: 0, stdout: "" } },
      stress: {
        status: "fail",
        cases: [
          { name: "n=1e5 random", status: "pass", ms: 83, limitMs: 2000 },
          { name: "n=1e5 sorted", status: "slow", ms: 2400, limitMs: 2000 },
          { name: "worst case", status: "timeout", limitMs: 2000 },
        ],
      },
    });
    expect(chips.map((chip) => [chip.label, chip.state, chip.description, chip.rowId])).toEqual([
      ["Hidden 2/3", "failed", "Hidden: 2 of 3 passed", "case-hidden"],
      ["n=1e5 random", "passed", "Stress n=1e5 random: passed, 83 ms of 2000 ms", null],
      ["n=1e5 sorted", "slow", "Stress n=1e5 sorted: too slow, 2400 ms of 2000 ms", "stress-1"],
      ["worst case", "timeout", "Stress worst case: timeout, over 2000 ms", "stress-2"],
    ]);
  });

  it("shows stress that was skipped as a whole as one chip", () => {
    const chips = runChips({ ...base, hidden: { status: "pass", passed: 3, total: 3, firstFailure: null }, stress: { status: "skipped", cases: [] } });
    expect(chips.map((chip) => [chip.label, chip.state, chip.description])).toEqual([
      ["Hidden 3/3", "passed", "Hidden: 3 of 3 passed"],
      ["Stress", "skipped", "Stress: skipped"],
    ]);
  });
});
```

Replace the `describe("TestsPanel", …)` block of `playground/tests/web/tests-panel.test.tsx` (keep its imports, `result()` and `panel()` helpers, and the `ConsolePanel` block) with the block below. Also add `userEvent` to the imports: `import userEvent from "@testing-library/user-event";`.

```tsx
const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);
const tableRows = (name: string) => within(screen.getByRole("table", { name })).getAllByRole("row").slice(1);

describe("TestsPanel", () => {
  it("invites a first run with the shortcuts", () => {
    panel({});
    expect(screen.getByText("Run the tests")).toBeInTheDocument();
    expect(screen.getByText("Or try your own input")).toBeInTheDocument();
  });

  it("shows a green run and points to /review", () => {
    panel({ result: result() });
    expect(screen.getByText(/Green in py/)).toBeInTheDocument();
    expect(screen.getByText("/review")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Example 1: passed, 0.20 ms" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Example 2: passed, 83 ms" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Failures" })).not.toBeInTheDocument();
    expect(screen.getByText("No stress cases")).toBeInTheDocument();
  });

  it("puts a failing example in the failures table, and its chip jumps there", async () => {
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
    const [row] = tableRows("Failures");
    expect(cells(row!)).toEqual(["2", "nums=[3,2,4], target=6", "[1,2]", "[0,0]"]);
    expect(screen.getByRole("img", { name: "Hidden: skipped until the examples pass" })).toBeInTheDocument();
    expect(screen.queryByText(/Green/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Example 2: failed, 0.30 ms" }));
    expect(row).toHaveFocus();
  });

  it("shows the first hidden failure with the input and the user's output, never an expected value", () => {
    panel({
      result: result({
        green: false,
        hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [[5, 5], 10], output: [0, 0], stdout: "" } },
        stress: { status: "skipped", cases: [] },
      }),
    });
    expect(screen.getByRole("button", { name: "Hidden: 2 of 3 passed" })).toBeInTheDocument();
    expect(cells(tableRows("Failures")[0]!)).toEqual(["Hidden", "nums=[5,5], target=10", "hidden", "[0,0]"]);
  });

  it("shows an exception with its trace under its row", () => {
    panel({
      result: result({
        green: false,
        examples: {
          passed: 0,
          total: 1,
          cases: [{ id: 1, status: "error", input: [[1], 1], expected: [0, 0], error: { kind: "exception", message: "IndexError: list index out of range", trace: "line 3, in twoSum" }, ms: 1, stdout: "" }],
        },
        hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
        stress: { status: "skipped", cases: [] },
      }),
    });
    expect(cells(tableRows("Failures")[0]!)).toEqual(["1", "nums=[1], target=1", "[0,0]", "error"]);
    expect(screen.getByText("exception: IndexError: list index out of range")).toBeInTheDocument();
    expect(screen.getByText("line 3, in twoSum")).toBeInTheDocument();
  });

  it("shows a load error with its trace instead of the results", () => {
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
    expect(screen.queryByRole("list", { name: "Results" })).not.toBeInTheDocument();
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
    expect(tableRows("Stress").map(cells)).toEqual([
      ["n=1e5 random", "83 ms", "2000 ms", "passed"],
      ["n=1e5 sorted", "2400 ms", "2000 ms", "too slow"],
      ["worst case", "—", "2000 ms", "timeout"],
    ]);
    expect(screen.getByRole("button", { name: "Stress n=1e5 sorted: too slow, 2400 ms of 2000 ms" })).toBeInTheDocument();
  });

  it("shows a case-file error, a stale result and the running time", () => {
    panel({ result: result(), caseError: "cases.json is invalid:\n  - entry: required", stale: true, running: true, elapsedMs: 1234 });
    expect(screen.getByText(/Case file error/)).toBeInTheDocument();
    expect(screen.getByText(/entry: required/)).toBeInTheDocument();
    expect(screen.getByText("Cases changed — run again")).toBeInTheDocument();
    expect(screen.getByText("Running… 1.2 s")).toBeInTheDocument();
  });
});
```

In `playground/e2e/work.spec.ts`:
- the failing-example test becomes:

```ts
test("shows what a failing example expected and what the code returned", async ({ page }) => {
  await page.goto("/p/lc-0001");
  await replaceCode(page, "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        return [0, 0]\n");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const failures = page.getByRole("table", { name: "Failures" });
  await expect(failures).toContainText("nums=[3,2,4], target=6", { timeout: 20_000 });
  await expect(failures).toContainText("[1,2]");
  await expect(page.getByRole("button", { name: /^Example 2: failed/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Hidden: skipped until the examples pass" })).toBeVisible();
});
```

- in `"keeps the previous result visible while a second run is in flight"`, replace:

```ts
  await expect(page.getByText("Example 1")).toBeVisible();
```

  with:

```ts
  const firstExample = page.getByRole("img", { name: /^Example 1: passed/ });
  await expect(firstExample).toBeVisible();
```

  and replace:

```ts
  const duringRun = await page.locator('[role="tabpanel"]').first().innerText();
  expect(duringRun).toContain("Example 1"); // the previous result stays, dimmed, while the new run is in flight
```

  with:

```ts
  expect(await firstExample.count()).toBe(1); // the previous result stays, dimmed, while the new run is in flight
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/run-summary.test.ts playground/tests/web/tests-panel.test.tsx`
Expected: FAIL. `run-summary.ts` cannot be resolved, and the panel has no "Results" list or "Failures" table.

- [ ] **Step 3: Write the summary**

Create `playground/web/lib/run-summary.ts`:

```ts
import type { CaseStatus, RunResult, StressCaseResult, StressStatus } from "../../../runner/src/types.ts";
import { formatMs } from "../components/RunDetails.tsx";

export type ChipState = "passed" | "failed" | "error" | "timeout" | "skipped" | "slow";

export interface Chip {
  key: string;
  /** Short text on the chip: the example number, "Hidden 2/3", or the stress case's name. */
  label: string;
  state: ChipState;
  /** Spoken, and shown on hover: "Example 2: failed, 0.30 ms". */
  description: string;
  /** Id of the row that explains this chip (failures or stress table), or null when nothing needs explaining. */
  rowId: string | null;
}

export const exampleRowId = (id: number): string => `case-${id}`;
export const HIDDEN_ROW_ID = "case-hidden";
export const stressRowId = (index: number): string => `stress-${index}`;

const EXAMPLE_STATE: Record<CaseStatus, ChipState> = { pass: "passed", fail: "failed", error: "error", timeout: "timeout", skipped: "skipped" };
const STRESS_STATE: Record<StressStatus, ChipState> = { pass: "passed", slow: "slow", timeout: "timeout", error: "error", skipped: "skipped" };
const WORDS: Record<ChipState, string> = { passed: "passed", failed: "failed", error: "error", timeout: "timeout", skipped: "skipped", slow: "too slow" };

const explains = (state: ChipState) => state !== "passed" && state !== "skipped";

export function stressDetail(c: StressCaseResult): string {
  if (c.status === "pass") return `passed, ${formatMs(c.ms)} of ${c.limitMs} ms`;
  if (c.status === "slow") return `too slow, ${formatMs(c.ms)} of ${c.limitMs} ms`;
  if (c.status === "timeout") return `timeout, over ${c.limitMs} ms`;
  return WORDS[STRESS_STATE[c.status]];
}

/** One chip per example, one for the hidden cases, and one per stress case (or one when stress was skipped as a whole). */
export function runChips(result: RunResult): Chip[] {
  const examples = result.examples.cases.map((c): Chip => {
    const state = EXAMPLE_STATE[c.status];
    const time = c.ms === undefined ? "" : `, ${formatMs(c.ms)}`;
    return { key: `example-${c.id}`, label: String(c.id), state, description: `Example ${c.id}: ${WORDS[state]}${time}`, rowId: explains(state) ? exampleRowId(c.id) : null };
  });

  const { hidden } = result;
  const hiddenChip: Chip =
    hidden.status === "skipped"
      ? { key: "hidden", label: "Hidden", state: "skipped", description: result.fatal ? "Hidden: skipped" : "Hidden: skipped until the examples pass", rowId: null }
      : {
          key: "hidden",
          label: `Hidden ${hidden.passed}/${hidden.total}`,
          state: hidden.status === "pass" ? "passed" : "failed",
          description: `Hidden: ${hidden.passed} of ${hidden.total} passed`,
          rowId: hidden.status === "fail" && hidden.firstFailure ? HIDDEN_ROW_ID : null,
        };

  const { stress } = result;
  const stressChips =
    stress.status === "skipped" && stress.cases.length === 0
      ? [{ key: "stress", label: "Stress", state: "skipped" as const, description: "Stress: skipped", rowId: null }]
      : stress.cases.map((c, index): Chip => {
          const state = STRESS_STATE[c.status];
          return { key: `stress-${index}`, label: c.name, state, description: `Stress ${c.name}: ${stressDetail(c)}`, rowId: explains(state) ? stressRowId(index) : null };
        });

  return [...examples, hiddenChip, ...stressChips];
}
```

- [ ] **Step 4: Restyle the error box**

Replace `ErrorBox` in `playground/web/components/RunDetails.tsx` (keep `DISPLAY_MAX` and `formatMs`) and add the imports:

```tsx
import { CircleX } from "lucide-react";
import type { HarnessError } from "../../../runner/src/types.ts";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";
```

```tsx
export function ErrorBox({ title, error }: { title?: string; error: HarnessError }) {
  return (
    <Alert variant="destructive">
      <CircleX aria-hidden />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="space-y-1">
        <p className="font-mono text-xs">
          {error.kind}: {error.message}
        </p>
        {error.trace && <pre className="font-mono text-xs whitespace-pre-wrap">{error.trace}</pre>}
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 5: Write the tests tab**

Replace `playground/web/components/TestsPanel.tsx` with:

```tsx
import { cn } from "cn";
import { CircleCheck, CirclePause, CircleX, FlaskConical, LoaderCircle, Lock, type LucideIcon, Snail, Timer, TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { formatNamedInput, formatOutput } from "../../../runner/src/format.ts";
import type { HarnessError, RunResult, StressStatus } from "../../../runner/src/types.ts";
import { shortcut } from "../lib/keys.ts";
import { type Chip, type ChipState, exampleRowId, HIDDEN_ROW_ID, runChips, stressRowId } from "../lib/run-summary.ts";
import { Hint } from "./Hint.tsx";
import { DISPLAY_MAX, ErrorBox, formatMs } from "./RunDetails.tsx";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";
import { Badge } from "./ui/badge.tsx";
import { Kbd } from "./ui/kbd.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx";

export interface TestsPanelProps {
  result: RunResult | null;
  running: boolean;
  /** Time since Run, shown while running. */
  elapsedMs: number;
  /** cases.json or stress.ts changed after this result was produced. */
  stale: boolean;
  caseError: string | null;
  paramNames: readonly string[];
}

type Format = (value: unknown) => string;

const LOOK: Record<ChipState, { Icon: LucideIcon; chip: string; text: string }> = {
  passed: { Icon: CircleCheck, chip: "border-success/40 bg-success/10 text-success", text: "text-success" },
  failed: { Icon: CircleX, chip: "border-destructive/40 bg-destructive/10 text-destructive", text: "text-destructive" },
  error: { Icon: CircleX, chip: "border-destructive/40 bg-destructive/10 text-destructive", text: "text-destructive" },
  timeout: { Icon: Timer, chip: "border-destructive/40 bg-destructive/10 text-destructive", text: "text-destructive" },
  slow: { Icon: Snail, chip: "border-warning/40 bg-warning/10 text-warning", text: "text-warning" },
  skipped: { Icon: CirclePause, chip: "border-dashed text-muted-foreground", text: "text-muted-foreground" },
};
const CHIP = "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px]";

/** Moves to the row that explains a chip. */
function jumpTo(rowId: string) {
  const row = document.getElementById(rowId);
  row?.scrollIntoView({ block: "nearest" });
  row?.focus();
}

function Chips({ chips }: { chips: Chip[] }) {
  return (
    <ul aria-label="Results" className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const { Icon, chip: look } = LOOK[chip.state];
        const body = (
          <>
            <Icon aria-hidden className="size-3" />
            {chip.label}
          </>
        );
        const rowId = chip.rowId;
        return (
          <li key={chip.key}>
            <Hint label={chip.description}>
              {rowId ? (
                <button type="button" aria-label={chip.description} onClick={() => jumpTo(rowId)} className={cn(CHIP, look, "cursor-pointer hover:brightness-95")}>
                  {body}
                </button>
              ) : (
                <span role="img" aria-label={chip.description} className={cn(CHIP, look)}>
                  {body}
                </span>
              )}
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}

interface FailureRow {
  id: string;
  label: string;
  input: string;
  /** null for a hidden case: its answer never leaves the server. */
  expected: string | null;
  got: string;
  error?: HarnessError;
}

function failureRows(result: RunResult, input: Format): FailureRow[] {
  const rows: FailureRow[] = result.examples.cases
    .filter((c) => c.status === "fail" || c.status === "error" || c.status === "timeout")
    .map((c) => ({
      id: exampleRowId(c.id),
      label: String(c.id),
      input: input(c.input),
      expected: formatOutput(c.expected, DISPLAY_MAX),
      got: c.status === "fail" ? formatOutput(c.output, DISPLAY_MAX) : c.status,
      error: c.error,
    }));
  const failure = result.hidden.firstFailure;
  if (result.hidden.status === "fail" && failure) {
    rows.push({
      id: HIDDEN_ROW_ID,
      label: "Hidden",
      input: input(failure.input),
      expected: null,
      got: failure.error ? "error" : formatOutput(failure.output, DISPLAY_MAX),
      error: failure.error,
    });
  }
  return rows;
}

const WRAP = "font-mono text-xs break-all whitespace-normal";

function FailuresTable({ rows }: { rows: FailureRow[] }) {
  return (
    <Table aria-label="Failures">
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Case</TableHead>
          <TableHead>Input</TableHead>
          <TableHead>Expected</TableHead>
          <TableHead>Got</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <Fragment key={row.id}>
            <TableRow id={row.id} tabIndex={-1} className="outline-none focus:bg-destructive/10">
              <TableCell>{row.label}</TableCell>
              <TableCell className={WRAP}>{row.input}</TableCell>
              <TableCell className={cn(WRAP, "text-success")}>
                {row.expected === null ? (
                  <span className="inline-flex items-center gap-1 font-sans text-muted-foreground">
                    <Lock aria-hidden className="size-3" />
                    hidden
                  </span>
                ) : (
                  row.expected
                )}
              </TableCell>
              <TableCell className={cn(WRAP, "bg-destructive/5 text-destructive")}>{row.got}</TableCell>
            </TableRow>
            {row.error && (
              <TableRow>
                <TableCell colSpan={4} className="whitespace-normal">
                  <ErrorBox error={row.error} />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

const STRESS_RESULT: Record<StressStatus, { text: string; state: ChipState }> = {
  pass: { text: "passed", state: "passed" },
  slow: { text: "too slow", state: "slow" },
  timeout: { text: "timeout", state: "timeout" },
  error: { text: "error", state: "error" },
  skipped: { text: "skipped", state: "skipped" },
};

function StressTable({ result }: { result: RunResult }) {
  const { stress } = result;
  if (stress.status === "none") return <p className="text-muted-foreground">No stress cases</p>;
  // Skipped as a whole: its chip says so.
  if (stress.cases.length === 0) return null;
  return (
    <Table aria-label="Stress">
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Limit</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stress.cases.map((c, index) => {
          const outcome = STRESS_RESULT[c.status];
          const { Icon, text } = LOOK[outcome.state];
          return (
            <Fragment key={c.name}>
              <TableRow id={stressRowId(index)} tabIndex={-1} className="outline-none focus:bg-destructive/10">
                <TableCell>{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.ms === undefined ? "—" : formatMs(c.ms)}</TableCell>
                <TableCell className="font-mono text-xs">{c.limitMs} ms</TableCell>
                <TableCell>
                  <span className={cn("inline-flex items-center gap-1", text)}>
                    <Icon aria-hidden className="size-3" />
                    {outcome.text}
                  </span>
                </TableCell>
              </TableRow>
              {c.error && (
                <TableRow>
                  <TableCell colSpan={4} className="whitespace-normal">
                    <ErrorBox error={c.error} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function FirstRun() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
      <FlaskConical aria-hidden className="size-6" />
      <p className="flex items-center gap-1.5 text-foreground">
        Run the tests <Kbd>{shortcut("run")}</Kbd>
      </p>
      <p className="flex items-center gap-1.5 text-xs">
        Or try your own input <Kbd>{shortcut("custom")}</Kbd>
      </p>
    </div>
  );
}

export function TestsPanel({ result, running, elapsedMs, stale, caseError, paramNames }: TestsPanelProps) {
  const input: Format = (value) => formatNamedInput(paramNames, value, DISPLAY_MAX);
  const failures = result && !result.fatal ? failureRows(result, input) : [];
  return (
    <div className="space-y-3 p-3 text-[13px]">
      {caseError && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Case file error — not your code. Fix the problem files, or ask Claude.</AlertTitle>
          <AlertDescription>
            <pre className="font-mono text-xs whitespace-pre-wrap">{caseError}</pre>
          </AlertDescription>
        </Alert>
      )}
      {running && (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Running… {(elapsedMs / 1000).toFixed(1)} s
        </p>
      )}
      {!result && !running && !caseError && <FirstRun />}
      {result && (
        <div className={cn("space-y-3", running && "opacity-50")}>
          {stale && <Badge variant="warning">Cases changed — run again</Badge>}
          {result.green && (
            <Alert variant="success">
              <CircleCheck aria-hidden />
              <AlertTitle>Green in {result.lang}.</AlertTitle>
              <AlertDescription>
                Ask Claude for <code>/review</code> in the terminal to mark it solved.
              </AlertDescription>
            </Alert>
          )}
          {result.fatal ? (
            <ErrorBox title={`Could not load ${result.solution.split("/").at(-1)}`} error={result.fatal} />
          ) : (
            <>
              <Chips chips={runChips(result)} />
              {failures.length > 0 && <FailuresTable rows={failures} />}
              <StressTable result={result} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Count the examples on the tab**

In `playground/web/routes/work.tsx`, import `Badge` (`import { Badge } from "../components/ui/badge.tsx";`) and replace the Tests trigger with:

```tsx
                  <TabsTrigger value="tests">
                    Tests
                    {result && (
                      <Badge variant={result.examples.passed === result.examples.total ? "success" : "destructive"} className="font-mono">
                        {result.examples.passed}/{result.examples.total}
                      </Badge>
                    )}
                  </TabsTrigger>
```

- [ ] **Step 7: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/run-summary.test.ts playground/tests/web/tests-panel.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green. The server's hidden-value sentinel test (`playground/tests/server/spoiler.test.ts`) still passes.

```bash
git add playground/web/lib/run-summary.ts playground/web/components/TestsPanel.tsx playground/web/components/RunDetails.tsx playground/web/routes/work.tsx \
  playground/tests/web/run-summary.test.ts playground/tests/web/tests-panel.test.tsx playground/e2e/work.spec.ts
git commit -m "feat(playground): show test results as chips per case and a failures table"
```

---
### Task 9: custom input, console, statement panel and work-view loading

**Files:**
- Modify: `playground/web/components/CustomInputPanel.tsx`, `playground/web/components/ConsolePanel.tsx`, `playground/web/routes/work.tsx`
- Test: `playground/tests/web/tests-panel.test.tsx` (the `ConsolePanel` block), `playground/e2e/live.spec.ts`

**Interfaces:**
- Consumes:
  - Task 1: `Textarea`, `Button`, `Kbd`, `Alert*`, `Skeleton`
  - Task 3: `shortcut`
  - Task 8: `ErrorBox`
- Produces, with no API change:
  - Console empty text: "Nothing printed yet — print() / console.log output shows up here."
  - Concept-trail button "Back"
  - Loading skeletons (`aria-busy`) in place of "Loading…"

- [ ] **Step 1: Write the failing tests**

In `playground/tests/web/tests-panel.test.tsx`, the `ConsolePanel` test `"explains where prints appear"` becomes:

```tsx
  it("explains where prints appear", () => {
    render(<ConsolePanel result={null} />);
    expect(screen.getByText("Nothing printed yet — print() / console.log output shows up here.")).toBeInTheDocument();
  });
```

In `playground/e2e/live.spec.ts`, in `"a concept link opens next to the editor, and Back returns to the statement"`, the Back button becomes:

```ts
  await page.getByRole("button", { name: "Back" }).click();
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/tests-panel.test.tsx`
Expected: FAIL. The console still says "Prints from your code appear here after ▶ Run.".

Run: `pnpm e2e -g "concept link opens"`
Expected: FAIL. There is no button named "Back" (it is "← Back").

- [ ] **Step 3: Restyle the console**

Replace the body of `ConsolePanel` in `playground/web/components/ConsolePanel.tsx` (the `blocks` computation stays) with:

```tsx
  if (blocks.length === 0) {
    return <p className="p-3 text-xs text-muted-foreground">{result ? "No prints in the last run." : "Nothing printed yet — print() / console.log output shows up here."}</p>;
  }
  return (
    <div className="space-y-3 p-3">
      {blocks.map((block) => (
        <section key={block.label} aria-label={block.label}>
          <h3 className="mb-1 font-mono text-[11px] text-muted-foreground">{block.label}</h3>
          <pre className="rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{block.text}</pre>
        </section>
      ))}
    </div>
  );
```

- [ ] **Step 4: Restyle the custom input**

In `playground/web/components/CustomInputPanel.tsx`:
- add the imports:

```tsx
import { CircleX, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { shortcut } from "../lib/keys.ts";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";
import { Kbd } from "./ui/kbd.tsx";
import { Textarea } from "./ui/textarea.tsx";
```

- `CustomResultView` becomes:

```tsx
function CustomResultView({ result }: { result: CustomResult }) {
  if (result.fatal) return <ErrorBox title="Could not load the solution" error={result.fatal} />;
  return (
    <div className="space-y-2">
      {result.error ? (
        <ErrorBox error={result.error} />
      ) : (
        <p className="flex items-center gap-2">
          <span className="text-muted-foreground">Output</span>
          <code className="font-mono">{formatOutput(result.output, DISPLAY_MAX)}</code>
          <span className="text-xs text-muted-foreground">{formatMs(result.ms)}</span>
        </p>
      )}
      {result.stdout && (
        <pre aria-label="Prints" className="rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
          {result.stdout}
        </pre>
      )}
    </div>
  );
}
```

- In `CustomInputForm`, the form body becomes (the state, `update`, `reset` and `submit` stay as they are):

```tsx
    <form
      className="space-y-3 p-3 text-[13px]"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {names.map((name) => (
        <div key={name}>
          <label htmlFor={`${id}-${name}`} className="font-mono text-xs text-muted-foreground">
            {name}
          </label>
          <Textarea
            id={`${id}-${name}`}
            value={texts[name] ?? ""}
            onChange={(event) => update(name, event.target.value)}
            rows={1}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
            className="mt-1 min-h-8 resize-y font-mono text-xs"
            {...NO_WRITING_AIDS}
          />
          {errors[name] && (
            <p id={`${id}-${name}-error`} className="mt-1 text-xs text-destructive">
              {errors[name]}
            </p>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
          {pending ? "Running…" : "Run custom input"}
          <Kbd>{shortcut("custom")}</Kbd>
        </Button>
        {/* type="button": shadcn's Button has no default type, and inside this form it would submit (run the code). */}
        <Button type="button" variant="outline" onClick={reset}>
          <RotateCcw aria-hidden />
          Reset
        </Button>
      </div>
      {failure && (
        <Alert variant="destructive">
          <CircleX aria-hidden />
          <AlertTitle>{failure.issues.length > 0 ? "The server could not use this input:" : failure.message}</AlertTitle>
          {failure.issues.length > 0 && (
            <AlertDescription>
              <ul className="list-disc pl-5 font-mono">
                {failure.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
      {result && <CustomResultView result={result} />}
    </form>
```

- `CustomInputPanel`'s message for a missing signature: `<p className="p-3 text-sm text-muted-foreground">Custom input needs a valid cases.json. See the Tests tab.</p>`.

- [ ] **Step 5: Restyle the statement, the separators and the loading states**

In `playground/web/routes/work.tsx`:
- add `ArrowLeft` to the `lucide-react` import, and import `Skeleton`:

```tsx
import { ArrowLeft, CircleX, TriangleAlert } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton.tsx";
```

- add, above `WorkPage`:

```tsx
function WorkSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 items-center gap-3 border-b px-3">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="ml-auto h-6 w-32" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-2/5 space-y-2 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="m-4 flex-1" />
      </div>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="m-6 w-auto">
      <TriangleAlert aria-hidden />
      <AlertTitle>Could not load this page</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
```

- in `WorkPage`: `if (target.isPending) return <WorkSkeleton />;`, and the non-404 error branch becomes `return <LoadError message={target.error.message} />;`.
- `SideConcept` becomes:

```tsx
function SideConcept({ slug, onConcept }: { slug: string; onConcept(slug: string): void }) {
  const concept = useQuery(conceptQuery(slug));
  if (concept.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading" className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  if (concept.isError) return <LoadError message={concept.error.message} />;
  return <ConceptView concept={concept.data} editable={false} onConcept={onConcept} />;
}
```

- in `StatementPane`, the trail and the README error become:

```tsx
        <nav aria-label="Concept trail" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
          <span>Statement › {trail.join(" › ")}</span>
          <Link to="/c/$slug" params={{ slug }} className="ml-auto text-primary underline underline-offset-2">
            Open the concept page
          </Link>
        </nav>
```

```tsx
  if (target.readmeError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertDescription>
          {target.readme || "README.md"}: {target.readmeError}
        </AlertDescription>
      </Alert>
    );
  }
```

- in `Workspace`, replace `const separator = …` with:

```tsx
  // 1 px lines that turn blue on hover or drag; a wider invisible strip keeps them easy to grab.
  const separator = "relative bg-border transition-colors hover:bg-primary active:bg-primary after:absolute";
```

  and the two separators become:

```tsx
        <Separator className={cn("w-px after:inset-y-0 after:-inset-x-1", separator)} />
```

```tsx
            <Separator className={cn("h-px after:inset-x-0 after:-inset-y-1", separator)} />
```

- the statement panel becomes `<Panel id="statement" defaultSize="40%" minSize="20%" className="overflow-y-auto bg-card p-4">`.
- the editor panel's loading branch becomes:

```tsx
              {sync.code === null ? (
                sync.error ? (
                  <Alert variant="destructive" className="m-4 w-auto">
                    <CircleX aria-hidden />
                    <AlertDescription>{sync.error}</AlertDescription>
                  </Alert>
                ) : (
                  <Skeleton aria-busy="true" aria-label="Loading the editor" className="m-4 h-40" />
                )
              ) : (
                <CodeEditor lang={lang} value={sync.code} onChange={sync.edit} bindings={bindings} ariaLabel={`solution.${lang}`} className="h-full" autoFocus />
              )}
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/tests-panel.test.tsx playground/tests/web/custom-input.test.tsx`
Expected: PASS, including the Reset guard from Task 1.

- [ ] **Step 7: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green.

```bash
git add playground/web/components/CustomInputPanel.tsx playground/web/components/ConsolePanel.tsx playground/web/routes/work.tsx \
  playground/tests/web/tests-panel.test.tsx playground/e2e/live.spec.ts
git commit -m "feat(playground): restyle the custom input, console, statement and loading states"
```

---

### Task 10: concept page and shared pieces

**Files:**
- Modify: `playground/web/routes/concept.tsx` (rewrite), `playground/web/components/ConceptView.tsx`, `playground/web/components/NotFound.tsx`, `playground/web/components/ConnectionBanner.tsx`
- Test: `playground/tests/web/concept-view.test.tsx`, `playground/tests/web/concept-page.test.tsx`, `playground/tests/web/not-found.test.tsx` (new), `playground/e2e/live.spec.ts`

**Interfaces:**
- Consumes:
  - Task 7: `StatusBar`, `SaveLabel`
  - Task 3: `Logo`, `shortcut`, `prettifySlug`
  - Task 1: `Breadcrumb*`, `Badge`, `Progress`, `Skeleton`, `Alert*`, `Button`, `Kbd`
  - `homeQuery` from `api.ts`
  - `useHotkeys` from `react-hotkeys-hook`
- Produces, in `ConceptView.tsx`:
  - `interface DraftState { open: boolean; dirty: boolean; saving: boolean; failed: boolean }`
  - `CLOSED_DRAFT: DraftState`
  - `ConceptView` takes an optional `onDraft?: (draft: DraftState) => void`
- Produces, in `routes/concept.tsx`: `draftSaveLabel(draft: DraftState): SaveLabel`
- **Roles and names:**
  - button "Edit"
  - button "Save" (it shows the save shortcut)
  - link "Back to Algorithms"
  - the disconnection alert keeps its text

- [ ] **Step 1: Write the failing tests**

In `playground/tests/web/concept-view.test.tsx` and `playground/tests/web/concept-page.test.tsx`, replace every `{ name: "✎ Edit" }` with `{ name: "Edit" }`. Then add these tests to the `describe("ConceptView", …)` block of `concept-view.test.tsx`:

```tsx
  it("saves with the keyboard shortcut", async () => {
    const save = vi.fn(async () => {});
    await renderWithRouter(<ConceptView concept={{ ...CONCEPT, explanation: "Old." }} editable save={save} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "My explanation" }), " New.");
    await userEvent.keyboard("{Control>}s{/Control}");
    await waitFor(() => expect(save).toHaveBeenCalledWith("Old. New."));
  });

  it("tells the page whether the draft has unsaved changes", async () => {
    const onDraft = vi.fn();
    await renderWithRouter(<ConceptView concept={{ ...CONCEPT, explanation: "Old." }} editable save={vi.fn(async () => {})} onDraft={onDraft} />);
    expect(onDraft).toHaveBeenLastCalledWith({ open: false, dirty: false, saving: false, failed: false });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "My explanation" }), "!");
    expect(onDraft).toHaveBeenLastCalledWith({ open: true, dirty: true, saving: false, failed: false });
  });
```

Create `playground/tests/web/not-found.test.tsx`:

```tsx
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotFound } from "../../web/components/NotFound.tsx";
import { renderWithRouter } from "./render.tsx";

describe("NotFound", () => {
  it("says what is missing and leads back home", async () => {
    await renderWithRouter(<NotFound message='There is no concept "tries".' />);
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByText('There is no concept "tries".')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Algorithms" })).toHaveAttribute("href", "/");
  });
});
```

In `playground/e2e/live.spec.ts`, both `page.getByRole("button", { name: "✎ Edit" })` become `page.getByRole("button", { name: "Edit" })`.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run playground/tests/web/concept-view.test.tsx playground/tests/web/concept-page.test.tsx playground/tests/web/not-found.test.tsx`
Expected: FAIL. There is no button named "Edit", `onDraft` is never called, Ctrl+S does nothing, and the link reads "Back to the home page".

- [ ] **Step 3: Rework `ConceptView`**

In `playground/web/components/ConceptView.tsx`:
- **Imports:**

```tsx
import { CircleX, Pencil, TriangleAlert } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { ConceptData } from "../../server/types.ts";
import { ApiError } from "../api.ts";
import { useConfirmLeave } from "../hooks/useConfirmLeave.ts";
import { shortcut } from "../lib/keys.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { Markdown } from "./Markdown.tsx";
import { Alert, AlertDescription } from "./ui/alert.tsx";
import { Button } from "./ui/button.tsx";
import { Kbd } from "./ui/kbd.tsx";
```

- **Draft state:** add after `ExplanationConflict`:

```tsx
/** Where the "My explanation" draft stands, for the page's status bar. */
export interface DraftState {
  open: boolean;
  /** The draft differs from the text it started from. */
  dirty: boolean;
  saving: boolean;
  /** The last Save failed (a conflict included) and no Save has succeeded since. */
  failed: boolean;
}

export const CLOSED_DRAFT: DraftState = { open: false, dirty: false, saving: false, failed: false };
```

- **Props:** add `onDraft?: (draft: DraftState) => void;` to both `ConceptViewProps` and `ExplanationProps`.
- **`ExplanationSection`:**
  - It takes `onDraft` in its props.
  - Right after the existing `useConfirmLeave(…)` line, add:

```tsx
  const open = draft !== null;
  const dirty = draft !== null && draft !== base;
  const failed = error !== null;
  useEffect(() => {
    onDraft?.({ open, dirty, saving, failed });
  }, [onDraft, open, dirty, saving, failed]);
```

  - After the `submit` function, add the shortcut:

```tsx
  // ⌘S / Ctrl+S saves the open draft, also from inside the editor.
  const latestSubmit = useRef(submit);
  useLayoutEffect(() => {
    latestSubmit.current = submit;
  });
  useHotkeys("mod+s", () => void latestSubmit.current(), { enabled: open, preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true });
```

  (These hooks go before the early `return null` and `return <p…>` branches, so the hook order never changes.)
- **Missing section:** the message for a missing section becomes:

```tsx
      <p className="my-4 text-sm text-warning">
        This concept has no "My explanation" section. Run <code>pnpm check</code>.
      </p>
```

- **Section markup:** the returned `<section>` becomes:

```tsx
  return (
    <section aria-labelledby="my-explanation" className="not-prose my-6 rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <h2 id="my-explanation" className="text-sm font-semibold">
          My explanation
        </h2>
        {editable && draft === null && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              setDraft(text ?? "");
              setBase(text ?? "");
            }}
          >
            <Pencil aria-hidden />
            Edit
          </Button>
        )}
      </div>
      <div className="p-4">
        {draft === null ? (
          text ? (
            <Markdown source={text} readmePath={readmePath} />
          ) : (
            <p className="text-muted-foreground italic">{editable ? "Not written yet. Explain the concept in your own words." : "Not written yet."}</p>
          )
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-64 overflow-hidden rounded-md border">
                <CodeEditor lang="md" value={draft} onChange={setDraft} ariaLabel="My explanation" className="h-full" autoFocus />
              </div>
              <section aria-label="Preview" className="h-64 overflow-y-auto rounded-md border border-dashed p-3">
                <Markdown source={draft} readmePath={readmePath} />
              </section>
            </div>
            {problem && (
              <Alert variant="warning">
                <TriangleAlert aria-hidden />
                <AlertDescription className="text-foreground">{problem}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <CircleX aria-hidden />
                <AlertDescription>
                  {error.issues.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {error.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    error.message
                  )}
                </AlertDescription>
              </Alert>
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
              <Button aria-label="Save" onClick={() => void submit()} disabled={saving || problem !== null}>
                {saving ? "Saving…" : "Save"}
                <Kbd>{shortcut("save")}</Kbd>
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
```

- **`ConceptView`:**
  - It takes `onDraft` and passes it to `ExplanationSection`: `<ExplanationSection … onDraft={onDraft} />`.
  - Its README error becomes:

```tsx
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertDescription>
            {concept.readme}: {concept.readmeError}
          </AlertDescription>
        </Alert>
```

- [ ] **Step 4: Write the concept page**

Replace `playground/web/routes/concept.tsx` with:

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ConceptData, HomeData } from "../../server/types.ts";
import { ApiError, conceptQuery, homeQuery, keys, putExplanation } from "../api.ts";
import { CLOSED_DRAFT, ConceptView, type DraftState, ExplanationConflict } from "../components/ConceptView.tsx";
import { Logo } from "../components/Logo.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { type SaveLabel, StatusBar } from "../components/StatusBar.tsx";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/ui/breadcrumb.tsx";
import { Progress } from "../components/ui/progress.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { shortcut } from "../lib/keys.ts";
import { prettifySlug } from "../lib/labels.ts";

export function ConceptPage() {
  const { slug } = useParams({ from: "/c/$slug" });
  // Keyed by slug, like the work view: a "My explanation" draft belongs to one concept, and going to another
  // concept must start a fresh page instead of carrying the draft (and its Save) over to it.
  return <ConceptContent key={slug} slug={slug} />;
}

/** What the status bar says about "My explanation". */
export function draftSaveLabel(draft: DraftState): SaveLabel {
  if (draft.saving) return { text: "Saving…", tone: "busy" };
  if (draft.failed) return { text: "Not saved", tone: "bad" };
  if (draft.dirty) return { text: "Unsaved changes", tone: "warn" };
  return { text: "Saved", tone: "ok" };
}

function ConceptHeader({ concept, home }: { concept: ConceptData; home: HomeData | undefined }) {
  // Progress comes from the home data; it is left out until that loads (or if it fails), never an error here.
  const exercises = home?.concepts.find((c) => c.slug === concept.slug)?.exercises ?? [];
  const solved = exercises.filter((exercise) => exercise.status === "solved").length;
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b bg-card px-3 text-[13px]">
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="flex items-center gap-2 font-medium text-foreground">
                <Logo />
                Algorithms
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span>Concepts</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">{concept.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Badge variant="secondary">{prettifySlug(concept.status)}</Badge>
      {exercises.length > 0 && (
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {solved}/{exercises.length} exercises
          <Progress value={(solved / exercises.length) * 100} aria-label="Exercises solved" className="w-20" />
        </span>
      )}
    </header>
  );
}

function ConceptSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ConceptContent({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const concept = useQuery(conceptQuery(slug));
  const home = useQuery(homeQuery());
  const [draft, setDraft] = useState<DraftState>(CLOSED_DRAFT);

  if (concept.isPending) return <ConceptSkeleton />;
  // A failed refresh (a live event refetches the concept) keeps the last data: replacing the page with the
  // error would throw away an open "My explanation" draft.
  if (concept.isError && !concept.data) {
    if (concept.error instanceof ApiError && concept.error.status === 404) return <NotFound message={`There is no concept "${slug}".`} />;
    return (
      <Alert variant="destructive" className="m-6 w-auto">
        <TriangleAlert aria-hidden />
        <AlertTitle>Could not load this concept</AlertTitle>
        <AlertDescription>{concept.error.message}</AlertDescription>
      </Alert>
    );
  }

  const save = async (text: string) => {
    const result = await putExplanation(slug, text, concept.data.version);
    if (!result.ok) {
      // Show the fresh README; the next Save uses its version.
      queryClient.setQueryData(keys.concept(slug), result.current);
      throw new ExplanationConflict(result.current.explanation ?? "");
    }
    await queryClient.invalidateQueries({ queryKey: keys.concept(slug) });
    toast.success("My explanation saved");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConceptHeader concept={concept.data} home={home.data} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-6">
          {concept.isError && (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlert aria-hidden />
              <AlertDescription>Could not refresh this concept ({concept.error.message}). Showing the last version loaded.</AlertDescription>
            </Alert>
          )}
          <ConceptView concept={concept.data} editable save={save} onDraft={setDraft} />
        </div>
      </main>
      <StatusBar subject="My explanation" save={draftSaveLabel(draft)} shortcuts={[{ keys: shortcut("save"), label: "Save" }]} />
    </div>
  );
}
```

- [ ] **Step 5: Restyle Not found and the disconnection banner**

Replace `playground/web/components/NotFound.tsx` with:

```tsx
import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";

export function NotFound({ message }: { message?: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <SearchX aria-hidden className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">{message ?? "This page does not exist."}</p>
      <Link to="/" className="mt-2 text-sm text-primary underline underline-offset-2">
        Back to Algorithms
      </Link>
    </main>
  );
}
```

Replace `playground/web/components/ConnectionBanner.tsx` with:

```tsx
import { TriangleAlert } from "lucide-react";
import { useConnected } from "../events.tsx";
import { Alert, AlertDescription } from "./ui/alert.tsx";

/** Loud on purpose: without the server, nothing is saved. The status bar's dot says the same, quietly. */
export function ConnectionBanner() {
  if (useConnected()) return null;
  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <TriangleAlert aria-hidden />
      <AlertDescription className="text-foreground">
        Disconnected — run <code className="font-mono">pnpm play</code> again. Unsaved changes stay in this tab and are saved when it reconnects.
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `pnpm exec vitest run playground/tests/web/concept-view.test.tsx playground/tests/web/concept-page.test.tsx playground/tests/web/not-found.test.tsx`
Expected: PASS. In the concept-page test `"keeps the concept and an open draft when a refresh fails"`, the home request answers 500 and the header leaves the progress out; `findByRole("alert")` still finds exactly one alert.

- [ ] **Step 7: Run everything and commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green, including `restart.spec.ts` (the banner text is unchanged).

```bash
git add playground/web/routes/concept.tsx playground/web/components/ConceptView.tsx playground/web/components/NotFound.tsx playground/web/components/ConnectionBanner.tsx \
  playground/tests/web/concept-view.test.tsx playground/tests/web/concept-page.test.tsx playground/tests/web/not-found.test.tsx playground/e2e/live.spec.ts
git commit -m "feat(playground): restyle the concept page, Not found and the disconnection banner"
```

---

### Task 11: theme check and visual walk

**Files:**
- Create: `playground/e2e/theme.spec.ts`
- No product code changes. The screenshots go to a scratch folder and are not committed.

**Interfaces:**
- Consumes: the finished UI.
- Produces: a light/dark end-to-end check, and screenshots for the user.

- [ ] **Step 1: Write the theme check**

Create `playground/e2e/theme.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { resetRepo } from "./fixture.ts";

test.beforeEach(() => resetRepo());

test.describe("light mode", () => {
  test.use({ colorScheme: "light" });

  test("uses the slate colors", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 250, 252)");
  });
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("follows the system with the GitHub Dark colors, in the app and in the editor", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(13, 17, 23)");
    await page.goto("/p/lc-0001");
    await expect(page.getByRole("contentinfo", { name: "Status bar" })).toHaveCSS("background-color", "rgb(22, 27, 34)");
    await expect(page.locator(".cm-editor")).toHaveCSS("background-color", "rgb(13, 17, 23)");
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm e2e -g "light mode|dark mode"`
Expected: PASS. (The theme already exists since Task 1, so this test pins it rather than driving it. If the editor color differs, check `@uiw/codemirror-theme-github`'s `githubDark` background: it is `#0d1117`.)

- [ ] **Step 3: Walk through the UI in a real browser (scratch repo only)**

From the repo root, after `pnpm e2e` has created `playground/e2e/.tmp/repo`:

```bash
WALK="${TMPDIR:-/tmp}/playground-ui-walk"
rm -rf "$WALK" && mkdir -p "$WALK/shots" && cp -R playground/e2e/.tmp/repo "$WALK/repo"
printf 'class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        return [0, 0]\n' > "$WALK/repo/problems/lc-0001-two-sum/solution.py"
ALGO_ROOT="$WALK/repo" pnpm play --no-open --port 4620 &
```

Then, with `playwright-cli`, take these screenshots (run it from `$WALK`, with a config file that sets `"browserName": "chromium"`):
- the home page;
- the home page grouped by status (`/?group=status`);
- `/p/lc-0001` after pressing the run shortcut, so the failing chips and table show;
- `/c/hash-map` with "Edit" open.

Take the four in light mode, then again with `contextOptions.colorScheme = "dark"`. Save them in `$WALK/shots/`.

Afterwards, stop the server on port 4620 and close the `playwright-cli` session. Never use port 4173, and never point `ALGO_ROOT` at the repo's own `problems/` or `concepts/`.

- [ ] **Step 4: Commit**

Run: `pnpm verify && pnpm e2e`
Expected: both green.

```bash
git add playground/e2e/theme.spec.ts
git commit -m "test(playground): pin the light and dark theme colors"
```

Report the screenshot folder (`$WALK/shots/`) to the controller. It is not part of the repo.

---

## Self-review notes (for the executor)

- **Order matters:**
  - Tasks 1→3 build the shared layer.
  - Task 4 (model) must land before 5–6.
  - Tasks 7, 8 and 9 all edit `routes/work.tsx` in that order.
  - Task 10 depends on Task 7's `StatusBar`.
  - Never run two implementers at once.
- **What each task leaves green:** every task's last step runs both `pnpm verify` and `pnpm e2e`. A task that changes visible text also updates the e2e selectors that read that text (listed in its Step 1).
- **Generated code:** if `shadcn add` prints a different file list than Task 1 Step 6 expects, because the registry moved on, record it in the report. Then adapt the imports in this plan to what was generated, and keep the variant edits of Step 7.
