import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, makeStudyRepo } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { initStudy } from "../init.ts";
import { acceptExplanation, openAttempt, recordHint, recordWork } from "../record.ts";
import { cards, exams } from "../schema.ts";
import { inTransaction, openStudy, type Study } from "../store.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";

async function cli(root: string, ...argv: string[]) {
  let out = "";
  let err = "";
  const io: CliIo = { root, clock: fixedClock(T0), out: (text) => (out += text), err: (text) => (err += text) };
  const code = await runStudyCli(argv, io);
  return { code, out, err, json: () => JSON.parse(out) };
}

/** makeStudyRepo has problems lc-0001 and lc-0020, concepts arrays and hash-map, and exercise hash-map/01. */
function initialized(): { root: string; with: (fn: (study: Study) => void) => void } {
  const root = makeStudyRepo();
  initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
  return {
    root,
    with: (fn) => {
      const study = openStudy(root, { clock: fixedClock(T0) });
      try {
        fn(study);
      } finally {
        study.close();
      }
    },
  };
}

describe("pnpm study status <item> --json", () => {
  it("is empty before any work, then shows the open attempt with its hints", async () => {
    const repo = initialized();
    expect((await cli(repo.root, "status", "lc-0001", "--json")).json()).toEqual({
      initialized: true,
      id: "lc-0001",
      kind: "problem",
      status: "todo",
      everGreen: false,
      revealed: false,
      open: null,
      exam: false,
      concept: null,
      conceptLearned: null,
      nextDue: null,
    });
    repo.with((study) => recordHint(study, "lc-0001"));
    expect((await cli(repo.root, "status", "1", "--json")).json()).toMatchObject({
      id: "lc-0001",
      status: "in_progress",
      open: { kind: "new", hints: 1, startedAt: T0 },
    });
  });

  it("gives an exercise its concept and whether that concept is learned", async () => {
    const repo = initialized();
    expect((await cli(repo.root, "status", "hash-map/01", "--json")).json()).toMatchObject({ kind: "exercise", concept: "hash-map", conceptLearned: false });
    repo.with((study) => {
      acceptExplanation(study, "hash-map");
      recordWork(study, "hash-map/01", { type: "run", lang: "py", green: true }, "cli");
    });
    expect((await cli(repo.root, "status", "hash-map/01", "--json")).json()).toMatchObject({ status: "solved", everGreen: true, conceptLearned: true });
  });

  it("reports the next due date from the item's card", async () => {
    const repo = initialized();
    repo.with((study) =>
      study.db.insert(cards).values({ itemId: "lc-0020", due: new Date("2026-10-11T10:00:00.000Z"), stability: 3, difficulty: 5, scheduledDays: 7, learningSteps: 0, reps: 1, lapses: 0, state: 2 }).run(),
    );
    expect((await cli(repo.root, "status", "lc-0020", "--json")).json()).toMatchObject({ nextDue: "2026-10-11T10:00:00.000Z" });
  });

  it("marks an exam attempt, and record hint refuses it with exit 2 without counting", async () => {
    const repo = initialized();
    repo.with((study) =>
      inTransaction(study, (tx) => {
        const exam = tx.insert(exams).values({ list: "grind-75", seed: 1, startedAt: new Date(T0) }).returning().get();
        openAttempt(tx, "lc-0001", new Date(T0), { examId: exam.id });
      }),
    );
    expect((await cli(repo.root, "status", "lc-0001", "--json")).json()).toMatchObject({ exam: true, open: { kind: "exam", hints: 0 } });
    expect(await cli(repo.root, "record", "hint", "lc-0001")).toMatchObject({ code: 2, err: expect.stringContaining("exams take no hints") });
    expect((await cli(repo.root, "status", "lc-0001", "--json")).json()).toMatchObject({ open: { hints: 0 } });
  });
});

describe("pnpm study status <concept> --json and the summary", () => {
  it("lists a concept's exercises, whether its explanation is accepted, and whether it is learned", async () => {
    const repo = initialized();
    repo.with((study) => acceptExplanation(study, "hash-map"));
    expect((await cli(repo.root, "status", "hash-map", "--json")).json()).toEqual({
      initialized: true,
      id: "hash-map",
      kind: "concept",
      accepted: true,
      acceptedAt: T0,
      learned: false,
      exercises: [{ id: "hash-map/01", status: "todo", done: false }],
    });
  });

  it("summarizes what is in progress, solved and revealed, and lists orphans", async () => {
    const repo = initialized();
    repo.with((study) => {
      recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
      recordHint(study, "lc-0020");
      recordWork(study, "lc-9999", { type: "run", lang: "py", green: false }, "cli");
    });
    expect((await cli(repo.root, "status", "--json")).json()).toEqual({
      initialized: true,
      inProgress: [
        { id: "lc-0020", kind: "new", hints: 1, startedAt: T0 },
        { id: "lc-9999", kind: "new", hints: 0, startedAt: T0 },
      ],
      solved: ["lc-0001"],
      revealed: [],
      orphans: ["lc-9999"],
    });
    expect((await cli(repo.root, "status")).out).toBe("In progress: lc-0020 (new, 1 hint), lc-9999 (new, 0 hints). Orphans: lc-9999.\n");
  });
});

