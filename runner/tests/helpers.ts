import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../src/paths.ts";
import type { HarnessRequest } from "../src/types.ts";

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
