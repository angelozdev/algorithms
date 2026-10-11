import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { z } from "zod";
import { splitExplanation } from "../../lib/explanation.ts";
import { type ConceptEntry, scanRepo, str } from "../../lib/repo.ts";
import { studyRoot } from "../../runner/src/paths.ts";
import { contentVersion } from "./solutions.ts";
import { conceptView, loadProgress } from "./targets.ts";
import type { ConceptData } from "./types.ts";
import { valid } from "./validate.ts";

/** The concept with exactly this slug. */
export function findConcept(root: string, slug: string): ConceptEntry | null {
  return scanRepo(root).concepts.find((concept) => concept.slug === slug) ?? null;
}

/** .study/explanations/<slug>.md (spec §3): the user's "My explanation", kept out of the public README. */
export function explanationFile(root: string, slug: string): string {
  return path.join(studyRoot(root), "explanations", `${slug}.md`);
}

const readOrNull = (file: string): string | null => (existsSync(file) ? readFileSync(file, "utf8") : null);

export function conceptData(root: string, concept: ConceptEntry): ConceptData {
  const exercises = scanRepo(root).exercises.filter((exercise) => exercise.concept === concept.slug);
  const stored = readOrNull(explanationFile(root, concept.slug));
  const base = {
    slug: concept.slug,
    title: str(concept.data.title, concept.slug),
    status: conceptView(concept, exercises, loadProgress(root)),
    readme: concept.rel,
    // The README and the explanation together: a change to either since the page loaded is a conflict.
    version: contentVersion(`${readOrNull(concept.readme) ?? ""}\u0000${stored ?? ""}`),
  };
  if (concept.error) return { ...base, readmeError: concept.error, before: "", explanation: null, after: "" };
  const split = splitExplanation(concept.body);
  // LEGACY: until `pnpm study migrate` moves it, the text may still sit in the README's section.
  const explanation = stored !== null ? stored.trim() : (split?.text ?? "");
  if (!split) return { ...base, readmeError: null, before: concept.body, explanation, after: "" };
  return { ...base, readmeError: null, before: split.before, explanation, after: split.after };
}

const unknownConcept = (slug: string) => ({ error: `There is no concept "${slug}".` });

export function conceptRoutes(root: string) {
  return new Hono()
    .get("/concept", valid("query", z.object({ slug: z.string().min(1) })), (c) => {
      const { slug } = c.req.valid("query");
      const concept = findConcept(root, slug);
      if (!concept) return c.json(unknownConcept(slug), 404);
      return c.json(conceptData(root, concept), 200);
    })
    .put(
      "/concept/explanation",
      valid("json", z.object({ slug: z.string().min(1), text: z.string(), baseVersion: z.string() })),
      (c) => {
        const request = c.req.valid("json");
        const concept = findConcept(root, request.slug);
        if (!concept) return c.json(unknownConcept(request.slug), 404);
        const current = conceptData(root, concept);
        if (current.version !== request.baseVersion) return c.json(current, 409);
        if (concept.error) return c.json({ error: `${concept.rel}: ${concept.error}` }, 422);
        const file = explanationFile(root, concept.slug);
        mkdirSync(path.dirname(file), { recursive: true });
        const text = request.text.trim();
        writeFileSync(file, text ? `${text}\n` : "");
        return c.json({ version: conceptData(root, concept).version }, 200);
      },
    );
}
