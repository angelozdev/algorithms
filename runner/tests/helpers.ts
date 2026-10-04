import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { problemIdFromFolder } from "../../lib/repo.ts";
import { REPO_ROOT, studySolutionPath } from "../src/paths.ts";
import type { HarnessRequest, Lang, Target } from "../src/types.ts";

/** Temp dirs live inside the repo so the tsconfig "lc" path alias applies to them. */
export const TMP_BASE = path.join(REPO_ROOT, "runner", "tests", ".tmp");

export function tempDir(): string {
  mkdirSync(TMP_BASE, { recursive: true });
  return mkdtempSync(path.join(TMP_BASE, "t-"));
}

export function removeTemp(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function write(dir: string, relativePath: string, content: string): string {
  const file = path.join(dir, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

export function harnessRequest(
  solutionPath: string,
  overrides: Partial<HarnessRequest> = {},
): HarnessRequest {
  return {
    solutionPath,
    mode: "function",
    entry: "solve",
    params: [{ name: "nums", type: "int[]" }],
    returns: "int",
    inPlace: null,
    discardOutput: false,
    cases: [],
    ...overrides,
  };
}

/**
 * Creates problems/<folder>/ with a README, cases.json and any extra files (stress.ts…). solution.py / solution.ts
 * keys go where the runner keeps solutions: .study/solutions/problems/<id>/ (spec §3).
 */
export function makeProblem(
  root: string,
  folder: string,
  cases: Record<string, unknown>,
  files: Record<string, string> = {},
): Target {
  const dir = path.join(root, "problems", folder);
  write(root, `problems/${folder}/README.md`, `---\ntitle: ${folder}\n---\n# ${folder}\n`);
  write(root, `problems/${folder}/cases.json`, JSON.stringify(cases, null, 2));
  const target: Target = { id: problemIdFromFolder(folder), kind: "problem", dir, title: folder };
  for (const [name, content] of Object.entries(files)) {
    const lang = /^solution\.(py|ts)$/.exec(name)?.[1] as Lang | undefined;
    if (lang) putSolution(target, lang, content);
    else write(dir, name, content);
  }
  return target;
}

/** Writes a target's solution where the runner looks for it (.study/solutions/…). */
export function putSolution(target: Target, lang: Lang, code: string): string {
  const file = studySolutionPath(target, lang);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, code);
  return file;
}
