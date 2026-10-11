import { spawn } from "node:child_process";
import { readFileSync, type Stats, statSync } from "node:fs";
import path from "node:path";
import { watch } from "chokidar";
import type { EventSource } from "../../study/schema.ts";
import { type Recording, recordSolutionChange } from "./recording.ts";
import { formatTerminal } from "./reporter.ts";
import { runTarget } from "./run.ts";
import { CaseFileError, loadCaseFile } from "./schema.ts";
import { ensureSolution } from "./stubs.ts";
import type { Lang, Target } from "./types.ts";

export interface Watcher {
  /** Resolves once the watched files are armed: saves made to them from then on are reported. */
  ready: Promise<void>;
  close(): void;
}

/** One saved state of a file ("missing" when it does not exist): every save changes it. */
function version(stats: Stats | undefined): string {
  return stats ? `${stats.ino}:${stats.size}:${stats.mtimeMs}` : "missing";
}

/**
 * Calls onChange (debounced) when one of `names` inside `dir` is created, written, replaced by a rename, or removed.
 * Only a new version of a file counts: macOS reports one save twice (kqueue on the file, then FSEvents on the
 * directory about 50 ms later) and can replay events from just before the watcher started.
 */
export function watchFiles(
  dir: string,
  names: readonly string[],
  onChange: () => void,
  debounceMs = 100,
): Watcher {
  const versions = new Map(
    names.map((name) => [name, version(statSync(path.join(dir, name), { throwIfNoEntry: false }))]),
  );
  let timer: NodeJS.Timeout | null = null;
  const watcher = watch(dir, { depth: 0, ignoreInitial: true, alwaysStat: true });
  // chokidar is ready once it has created its fs watchers; libuv arms them on its next poll, a loop turn later.
  const ready = new Promise<void>((resolve) => watcher.once("ready", () => setImmediate(() => setImmediate(resolve))));
  watcher.on("all", (event, file, stats) => {
    const name = path.basename(file);
    const current = event === "unlink" ? "missing" : version(stats);
    if (!versions.has(name) || versions.get(name) === current) return;
    versions.set(name, current);
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
export async function renderRun(target: Target, lang: Lang, root: string, record?: EventSource): Promise<string> {
  try {
    return formatTerminal(await runTarget(target, lang, { root, record }));
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

/** One watcher made of several: ready when all of them are, closed together. */
function combine(watchers: Watcher[]): Watcher {
  return {
    ready: Promise.all(watchers.map((watcher) => watcher.ready)).then(() => undefined),
    close: () => {
      for (const watcher of watchers) watcher.close();
    },
  };
}

export async function watchTarget(
  target: Target,
  lang: Lang,
  options: { open: boolean; root: string; record?: boolean },
): Promise<Watcher> {
  const solution = ensureSolution(target, loadCaseFile(target.dir), lang).path;
  const record = options.record ?? false;
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
  /** A save of the solution asked for the pending run: that run is the user's and gets recorded. */
  let savedByUser = false;
  const cycle = async (afterSave = false): Promise<void> => {
    if (afterSave) savedByUser = true;
    if (running) {
      again = true;
      return;
    }
    running = true;
    do {
      again = false;
      const source: EventSource | undefined = record && savedByUser ? "watch" : undefined;
      savedByUser = false;
      screen = await renderRun(target, lang, options.root, source).catch(
        (error: unknown) => `Runner error: ${(error as Error).message}`,
      );
      draw();
    } while (again);
    running = false;
  };
  // The first run is like opening the problem: it records nothing (spec §7).
  await cycle();
  /** Records the saved solution as an edit; null when not recording, or when the file is gone again (the run says so). */
  const recordEdit = (): Recording | null => {
    if (!record) return null;
    let code: string;
    try {
      code = readFileSync(solution, "utf8");
    } catch {
      return null; // a save is a timer callback: a throw here would stop pnpm watch
    }
    return recordSolutionChange(target, lang, code, "edit", "watch");
  };
  const onSave = (): void => {
    // An edit the lifecycle ignores starts nothing, and neither does its run: a save that leaves the stub as it was
    // (an editor reformatting it, spec §7) is not work. "off" and "failed" are about the database, not the save,
    // so those runs are still the user's.
    void cycle(recordEdit()?.status !== "ignored");
  };
  // Two folders (spec §10): the problem's own files, and the solution under .study. For a solution still in the
  // content folder both watchers look at the same folder, each for its own files.
  return combine([
    watchFiles(target.dir, ["cases.json", "stress.ts"], () => void cycle()),
    watchFiles(path.dirname(solution), [path.basename(solution)], onSave),
  ]);
}
