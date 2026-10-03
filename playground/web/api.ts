import { queryOptions } from "@tanstack/react-query";
import { hc } from "hono/client";
import type { CustomResult, Lang, RunResult } from "../../runner/src/types.ts";
import type { AppType } from "../server/app.ts";
import type { ConceptData, HomeData, SolutionData, TargetData } from "../server/types.ts";

export const client = hc<AppType>("/");

/** A request the server refused. `issues` lists what to fix (custom input, My explanation). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(res: { status: number; json(): Promise<unknown> }): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: string[] };
  throw new ApiError(res.status, body.error ?? `The request failed (${res.status}).`, body.issues ?? []);
}

export async function getHome(): Promise<HomeData> {
  const res = await client.api.home.$get();
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getTarget(id: string): Promise<TargetData> {
  const res = await client.api.target.$get({ query: { id } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getSolution(id: string, lang: Lang): Promise<SolutionData> {
  const res = await client.api.solution.$get({ query: { id, lang } });
  if (!res.ok) return fail(res);
  return res.json();
}

export type SaveResult = { ok: true; version: string } | { ok: false; current: SolutionData };

/** Sent with keepalive, so a save started while the page closes still arrives. */
export async function putSolution(id: string, lang: Lang, code: string, baseVersion: string): Promise<SaveResult> {
  const res = await client.api.solution.$put({ json: { id, lang, code, baseVersion } }, { init: { keepalive: true } });
  if (res.status === 409) return { ok: false, current: await res.json() };
  if (!res.ok) return fail(res);
  return { ok: true, version: (await res.json()).version };
}

export async function runTests(id: string, lang: Lang): Promise<RunResult> {
  const res = await client.api.run.$post({ json: { id, lang } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function runCustomInput(id: string, lang: Lang, input: unknown): Promise<CustomResult> {
  const res = await client.api["run-custom"].$post({ json: { id, lang, input } });
  if (!res.ok) return fail(res);
  return res.json();
}

export async function getConcept(slug: string): Promise<ConceptData> {
  const res = await client.api.concept.$get({ query: { slug } });
  if (!res.ok) return fail(res);
  return res.json();
}

export type ExplanationSave = { ok: true; version: string } | { ok: false; current: ConceptData };

export async function putExplanation(slug: string, text: string, baseVersion: string): Promise<ExplanationSave> {
  const res = await client.api.concept.explanation.$put({ json: { slug, text, baseVersion } });
  if (res.status === 409) return { ok: false, current: await res.json() };
  if (!res.ok) return fail(res);
  return { ok: true, version: (await res.json()).version };
}

export const keys = {
  home: ["home"] as const,
  target: (id: string) => ["target", id] as const,
  concept: (slug: string) => ["concept", slug] as const,
};

export const homeQuery = () => queryOptions({ queryKey: keys.home, queryFn: getHome });
export const targetQuery = (id: string) => queryOptions({ queryKey: keys.target(id), queryFn: () => getTarget(id) });
export const conceptQuery = (slug: string) => queryOptions({ queryKey: keys.concept(slug), queryFn: () => getConcept(slug) });
