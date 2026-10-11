import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { studySolutionDir, studySolutionPath } from "../../runner/src/paths.ts";
import { listTargets } from "../../runner/src/resolver.ts";
import { loadCaseFile } from "../../runner/src/schema.ts";
import { renderStub } from "../../runner/src/stubs.ts";
import type { Target } from "../../runner/src/types.ts";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import { ensurePlan } from "../plan.ts";
import { giveUp, openAttempt, recordWork } from "../record.ts";
import { attempts, attemptStats } from "../schema.ts";
import { startAttempt, startGate } from "../start.ts";
import { inTransaction, openStudy, type Study } from "../store.ts";
import { forcePhase, setCurriculum } from "../switch.ts";
import { DAY, makeCoachRepo, MONDAY, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

interface Repo {
  root: string;
  study: Study;
  clock: FixedClock;
  target(id: string): Target;
}

/** A repo on disk (start moves files): .study initialized in TZ, the coach started on demo-list. */
function repo(): Repo {
  const root = makeCoachRepo();
  const clock = fixedClock(MONDAY);
  initStudy(root, { clock, timezone: TZ });
  const study = openStudy(root, { clock });
  setCurriculum(study, root, "demo-list", clock.now());
  return { root, study, clock, target: (id) => listTargets(root).find((t) => t.id === id)! };
}

const OLD_WORK = "# my earlier work\n";

describe("the Start review gate (spec §7)", () => {
  it("shows for a problem whose card is due, never while an attempt is open", () => {
    const r = repo();
    recordWork(r.study, "lc-9101", { type: "run", lang: "py", green: true }, "cli");
    expect(startGate(r.study, r.root, "lc-9101", r.clock.now())).toBeNull(); // due in a few days
    r.clock.advance(30 * DAY);
    expect(startGate(r.study, r.root, "lc-9101", r.clock.now())).toEqual({ kind: "review", minutes: 9, examId: null });
    inTransaction(r.study, (tx) => openAttempt(tx, "lc-9101", r.clock.now()));
    expect(startGate(r.study, r.root, "lc-9101", r.clock.now())).toBeNull();
    expect(startGate(r.study, r.root, "lc-9102", r.clock.now())).toBeNull(); // never tried: a new item, no gate
    r.study.close();
  });

  it("shows for a given-up exercise, which is not done until it is solved again", () => {
    const r = repo();
    giveUp(r.study, "basics-a/01");
    expect(startGate(r.study, r.root, "basics-a/01", r.clock.now())).toEqual({ kind: "retry", minutes: 15, examId: null });
    r.study.close();
  });

  it("shows for the open exam's problems in phase 2", () => {
    const r = repo();
    forcePhase(r.study, "master", r.clock.now());
    const plan = ensurePlan(r.study, r.root, r.clock.now())!;
    const gate = startGate(r.study, r.root, plan.items[0].itemId, r.clock.now());
    expect(gate).toMatchObject({ kind: "exam", examId: 1 });
    r.study.close();
  });
});

describe("startAttempt (spec §7)", () => {
  it("archives the old solution to history/, writes a fresh stub, and opens a review attempt", () => {
    const r = repo();
    const target = r.target("lc-9101");
    put(r.root, path.relative(r.root, studySolutionPath(target, "py")), OLD_WORK);
    recordWork(r.study, "lc-9101", { type: "run", lang: "py", green: true }, "cli");
    r.clock.advance(30 * DAY);
    const result = startAttempt(r.study, r.root, target, r.clock.now());
    const history = path.join(studySolutionDir(target), "history", "2026-11-04T14-00-00-000Z.py");
    expect(result).toEqual({ started: true, attemptId: 2, kind: "review", examId: null, archived: [history], solutions: [studySolutionPath(target, "py")] });
    expect(readFileSync(history, "utf8")).toBe(OLD_WORK);
    expect(readFileSync(studySolutionPath(target, "py"), "utf8")).toBe(renderStub(loadCaseFile(target.dir), "py"));
    const open = r.study.db.select({ kind: attemptStats.kind }).from(attemptStats).all().at(-1);
    expect(open).toEqual({ kind: "review" });
    expect(startAttempt(r.study, r.root, target, r.clock.now())).toEqual({ started: false, reason: "open" });
    r.study.close();
  });

  it("moves a solution that still sits in the content folder, and writes the stub under .study", () => {
    const r = repo();
    const target = r.target("lc-9101");
    put(r.root, "problems/lc-9101-sample/solution.ts", "// legacy work\n");
    recordWork(r.study, "lc-9101", { type: "run", lang: "ts", green: true }, "cli");
    r.clock.advance(30 * DAY);
    const result = startAttempt(r.study, r.root, target, r.clock.now(), { lang: "py" });
    expect(result).toMatchObject({ started: true, solutions: [studySolutionPath(target, "py"), studySolutionPath(target, "ts")] });
    expect(existsSync(path.join(r.root, "problems/lc-9101-sample/solution.ts"))).toBe(false);
    expect(readdirSync(path.join(studySolutionDir(target), "history"))).toEqual(["2026-11-04T14-00-00-000Z.ts"]);
    r.study.close();
  });

  it("joins the open exam, and refuses an item that was never tried", () => {
    const r = repo();
    expect(startAttempt(r.study, r.root, r.target("lc-9102"), r.clock.now())).toEqual({ started: false, reason: "new" });
    forcePhase(r.study, "master", r.clock.now());
    const first = ensurePlan(r.study, r.root, r.clock.now())!.items[0].itemId;
    expect(startAttempt(r.study, r.root, r.target(first), r.clock.now())).toMatchObject({ started: true, kind: "exam", examId: 1 });
    expect(r.study.db.select({ examId: attempts.examId }).from(attempts).all()).toEqual([{ examId: 1 }]);
    r.study.close();
  });

  it("never overwrites a history file: the start fails and the solution stays where it was", () => {
    const r = repo();
    const target = r.target("lc-9101");
    put(r.root, path.relative(r.root, studySolutionPath(target, "py")), OLD_WORK);
    recordWork(r.study, "lc-9101", { type: "run", lang: "py", green: true }, "cli");
    r.clock.advance(30 * DAY);
    put(r.root, path.relative(r.root, path.join(studySolutionDir(target), "history", "2026-11-04T14-00-00-000Z.py")), "# older\n");
    expect(() => startAttempt(r.study, r.root, target, r.clock.now())).toThrow(/EEXIST/);
    expect(readFileSync(studySolutionPath(target, "py"), "utf8")).toBe(OLD_WORK);
    expect(r.study.db.select().from(attempts).all()).toHaveLength(1);
    r.study.close();
  });
});
