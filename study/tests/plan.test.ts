import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import { readState } from "../state-file.ts";
import { inTransaction, openStudy } from "../store.ts";
import { examResult, examsOf } from "../exam.ts";
import { pauseStudy, resumeStudy } from "../pause.ts";
import { ensurePlan } from "../plan.ts";
import { openAttempt, recordHint } from "../record.ts";
import { announcements, patternIntros, profile } from "../schema.ts";
import { forcePhase, setCurriculum } from "../switch.ts";
import { type Coach, coach, DAY, DEMO_LIST, expectCacheEqualsReplay, fail, learn, makeCoachRepo, MONDAY, phases, review, solve, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const plan = (c: Coach, refresh = false) => ensurePlan(c.study, c.root, c.clock.now(), { refresh });
const slots = (c: Coach, refresh = false) => plan(c, refresh)?.items.map((item) => [item.slot, item.itemId]) ?? null;

function started(options: { minutes?: number } = {}): Coach {
  const c = coach(options);
  setCurriculum(c.study, c.root, "demo-list", c.clock.now());
  return c;
}

/** Phase 1 with both base concepts learned and map-intro learned: the first block is open. */
function inLearn(options: { minutes?: number } = {}): Coach {
  const c = started(options);
  learn(c, "basics-a");
  learn(c, "basics-b");
  learn(c, "map-intro");
  return c;
}

describe("the daily plan (spec §6.2)", () => {
  it("does not exist before the coach starts, or while a pause is open", () => {
    const c = coach();
    expect(plan(c)).toBeNull();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    pauseStudy(c.study, c.clock.now());
    expect(plan(c)).toBeNull();
    resumeStudy(c.study, c.clock.now());
    expect(plan(c)).not.toBeNull();
  });

  it("serves phase 0's next base concept that is not learned", () => {
    const c = started();
    expect(slots(c)).toEqual([["concept", "basics-a"]]);
    c.clock.advance(DAY);
    learn(c, "basics-a");
    expect(slots(c)).toEqual([["concept", "basics-b"]]);
  });

  it("is stored for the local day: the same plan all day, a new one after local midnight, and --refresh rebuilds it", () => {
    const c = started();
    expect(slots(c)).toEqual([["concept", "basics-a"]]);
    learn(c, "basics-a");
    c.clock.advance(9 * 3_600_000); // 18:00 local: still Monday
    expect(slots(c)).toEqual([["concept", "basics-a"]]);
    expect(slots(c, true)).toEqual([["concept", "basics-b"]]);
    c.clock.set("2026-10-06T04:59:00.000Z"); // 23:59 local Monday
    expect(plan(c)!.date).toBe("2026-10-05");
    c.clock.set("2026-10-06T05:00:00.000Z"); // local midnight
    expect(plan(c)!.date).toBe("2026-10-06");
  });

  it("introduces the next pattern with its concept, then runs its block", () => {
    const c = started({ minutes: 60 });
    learn(c, "basics-a");
    learn(c, "basics-b");
    expect(slots(c)).toEqual([["concept", "map-intro"]]);
    expect(c.study.db.select({ pattern: patternIntros.pattern }).from(patternIntros).all()).toEqual([{ pattern: "arrays-hashing" }]);
    learn(c, "map-intro");
    expect(slots(c, true)).toEqual([
      ["new", "lc-9101"],
      ["new", "lc-9102"],
    ]);
  });

  it("puts open attempts first, then due reviews up to about 60% of the budget, then at least one new item", () => {
    const c = inLearn({ minutes: 20 });
    solve(c, "lc-9101");
    solve(c, "lc-9104");
    recordHint(c.study, "lc-9105"); // an open attempt
    c.clock.advance(30 * DAY);
    // Reviews may take 12 of the 20 minutes: lc-9101 (easy, 9 min) fits, lc-9104 would make it 18. The next
    // problem of the block (lc-9102, 35 min) is over the budget, but one new item is always planned.
    expect(slots(c)).toEqual([
      ["continue", "lc-9105"],
      ["review", "lc-9101"],
      ["new", "lc-9102"],
    ]);
  });

  it("plans one review even when it alone is over 60% of the budget", () => {
    const c = inLearn({ minutes: 10 });
    solve(c, "lc-9102");
    c.clock.advance(30 * DAY);
    expect(slots(c)!.slice(0, 1)).toEqual([["review", "lc-9102"]]);
  });

  it("serves the exam in phase 2, in its seeded order, at full time-box", () => {
    const c = started({ minutes: 30 });
    forcePhase(c.study, "master", c.clock.now());
    const first = plan(c)!.items;
    const exam = examsOf(c.study.db, "demo-list");
    expect(exam).toHaveLength(1);
    const order = examResult(c.study.db, exam[0], DEMO_LIST).order;
    expect(first.map((item) => [item.slot, item.itemId])).toEqual([["new", order[0]]]);
  });

  it("serves only reviews in phase 3 until the expansion list is chosen", () => {
    const c = started();
    solve(c, "lc-9101");
    forcePhase(c.study, "expand", c.clock.now());
    c.clock.advance(30 * DAY);
    expect(slots(c)).toEqual([["review", "lc-9101"]]);
    c.study.db.update(profile).set({ expansionList: "wide-list" }).run();
    expect(slots(c, true)!.map(([slot]) => slot)).toEqual(["review", "new"]);
  });
});

describe("state.json's today (spec §4)", () => {
  it("is null until the coach starts, then summarizes today's plan, the pause and the pending announcements", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const study = openStudy(root, { clock });
    expect(readState(study.dir!)?.today).toBeNull();
    setCurriculum(study, root, "demo-list", clock.now());
    expect(readState(study.dir!)?.today).toEqual({ date: "2026-10-05", planned: 0, done: 0, paused: false, announcements: 1 });
    ensurePlan(study, root, clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ planned: 1, done: 0 });
    pauseStudy(study, clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ paused: true });
    study.close();
  });
});

