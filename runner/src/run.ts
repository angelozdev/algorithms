import path from "node:path";
import { matches } from "./compare.ts";
import { runHarness } from "./executor.ts";
import { contentRoot } from "./paths.ts";
import { assertHiddenFilled, loadCaseFile } from "./schema.ts";
import { DEFAULT_STRESS_LIMIT_MS, loadStressCases } from "./stress.ts";
import { ensureSolution } from "./stubs.ts";
import type {
  CaseFile,
  CaseRun,
  CaseStatus,
  ExampleResult,
  HarnessError,
  HarnessOutcome,
  HiddenResult,
  Lang,
  RunResult,
  StressCaseResult,
  StressResult,
  Target,
} from "./types.ts";

export const EXAMPLES_WALL_MS = 5000;
export const STRESS_EXTRA_MS = 2000;
export const STDOUT_MAX_LINES = 20;

export interface RunOptions {
  /** Wall-clock limit for the examples + hidden process (default 5000 ms). */
  examplesWallMs?: number;
  /** Root used for the relative paths in the result (default: contentRoot()). */
  root?: string;
}

export function truncateLines(text: string, max = STDOUT_MAX_LINES): string {
  if (text === "") return "";
  const lines = text.replace(/\n$/, "").split("\n");
  if (lines.length <= max) return text;
  return `${lines.slice(0, max).join("\n")}\n… ${lines.length - max} more lines\n`;
}

function timeoutError(limitMs: number): HarnessError {
  return { kind: "timeout", message: `exceeded the ${limitMs} ms time limit`, trace: "" };
}

interface Judged {
  status: CaseStatus;
  output?: unknown;
  error?: HarnessError;
  ms?: number;
  stdout: string;
}

function judge(
  cf: CaseFile,
  id: string,
  expected: unknown,
  outcome: HarnessOutcome,
  limitMs: number,
): Judged {
  const run: CaseRun | undefined = outcome.runs.get(id);
  if (!run) {
    return outcome.timedOutCase === id
      ? { status: "timeout", error: timeoutError(limitMs), stdout: "" }
      : { status: "skipped", stdout: "" };
  }
  if (!run.ok) return { status: "error", error: run.error, ms: run.ms, stdout: truncateLines(run.stdout) };
  return {
    status: matches(cf, expected, run.output) ? "pass" : "fail",
    output: run.output,
    ms: run.ms,
    stdout: truncateLines(run.stdout),
  };
}

export async function runTarget(target: Target, lang: Lang, options: RunOptions = {}): Promise<RunResult> {
  const root = options.root ?? contentRoot();
  const wallMs = options.examplesWallMs ?? EXAMPLES_WALL_MS;
  const cf = loadCaseFile(target.dir);
  assertHiddenFilled(cf);
  const solution = ensureSolution(target.dir, cf, lang).path;
  const rel = (file: string): string => path.relative(root, file).split(path.sep).join("/");
  const request = {
    solutionPath: solution,
    mode: cf.mode,
    entry: cf.entry,
    params: cf.params,
    returns: cf.returns,
    inPlace: cf.inPlace,
  };

  const result: RunResult = {
    id: target.id,
    title: target.title,
    lang,
    readme: rel(path.join(target.dir, "README.md")),
    solution: rel(solution),
    fatal: null,
    examples: { passed: 0, total: cf.examples.length, cases: [] },
    hidden: { status: "skipped", passed: 0, total: cf.hidden.length, firstFailure: null },
    stress: { status: "skipped", cases: [] },
    green: false,
  };

  // Examples and hidden share one process; hidden results are only reported when every example passes.
  const outcome = await runHarness(
    lang,
    {
      ...request,
      discardOutput: false,
      cases: [
        ...cf.examples.map((entry, i) => ({ id: `e${i + 1}`, input: entry.input })),
        ...cf.hidden.map((entry, i) => ({ id: `h${i + 1}`, input: entry.input })),
      ],
    },
    { wallLimitMs: wallMs },
  );

  if (outcome.fatal) {
    result.fatal = outcome.fatal;
    result.examples.cases = cf.examples.map((entry, i) => ({
      id: i + 1,
      status: "skipped",
      input: entry.input,
      expected: entry.expected,
      stdout: "",
    }));
    return result;
  }

  result.examples.cases = cf.examples.map(
    (entry, i): ExampleResult => ({
      id: i + 1,
      input: entry.input,
      expected: entry.expected,
      ...judge(cf, `e${i + 1}`, entry.expected, outcome, wallMs),
    }),
  );
  result.examples.passed = result.examples.cases.filter((c) => c.status === "pass").length;
  if (result.examples.passed < result.examples.total) return result;

  const hidden: HiddenResult = { status: "pass", passed: 0, total: cf.hidden.length, firstFailure: null };
  cf.hidden.forEach((entry, i) => {
    const judged = judge(cf, `h${i + 1}`, entry.expected, outcome, wallMs);
    if (judged.status === "pass") {
      hidden.passed++;
      return;
    }
    hidden.status = "fail";
    // Only the input and the user's own output/error: never entry.expected.
    hidden.firstFailure ??= {
      input: entry.input,
      ...(judged.output !== undefined ? { output: judged.output } : {}),
      ...(judged.error ? { error: judged.error } : {}),
      stdout: judged.stdout,
    };
  });
  result.hidden = hidden;
  if (hidden.status !== "pass") return result;

  const stressCases = await loadStressCases(target.dir, target.id, cf);
  if (!stressCases) {
    result.stress = { status: "none", cases: [] };
    result.green = true;
    return result;
  }
  const limits = stressCases.map((c) => c.limitMs ?? DEFAULT_STRESS_LIMIT_MS);
  const stressOutcome = await runHarness(
    lang,
    {
      ...request,
      discardOutput: true,
      cases: stressCases.map((c, i) => ({ id: `s${i + 1}`, input: c.input })),
    },
    { wallLimitMs: limits.reduce((sum, limit) => sum + limit, 0) + STRESS_EXTRA_MS },
  );
  const stress: StressResult = {
    status: "pass",
    cases: stressCases.map((c, i): StressCaseResult => {
      const limitMs = limits[i];
      if (stressOutcome.fatal) return { name: c.name, status: "error", limitMs, error: stressOutcome.fatal };
      const run = stressOutcome.runs.get(`s${i + 1}`);
      if (!run) {
        return stressOutcome.timedOutCase === `s${i + 1}`
          ? { name: c.name, status: "timeout", limitMs }
          : { name: c.name, status: "skipped", limitMs };
      }
      if (!run.ok) return { name: c.name, status: "error", ms: run.ms, limitMs, error: run.error };
      return { name: c.name, status: run.ms <= limitMs ? "pass" : "slow", ms: run.ms, limitMs };
    }),
  };
  stress.status = stress.cases.every((c) => c.status === "pass") ? "pass" : "fail";
  result.stress = stress;
  result.green = stress.status === "pass";
  return result;
}
