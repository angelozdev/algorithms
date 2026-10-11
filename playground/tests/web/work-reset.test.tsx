import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    // Off (0, 0): jsdom gives every element a zero-size rect, so a pointerdown at the origin also lands inside the
    // resizable panel group's drag-hit-testing (react-resizable-panels) and gets preventDefault()'d before Radix's
    // own handler opens the menu (composeEventHandlers skips it once defaultPrevented is true).
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reset options" }), { button: 0, ctrlKey: false, clientX: 9999, clientY: 9999 });
    await userEvent.click(await screen.findByRole("menuitem", { name: /^Clean code/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "solution.py" })).toHaveValue(STUB));
  });
});

describe("discarding an open attempt brings the gate back (final review finding 1)", () => {
  let discarded = false;

  beforeEach(() => {
    discarded = false;
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
        const method = init?.method ?? (input instanceof Request ? input.method : "GET");
        // Before the discard: an item with an open review attempt (gate: null, inProgress: true, as TARGET already
        // is). After: the server's next /api/target answers with the review gate `startGate` would have built.
        if (url.pathname === "/api/target") return Response.json(discarded ? { ...TARGET, status: "solved", inProgress: false, gate: { kind: "review", minutes: 9 } } : TARGET);
        if (url.pathname === "/api/solution" && method === "GET") return Response.json({ code: OLD, version: "old-v1" });
        if (url.pathname === "/api/study/reset/lc-0020" && method === "GET") return Response.json({ open: { hints: 2, minutes: 14 }, attempts: 1, hints: 2, versions: 0, examLocked: false });
        if (url.pathname === "/api/study/reset/lc-0020" && method === "POST") {
          discarded = true;
          return Response.json({ action: "attempt" });
        }
        return Response.json({ error: "unexpected request" }, { status: 500 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows Start review again after Discard attempt, instead of leaving the editor open on a closed item", async () => {
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
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reset options" }), { button: 0, ctrlKey: false, clientX: 9999, clientY: 9999 });
    const discard = await screen.findByRole("menuitem", { name: /^Discard attempt/ });
    await waitFor(() => expect(discard).not.toHaveAttribute("aria-disabled"));
    await userEvent.click(discard);
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("button", { name: "Start review" })).toBeInTheDocument();
  });
});
