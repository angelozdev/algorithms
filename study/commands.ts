import path from "node:path";
import { parseArgs } from "node:util";
import { scanRepo } from "../lib/repo.ts";
import { listTargets, QueryError, resolveQuery } from "../runner/src/resolver.ts";
import type { Lang, Target } from "../runner/src/types.ts";
import type { Clock } from "./clock.ts";
import { initStudy, isTimezone } from "./init.ts";
import { applyMigration, describeAction, MigrationError, nothingToMigrate, planMigration } from "./migrate.ts";
import { acceptExplanation, giveUp, recordComplexity, recordHint } from "./record.ts";
import { conceptStatusJson, describeConcept, describeItem, describeSummary, itemStatusJson, summaryJson } from "./status.ts";
import { openStudy, type Study, StudyNotInitializedError, StudySchemaOutdatedError } from "./store.ts";

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

/** The study, or null before `pnpm study init` / `migrate`. An outdated schema still throws. */
function openOrNull(io: CliIo): Study | null {
  try {
    return openStudy(io.root, { clock: io.clock });
  } catch (error) {
    if (error instanceof StudyNotInitializedError) return null;
    throw error;
  }
}

const NOT_INITIALIZED =
  "Not recorded: there is no study database yet. The user runs `pnpm study init` (new repo) or `pnpm study migrate` (existing repo).\n";

/** Runs `fn` on the study; before init, prints NOT_INITIALIZED and succeeds (skills keep going, spec §13). */
function withStudy(io: CliIo, fn: (study: Study) => number): number {
  const study = openOrNull(io);
  if (!study) {
    io.err(NOT_INITIALIZED);
    return 0;
  }
  try {
    return fn(study);
  } finally {
    study.close();
  }
}

/** An exact problem or exercise id: the record commands never guess (skills always pass the id). */
function exactTarget(root: string, id: string | undefined): Target {
  if (!id) throw new UsageError(`Give a problem or exercise id.\n\n${USAGE}`);
  const target = listTargets(root).find((candidate) => candidate.id === id);
  if (!target) throw new UsageError(`There is no problem or exercise with id "${id}". Use its exact id (lc-0001, hash-map/01).`);
  return target;
}

type Found = { kind: "target"; target: Target } | { kind: "concept"; slug: string };

/** status takes an exact item id, a concept slug, or anything `pnpm test` understands. */
function findForStatus(root: string, query: string): Found {
  const targets = listTargets(root);
  const exact = targets.find((target) => target.id === query);
  if (exact) return { kind: "target", target: exact };
  if (scanRepo(root).concepts.some((concept) => concept.slug === query)) return { kind: "concept", slug: query };
  return { kind: "target", target: resolveQuery(targets, query) };
}

function statusCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: "boolean", default: false } } }),
  );
  const query = positionals.join(" ").trim();
  const found = query ? findForStatus(io.root, query) : null;
  const study = openOrNull(io);
  try {
    const print = (json: object, text: string): void => io.out(values.json ? `${JSON.stringify(json, null, 2)}\n` : `${text}\n`);
    if (!found) {
      const json = summaryJson(study, io.root);
      print(json, describeSummary(json));
    } else if (found.kind === "concept") {
      const json = conceptStatusJson(study, io.root, found.slug);
      print(json, describeConcept(json));
    } else {
      const json = itemStatusJson(study, io.root, found.target);
      print(json, describeItem(json));
    }
    return 0;
  } finally {
    study?.close();
  }
}

function recordCommand(args: string[], io: CliIo): number {
  const [what, ...rest] = args;
  if (what === "hint" || what === "give-up") {
    const { positionals } = parsed(() => parseArgs({ args: rest, strict: true, allowPositionals: true, options: {} }));
    const target = exactTarget(io.root, positionals[0]);
    return withStudy(io, (study) => {
      if (what === "give-up") {
        const result = giveUp(study, target.id);
        io.out(result.recorded ? `Recorded: ${target.id} given up (revealed).\n` : `Not recorded: ${target.id} has no open attempt (it is solved or revealed).\n`);
        return 0;
      }
      const result = recordHint(study, target.id);
      if (result.recorded) {
        io.out(`Recorded hint ${result.hints} for ${target.id}.\n`);
        return 0;
      }
      if (result.reason === "exam") {
        io.err(`Refused: ${target.id} is in an exam attempt, and exams take no hints.\n`);
        return 2;
      }
      io.out(`Not recorded: ${target.id} has no open attempt (it is solved or revealed).\n`);
      return 0;
    });
  }
  if (what === "complexity") {
    const { values, positionals } = parsed(() =>
      parseArgs({
        args: rest,
        strict: true,
        allowPositionals: true,
        options: {
          time: { type: "string" },
          space: { type: "string" },
          optimal: { type: "boolean", default: false },
          "not-optimal": { type: "boolean", default: false },
        },
      }),
    );
    const target = exactTarget(io.root, positionals[0]);
    if (target.kind !== "problem") throw new UsageError(`complexity is recorded for problems only (${target.id} is an exercise)`);
    const time = values.time;
    const space = values.space;
    if (!time || !space) throw new UsageError(`record complexity needs --time and --space\n\n${USAGE}`);
    if (values.optimal === values["not-optimal"]) throw new UsageError(`record complexity needs exactly one of --optimal and --not-optimal\n\n${USAGE}`);
    const optimal = values.optimal;
    return withStudy(io, (study) => {
      const result = recordComplexity(study, target.id, { time, space, optimal });
      if (!result.recorded) {
        io.err(`Not recorded: ${target.id} has no green attempt. The user's own run (pnpm test, pnpm watch or ▶ Run) records green.\n`);
        return 1;
      }
      io.out(`Recorded complexity for ${target.id}: time ${time}, space ${space}, ${optimal ? "optimal" : "not optimal"}.\n`);
      return 0;
    });
  }
  if (what === "explanation") {
    const { positionals } = parsed(() => parseArgs({ args: rest, strict: true, allowPositionals: true, options: {} }));
    const slug = positionals[0];
    if (!slug) throw new UsageError(`Give a concept slug.\n\n${USAGE}`);
    if (!scanRepo(io.root).concepts.some((concept) => concept.slug === slug)) throw new UsageError(`There is no concept "${slug}".`);
    return withStudy(io, (study) => {
      const result = acceptExplanation(study, slug);
      io.out(result.already ? `Already accepted on ${result.acceptedAt.toISOString().slice(0, 10)}: ${slug}.\n` : `Recorded: the ${slug} explanation is accepted.\n`);
      return 0;
    });
  }
  throw new UsageError(USAGE);
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
      case "status":
        return statusCommand(rest, io);
      case "record":
        return recordCommand(rest, io);
      case "today":
        // Plan B (the scheduler) replaces this command.
        io.err("pnpm today arrives with the scheduler (study coach, plan B).\n");
        return 2;
      default:
        throw new UsageError(USAGE);
    }
  } catch (error) {
    if (error instanceof QueryError) {
      const list = error.candidates.map((target) => `  ${target.id.padEnd(16)} ${target.title}`).join("\n");
      io.err(`${error.message}\n${list}${list ? "\n" : ""}`);
      return 1;
    }
    if (error instanceof UsageError || error instanceof StudySchemaOutdatedError || error instanceof MigrationError) {
      io.err(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
}
