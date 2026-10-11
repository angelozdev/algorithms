import { desc, eq, inArray, isNull } from "drizzle-orm";
import { scanRepo } from "../lib/repo.ts";
import type { Target } from "../runner/src/types.ts";
import {
  type AttemptKind,
  attempts,
  attemptStats,
  cards,
  conceptAcceptances,
  curriculumLog,
  type ItemStatusValue,
  itemStatusView,
  type Outcome,
  pauses,
  type Phase,
  phaseLog,
  profile,
} from "./schema.ts";
import type { InProgressItem } from "./state-file.ts";
import { openAttemptList } from "./open-attempts.ts";
import type { Study } from "./store.ts";

export interface OpenAttempt {
  attemptId: number;
  kind: AttemptKind;
  hints: number;
  startedAt: Date;
  examId: number | null;
}

/** Everything derived about one item (spec §4 views, §7). */
export interface ItemProgress {
  itemId: string;
  /** item_status; "todo" when the item has no attempts. */
  status: ItemStatusValue;
  everGreen: boolean;
  /** A past give-up (spec §8: replaces solution_revealed). */
  revealed: boolean;
  lastOutcome: Outcome | null;
  open: OpenAttempt | null;
  /** Hints of the open attempt, else of the latest attempt, else 0. */
  hints: number;
  /** cards.due; null until Plan B creates the item's card. */
  nextDue: Date | null;
}

export function emptyProgress(itemId: string): ItemProgress {
  return { itemId, status: "todo", everGreen: false, revealed: false, lastOutcome: null, open: null, hints: 0, nextDue: null };
}

/** Progress of every item with attempts or a card (or of `only` those ids), in one pass. */
export function allItemProgress(study: Study, only?: readonly string[]): Map<string, ItemProgress> {
  const progress = new Map<string, ItemProgress>();
  if (only && only.length === 0) return progress;
  const of = (itemId: string): ItemProgress => {
    let item = progress.get(itemId);
    if (!item) {
      item = emptyProgress(itemId);
      progress.set(itemId, item);
    }
    return item;
  };
  const ids = only ? [...only] : null;
  for (const row of study.db.select().from(itemStatusView).where(ids ? inArray(itemStatusView.itemId, ids) : undefined).all()) {
    Object.assign(of(row.itemId), { status: row.status, everGreen: row.everGreen, revealed: row.everGaveUp, lastOutcome: row.lastOutcome });
  }
  const attemptRows = study.db
    .select({
      itemId: attempts.itemId,
      attemptId: attempts.id,
      examId: attempts.examId,
      startedAt: attempts.startedAt,
      endedAt: attempts.endedAt,
      kind: attemptStats.kind,
      hints: attemptStats.hints,
    })
    .from(attempts)
    .innerJoin(attemptStats, eq(attemptStats.attemptId, attempts.id))
    .where(ids ? inArray(attempts.itemId, ids) : undefined)
    .orderBy(attempts.startedAt, attempts.id)
    .all();
  for (const row of attemptRows) {
    const item = of(row.itemId);
    item.hints = row.hints; // oldest first, so the latest attempt wins (an open attempt is always the latest)
    if (row.endedAt === null) item.open = { attemptId: row.attemptId, kind: row.kind, hints: row.hints, startedAt: row.startedAt, examId: row.examId };
  }
  for (const row of study.db.select({ itemId: cards.itemId, due: cards.due }).from(cards).where(ids ? inArray(cards.itemId, ids) : undefined).all()) {
    of(row.itemId).nextDue = row.due;
  }
  return progress;
}

export function itemProgress(study: Study, itemId: string): ItemProgress {
  return allItemProgress(study, [itemId]).get(itemId) ?? emptyProgress(itemId);
}

/** An exercise is done when its latest closed attempt ended green: solved alone, even after an earlier give-up (spec §6.1). */
export function exerciseDone(progress: ItemProgress): boolean {
  return progress.lastOutcome === "green";
}

export interface ConceptProgress {
  slug: string;
  accepted: boolean;
  acceptedAt: Date | null;
  /** Accepted, and every exercise done (spec §4 concept_acceptances, §6.1). */
  learned: boolean;
  exercises: { id: string; status: ItemStatusValue; done: boolean }[];
}

export function conceptProgress(
  study: Study,
  slug: string,
  exerciseIds: readonly string[],
  progress: Map<string, ItemProgress> = allItemProgress(study, exerciseIds),
): ConceptProgress {
  const accepted = study.db.select().from(conceptAcceptances).where(eq(conceptAcceptances.concept, slug)).get();
  const exercises = exerciseIds.map((id) => {
    const item = progress.get(id) ?? emptyProgress(id);
    return { id, status: item.status, done: exerciseDone(item) };
  });
  return {
    slug,
    accepted: accepted !== undefined,
    acceptedAt: accepted?.acceptedAt ?? null,
    learned: accepted !== undefined && exercises.every((exercise) => exercise.done),
    exercises,
  };
}

/** `pnpm -s study status <item> --json` (spec §7). */
export interface ItemStatusJson {
  initialized: boolean;
  id: string;
  kind: "problem" | "exercise";
  status: ItemStatusValue;
  everGreen: boolean;
  revealed: boolean;
  open: { kind: AttemptKind; hints: number; startedAt: string } | null;
  exam: boolean;
  concept: string | null;
  conceptLearned: boolean | null;
  nextDue: string | null;
}

/** `pnpm -s study status <concept> --json`. */
export interface ConceptStatusJson {
  initialized: boolean;
  id: string;
  kind: "concept";
  accepted: boolean;
  acceptedAt: string | null;
  learned: boolean;
  exercises: { id: string; status: ItemStatusValue; done: boolean }[];
}

