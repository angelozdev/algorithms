import { existsSync } from "node:fs";
import path from "node:path";
import { and, asc, eq, isNull, lt, max } from "drizzle-orm";
import { LEGACY_PERSONAL_FIELDS } from "../lib/schemas.ts";
import { scanRepo } from "../lib/repo.ts";
import { itemTitle, listMembers } from "./catalog.ts";
import { type ListImport, listImport, timeboxMinutes } from "./curriculum.ts";
import { daysBetween, localDate, localDay } from "./days.ts";
import { examResult, examsOf, openExam } from "./exam.ts";
import { openPause } from "./pause.ts";
import { type CoachContext, conceptLearned, currentCurriculum, currentPhase, expansionWindow, learnedProblems, loadContext, syncPhase } from "./phase.ts";
import { CONCEPT_MINUTES, dueCards, ensurePlan, loadFacts, problemMinutes, REVIEW_FACTOR } from "./plan.ts";
import { itemsDone, readProfile, type StoredItem, type StoredPlan } from "./plan-store.ts";
import { announcementAcks, announcements, attemptEvents, curriculumLog, type Phase, phaseLog, type SURFACES } from "./schema.ts";
import { storedCards } from "./fsrs.ts";
import { refreshState } from "./state.ts";
import type { Study, StudyQueries } from "./store.ts";

export type Surface = (typeof SURFACES)[number];

export interface TodayItem {
  kind: "continue" | "review" | "new" | "concept" | "exam";
  /** A problem or exercise id; a concept slug for kind concept. */
  id: string;
  title: string;
  minutes: number;
  reason: string;
  /** Closed since the plan was made (a concept: learned). */
  done: boolean;
  /** The content is not in the repo: a concept note the `concept` skill has not created yet, or an orphan. */
  missing: boolean;
}

export interface TodayPhase {
  id: Phase;
  /** ISO time of the phase_log row. */
  since: string;
  preset: string;
  progress: { done: number; total: number };
  /** The list this phase works on (learn, master: the preset's; expand: the expansion list), with how much is imported. */
  list: ListImport | null;
  /** Phase 3 only: the expansion list (null until the coach stores the user's choice) and the choices. */
  expansion: { list: string | null; choices: string[] } | null;
}

export interface AnnouncementJson {
  id: number;
  key: "coach-started" | "phase-advanced" | "phase-set" | "curriculum-switched" | "welcome-back";
  at: string;
  payload: Record<string, unknown>;
}

/** `pnpm -s today --json` (spec §11) and GET /api/study/today. */
export interface TodayJson {
  initialized: true;
  /** False until `pnpm study curriculum set <preset>` (the coach's onboarding) starts the coach. */
  started: boolean;
  date: string;
  paused: { since: string } | null;
  phase: TodayPhase | null;
  /** Not yet acknowledged on the asking surface (chat or ui). */
  announcements: AnnouncementJson[];
  mode: "normal" | "return" | "catch-up";
  items: TodayItem[];
  /** Due reviews left out of today's plan; `days` at today's review capacity. */
  backlog: { waiting: number; days: number };
  budget: { minutes: number; planned: number };
}

/** No study database yet (spec §13): `next` says which command the user runs. */
export interface NotInitializedJson {
  initialized: false;
  next: "init" | "migrate";
}

/** A repo with progress in its READMEs or solution files in content folders needs `migrate`; a fresh clone `init`. */
export function notInitialized(root: string): NotInitializedJson {
  const repo = scanRepo(root);
  const legacy =
    repo.problems.some((p) => LEGACY_PERSONAL_FIELDS.problem.some((field) => field in p.data) || ["py", "ts"].some((lang) => existsSync(path.join(p.dir, `solution.${lang}`)))) ||
    repo.exercises.some((e) => LEGACY_PERSONAL_FIELDS.exercise.some((field) => field in e.data)) ||
    repo.concepts.some((c) => LEGACY_PERSONAL_FIELDS.concept.some((field) => field in c.data));
  return { initialized: false, next: legacy ? "migrate" : "init" };
}

function lastBefore<T extends { id: number }>(rows: T[], id: number): T | undefined {
  return rows.filter((row) => row.id < id).at(-1);
}