describe("one plan per day across processes (spec §12)", () => {
  it("gives a second handle on the same database the stored plan, never a second one", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const ui = openStudy(root, { clock });
    const cli = openStudy(root, { clock });
    setCurriculum(ui, root, "demo-list", clock.now());
    const first = ensurePlan(ui, root, clock.now())!;
    const second = ensurePlan(cli, root, clock.now())!;
    expect(second).toEqual(first);
    ui.close();
    cli.close();
  });
});

describe("returns, backlog and catch-up days (spec §6.4)", () => {
  it("welcomes the user back after 7 days away, once, and serves the most retrievable reviews first", () => {
    const c = inLearn({ minutes: 60 });
    solve(c, "lc-9101", "easy");
    solve(c, "lc-9102");
    c.clock.advance(25 * DAY);
    const today = plan(c)!;
    expect(today.mode).toBe("return");
    // Most overdue first would put lc-9102 (due after 5 days) first. lc-9101 (Easy: a longer interval) is more
    // likely remembered, so it comes first, for a quick win.
    expect(today.items.filter((item) => item.slot === "review").map((item) => item.itemId)).toEqual(["lc-9101", "lc-9102"]);
    plan(c, true);
    expect(c.study.db.select({ kind: announcements.kind, localDate: announcements.localDate }).from(announcements).all().filter((a) => a.kind === "return")).toEqual([
      { kind: "return", localDate: "2026-10-30" },
    ]);
  });

  it("does not call a paused week an absence", () => {
    const c = inLearn();
    solve(c, "lc-9101");
    pauseStudy(c.study, c.clock.now());
    c.clock.advance(10 * DAY);
    resumeStudy(c.study, c.clock.now());
    expect(plan(c)!.mode).toBe("normal");
    expectCacheEqualsReplay(c.study);
  });

  it("has catch-up days when more than 3 days of reviews are overdue: a new item only every other day", () => {
    const c = inLearn({ minutes: 15 });
    for (const id of ["lc-9101", "lc-9104", "lc-9106", "lc-9102", "lc-9105"]) solve(c, id);
    c.clock.advance(40 * DAY);
    review(c, "lc-9101"); // some activity: not a return
    // Reviews may take 9 of the 15 minutes: one easy review a day. Four cards are overdue: more than 3 days.
    const monday = plan(c)!;
    expect(monday.mode).toBe("catch_up");
    expect(monday.items.map((item) => item.slot)).toEqual(["review", "new"]);
    c.clock.advance(DAY);
    expect(plan(c)!.items.map((item) => item.slot)).toEqual(["review"]);
    c.clock.advance(DAY);
    expect(plan(c)!.items.map((item) => item.slot)).toEqual(["review", "new"]);
  });

  it("never lowers the phase after a long absence: the plan only welcomes the user back", () => {
    const c = inLearn();
    for (const id of DEMO_LIST) solve(c, id);
    // A retry of a base exercise given up: phase 0's criteria no longer hold, yet the phase stays.
    inTransaction(c.study, (tx) => openAttempt(tx, "basics-a/01", c.clock.now()));
    fail(c, "basics-a/01");
    c.clock.advance(90 * DAY);
    expect(plan(c)!.mode).toBe("return");
    expect(phases(c.study)).toEqual([
      ["bases", "criteria"],
      ["learn", "criteria"],
    ]);
  });
});
