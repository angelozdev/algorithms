import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { PresetError } from "../curriculum.ts";
import { announcements, curriculumLog, patternIntros, profile } from "../schema.ts";
import { forcePhase, setCurriculum, setExpansionList } from "../switch.ts";
import { coach, DAY, DEMO_LIST, learn, phases, review, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const curricula = (c: ReturnType<typeof coach>) =>
  c.study.db.select({ preset: curriculumLog.preset, reason: curriculumLog.reason }).from(curriculumLog).orderBy(curriculumLog.id).all();

describe("setCurriculum (spec §6.5)", () => {
  it("starts the coach with the preset and the phase its criteria give", () => {
    const c = coach();
    expect(setCurriculum(c.study, c.root, "demo-list", c.clock.now())).toEqual({ status: "started", preset: "demo-list", phase: "bases", previous: null, announcementId: 1 });
    expect(curricula(c)).toEqual([{ preset: "demo-list", reason: "init" }]);
    expect(setCurriculum(c.study, c.root, "demo-list", c.clock.now())).toEqual({ status: "unchanged", preset: "demo-list" });
  });

  it("refuses a preset whose list is not imported, and keeps the current one", () => {
    const c = coach();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    expect(setCurriculum(c.study, c.root, "ghost-list", c.clock.now())).toEqual({ status: "refused", preset: "ghost-list", list: "ghost-list", size: 5 });
    expect(curricula(c)).toEqual([{ preset: "demo-list", reason: "init" }]);
    expect(() => setCurriculum(c.study, c.root, "nope", c.clock.now())).toThrow(PresetError);
  });

  it("switches both ways, recalculating the phase, which may move back, and announces each switch", () => {
    const c = coach();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    learn(c, "basics-a");
    learn(c, "basics-b");
    for (const id of DEMO_LIST) solve(c, id);
    for (const round of [1, 2]) {
      c.clock.advance(10 * DAY * round);
      for (const id of DEMO_LIST) review(c, id);
    }
    c.study.db.insert(patternIntros).values({ pattern: "stack", introducedAt: c.clock.now() }).run();
    expect(phases(c.study).at(-1)).toEqual(["master", "criteria"]);

    // wide-list has 4 problems never solved: back to phase 1.
    expect(setCurriculum(c.study, c.root, "wide-list", c.clock.now())).toMatchObject({
      status: "switched",
      phase: "learn",
      previous: { preset: "demo-list", phase: "master" },
    });
    expect(phases(c.study).at(-1)).toEqual(["learn", "switch"]);
    const switchRow = c.study.db.select().from(announcements).orderBy(announcements.id).all().at(-1)!;
    expect(switchRow).toMatchObject({ kind: "switch", phaseLogId: expect.any(Number), curriculumLogId: 2 });

    // Back to demo-list: its criteria still hold, so phase 2 again.
    expect(setCurriculum(c.study, c.root, "demo-list", c.clock.now())).toMatchObject({ status: "switched", phase: "master" });
    expect(curricula(c)).toEqual([
      { preset: "demo-list", reason: "init" },
      { preset: "wide-list", reason: "switch" },
      { preset: "demo-list", reason: "switch" },
    ]);
    expect(c.study.db.select({ pattern: patternIntros.pattern }).from(patternIntros).all()).toEqual([{ pattern: "stack" }]);
  });
});

describe("setExpansionList and forcePhase", () => {
  it("stores one of the preset's expansion choices, even when it is not imported yet", () => {
    const c = coach();
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    expect(setExpansionList(c.study, c.root, "grind-169")).toEqual({ status: "refused", list: "grind-169", reason: "not-a-choice", choices: ["wide-list", "ghost-list"] });
    expect(setExpansionList(c.study, c.root, "ghost-list")).toEqual({ status: "set", list: "ghost-list", imported: 0, size: 5 });
    expect(setExpansionList(c.study, c.root, "wide-list")).toEqual({ status: "set", list: "wide-list", imported: 11, size: 12 });
    expect(c.study.db.select({ list: profile.expansionList }).from(profile).get()).toEqual({ list: "wide-list" });
  });

  it("forces a phase with reason forced, and refuses before the coach starts", () => {
    const c = coach();
    expect(forcePhase(c.study, "learn", c.clock.now())).toEqual({ status: "not-started" });
    setCurriculum(c.study, c.root, "demo-list", c.clock.now());
    expect(forcePhase(c.study, "learn", c.clock.now())).toEqual({ status: "set", from: "bases", to: "learn", announcementId: 2 });
    expect(phases(c.study)).toEqual([
      ["bases", "criteria"],
      ["learn", "forced"],
    ]);
  });
});
