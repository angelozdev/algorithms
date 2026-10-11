import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { studySolutionDir } from "../runner/src/paths.ts";
import type { Target } from "../runner/src/types.ts";
import { rebuildCard } from "./fsrs.ts";
import { attemptEvents, attempts, attemptStats, complexityNotes } from "./schema.ts";
import { freshStubs } from "./start.ts";
import { refreshState } from "./state.ts";
import { itemProgress } from "./status.ts";
import { inTransaction, type Study, type StudyTx } from "./store.ts";

/** The three resets of an item (item reset spec §3): clean the code, discard the open attempt, erase everything. */
export const RESET_ACTIONS = ["code", "attempt", "all"] as const;
export type ResetAction = (typeof RESET_ACTIONS)[number];

/** What each reset would cost (spec §4), for the playground's dialogs and the CLI's summary. */
export interface ResetPreview {
  /** The open attempt: its hints and active minutes (rounded), or null. */
  open: { hints: number; minutes: number } | null;
  /** Every attempt of the item, and their hints in total. */
  attempts: number;
  hints: number;
  /** Files in the item's history/ folder. */
  versions: number;
  /** Spec R6: the item has an exam attempt, so attempt and all are refused. */
  examLocked: boolean;
}

export type ResetResult =
  | { reset: true; action: ResetAction; archived: string[]; solutions: string[]; before: ResetPreview }
  /** exam: the item has an exam attempt (spec R6); no-open-attempt: there is nothing to discard. */
  | { reset: false; reason: "exam" | "no-open-attempt" };

export function resetPreview(study: Study, target: Target): ResetPreview {
  const rows = study.db
    .select({ attemptId: attemptStats.attemptId, hints: attemptStats.hints, activeMs: attemptStats.activeMs })
    .from(attemptStats)
    .where(eq(attemptStats.itemId, target.id))
    .all();
  const open = itemProgress(study, target.id).open;
  const openRow = open ? rows.find((row) => row.attemptId === open.attemptId) : undefined;
  const history = path.join(studySolutionDir(target), "history");
  const examAttempt = study.db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.itemId, target.id), isNotNull(attempts.examId)))
    .limit(1)
    .get();
  return {
    open: open ? { hints: open.hints, minutes: Math.round((openRow?.activeMs ?? 0) / 60_000) } : null,
    attempts: rows.length,
    hints: rows.reduce((sum, row) => sum + row.hints, 0),
    versions: existsSync(history) ? readdirSync(history).length : 0,
    examLocked: examAttempt !== undefined,
  };
}

/** Deletes attempts and what hangs off them, children first: every foreign key is ON DELETE NO ACTION. */
function deleteAttempts(tx: StudyTx, ids: number[]): void {
  if (ids.length === 0) return;
  tx.delete(attemptEvents).where(inArray(attemptEvents.attemptId, ids)).run();
  tx.delete(complexityNotes).where(inArray(complexityNotes.attemptId, ids)).run();
  tx.delete(attempts).where(inArray(attempts.id, ids)).run();
}

/**
 * `pnpm study reset` and `POST /api/study/reset/<id>` (item reset spec §3). The user's only: the hook denies both
 * to Claude.
 * - code: archive and stub (`freshStubs`); attempts untouched.
 * - attempt: archive and stub, then delete the open attempt; the item falls back to what its other attempts say.
 * - all: delete every attempt, rebuild (drop) the card, then remove the item's solution folder, history included.
 */
export function resetItem(study: Study, target: Target, action: ResetAction, now: Date): ResetResult {
  const before = resetPreview(study, target);
  if (action !== "code" && before.examLocked) return { reset: false, reason: "exam" };
  if (action === "attempt" && !before.open) return { reset: false, reason: "no-open-attempt" };
  if (action === "all") {
    inTransaction(study, (tx) => {
      const ids = tx.select({ id: attempts.id }).from(attempts).where(eq(attempts.itemId, target.id)).all();
      deleteAttempts(tx, ids.map((row) => row.id));
      rebuildCard(tx, target.id);
    });
    rmSync(studySolutionDir(target), { recursive: true, force: true });
    refreshState(study);
    return { reset: true, action, archived: [], solutions: [], before };
  }
  const { archived, solutions } = freshStubs(study, target, now);
  if (action === "attempt") {
    const open = itemProgress(study, target.id).open!;
    inTransaction(study, (tx) => deleteAttempts(tx, [open.attemptId]));
  }
  refreshState(study);
  return { reset: true, action, archived, solutions, before };
}
