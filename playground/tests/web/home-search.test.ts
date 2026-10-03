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
