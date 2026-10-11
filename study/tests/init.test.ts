import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../runner/src/paths.ts";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { DEFAULT_DAILY_MINUTES, initStudy } from "../init.ts";
import { attempts, curriculumLog, phaseLog, profile } from "../schema.ts";
import { readState } from "../state-file.ts";
import { openStudy } from "../store.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";

async function cli(root: string, ...argv: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = "";
  let err = "";
  const io: CliIo = { root, clock: fixedClock(T0), out: (text) => (out += text), err: (text) => (err += text) };
  const code = await runStudyCli(argv, io);
  return { code, out, err };
}

describe("initStudy", () => {
  it("creates .study with the database, its folders, tsconfig.json, a .gitignore, the profile and state.json", () => {
    const root = makeTempDir("algo-init-");
    const result = initStudy(root, { clock: fixedClock(T0), timezone: "America/Bogota" });
    const dir = path.join(root, ".study");
    expect(result).toEqual({ dir, created: true, profile: { dailyMinutes: DEFAULT_DAILY_MINUTES, language: "py", timezone: "America/Bogota" } });
    for (const name of ["study.db", "solutions", "explanations", "exports", "tsconfig.json", "state.json"]) {
      expect(existsSync(path.join(dir, name)), name).toBe(true);
    }
    expect(readFileSync(path.join(dir, ".gitignore"), "utf8")).toContain("study.db\n");
    expect(readState(dir)).toMatchObject({ phase: null, inProgress: [], today: null });
    const study = openStudy(root);
    expect(study.db.select().from(profile).all()).toEqual([
      { id: 1, dailyMinutes: 45, language: "py", timezone: "America/Bogota", expansionList: null, createdAt: new Date(T0) },
    ]);
    study.close();
  });

  it("imports nothing (spec D5): no attempts, no curriculum, no phase", () => {
    const root = makeTempDir("algo-init-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    const study = openStudy(root);
    expect(study.db.select().from(attempts).all()).toEqual([]);
    expect(study.db.select().from(curriculumLog).all()).toEqual([]);
    expect(study.db.select().from(phaseLog).all()).toEqual([]);
    study.close();
  });

  it("runs again safely: keeps the profile, changes only the fields passed, and rewrites tsconfig.json", () => {
    const root = makeTempDir("algo-init-");
    initStudy(root, { clock: fixedClock(T0), timezone: "UTC" });
    writeFileSync(path.join(root, ".study", "tsconfig.json"), "{}\n");
    const again = initStudy(root, { clock: fixedClock("2026-10-05T10:00:00Z"), minutes: 30, language: "ts" });
    expect(again).toMatchObject({ created: false, profile: { dailyMinutes: 30, language: "ts", timezone: "UTC" } });
    expect(readFileSync(path.join(root, ".study", "tsconfig.json"), "utf8")).toContain('"extends"');
    const study = openStudy(root);
    expect(study.db.select({ createdAt: profile.createdAt }).from(profile).get()).toEqual({ createdAt: new Date(T0) });
    study.close();
  });

  it("rejects an unknown time zone or a bad number of minutes before writing anything", () => {
    const root = makeTempDir("algo-init-");
    expect(() => initStudy(root, { clock: fixedClock(T0), timezone: "Mars/Olympus" })).toThrow(RangeError);
    expect(() => initStudy(root, { clock: fixedClock(T0), minutes: 0 })).toThrow(RangeError);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });
});

describe("pnpm study init", () => {
  it("creates the store and reports the profile", async () => {
    const root = makeTempDir("algo-init-");
    const first = await cli(root, "init", "--timezone", "UTC", "--minutes", "30");
    expect(first).toEqual({ code: 0, out: "Created .study/ (study.db, tsconfig.json, state.json).\nProfile: 30 min/day · py · UTC.\n", err: "" });
    const second = await cli(root, "init", "--lang", "ts");
    expect(second.out).toBe("Updated .study/ (study.db, tsconfig.json, state.json).\nProfile: 30 min/day · ts · UTC.\n");
  });

  it("explains bad flags and unknown commands with exit code 1", async () => {
    const root = makeTempDir("algo-init-");
    expect(await cli(root, "init", "--minutes", "0")).toMatchObject({ code: 1, err: expect.stringContaining("--minutes must be a whole number above 0") });
    expect(await cli(root, "init", "--lang", "go")).toMatchObject({ code: 1, err: expect.stringContaining("--lang must be py or ts") });
    expect(await cli(root, "init", "--timezone", "Mars/Olympus")).toMatchObject({ code: 1, err: expect.stringContaining("--timezone must be an IANA time zone") });
    expect(await cli(root, "nope")).toMatchObject({ code: 1, err: expect.stringContaining("Usage:") });
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });

  it("is wired to pnpm study and pnpm today", () => {
    const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts;
    expect(scripts.study).toBe("tsx study/cli.ts");
    expect(scripts.today).toBe("tsx study/cli.ts today");
    const root = makeTempDir("algo-init-");
    const env = { ...process.env, ALGO_ROOT: root, ALGO_STUDY_NOW: T0 };
    const init = spawnSync(TSX_BIN, ["study/cli.ts", "init", "--timezone", "UTC"], { cwd: REPO_ROOT, env, encoding: "utf8" });
    expect(init.status).toBe(0);
    expect(existsSync(path.join(root, ".study", "study.db"))).toBe(true);
    const today = spawnSync(TSX_BIN, ["study/cli.ts", "today"], { cwd: REPO_ROOT, env, encoding: "utf8" });
    expect(today.status).toBe(0);
    expect(today.stdout).toContain("The coach has not started yet");
  });
});
