import { and, asc, eq, isNotNull } from "drizzle-orm";
import { type Card, createEmptyCard, fsrs, generatorParameters, type Grade, Rating as FsrsRating, type State } from "ts-fsrs";
import { attempts, cards, type Outcome, pauses, type Rating } from "./schema.ts";
import type { StudyQueries } from "./store.ts";

/**
 * Spec §6.3, exactly. ts-fsrs 5.4.2 is deterministic even with fuzz on: the fuzz seed is the review time, reps and
 * difficulty × stability (DefaultInitSeedStrategy). Changing these means `pnpm study rebuild`; no history is lost.
 */
export const FSRS_PARAMS = generatorParameters({ request_retention: 0.85, maximum_interval: 180, enable_fuzz: true, enable_short_term: false });
export const scheduler = fsrs(FSRS_PARAMS);

const GRADES: Record<Rating, Grade> = { again: FsrsRating.Again, hard: FsrsRating.Hard, good: FsrsRating.Good, easy: FsrsRating.Easy };

export interface RatingInput {
  outcome: Outcome;
  hints: number;
  activeMs: number;
  /** attempt_stats.measured: enough events to trust activeMs. */
  measured: boolean;
  timeboxMinutes: number;
}

/**
 * The grade FSRS receives (spec §6.3): gave up → Again; hints, or alone over the time-box → Hard; alone within
 * the time-box → Good; alone in under half of it, with measured time → Easy. Unmeasured time is at best Good.
 */
export function rateAttempt(input: RatingInput): Rating {
  if (input.outcome === "gave_up") return "again";
  const box = input.timeboxMinutes * 60_000;
  if (input.hints > 0 || input.activeMs > box) return "hard";
  if (input.measured && input.activeMs < box / 2) return "easy";
  return "good";
}

/** A finished pause, in epoch milliseconds. Open pauses never shift cards until `resume` closes them. */
export interface PauseSpan {
  start: number;
  end: number;
}

/** Wall time to study time: time inside pauses does not count (spec §6.4). */
export function studyTime(at: number, spans: readonly PauseSpan[]): number {
  let paused = 0;
  for (const span of spans) if (span.start < at) paused += Math.min(at, span.end) - span.start;
  return at - paused;
}

export function totalPaused(spans: readonly PauseSpan[]): number {
  return spans.reduce((sum, span) => sum + (span.end - span.start), 0);
}

/** The columns of a `cards` row (spec §4, deliberate exception 1). */
export interface CardValues {
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

export interface RatedReview {
  at: Date;
  rating: Rating;
}

/**
 * Replays rated attempts (oldest first) in study time and maps the result back to wall time: every finished pause
 * moves both `due` and `last_review` by its length (spec §6.4). Null when there is nothing to replay.
 */
export function replayCard(reviews: readonly RatedReview[], spans: readonly PauseSpan[]): CardValues | null {
  if (reviews.length === 0) return null;
  const shift = totalPaused(spans);
  let card: Card = createEmptyCard(new Date(studyTime(reviews[0].at.getTime(), spans)));
  for (const review of reviews) card = scheduler.next(card, new Date(studyTime(review.at.getTime(), spans)), GRADES[review.rating]).card;
  return {
    due: new Date(card.due.getTime() + shift),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ? new Date(card.last_review.getTime() + shift) : null,
  };
}

/** Finished pauses, oldest first. */
export function pauseSpans(db: StudyQueries): PauseSpan[] {
  return db
    .select({ startedAt: pauses.startedAt, endedAt: pauses.endedAt })
    .from(pauses)
    .where(isNotNull(pauses.endedAt))
    .orderBy(asc(pauses.startedAt))
    .all()
    .map((row) => ({ start: row.startedAt.getTime(), end: row.endedAt!.getTime() }));
}

/** Rated attempts per item, each list in ended_at order: the card's whole history. */
function ratedReviews(db: StudyQueries, itemId?: string): Map<string, RatedReview[]> {
  const rows = db
    .select({ itemId: attempts.itemId, endedAt: attempts.endedAt, rating: attempts.rating })
    .from(attempts)
    .where(itemId === undefined ? isNotNull(attempts.rating) : and(isNotNull(attempts.rating), eq(attempts.itemId, itemId)))
    .orderBy(asc(attempts.endedAt), asc(attempts.id))
    .all();
  const byItem = new Map<string, RatedReview[]>();
  for (const row of rows) {
    const list = byItem.get(row.itemId) ?? [];
    list.push({ at: row.endedAt!, rating: row.rating! });
    byItem.set(row.itemId, list);
  }
  return byItem;
}

/** What `cards` must hold, computed from scratch: the source of truth the cache is checked against. */
export function replayAllCards(db: StudyQueries): Map<string, CardValues> {
  const spans = pauseSpans(db);
  const out = new Map<string, CardValues>();
  for (const [itemId, reviews] of ratedReviews(db)) out.set(itemId, replayCard(reviews, spans)!);
  return out;
}

function writeCard(db: StudyQueries, itemId: string, values: CardValues | null): void {
  if (!values) {
    db.delete(cards).where(eq(cards.itemId, itemId)).run();
    return;
  }
  db.insert(cards).values({ itemId, ...values }).onConflictDoUpdate({ target: cards.itemId, set: values }).run();
}

/** Rebuilds one problem's card from its rated attempts (the close seam calls this inside the closing transaction). */
export function rebuildCard(db: StudyQueries, itemId: string): CardValues | null {
  const values = replayCard(ratedReviews(db, itemId).get(itemId) ?? [], pauseSpans(db));
  writeCard(db, itemId, values);
  return values;
}

/** `pnpm study rebuild` and `study resume`: regenerates the whole cache. Returns how many cards it holds. */
export function rebuildAllCards(db: StudyQueries): number {
  const all = replayAllCards(db);
  db.delete(cards).run();
  for (const [itemId, values] of all) writeCard(db, itemId, values);
  return all.size;
}

/** The cache as stored. */
export function storedCards(db: StudyQueries): Map<string, CardValues> {
  return new Map(db.select().from(cards).all().map(({ itemId, ...values }) => [itemId, values]));
}

/** A cached card as ts-fsrs takes it. */
export function toFsrsCard(values: CardValues): Card {
  return {
    due: values.due,
    stability: values.stability,
    difficulty: values.difficulty,
    elapsed_days: 0,
    scheduled_days: values.scheduledDays,
    learning_steps: values.learningSteps,
    reps: values.reps,
    lapses: values.lapses,
    state: values.state as State,
    last_review: values.lastReview ?? undefined,
  };
}

/** The chance of recalling the item at `now` (return mode serves the highest first, spec §6.4). */
export function retrievability(values: CardValues, now: Date): number {
  return scheduler.get_retrievability(toFsrsCard(values), now, false);
}

/** Items whose cached card differs from a replay (`pnpm study rebuild --check`); empty when the cache is right. */
export function staleCards(db: StudyQueries): string[] {
  const stored = storedCards(db);
  const replayed = replayAllCards(db);
  const ids = new Set([...stored.keys(), ...replayed.keys()]);
  return [...ids].filter((id) => JSON.stringify(stored.get(id) ?? null) !== JSON.stringify(replayed.get(id) ?? null)).sort();
}