/** `pnpm -s study status --json`. */
export interface SummaryJson {
  initialized: boolean;
  inProgress: InProgressItem[];
  solved: string[];
  revealed: string[];
  /** Ids with progress whose content no longer exists (spec §13). */
  orphans: string[];
  /** The scheduler's state (Plan B): read by the coach skill to know whether to onboard. */
  coach: CoachSummary;
}

/** `study status --json`'s `coach`: the preset in force, the phase, an open pause and the expansion list. */
export interface CoachSummary {
  /** A preset was set (`pnpm study curriculum set`): false means the coach still has to onboard the user. */
  started: boolean;
  preset: string | null;
  phase: Phase | null;
  paused: boolean;
  expansionList: string | null;
}

const NO_COACH: CoachSummary = { started: false, preset: null, phase: null, paused: false, expansionList: null };

/** Read straight from the tables (phase.ts imports this module, so it cannot be imported here). */
export function coachSummary(study: Study): CoachSummary {
  const preset = study.db.select({ preset: curriculumLog.preset }).from(curriculumLog).orderBy(desc(curriculumLog.id)).limit(1).get()?.preset ?? null;
  const phase = study.db.select({ phase: phaseLog.phase }).from(phaseLog).orderBy(desc(phaseLog.id)).limit(1).get()?.phase ?? null;
  const paused = study.db.select({ id: pauses.id }).from(pauses).where(isNull(pauses.endedAt)).get() !== undefined;
  const expansionList = study.db.select({ list: profile.expansionList }).from(profile).get()?.list ?? null;
  return { started: preset !== null && phase !== null, preset, phase, paused, expansionList };
}

const exercisesOf = (root: string, slug: string): string[] =>
  scanRepo(root)
    .exercises.filter((exercise) => exercise.concept === slug)
    .map((exercise) => exercise.folderId);

export function itemStatusJson(study: Study | null, root: string, target: Target): ItemStatusJson {
  const item = study ? itemProgress(study, target.id) : emptyProgress(target.id);
  const concept = target.kind === "exercise" ? target.id.split("/")[0] : null;
  return {
    initialized: study !== null,
    id: target.id,
    kind: target.kind,
    status: item.status,
    everGreen: item.everGreen,
    revealed: item.revealed,
    open: item.open ? { kind: item.open.kind, hints: item.open.hints, startedAt: item.open.startedAt.toISOString() } : null,
    exam: item.open !== null && item.open.examId !== null,
    concept,
    conceptLearned: concept === null ? null : study ? conceptProgress(study, concept, exercisesOf(root, concept)).learned : false,
    nextDue: item.nextDue?.toISOString() ?? null,
  };
}

export function conceptStatusJson(study: Study | null, root: string, slug: string): ConceptStatusJson {
  const ids = exercisesOf(root, slug);
  const concept = study
    ? conceptProgress(study, slug, ids)
    : { accepted: false, acceptedAt: null, learned: false, exercises: ids.map((id) => ({ id, status: "todo" as const, done: false })) };
  return {
    initialized: study !== null,
    id: slug,
    kind: "concept",
    accepted: concept.accepted,
    acceptedAt: concept.acceptedAt?.toISOString() ?? null,
    learned: concept.learned,
    exercises: concept.exercises,
  };
}

export function summaryJson(study: Study | null, root: string): SummaryJson {
  if (!study) return { initialized: false, inProgress: [], solved: [], revealed: [], orphans: [], coach: NO_COACH };
  const progress = [...allItemProgress(study).values()];
  const repo = scanRepo(root);
  const known = new Set([...repo.problems.map((p) => p.folderId), ...repo.exercises.map((e) => e.folderId), ...repo.concepts.map((c) => c.slug)]);
  const ids = [...progress.map((item) => item.itemId), ...study.db.select({ concept: conceptAcceptances.concept }).from(conceptAcceptances).all().map((row) => row.concept)];
  return {
    initialized: true,
    inProgress: openAttemptList(study),
    solved: progress.filter((item) => item.everGreen).map((item) => item.itemId).sort(),
    revealed: progress.filter((item) => item.revealed).map((item) => item.itemId).sort(),
    orphans: [...new Set(ids)].filter((id) => !known.has(id)).sort(),
    coach: coachSummary(study),
  };
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;
const NO_DATABASE = " (no study database yet)";

export function describeItem(json: ItemStatusJson): string {
  const parts = [json.id, json.status.replace("_", " ")];
  if (json.open) parts.push(`${json.open.kind} attempt, ${plural(json.open.hints, "hint")}`);
  if (json.revealed) parts.push("revealed before");
  parts.push(`next review: ${json.nextDue ?? "none"}`);
  return parts.join(" · ") + (json.initialized ? "" : NO_DATABASE);
}

export function describeConcept(json: ConceptStatusJson): string {
  const exercises = json.exercises.map((exercise) => `${exercise.id} ${exercise.done ? "done" : exercise.status.replace("_", " ")}`).join(", ");
  return (
    [json.id, `explanation ${json.accepted ? "accepted" : "not accepted"}`, json.learned ? "learned" : "not learned", `exercises: ${exercises || "none"}`].join(" · ") +
    (json.initialized ? "" : NO_DATABASE)
  );
}

export function describeSummary(json: SummaryJson): string {
  const open = json.inProgress.map((item) => `${item.id} (${item.kind}, ${plural(item.hints, "hint")})`).join(", ");
  return `In progress: ${open || "nothing"}. Orphans: ${json.orphans.join(", ") || "none"}.${json.initialized ? "" : NO_DATABASE}`;
}
