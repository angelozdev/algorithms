import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { storedCards } from "../fsrs.ts";
import { openPause, pauseStudy, resumeStudy } from "../pause.ts";
import { attempts } from "../schema.ts";
import { coach, DAY, expectCacheEqualsReplay, MONDAY, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

describe("pause and resume (spec §6.4)", () => {
  it("records one open pause; pausing again changes nothing", () => {
    const c = coach();
    expect(pauseStudy(c.study, c.clock.now())).toEqual({ since: new Date(MONDAY), already: false });
    c.clock.advance(DAY);
    expect(pauseStudy(c.study, c.clock.now())).toEqual({ since: new Date(MONDAY), already: true });
    expect(openPause(c.study.db)).toMatchObject({ startedAt: new Date(MONDAY) });
  });

  it("moves every card's due date and last review by the paused time, and changes no attempt", () => {
    const c = coach();
    solve(c, "lc-9101");
    solve(c, "lc-9102", "easy");
    const before = storedCards(c.study.db);
    const rows = c.study.db.select().from(attempts).all();
    c.clock.advance(DAY);
    pauseStudy(c.study, c.clock.now());
    c.clock.advance(4 * DAY);
    expect(resumeStudy(c.study, c.clock.now())).toEqual({ resumed: true, pausedMs: 4 * DAY });
    for (const [itemId, card] of storedCards(c.study.db)) {
      expect(card.due.getTime() - before.get(itemId)!.due.getTime()).toBe(4 * DAY);
      expect(card.lastReview!.getTime() - before.get(itemId)!.lastReview!.getTime()).toBe(4 * DAY);
    }
    expect(c.study.db.select().from(attempts).all()).toEqual(rows);
    expectCacheEqualsReplay(c.study);
  });

  it("does nothing on resume when there is no pause", () => {
    const c = coach();
    expect(resumeStudy(c.study, c.clock.now())).toEqual({ resumed: false, pausedMs: 0 });
  });
});
