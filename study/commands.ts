import path from "node:path";
import { parseArgs } from "node:util";
import type { Lang } from "../runner/src/types.ts";
import type { Clock } from "./clock.ts";
import { initStudy, isTimezone } from "./init.ts";
import { applyMigration, describeAction, MigrationError, nothingToMigrate, planMigration } from "./migrate.ts";
import { StudySchemaOutdatedError } from "./store.ts";

/** Everything a command needs from the outside world, so tests run it in-process with a fixed clock. */
export interface CliIo {
  /** Content root (problems/, concepts/). */
  root: string;
  clock: Clock;
  out(text: string): void;
  err(text: string): void;
}

export class UsageError extends Error {}

export const USAGE = `Usage:
  pnpm study init [--minutes <n>] [--lang py|ts] [--timezone <IANA zone>]
  pnpm study migrate [--dry-run] [--timezone <IANA zone>]   (the user's, once; stop pnpm play and pnpm watch first)
  pnpm study status [<id>] [--json]
  pnpm study record hint <id>
  pnpm study record give-up <id>
  pnpm study record complexity <id> --time <O(…)> --space <O(…)> (--optimal | --not-optimal)
  pnpm study record explanation <concept>

<id>: a problem or exercise id (lc-0001, hash-map/01). status also takes a concept slug, a LeetCode number or part of a folder name.`;

/** Runs a parseArgs call, turning its errors into usage errors. */
function parsed<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    throw new UsageError(`${(error as Error).message}\n\n${USAGE}`);
  }
}

/** `file` relative to the content root when it is inside it, absolute otherwise. */
export function displayPath(root: string, file: string): string {
  const rel = path.relative(root, file);
  return rel.startsWith("..") || path.isAbsolute(rel) ? file : rel.split(path.sep).join("/");
}

function initCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() =>
    parseArgs({ args, strict: true, options: { minutes: { type: "string" }, lang: { type: "string" }, timezone: { type: "string" } } }),
  );
  const minutes = values.minutes === undefined ? undefined : Number(values.minutes);
  if (minutes !== undefined && !(Number.isInteger(minutes) && minutes > 0)) {
    throw new UsageError(`--minutes must be a whole number above 0 (got "${values.minutes}")`);
  }
  if (values.lang !== undefined && values.lang !== "py" && values.lang !== "ts") throw new UsageError(`--lang must be py or ts (got "${values.lang}")`);
  if (values.timezone !== undefined && !isTimezone(values.timezone)) {
    throw new UsageError(`--timezone must be an IANA time zone such as America/Bogota (got "${values.timezone}")`);
  }
  const result = initStudy(io.root, { clock: io.clock, minutes, language: values.lang as Lang | undefined, timezone: values.timezone });
  const { dailyMinutes, language, timezone } = result.profile;
  io.out(
    `${result.created ? "Created" : "Updated"} ${displayPath(io.root, result.dir)}/ (study.db, tsconfig.json, state.json).\n` +
      `Profile: ${dailyMinutes} min/day · ${language} · ${timezone}.\n`,
  );
  return 0;
}

function migrateCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() =>
    parseArgs({ args, strict: true, options: { "dry-run": { type: "boolean", default: false }, timezone: { type: "string" } } }),
  );
  if (values.timezone !== undefined && !isTimezone(values.timezone)) {
    throw new UsageError(`--timezone must be an IANA time zone such as America/Bogota (got "${values.timezone}")`);
  }
  const plan = planMigration(io.root, io.clock.now());
  for (const action of plan.actions) io.out(`${describeAction(plan, action)}\n`);
  if (plan.blockers.length > 0) {
    io.err(`Cannot migrate yet. Fix these READMEs first:\n${plan.blockers.map((blocker) => `  - ${blocker}`).join("\n")}\n`);
    return 1;
  }
  if (values["dry-run"]) {
    io.out("Dry run: nothing was changed. Run pnpm study migrate to apply.\n");
    return 0;
  }
  if (nothingToMigrate(plan)) {
    io.out("Nothing to migrate.\n");
    return 0;
  }
  applyMigration(plan, { clock: io.clock, timezone: values.timezone });
  io.out(
    "Migrated. Review `git status`, then commit the stripped READMEs and the removed solution files (git history keeps them).\n",
  );
  return 0;
}

/** `pnpm study <command> …` (spec §11). Returns the exit code; prints through `io`. */
export async function runStudyCli(argv: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "init":
        return initCommand(rest, io);
      case "migrate":
        return migrateCommand(rest, io);
      case "today":
        // Plan B (the scheduler) replaces this command.
        io.err("pnpm today arrives with the scheduler (study coach, plan B).\n");
        return 2;
      default:
        throw new UsageError(USAGE);
    }
  } catch (error) {
    if (error instanceof UsageError || error instanceof StudySchemaOutdatedError || error instanceof MigrationError) {
      io.err(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
