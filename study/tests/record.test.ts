import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { TSX_LOADER } from "../../runner/src/paths.ts";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import {
  AttemptAlreadyOpenError,
  acceptExplanation,
  closeAttempt,
  giveUp,
  openAttempt,
  recordComplexity,
  recordHint,
  recordWork,
  type WorkResult,
} from "../record.ts";
import { attemptEvents, attempts, complexityNotes, exams, itemStatusView } from "../schema.ts";
import { inTransaction, openMemoryStudy, openStudy, type Study } from "../store.ts";

const T0 = "2026-10-04T10:00:00.000Z";
const WORKER = fileURLToPath(new URL("./fixtures/race-worker.ts", import.meta.url));

function setup() {
  const clock = fixedClock(T0);
  return { clock, study: openMemoryStudy({ clock }) };
}
const attemptRows = (study: Study) => study.db.select().from(attempts).all();
const eventRows = (study: Study) =>
  study.db
    .select({ type: attemptEvents.type, lang: attemptEvents.lang, runGreen: attemptEvents.runGreen, source: attemptEvents.source })
    .from(attemptEvents)
    .orderBy(attemptEvents.id)
    .all();
const statusOf = (study: Study, itemId: string) =>
  study.db.select().from(itemStatusView).where(eq(itemStatusView.itemId, itemId)).get()?.status ?? "todo";

describe("recordWork: the attempt lifecycle (spec §7)", () => {
  it("opens nothing for a save that only repeats the stub, and opens the first attempt on real work", () => {
    const { study } = setup();
    expect(recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: false }, "playground")).toEqual({ recorded: false, reason: "stub" });
    expect(attemptRows(study)).toEqual([]);
    expect(recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: true }, "playground")).toEqual({
      recorded: true,
      attemptId: 1,
      opened: true,
      closed: false,
    });
    expect(attemptRows(study)).toEqual([
      { id: 1, itemId: "lc-0001", examId: null, startedAt: new Date(T0), endedAt: null, outcome: null, rating: null },
    ]);
    expect(eventRows(study)).toEqual([{ type: "save", lang: "py", runGreen: null, source: "playground" }]);
  });

  it("opens an attempt on any run, appends every later event to it, and closes it at the first green run with no rating", () => {
    const { study, clock } = setup();
    expect(recordWork(study, "lc-0001", { type: "run", lang: "py", green: false }, "cli")).toMatchObject({ opened: true, closed: false });
    clock.advance(60_000);
    recordWork(study, "lc-0001", { type: "edit", lang: "py", differsFromStub: false }, "watch"); // joins the open attempt
    clock.advance(60_000);
    expect(recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "watch")).toEqual({
      recorded: true,
      attemptId: 1,
      opened: false,
      closed: true,
    });
    expect(attemptRows(study)).toMatchObject([{ endedAt: new Date(Date.parse(T0) + 120_000), outcome: "green", rating: null }]);
    expect(eventRows(study).map((event) => event.type)).toEqual(["run", "edit", "run"]);
    expect(statusOf(study, "lc-0001")).toBe("solved");
  });

  it("treats work after the close as polishing: nothing is recorded, not even in the other language", () => {
    const { study } = setup();
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    expect(recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: true }, "playground")).toEqual({ recorded: false, reason: "closed" });
    expect(recordWork(study, "lc-0001", { type: "run", lang: "ts", green: true }, "cli")).toEqual({ recorded: false, reason: "closed" });
    expect(attemptRows(study)).toHaveLength(1);
    expect(eventRows(study)).toHaveLength(1);
  });

  it("keeps items apart", () => {
    const { study } = setup();
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    recordWork(study, "hash-map/01", { type: "save", lang: "ts", differsFromStub: true }, "playground");
    expect(statusOf(study, "lc-0001")).toBe("solved");
    expect(statusOf(study, "hash-map/01")).toBe("in_progress");
  });
});

