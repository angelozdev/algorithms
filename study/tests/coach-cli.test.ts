import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { type FixedClock, fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { initStudy } from "../init.ts";
import { acceptExplanation, recordWork } from "../record.ts";
import { cards } from "../schema.ts";
import { openStudy } from "../store.ts";
import { DAY, makeCoachRepo, MONDAY, TZ } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

function repo(options: { init?: boolean } = {}) {
  const root = makeCoachRepo();
  const clock: FixedClock = fixedClock(MONDAY);
  if (options.init ?? true) initStudy(root, { clock, timezone: TZ });
  const cli = async (...argv: string[]) => {
    let out = "";
    let err = "";
    const io: CliIo = { root, clock, out: (text) => (out += text), err: (text) => (err += text) };
    const code = await runStudyCli(argv, io);
    return { code, out, err, json: () => JSON.parse(out) };
  };
  const withStudy = (fn: (study: ReturnType<typeof openStudy>) => void) => {
    const study = openStudy(root, { clock });
    try {
      fn(study);
    } finally {
      study.close();
    }
  };
  return { root, clock, cli, withStudy };
}

describe("pnpm today", () => {
  it("explains what to run when there is no study database", async () => {
    const r = repo({ init: false });
    expect(await r.cli("today")).toMatchObject({ code: 0, out: expect.stringContaining("Run `pnpm study init`") });
    expect((await r.cli("today", "--json")).json()).toEqual({ initialized: false, next: "init" });
  });

  it("says the coach has not started, then shows the plan, and acknowledges announcements for the chat", async () => {
    const r = repo();
    expect((await r.cli("today", "--json")).json()).toMatchObject({ initialized: true, started: false, items: [] });
    expect((await r.cli("today")).out).toContain("The coach has not started yet");
    expect(await r.cli("curriculum", "set", "demo-list")).toMatchObject({ code: 0, out: "Started demo-list: phase bases.\n" });
    const plan = (await r.cli("today", "--json")).json();
    expect(plan).toMatchObject({ started: true, phase: { id: "bases" }, items: [{ kind: "concept", id: "basics-a" }] });
    expect(plan.announcements).toEqual([{ id: 1, key: "coach-started", at: MONDAY, payload: { preset: "demo-list", phase: "bases" } }]);
    expect((await r.cli("today")).out).toBe(
      [
        "2026-10-05 · phase 0 · Bases (0/2) · demo-list",
        '! [1] coach-started {"preset":"demo-list","phase":"bases"}',
        "1.   [concept] basics-a Concept basics-a · 20 min · bases 1/2",
        "",
      ].join("\n"),
    );
    expect(await r.cli("ack", "1")).toMatchObject({ code: 0, out: "Acknowledged announcement 1 (chat).\n" });
    expect(await r.cli("ack", "1")).toMatchObject({ code: 0, out: "Announcement 1 was already acknowledged (chat).\n" });
    expect(await r.cli("ack", "7")).toMatchObject({ code: 1, err: "There is no announcement 7.\n" });
    expect((await r.cli("today", "--json")).json().announcements).toEqual([]);
  });

  it("rebuilds the plan with --refresh", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    await r.cli("today");
    r.withStudy((study) => {
      recordWork(study, "basics-a/01", { type: "run", lang: "py", green: true }, "cli");
      acceptExplanation(study, "basics-a");
    });
    expect((await r.cli("today", "--json")).json().items[0]).toMatchObject({ id: "basics-a", done: true });
    expect((await r.cli("today", "--json", "--refresh")).json().items[0]).toMatchObject({ id: "basics-b", done: false });
  });
});

describe("pnpm study curriculum", () => {
  it("refuses a list that is not imported and keeps the current preset", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    const refused = await r.cli("curriculum", "set", "ghost-list");
    expect(refused).toMatchObject({ code: 1, err: expect.stringContaining("Refused: the ghost-list list is not imported") });
    expect((await r.cli("curriculum", "--json")).json()).toEqual({
      preset: "demo-list",
      since: MONDAY,
      presets: [
        { id: "demo-list", list: "demo-list", imported: 8, size: 8 },
        { id: "ghost-list", list: "ghost-list", imported: 0, size: 5 },
        { id: "wide-list", list: "wide-list", imported: 11, size: 12 },
      ],
      expansion: { list: null, choices: ["wide-list", "ghost-list"] },
    });
    expect((await r.cli("curriculum", "set", "ghost-list", "--json")).json()).toEqual({ status: "refused", preset: "ghost-list", list: "ghost-list", size: 5 });
  });

  it("switches, stores the expansion list, and reports an invalid preset with paths", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    expect(await r.cli("curriculum", "set", "wide-list")).toMatchObject({ code: 0, out: "Switched to wide-list: phase bases (was demo-list, phase bases).\n" });
    expect(await r.cli("curriculum", "expand", "demo-list")).toMatchObject({ code: 0, out: "Expansion list: demo-list (8 of 8 imported).\n" });
    put(r.root, "curriculum/broken.yaml", "id: broken\nphases: {}\npatterns: []\ntimebox_minutes: { easy: 0, medium: 35, hard: 50 }\n");
    const broken = await r.cli("curriculum", "set", "broken");
    expect(broken.code).toBe(1);
    expect(broken.err).toContain("curriculum/broken.yaml is not a valid preset:");
    expect(broken.err).toContain("  timebox_minutes.easy: Too small: expected number to be >0");
  });
});

