import { rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { initStudy } from "../init.ts";
import { pauseStudy } from "../pause.ts";
import { openAttempt } from "../record.ts";
import { patternIntros } from "../schema.ts";
import { readState } from "../state-file.ts";
import { inTransaction, openStudy } from "../store.ts";
import { forcePhase, setCurriculum } from "../switch.ts";
import { ackAnnouncement, curriculumStatus, describeToday, notInitialized, today } from "../today.ts";
import { type Coach, coach, DAY, DEMO_LIST, learn, makeCoachRepo, MONDAY, solve, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const ui = (c: Coach, refresh = false) => today(c.study, c.root, { surface: "ui", now: c.clock.now(), refresh });
const chat = (c: Coach) => today(c.study, c.root, { surface: "chat", now: c.clock.now() });
const start = (c: Coach, preset = "demo-list") => setCurriculum(c.study, c.root, preset, c.clock.now());

describe("today (spec §11)", () => {
  it("says the coach has not started until a preset is set", () => {
    const c = coach();
    expect(ui(c)).toEqual({
      initialized: true,
      started: false,
      date: "2026-10-05",
      paused: null,
      phase: null,
      announcements: [],
      mode: "normal",
      items: [],
      backlog: { waiting: 0, days: 0 },
      budget: { minutes: 45, planned: 0 },
    });
  });

  it("renders the plan with titles, minutes and reasons from content, and the phase with its progress", () => {
    const c = coach();
    start(c);
    expect(ui(c)).toMatchObject({
      started: true,
      phase: { id: "bases", since: MONDAY, preset: "demo-list", progress: { done: 0, total: 2 }, list: null, expansion: null },
      items: [{ kind: "concept", id: "basics-a", title: "Concept basics-a", minutes: 20, reason: "bases 1/2", done: false, missing: false }],
      budget: { minutes: 45, planned: 20 },
    });
  });

  it("marks planned items done, and tells a block item, a mix item and a missing concept apart", () => {
    const c = coach({ minutes: 120 });
    start(c);
    learn(c, "basics-a");
    learn(c, "basics-b");
    learn(c, "map-intro");
    c.study.db.insert(patternIntros).values({ pattern: "arrays-hashing", introducedAt: c.clock.now() }).run();
    c.clock.advance(60_000);
    solve(c, "lc-9101");
    solve(c, "lc-9102");
    c.study.db.insert(patternIntros).values({ pattern: "two-pointers", introducedAt: c.clock.now() }).run();
    c.clock.advance(60_000);
    const plan = ui(c).items;
    expect(plan.map((item) => [item.kind, item.id, item.reason])).toEqual([
      ["concept", "pointer-intro", "opens two-pointers"],
    ]);
    learn(c, "pointer-intro", []);
    const block = ui(c, true).items;
    expect(block.map((item) => [item.kind, item.id, item.minutes, item.reason])).toEqual([
      ["new", "lc-9104", 15, "block 1/2 · two-pointers"],
      ["new", "lc-9105", 35, "block 2/2 · two-pointers"],
      ["new", "lc-9103", 50, "mix · arrays-hashing"],
      ["concept", "stack-intro", 20, "opens stack"],
    ]);
    expect(block.at(-1)).toMatchObject({ title: "stack-intro", missing: true });
    solve(c, "lc-9104");
    expect(ui(c).items.map((item) => item.done)).toEqual([true, false, false, false]);
  });

  it("reports how much of the phase's list is imported", () => {
    const c = coach();
    start(c, "wide-list");
    c.study.db.insert(patternIntros).values({ pattern: "arrays-hashing", introducedAt: c.clock.now() }).run();
    expect(ui(c).phase).toMatchObject({ id: "bases", list: null });
    learn(c, "basics-a");
    learn(c, "basics-b");
    expect(ui(c).phase).toMatchObject({ id: "learn", progress: { done: 0, total: 11 }, list: { list: "wide-list", imported: 11, size: 12 } });
  });

  it("counts the due reviews it leaves for later", () => {
    const c = coach({ minutes: 15 });
    start(c);
    for (const id of ["lc-9101", "lc-9104", "lc-9106"]) solve(c, id);
    c.clock.advance(30 * DAY);
    expect(ui(c)).toMatchObject({ backlog: { waiting: 2, days: 2 } });
  });

  it("shows nothing to do while paused", () => {
    const c = coach();
    start(c);
    pauseStudy(c.study, c.clock.now());
    expect(ui(c)).toMatchObject({ paused: { since: MONDAY }, items: [] });
    expect(describeToday(ui(c))).toContain("Paused since 2026-10-05");
  });

  it("renders a phase-2 exam's items as kind exam, in the exam's order (I1)", () => {
    const c = coach({ minutes: 400 });
    start(c);
    for (const id of DEMO_LIST) solve(c, id);
    c.clock.advance(30 * DAY);
    forcePhase(c.study, "master", c.clock.now());
    const items = ui(c).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.kind === "exam")).toBe(true);
    expect(items.map((item) => item.reason)).toEqual(items.map((_, i) => `exam ${i + 1}/${items.length}`));
  });

  it("renders a continued review with its pattern and the problem's time-box (M11)", () => {
    const c = coach({ minutes: 60 });
    start(c);
    learn(c, "basics-a");
    learn(c, "basics-b");
    learn(c, "map-intro");
    solve(c, "lc-9104"); // two-pointers, easy
    c.clock.advance(30 * DAY);
    inTransaction(c.study, (tx) => openAttempt(tx, "lc-9104", c.clock.now()));
    const item = ui(c).items.find((item) => item.id === "lc-9104")!;
    expect(item).toMatchObject({ kind: "continue", reason: "in progress · two-pointers", minutes: 15 });
  });
});

