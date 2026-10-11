import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { historyPath, studySolutionPath } from "../runner/src/paths.ts";
import { sameAsStub } from "../runner/src/recording.ts";
import { loadCaseFile } from "../runner/src/schema.ts";
import { renderStub, solutionPath } from "../runner/src/stubs.ts";
import { type Lang, LANGS, type Target } from "../runner/src/types.ts";
import { listMembers, loadCatalog, readProblem } from "./catalog.ts";
import { timeboxMinutes, tryLoadPreset } from "./curriculum.ts";
import { localDay } from "./days.ts";
import { openExam } from "./exam.ts";
import { storedCards } from "./fsrs.ts";
import { currentCurriculum, currentPhase } from "./phase.ts";
import { REVIEW_FACTOR } from "./plan.ts";
import { readProfile } from "./plan-store.ts";
import { AttemptAlreadyOpenError, openAttempt } from "./record.ts";
import { refreshState } from "./state.ts";
import { itemProgress } from "./status.ts";
import { inTransaction, type Study } from "./store.ts";

export type GateKind = "review" | "exam" | "retry";

/** "Start review" (spec §7): shown instead of the editor until the user starts the attempt from scratch. */
export interface Gate {
  kind: GateKind;
  /** The estimate: a review 0.6 of the time-box, an exam the whole time-box, a retried exercise an easy one's. */
  minutes: number;
  /** The exam the attempt joins (kind exam). */
  examId: number | null;
}

/**
 * The gate of an item now, or null when its editor opens as usual:
 * - none while an attempt is open;
 * - exam: phase 2, and the item is in the open exam with no try yet;
 * - review: a problem whose card is due today;
 * - retry: an exercise whose latest attempt was given up (it is not done until it is solved again, spec §6.1).
 */
export function startGate(study: Study, root: string, itemId: string, now: Date): Gate | null {
  const progress = itemProgress(study, itemId);
  if (progress.open) return null;
  const curriculum = currentCurriculum(study.db);
  const preset = tryLoadPreset(root, curriculum?.preset ?? null);
  const minutes = (factor: number) => Math.round(timeboxMinutes(preset, readProblem(root, itemId)?.difficulty ?? null) * factor);
  if (itemId.includes("/")) return progress.lastOutcome === "gave_up" ? { kind: "retry", minutes: timeboxMinutes(preset, "easy"), examId: null } : null;
  if (preset && currentPhase(study.db)?.phase === "master") {
    const list = preset.phases.master.list;
    const exam = openExam(study.db, list, listMembers(loadCatalog(root), list).map((p) => p.id));
    if (exam?.remaining.includes(itemId)) return { kind: "exam", minutes: minutes(1), examId: exam.exam.id };
  }
  const card = storedCards(study.db).get(itemId);
  const end = localDay(now, readProfile(study.db).timezone).end;
  return card && card.due.getTime() < end.getTime() ? { kind: "review", minutes: minutes(REVIEW_FACTOR), examId: null } : null;
}

export type StartResult =
  | { started: true; attemptId: number; kind: GateKind; examId: number | null; archived: string[]; solutions: string[] }
  /** open: an attempt is already open; new: the item was never tried, and its first attempt starts with real work. */
  | { started: false; reason: "open" | "new" };

/** Moves a file, verifying the copy's bytes before deleting the original; never overwrites history. */
function archive(file: string, dest: string): void {
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(file, dest, constants.COPYFILE_EXCL);
  if (!readFileSync(dest).equals(readFileSync(file))) throw new Error(`archiving ${file} failed: the copy differs`);
  unlinkSync(file);
}

/**
 * Archives each current solution to history/<timestamp>.<lang> (a solution equal to the stub is just removed), then
 * writes a fresh stub in every language that had a solution (or `lang`, or the profile's language). Never overwrites
 * history: a clash throws EEXIST before anything is deleted. Start review and the item reset share it.
 */
export function freshStubs(study: Study, target: Target, now: Date, options: { lang?: Lang } = {}): { archived: string[]; solutions: string[] } {
  const caseFile = loadCaseFile(target.dir);
  const archived: string[] = [];
  const langs = new Set<Lang>(options.lang ? [options.lang] : []);
  for (const lang of LANGS) {
    const file = solutionPath(target, lang);
    if (!existsSync(file)) continue;
    langs.add(lang);
    if (sameAsStub(readFileSync(file, "utf8"), renderStub(caseFile, lang))) {
      unlinkSync(file);
      continue;
    }
    const dest = historyPath(target, lang, now);
    archive(file, dest);
    archived.push(dest);
  }
  if (langs.size === 0) langs.add(readProfile(study.db).language);
  const solutions = [...langs].map((lang) => {
    const file = studySolutionPath(target, lang);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, renderStub(caseFile, lang));
    return file;
  });
  return { archived, solutions };
}

/**
 * `POST /api/study/start/<id>` and the user's `pnpm study start <id>` (spec §7, "Start review, from scratch"):
 * 1–2. `freshStubs`.
 * 3. opens the attempt, joining the open exam when the gate says so.
 * Items that were never tried are refused. Claude never runs this: the hook denies `study start` and the route.
 */
export function startAttempt(study: Study, root: string, target: Target, now: Date, options: { lang?: Lang } = {}): StartResult {
  const progress = itemProgress(study, target.id);
  if (progress.open) return { started: false, reason: "open" };
  const gate = startGate(study, root, target.id, now);
  if (!gate && progress.status === "todo") return { started: false, reason: "new" };
  const { archived, solutions } = freshStubs(study, target, now, options);
  try {
    const attemptId = inTransaction(study, (tx) => openAttempt(tx, target.id, now, { examId: gate?.examId ?? undefined }));
    refreshState(study);
    return { started: true, attemptId, kind: gate?.kind ?? (target.kind === "problem" ? "review" : "retry"), examId: gate?.examId ?? null, archived, solutions };
  } catch (error) {
    if (error instanceof AttemptAlreadyOpenError) return { started: false, reason: "open" };
    throw error;
  }
}