describe("pnpm study start, pause, resume and phase", () => {
  it("starts a review from scratch: the old solution goes to history/", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    put(r.root, ".study/solutions/problems/lc-9101/solution.py", "# my earlier work\n");
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "run", lang: "py", green: true }, "cli"));
    expect(await r.cli("start", "lc-9102")).toMatchObject({ code: 1, err: expect.stringContaining("lc-9102 was never tried") });
    r.clock.advance(30 * DAY);
    const started = await r.cli("start", "lc-9101");
    expect(started).toMatchObject({ code: 0 });
    expect(started.out).toBe(
      "Started a review of lc-9101 from scratch.\nArchived: .study/solutions/problems/lc-9101/history/2026-11-04T14-00-00-000Z.py.\nFresh stub: .study/solutions/problems/lc-9101/solution.py.\n",
    );
    expect(await r.cli("start", "lc-9101")).toMatchObject({ code: 0, out: "lc-9101 already has an open attempt: go on with it.\n" });
  });

  it("pauses and resumes, moving due dates by the paused time", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "run", lang: "py", green: true }, "cli"));
    const due = () => {
      let at = 0;
      r.withStudy((study) => (at = study.db.select().from(cards).get()!.due.getTime()));
      return at;
    };
    const before = due();
    expect(await r.cli("pause")).toMatchObject({ code: 0, out: expect.stringContaining("Paused.") });
    expect((await r.cli("today", "--json")).json()).toMatchObject({ paused: { since: MONDAY }, items: [] });
    r.clock.advance(3 * DAY);
    expect(await r.cli("resume")).toMatchObject({ code: 0, out: "Resumed after 3 day(s): every due date moved by the paused time.\n" });
    expect(due() - before).toBe(3 * DAY);
    expect(await r.cli("resume")).toMatchObject({ code: 0, out: "Not paused.\n" });
  });

  it("shows the phase and lets the user force one", async () => {
    const r = repo();
    expect(await r.cli("phase", "set", "learn")).toMatchObject({ code: 1, err: expect.stringContaining("has not started") });
    await r.cli("curriculum", "set", "demo-list");
    expect((await r.cli("phase", "--json")).json()).toEqual({ started: true, phase: "bases", since: MONDAY, reason: "criteria", preset: "demo-list", progress: { done: 0, total: 2 }, exitMet: false });
    expect(await r.cli("phase", "set", "master")).toMatchObject({ code: 0, out: "Phase set to master (was bases).\n" });
    expect(await r.cli("phase", "set", "zen")).toMatchObject({ code: 1, err: expect.stringContaining("phase set takes one of bases, learn, master, expand, pro") });
  });
});

describe("pnpm study export, backup and rebuild", () => {
  it("export writes every table as JSON, and backup a database copy, both under .study/exports", async () => {
    const r = repo();
    await r.cli("curriculum", "set", "demo-list");
    expect(await r.cli("export")).toMatchObject({ code: 0, out: "Exported to .study/exports/study-2026-10-05T14-00-00-000Z.json.\n" });
    const data = JSON.parse(readFileSync(path.join(r.root, ".study/exports/study-2026-10-05T14-00-00-000Z.json"), "utf8"));
    expect(Object.keys(data.tables)).toHaveLength(15);
    expect(data.tables.curriculum_log).toEqual([{ id: 1, at: MONDAY, preset: "demo-list", reason: "init" }]);
    expect(await r.cli("backup")).toMatchObject({ code: 0, out: "Backed up to .study/exports/study-2026-10-05T14-00-00-000Z.db.\n" });
    expect(readdirSync(path.join(r.root, ".study/exports")).sort()).toEqual(["study-2026-10-05T14-00-00-000Z.db", "study-2026-10-05T14-00-00-000Z.json"]);
  });

  it("rebuild regenerates the cards cache, and --check reports a stale one", async () => {
    const r = repo();
    r.withStudy((study) => recordWork(study, "lc-9101", { type: "run", lang: "py", green: true }, "cli"));
    expect(await r.cli("rebuild", "--check")).toMatchObject({ code: 0, out: "The cards cache matches a replay (1 card(s)).\n" });
    r.withStudy((study) => study.db.update(cards).set({ reps: 9 }).run());
    expect(await r.cli("rebuild", "--check")).toMatchObject({ code: 1, err: expect.stringContaining("differs from a replay for: lc-9101") });
    expect(await r.cli("rebuild")).toMatchObject({ code: 0, out: "Rebuilt 1 card(s) from the rated attempts.\n" });
    expect(await r.cli("rebuild", "--check")).toMatchObject({ code: 0 });
    expect(existsSync(path.join(r.root, ".study/state.json"))).toBe(true);
  });
});

describe("pnpm study status --json", () => {
  it("adds the coach's state for the skills", async () => {
    const r = repo();
    expect((await r.cli("status", "--json")).json().coach).toEqual({ started: false, preset: null, phase: null, paused: false, expansionList: null });
    await r.cli("curriculum", "set", "demo-list");
    await r.cli("pause");
    expect((await r.cli("status", "--json")).json().coach).toEqual({ started: true, preset: "demo-list", phase: "bases", paused: true, expansionList: null });
  });
});