/** The message of an announcement is rendered from the rows it references (spec §4). */
function announcementJson(db: StudyQueries, row: typeof announcements.$inferSelect): AnnouncementJson {
  const at = row.at.toISOString();
  const phases = db.select().from(phaseLog).orderBy(asc(phaseLog.id)).all();
  const curricula = db.select().from(curriculumLog).orderBy(asc(curriculumLog.id)).all();
  if (row.kind === "return") {
    const last = db.select({ at: max(attemptEvents.at) }).from(attemptEvents).where(lt(attemptEvents.at, row.at)).get()?.at;
    const daysAway = last ? Math.floor((row.at.getTime() - last.getTime()) / 86_400_000) : 0;
    return { id: row.id, key: "welcome-back", at, payload: { date: row.localDate, daysAway } };
  }
  const phase = phases.find((p) => p.id === row.phaseLogId)!;
  const before = lastBefore(phases, phase.id);
  if (row.kind === "switch") {
    const curriculum = curricula.find((c) => c.id === row.curriculumLogId)!;
    return {
      id: row.id,
      key: "curriculum-switched",
      at,
      payload: { from: { preset: lastBefore(curricula, curriculum.id)?.preset ?? null, phase: before?.phase ?? null }, to: { preset: curriculum.preset, phase: phase.phase } },
    };
  }
  if (phase.reason === "forced") return { id: row.id, key: "phase-set", at, payload: { from: before?.phase ?? null, to: phase.phase } };
  if (!before) return { id: row.id, key: "coach-started", at, payload: { preset: curricula.find((c) => c.id === phase.curriculumLogId)?.preset ?? null, phase: phase.phase } };
  return { id: row.id, key: "phase-advanced", at, payload: { from: before.phase, to: phase.phase } };
}

/** Announcements the surface has not acknowledged yet, oldest first (spec §6.1). */
export function pendingAnnouncements(db: StudyQueries, surface: Surface): AnnouncementJson[] {
  return db
    .select({ announcement: announcements })
    .from(announcements)
    .leftJoin(announcementAcks, and(eq(announcementAcks.announcementId, announcements.id), eq(announcementAcks.surface, surface)))
    .where(isNull(announcementAcks.announcementId))
    .orderBy(asc(announcements.id))
    .all()
    .map(({ announcement }) => announcementJson(db, announcement));
}

/** `pnpm -s study ack <id>` (chat) and POST /api/study/ack/:id (ui): one row per surface (spec §4). */
export function ackAnnouncement(study: Study, id: number, surface: Surface, now: Date): "acked" | "already" | "unknown" {
  if (!study.db.select({ id: announcements.id }).from(announcements).where(eq(announcements.id, id)).get()) return "unknown";
  const inserted = study.db.insert(announcementAcks).values({ announcementId: id, surface, at: now }).onConflictDoNothing().returning().get();
  refreshState(study); // state.json counts the announcements the playground has not acknowledged
  return inserted ? "acked" : "already";
}

const PLURAL = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Phase progress (spec §11 `phase.progress`): what the phase's exit criteria count. */
function phaseProgress(study: Study, ctx: CoachContext, phase: Phase): { done: number; total: number } {
  switch (phase) {
    case "bases": {
      const concepts = ctx.preset.phases.bases.concepts;
      return { done: concepts.filter((slug) => conceptLearned(study, ctx, slug)).length, total: concepts.length };
    }
    case "learn": {
      const { members, learned } = learnedProblems(study, ctx);
      return { done: learned.length, total: members.length };
    }
    case "master": {
      const list = ctx.preset.phases.master.list;
      const members = listMembers(ctx.catalog, list).map((p) => p.id);
      const exam = openExam(study.db, list, members) ?? (examsOf(study.db, list).length > 0 ? examResult(study.db, examsOf(study.db, list).at(-1)!, members) : null);
      return { done: exam ? exam.order.length - exam.remaining.length : 0, total: members.length };
    }
    case "expand": {
      const window = expansionWindow(study, ctx);
      return { done: window.results.filter(Boolean).length, total: window.window };
    }
    case "pro":
      return { done: 0, total: 0 };
  }
}

function itemJson(study: Study, ctx: CoachContext, phase: Phase, item: StoredItem, done: boolean, day: string): TodayItem {
  const title = itemTitle(ctx.catalog, item.itemId);
  const base = { id: item.itemId, title: title ?? item.itemId, done, missing: title === null };
  if (item.slot === "concept") {
    const bases = ctx.preset.phases.bases.concepts;
    const reason = item.pattern ? `opens ${item.pattern}` : `bases ${bases.indexOf(item.itemId) + 1}/${bases.length}`;
    return { ...base, kind: "concept", minutes: CONCEPT_MINUTES, reason };
  }
  const exercise = ctx.catalog.exercises.get(item.itemId);
  if (item.slot === "continue") {
    const where = exercise ? exercise.concept : (ctx.catalog.problems.get(item.itemId)?.pattern ?? "");
    const minutes = exercise ? timeboxMinutes(ctx.preset, "easy") : problemMinutes(ctx, item.itemId);
    return { ...base, kind: "continue", minutes, reason: `in progress${where ? ` · ${where}` : ""}` };
  }
  if (item.slot === "review") {
    const card = storedCards(study.db).get(item.itemId);
    const late = card ? daysBetween(localDate(card.due, readProfile(study.db).timezone), day) : 0;
    const reason = late <= 0 ? "due today" : late === 1 ? "due yesterday" : `due ${late} days ago`;
    return { ...base, kind: "review", minutes: problemMinutes(ctx, item.itemId, REVIEW_FACTOR), reason };
  }
  const minutes = problemMinutes(ctx, item.itemId);
  if (item.blockIndex !== null && item.pattern) {
    const size = Math.min(ctx.preset.phases.learn.block, listMembers(ctx.catalog, ctx.preset.phases.learn.list).filter((p) => p.pattern === item.pattern).length);
    return { ...base, kind: "new", minutes, reason: `block ${item.blockIndex}/${Math.max(size, item.blockIndex)} · ${item.pattern}` };
  }
  if (item.pattern) return { ...base, kind: "new", minutes, reason: `mix · ${item.pattern}` };
  if (phase === "master") {
    const list = ctx.preset.phases.master.list;
    const exam = examsOf(study.db, list).at(-1);
    if (exam) {
      const order = examResult(study.db, exam, listMembers(ctx.catalog, list).map((p) => p.id)).order;
      return { ...base, kind: "exam", minutes, reason: `exam ${order.indexOf(item.itemId) + 1}/${order.length}` };
    }
  }
  return { ...base, kind: "new", minutes, reason: phase === "expand" && ctx.expansionList ? `expand · ${ctx.expansionList}` : "practice" };
}

