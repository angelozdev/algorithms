import { eq } from "drizzle-orm";
import { listMembers, loadCatalog } from "./catalog.ts";
import { listImport, loadPreset } from "./curriculum.ts";
import { computePhase, currentCurriculum, currentPhase, loadContext } from "./phase.ts";
import { announcements, curriculumLog, type Phase, phaseLog, profile } from "./schema.ts";
import { refreshState } from "./state.ts";
import { inTransaction, type Study } from "./store.ts";

export type CurriculumResult =
  /** The coach's first preset (reason init), or a switch (reason switch); `phase` is computed from scratch. */
  | { status: "started" | "switched"; preset: string; phase: Phase; previous: { preset: string; phase: Phase } | null; announcementId: number }
  | { status: "unchanged"; preset: string }
  /** The preset's list has no runnable problems in the repo: nothing changes (spec §6.5). */
  | { status: "refused"; preset: string; list: string; size: number | null };

/**
 * `pnpm study curriculum set <preset>` (spec §6.5). The first call starts the coach. A later one switches lists:
 * - progress per problem id and pattern_intros are untouched;
 * - the phase is recalculated against the new list, and may move back;
 * - curriculum_log and phase_log (reason switch) get a row each, and one announcement references both.
 * It refuses when the preset's list is not imported. Throws PresetError for a missing or invalid preset.
 */
export function setCurriculum(study: Study, root: string, presetId: string, now: Date): CurriculumResult {
  const preset = loadPreset(root, presetId);
  const imported = listImport(root, loadCatalog(root), preset.phases.learn.list);
  if (imported.imported === 0) return { status: "refused", preset: presetId, list: imported.list, size: imported.size };
  const result = inTransaction(study, (tx): CurriculumResult => {
    const previousCurriculum = currentCurriculum(tx);
    const previousPhase = currentPhase(tx);
    if (previousCurriculum?.preset === presetId) return { status: "unchanged", preset: presetId };
    const curriculum = tx
      .insert(curriculumLog)
      .values({ at: now, preset: presetId, reason: previousCurriculum ? "switch" : "init" })
      .returning({ id: curriculumLog.id })
      .get();
    const phase = computePhase(study, loadContext(study, root, presetId));
    const row = tx
      .insert(phaseLog)
      .values({ at: now, phase, reason: previousCurriculum ? "switch" : "criteria", curriculumLogId: curriculum.id })
      .returning({ id: phaseLog.id })
      .get();
    const announcement = tx
      .insert(announcements)
      .values(previousCurriculum ? { at: now, kind: "switch", phaseLogId: row.id, curriculumLogId: curriculum.id } : { at: now, kind: "phase", phaseLogId: row.id })
      .returning({ id: announcements.id })
      .get();
    return {
      status: previousCurriculum ? "switched" : "started",
      preset: presetId,
      phase,
      previous: previousCurriculum && previousPhase ? { preset: previousCurriculum.preset, phase: previousPhase.phase } : null,
      announcementId: announcement.id,
    };
  });
  refreshState(study);
  return result;
}

export type ExpansionResult =
  | { status: "set"; list: string; imported: number; size: number | null }
  | { status: "refused"; list: string; reason: "not-a-choice"; choices: string[] };

/**
 * `pnpm study curriculum expand <list>`: the coach stores the user's answer at the 2 → 3 transition (spec §6.1).
 * The list must be one the preset offers; it may still be unimported (`today` then serves reviews until it is in).
 */
export function setExpansionList(study: Study, root: string, list: string): ExpansionResult {
  const curriculum = currentCurriculum(study.db);
  const choices = curriculum ? loadPreset(root, curriculum.preset).phases.expand.choose_from : [];
  if (!choices.includes(list)) return { status: "refused", list, reason: "not-a-choice", choices };
  study.db.update(profile).set({ expansionList: list }).where(eq(profile.id, 1)).run();
  const catalog = loadCatalog(root);
  return { status: "set", list, imported: listMembers(catalog, list).length, size: listImport(root, catalog, list).size };
}

/** `pnpm study phase set <phase>` (the user's only, spec §11): a phase_log row with reason forced, announced. */
export function forcePhase(
  study: Study,
  phase: Phase,
  now: Date,
): { status: "set"; from: Phase | null; to: Phase; announcementId: number } | { status: "not-started" } {
  const result = inTransaction(study, (tx) => {
    const curriculum = currentCurriculum(tx);
    if (!curriculum) return { status: "not-started" as const };
    const from = currentPhase(tx)?.phase ?? null;
    const row = tx.insert(phaseLog).values({ at: now, phase, reason: "forced", curriculumLogId: curriculum.id }).returning({ id: phaseLog.id }).get();
    const announcement = tx.insert(announcements).values({ at: now, kind: "phase", phaseLogId: row.id }).returning({ id: announcements.id }).get();
    return { status: "set" as const, from, to: phase, announcementId: announcement.id };
  });
  refreshState(study);
  return result;
}
