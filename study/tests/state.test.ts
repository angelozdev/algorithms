import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { attemptEvents, attempts, phaseLog } from "../schema.ts";
import { readState, statePath, writeStateFile } from "../state-file.ts";
import { refreshState } from "../state.ts";
import { openMemoryStudy, openStudy } from "../store.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";

function studyWithWork() {
  const root = makeTempDir("algo-state-");
  const study = openStudy(root, { migrate: true, clock: fixedClock(T0) });
  const now = study.clock.now();
  const id = study.db.insert(attempts).values({ itemId: "lc-0001", startedAt: now }).returning().get().id;
  study.db.insert(attemptEvents).values({ attemptId: id, at: now, type: "hint", source: "skill" }).run();
  study.db.insert(phaseLog).values({ at: now, phase: "learn", reason: "criteria" }).run();
  return { study, id };
}

describe("state.json", () => {
  it("snapshots the phase and the open attempts, with a version hash and no plan yet", () => {
    const { study } = studyWithWork();
    expect(refreshState(study)).toEqual({ changed: true });
    const state = readState(study.dir!);
    expect(state).toEqual({
      version: expect.stringMatching(/^[0-9a-f]{16}$/),
      phase: "learn",
      inProgress: [{ id: "lc-0001", kind: "new", hints: 1, startedAt: T0 }],
      today: null,
    });
    expect(readFileSync(statePath(study.dir!), "utf8").endsWith("}\n")).toBe(true);
    study.close();
  });

  it("is left alone when nothing it shows changed, and gets a new version when something did", () => {
    const { study, id } = studyWithWork();
    refreshState(study);
    const before = readState(study.dir!)!;
    const stat = statSync(statePath(study.dir!));
    expect(refreshState(study)).toEqual({ changed: false });
    expect(statSync(statePath(study.dir!)).mtimeMs).toBe(stat.mtimeMs);
    study.db.update(attempts).set({ endedAt: study.clock.now(), outcome: "green" }).where(eq(attempts.id, id)).run();
    expect(refreshState(study)).toEqual({ changed: true });
    const after = readState(study.dir!)!;
    expect(after.inProgress).toEqual([]);
    expect(after.version).not.toBe(before.version);
    study.close();
  });

  it("is written through a temp file and a rename, leaving no temp file behind", () => {
    const dir = makeTempDir("algo-state-");
    writeStateFile(dir, { phase: null, inProgress: [], today: null });
    writeStateFile(dir, { phase: "bases", inProgress: [], today: null });
    expect(readdirSync(dir)).toEqual(["state.json"]);
  });

  it("is never written for an in-memory study", () => {
    const study = openMemoryStudy();
    expect(refreshState(study)).toEqual({ changed: false });
    study.close();
  });

  it("reads as null when missing or not a snapshot", () => {
    const dir = makeTempDir("algo-state-");
    expect(readState(dir)).toBeNull();
    writeFileSync(path.join(dir, "state.json"), "{ not json");
    expect(readState(dir)).toBeNull();
    writeFileSync(path.join(dir, "state.json"), "[]");
    expect(readState(dir)).toBeNull();
  });
});
