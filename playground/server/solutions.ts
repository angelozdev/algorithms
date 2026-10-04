import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { CustomInputError, runCustom } from "../../runner/src/custom.ts";
import { runTarget } from "../../runner/src/run.ts";
import { CaseFileError, loadCaseFile } from "../../runner/src/schema.ts";
import { ensureSolution, solutionPath } from "../../runner/src/stubs.ts";
import type { Lang, Target } from "../../runner/src/types.ts";
import { findTarget, unknownTarget } from "./targets.ts";
import type { SolutionData } from "./types.ts";
import { valid } from "./validate.ts";

/** Short content hash: two reads give the same version exactly when the bytes are the same. */
export function contentVersion(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

/** Reads solution.<lang>, creating the stub first when it is missing (throws CaseFileError when it cannot). */
export function readSolution(target: Target, lang: Lang): SolutionData {
  const file = solutionPath(target.dir, lang);
  if (!existsSync(file)) ensureSolution(target.dir, loadCaseFile(target.dir), lang);
  const code = readFileSync(file, "utf8");
  return { code, version: contentVersion(code) };
}

export type WriteResult = { ok: true; version: string } | { ok: false; current: SolutionData };

/**
 * Writes only when the file on disk is still the version the editor started from.
 * Read, compare and write are synchronous, so two saves can never interleave.
 */
export function writeSolution(target: Target, lang: Lang, code: string, baseVersion: string): WriteResult {
  const file = solutionPath(target.dir, lang);
  const disk = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (contentVersion(disk) !== baseVersion) return { ok: false, current: { code: disk, version: contentVersion(disk) } };
  writeFileSync(file, code);
  return { ok: true, version: contentVersion(code) };
}

/**
 * A broken cases.json becomes `422 { error }`; anything else rethrows for app.onError to handle.
 * No return type annotation: it must infer `c.json(...)`'s exact TypedResponse, not the generic
 * `Response` DOM type, or the typed Hono client loses the 200 response's shape on every caller.
 */
function caseFileError422(c: Context, error: unknown) {
  if (error instanceof CaseFileError) return c.json({ error: error.message }, 422);
  throw error;
}

const id = z.string().min(1);
const lang = z.enum(["py", "ts"]);

export function solutionRoutes(root: string) {
  return new Hono()
    .get("/solution", valid("query", z.object({ id, lang })), (c) => {
      const query = c.req.valid("query");
      const target = findTarget(root, query.id);
      if (!target) return c.json(unknownTarget(query.id), 404);
      try {
        return c.json(readSolution(target, query.lang), 200);
      } catch (error) {
        return caseFileError422(c, error);
      }
    })
    .put("/solution", valid("json", z.object({ id, lang, code: z.string(), baseVersion: z.string() })), (c) => {
      const body = c.req.valid("json");
      const target = findTarget(root, body.id);
      if (!target) return c.json(unknownTarget(body.id), 404);
      const result = writeSolution(target, body.lang, body.code, body.baseVersion);
      return result.ok ? c.json({ version: result.version }, 200) : c.json(result.current, 409);
    })
    .post("/run", valid("json", z.object({ id, lang })), async (c) => {
      const body = c.req.valid("json");
      const target = findTarget(root, body.id);
      if (!target) return c.json(unknownTarget(body.id), 404);
      try {
        return c.json(await runTarget(target, body.lang, { root }), 200);
      } catch (error) {
        return caseFileError422(c, error);
      }
    })
    .post(
      "/run-custom",
      valid("json", z.object({ id, lang, input: z.unknown().refine((value) => value !== undefined, "input is required") })),
      async (c) => {
        const body = c.req.valid("json");
        const target = findTarget(root, body.id);
        if (!target) return c.json(unknownTarget(body.id), 404);
        try {
          return c.json(await runCustom(target, body.lang, body.input), 200);
        } catch (error) {
          if (error instanceof CustomInputError) return c.json({ error: error.message, issues: error.issues }, 422);
          return caseFileError422(c, error);
        }
      },
    );
}
