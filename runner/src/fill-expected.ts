import { writeFileSync } from "node:fs";
import path from "node:path";
import { judgedValue, matches } from "./compare.ts";
import { runHarness } from "./executor.ts";
import { formatCasesJson, loadRawCaseFile, parseCaseFile } from "./schema.ts";
import type { Lang, Target } from "./types.ts";

export const FILL_WALL_MS = 10_000;

export class FillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FillError";
  }
}

function langOf(refPath: string): Lang {
  const ext = path.extname(refPath);
  if (ext === ".py") return "py";
  if (ext === ".ts") return "ts";
  throw new FillError(`the reference must be a .py or .ts file (got "${ext || "no extension"}")`);
}

/** Runs a reference solution (outside the repo) and writes the missing hidden expected values. */
export async function fillExpected(
  target: Target,
  refPath: string,
  root: string,
): Promise<{ filled: number; warnings: string[] }> {
  const relative = path.relative(root, refPath);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new FillError(`the reference solution must live outside the repo (got ${refPath})`);
  }
  const lang = langOf(refPath);
  const raw = loadRawCaseFile(target.dir);
  const cf = parseCaseFile(raw);

  const outcome = await runHarness(
    lang,
    {
      solutionPath: refPath,
      mode: cf.mode,
      entry: cf.entry,
      params: cf.params,
      returns: cf.returns,
      inPlace: cf.inPlace,
      discardOutput: false,
      cases: [
        ...cf.examples.map((entry, i) => ({ id: `e${i + 1}`, input: entry.input })),
        ...cf.hidden.map((entry, i) => ({ id: `h${i + 1}`, input: entry.input })),
      ],
    },
    { wallLimitMs: FILL_WALL_MS },
  );
  if (outcome.fatal) throw new FillError(`the reference failed to load: ${outcome.fatal.message}`);

  cf.examples.forEach((entry, i) => {
    const run = outcome.runs.get(`e${i + 1}`);
    if (!run?.ok) {
      throw new FillError(`the reference failed on examples[${i}]: ${run?.error?.message ?? "no result (timeout?)"}`);
    }
    if (!matches(cf, entry.expected, run.output)) {
      throw new FillError(
        `the reference disagrees with examples[${i}]: expected ${JSON.stringify(entry.expected)}, got ${JSON.stringify(run.output)}. The example is the truth — fix the reference.`,
      );
    }
  });

  const hiddenRaw = raw.hidden as Record<string, unknown>[];
  let filled = 0;
  cf.hidden.forEach((entry, i) => {
    const run = outcome.runs.get(`h${i + 1}`);
    if (!run?.ok) {
      throw new FillError(`the reference failed on hidden[${i}]: ${run?.error?.message ?? "no result (timeout?)"}`);
    }
    const judged = judgedValue(cf, run.output);
    if (!judged) throw new FillError(`the reference returned a malformed in-place result on hidden[${i}]`);
    if (entry.expected === undefined) {
      hiddenRaw[i].expected = cf.compare === "any-of" ? [judged.value] : judged.value;
      filled++;
    } else if (!matches(cf, entry.expected, run.output)) {
      throw new FillError(
        `hidden[${i}] already expects ${JSON.stringify(entry.expected)} but the reference returned ${JSON.stringify(judged.value)}`,
      );
    }
  });

  const warnings =
    cf.compare === "any-of" && filled > 0
      ? ["compare is any-of: only the reference's answer was recorded for each filled hidden case — add other valid answers by hand if needed."]
      : [];
  writeFileSync(path.join(target.dir, "cases.json"), formatCasesJson(raw));
  return { filled, warnings };
}
