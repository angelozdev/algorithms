import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";

/** zod validation for a request part; a bad request gets `400 { error }` with a readable message. */
export function valid<Target extends keyof ValidationTargets, Schema extends z.ZodType>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) return c.json({ error: z.prettifyError(result.error) }, 400);
  });
}
