import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { easyToHard, itemTitle, listMembers, loadCatalog, readProblem } from "../catalog.ts";
import { addDays, daysBetween, localDate, localDay, startOfLocalDay } from "../days.ts";
import { seedFrom, shuffled } from "../random.ts";
import { makeCoachRepo, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

describe("local days (spec §6.3: the day boundary is local midnight in profile.timezone)", () => {
  it("gives the local date of an instant and the instants that bound its day", () => {
    expect(localDate(new Date("2026-10-06T04:59:59.999Z"), TZ)).toBe("2026-10-05");
    expect(localDate(new Date("2026-10-06T05:00:00.000Z"), TZ)).toBe("2026-10-06");
    expect(localDay(new Date("2026-10-05T14:00:00.000Z"), TZ)).toEqual({
      date: "2026-10-05",
      start: new Date("2026-10-05T05:00:00.000Z"),
      end: new Date("2026-10-06T05:00:00.000Z"),
    });
  });

  it("follows daylight saving time: a local day can be 23 hours long", () => {
    const day = localDay(new Date("2026-03-08T12:00:00.000Z"), "America/New_York");
    expect(day.start).toEqual(new Date("2026-03-08T05:00:00.000Z"));
    expect(day.end).toEqual(new Date("2026-03-09T04:00:00.000Z"));
    expect(startOfLocalDay("2026-11-01", "America/New_York")).toEqual(new Date("2026-11-01T04:00:00.000Z"));
  });

  it("counts calendar days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(daysBetween("2026-10-05", "2026-10-15")).toBe(10);
    expect(daysBetween("2026-10-15", "2026-10-05")).toBe(-10);
  });
});

describe("seeded order (spec §6.2: the mix is seeded by the local date)", () => {
  it("is the same for the same seed, a permutation, and differs between seeds", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `lc-${9100 + i}`);
    expect(seedFrom("2026-10-05")).toBe(seedFrom("2026-10-05"));
    expect(shuffled(ids, seedFrom("2026-10-05"))).toEqual(shuffled(ids, seedFrom("2026-10-05")));
    expect([...shuffled(ids, 7)].sort()).toEqual(ids);
    expect(shuffled(ids, seedFrom("2026-10-05"))).not.toEqual(shuffled(ids, seedFrom("2026-10-06")));
  });
});

describe("the catalog (spec D11: content is joined in memory)", () => {
  it("has runnable problems only, with their first pattern and lists, and concepts with their exercises", () => {
    const root = makeCoachRepo();
    put(root, "problems/lc-9199-draft/README.md", "---\nid: lc-9199\ntitle: Draft\n---\n# Draft\n"); // no cases.json
    put(root, "problems/lc-9198-broken/README.md", "---\nid: [\n---\n");
    put(root, "problems/lc-9198-broken/cases.json", "{}");
    const catalog = loadCatalog(root);
    expect(catalog.problems.has("lc-9199")).toBe(false);
    expect(catalog.problems.has("lc-9198")).toBe(false);
    expect(catalog.problems.get("lc-9101")).toEqual({ id: "lc-9101", title: "Sample 9101", difficulty: "easy", pattern: "arrays-hashing", lists: ["demo-list", "wide-list"] });
    expect(catalog.concepts.get("basics-a")).toEqual({ slug: "basics-a", title: "Concept basics-a", exercises: ["basics-a/01"] });
    expect(catalog.concepts.get("pointer-intro")!.exercises).toEqual([]);
    expect(listMembers(catalog, "demo-list").map((p) => p.id)).toEqual(["lc-9101", "lc-9102", "lc-9103", "lc-9104", "lc-9105", "lc-9106", "lc-9107", "lc-9108"]);
    expect([itemTitle(catalog, "basics-a/01"), itemTitle(catalog, "map-intro"), itemTitle(catalog, "lc-0000")]).toEqual(["Drill basics-a", "Concept map-intro", null]);
  });

  it("orders easy to hard, then by number", () => {
    const catalog = loadCatalog(makeCoachRepo());
    const ids = [...catalog.problems.values()].filter((p) => p.pattern === "arrays-hashing").sort(easyToHard).map((p) => p.id);
    expect(ids).toEqual(["lc-9101", "lc-9102", "lc-9111", "lc-9103"]);
  });

  it("reads one problem's README without scanning the repo, and never throws", () => {
    const root = makeCoachRepo();
    expect(readProblem(root, "lc-9103")).toMatchObject({ difficulty: "hard", pattern: "arrays-hashing" });
    expect(readProblem(root, "lc-0000")).toBeNull();
    expect(readProblem("/nowhere", "lc-9103")).toBeNull();
  });
});
