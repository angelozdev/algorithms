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
import { storedCards } from "../fsrs.ts";
import { initStudy } from "../init.ts";
import { ensurePlan } from "../plan.ts";
import { openAttempt, recordHint, recordWork } from "../record.ts";
import { resetItem, resetPreview } from "../reset.ts";
import { attemptEvents, attempts } from "../schema.ts";
import { startAttempt } from "../start.ts";
import { itemProgress } from "../status.ts";
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

/** A repo on disk (resets move files): .study initialized in TZ, the coach started on demo-list. */
function repo(): Repo {
  const root = makeCoachRepo();
  const clock = fixedClock(MONDAY);
  initStudy(root, { clock, timezone: TZ });
  const study = openStudy(root, { clock });
  setCurriculum(study, root, "demo-list", clock.now());
  return { root, study, clock, target: (id) => listTargets(root).find((t) => t.id === id)! };
}

const OLD_WORK = "# my earlier work\n";
const STAMP = "2026-10-05T14-00-00-000Z"; // MONDAY, as a history file name
const edit = (r: Repo, id: string) => recordWork(r.study, id, { type: "save", lang: "py", differsFromStub: true }, "playground");
const solve = (r: Repo, id: string) => recordWork(r.study, id, { type: "run", lang: "py", green: true }, "cli");
const stubOf = (r: Repo, id: string) => renderStub(loadCaseFile(r.target(id).dir), "py");
const writeSolution = (r: Repo, id: string, code: string) => put(r.root, path.relative(r.root, studySolutionPath(r.target(id), "py")), code);
const historyOf = (r: Repo, id: string) => {
  const dir = path.join(studySolutionDir(r.target(id)), "history");
  return existsSync(dir) ? readdirSync(dir) : [];
};
// DEVIATION (brief Step 3): recordWork ("edit"/"save") refuses to record once an item has a closed attempt — a
// review attempt starts explicitly (record.ts, recordWork's doc comment). The brief's test reused `edit` to open
// a review attempt on an already-solved item; that no-ops under the real recordWork, so the open attempt it
// expected to see never existed. This helper opens one directly, the way coach-fixture.ts's `review()` does,
// without writing any solution file (the "all" test needs the untouched solution file to still be on disk).
const openReview = (r: Repo, id: string) => inTransaction(r.study, (tx) => openAttempt(tx, id, r.clock.now()));

describe("resetPreview (item reset spec §4)", () => {
  it("counts the open attempt's hints and active minutes, every attempt's hints, and the saved versions", () => {
    const r = repo();
    expect(resetPreview(r.study, r.target("lc-9101"))).toEqual({ open: null, attempts: 0, hints: 0, versions: 0, examLocked: false });
    edit(r, "lc-9101");
    r.clock.advance(4 * 60_000);
    edit(r, "lc-9101");
    recordHint(r.study, "lc-9101");
    put(r.root, path.relative(r.root, path.join(studySolutionDir(r.target("lc-9101")), "history", "old.py")), OLD_WORK);
    expect(resetPreview(r.study, r.target("lc-9101"))).toEqual({ open: { hints: 1, minutes: 4 }, attempts: 1, hints: 1, versions: 1, examLocked: false });
    r.study.close();
  });
});

describe("code: clean the editor (spec §3.1)", () => {
  it("archives the code, writes a fresh stub and leaves the open attempt open", () => {
    const r = repo();
    const target = r.target("lc-9101");
    writeSolution(r, "lc-9101", OLD_WORK);
    edit(r, "lc-9101");
    const result = resetItem(r.study, target, "code", r.clock.now());
    expect(result).toMatchObject({
      reset: true,
      action: "code",
      archived: [path.join(studySolutionDir(target), "history", `${STAMP}.py`)],
      solutions: [studySolutionPath(target, "py")],
    });
    expect(readFileSync(studySolutionPath(target, "py"), "utf8")).toBe(stubOf(r, "lc-9101"));
    expect(itemProgress(r.study, "lc-9101").status).toBe("in_progress");
    r.study.close();
  });

  it("just replaces a stub, and keeps an untried item to do", () => {
    const r = repo();
    writeSolution(r, "lc-9102", stubOf(r, "lc-9102"));
    expect(resetItem(r.study, r.target("lc-9102"), "code", r.clock.now())).toMatchObject({ reset: true, archived: [] });
    expect(historyOf(r, "lc-9102")).toEqual([]);
    expect(readFileSync(studySolutionPath(r.target("lc-9102"), "py"), "utf8")).toBe(stubOf(r, "lc-9102"));
    expect(itemProgress(r.study, "lc-9102").status).toBe("todo");
    r.study.close();
  });
});

