import { removeTemp, tempDir } from "../../../runner/tests/helpers.ts";
import { conceptReadme, exerciseReadme, problemReadme, put } from "../../../scripts/tests/fixture.ts";
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
