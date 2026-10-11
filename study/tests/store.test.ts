import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupTempDirs, makeTempDir } from "../../scripts/tests/fixture.ts";
import { envClock, fixedClock, systemClock } from "../clock.ts";
import { attempts } from "../schema.ts";
import {
  cachedStudy,
  closeCachedStudies,
  dbPath,
  inTransaction,
  MIGRATIONS_DIR,
  openMemoryStudy,
  openStudy,
  pendingMigrations,
  StudyNotInitializedError,
  StudySchemaOutdatedError,
} from "../store.ts";

afterEach(() => {
  closeCachedStudies();
  cleanupTempDirs();
  vi.unstubAllEnvs();
});

/** A copy of the migrations plus a fake later one: what a repo looks like after a pull that changed the schema. */
function newerMigrations(): string {
  const dir = makeTempDir("algo-migrations-");
  cpSync(MIGRATIONS_DIR, dir, { recursive: true });
  const journalFile = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8")) as { entries: { idx: number; when: number; tag: string }[] };
  const last = journal.entries[journal.entries.length - 1];
  journal.entries.push({ ...last, idx: last.idx + 1, when: last.when + 1000, tag: "0001_probe" });
  writeFileSync(journalFile, JSON.stringify(journal));
  writeFileSync(path.join(dir, "0001_probe.sql"), "CREATE TABLE `probe` (`id` integer PRIMARY KEY);");
  return dir;
}

describe("clocks", () => {
  it("a fixed clock moves only when told to", () => {
    const clock = fixedClock("2026-10-04T10:00:00Z");
    expect(clock.now().toISOString()).toBe("2026-10-04T10:00:00.000Z");
    clock.advance(90_000);
    expect(clock.now().toISOString()).toBe("2026-10-04T10:01:30.000Z");
    clock.set("2026-10-05T00:00:00Z");
    expect(clock.now().toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(() => fixedClock("not a date")).toThrow(RangeError);
  });

  it("ALGO_STUDY_NOW freezes the CLI's clock; otherwise it is the system clock", () => {
    expect(envClock({ ALGO_STUDY_NOW: "2026-10-04T10:00:00Z" }).now().toISOString()).toBe("2026-10-04T10:00:00.000Z");
    expect(envClock({})).toBe(systemClock);
  });
});

describe("openStudy", () => {
  it("refuses a repo that was never initialized, and creates nothing", () => {
    const root = makeTempDir("algo-study-");
    expect(() => openStudy(root)).toThrow(StudyNotInitializedError);
    expect(() => openStudy(root)).toThrow(/pnpm study init.*pnpm study migrate/s);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });

  it("with migrate: true creates .study/study.db in WAL mode, with a busy timeout and foreign keys on", () => {
    const root = makeTempDir("algo-study-");
    const study = openStudy(root, { migrate: true });
    expect(study.root).toBe(root);
    expect(study.dir).toBe(path.join(root, ".study"));
    expect(existsSync(dbPath(path.join(root, ".study")))).toBe(true);
    expect(study.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(study.sqlite.pragma("busy_timeout", { simple: true })).toBe(5000);
    expect(study.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    study.close();
    openStudy(root).close(); // from now on any process may open it
  });

  it("refuses an outdated schema until a migrating open applies the new migration", () => {
    const root = makeTempDir("algo-study-");
    openStudy(root, { migrate: true }).close();
    const newer = newerMigrations();
    expect(() => openStudy(root, { migrationsDir: newer })).toThrow(StudySchemaOutdatedError);
    expect(() => openStudy(root, { migrationsDir: newer })).toThrow(/Run `pnpm study init`/);
    openStudy(root, { migrate: true, migrationsDir: newer }).close();
    const study = openStudy(root, { migrationsDir: newer });
    expect(pendingMigrations(study.sqlite, newer)).toBe(0);
    study.close();
  });

  it("follows ALGO_STUDY", () => {
    const root = makeTempDir("algo-study-");
    const elsewhere = path.join(makeTempDir("algo-elsewhere-"), "progress");
    vi.stubEnv("ALGO_STUDY", elsewhere);
    const study = openStudy(root, { migrate: true });
    expect(study.dir).toBe(elsewhere);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
    study.close();
  });
});

describe("inTransaction", () => {
  it("commits what fn wrote, or nothing at all when fn throws", () => {
    const study = openMemoryStudy({ clock: fixedClock("2026-10-04T10:00:00Z") });
    inTransaction(study, (tx) => tx.insert(attempts).values({ itemId: "lc-0001", startedAt: study.clock.now() }).run());
    expect(() =>
      inTransaction(study, (tx) => {
        tx.insert(attempts).values({ itemId: "lc-0002", startedAt: study.clock.now() }).run();
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(study.db.select().from(attempts).all().map((row) => row.itemId)).toEqual(["lc-0001"]);
    study.close();
  });
});

describe("cachedStudy", () => {
  it("is null until the database exists, then one shared handle, reopened when the file is replaced", () => {
    const root = makeTempDir("algo-study-");
    expect(cachedStudy(root)).toBeNull();
    openStudy(root, { migrate: true }).close();
    const first = cachedStudy(root);
    expect(first).not.toBeNull();
    expect(cachedStudy(root)).toBe(first);
    first!.db.insert(attempts).values({ itemId: "lc-0001", startedAt: new Date() }).run();
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${dbPath(path.join(root, ".study"))}${suffix}`, { force: true });
    expect(cachedStudy(root)).toBeNull();
    openStudy(root, { migrate: true }).close();
    const second = cachedStudy(root);
    expect(second).not.toBe(first);
    expect(second!.db.select().from(attempts).all()).toEqual([]);
  });

  it("refuses an outdated schema like openStudy", () => {
    const root = makeTempDir("algo-study-");
    openStudy(root, { migrate: true }).close();
    const study = openStudy(root);
    study.sqlite.prepare("DELETE FROM __drizzle_migrations").run();
    study.close();
    expect(() => cachedStudy(root)).toThrow(StudySchemaOutdatedError);
  });

  it("binds its handle to the env clock at the first open (ALGO_STUDY_NOW in tests)", () => {
    const root = makeTempDir("algo-study-");
    openStudy(root, { migrate: true }).close();
    vi.stubEnv("ALGO_STUDY_NOW", "2026-11-04T14:00:00.000Z");
    const study = cachedStudy(root);
    expect(study!.clock.now().toISOString()).toBe("2026-11-04T14:00:00.000Z");
  });
});
