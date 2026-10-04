# Grind 75 import — design

**Status:** draft for review · **Date:** 2026-10-03 · **Branch:** `playground` (after the UI redesign plan finishes)

## 1. Goal

Register every problem of the LeetCode list [Grind 75](https://leetcode.com/problem-list/rab78cw1/) in the repo, tagged with a new `lists` field, so the user can filter and group them on the playground home page. Today 4 of the 75 exist (lc-0001, lc-0020, lc-0021, lc-0070); 71 are new.

Six of them do not fit the runner today. The user chose to extend the runner first and import all 71 in one effort ("todo junto").

## 2. Decisions taken in conversation

| # | Decision | Why |
|---|---|---|
| D1 | A new frontmatter field `lists: [grind-75]`, plus a **List** facet and a **Group by → List** option on the home page, kept in the URL. | The user approved it ("Sí, así"). `lists` rather than `tags`: it names curated lists and works for later ones (Blind 75, NeetCode 150). |
| D2 | Extend the runner for the 6 unsupported problems before importing. | The user chose "Todo junto". |
| D3 | Solutions keep LeetCode's signatures per language, so code can be pasted back into LeetCode. | Verified against LeetCode's own `codeSnippets` and `metaData` (GraphQL, 2026-10-03). |
| D4 | No LeetCode client library (`leetcode-query`). Keep the existing `fetch` + `node-html-markdown`, add `--list`. | `leetcode-query` 2.0.1: last release 2025-07, ~2.4k weekly downloads, pulls `cross-fetch` (Node 24 has `fetch`), and has no problem-list query. The hard part (HTML → Markdown) already uses a dedicated library. |
| D5 | Every imported problem starts as `status: todo`. | They are for later; `todo` keeps them out of "In progress" until the user starts one. |

## 3. Runner extensions

All of these live in `runner/src/schema.ts` (validation), both harnesses (`runner/harness/ts/harness.ts`, `runner/harness/python/harness.py`), the node modules (`lc.ts`, `lc.py`), `runner/src/stubs.ts` and `runner/src/compare.ts`. `fill-expected`, `pnpm test`, stress runs and the playground's custom input all go through the harness, so they pick the features up without changes of their own. Each feature has tests in both languages.

### 3.1 Linked-list cycle — `cycle` param (lc-0141)

A param marked `"cycle": "<list param>"` builds the input but is **not** passed to the solution. It is the index of the node the tail links back to; `-1` means no cycle.

```json
"params": [{"name": "head", "type": "ListNode"}, {"name": "pos", "type": "int", "cycle": "head"}],
"returns": "bool",
"examples": [{"input": [[3,2,0,-4], 1], "expected": true}]
```

- Schema: the param's type is `int`; the target exists, comes earlier, and has type `ListNode`.
- Harness: `pos` outside `-1 … length-1` fails the case with `pos = 7 is out of range for head (4 nodes)`.
- Signature stays `hasCycle(head)`.

### 3.2 Node references — `ref` param and `TreeNode.val` return (lc-0235, lc-0236)

A param marked `"ref": "<tree param>"` takes a node **value** in the JSON and reaches the solution as **the node with that value inside the built tree** (first match in level order; `null` stays `null`). The return type `"TreeNode.val"` means "a node, judged by its `val`" (`null` → `null`).

```json
"params": [{"name": "root", "type": "TreeNode"}, {"name": "p", "type": "TreeNode", "ref": "root"}, {"name": "q", "type": "TreeNode", "ref": "root"}],
"returns": "TreeNode.val",
"examples": [{"input": [[6,2,8,0,4,7,9,null,null,3,5], 2, 8], "expected": 6}]
```

- Schema: the param's type is `TreeNode`; the target exists, comes earlier, has type `TreeNode` and is not itself a `ref`.
- Harness: a value not in the tree fails the case with `p = 9 is not a value in root`.
- Stub types: `TreeNode | null` / `TreeNode | None` for both the params and the return.

### 3.3 Graph type — `GraphNode` (lc-0133)

A new base type. JSON form: LeetCode's adjacency list. Node `i` (0-based) has `val = i + 1`, and `list[i]` holds its neighbors' values in order. `[]` is `null`; `[[]]` is one node with no neighbors.

```json
"params": [{"name": "node", "type": "GraphNode"}],
"returns": "GraphNode",
"examples": [{"input": [[[2,4],[1,3],[2,4],[1,3]]], "expected": [[2,4],[1,3],[2,4],[1,3]]}]
```

- The solution receives node 1 (LeetCode's convention).
- Classes, named as on LeetCode: `_Node` in TS (`import { _Node } from "lc"`), `Node` in Python (`from lc import Node`). Both have `val` and `neighbors`.
- Serializing a returned node:
  - collect every reachable node, then emit the adjacency list ordered by `val`;
  - values that are not exactly `1 … n` fail with a serialization error;
  - more than 10^6 nodes fail as well.
- **Copy check:** when a `GraphNode` param and a `GraphNode` return appear together, any returned node that is an input object fails the case with `returned a node of the input graph: return a copy`.

### 3.4 Interactive API — `api` param (lc-0278)

A param marked `"api": "<name>"` is **not** passed as an argument. It configures a function the judge provides. The registry has one entry today: `isBadVersion`, defined as `(version) => version >= value`.

```json
"params": [{"name": "n", "type": "int"}, {"name": "bad", "type": "int", "api": "isBadVersion"}],
"returns": "int",
"examples": [{"input": [5, 4], "expected": 4}]
```

| | TypeScript (LeetCode's shape) | Python (LeetCode's shape) |
|---|---|---|
| Solution | `export default function solution(isBadVersion) { return function firstBadVersion(n) { … } }` | `class Solution: def firstBadVersion(self, n)` calling a global `isBadVersion` |
| Harness | calls the default export with the API functions (in param order), then calls what it returns with the other args; a non-function result is a `missing-entry` error | sets `module.isBadVersion` before each case |
| Stub/editor | a typed `isBadVersion: (version: number) => boolean` param | `from lc import isBadVersion  # delete this line when pasting into LeetCode`; `lc.isBadVersion` raises "provided by the runner" if called outside it |

- Schema: an unknown API name is invalid, and each API appears at most once.
- A stress case with `n = 2^31 - 1` makes a linear scan time out.

### 3.5 Codec mode — `"mode": "codec"` (lc-0297)

A round trip: `deserialize(serialize(value))`, judged against `expected`. Examples set `expected` equal to the input; hidden values come from `fill-expected` as usual. The string format is the solver's choice, as on LeetCode.

```json
"mode": "codec", "entry": "Codec",
"params": [{"name": "root", "type": "TreeNode"}],
"examples": [{"input": [[1,2,3,null,null,4,5]], "expected": [1,2,3,null,null,4,5]}]
```

- Schema: exactly one param; `returns` and `inPlace` are not allowed. The judged value is serialized with the param's type.
- TS (LeetCode's shape): named exports `serialize(root): string` and `deserialize(data): TreeNode | null`. A missing export is a `missing-entry` error.
- Python (LeetCode's shape): class `<entry>` with `serialize` / `deserialize`, instantiated twice (`ser`, `deser`).
- `serialize` returning a non-string fails the case with `serialize must return a string, got <type>`.

### 3.6 Nested unordered compare — `"compare": "unordered-nested"`

Like `unordered`, but each inner array is sorted too before comparing. For answers that are sets of sets: 3Sum (15), Combination Sum (39), Subsets (78). `unordered` stays top-level only (Permutations, 46, keeps its inner order).

## 4. LeetCode tooling

- `pnpm -s leetcode --list <slug | url>` prints `{ name, questions: [{ id, folder, title, slug, difficulty, url, paidOnly }] }` from the `favoriteQuestionList` query (one request, up to 200 questions).
- The single-problem draft stays as it is. For `"manual": true` problems it already warns; the importer writes those six `cases.json` files by hand.

## 5. `lists` field

- **Frontmatter:** `lists: string[]` on problems only (not exercises). It is optional and defaults to `[]`, so existing READMEs stay valid. Entries are kebab-case (`check` rejects anything else).
- **Labels:** `LIST_LABELS = { "grind-75": "Grind 75" }`, falling back to `prettifySlug`.
- **Home page:**
  - `HomeProblem.lists: string[]`;
  - search param `list: string[]` (default `[]`, stripped from the URL when empty, per-entry tolerant like the other facets);
  - a **List** facet after **Concept**;
  - a `list` grouping that follows the existing multi-membership rules: a problem in several lists sits in each group, and problems in no list form a last group, "No list";
  - `isFiltered` and `clearFilters` include `list`.
- **Docs:**
  - the `problem` skill's README template gains `lists: []`;
  - the CLAUDE.md vocabulary names the field;
  - README.md documents `pnpm leetcode --list`.
- The `INDEX.md` generator is unchanged; it does not show lists.
- Harness note: `cycle` and `api` params are part of each case's `input` (so `inputIssues` still counts every param), but both harnesses and the stubs leave them out of the solution's arguments.

## 6. Import

- **Source:** `pnpm -s leetcode --list rab78cw1` (75 questions, none premium).
- **New problems:** each of the 71 follows the `problem` skill, steps 1–7, with these settings:
  - `status: todo` and `lists: [grind-75]`;
  - log line `- <date> · registered (Grind 75)`;
  - patterns from the CLAUDE.md vocabulary;
  - concept slugs from a shared catalog fixed in the plan; a new slug only when none fits, reported back.
- **Existing problems:** the 4 get `lists: [grind-75]` and nothing else.
- **Public repo:** statements are paraphrased in 2–5 sentences. Acceptance check: no run of 10 or more consecutive words copied from LeetCode's statement text (examples and constraints excluded).
- **Hidden cases:** 6–10 per problem, with expected values from a reference solution under `$TMPDIR` that is deleted afterwards and never appears in the repo, a report, a commit or the chat.
- **Stress:** `stress.ts` when the constraints allow n ≥ 10^4 and a naive solution is quadratic or worse; never beyond the problem's own limits.
- **Class-design problems** (146, 155, 208, 232, 295, 981): `mode: class`. 295 uses `compare: float`.
- **Work on disk:** no `solution.py` / `solution.ts` is created (no `pnpm test`, `watch` or `play` runs on these problems), and no file the user owns is touched.
- **Commits:** problems land in batches, one commit per batch, each passing `pnpm -s sync && pnpm -s check` and `pnpm verify`.

## 7. Order of work

1. Runner extensions (§3) and `--list` (§4).
2. The `lists` field and the home page (§5).
3. The import (§6), the six special problems last, once their runner features exist.

## 8. Out of scope

- Concept notes for the new concepts: they show as missing and get created on demand with the `concept` skill.
- Grind's week-by-week order.
- Other lists and premium problems.

## 9. Risks

- **lc-0021:** the main checkout (`restructure`) has an uncommitted edit to `lc-0021`'s README, and this work adds `lists` to it. Integrating `playground` into `restructure` will need that edit committed first, and may need a one-line merge.
- **Constraint on future exercises:** CLAUDE.md forbids concept exercises isomorphic to unsolved problems, and 71 new `todo` problems narrow that space. The `concept` skill already checks `INDEX.md`.
- **Volume:** 71 problems is hours of agent work. Batches commit independently, so an interruption loses at most one batch.
