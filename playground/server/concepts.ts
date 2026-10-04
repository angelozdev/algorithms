import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Hono } from "hono";
import { z } from "zod";
import { parseMarkdown } from "../../lib/frontmatter.ts";
import { type ConceptEntry, scanRepo, str } from "../../lib/repo.ts";
import { explanationIssues, joinExplanation, splitExplanation } from "./explanation.ts";
import { contentVersion } from "./solutions.ts";
import { conceptStatus } from "./targets.ts";
import type { ConceptData } from "./types.ts";
import { valid } from "./validate.ts";

/** The concept with exactly this slug. */
export function findConcept(root: string, slug: string): ConceptEntry | null {
  return scanRepo(root).concepts.find((concept) => concept.slug === slug) ?? null;
}

const readRaw = (concept: ConceptEntry): string => (existsSync(concept.readme) ? readFileSync(concept.readme, "utf8") : "");

export function conceptData(concept: ConceptEntry): ConceptData {
  const base = {
    slug: concept.slug,
    title: str(concept.data.title, concept.slug),
    status: conceptStatus(concept.data.status),
    readme: concept.rel,
    version: contentVersion(readRaw(concept)),
  };
  if (concept.error) return { ...base, readmeError: concept.error, before: "", explanation: null, after: "" };
  const split = splitExplanation(concept.body);
  if (!split) return { ...base, readmeError: null, before: concept.body, explanation: null, after: "" };
  return { ...base, readmeError: null, before: split.before, explanation: split.text, after: split.after };
}

const unknownConcept = (slug: string) => ({ error: `There is no concept "${slug}".` });

export function conceptRoutes(root: string) {
  return new Hono()
    .get("/concept", valid("query", z.object({ slug: z.string().min(1) })), (c) => {
      const { slug } = c.req.valid("query");
      const concept = findConcept(root, slug);
      if (!concept) return c.json(unknownConcept(slug), 404);
      return c.json(conceptData(concept), 200);
    })
    .put(
      "/concept/explanation",
      valid("json", z.object({ slug: z.string().min(1), text: z.string(), baseVersion: z.string() })),
      (c) => {
        const request = c.req.valid("json");
        const concept = findConcept(root, request.slug);
        if (!concept) return c.json(unknownConcept(request.slug), 404);
        const raw = readRaw(concept);
        if (contentVersion(raw) !== request.baseVersion) return c.json(conceptData(concept), 409);
        if (concept.error) return c.json({ error: `${concept.rel}: ${concept.error}` }, 422);
        const { head, body } = parseMarkdown(raw);
        const split = splitExplanation(body);
        if (!split) return c.json({ error: `${concept.rel} has no "## My explanation" section. Run pnpm check.` }, 422);
        const issues = explanationIssues(split, request.text);
        if (issues.length > 0) return c.json({ error: issues.join(" "), issues }, 422);
        const next = head + joinExplanation(split, request.text);
        writeFileSync(concept.readme, next);
        return c.json({ version: contentVersion(next) }, 200);
      },
    );
}
