import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import type { Readable } from "node:stream";
import { HARNESS_DIR, REPO_ROOT, TSX_LOADER, TSX_TSCONFIG } from "./paths.ts";
import type {
  CaseRun,
  HarnessError,
  HarnessMessage,
  HarnessOutcome,
  HarnessRequest,
  Lang,
} from "./types.ts";

let cachedPython: string | null = null;

/** Python from `uv python find` (honors .python-version = 3.13). ALGO_PYTHON overrides it. */
export function resolvePython(): string {
  if (process.env.ALGO_PYTHON) return process.env.ALGO_PYTHON;
  if (cachedPython) return cachedPython;
  try {
    cachedPython = execFileSync("uv", ["python", "find"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      "Could not find Python with `uv python find`. Install uv (https://docs.astral.sh/uv/) or set ALGO_PYTHON.",
    );
  }
  return cachedPython;
}

function command(lang: Lang): { file: string; args: string[]; env: NodeJS.ProcessEnv } {
  if (lang === "py") {
    return {
      file: resolvePython(),
      args: [path.join(HARNESS_DIR, "python", "harness.py")],
      env: process.env,
    };
  }
  return {
    file: process.execPath,
    args: ["--import", TSX_LOADER, path.join(HARNESS_DIR, "ts", "harness.ts")],
    env: { ...process.env, TSX_TSCONFIG_PATH: TSX_TSCONFIG },
  };
}

function crash(message: string, stderr: string): HarnessError {
  return { kind: "crash", message, trace: stderr.trim().split("\n").slice(-10).join("\n") };
}

/** Spawns the language harness, streams its fd-3 messages, and enforces a wall-clock limit. */
export function runHarness(
  lang: Lang,
  request: HarnessRequest,
  options: { wallLimitMs: number },
): Promise<HarnessOutcome> {
  const { file, args, env } = command(lang);
  return new Promise((resolve) => {
    const child = spawn(file, args, { cwd: REPO_ROOT, env, stdio: ["pipe", "pipe", "pipe", "pipe"] });
    const runs = new Map<string, CaseRun>();
    let fatal: HarnessError | null = null;
    let ready = false;
    let inFlight: string | null = null;
    let timedOut = false;
    let settled = false;
    let stderr = "";
    let pending = "";

    const finish = (outcome: HarnessOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    const handle = (message: HarnessMessage): void => {
      if (message.type === "ready") ready = true;
      else if (message.type === "fatal") fatal = message.error;
      else if (message.type === "start") inFlight = message.id;
      else {
        runs.set(
          message.id,
          message.ok
            ? { id: message.id, ok: true, output: message.output, ms: message.ms, stdout: message.stdout }
            : { id: message.id, ok: false, error: message.error, ms: message.ms, stdout: message.stdout },
        );
        inFlight = null;
      }
    };

    const protocol = child.stdio[3] as Readable;
    protocol.setEncoding("utf8");
    protocol.on("data", (chunk: string) => {
      pending += chunk;
      let newline = pending.indexOf("\n");
      while (newline >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (line.trim()) handle(JSON.parse(line) as HarnessMessage);
        newline = pending.indexOf("\n");
      }
    });

    child.stdout.resume();
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.stdin.on("error", () => {
      // The harness may exit before reading the whole request (e.g. a fatal load error).
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.wallLimitMs);

    child.on("error", (error) => {
      finish({
        fatal: crash(`could not start the ${lang} harness: ${error.message}`, ""),
        runs,
        timedOutCase: null,
        stderr,
      });
    });

    child.on("close", (code) => {
      if (timedOut && !ready && !fatal) {
        fatal = {
          kind: "timeout",
          message: `the solution did not finish loading within ${options.wallLimitMs} ms`,
          trace: "",
        };
      }
      if (!timedOut && !fatal && !ready) {
        fatal = crash(`the ${lang} harness exited before loading the solution (code ${code})`, stderr);
      }
      if (!timedOut && inFlight && !runs.has(inFlight)) {
        runs.set(inFlight, {
          id: inFlight,
          ok: false,
          error: crash(`the process exited during this case (code ${code})`, stderr),
          ms: 0,
          stdout: "",
        });
      }
      finish({ fatal, runs, timedOutCase: timedOut ? inFlight : null, stderr });
    });

    child.stdin.end(JSON.stringify(request));
  });
}