describe("attempt: discard the open attempt (spec §3.2)", () => {
  it("discards a first attempt: the item is to do again, its code in the history", () => {
    const r = repo();
    writeSolution(r, "lc-9101", OLD_WORK);
    edit(r, "lc-9101");
    recordHint(r.study, "lc-9101");
    expect(resetItem(r.study, r.target("lc-9101"), "attempt", r.clock.now())).toMatchObject({ reset: true, action: "attempt", before: { open: { hints: 1, minutes: 0 } } });
    expect(itemProgress(r.study, "lc-9101")).toMatchObject({ status: "todo", open: null, hints: 0 });
    expect(r.study.db.select().from(attempts).all()).toEqual([]);
    expect(r.study.db.select().from(attemptEvents).all()).toEqual([]);
    expect(historyOf(r, "lc-9101")).toEqual([`${STAMP}.py`]);
    r.study.close();
  });

  it("discards a review: the item is solved again and its card does not move", () => {
    const r = repo();
    solve(r, "lc-9101");
    const due = storedCards(r.study.db).get("lc-9101")!.due;
    r.clock.advance(30 * DAY);
    openReview(r, "lc-9101"); // opens a review attempt
    expect(itemProgress(r.study, "lc-9101").status).toBe("in_progress");
    expect(resetItem(r.study, r.target("lc-9101"), "attempt", r.clock.now())).toMatchObject({ reset: true });
    expect(itemProgress(r.study, "lc-9101")).toMatchObject({ status: "solved", open: null });
    expect(storedCards(r.study.db).get("lc-9101")!.due).toEqual(due);
    r.study.close();
  });

  it("refuses when no attempt is open", () => {
    const r = repo();
    expect(resetItem(r.study, r.target("lc-9101"), "attempt", r.clock.now())).toEqual({ reset: false, reason: "no-open-attempt" });
    r.study.close();
  });
});

describe("all: factory reset (spec §3.3)", () => {
  it("erases attempts, events, the card and the whole solution folder, and nothing of other items", () => {
    const r = repo();
    const target = r.target("lc-9101");
    writeSolution(r, "lc-9101", OLD_WORK);
    solve(r, "lc-9101");
    r.clock.advance(30 * DAY);
    openReview(r, "lc-9101");
    recordHint(r.study, "lc-9101");
    put(r.root, path.relative(r.root, path.join(studySolutionDir(target), "history", "old.py")), OLD_WORK);
    edit(r, "lc-9102");
    expect(resetItem(r.study, target, "all", r.clock.now())).toMatchObject({ reset: true, action: "all", before: { attempts: 2, hints: 1, versions: 1 } });
    expect(itemProgress(r.study, "lc-9101")).toMatchObject({ status: "todo", everGreen: false, open: null, nextDue: null });
    expect(storedCards(r.study.db).has("lc-9101")).toBe(false);
    expect(existsSync(studySolutionDir(target))).toBe(false);
    expect(r.study.db.select({ itemId: attempts.itemId }).from(attempts).all()).toEqual([{ itemId: "lc-9102" }]);
    expect(r.study.db.select().from(attemptEvents).all()).toHaveLength(1);
    r.study.close();
  });

  it("erases an item that was never touched without complaint", () => {
    const r = repo();
    expect(resetItem(r.study, r.target("lc-9103"), "all", r.clock.now())).toMatchObject({ reset: true, before: { attempts: 0, versions: 0 } });
    r.study.close();
  });
});

describe("exam lock (spec R6)", () => {
  it("refuses to discard or erase an item with an exam attempt, and still cleans its code", () => {
    const r = repo();
    forcePhase(r.study, "master", r.clock.now());
    const first = ensurePlan(r.study, r.root, r.clock.now())!.items[0].itemId;
    expect(startAttempt(r.study, r.root, r.target(first), r.clock.now())).toMatchObject({ started: true, kind: "exam" });
    expect(resetPreview(r.study, r.target(first)).examLocked).toBe(true);
    expect(resetItem(r.study, r.target(first), "attempt", r.clock.now())).toEqual({ reset: false, reason: "exam" });
    expect(resetItem(r.study, r.target(first), "all", r.clock.now())).toEqual({ reset: false, reason: "exam" });
    expect(resetItem(r.study, r.target(first), "code", r.clock.now())).toMatchObject({ reset: true, action: "code" });
    expect(itemProgress(r.study, first).status).toBe("in_progress");
    r.study.close();
  });
});