describe("before the study database exists", () => {
  it("status says initialized: false, and record says nothing was recorded, with exit 0", async () => {
    const root = makeStudyRepo();
    expect((await cli(root, "status", "lc-0001", "--json")).json()).toMatchObject({ initialized: false, status: "todo", everGreen: false, revealed: false });
    expect((await cli(root, "status", "--json")).json()).toEqual({ initialized: false, inProgress: [], solved: [], revealed: [], orphans: [] });
    expect(await cli(root, "record", "hint", "lc-0001")).toMatchObject({ code: 0, err: expect.stringContaining("Not recorded: there is no study database yet") });
  });

  it("gives an exercise's uninitialized status the exercise shape, with concept set and conceptLearned false", async () => {
    const root = makeStudyRepo();
    expect((await cli(root, "status", "hash-map/01", "--json")).json()).toEqual({
      initialized: false,
      id: "hash-map/01",
      kind: "exercise",
      status: "todo",
      everGreen: false,
      revealed: false,
      open: null,
      exam: false,
      concept: "hash-map",
      conceptLearned: false,
      nextDue: null,
    });
  });

  it("gives a concept's uninitialized status every exercise todo, not accepted, not learned", async () => {
    const root = makeStudyRepo();
    expect((await cli(root, "status", "hash-map", "--json")).json()).toEqual({
      initialized: false,
      id: "hash-map",
      kind: "concept",
      accepted: false,
      acceptedAt: null,
      learned: false,
      exercises: [{ id: "hash-map/01", status: "todo", done: false }],
    });
  });
});

describe("pnpm study record", () => {
  it("records a hint, a give-up, a complexity and an explanation, and explains what it refused", async () => {
    const repo = initialized();
    expect(await cli(repo.root, "record", "hint", "lc-0001")).toMatchObject({ code: 0, out: "Recorded hint 1 for lc-0001.\n" });
    expect(await cli(repo.root, "record", "give-up", "lc-0001")).toMatchObject({ code: 0, out: "Recorded: lc-0001 given up (revealed).\n" });
    expect(await cli(repo.root, "record", "give-up", "lc-0001")).toMatchObject({ code: 0, out: "Not recorded: lc-0001 has no open attempt (it is solved or revealed).\n" });
    expect(await cli(repo.root, "record", "complexity", "lc-0020", "--time", "O(n)", "--space", "O(1)", "--optimal")).toMatchObject({
      code: 1,
      err: expect.stringContaining("Not recorded: lc-0020 has no green attempt"),
    });
    repo.with((study) => recordWork(study, "lc-0020", { type: "run", lang: "py", green: true }, "cli"));
    expect(await cli(repo.root, "record", "complexity", "lc-0020", "--time", "O(n)", "--space", "O(1)", "--not-optimal")).toMatchObject({
      code: 0,
      out: "Recorded complexity for lc-0020: time O(n), space O(1), not optimal.\n",
    });
    expect(await cli(repo.root, "record", "explanation", "hash-map")).toMatchObject({ code: 0, out: "Recorded: the hash-map explanation is accepted.\n" });
    expect(await cli(repo.root, "record", "explanation", "hash-map")).toMatchObject({ code: 0, out: "Already accepted on 2026-10-04: hash-map.\n" });
  });

  it("rejects unknown ids, fuzzy ids, complexity on an exercise, and a missing optimal flag", async () => {
    const repo = initialized();
    expect(await cli(repo.root, "record", "hint", "two-sum")).toMatchObject({ code: 1, err: expect.stringContaining('There is no problem or exercise with id "two-sum"') });
    expect(await cli(repo.root, "record", "explanation", "nope")).toMatchObject({ code: 1, err: expect.stringContaining('There is no concept "nope"') });
    expect(await cli(repo.root, "record", "complexity", "hash-map/01", "--time", "O(n)", "--space", "O(1)", "--optimal")).toMatchObject({
      code: 1,
      err: expect.stringContaining("problems only"),
    });
    expect(await cli(repo.root, "record", "complexity", "lc-0001", "--time", "O(n)", "--space", "O(1)")).toMatchObject({
      code: 1,
      err: expect.stringContaining("exactly one of --optimal and --not-optimal"),
    });
  });
});
