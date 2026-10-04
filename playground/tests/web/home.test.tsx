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

  it("Reset pushes a history entry, so Back returns to the filtered view", async () => {
    const router = await renderHome("/?status=solved");
    await screen.findByRole("searchbox", { name: "Search" });
    await waitFor(() => expect(router.state.location.search).toEqual({ status: "solved" }));
    expect(rowTitles()).toEqual(["Two Sum"]);

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(router.history.length).toBe(2); // pushed a new entry, unlike typing in the search box

    router.history.back();
    await waitFor(() => expect(router.state.location.search).toEqual({ status: "solved" }));
    expect(rowTitles()).toEqual(["Two Sum"]);
  });
});
