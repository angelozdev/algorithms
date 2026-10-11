import { cpSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { loadCatalog } from "../catalog.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { runStudyCli } from "../commands.ts";
import { recordWork } from "../record.ts";
import { openStudy } from "../store.ts";

// The shipped content end to end (study coach spec §15, D6, D7): a copy of this repo's presets, problems and
// phase-0 notes migrates cleanly, and the coach walks the five base concepts in the preset's order.

afterEach(cleanupTempDirs);

/** Phase 0 of curriculum/grind-75.yaml (`phases.bases.concepts`), in order, with the title of each note. */
const BASES: [slug: string, title: string][] = [
  ["big-o", "Big-O"],
  ["recursion", "Recursion"],
  ["arrays-and-strings", "Arrays and strings"],
  ["maps-and-sets", "Maps and sets"],
  ["sorting", "Sorting"],
];
/** The base notes written so far (study coach Plan C adds one per task). */
const WRITTEN = ["big-o", "recursion", "arrays-and-strings", "maps-and-sets", "sorting"];
const TZ = "America/Bogota";
const MONDAY = "2026-10-05T14:00:00.000Z"; // 09:00 in Bogotá
const DAY = 86_400_000;
/** Content files only: never a solution file, never anything from .study. */
const CONTENT = new Set(["README.md", "cases.json"]);

/** The presets, every problem and the written base notes, as a fresh clone has them. */
function shippedCopy(): string {
  const root = makeTempDir("algo-shipped-");
  cpSync(path.join(REPO_ROOT, "curriculum"), path.join(root, "curriculum"), { recursive: true });
  const content = (rel: string) =>
    cpSync(path.join(REPO_ROOT, rel), path.join(root, rel), {
      recursive: true,
      filter: (source) => statSync(source).isDirectory() || CONTENT.has(path.basename(source)),
    });
  content("problems");
  for (const slug of WRITTEN) content(path.join("concepts", slug));
  return root;
}

interface Copy {
  root: string;
  clock: FixedClock;
  cli(...argv: string[]): Promise<{ code: number; out: string; err: string }>;
  json(...argv: string[]): Promise<any>;
}

/** A fresh copy and the study CLI run in-process on it, at Monday 09:00 in Bogotá. */
function copy(): Copy {
  const root = shippedCopy();
  const clock = fixedClock(MONDAY);
  const cli = async (...argv: string[]) => {
    let out = "";
    let err = "";
    const code = await runStudyCli(argv, { root, clock, out: (text) => (out += text), err: (text) => (err += text) });
    return { code, out, err };
  };
  const json = async (...argv: string[]) => {
    const result = await cli(...argv);
    expect(result.code, result.err).toBe(0);
    return JSON.parse(result.out);
  };
  return { root, clock, cli, json };
}

/** What the coach skill runs on first use (spec §11): the profile, then the default preset. */
async function startCoach(c: Copy): Promise<void> {
  expect((await c.cli("init", "--timezone", TZ, "--minutes", "45", "--lang", "py")).code).toBe(0);
  expect(await c.json("curriculum", "set", "grind-75", "--json")).toMatchObject({ status: "started", preset: "grind-75", phase: "bases" });
}

/** The user learns a base concept: the concept skill accepts the explanation, and every exercise has a green run. */
async function learn(c: Copy, slug: string): Promise<void> {
  expect((await c.cli("record", "explanation", slug)).code).toBe(0);
  const study = openStudy(c.root, { clock: c.clock });
  try {
    for (const id of loadCatalog(c.root).concepts.get(slug)?.exercises ?? []) {
      recordWork(study, id, { type: "run", lang: "py", green: true }, "cli");
    }
  } finally {
    study.close();
  }
}

describe("phase 0 with the shipped content (study coach spec §15)", () => {
  it("migrates a copy of this repo, then starts the coach at phase 0 with big-o", async () => {
    const c = copy();
    const dry = await c.cli("migrate", "--dry-run", "--timezone", TZ);
    expect(dry.code, dry.err).toBe(0);
    expect(dry.out).toContain("Dry run: nothing was changed.");
    const migrated = await c.cli("migrate", "--timezone", TZ);
    expect(migrated.code, migrated.err).toBe(0);
    expect((await c.cli("migrate", "--timezone", TZ)).out).toContain("Nothing to migrate.");
    expect(await c.json("today", "--json")).toMatchObject({ initialized: true, started: false });

    await startCoach(c);
    const plan = await c.json("today", "--json");
    expect(plan.phase).toMatchObject({ id: "bases", preset: "grind-75", progress: { done: 0, total: 5 }, list: null });
    expect(plan.announcements).toEqual([expect.objectContaining({ key: "coach-started", payload: { preset: "grind-75", phase: "bases" } })]);
    expect(plan.items).toEqual([{ kind: "concept", id: "big-o", title: "Big-O", minutes: 20, reason: "bases 1/5", done: false, missing: false }]);
  });

  it("plans the base concepts one a day, in the preset's order, each with three exercises", async () => {
    const c = copy();
    await startCoach(c);
    for (const [i, [slug, title]] of BASES.entries()) {
      const plan = await c.json("today", "--json");
      expect(plan.phase).toMatchObject({ id: "bases", progress: { done: i, total: BASES.length } });
      if (!WRITTEN.includes(slug)) {
        // The next note is not written yet: today plans it anyway, marked missing (Plan B, Task 9).
        expect(plan.items).toEqual([expect.objectContaining({ kind: "concept", id: slug, missing: true })]);
        return;
      }
      expect(plan.items).toEqual([{ kind: "concept", id: slug, title, minutes: 20, reason: `bases ${i + 1}/${BASES.length}`, done: false, missing: false }]);
      expect(loadCatalog(c.root).concepts.get(slug)?.exercises).toEqual([`${slug}/01`, `${slug}/02`, `${slug}/03`]);
      await learn(c, slug);
      c.clock.advance(DAY);
    }
  });
});

describe("phase 0 over the days (study coach spec §6.1, §6.4)", () => {
  it("welcomes the user back after nine idle days, still in phase 0, with the next base concept", async () => {
    const c = copy();
    await startCoach(c);
    const first = await c.json("today", "--json");
    expect((await c.cli("ack", String(first.announcements[0].id))).code).toBe(0);
    await learn(c, "big-o");
    c.clock.advance(9 * DAY);
    const plan = await c.json("today", "--json");
    expect(plan).toMatchObject({ mode: "return", phase: { id: "bases", progress: { done: 1, total: 5 } } });
    expect(plan.announcements).toEqual([expect.objectContaining({ key: "welcome-back", payload: expect.objectContaining({ daysAway: 9 }) })]);
    expect(plan.items).toEqual([expect.objectContaining({ kind: "concept", id: "recursion", missing: false })]);
  });
});

describe("the end of phase 0 (study coach spec §6.1)", () => {
  it("ends phase 0 after the fifth base concept and opens phase 1 with the hash-map concept", async () => {
    const c = copy();
    await startCoach(c);
    for (const [slug] of BASES) {
      await c.json("today", "--json");
      await learn(c, slug);
      c.clock.advance(DAY);
    }
    const plan = await c.json("today", "--json");
    expect(plan.phase).toMatchObject({ id: "learn", preset: "grind-75", list: { list: "grind-75" } });
    expect(plan.announcements).toContainEqual(expect.objectContaining({ key: "phase-advanced", payload: { from: "bases", to: "learn" } }));
    // hash-map opens arrays-hashing in curriculum/grind-75.yaml; the copy leaves the user's own notes out.
    expect(plan.items[0]).toMatchObject({ kind: "concept", id: "hash-map", reason: "opens arrays-hashing" });
  });
});