/**
 * `pnpm today` and the playground's Today section (spec §6, §11): evaluates the phase criteria, makes or reads
 * today's stored plan, and renders it with the announcements the surface has not acknowledged.
 */
export function today(study: Study, root: string, options: { surface: Surface; now: Date; refresh?: boolean }): TodayJson {
  const { now } = options;
  syncPhase(study, root, now);
  const plan: StoredPlan | null = ensurePlan(study, root, now, { refresh: options.refresh });
  const profile = readProfile(study.db);
  const day = localDay(now, profile.timezone);
  const curriculum = currentCurriculum(study.db);
  const phaseRow = currentPhase(study.db);
  const pause = openPause(study.db);
  const json: TodayJson = {
    initialized: true,
    started: curriculum !== null && phaseRow !== null,
    date: day.date,
    paused: pause ? { since: pause.startedAt.toISOString() } : null,
    phase: null,
    announcements: pendingAnnouncements(study.db, options.surface),
    mode: "normal",
    items: [],
    backlog: { waiting: 0, days: 0 },
    budget: { minutes: profile.dailyMinutes, planned: 0 },
  };
  if (!curriculum || !phaseRow) return json;
  const ctx = loadContext(study, root, curriculum.preset);
  const phase = phaseRow.phase;
  const listId = phase === "learn" ? ctx.preset.phases.learn.list : phase === "master" ? ctx.preset.phases.master.list : phase === "expand" ? ctx.expansionList : null;
  json.phase = {
    id: phase,
    since: phaseRow.at.toISOString(),
    preset: curriculum.preset,
    progress: phaseProgress(study, ctx, phase),
    list: listId ? listImport(root, ctx.catalog, listId) : null,
    expansion: phase === "expand" ? { list: ctx.expansionList, choices: ctx.preset.phases.expand.choose_from } : null,
  };
  if (!plan) return json;
  const done = itemsDone(study, plan);
  json.mode = plan.mode === "catch_up" ? "catch-up" : plan.mode;
  json.items = plan.items.map((item, i) => itemJson(study, ctx, phase, item, done[i], day.date));
  json.budget.planned = json.items.reduce((sum, item) => sum + item.minutes, 0);
  const planned = new Set(plan.items.map((item) => item.itemId));
  const waiting = dueCards(study.db, ctx, loadFacts(study.db), day.end).filter(({ itemId }) => !planned.has(itemId)).length;
  const capacity = Math.max(1, plan.items.filter((item) => item.slot === "review").length);
  json.backlog = { waiting, days: Math.ceil(waiting / capacity) };
  return json;
}

const PHASE_NAMES: Record<Phase, string> = { bases: "0 · Bases", learn: "1 · Learn the list", master: "2 · Master the list", expand: "3 · Expand", pro: "4 · Pro" };

/** `pnpm today` without --json: the same plan as text. */
export function describeToday(json: TodayJson): string {
  if (!json.started) return "The coach has not started yet. Ask Claude \"¿qué me toca hoy?\", or run `pnpm study curriculum set grind-75`.";
  const lines: string[] = [];
  const phase = json.phase!;
  lines.push(`${json.date} · phase ${PHASE_NAMES[phase.id]} (${phase.progress.done}/${phase.progress.total}) · ${phase.preset}${json.mode === "normal" ? "" : ` · ${json.mode}`}`);
  for (const a of json.announcements) lines.push(`! [${a.id}] ${a.key} ${JSON.stringify(a.payload)}`);
  if (json.paused) {
    lines.push(`Paused since ${json.paused.since.slice(0, 10)}. Run \`pnpm study resume\` to go on.`);
    return lines.join("\n");
  }
  json.items.forEach((item, i) => lines.push(`${i + 1}. ${item.done ? "✓" : " "} [${item.kind}] ${item.id} ${item.title} · ${item.minutes} min · ${item.reason}${item.missing ? " (not in the repo yet)" : ""}`));
  if (json.items.length === 0) lines.push("Nothing planned today.");
  if (json.backlog.waiting > 0) lines.push(`Backlog: ${PLURAL(json.backlog.waiting, "review")} waiting (about ${PLURAL(json.backlog.days, "day")}).`);
  return lines.join("\n");
}
