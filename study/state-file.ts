import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AttemptKind, Phase } from "./schema.ts";

export const STATE_FILE = "state.json";

/** An open attempt as hooks and watchers see it. `startedAt` is ISO 8601. */
export interface InProgressItem {
  id: string;
  kind: AttemptKind;
  hints: number;
  startedAt: string;
}

/** Today at a glance once the coach has started (null before): the playground refetches its Today section when it changes. */
export interface TodaySummary {
  date: string;
  /** Items in today's stored plan (0 before `today` makes it, and while paused). */
  planned: number;
  done: number;
  paused: boolean;
  /** Announcements the playground has not acknowledged yet. */
  announcements: number;
}

/**
 * .study/state.json (spec §4): a snapshot rewritten after every write, so .claude/hooks/reminder.mjs and the
 * playground's file watcher never need SQLite. `version` is a hash of the other fields: it changes exactly
 * when they do.
 */
export interface StudyState {
  version: string;
  phase: Phase | null;
  inProgress: InProgressItem[];
  today: TodaySummary | null;
}

export type StudySnapshot = Omit<StudyState, "version">;

export function statePath(dir: string): string {
  return path.join(dir, STATE_FILE);
}

export function stateVersion(snapshot: StudySnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0, 16);
}

/** The snapshot on disk, or null when it is missing or is not one. */
export function readState(dir: string): StudyState | null {
  try {
    const value = JSON.parse(readFileSync(statePath(dir), "utf8")) as Partial<StudyState> | null;
    return value && typeof value.version === "string" && Array.isArray(value.inProgress) ? (value as StudyState) : null;
  } catch {
    return null;
  }
}

/** Writes the snapshot through a temp file and a rename (readers never see half a file); skips an identical one. */
export function writeStateFile(dir: string, snapshot: StudySnapshot): { changed: boolean; state: StudyState } {
  const state: StudyState = { version: stateVersion(snapshot), ...snapshot };
  if (readState(dir)?.version === state.version) return { changed: false, state };
  mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${STATE_FILE}.${process.pid}.tmp`);
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, statePath(dir));
  return { changed: true, state };
}
