import { spawn } from "node:child_process";
import path from "node:path";
import { watch } from "chokidar";
import { formatTerminal } from "./reporter.ts";
import { runTarget } from "./run.ts";
import { CaseFileError, loadCaseFile } from "./schema.ts";
import { ensureSolution } from "./stubs.ts";
import type { Lang, Target } from "./types.ts";

export interface Watcher {
  /** Resolves once the initial scan is done: changes made from then on are reported. */
  ready: Promise<void>;
  close(): void;
}

/** Calls onChange (debounced) when one of `names` inside `dir` is created, written, replaced by a rename, or removed. */
export function watchFiles(
  dir: string,
  names: readonly string[],
  onChange: () => void,
  debounceMs = 100,
): Watcher {
  let timer: NodeJS.Timeout | null = null;
  const watcher = watch(dir, { depth: 0, ignoreInitial: true });
  const ready = new Promise<void>((resolve) => watcher.once("ready", resolve));
  watcher.on("all", (_event, file) => {
    if (!names.includes(path.basename(file))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  });
  return {
    ready,
    close: () => {
      if (timer) clearTimeout(timer);
      watcher.close().catch(() => {});
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

/** Opens `file` in VS Code; when `code` cannot be started, passes a warning to `onError`. */
export function openInEditor(file: string, onError: (message: string) => void): void {
  const child = spawn("code", [file], { stdio: "ignore", detached: true });
  child.on("error", () => {
    onError(`warning: "code" is not on your PATH — open ${file} yourself.`);
  });
  child.unref();
}

export async function watchTarget(
  target: Target,
  lang: Lang,
  options: { open: boolean; root: string },
): Promise<Watcher> {
  const solution = ensureSolution(target.dir, loadCaseFile(target.dir), lang).path;
  // A notice (e.g. the --open warning) is drawn under every screen, so clearing never hides it.
  let notice = "";
  let screen: string | null = null;
  const draw = (): void => {
    if (screen === null) return;
    process.stdout.write(
      `\x1b[2J\x1b[H${screen}\n\nwatching ${path.relative(options.root, solution)} … (Ctrl+C to stop)\n${notice}`,
    );
  };
  if (options.open) {
    openInEditor(solution, (message) => {
      notice = `${message}\n`;
      draw();
    });
  }
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
      screen = await renderRun(target, lang, options.root).catch(
        (error: unknown) => `Runner error: ${(error as Error).message}`,
      );
      draw();
    } while (again);
    running = false;
  };
  await cycle();
  return watchFiles(target.dir, [path.basename(solution), "cases.json", "stress.ts"], () => void cycle());
}
