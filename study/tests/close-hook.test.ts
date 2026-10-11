import { describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({ calls: [] as { attempt: unknown; root: string | null }[], fail: false }));

vi.mock("../close-hook.ts", () => ({
  onAttemptClosed: (_tx: unknown, attempt: unknown, ctx: { root: string | null }) => {
    seam.calls.push({ attempt, root: ctx.root });
    if (seam.fail) throw new Error("plan B failed");
  },
}));

import { fixedClock } from "../clock.ts";
import { closeAttempt, giveUp, recordWork } from "../record.ts";
import { attemptEvents, attempts } from "../schema.ts";
import { inTransaction, openMemoryStudy } from "../store.ts";

const T0 = "2026-10-04T10:00:00.000Z";

describe("the close seam, where Plan B rates the attempt and updates its card", () => {
  it("runs once per attempt, inside the closing transaction, with the closed attempt", () => {
    seam.calls.length = 0;
    seam.fail = false;
    const study = openMemoryStudy({ clock: fixedClock(T0), root: "/repo" });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli");
    giveUp(study, "lc-0020");
    inTransaction(study, (tx) => closeAttempt(tx, 1, "gave_up", study.clock.now(), study)); // already closed: no second call
    expect(seam.calls).toEqual([
      { attempt: { id: 1, itemId: "lc-0001", examId: null, startedAt: new Date(T0), endedAt: new Date(T0), outcome: "green" }, root: "/repo" },
      { attempt: { id: 2, itemId: "lc-0020", examId: null, startedAt: new Date(T0), endedAt: new Date(T0), outcome: "gave_up" }, root: "/repo" },
    ]);
  });

  it("rolls the close back when it throws: the attempt stays open and the green run is not recorded", () => {
    seam.calls.length = 0;
    seam.fail = false;
    const study = openMemoryStudy({ clock: fixedClock(T0) });
    recordWork(study, "lc-0001", { type: "run", lang: "py", green: false }, "cli");
    seam.fail = true;
    expect(() => recordWork(study, "lc-0001", { type: "run", lang: "py", green: true }, "cli")).toThrow("plan B failed");
    expect(study.db.select().from(attempts).all()).toMatchObject([{ endedAt: null, outcome: null }]);
    expect(study.db.select().from(attemptEvents).all()).toHaveLength(1);
    seam.fail = false;
  });
});
