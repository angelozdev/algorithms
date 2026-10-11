import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { studyRoot } from "../runner/src/paths.ts";
import { type Clock, envClock, systemClock } from "./clock.ts";
import * as schema from "./schema.ts";

export const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));
export const DB_FILE = "study.db";
/** Writers: the Vite server, pnpm watch, pnpm test and the study CLI (spec §12). */
export const BUSY_TIMEOUT_MS = 5000;

export type StudyDb = BetterSQLite3Database<typeof schema>;
export type StudyTx = Parameters<Parameters<StudyDb["transaction"]>[0]>[0];
/** What both `study.db` and a transaction offer: engine code that only runs statements takes this. */
export type StudyQueries = BaseSQLiteDatabase<"sync", Database.RunResult, typeof schema>;

export interface Study {
  /** Content root (problems/, concepts/); null for an in-memory study opened without one. */
  root: string | null;
  /** Study root (.study); null in memory, where nothing is written to disk. */
  dir: string | null;
  db: StudyDb;
  sqlite: Database.Database;
  clock: Clock;
  close(): void;
}

export class StudyNotInitializedError extends Error {
  constructor(readonly dir: string) {
    super(
      `There is no study database in ${dir}. A new repo: run \`pnpm study init\`. A repo with progress in its READMEs: run \`pnpm study migrate\`.`,
    );
    this.name = "StudyNotInitializedError";
  }
}

export class StudySchemaOutdatedError extends Error {
  constructor(readonly dir: string) {
    super(`The study database in ${dir} uses an older schema. Run \`pnpm study init\` to update it.`);
    this.name = "StudySchemaOutdatedError";
  }
}

export function dbPath(dir: string): string {
  return path.join(dir, DB_FILE);
}

/** Migrations this database has not applied, by drizzle's own rule: newer than the last applied one. */
export function pendingMigrations(sqlite: Database.Database, migrationsDir: string = MIGRATIONS_DIR): number {
  const files = readMigrationFiles({ migrationsFolder: migrationsDir });
  const table = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'").get();
  if (!table) return files.length;
  const last = (sqlite.prepare("SELECT max(created_at) AS at FROM __drizzle_migrations").get() as { at: number | null }).at;
  return files.filter((file) => last === null || Number(last) < file.folderMillis).length;
}

function configure(sqlite: Database.Database): void {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  sqlite.pragma("foreign_keys = ON");
}

export interface OpenOptions {
  clock?: Clock;
  /** Create the database and apply pending migrations: only `study init` and `study migrate` pass true. */
  migrate?: boolean;
  /** Tests only: another migrations folder. */
  migrationsDir?: string;
}

/**
 * Opens <studyRoot(root)>/study.db. Every process except `study init` / `study migrate` refuses a missing
 * database (StudyNotInitializedError) and an outdated one (StudySchemaOutdatedError), spec §9.1 and §13.
 */
export function openStudy(root: string, options: OpenOptions = {}): Study {
  const dir = studyRoot(root);
  const file = dbPath(dir);
  const migrationsDir = options.migrationsDir ?? MIGRATIONS_DIR;
  if (!options.migrate && !existsSync(file)) throw new StudyNotInitializedError(dir);
  if (options.migrate) mkdirSync(dir, { recursive: true });
  const sqlite = new Database(file, { fileMustExist: !options.migrate });
  try {
    configure(sqlite);
    const db = drizzle(sqlite, { schema });
    if (options.migrate) migrate(db, { migrationsFolder: migrationsDir });
    else if (pendingMigrations(sqlite, migrationsDir) > 0) throw new StudySchemaOutdatedError(dir);
    return { root, dir, db, sqlite, clock: options.clock ?? systemClock, close: () => sqlite.close() };
  } catch (error) {
    sqlite.close();
    throw error;
  }
}

/** A migrated in-memory study for engine tests. `root` lets content-aware code (status, the close seam) read files. */
export function openMemoryStudy(options: { clock?: Clock; root?: string } = {}): Study {
  const sqlite = new Database(":memory:");
  configure(sqlite);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { root: options.root ?? null, dir: null, db, sqlite, clock: options.clock ?? systemClock, close: () => sqlite.close() };
}

/**
 * Runs `fn` in one BEGIN IMMEDIATE transaction (spec §12): the write lock is taken before the first read, so
 * an open-attempt read-modify-write cannot interleave with another process. `fn` must be synchronous.
 */
export function inTransaction<T>(study: Study, fn: (tx: StudyTx) => T): T {
  return study.db.transaction(fn, { behavior: "immediate" });
}

interface CacheEntry {
  study: Study;
  ino: number;
}

const CACHE_KEY = Symbol.for("algorithms.study.cache");

/** Kept on globalThis: the Vite dev server re-evaluates app.ts and its imports, and must not open a second handle. */
function cache(): Map<string, CacheEntry> {
  const holder = globalThis as typeof globalThis & { [CACHE_KEY]?: Map<string, CacheEntry> };
  holder[CACHE_KEY] ??= new Map();
  return holder[CACHE_KEY];
}

/**
 * The shared handle of `root`'s study database for long-lived processes (the playground server, pnpm watch),
 * or null while it does not exist. A database replaced on disk (a reset and `pnpm study init`) is reopened.
 * Throws StudySchemaOutdatedError like openStudy. The clock is bound at the handle's first open, so long-lived
 * callers rely on the default env clock (ALGO_STUDY_NOW in tests, the system clock otherwise).
 */
export function cachedStudy(root: string, clock: Clock = envClock()): Study | null {
  const file = dbPath(studyRoot(root));
  const entries = cache();
  const entry = entries.get(file);
  const ino = statSync(file, { throwIfNoEntry: false })?.ino;
  if (entry && entry.ino === ino) return entry.study;
  if (entry) {
    entry.study.close();
    entries.delete(file);
  }
  if (ino === undefined) return null;
  const study = openStudy(root, { clock });
  entries.set(file, { study, ino });
  return study;
}

/** Closes every cached handle (tests, between temp repos). */
export function closeCachedStudies(): void {
  const entries = cache();
  for (const { study } of entries.values()) study.close();
  entries.clear();
}
