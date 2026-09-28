import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, TSX_LOADER, TSX_TSCONFIG } from "./paths.ts";
import { CaseFileError, inputIssues } from "./schema.ts";
import type { CaseFile } from "./types.ts";

export const DEFAULT_STRESS_LIMIT_MS = 2000;
/** Default time limit for generating the stress cases (not for running them). */
export const STRESS_LOAD_TIMEOUT_MS = 10_000;

const WORKER = fileURLToPath(new URL("./stress-worker.ts", import.meta.url));

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

/** What stress-worker.ts sends back on fd 3. */
export type StressReply = { ok: true; cases: unknown } | { ok: false; issue: string };

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

/** A StressReply parsed from one line, or null when the line is not one. */
function parseReply(line: string): StressReply | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const reply = value as { ok?: unknown; issue?: unknown };
  if (reply.ok === true) return reply as StressReply;
  return reply.ok === false && typeof reply.issue === "string" ? (reply as StressReply) : null;
}

/**
 * Runs stress-worker.ts on `file` and returns what the generator returned. The worker is killed
 * after `timeoutMs`. Every failure (load error, throw, timeout, crash) is a CaseFileError.
 */
function generate(file: string, id: string, timeoutMs: number): Promise<unknown> {
  const invalid = (issue: string): CaseFileError => new CaseFileError([issue], "stress.ts");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", TSX_LOADER, WORKER, file, id], {
      cwd: REPO_ROOT,
      env: { ...process.env, TSX_TSCONFIG_PATH: TSX_TSCONFIG },
      stdio: ["ignore", "ignore", "pipe", "pipe"],
    });
    let reply = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const channel = child.stdio[3] as Readable;
    channel.setEncoding("utf8");
    channel.on("data", (chunk: string) => {
      reply += chunk;
    });
    const errors = child.stdio[2] as Readable;
    errors.setEncoding("utf8");
    errors.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    child.on("error", (error) => settle(() => reject(invalid(`could not start the generator: ${error.message}`))));
    child.on("close", (code, signal) =>
      settle(() => {
        if (timedOut) return reject(invalid(`stress() did not return within ${timeoutMs} ms (an infinite loop?)`));
        // The worker's reply is the last line: a generator that writes to fd 3 itself only adds lines before it.
        const message = parseReply(reply.trimEnd().split("\n").at(-1) ?? "");
        if (!message) {
          const how = signal ? `signal ${signal}` : `exit code ${code}`;
          const tail = stderr.trim().split("\n").slice(-5).join("\n");
          return reject(invalid(`the generator exited without returning cases (${how})${tail ? `: ${tail}` : ""}`));
        }
        if (message.ok) resolve(message.cases);
        else reject(invalid(message.issue));
      }),
    );
  });
}

/**
 * Loads `<dir>/stress.ts` and calls it with an rng seeded by `id`, in a child process that is
 * killed after `options.timeoutMs` (default STRESS_LOAD_TIMEOUT_MS). With `cf`, every input
 * must also match the signature in cases.json. Returns null when the file does not exist.
 */
export async function loadStressCases(
  dir: string,
  id: string,
  cf?: CaseFile,
  options: { timeoutMs?: number } = {},
): Promise<StressCase[] | null> {
  const file = path.join(dir, "stress.ts");
  if (!existsSync(file)) return null;
  const cases = await generate(file, id, options.timeoutMs ?? STRESS_LOAD_TIMEOUT_MS);
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
