import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root: where package.json, runner/ and the harnesses live. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const HARNESS_DIR = path.join(REPO_ROOT, "runner", "harness");
export const TSX_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");

/** Folder that contains problems/ and concepts/. Tests point it elsewhere with ALGO_ROOT. */
export function contentRoot(): string {
  return process.env.ALGO_ROOT ? path.resolve(process.env.ALGO_ROOT) : REPO_ROOT;
}
