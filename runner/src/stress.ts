import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CaseFileError, inputIssues } from "./schema.ts";
import type { CaseFile } from "./types.ts";

export const DEFAULT_STRESS_LIMIT_MS = 2000;

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Shuffles in place and returns the same array. */
  shuffle<T>(items: T[]): T[];
  intArray(length: number, min: number, max: number): number[];
}

export interface StressCase {
  name: string;
  input: unknown;
  limitMs?: number;
}

/** FNV-1a 32-bit hash: a stable seed per problem id. */
export function seedFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, deterministic. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(0, i);
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
    intArray: (length, min, max) => Array.from({ length }, () => int(min, max)),
  };
}

/**
 * Loads `<dir>/stress.ts` and calls it with an rng seeded by `id`. With `cf`, every input
 * must also match the signature in cases.json. Returns null when the file does not exist.
 */
export async function loadStressCases(dir: string, id: string, cf?: CaseFile): Promise<StressCase[] | null> {
  const file = path.join(dir, "stress.ts");
  if (!existsSync(file)) return null;
  // The mtime query busts the ESM cache so watch mode sees edits. It uses integer
  // nanoseconds: a fractional mtimeMs ends the id in ".NNNN", which Vite takes as the extension.
  const url = `${pathToFileURL(file).href}?mtime=${statSync(file, { bigint: true }).mtimeNs}`;
  let mod: { default?: unknown };
  try {
    mod = (await import(url)) as { default?: unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CaseFileError([`failed to load: ${message}`], "stress.ts");
  }
  if (typeof mod.default !== "function") {
    throw new CaseFileError(["expected a default export function (rng) => StressCase[]"], "stress.ts");
  }
  let cases: unknown;
  try {
    cases = (mod.default as (rng: Rng) => unknown)(createRng(seedFromId(id)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CaseFileError([`stress() threw: ${message}`], "stress.ts");
  }
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new CaseFileError(["must return a non-empty array of { name, input, limitMs? }"], "stress.ts");
  }
  const issues: string[] = [];
  cases.forEach((item: Partial<StressCase> | null, i) => {
    if (typeof item?.name !== "string" || item.name === "") issues.push(`[${i}].name: required`);
    if (item?.input === undefined) issues.push(`[${i}].input: required`);
    else if (cf) issues.push(...inputIssues(cf, item.input, `[${i}]`));
    if (item?.limitMs !== undefined && !(typeof item.limitMs === "number" && item.limitMs > 0)) {
      issues.push(`[${i}].limitMs: must be a positive number`);
    }
  });
  if (issues.length > 0) throw new CaseFileError(issues, "stress.ts");
  return cases as StressCase[];
}
