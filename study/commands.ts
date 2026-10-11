import path from "node:path";
import { parseArgs } from "node:util";
import { scanRepo } from "../lib/repo.ts";
import { listTargets, QueryError, resolveQuery } from "../runner/src/resolver.ts";
import type { Lang, Target } from "../runner/src/types.ts";
import { listPresets, PresetError } from "./curriculum.ts";
import { backupStudy, exportStudy } from "./export.ts";
import { rebuildAllCards, staleCards, storedCards } from "./fsrs.ts";
import { pauseStudy, resumeStudy } from "./pause.ts";
import { type Phase, PHASES } from "./schema.ts";
import { startAttempt } from "./start.ts";
import { refreshState } from "./state.ts";
import { forcePhase, setCurriculum, setExpansionList } from "./switch.ts";
import { ackAnnouncement, curriculumStatus, describeToday, notInitialized, phaseStatus, today } from "./today.ts";
import type { Clock } from "./clock.ts";
import { initStudy, isTimezone } from "./init.ts";
import { applyMigration, describeAction, MigrationError, nothingToMigrate, planMigration } from "./migrate.ts";
import { acceptExplanation, giveUp, recordComplexity, recordHint } from "./record.ts";
import { conceptStatusJson, describeConcept, describeItem, describeSummary, itemStatusJson, summaryJson } from "./status.ts";
import { inTransaction, openStudy, type Study, StudyNotInitializedError, StudySchemaOutdatedError } from "./store.ts";

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
  pnpm today [--json] [--refresh]
  pnpm study ack <announcement> [--surface chat|ui]
  pnpm study start <id> [--lang py|ts]                        (the user's: archives the solution, opens a review)
  pnpm study pause | pnpm study resume                         (the user's)
  pnpm study phase [--json] | pnpm study phase set <phase>     (set: the user's)
  pnpm study curriculum [--json] | … set <preset> | … expand <list>   (set: only on the user's request)
  pnpm study export | pnpm study backup | pnpm study rebuild [--check]

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
        return todayCommand(rest, io);
      case "ack":
        return ackCommand(rest, io);
      case "start":
        return startCommand(rest, io);
      case "pause":
      case "resume":
        return pauseCommand(command, rest, io);
      case "phase":
        return phaseCommand(rest, io);
      case "curriculum":
        return curriculumCommand(rest, io);
      case "export":
        return exportCommand(rest, io);
      case "backup":
        return backupCommand(rest, io);
      case "rebuild":
        return rebuildCommand(rest, io);
      default:
        throw new UsageError(USAGE);
    }
  } catch (error) {
    if (error instanceof PresetError) {
      io.err(`${error.file} is not a valid preset:\n${error.issues.map((issue) => `  ${issue}`).join("\n")}\n`);
      return 1;
    }
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

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const NO_DATABASE_TEXT: Record<"init" | "migrate", string> = {
  init: "There is no study database yet. Run `pnpm study init`, then ask Claude \"¿qué me toca hoy?\".",
  migrate: "There is no study database yet, and this repo still has progress in its READMEs. Run `pnpm study migrate --dry-run`, then `pnpm study migrate`.",
};

/** `pnpm today [--json] [--refresh]` (spec §11): the chat surface (the coach skill and the terminal). */
function todayCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() =>
    parseArgs({ args, strict: true, options: { json: { type: "boolean", default: false }, refresh: { type: "boolean", default: false } } }),
  );
  const study = openOrNull(io);
  if (!study) {
    const missing = notInitialized(io.root);
    io.out(values.json ? json(missing) : `${NO_DATABASE_TEXT[missing.next]}\n`);
    return 0;
  }
  try {
    const plan = today(study, io.root, { surface: "chat", now: io.clock.now(), refresh: values.refresh });
    io.out(values.json ? json(plan) : `${describeToday(plan)}\n`);
    return 0;
  } finally {
    study.close();
  }
}

/** `pnpm study start <id> [--lang py|ts]` (the user's only, spec §7): Start review from the terminal. */
function startCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() => parseArgs({ args, strict: true, allowPositionals: true, options: { lang: { type: "string" } } }));
  if (values.lang !== undefined && values.lang !== "py" && values.lang !== "ts") throw new UsageError(`--lang must be py or ts (got "${values.lang}")`);
  const target = exactTarget(io.root, positionals[0]);
  return withStudy(io, (study) => {
    const result = startAttempt(study, io.root, target, io.clock.now(), { lang: values.lang as Lang | undefined });
    if (!result.started) {
      if (result.reason === "open") {
        io.out(`${target.id} already has an open attempt: go on with it.\n`);
        return 0;
      }
      io.err(`Nothing to start: ${target.id} was never tried. Its first attempt starts with your first edit or run.\n`);
      return 1;
    }
    const archived = result.archived.map((file) => displayPath(io.root, file));
    io.out(
      `Started a${result.kind === "exam" ? "n" : ""} ${result.kind} of ${target.id} from scratch.\n` +
        (archived.length ? `Archived: ${archived.join(", ")}.\n` : "") +
        `Fresh stub: ${result.solutions.map((file) => displayPath(io.root, file)).join(", ")}.\n`,
    );
    return 0;
  });
}

