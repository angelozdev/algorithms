import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { formatTerminal } from "./reporter.ts";
import { runTarget } from "./run.ts";
import { CaseFileError, loadCaseFile } from "./schema.ts";
import { ensureSolution } from "./stubs.ts";
import type { Lang, Target } from "./types.ts";

export interface Watcher {
  close(): void;
}

/** Calls onChange (debounced) when one of `names` inside `dir` is written or replaced by a rename. */
export function watchFiles(
  dir: string,
  names: readonly string[],
  onChange: () => void,
  debounceMs = 100,
): Watcher {
  let timer: NodeJS.Timeout | null = null;
  const watcher = watch(dir, (_event, filename) => {
    if (!filename || !names.includes(path.basename(filename.toString()))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  });
  return {
    close: () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}

/** One run as terminal text. Case-file problems are shown, not thrown, so watch keeps going. */
export async function renderRun(target: Target, lang: Lang, root: string): Promise<string> {
  try {
    return formatTerminal(await runTarget(target, lang, { root }));
  } catch (error) {
    if (error instanceof CaseFileError) {
      return `Case file error (not your code — fix the problem files):\n${error.message}`;
    }
    throw error;
  }
}

export function openInEditor(file: string): void {
  const child = spawn("code", [file], { stdio: "ignore", detached: true });
  child.on("error", () => {
    process.stderr.write(`warning: "code" is not on your PATH — open ${file} yourself.\n`);
  });
  child.unref();
}

export async function watchTarget(
  target: Target,
  lang: Lang,
  options: { open: boolean; root: string },
): Promise<Watcher> {
  const solution = ensureSolution(target.dir, loadCaseFile(target.dir), lang).path;
  if (options.open) openInEditor(solution);
  let running = false;
  let again = false;
  const cycle = async (): Promise<void> => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    do {
      again = false;
      const text = await renderRun(target, lang, options.root).catch(
        (error: unknown) => `Runner error: ${(error as Error).message}`,
      );
      process.stdout.write(
        `\x1b[2J\x1b[H${text}\n\nwatching ${path.relative(options.root, solution)} … (Ctrl+C to stop)\n`,
      );
    } while (again);
    running = false;
  };
  await cycle();
  return watchFiles(target.dir, [path.basename(solution), "cases.json", "stress.ts"], () => void cycle());
}
