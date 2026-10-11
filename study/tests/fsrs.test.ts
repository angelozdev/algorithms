import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { FSRS_PARAMS, rateAttempt, rebuildAllCards, replayCard, storedCards, studyTime } from "../fsrs.ts";
import { openAttempt, recordHint, recordWork } from "../record.ts";
import { attempts, cards, curriculumLog, pauses } from "../schema.ts";
import { inTransaction, openMemoryStudy, type Study } from "../store.ts";
import { coach, DAY, expectCacheEqualsReplay, fail, MONDAY, solve } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const T0 = new Date(MONDAY);
const at = (days: number) => new Date(T0.getTime() + days * DAY);

describe("FSRS settings (spec §6.3)", () => {
  it("are retention 0.85, at most 180 days, fuzz on and no short-term steps", () => {
    expect(FSRS_PARAMS).toMatchObject({ request_retention: 0.85, maximum_interval: 180, enable_fuzz: true, enable_short_term: false });
  });
});

describe("rateAttempt (spec §6.3)", () => {
  const base = { outcome: "green" as const, hints: 0, activeMs: 10 * 60_000, measured: true, timeboxMinutes: 15 };
  it("maps a give-up to Again, hints or over the time-box to Hard, within it to Good, and under half of it to Easy", () => {
    expect(rateAttempt({ ...base, outcome: "gave_up" })).toBe("again");
    expect(rateAttempt({ ...base, hints: 1, activeMs: 60_000 })).toBe("hard");
    expect(rateAttempt({ ...base, activeMs: 16 * 60_000 })).toBe("hard");
    expect(rateAttempt({ ...base, activeMs: 15 * 60_000 })).toBe("good");
    expect(rateAttempt(base)).toBe("good");
    expect(rateAttempt({ ...base, activeMs: 7 * 60_000 })).toBe("easy");
  });

  it("never gives Easy when the time was not measured", () => {
    expect(rateAttempt({ ...base, activeMs: 60_000, measured: false })).toBe("good");
  });
});

describe("the close seam rates problems and writes their cards", () => {
  it("rates a problem's closed attempt and creates its card when the first attempt finishes", () => {
    const c = coach();
    solve(c, "lc-9101", "easy");
    const row = c.study.db.select().from(attempts).where(eq(attempts.itemId, "lc-9101")).get()!;
    expect(row.rating).toBe("easy");
    const card = c.study.db.select().from(cards).where(eq(cards.itemId, "lc-9101")).get()!;
    expect(card).toMatchObject({ reps: 1, lapses: 0, state: 2, lastReview: row.endedAt });
    expect(card.due.getTime()).toBeGreaterThan(row.endedAt!.getTime());
    expectCacheEqualsReplay(c.study);
  });

  it("uses the time-box of the preset in force and the README's difficulty", () => {
    const c = coach();
    c.study.db.insert(curriculumLog).values({ at: c.clock.now(), preset: "demo-list", reason: "init" }).run();
    // lc-9103 is hard (50 minutes): 26 measured minutes is over half of it, so Good, not Easy.
    for (let minute = 0; minute <= 26; minute += 2) {
      recordWork(c.study, "lc-9103", minute === 26 ? { type: "run", lang: "py", green: true } : { type: "edit", lang: "py", differsFromStub: true }, "watch");
      if (minute < 26) c.clock.advance(2 * 60_000);
    }
    expect(c.study.db.select({ rating: attempts.rating }).from(attempts).get()).toEqual({ rating: "good" });
  });

  it("rates a give-up Again and a hinted solve Hard, and never rates an exercise", () => {
    const c = coach();
    fail(c, "lc-9101");
    recordHint(c.study, "lc-9102");
    solve(c, "lc-9102");
    solve(c, "basics-a/01");
    const ratings = Object.fromEntries(c.study.db.select({ itemId: attempts.itemId, rating: attempts.rating }).from(attempts).all().map((r) => [r.itemId, r.rating]));
    expect(ratings).toEqual({ "lc-9101": "again", "lc-9102": "hard", "basics-a/01": null });
    expect(c.study.db.select({ itemId: cards.itemId }).from(cards).all().map((r) => r.itemId).sort()).toEqual(["lc-9101", "lc-9102"]);
    expectCacheEqualsReplay(c.study);
  });

  it("updates the card on every review, so a review attempt replays the whole history", () => {
    const c = coach();
    solve(c, "lc-9101");
    c.clock.advance(6 * DAY);
    inTransaction(c.study, (tx) => openAttempt(tx, "lc-9101", c.clock.now()));
    solve(c, "lc-9101");
    expect(c.study.db.select().from(cards).get()).toMatchObject({ reps: 2 });
    expectCacheEqualsReplay(c.study);
  });
});

describe("replay", () => {
  it("is deterministic with fuzz on: the same history always gives the same card", () => {
    const reviews = [
      { at: at(0), rating: "good" as const },
      { at: at(5), rating: "hard" as const },
      { at: at(17), rating: "again" as const },
      { at: at(18), rating: "easy" as const },
    ];
    expect(replayCard(reviews, [])).toEqual(replayCard(reviews, []));
    expect(replayCard([], [])).toBeNull();
  });

  it("shifts due and last_review by a pause after the last review, and only by the paused time", () => {
    const reviews = [{ at: at(0), rating: "good" as const }];
    const plain = replayCard(reviews, [])!;
    const paused = replayCard(reviews, [{ start: at(1).getTime(), end: at(4).getTime() }])!;
    expect(paused.due.getTime() - plain.due.getTime()).toBe(3 * DAY);
    expect(paused.lastReview!.getTime() - plain.lastReview!.getTime()).toBe(3 * DAY);
    expect({ ...paused, due: plain.due, lastReview: plain.lastReview }).toEqual(plain);
  });

  it("does not count paused time between two reviews as elapsed time", () => {
    const pause = { start: at(2).getTime(), end: at(12).getTime() };
    const withPause = replayCard([{ at: at(0), rating: "good" }, { at: at(15), rating: "good" }], [pause])!;
    const without = replayCard([{ at: at(0), rating: "good" }, { at: at(5), rating: "good" }], [])!;
    expect(withPause.stability).toBe(without.stability);
    expect(withPause.lastReview).toEqual(at(15));
    expect(studyTime(at(15).getTime(), [pause])).toBe(at(5).getTime());
  });

  it("rebuildAllCards regenerates the cache from attempts and pauses", () => {
    const study = openMemoryStudy({ clock: fixedClock(MONDAY) });
    study.db.insert(attempts).values({ itemId: "lc-9101", startedAt: at(0), endedAt: at(0), outcome: "green", rating: "good" }).run();
    study.db.insert(attempts).values({ itemId: "lc-9102", startedAt: at(1), endedAt: at(1), outcome: "gave_up", rating: "again" }).run();
    study.db.insert(pauses).values({ startedAt: at(2), endedAt: at(9) }).run();
    expect(study.db.select().from(cards).all()).toEqual([]);
    expect(inTransaction(study, (tx) => rebuildAllCards(tx))).toBe(2);
    expectCacheEqualsReplay(study);
    expect(storedCards(study.db).get("lc-9101")!.lastReview).toEqual(at(7));
  });
});