describe("today with content that changed", () => {
  it("renders a planned item whose content is gone with its id and missing: true", () => {
    const c = coach({ minutes: 60 });
    start(c);
    learn(c, "basics-a");
    learn(c, "basics-b");
    learn(c, "map-intro");
    const first = ui(c).items[0];
    expect(first).toMatchObject({ kind: "new", id: "lc-9101", missing: false });
    rmSync(path.join(c.root, "problems/lc-9101-sample"), { recursive: true });
    expect(ui(c).items[0]).toMatchObject({ kind: "new", id: "lc-9101", title: "lc-9101", missing: true });
  });

  it("leaves state.json alone when nothing changed, so the playground's refetch on progress cannot loop", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const study = openStudy(root, { clock });
    setCurriculum(study, root, "demo-list", clock.now());
    today(study, root, { surface: "ui", now: clock.now() });
    const version = readState(study.dir!)!.version;
    today(study, root, { surface: "ui", now: clock.now() });
    expect(readState(study.dir!)!.version).toBe(version);
    study.close();
  });
});

describe("announcements (spec §6.1)", () => {
  it("are returned until acknowledged, on each surface separately", () => {
    const c = coach();
    start(c);
    const first = ui(c).announcements;
    expect(first).toEqual([{ id: 1, key: "coach-started", at: MONDAY, payload: { preset: "demo-list", phase: "bases" } }]);
    expect(ackAnnouncement(c.study, 1, "ui", c.clock.now())).toBe("acked");
    expect(ackAnnouncement(c.study, 1, "ui", c.clock.now())).toBe("already");
    expect(ackAnnouncement(c.study, 99, "ui", c.clock.now())).toBe("unknown");
    expect(ui(c).announcements).toEqual([]);
    expect(chat(c).announcements).toEqual(first);
  });

  it("say which phase came, which curriculum switch happened, and how long the user was away", () => {
    const c = coach();
    start(c);
    learn(c, "basics-a");
    learn(c, "basics-b");
    start(c, "wide-list");
    c.clock.advance(10 * DAY);
    expect(ui(c).announcements.map((a) => [a.key, a.payload])).toEqual([
      ["coach-started", { preset: "demo-list", phase: "bases" }],
      ["phase-advanced", { from: "bases", to: "learn" }],
      ["curriculum-switched", { from: { preset: "demo-list", phase: "learn" }, to: { preset: "wide-list", phase: "learn" } }],
      ["welcome-back", { date: "2026-10-15", daysAway: 10 }],
    ]);
  });

  it("announces a forced phase change as phase-set, with the phase it moved from and to (M11)", () => {
    const c = coach();
    start(c);
    forcePhase(c.study, "master", c.clock.now());
    const announcement = ui(c).announcements.find((a) => a.key === "phase-set");
    expect(announcement?.payload).toEqual({ from: "bases", to: "master" });
  });
});

describe("state.json and the first run", () => {
  it("counts in state.json the announcements the playground has not acknowledged", () => {
    const root = makeCoachRepo();
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const study = openStudy(root, { clock });
    setCurriculum(study, root, "demo-list", clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ announcements: 1 });
    ackAnnouncement(study, 1, "chat", clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ announcements: 1 });
    ackAnnouncement(study, 1, "ui", clock.now());
    expect(readState(study.dir!)?.today).toMatchObject({ announcements: 0 });
    study.close();
  });

  it("says whether a repo without a study database needs init or migrate", () => {
    const root = makeCoachRepo();
    expect(notInitialized(root)).toEqual({ initialized: false, next: "init" });
    put(root, "problems/lc-9101-sample/solution.py", "# placeholder\n");
    expect(notInitialized(root)).toEqual({ initialized: false, next: "migrate" });
  });
});

describe("curriculumStatus (spec §13)", () => {
  it("skips a preset that fails validation instead of failing the whole listing (M9)", () => {
    const root = makeCoachRepo();
    put(root, "curriculum/broken.yaml", "id: broken\n"); // missing phases, patterns, timebox_minutes: PresetError
    const clock = fixedClock(MONDAY);
    initStudy(root, { clock, timezone: TZ });
    const study = openStudy(root, { clock });
    const status = curriculumStatus(study, root);
    expect(status.presets.map((p) => p.id)).toEqual(["demo-list", "ghost-list", "wide-list"]);
    study.close();
  });
});
