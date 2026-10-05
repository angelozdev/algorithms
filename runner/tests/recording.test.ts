import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixedClock } from "../../study/clock.ts";
import { initStudy } from "../../study/init.ts";
import { attemptEvents, itemStatusView } from "../../study/schema.ts";
import { closeCachedStudies, openStudy } from "../../study/store.ts";
import { recordRun, recordSolutionChange, sameAsStub } from "../src/recording.ts";
import { runTarget } from "../src/run.ts";
import { loadCaseFile } from "../src/schema.ts";
import { renderStub } from "../src/stubs.ts";
import { makeProblem, removeTemp, tempDir } from "./helpers.ts";

const T0 = "2026-10-04T10:00:00.000Z";
const SUM = { entry: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int", examples: [{ input: [[1, 2]], expected: 3 }], hidden: [] };
const PY_SUM = "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n";
const roots: string[] = [];

afterEach(() => {
  closeCachedStudies();
  for (const root of roots.splice(0)) removeTemp(root);
});

function repo(withStudy: boolean) {
  const root = tempDir();
  roots.push(root);
  const target = makeProblem(root, "lc-0001-sum", SUM);
  if (withStudy) initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
  return { root, target };
}

const recorded = (root: string) => {
  const study = openStudy(root);
  try {
    return {
      status: study.db.select().from(itemStatusView).all().map((row) => [row.itemId, row.status]),
      events: study.db.select({ type: attemptEvents.type, source: attemptEvents.source }).from(attemptEvents).orderBy(attemptEvents.id).all(),
    };
  } finally {
    study.close();
  }
};

describe("sameAsStub", () => {
  it("ignores line endings and trailing blanks, so an editor that only reformats the stub has not started work", () => {
    const stub = "class Solution:\n    def solve(self) -> int:\n        raise NotImplementedError\n";
    expect(sameAsStub(stub.replace(/\n/g, "\r\n"), stub)).toBe(true);
    expect(sameAsStub(stub.replace("int:\n", "int:   \n") + "\n\n", stub)).toBe(true);
    expect(sameAsStub(stub.replace("raise NotImplementedError", "return 0"), stub)).toBe(false);
  });
});

describe("recording from the runner", () => {
  it("ignores a save that equals the stub, opens on real work, and closes on a green run", () => {
    const { root, target } = repo(true);
    expect(recordSolutionChange(target, "py", renderStub(loadCaseFile(target.dir), "py"), "save", "playground")).toEqual({ status: "ignored" });
    expect(recordSolutionChange(target, "py", PY_SUM, "save", "playground")).toEqual({ status: "recorded" });
    expect(recordRun(target, "py", true, "playground")).toEqual({ status: "recorded" });
    expect(recorded(root)).toEqual({
      status: [["lc-0001", "solved"]],
      events: [
        { type: "save", source: "playground" },
        { type: "run", source: "playground" },
      ],
    });
  });

  it("is off, and creates nothing, while the repo has no study database", () => {
    const { root, target } = repo(false);
    expect(recordRun(target, "py", true, "cli")).toEqual({ status: "off" });
    expect(existsSync(path.join(root, ".study", "study.db"))).toBe(false);
  });

  it("never breaks a run: an outdated database costs one stderr line, however many runs fail to record", async () => {
    const { root, target } = repo(false);
    const result = await runTarget(target, "py", { root, record: "cli" });
    expect(result.fatal).toBeNull(); // the stub runs; no database, nothing recorded, nothing printed
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const study = openStudy(root);
    study.sqlite.prepare("DELETE FROM __drizzle_migrations").run();
    study.close();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      for (let i = 0; i < 2; i++) expect((await runTarget(target, "py", { root, record: "cli" })).examples.total).toBe(1);
      const lines = stderr.mock.calls.map(([chunk]) => String(chunk)).filter((line) => line.startsWith("study:"));
      expect(lines).toEqual([expect.stringContaining("Run `pnpm study init`")]);
    } finally {
      stderr.mockRestore();
    }
  });

  it("never breaks a run when only state.json's rewrite fails: the database write still lands, and the caller still gets one stderr line", async () => {
    const { root, target } = repo(true);
    // Force writeStateFile's renameSync to fail (EISDIR), without touching the database at all: this isolates
    // a refreshState/writeStateFile failure from a cachedStudy/openStudy failure (Task 4's review gap).
    const statePath = path.join(root, ".study", "state.json");
    rmSync(statePath, { force: true });
    mkdirSync(statePath);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      // The run itself (the actual thing the user cares about) is entirely unaffected.
      const result = await runTarget(target, "py", { root, record: "cli" });
      expect(result.fatal).toBeNull();
      expect(result.examples.total).toBe(1);

      // The adapter call itself reports the failure, not a crash, and exactly one stderr line.
      expect(recordRun(target, "py", false, "cli")).toEqual({ status: "failed", message: expect.any(String) });
      const lines = stderr.mock.calls.map(([chunk]) => String(chunk)).filter((line) => line.startsWith("study:"));
      expect(lines).toHaveLength(1);

      // The database write itself (inside the transaction, which commits before refreshState runs) still landed:
      // the attempt really opened, even though the caller was told "failed" because state.json could not be rewritten.
      expect(recorded(root).status).toEqual([["lc-0001", "in_progress"]]);
    } finally {
      stderr.mockRestore();
    }
  });
});
