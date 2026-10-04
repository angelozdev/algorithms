import { runHarness } from "./executor.ts";
import { timeoutError, truncateLines } from "./run.ts";
import { inputIssues, loadCaseFile } from "./schema.ts";
import { ensureSolution } from "./stubs.ts";
import type { CustomResult, Lang, Target } from "./types.ts";

export const CUSTOM_WALL_MS = 5000;

/** The input does not fit the signature in cases.json (wrong number of params, malformed class calls). */
export class CustomInputError extends Error {
  constructor(readonly issues: string[]) {
    super(`the input does not match the signature:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "CustomInputError";
  }
}

/**
 * Runs the user's solution on one input of their own and reports what it returned, threw or printed.
 * Nothing is judged. Throws CaseFileError for a broken cases.json and CustomInputError for a bad input.
 */
export async function runCustom(
  target: Target,
  lang: Lang,
  input: unknown,
  options: { wallMs?: number } = {},
): Promise<CustomResult> {
  const wallMs = options.wallMs ?? CUSTOM_WALL_MS;
  const cf = loadCaseFile(target.dir);
  const issues = inputIssues(cf, input, "custom");
  if (issues.length > 0) throw new CustomInputError(issues);
  const solutionPath = ensureSolution(target.dir, cf, lang).path;
  const outcome = await runHarness(
    lang,
    {
      solutionPath,
      mode: cf.mode,
      entry: cf.entry,
      params: cf.params,
      returns: cf.returns,
      inPlace: cf.inPlace,
      discardOutput: false,
      cases: [{ id: "c1", input }],
    },
    { wallLimitMs: wallMs },
  );
  if (outcome.fatal) return { fatal: outcome.fatal, stdout: "" };
  const run = outcome.runs.get("c1");
  // runHarness records a crash during the case as a failed run, so a missing run means the time ran out.
  if (!run) return { fatal: null, error: timeoutError(wallMs), stdout: "" };
  if (!run.ok) return { fatal: null, error: run.error, ms: run.ms, stdout: truncateLines(run.stdout) };
  return { fatal: null, output: run.output, ms: run.ms, stdout: truncateLines(run.stdout) };
}
