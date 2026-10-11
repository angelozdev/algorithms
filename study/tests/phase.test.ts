import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { PresetError } from "../curriculum.ts";
import { createExam, examResult } from "../exam.ts";
import { openAttempt } from "../record.ts";
import { syncPhase } from "../phase.ts";
import { announcements, attempts, profile } from "../schema.ts";
import { inTransaction } from "../store.ts";
import { begin, type Coach, coach, DAY, DEMO_LIST, expectCacheEqualsReplay, fail, learn, phases, review, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

/** Phase 0 done: both base concepts learned. */
function bases(c: Coach): void {
  learn(c, "basics-a");
  learn(c, "basics-b");
}

/** Phase 1 done: every demo-list problem solved, then reviewed successfully twice. */
function learnList(c: Coach): void {
  for (const id of DEMO_LIST) solve(c, id);
  for (const round of [1, 2]) {
    c.clock.advance(10 * DAY * round);
    for (const id of DEMO_LIST) review(c, id);
  }
}

/** Runs the demo-list exam: `failed` problems are given up (exams take no hints), the rest are Good. */
function exam(c: Coach, failed: string[] = []): number {
  const row = createExam(c.study.db, "demo-list", c.clock.now(), "2026-11-20");
  for (const id of examResult(c.study.db, row, DEMO_LIST).order) {
    c.clock.advance(60_000);
    if (failed.includes(id)) {
      inTransaction(c.study, (tx) => openAttempt(tx, id, c.clock.now(), { examId: row.id }));
      fail(c, id);
    } else review(c, id, "good", { examId: row.id });
  }
  return row.id;
}

describe("phases (spec §6.1)", () => {
  it("do nothing before the coach starts", () => {
    const c = coach();
    bases(c);
    expect(syncPhase(c.study, c.root, c.clock.now())).toEqual([]);
    expect(phases(c.study)).toEqual([]);
  });

  it("start at phase 0 and leave it once every base concept is learned: explanation accepted and every exercise green", () => {
    const c = coach();
    begin(c);
    expect(phases(c.study)).toEqual([["bases", "criteria"]]);
    learn(c, "basics-a");
    solve(c, "basics-b/01");
    expect(phases(c.study)).toEqual([["bases", "criteria"]]);
    learn(c, "basics-b", []); // the acceptance is the last step: the phase moves right away
    expect(phases(c.study)).toEqual([
      ["bases", "criteria"],
      ["learn", "criteria"],
    ]);
  });

  it("count an exercise solved after a give-up as done, and a give-up alone as not done", () => {
    const c = coach();
    begin(c);
    learn(c, "basics-a");
    fail(c, "basics-b/01");
    learn(c, "basics-b", []);
    expect(phases(c.study).at(-1)).toEqual(["bases", "criteria"]);
    review(c, "basics-b/01");
    expect(phases(c.study).at(-1)).toEqual(["learn", "criteria"]);
  });

  it("leave phase 1 when every list problem was solved and then reviewed successfully twice", () => {
    const c = coach();
    begin(c);
    bases(c);
    for (const id of DEMO_LIST) solve(c, id);
    c.clock.advance(10 * DAY);
    for (const id of DEMO_LIST) review(c, id);
    c.clock.advance(20 * DAY);
    for (const id of DEMO_LIST.slice(1)) review(c, id);
    review(c, DEMO_LIST[0], "hard"); // Hard is not a successful review
    expect(phases(c.study).at(-1)).toEqual(["learn", "criteria"]);
    review(c, DEMO_LIST[0], "easy");
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
    expectCacheEqualsReplay(c.study);
  });

  it("leave phase 2 after an exam with at least 80% first-try success, once every failure was solved again later", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    c.clock.advance(5 * DAY);
    exam(c, [DEMO_LIST[0], DEMO_LIST[1]]); // 6/8 = 75%
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
    c.clock.advance(DAY);
    exam(c, [DEMO_LIST[2]]); // 7/8 = 87.5%, one failure
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
    c.clock.advance(3 * DAY);
    review(c, DEMO_LIST[2]);
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    expectCacheEqualsReplay(c.study);
  });

  it("leave phase 3 when the last unseen Mediums of the expansion list were solved alone in time, at the preset's rate", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    exam(c);
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    c.study.db.update(profile).set({ expansionList: "wide-list" }).where(eq(profile.id, 1)).run();
    solve(c, "lc-9111");
    fail(c, "lc-9112");
    solve(c, "lc-9113", "hard"); // a hint: not alone
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    solve(c, "lc-9114"); // window of 3: 9112 ✗, 9113 ✗, 9114 ✓ → 1/3
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
  });

  it("reach phase 4 with 2 of the last 3 unseen Mediums solved alone (65%)", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    exam(c);
    c.study.db.update(profile).set({ expansionList: "wide-list" }).where(eq(profile.id, 1)).run();
    fail(c, "lc-9111");
    solve(c, "lc-9112");
    expect(phases(c.study).at(-1)).toEqual(["expand", "criteria"]);
    solve(c, "lc-9113");
    expect(phases(c.study).at(-1)).toEqual(["pro", "criteria"]);
  });

  it("never move back: a failed review in phase 2 keeps phase 2, and a long absence changes nothing", () => {
    const c = coach();
    begin(c);
    bases(c);
    learnList(c);
    c.clock.advance(60 * DAY);
    fail(c, DEMO_LIST[0]);
    expect(syncPhase(c.study, c.root, c.clock.now())).toEqual([]);
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);
  });

  it("announce every change once, each referencing its phase_log row", () => {
    const c = coach();
    begin(c);
    bases(c);
    const rows = c.study.db.select({ kind: announcements.kind, phaseLogId: announcements.phaseLogId }).from(announcements).orderBy(announcements.id).all();
    expect(rows).toEqual([
      { kind: "phase", phaseLogId: 1 },
      { kind: "phase", phaseLogId: 2 },
    ]);
  });

  it("never let a broken preset break a recorded run: the attempt closes, rated with the default time-boxes", () => {
    const c = coach();
    begin(c);
    put(c.root, "curriculum/demo-list.yaml", "id: demo-list\nphases: {}\n");
    expect(() => solve(c, "lc-9101", "easy")).not.toThrow();
    expect(c.study.db.select({ outcome: attempts.outcome, rating: attempts.rating }).from(attempts).all()).toEqual([{ outcome: "green", rating: "easy" }]);
    expect(() => syncPhase(c.study, c.root, c.clock.now())).toThrow(PresetError);
  });
});