describe("hints, give-ups, complexity and explanations", () => {
  it("counts hints on the open attempt, opening one when the item has none, and refuses after the close", () => {
    const { study } = setup();
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: true, attemptId: 1, hints: 1 });
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: true, attemptId: 1, hints: 2 });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: false, reason: "closed" });
  });

  it("refuses a hint during an exam attempt without counting it", () => {
    const { study, clock } = setup();
    inTransaction(study, (tx) => {
      const exam = tx.insert(exams).values({ list: "grind-75", seed: 1, startedAt: clock.now() }).returning().get();
      openAttempt(tx, "lc-0001", clock.now(), { examId: exam.id });
    });
    expect(recordHint(study, "lc-0001")).toEqual({ recorded: false, reason: "exam" });
    expect(eventRows(study)).toEqual([]);
  });

  it("closes the open attempt as given up, or opens and closes one at once, and never gives up a closed item", () => {
    const { study } = setup();
    recordWork(study, "lc-0001", { type: "save", lang: "py", differsFromStub: true }, "playground");
    expect(giveUp(study, "lc-0001")).toEqual({ recorded: true, attemptId: 1 });
    expect(statusOf(study, "lc-0001")).toBe("revealed");
    expect(giveUp(study, "lc-0001")).toEqual({ recorded: false, reason: "closed" });
    expect(giveUp(study, "lc-0020")).toEqual({ recorded: true, attemptId: 2 });
    expect(attemptRows(study)[1]).toMatchObject({ itemId: "lc-0020", startedAt: new Date(T0), endedAt: new Date(T0), outcome: "gave_up" });
  });

  it("attaches complexity to the latest green attempt, replacing an earlier note, and refuses an item never green", () => {
    const { study } = setup();
    expect(recordComplexity(study, "lc-0001", { time: "O(n)", space: "O(1)", optimal: false })).toEqual({ recorded: false, reason: "not-green" });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    expect(recordComplexity(study, "lc-0001", { time: "O(n)", space: "O(1)", optimal: false })).toEqual({ recorded: true, attemptId: 1 });
    recordComplexity(study, "lc-0001", { time: "O(n)", space: "O(n)", optimal: true });
    expect(study.db.select().from(complexityNotes).all()).toEqual([{ attemptId: 1, time: "O(n)", space: "O(n)", optimal: true }]);
  });

  it("accepts an explanation once and keeps the first date", () => {
    const { study, clock } = setup();
    expect(acceptExplanation(study, "hash-map")).toEqual({ acceptedAt: new Date(T0), already: false });
    clock.advance(86_400_000);
    expect(acceptExplanation(study, "hash-map")).toEqual({ acceptedAt: new Date(T0), already: true });
  });
});

describe("openAttempt and closeAttempt", () => {
  it("refuses a second open attempt, and closing twice changes nothing", () => {
    const { study, clock } = setup();
    const id = inTransaction(study, (tx) => openAttempt(tx, "lc-0001", clock.now()));
    expect(() => inTransaction(study, (tx) => openAttempt(tx, "lc-0001", clock.now()))).toThrow(AttemptAlreadyOpenError);
    expect(inTransaction(study, (tx) => closeAttempt(tx, id, "green", clock.now(), study))).toMatchObject({ id, outcome: "green" });
    expect(inTransaction(study, (tx) => closeAttempt(tx, id, "gave_up", clock.now(), study))).toBeNull();
    expect(attemptRows(study)[0].outcome).toBe("green");
  });
});

describe("state.json after recording", () => {
  afterEach(cleanupTempDirs);

  it("is refreshed after a write that changes what it shows", () => {
    const root = makeTempDir("algo-record-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const study = openStudy(root, { clock: fixedClock(T0) });
    recordHint(study, "lc-0001");
    study.close();
    const state = JSON.parse(readFileSync(path.join(root, ".study", "state.json"), "utf8"));
    expect(state.inProgress).toEqual([{ id: "lc-0001", kind: "new", hints: 1, startedAt: T0 }]);
  });
});

describe("concurrency (spec §12)", () => {
  afterEach(cleanupTempDirs);

  it("six processes recording the first run of one item at once leave one attempt holding six runs", async () => {
    const root = makeTempDir("algo-race-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const go = Date.now() + 2500;
    const outputs = await Promise.all(
      Array.from(
        { length: 6 },
        () =>
          new Promise<string>((resolve, reject) => {
            const child = spawn(process.execPath, ["--import", TSX_LOADER, WORKER, root, String(go)], { stdio: ["ignore", "pipe", "inherit"] });
            let out = "";
            child.stdout.on("data", (chunk) => {
              out += String(chunk);
            });
            child.on("error", reject);
            child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`race worker exited with ${code}`))));
          }),
      ),
    );
    const results = outputs.map((out) => JSON.parse(out) as WorkResult);
    expect(results.filter((result) => result.recorded && result.opened)).toHaveLength(1);
    const study = openStudy(root);
    expect(study.db.select().from(attempts).all()).toHaveLength(1);
    expect(study.db.select().from(attemptEvents).all()).toHaveLength(6);
    study.close();
  });
});
