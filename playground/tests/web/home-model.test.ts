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
const ids = (items: readonly { id: string }[]) => items.map((p) => p.id);
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