/** `pnpm study pause` / `pnpm study resume` (the user's only, spec §6.4). */
function pauseCommand(command: "pause" | "resume", args: string[], io: CliIo): number {
  parsed(() => parseArgs({ args, strict: true, options: {} }));
  return withStudy(io, (study) => {
    if (command === "pause") {
      const result = pauseStudy(study, io.clock.now());
      io.out(result.already ? `Already paused since ${result.since.toISOString()}.\n` : "Paused. Due dates wait for you; run `pnpm study resume` to go on.\n");
      return 0;
    }
    const result = resumeStudy(study, io.clock.now());
    const days = Math.round((result.pausedMs / 86_400_000) * 10) / 10;
    io.out(result.resumed ? `Resumed after ${days} day(s): every due date moved by the paused time.\n` : "Not paused.\n");
    return 0;
  });
}

/** `pnpm study phase [--json]` and `pnpm study phase set <phase>` (set: the user's only, spec §11). */
function phaseCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: "boolean", default: false } } }),
  );
  if (positionals[0] === "set") {
    const phase = positionals[1] as Phase;
    if (!PHASES.includes(phase)) throw new UsageError(`phase set takes one of ${PHASES.join(", ")}`);
    return withStudy(io, (study) => {
      const result = forcePhase(study, phase, io.clock.now());
      if (result.status === "not-started") {
        io.err("The coach has not started: run `pnpm study curriculum set <preset>` first.\n");
        return 1;
      }
      io.out(values.json ? json(result) : `Phase set to ${phase} (was ${result.from ?? "none"}).\n`);
      return 0;
    });
  }
  if (positionals.length > 0) throw new UsageError(USAGE);
  return withStudy(io, (study) => {
    const status = phaseStatus(study, io.root);
    if (values.json) io.out(json(status));
    else if (!status.started) io.out("The coach has not started: run `pnpm study curriculum set <preset>`.\n");
    else io.out(`Phase ${status.phase} since ${status.since!.slice(0, 10)} (${status.reason}) · ${status.preset} · ${status.progress.done}/${status.progress.total}\n`);
    return 0;
  });
}

