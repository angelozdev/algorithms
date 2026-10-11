import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeData, TargetData } from "../../server/types.ts";
import { keys } from "../../web/api.ts";
import { routeTree } from "../../web/router.tsx";

// CodeMirror needs layout APIs that jsdom lacks; a textarea stands in for it here (as in concept-page.test.tsx).
// A fresh CodeMirror instance has an empty undo history: the end-to-end test checks that with the real editor.
vi.mock("../../web/components/CodeEditor.tsx", async () => {
  const { createElement } = await import("react");
  return {
    CodeEditor: ({ value, onChange, ariaLabel }: { value: string; onChange(value: string): void; ariaLabel: string }) =>
      createElement("textarea", { "aria-label": ariaLabel, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) }),
  };
});

const STUB = "class Solution:\n    def isValid(self, s: str) -> bool:\n        raise NotImplementedError\n";

const target = (extra: Partial<TargetData>): TargetData => ({
  id: "lc-0020",
  kind: "problem",
  title: "Valid Parentheses",
  readme: "problems/lc-0020-valid-parentheses/README.md",
  markdown: "# 20. Valid Parentheses\n\nPlaceholder statement.\n",
  readmeError: null,
  difficulty: "easy",
  url: null,
  status: "solved",
  hints: 0,
  signature: null,
  exampleInput: null,
  caseError: null,
  solutions: { py: true, ts: false },
  gate: null,
  freshStart: false,
  ...extra,
});
const HOME: HomeData = { problems: [], groups: [], concepts: [] };

let requests: { method: string; path: string; body: string | null }[] = [];
let started = false;
/** What GET /api/target answers before Start review. */
let before: Partial<TargetData> = { gate: { kind: "review", minutes: 9 } };

beforeEach(() => {
  requests = [];
  started = false;
  before = { gate: { kind: "review", minutes: 9 } };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      requests.push({ method, path: url.pathname, body: typeof init?.body === "string" ? init.body : null });
      if (url.pathname === "/api/study/start/lc-0020") {
        started = true;
        return Response.json({ kind: "review" });
      }
      if (url.pathname === "/api/target") return Response.json(started ? target({ status: "solving", freshStart: true }) : target(before));
      if (url.pathname === "/api/solution" && method === "GET") return Response.json({ code: STUB, version: "stub-v1" });
      // Another tab saved over the file meanwhile.
      if (url.pathname === "/api/solution" && method === "PUT") return Response.json({ code: "# from another tab\n", version: "other-v1" }, { status: 409 });
      return Response.json({ error: "unexpected request" }, { status: 500 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openProblem() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  client.setQueryData(keys.home, HOME);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/p/lc-0020"] }) });
  await act(() => router.load());
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("the Start review gate (spec §7)", () => {
  it("shows the statement and a Start review button instead of the old code, then opens the editor on a fresh stub", async () => {
    await openProblem();
    await screen.findByRole("heading", { name: "Time to review" });
    expect(screen.getByRole("heading", { name: "20. Valid Parentheses" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "solution.py" })).not.toBeInTheDocument();
    expect(requests.some((request) => request.path === "/api/solution")).toBe(false); // the old code is never loaded

    await userEvent.click(screen.getByRole("button", { name: "Start review" }));
    expect(await screen.findByRole("textbox", { name: "solution.py" })).toHaveValue(STUB);
    expect(requests.find((request) => request.method === "POST")).toEqual({ method: "POST", path: "/api/study/start/lc-0020", body: JSON.stringify({ lang: "py" }) });
  });

  it("never offers Keep mine during an attempt started from scratch, and does otherwise", async () => {
    before = { status: "solving", freshStart: true };
    await openProblem();
    fireEvent.change(await screen.findByRole("textbox", { name: "solution.py" }), { target: { value: `${STUB}x` } }); // an edit, then autosave
    expect(await screen.findByRole("button", { name: "Use disk version" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep mine" })).not.toBeInTheDocument();
  });

  it("offers Keep mine for an attempt that was not started from scratch", async () => {
    before = { status: "solving", freshStart: false };
    await openProblem();
    fireEvent.change(await screen.findByRole("textbox", { name: "solution.py" }), { target: { value: `${STUB}x` } }); // an edit, then autosave
    expect(await screen.findByRole("button", { name: "Keep mine" })).toBeInTheDocument();
  });
});
