import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { HomeData } from "../../server/types.ts";
import { HomeView } from "../../web/routes/home.tsx";
import { renderWithRouter } from "./render.tsx";

const DATA: HomeData = {
  problems: [
    { id: "lc-0001", title: "Two Sum", difficulty: "easy", patterns: ["arrays-hashing"], concepts: ["hash-map"], status: "solved", inProgress: false, error: null },
    { id: "lc-0026", title: "Remove Duplicates", difficulty: "easy", patterns: ["two-pointers"], concepts: ["two-pointers"], status: "solving", inProgress: true, error: null },
    { id: "lc-0030", title: "lc-0030-broken", difficulty: null, patterns: [], concepts: [], status: "todo", inProgress: false, error: "frontmatter: bad" },
  ],
  groups: [
    { pattern: "(no pattern yet)", ids: ["lc-0030"] },
    { pattern: "arrays-hashing", ids: ["lc-0001"] },
    { pattern: "two-pointers", ids: ["lc-0026"] },
  ],
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

describe("HomeView", () => {
  it("shows work in progress first, problems by pattern, and concepts with their progress", async () => {
    await renderWithRouter(<HomeView data={DATA} />);
    const progress = screen.getByRole("region", { name: "In progress" });
    expect(within(progress).getByRole("link", { name: "lc-0026 Remove Duplicates" })).toHaveAttribute("href", "/p/lc-0026");
    expect(within(progress).getByRole("link", { name: "hash-map/02 Most frequent" })).toHaveAttribute("href", "/e/hash-map/02");
    expect(screen.getByText("1/3 solved")).toBeInTheDocument();
    const problems = screen.getByRole("region", { name: "Problems" });
    expect(within(problems).getByRole("heading", { name: "two-pointers" })).toBeInTheDocument();
    expect(within(problems).getByText(/frontmatter: bad/)).toBeInTheDocument();
    const concepts = screen.getByRole("region", { name: "Concepts" });
    expect(within(concepts).getByRole("link", { name: "Hash map" })).toHaveAttribute("href", "/c/hash-map");
    expect(within(concepts).getByText(/1\/3 exercises/)).toBeInTheDocument();
    expect(within(concepts).getByRole("link", { name: "hash-map/03 Same letters" })).toHaveAttribute("href", "/e/hash-map/03");
  });

  it("filters by id or title", async () => {
    await renderWithRouter(<HomeView data={DATA} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "two");
    expect(screen.getByRole("link", { name: "lc-0001 Two Sum" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /lc-0026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "In progress" })).not.toBeInTheDocument();
  });
});
