import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { PATTERNS } from "../lib/schemas.ts";
import { formatPath } from "../runner/src/schema.ts";
import { type Catalog, type Difficulty, listMembers } from "./catalog.ts";

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");
const positive = z.number().int().positive();
const share = z.number().gt(0).max(1);

/**
 * curriculum/<preset>.yaml (spec §5). A list is named only by its id: membership is the problems' frontmatter
 * `lists`. `learn.size` is how many problems the list has upstream, so `today` can report a partial import.
 */
export const presetSchema = z
  .object({
    id: kebab,
    phases: z
      .object({
        bases: z.object({ concepts: z.array(kebab).min(1) }).strict(),
        learn: z.object({ list: kebab, size: positive, block: positive, mix_after_block: z.number().int().min(0) }).strict(),
        master: z.object({ list: kebab, first_try_success: share }).strict(),
        expand: z.object({ choose_from: z.array(kebab).min(1), window: positive, unseen_medium_success: share, medium_minutes: positive }).strict(),
        pro: z.object({ tracks: z.array(z.enum(["interview", "competitive"])).min(1) }).strict(),
      })
      .strict(),
    /** Order of phase 1, and the concept that opens each pattern. */
    patterns: z
      .array(z.object({ pattern: z.enum(PATTERNS), concept: kebab }).strict())
      .min(1)
      .superRefine((entries, ctx) => {
        const seen = new Set<string>();
        entries.forEach((entry, i) => {
          if (seen.has(entry.pattern)) ctx.addIssue({ code: "custom", message: `"${entry.pattern}" is listed twice`, path: [i, "pattern"] });
          seen.add(entry.pattern);
        });
      }),
    timebox_minutes: z.object({ easy: positive, medium: positive, hard: positive }).strict(),
  })
  .strict();

export type Preset = z.infer<typeof presetSchema>;

/** The default preset (spec D12). */
export const DEFAULT_PRESET = "grind-75";
/** Time-boxes when no preset is in force or it cannot be read (the values every shipped preset uses, spec §5). */
export const DEFAULT_TIMEBOX: Preset["timebox_minutes"] = { easy: 15, medium: 35, hard: 50 };

/** A preset that is missing or invalid; `issues` are "path: message" lines (spec §13). */
export class PresetError extends Error {
  constructor(
    readonly file: string,
    readonly issues: string[],
  ) {
    super(`${file}: ${issues.join("; ")}`);
    this.name = "PresetError";
  }
}

export function curriculumDir(root: string): string {
  return path.join(root, "curriculum");
}

export function presetFile(root: string, id: string): string {
  return path.join(curriculumDir(root), `${id}.yaml`);
}

/** Preset ids in curriculum/, sorted. */
export function listPresets(root: string): string[] {
  const dir = curriculumDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => name.slice(0, -".yaml".length))
    .sort();
}

/** Reads and validates curriculum/<id>.yaml. Throws PresetError with every issue and its path. */
export function loadPreset(root: string, id: string): Preset {
  const rel = `curriculum/${id}.yaml`;
  const file = presetFile(root, id);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !existsSync(file)) {
    throw new PresetError(rel, [`there is no preset "${id}" (presets: ${listPresets(root).join(", ") || "none"})`]);
  }
  let data: unknown;
  try {
    data = parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new PresetError(rel, [`YAML: ${(error as Error).message.split("\n")[0]}`]);
  }
  const parsed = presetSchema.safeParse(data);
  if (!parsed.success) throw new PresetError(rel, parsed.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`));
  if (parsed.data.id !== id) throw new PresetError(rel, [`id: "${parsed.data.id}" does not match the file name`]);
  return parsed.data;
}

/** loadPreset, or null when the preset is missing or invalid: for code that must never fail (ratings). */
export function tryLoadPreset(root: string | null, id: string | null): Preset | null {
  if (!root || !id) return null;
  try {
    return loadPreset(root, id);
  } catch (error) {
    if (error instanceof PresetError) return null;
    throw error;
  }
}

/** The time-box of a problem (spec §5); a missing difficulty counts as medium. */
export function timeboxMinutes(preset: Preset | null, difficulty: Difficulty | null): number {
  return (preset?.timebox_minutes ?? DEFAULT_TIMEBOX)[difficulty ?? "medium"];
}

/** Phase 1's pattern order: the preset's, then patterns it misses, sorted (spec §5; `check` warns about them). */
export function patternOrder(preset: Preset, catalog: Catalog): string[] {
  const listed = preset.patterns.map((entry) => entry.pattern as string);
  const extra = new Set<string>();
  for (const problem of listMembers(catalog, preset.phases.learn.list)) {
    if (problem.pattern && !listed.includes(problem.pattern)) extra.add(problem.pattern);
  }
  return [...listed, ...[...extra].sort()];
}

/** The concept that opens `pattern` in this preset, or null for a pattern the preset does not list. */
export function conceptOf(preset: Preset, pattern: string): string | null {
  return preset.patterns.find((entry) => entry.pattern === pattern)?.concept ?? null;
}

/** How much of a list is in the repo (spec §5: "today reports a partially imported list"). */
export interface ListImport {
  list: string;
  /** Runnable problems tagged with the list. */
  imported: number;
  /** The list's upstream size, from the preset named like the list; null when there is no such preset. */
  size: number | null;
}

export function listImport(root: string, catalog: Catalog, list: string): ListImport {
  return { list, imported: listMembers(catalog, list).length, size: tryLoadPreset(root, list)?.phases.learn.size ?? null };
}
