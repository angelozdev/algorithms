import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { studyRoot, writeStudyTsconfig } from "../runner/src/paths.ts";
import type { Lang } from "../runner/src/types.ts";
import type { Clock } from "./clock.ts";
import { profile } from "./schema.ts";
import { refreshState } from "./state.ts";
import { dbPath, openStudy } from "./store.ts";

/** The coach asks on first use (spec §6.2); until then the budget is 45 minutes a day. */
export const DEFAULT_DAILY_MINUTES = 45;

export interface InitOptions {
  clock: Clock;
  minutes?: number;
  language?: Lang;
  timezone?: string;
}

export interface InitResult {
  /** The study root that was set up. */
  dir: string;
  /** True when this call created the database. */
  created: boolean;
  profile: { dailyMinutes: number; language: Lang; timezone: string };
}

export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function isTimezone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * `pnpm study init` (spec §9.1): creates .study/, applies the migrations (only init and migrate do), writes
 * tsconfig.json and the profile, and refreshes state.json. It imports nothing (D5). Safe to run again: it
 * applies new migrations, rewrites tsconfig.json, and changes only the profile fields passed.
 */
export function initStudy(root: string, options: InitOptions): InitResult {
  if (options.timezone !== undefined && !isTimezone(options.timezone)) throw new RangeError(`unknown time zone "${options.timezone}"`);
  if (options.minutes !== undefined && !(Number.isInteger(options.minutes) && options.minutes > 0)) {
    throw new RangeError(`daily minutes must be a whole number above 0 (got ${options.minutes})`);
  }
  const dir = studyRoot(root);
  const created = !existsSync(dbPath(dir));
  for (const sub of ["solutions", "explanations", "exports"]) mkdirSync(path.join(dir, sub), { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  if (!existsSync(ignore)) {
    writeFileSync(ignore, "# .study may be its own private git repo (spec §12): it can hold exports, never the live database.\nstudy.db\nstudy.db-*\n");
  }
  writeStudyTsconfig(dir);
  const study = openStudy(root, { clock: options.clock, migrate: true });
  try {
    const current = study.db.select().from(profile).get();
    if (!current) {
      study.db
        .insert(profile)
        .values({
          id: 1,
          dailyMinutes: options.minutes ?? DEFAULT_DAILY_MINUTES,
          language: options.language ?? "py",
          timezone: options.timezone ?? systemTimezone(),
          createdAt: options.clock.now(),
        })
        .run();
    } else {
      const changes = {
        ...(options.minutes !== undefined ? { dailyMinutes: options.minutes } : {}),
        ...(options.language !== undefined ? { language: options.language } : {}),
        ...(options.timezone !== undefined ? { timezone: options.timezone } : {}),
      };
      if (Object.keys(changes).length > 0) study.db.update(profile).set(changes).where(eq(profile.id, 1)).run();
    }
    refreshState(study);
    const row = study.db.select().from(profile).get()!;
    return { dir, created, profile: { dailyMinutes: row.dailyMinutes, language: row.language, timezone: row.timezone } };
  } finally {
    study.close();
  }
}
