import { envClock } from "../../study/clock.ts";
import { recordWork, type WorkEvent } from "../../study/record.ts";
import type { EventSource } from "../../study/schema.ts";
import { cachedStudy } from "../../study/store.ts";
import { targetRoot } from "./paths.ts";
import { CaseFileError, loadCaseFile } from "./schema.ts";
import { renderStub } from "./stubs.ts";
import type { Lang, Target } from "./types.ts";

/** What happened to one piece of work: recorded, ignored by the lifecycle, off (no study database yet), or failed. */
export type Recording = { status: "recorded" | "ignored" | "off" } | { status: "failed"; message: string };

/** Same text up to line endings and trailing blanks: an editor that only reformats the stub has not started work. */
export function sameAsStub(code: string, stub: string): boolean {
  const normalize = (text: string): string => text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trimEnd();
  return normalize(code) === normalize(stub);
}

function differsFromStub(target: Target, lang: Lang, code: string): boolean {
  try {
    return !sameAsStub(code, renderStub(loadCaseFile(target.dir), lang));
  } catch (error) {
    if (error instanceof CaseFileError) return false; // no stub to compare with: only an open attempt takes the edit
    throw error;
  }
}

const warned = new Set<string>();

/** Recording never breaks a run or a save: a failure is one stderr line per distinct message and process. */
function report(result: Recording): Recording {
  if (result.status === "failed" && !warned.has(result.message)) {
    warned.add(result.message);
    process.stderr.write(`study: progress not recorded: ${result.message}\n`);
  }
  return result;
}

function record(target: Target, event: () => WorkEvent, source: EventSource): Recording {
  try {
    const study = cachedStudy(targetRoot(target), envClock());
    if (!study) return { status: "off" };
    return recordWork(study, target.id, event(), source).recorded ? { status: "recorded" } : { status: "ignored" };
  } catch (error) {
    return report({ status: "failed", message: (error as Error).message });
  }
}

/** A run of the user's code (spec §7): pnpm test, the run pnpm watch makes after a save, or ▶ Run in the playground. */
export function recordRun(target: Target, lang: Lang, green: boolean, source: EventSource): Recording {
  return record(target, () => ({ type: "run", lang, green }), source);
}

/** The solution changed on disk: `save` from the playground's editor, `edit` as pnpm watch sees it. */
export function recordSolutionChange(target: Target, lang: Lang, code: string, type: "edit" | "save", source: EventSource): Recording {
  return record(target, () => ({ type, lang, differsFromStub: differsFromStub(target, lang, code) }), source);
}
