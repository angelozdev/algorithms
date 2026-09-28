import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Repository root: where package.json, runner/ and the harnesses live. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const HARNESS_DIR = path.join(REPO_ROOT, "runner", "harness");
export const TSX_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
/** tsx as a loader for `node --import`: the script runs in that same process, so it keeps extra fds like fd 3. */
export const TSX_LOADER = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
/** Child processes that run TypeScript through TSX_LOADER use the repo tsconfig (the "lc" path alias). */
export const TSX_TSCONFIG = path.join(REPO_ROOT, "tsconfig.json");

/** Folder that contains problems/ and concepts/. Tests point it elsewhere with ALGO_ROOT. */
export function contentRoot(): string {
  return process.env.ALGO_ROOT ? path.resolve(process.env.ALGO_ROOT) : REPO_ROOT;
}
