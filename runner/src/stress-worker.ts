/**
 * Child process behind loadStressCases: imports one stress.ts, calls its default export with
 * the rng seeded by the id, and writes a StressReply as one JSON line on fd 3.
 *
 * Usage: node --import <tsx loader> stress-worker.ts <stress.ts path> <id>
 *
 * Running the generator here keeps the runner, `pnpm check` and `pnpm watch` alive when it
 * never returns (the parent kills this process), and every run imports a fresh copy of the file.
 */
import { writeSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRng, type Rng, seedFromId, type StressReply } from "./stress.ts";

function send(line: string): never {
  const buffer = Buffer.from(`${line}\n`);
  let offset = 0;
  while (offset < buffer.length) {
    try {
      offset += writeSync(3, buffer, offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
    }
  }
  // Exit right away: a timer or handle the generator left open must not keep this process alive.
  process.exit(0);
}

function fail(issue: string): never {
  send(JSON.stringify({ ok: false, issue } satisfies StressReply));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const [file, id] = process.argv.slice(2);
let mod: { default?: unknown };
try {
  mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
} catch (error) {
  fail(`failed to load: ${describe(error)}`);
}
if (typeof mod.default !== "function") fail("expected a default export function (rng) => StressCase[]");
let cases: unknown;
try {
  cases = (mod.default as (rng: Rng) => unknown)(createRng(seedFromId(id)));
} catch (error) {
  fail(`stress() threw: ${describe(error)}`);
}
let line: string;
try {
  line = JSON.stringify({ ok: true, cases } satisfies StressReply);
} catch (error) {
  fail(`stress() returned a value that is not JSON: ${describe(error)}`);
}
send(line);
