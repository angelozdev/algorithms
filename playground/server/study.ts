import { Hono } from "hono";
import { z } from "zod";
import { CaseFileError } from "../../runner/src/schema.ts";
import { envClock } from "../../study/clock.ts";
import { pauseStudy, resumeStudy } from "../../study/pause.ts";
import { RESET_ACTIONS, resetItem, resetPreview } from "../../study/reset.ts";
import { startAttempt } from "../../study/start.ts";
import { cachedStudy } from "../../study/store.ts";
import { ackAnnouncement, notInitialized, today } from "../../study/today.ts";
import { findTarget, unknownTarget } from "./targets.ts";
import { valid } from "./validate.ts";

const NO_STUDY = { error: "There is no study database yet: run `pnpm study init` (a fresh clone) or `pnpm study migrate` (this repo)." };

/**
 * The Today section's API (study coach spec §10). The time comes from envClock (ALGO_STUDY_NOW in tests), and
 * the database handle from cachedStudy (the Vite dev server re-evaluates this module).
 * Claude never calls start, pause, resume or reset: the hook denies these routes.
 */
export function studyRoutes(root: string) {
  return new Hono()
    .get("/study/today", (c) => {
      const study = cachedStudy(root);
      return c.json(study ? today(study, root, { surface: "ui", now: envClock().now() }) : notInitialized(root), 200);
    })
    .post("/study/start/:id{.+}", valid("json", z.object({ lang: z.enum(["py", "ts"]) })), (c) => {
      const id = c.req.param("id");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      try {
        const result = startAttempt(study, root, target, envClock().now(), { lang: c.req.valid("json").lang });
        if (result.started) return c.json({ kind: result.kind }, 200);
        const reason = result.reason === "open" ? `${id} already has an open attempt.` : `${id} was never tried: its first attempt starts with your first edit or run.`;
        return c.json({ error: reason }, 409);
      } catch (error) {
        if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
        throw error;
      }
    })
    .get("/study/reset/:id{.+}", (c) => {
      const id = c.req.param("id");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      return c.json(resetPreview(study, target), 200);
    })
    .post("/study/reset/:id{.+}", valid("json", z.object({ action: z.enum(RESET_ACTIONS) })), (c) => {
      const id = c.req.param("id");
      const target = findTarget(root, id);
      if (!target) return c.json(unknownTarget(id), 404);
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      try {
        const result = resetItem(study, target, c.req.valid("json").action, envClock().now());
        if (result.reset) return c.json({ action: result.action }, 200);
        const reason = result.reason === "exam" ? `${id} has an exam attempt: only its code can be cleaned.` : `${id} has no open attempt to discard.`;
        return c.json({ error: reason }, 409);
      } catch (error) {
        if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
        throw error;
      }
    })
    .post("/study/ack/:id{[0-9]+}", (c) => {
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      const id = Number(c.req.param("id"));
      const result = ackAnnouncement(study, id, "ui", envClock().now());
      if (result === "unknown") return c.json({ error: `There is no announcement ${id}.` }, 404);
      return c.json({ acked: result === "acked" }, 200);
    })
    .post("/study/pause", (c) => {
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      return c.json({ since: pauseStudy(study, envClock().now()).since.toISOString() }, 200);
    })
    .post("/study/resume", (c) => {
      const study = cachedStudy(root);
      if (!study) return c.json(NO_STUDY, 409);
      return c.json({ resumed: resumeStudy(study, envClock().now()).resumed }, 200);
    });
}
