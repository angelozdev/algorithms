import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConceptData } from "../../server/types.ts";
import { keys } from "../../web/api.ts";
import { routeTree } from "../../web/router.tsx";

// CodeMirror needs layout APIs that jsdom lacks; a textarea stands in for it here. The end-to-end tests use the real editor.
vi.mock("../../web/components/CodeEditor.tsx", async () => {
  const { createElement } = await import("react");
  return {
    CodeEditor: ({ value, onChange, ariaLabel }: { value: string; onChange(value: string): void; ariaLabel: string }) =>
      createElement("textarea", { "aria-label": ariaLabel, value, onChange: (event: { target: { value: string } }) => onChange(event.target.value) }),
  };
});

const concept = (slug: string, title: string, explanation: string): ConceptData => ({
  slug,
  title,
  status: "learning",
  readme: `concepts/${slug}/README.md`,
  before: `# ${title}\n\n## Intuition\n\nAbout ${title}.\n\n`,
  explanation,
  after: "",
  version: `${slug}-v1`,
  readmeError: null,
});

const ARRAY = concept("array", "Array", "Array text.");
const HASH_MAP = concept("hash-map", "Hash map", "Hash map text.");

/** Every request the page sends; the tests answer them one by one. */
let requests: { method: string; url: string; body: string | null }[] = [];
const unexpected = () => Response.json({ error: "unexpected request" }, { status: 500 });
let answer: (url: string, method: string) => Response = unexpected;

beforeEach(() => {
  requests = [];
  answer = unexpected;
  // jsdom has no matchMedia; the app's toaster follows the system theme with it.
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      requests.push({ method, url, body: typeof init?.body === "string" ? init.body : null });
      return answer(url, method);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The real app's routes in a memory router, with both concepts already loaded (as after visiting them once). */
async function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  client.setQueryData(keys.concept(ARRAY.slug), ARRAY);
  client.setQueryData(keys.concept(HASH_MAP.slug), HASH_MAP);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  await act(() => router.load());
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: /^My explanation/ });
  return { router, client };
}

describe("concept page", () => {
  it("closes the open draft when another concept opens, so it can never be saved into that concept", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true); // the user agrees to leave the unsaved draft
    const { router } = await renderApp("/c/array");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "My explanation" }), " Draft for Array.");

    await act(() => router.navigate({ to: "/c/$slug", params: { slug: "hash-map" } }));
    expect(await screen.findByRole("heading", { name: "Hash map" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "My explanation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText("Hash map text.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "My explanation" })).toHaveValue("Hash map text.");
    expect(requests.filter((request) => request.method === "PUT")).toEqual([]);
  });

  it("keeps the concept and an open draft when a refresh fails, and says so", async () => {
    const { client } = await renderApp("/c/array");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByRole("textbox", { name: "My explanation" }), " Mine.");
    answer = (url, method) =>
      method === "GET" && new URL(url, "http://localhost").pathname === "/api/concept"
        ? Response.json({ error: "README unreadable" }, { status: 500 })
        : unexpected();
    // What a live event does when the README changes on disk.
    await act(() => client.invalidateQueries({ queryKey: keys.concept(ARRAY.slug) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("README unreadable");
    expect(screen.getByRole("heading", { name: "Array" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "My explanation" })).toHaveValue("Array text. Mine.");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