/** `pnpm study curriculum [--json]`, `… set <preset>` and `… expand <list>` (spec §6.5; the coach runs set only when asked). */
function curriculumCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { json: { type: "boolean", default: false } } }),
  );
  const [action, name] = positionals;
  if (action === "set") {
    if (!name) throw new UsageError(`curriculum set needs a preset: ${listPresets(io.root).join(", ")}`);
    return withStudy(io, (study) => {
      const result = setCurriculum(study, io.root, name, io.clock.now());
      if (values.json) io.out(json(result));
      else if (result.status === "refused") {
        io.err(
          `Refused: the ${result.list} list is not imported (no problem has \`lists: [${result.list}]\`${result.size ? `; it has ${result.size} upstream` : ""}). ` +
            "Import it first, as Grind 75 was (docs/superpowers/plans/2026-10-04-grind-75-import-procedure.md). The current preset stays.\n",
        );
      } else if (result.status === "unchanged") io.out(`Already on ${result.preset}.\n`);
      else io.out(`${result.status === "started" ? "Started" : "Switched to"} ${result.preset}: phase ${result.phase}${result.previous ? ` (was ${result.previous.preset}, phase ${result.previous.phase})` : ""}.\n`);
      return result.status === "refused" ? 1 : 0;
    });
  }
  if (action === "expand") {
    if (!name) throw new UsageError("curriculum expand needs a list, one of the preset's expand.choose_from");
    return withStudy(io, (study) => {
      const result = setExpansionList(study, io.root, name);
      if (values.json) io.out(json(result));
      else if (result.status === "refused") io.err(`Refused: ${name} is not one of ${result.choices.join(", ") || "the preset's choices (start the coach first)"}.\n`);
      else io.out(`Expansion list: ${result.list} (${result.imported}${result.size ? ` of ${result.size}` : ""} imported).\n`);
      return result.status === "refused" ? 1 : 0;
    });
  }
  if (positionals.length > 0) throw new UsageError(USAGE);
  return withStudy(io, (study) => {
    const status = curriculumStatus(study, io.root);
    if (values.json) io.out(json(status));
    else {
      const rows = status.presets.map((p) => `  ${p.id === status.preset ? "*" : " "} ${p.id.padEnd(14)} ${p.imported}${p.size ? `/${p.size}` : ""} imported`);
      io.out(`${status.preset ? `Preset: ${status.preset} since ${status.since!.slice(0, 10)}` : "The coach has not started."}\n${rows.join("\n")}\n`);
    }
    return 0;
  });
}

/** `pnpm -s study ack <announcement> [--surface chat|ui]`: the coach acknowledges what it showed (spec §6.1). */
function ackCommand(args: string[], io: CliIo): number {
  const { values, positionals } = parsed(() =>
    parseArgs({ args, strict: true, allowPositionals: true, options: { surface: { type: "string", default: "chat" } } }),
  );
  const id = Number(positionals[0]);
  if (!Number.isInteger(id) || id <= 0) throw new UsageError("ack needs an announcement id (the `id` in pnpm -s today --json)");
  if (values.surface !== "chat" && values.surface !== "ui") throw new UsageError(`--surface must be chat or ui (got "${values.surface}")`);
  const surface = values.surface;
  return withStudy(io, (study) => {
    const result = ackAnnouncement(study, id, surface, io.clock.now());
    if (result === "unknown") {
      io.err(`There is no announcement ${id}.\n`);
      return 1;
    }
    io.out(result === "acked" ? `Acknowledged announcement ${id} (${surface}).\n` : `Announcement ${id} was already acknowledged (${surface}).\n`);
    return 0;
  });
}

/** `pnpm study export`: every table as JSON in .study/exports (spec §12). */
function exportCommand(args: string[], io: CliIo): number {
  parsed(() => parseArgs({ args, strict: true, options: {} }));
  return withStudy(io, (study) => {
    const file = exportStudy(study, io.clock.now());
    io.out(`Exported to ${displayPath(io.root, file)}.\n`);
    return 0;
  });
}

/** `pnpm study backup`: a copy of the database with VACUUM INTO, safe while it is in use (spec §12). */
function backupCommand(args: string[], io: CliIo): number {
  parsed(() => parseArgs({ args, strict: true, options: {} }));
  return withStudy(io, (study) => {
    const file = backupStudy(study, io.clock.now());
    io.out(`Backed up to ${displayPath(io.root, file)}.\n`);
    return 0;
  });
}

/** `pnpm study rebuild [--check]`: regenerates the cards cache by replay (spec §4), or only compares with --check. */
function rebuildCommand(args: string[], io: CliIo): number {
  const { values } = parsed(() => parseArgs({ args, strict: true, options: { check: { type: "boolean", default: false } } }));
  return withStudy(io, (study) => {
    if (values.check) {
      const stale = staleCards(study.db);
      if (stale.length === 0) {
        io.out(`The cards cache matches a replay (${storedCards(study.db).size} card(s)).\n`);
        return 0;
      }
      io.err(`The cards cache differs from a replay for: ${stale.join(", ")}. Run \`pnpm study rebuild\`.\n`);
      return 1;
    }
    const count = inTransaction(study, (tx) => rebuildAllCards(tx));
    refreshState(study);
    io.out(`Rebuilt ${count} card(s) from the rated attempts.\n`);
    return 0;
  });
}
