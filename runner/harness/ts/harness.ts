/**
 * Entry point for the TypeScript harness: reads the request from stdin and runs it inside a
 * worker_threads Worker (worker.ts) with extra stack headroom, so a correct but deeply recursive
 * solution (depth ~100k or more) does not exhaust the default ~1 MB V8 stack.
 *
 * A bare `--stack-size` flag on the main thread would only raise V8's logical stack limit without
 * growing the OS thread stack backing it, so a solution that truly recurses forever can overrun
 * the real stack and segfault the process instead of throwing a catchable error. A Worker's
 * `resourceLimits.stackSizeMb` grows the real thread stack to match, so even runaway recursion
 * still fails cleanly with "Maximum call stack size exceeded" (TypeScript) rather than crashing.
 */
import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";

/** Generous headroom: comfortably holds a ~100k-deep call stack, even for a "heavy" recursive frame. */
const STACK_SIZE_MB = 64;

function describe(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

try {
  const request: unknown = JSON.parse(readFileSync(0, "utf8"));
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    workerData: request,
    resourceLimits: { stackSizeMb: STACK_SIZE_MB },
  });
  worker.on("error", (error) => {
    process.stderr.write(`harness failure: ${describe(error)}\n`);
    process.exitCode = 1;
  });
  worker.on("exit", (code) => {
    process.exitCode = code;
  });
} catch (error) {
  process.stderr.write(`harness failure: ${describe(error)}\n`);
  process.exitCode = 1;
}
