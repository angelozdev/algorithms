import { and, asc, count, eq, gte, inArray, isNull } from "drizzle-orm";
import type { Lang } from "../runner/src/types.ts";
import { loadCatalog } from "./catalog.ts";
import { localDate } from "./days.ts";
import { announcementAcks, announcements, attempts, curriculumLog, dailyPlans, PLAN_MODES, PLAN_SLOTS, pauses, planItems, profile } from "./schema.ts";
import type { TodaySummary } from "./state-file.ts";
import { conceptProgress } from "./status.ts";
import type { Study, StudyQueries } from "./store.ts";

export type PlanMode = (typeof PLAN_MODES)[number];
export type PlanSlot = (typeof PLAN_SLOTS)[number];

export interface ProfileSettings {
  dailyMinutes: number;
  timezone: string;
  language: Lang;
}

/** The profile (spec §4), or the defaults `study init` would write when it is missing. */
export function readProfile(db: StudyQueries): ProfileSettings {
  const row = db.select().from(profile).get();
  return { dailyMinutes: row?.dailyMinutes ?? 45, timezone: row?.timezone ?? "UTC", language: row?.language ?? "py" };
}

export interface StoredItem {
  position: number;
  /** A problem or exercise id; a concept slug for the concept slot. */
  itemId: string;
  slot: PlanSlot;
  pattern: string | null;
  blockIndex: number | null;
}

export interface StoredPlan {
  date: string;
  mode: PlanMode;
  createdAt: Date;
  items: StoredItem[];
}

/** The plan stored for a local date (spec §6.2: stable within the day), or null. */
export function storedPlan(db: StudyQueries, date: string): StoredPlan | null {
  const plan = db.select().from(dailyPlans).where(eq(dailyPlans.localDate, date)).get();
  if (!plan) return null;
  const items = db
    .select({ position: planItems.position, itemId: planItems.itemId, slot: planItems.slot, pattern: planItems.pattern, blockIndex: planItems.blockIndex })
    .from(planItems)
    .where(eq(planItems.localDate, date))
    .orderBy(asc(planItems.position))
    .all();
  return { date, mode: plan.mode, createdAt: plan.createdAt, items };
}

/**
 * Which planned items are done: a problem or exercise has an attempt that closed after the plan was made (green or
 * given up); a concept is learned (spec §6.1).
 */
export function itemsDone(study: Study, plan: StoredPlan): boolean[] {
  const ids = plan.items.filter((item) => item.slot !== "concept").map((item) => item.itemId);
  const closed = new Set(
    ids.length === 0
      ? []
      : study.db
          .select({ itemId: attempts.itemId })
          .from(attempts)
          .where(and(inArray(attempts.itemId, ids), gte(attempts.endedAt, plan.createdAt)))
          .all()
          .map((row) => row.itemId),
  );
  const catalog = study.root && plan.items.some((item) => item.slot === "concept") ? loadCatalog(study.root) : null;
  return plan.items.map((item) => {
    if (item.slot !== "concept") return closed.has(item.itemId);
    const concept = catalog?.concepts.get(item.itemId);
    return concept !== undefined && conceptProgress(study, item.itemId, concept.exercises).learned;
  });
}

/**
 * state.json's `today` (Plan A's TodaySummary, filled here): null until the coach starts. Read straight from the
 * tables, because state.ts imports this module and the scheduler's modules import state.ts.
 */
export function todaySummary(study: Study): TodaySummary | null {
  if (!study.db.select({ id: curriculumLog.id }).from(curriculumLog).limit(1).get()) return null;
  const date = localDate(study.clock.now(), readProfile(study.db).timezone);
  const plan = storedPlan(study.db, date);
  const paused = study.db.select({ id: pauses.id }).from(pauses).where(isNull(pauses.endedAt)).get() !== undefined;
  const pending = study.db
    .select({ n: count() })
    .from(announcements)
    .leftJoin(announcementAcks, and(eq(announcementAcks.announcementId, announcements.id), eq(announcementAcks.surface, "ui")))
    .where(isNull(announcementAcks.announcementId))
    .get()!.n;
  return { date, planned: plan?.items.length ?? 0, done: plan ? itemsDone(study, plan).filter(Boolean).length : 0, paused, announcements: pending };
}
