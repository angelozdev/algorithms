import { and, asc, desc, eq, gt, isNotNull } from "drizzle-orm";
import { seedFrom, shuffled } from "./random.ts";
import { attempts, exams, type Outcome, type Rating } from "./schema.ts";
import type { StudyQueries } from "./store.ts";

export interface ExamRow {
  id: number;
  list: string;
  seed: number;
  startedAt: Date;
}

export interface ExamTry {
  attemptId: number;
  endedAt: Date | null;
  outcome: Outcome | null;
  rating: Rating | null;
}

/** An exam as its attempts show it ("finished" is derived, spec §4). */
export interface ExamResult {
  exam: ExamRow;
  /** The list's problems in the exam's seeded order (spec §6.1). */
  order: string[];
  /** The try of each problem in this exam (exam attempts carry exam_id). */
  tries: Map<string, ExamTry>;
  /** Problems with no try yet, in exam order. */
  remaining: string[];
  /** Every problem has a closed try. */
  finished: boolean;
  /** Closed tries rated Good or Easy: solved alone within the time-box, first try. */
  successes: number;
  /** Closed tries that were not a success. */
  failures: string[];
  /** successes / problems (0 for an empty list). */
  rate: number;
}

/** The exam order: the problems shuffled by the exam's seed. */
export function examOrder(members: readonly string[], seed: number): string[] {
  return shuffled([...members].sort(), seed);
}

export function examsOf(db: StudyQueries, list: string): ExamRow[] {
  return db.select().from(exams).where(eq(exams.list, list)).orderBy(asc(exams.id)).all();
}

export function examResult(db: StudyQueries, exam: ExamRow, members: readonly string[]): ExamResult {
  const tries = new Map<string, ExamTry>();
  const rows = db
    .select({ itemId: attempts.itemId, attemptId: attempts.id, endedAt: attempts.endedAt, outcome: attempts.outcome, rating: attempts.rating })
    .from(attempts)
    .where(eq(attempts.examId, exam.id))
    .orderBy(asc(attempts.id))
    .all();
  for (const { itemId, ...row } of rows) if (!tries.has(itemId)) tries.set(itemId, row);
  const order = examOrder(members, exam.seed);
  const closed = order.filter((id) => tries.get(id)?.endedAt);
  const successes = closed.filter((id) => ["good", "easy"].includes(tries.get(id)!.rating ?? "")).length;
  return {
    exam,
    order,
    tries,
    remaining: order.filter((id) => !tries.has(id)),
    finished: order.length > 0 && closed.length === order.length,
    successes,
    failures: closed.filter((id) => !["good", "easy"].includes(tries.get(id)!.rating ?? "")),
    rate: order.length === 0 ? 0 : successes / order.length,
  };
}

/** The exam in progress for `list`: the latest one, unless it is finished. */
export function openExam(db: StudyQueries, list: string, members: readonly string[]): ExamResult | null {
  const latest = db.select().from(exams).where(eq(exams.list, list)).orderBy(desc(exams.id)).limit(1).get();
  if (!latest) return null;
  const result = examResult(db, latest, members);
  return result.finished ? null : result;
}

/** Every failed problem of the exam was solved green after its try (spec §6.1: "every failure re-solved later"). */
export function failuresResolved(db: StudyQueries, result: ExamResult): boolean {
  return result.failures.every((itemId) => {
    const failedAt = result.tries.get(itemId)!.endedAt!;
    const later = db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.itemId, itemId), eq(attempts.outcome, "green"), isNotNull(attempts.endedAt), gt(attempts.endedAt, failedAt)))
      .limit(1)
      .get();
    return later !== undefined;
  });
}

/** Spec §6.1, phase 2: a finished exam at or above `threshold` whose failures were all solved later. */
export function examPassed(db: StudyQueries, list: string, members: readonly string[], threshold: number): boolean {
  return examsOf(db, list).some((exam) => {
    const result = examResult(db, exam, members);
    return result.finished && result.rate >= threshold && failuresResolved(db, result);
  });
}

/** Whether some finished exam already reached the threshold: then no new exam starts, the failures come back as reviews. */
export function rateReached(db: StudyQueries, list: string, members: readonly string[], threshold: number): boolean {
  return examsOf(db, list).some((exam) => {
    const result = examResult(db, exam, members);
    return result.finished && result.rate >= threshold;
  });
}

/** Starts an exam of `list`; the seed comes from the list, the local date and how many exams came before it. */
export function createExam(db: StudyQueries, list: string, at: Date, date: string): ExamRow {
  const before = examsOf(db, list).length;
  return db.insert(exams).values({ list, seed: seedFrom(`${list}:${date}:${before}`), startedAt: at }).returning().get();
}
