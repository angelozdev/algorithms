import { describe, expect, it } from "vitest";
import type { CatalogProblem } from "../catalog.ts";
import { type LearnInput, learnSequence } from "../sequence.ts";

const p = (id: string, pattern: string, difficulty: CatalogProblem["difficulty"] = "medium"): CatalogProblem => ({ id, title: id, difficulty, pattern, lists: ["demo-list"] });
const NOW = new Date("2026-10-05T14:00:00.000Z");
const EARLIER = new Date("2026-10-01T14:00:00.000Z");

const MEMBERS = [
  p("lc-9103", "arrays-hashing", "hard"),
  p("lc-9101", "arrays-hashing", "easy"),
  p("lc-9102", "arrays-hashing", "medium"),
  p("lc-9104", "two-pointers", "easy"),
  p("lc-9105", "two-pointers", "medium"),
  p("lc-9106", "stack", "easy"),
  p("lc-9108", "greedy", "medium"),
];

function input(overrides: Partial<LearnInput> = {}): LearnInput {
  return {
    date: "2026-10-05",
    now: NOW,
    order: ["arrays-hashing", "two-pointers", "stack", "greedy"],
    members: MEMBERS,
    block: 2,
    mixAfterBlock: 1,
    intros: [],
    attempted: new Set(),
    firstClosed: new Map(),
    conceptOf: (pattern) => ({ "arrays-hashing": "map-intro", "two-pointers": "pointer-intro" })[pattern] ?? null,
    conceptLearned: () => true,
    ...overrides,
  };
}

const take = (generator: Generator<unknown>, n: number) => {
  const out: unknown[] = [];
  for (const value of generator) {
    out.push(value);
    if (out.length === n) break;
  }
  return out;
};

describe("learnSequence (spec §6.2)", () => {
  it("opens the first pattern with its concept and stops there while the concept is not learned", () => {
    expect([...learnSequence(input({ conceptLearned: () => false }))]).toEqual([
      { step: { kind: "concept", slug: "map-intro", pattern: "arrays-hashing" }, introduces: "arrays-hashing" },
    ]);
  });

  it("then runs the block easy to hard, the mix, and the next pattern", () => {
    const steps = take(learnSequence(input()), 5);
    expect(steps).toEqual([
      { step: { kind: "block", itemId: "lc-9101", pattern: "arrays-hashing", index: 1, size: 2 }, introduces: "arrays-hashing" },
      { step: { kind: "block", itemId: "lc-9102", pattern: "arrays-hashing", index: 2, size: 2 }, introduces: null },
      { step: { kind: "mix", itemId: "lc-9103", pattern: "arrays-hashing" }, introduces: null },
      { step: { kind: "block", itemId: "lc-9104", pattern: "two-pointers", index: 1, size: 2 }, introduces: "two-pointers" },
      { step: { kind: "block", itemId: "lc-9105", pattern: "two-pointers", index: 2, size: 2 }, introduces: null },
    ]);
  });

  it("gates a newly introduced pattern on its concept", () => {
    const steps = [...learnSequence(input({ conceptLearned: (slug) => slug === "map-intro" }))];
    expect(steps.at(-1)).toEqual({ step: { kind: "concept", slug: "pointer-intro", pattern: "two-pointers" }, introduces: "two-pointers" });
  });

  it("continues where the recorded work left off, and leaves problems done before the intro out of the block", () => {
    const steps = take(
      learnSequence(
        input({
          intros: [{ pattern: "arrays-hashing", at: NOW }],
          attempted: new Set(["lc-9101", "lc-9102"]),
          firstClosed: new Map([
            ["lc-9101", EARLIER],
            ["lc-9102", NOW],
          ]),
        }),
      ),
      1,
    );
    // lc-9101 was done before the pattern was introduced, so the block is 9102 and 9103.
    expect(steps).toEqual([{ step: { kind: "block", itemId: "lc-9103", pattern: "arrays-hashing", index: 2, size: 2 }, introduces: null }]);
  });

  it("draws the mix in an order seeded by the local date", () => {
    const allIntroduced = {
      intros: ["arrays-hashing", "two-pointers", "stack", "greedy"].map((pattern) => ({ pattern, at: EARLIER })),
      attempted: new Set(["lc-9101", "lc-9102"]),
      firstClosed: new Map([
        ["lc-9101", EARLIER],
        ["lc-9102", EARLIER],
      ]),
    };
    const order = (date: string) => [...learnSequence(input({ ...allIntroduced, date }))].map((planned) => (planned.step as { itemId: string }).itemId).join(" ");
    expect(order("2026-10-05")).toBe(order("2026-10-05"));
    const dates = Array.from({ length: 10 }, (_, i) => `2026-10-${String(10 + i)}`);
    expect(new Set(dates.map(order)).size).toBeGreaterThan(1);
    expect(order("2026-10-05").split(" ").sort()).toEqual(["lc-9103", "lc-9104", "lc-9105", "lc-9106", "lc-9108"]);
  });

  it("follows the pattern order, and serves only the mix once every pattern is introduced", () => {
    const steps = [...learnSequence(input({ block: 5, mixAfterBlock: 0 }))].map((planned) => (planned as { step: { kind: string; itemId?: string } }).step);
    expect(steps.map((step) => step.itemId)).toEqual(["lc-9101", "lc-9102", "lc-9103", "lc-9104", "lc-9105", "lc-9106", "lc-9108"]);
    const done = new Set(MEMBERS.map((m) => m.id).filter((id) => id !== "lc-9105"));
    const tail = [...learnSequence(input({ intros: ["arrays-hashing", "two-pointers", "stack", "greedy"].map((pattern) => ({ pattern, at: EARLIER })), attempted: done, firstClosed: new Map([...done].map((id) => [id, EARLIER])) }))];
    expect(tail).toEqual([{ step: { kind: "mix", itemId: "lc-9105", pattern: "two-pointers" }, introduces: null }]);
  });
});
