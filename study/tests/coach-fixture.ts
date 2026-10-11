// A synthetic repo for the scheduler's tests: placeholder problems (no real statements, no solutions) tagged with
// made-up lists, synthetic concepts, and presets named after their lists.
import { expect } from "vitest";
import { CASES_JSON, conceptReadme, exerciseReadme, makeTempDir, put } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { replayAllCards, storedCards } from "../fsrs.ts";
import { acceptExplanation, giveUp, openAttempt, recordHint, recordWork } from "../record.ts";
import { announcements, curriculumLog, phaseLog, profile } from "../schema.ts";
import { inTransaction, openMemoryStudy, type Study } from "../store.ts";

/** Every scheduler test runs in this zone (UTC-5, no daylight saving time): local midnight is 05:00Z. */
export const TZ = "America/Bogota";
/** Monday 2026-10-05, 09:00 local. */
export const MONDAY = "2026-10-05T14:00:00.000Z";
export const DAY = 86_400_000;

interface FixtureProblem {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  patterns: string[];
  lists: string[];
}

/** Placeholder problems: "Sample 9101" and so on. Each pattern's problems, easy to hard, are listed in id order. */
export const PROBLEMS: FixtureProblem[] = [
  { id: "lc-9101", difficulty: "easy", patterns: ["arrays-hashing"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9102", difficulty: "medium", patterns: ["arrays-hashing"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9103", difficulty: "hard", patterns: ["arrays-hashing"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9104", difficulty: "easy", patterns: ["two-pointers"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9105", difficulty: "medium", patterns: ["two-pointers"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9106", difficulty: "easy", patterns: ["stack"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9107", difficulty: "medium", patterns: ["stack"], lists: ["demo-list", "wide-list"] },
  { id: "lc-9108", difficulty: "medium", patterns: ["greedy"], lists: ["demo-list"] },
  { id: "lc-9111", difficulty: "medium", patterns: ["arrays-hashing"], lists: ["wide-list"] },
  { id: "lc-9112", difficulty: "medium", patterns: ["two-pointers"], lists: ["wide-list"] },
  { id: "lc-9113", difficulty: "medium", patterns: ["stack"], lists: ["wide-list"] },
  { id: "lc-9114", difficulty: "medium", patterns: ["graphs"], lists: ["wide-list"] },
];

export const DEMO_LIST = PROBLEMS.filter((p) => p.lists.includes("demo-list")).map((p) => p.id);
export const WIDE_LIST = PROBLEMS.filter((p) => p.lists.includes("wide-list")).map((p) => p.id);

function preset(id: string, options: { size: number; expand: string[]; patterns: [string, string][] }): string {
  return [
    `id: ${id}`,
    "phases:",
    "  bases: { concepts: [basics-a, basics-b] }",
    `  learn: { list: ${id}, size: ${options.size}, block: 2, mix_after_block: 1 }`,
    `  master: { list: ${id}, first_try_success: 0.8 }`,
    `  expand: { choose_from: [${options.expand.join(", ")}], window: 3, unseen_medium_success: 0.65, medium_minutes: 35 }`,
    "  pro: { tracks: [interview] }",
    "patterns:",
    ...options.patterns.map(([pattern, concept]) => `  - { pattern: ${pattern}, concept: ${concept} }`),
    "timebox_minutes: { easy: 15, medium: 35, hard: 50 }",
    "",
  ].join("\n");
}

const PATTERNS: [string, string][] = [
  ["arrays-hashing", "map-intro"],
  ["two-pointers", "pointer-intro"],
  ["stack", "stack-intro"],
];

/** demo-list (8 problems, complete), wide-list (11 of 12 imported) and ghost-list (nothing imported). */
export const PRESETS: Record<string, string> = {
  "demo-list": preset("demo-list", { size: 8, expand: ["wide-list", "ghost-list"], patterns: PATTERNS }),
  "wide-list": preset("wide-list", { size: 12, expand: ["demo-list"], patterns: [...PATTERNS, ["graphs", "graph-intro"]] }),
  "ghost-list": preset("ghost-list", { size: 5, expand: ["demo-list"], patterns: PATTERNS }),
};

export function problemReadme(problem: FixtureProblem): string {
  const number = problem.id.slice(3).replace(/^0+/, "");
  return [
    "---",
    `id: ${problem.id}`,
    `title: Sample ${number}`,
    "source: leetcode",
    `url: https://leetcode.com/problems/sample-${number}/`,
    `difficulty: ${problem.difficulty}`,
    `patterns: [${problem.patterns.join(", ")}]`,
    "concepts: []",
    `lists: [${problem.lists.join(", ")}]`,
    "---",
    `# Sample ${number}`,
    "",
    "## Statement",
    "",
    "Placeholder.",
    "",
    "## Concepts",
    "",
    "<!-- auto:concepts -->",
    "<!-- /auto -->",
    "",
  ].join("\n");
}

/**
 * The repo: the problems above; concepts basics-a and basics-b (one exercise each), map-intro (one exercise) and
 * pointer-intro (no exercise). stack-intro and graph-intro have no note: the concept skill would create them.
 */
export function makeCoachRepo(): string {
  const root = makeTempDir("algo-coach-");
  for (const problem of PROBLEMS) {
    const folder = `problems/${problem.id}-sample`;
    put(root, `${folder}/README.md`, problemReadme(problem));
    put(root, `${folder}/cases.json`, CASES_JSON);
  }
  for (const [slug, exercise] of [["basics-a", true], ["basics-b", true], ["map-intro", true], ["pointer-intro", false]] as const) {
    put(root, `concepts/${slug}/README.md`, conceptReadme({ slug, title: `Concept ${slug}`, requires: [] }));
    if (exercise) {
      put(root, `concepts/${slug}/exercises/01-drill/README.md`, exerciseReadme({ id: `${slug}/01`, title: `Drill ${slug}`, concept: slug }));
      put(root, `concepts/${slug}/exercises/01-drill/cases.json`, CASES_JSON);
    }
  }
  for (const [id, text] of Object.entries(PRESETS)) put(root, `curriculum/${id}.yaml`, text);
  return root;
}

export interface Coach {
  root: string;
  study: Study;
  clock: FixedClock;
}

/** A fresh repo and an in-memory study at Monday 09:00 local, with a 45-minute profile in TZ. */
export function coach(options: { start?: string; minutes?: number } = {}): Coach {
  const root = makeCoachRepo();
  const clock = fixedClock(options.start ?? MONDAY);
  const study = openMemoryStudy({ clock, root });
  study.db.insert(profile).values({ id: 1, dailyMinutes: options.minutes ?? 45, language: "py", timezone: TZ, createdAt: clock.now() }).run();
  return { root, study, clock };
}

/**
 * Starts the coach on `preset` at phase 0, writing the rows `pnpm study curriculum set` writes for a first preset
 * (curriculum_log init, phase_log bases, a phase announcement). For tests that run before setCurriculum exists.
 */
export function begin(c: Coach, preset = "demo-list"): void {
  const at = c.clock.now();
  const curriculum = c.study.db.insert(curriculumLog).values({ at, preset, reason: "init" }).returning().get();
  const phase = c.study.db.insert(phaseLog).values({ at, phase: "bases", reason: "criteria", curriculumLogId: curriculum.id }).returning().get();
  c.study.db.insert(announcements).values({ at, kind: "phase", phaseLogId: phase.id }).run();
}

/**
 * Solves `itemId` from scratch, ending at the clock's time (problems are then rated as asked):
 * - good: one green run (unmeasured time, so at best Good);
 * - easy: an edit, a save and a green run one minute apart (measured, 2 minutes);
 * - hard: a hint, then a green run.
 * The item must have no closed attempt, or an open one (a review started with startAttempt).
 */
export function solve(c: Coach, itemId: string, rating: "good" | "easy" | "hard" = "good"): void {
  if (rating === "hard") recordHint(c.study, itemId);
  if (rating === "easy") {
    recordWork(c.study, itemId, { type: "edit", lang: "py", differsFromStub: true }, "watch");
    c.clock.advance(60_000);
    recordWork(c.study, itemId, { type: "save", lang: "py", differsFromStub: true }, "playground");
    c.clock.advance(60_000);
  }
  recordWork(c.study, itemId, { type: "run", lang: "py", green: true }, "cli");
}

/** Gives up (rating Again for a problem). */
export function fail(c: Coach, itemId: string): void {
  giveUp(c.study, itemId);
}

/** Accepts a concept's explanation and solves its exercises: the concept is learned (spec §6.1). */
export function learn(c: Coach, slug: string, exercises: string[] = [`${slug}/01`]): void {
  acceptExplanation(c.study, slug);
  for (const id of exercises) solve(c, id);
}

/** Opens a review attempt the way `study start` does (without the file work), then solves it. */
export function review(c: Coach, itemId: string, rating: "good" | "easy" | "hard" = "good", options: { examId?: number } = {}): void {
  inTransaction(c.study, (tx) => openAttempt(tx, itemId, c.clock.now(), options));
  if (rating === "hard") recordHint(c.study, itemId);
  recordWork(c.study, itemId, { type: "run", lang: "py", green: true }, "cli");
}

/** Spec §4: the cards cache must equal a replay from scratch after every scenario. */
export function expectCacheEqualsReplay(study: Study): void {
  expect(storedCards(study.db)).toEqual(replayAllCards(study.db));
}

/** The phase_log rows, oldest first, as [phase, reason]. */
export function phases(study: Study): [string, string][] {
  return study.db.select({ phase: phaseLog.phase, reason: phaseLog.reason }).from(phaseLog).orderBy(phaseLog.id).all().map((row) => [row.phase, row.reason]);
}
