import { existsSync, readFileSync, type Stats } from "node:fs";
import path from "node:path";
import { type FSWatcher, watch } from "chokidar";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { exerciseIdFromFolder, problemIdFromFolder } from "../../lib/repo.ts";
import { studyRoot } from "../../runner/src/paths.ts";
import { contentVersion } from "./solutions.ts";
import type { RepoEvent } from "./types.ts";

export const HEARTBEAT_MS = 25_000;
const IGNORED_PART = /(^|[/\\])(__pycache__|node_modules|\.[^/\\]+)([/\\]|$)/;

/** `file`'s path segments under `dir` ([] for `dir` itself), or null when it is not inside `dir`. */
function segmentsUnder(dir: string, file: string): string[] | null {
  const rel = path.relative(dir, file);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel === "" ? [] : rel.split(path.sep);
}

function solutionEvent(target: string, name: string, file: string): RepoEvent | null {
  const lang = /^solution\.(py|ts)$/.exec(name)?.[1];
  if (lang !== "py" && lang !== "ts") return null;
  return { kind: "solution", target, lang, version: contentVersion(existsSync(file) ? readFileSync(file, "utf8") : "") };
}

/** Under the study root: solutions/problems/<id>/solution.<lang> and solutions/exercises/<concept>/<NN>/solution.<lang>. */
function classifyStudy(parts: string[], file: string): RepoEvent | null {
  if (parts[0] !== "solutions") return null;
  if (parts[1] === "problems" && parts.length === 4) return solutionEvent(parts[2], parts[3], file);
  if (parts[1] === "exercises" && parts.length === 5) return solutionEvent(`${parts[2]}/${parts[3]}`, parts[4], file);
  return null;
}

/** What a changed file means for the app, or null when the app does not show it. */
export function classify(root: string, file: string, study: string = studyRoot(root)): RepoEvent | null {
  const inStudy = segmentsUnder(study, file);
  if (inStudy !== null) return classifyStudy(inStudy, file);
  const parts = path.relative(root, file).split(path.sep);
  let target: string | undefined;
  let concept: string | undefined;
  let name: string;
  if (parts[0] === "problems" && parts.length === 3) {
    target = problemIdFromFolder(parts[1]);
    name = parts[2];
  } else if (parts[0] === "concepts" && parts.length === 3) {
    concept = parts[1];
    name = parts[2];
  } else if (parts[0] === "concepts" && parts.length === 5 && parts[2] === "exercises") {
    target = exerciseIdFromFolder(parts[1], parts[3]);
    name = parts[4];
  } else {
    return null;
  }
  if (name === "README.md") return target ? { kind: "readme", target } : { kind: "readme", concept };
  if (!target) return null;
  if (name === "cases.json") return { kind: "cases", target };
  if (name === "stress.ts") return { kind: "stress", target };
  return solutionEvent(target, name, file); // LEGACY: solution.<lang> still in the content folder
}

/** Study-root paths the app shows, or must walk into to reach them: solutions/, without history/. */
function keptInStudy(parts: string[]): boolean {
  if (parts.length === 0) return true;
  if (parts[0] !== "solutions") return false;
  return !parts.some((part) => part === "history" || IGNORED_PART.test(part));
}

/** chokidar's filter: problems/ and concepts/ under the content root, and what keptInStudy keeps under the study root. */
export function ignoredPath(root: string, study: string, file: string): boolean {
  const inStudy = segmentsUnder(study, file);
  if (inStudy !== null) return !keptInStudy(inStudy);
  const rel = path.relative(root, file);
  if (rel === "") return false;
  const top = rel.split(path.sep)[0];
  return (top !== "problems" && top !== "concepts") || IGNORED_PART.test(rel);
}

type Listener = (event: RepoEvent) => void;

/** One chokidar watcher shared by every open page: started by the first subscriber, closed after the last one leaves. */
export class EventHub {
  private readonly listeners = new Set<Listener>();
  private watcher: FSWatcher | null = null;
  private ready: Promise<void> = Promise.resolve();
  /** Last seen version per file: macOS reports one save twice. */
  private readonly seen = new Map<string, string>();

  constructor(private readonly root: string) {}

  /** Resolves once file changes are being reported to `listener`. Call the returned function to stop. */
  async subscribe(listener: Listener): Promise<() => void> {
    this.listeners.add(listener);
    if (!this.watcher) this.start();
    await this.ready;
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private start(): void {
    // Watching the root (not problems/ and concepts/) keeps working when those folders do not exist yet.
    // Polling (not native fs events): on macOS, chokidar watches existing files via kqueue (live immediately),
    // but a directory's FSEvents stream — the only path that reports a file newly created inside it — goes
    // live asynchronously, some time after "ready" fires. A file created in that window is dropped for good,
    // not delayed, and a browser subscribing right after a page load can easily lose a save that way. Polling
    // does not depend on that stream being live: it just re-stats on a timer, so it cannot miss a write this
    // way. The interval is 300ms in production (cost scales with the number of files under problems/ and
    // concepts/, so this stays cheap); CHOKIDAR_INTERVAL lets tests run it faster (see events.test.ts).
    // The study root is usually <root>/.study and is watched with the root. An ALGO_STUDY elsewhere is watched on
    // its own when it exists: chokidar 5 never reports a watched path created later, so restart pnpm play after
    // `pnpm study init` in that case.
    const study = studyRoot(this.root);
    const paths = segmentsUnder(this.root, study) === null && existsSync(study) ? [this.root, study] : [this.root];
    const watcher = watch(paths, {
      ignoreInitial: true,
      alwaysStat: true,
      usePolling: true,
      interval: 300,
      ignored: (file) => ignoredPath(this.root, study, file),
    });
    this.watcher = watcher;
    // chokidar only emits "ready" once every discovered path's poll timer is already registered, so the
    // extra loop turns below are not load-bearing; they are a small inherited margin, kept for parity
    // with the non-polling form of this wait.
    this.ready = new Promise((resolve) => watcher.once("ready", () => setImmediate(() => setImmediate(resolve))));
    watcher.on("all", (kind, file, stats) => this.changed(kind, file, stats, study));
  }

  private stop(): void {
    void this.watcher?.close();
    this.watcher = null;
    this.seen.clear();
  }

  private changed(kind: string, file: string, stats: Stats | undefined, study: string): void {
    const version = kind === "unlink" ? "missing" : stats ? `${stats.size}:${stats.mtimeMs}` : `${Date.now()}`;
    if (this.seen.get(file) === version) return;
    this.seen.set(file, version);
    const event = classify(this.root, file, study);
    if (event) for (const listener of this.listeners) listener(event);
  }
}

export function eventRoutes(hub: EventHub) {
  return new Hono().get("/events", (c) =>
    streamSSE(c, async (stream) => {
      const subscription = hub.subscribe((event) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      });
      stream.onAbort(() => {
        void subscription.then((unsubscribe) => unsubscribe());
      });
      await subscription;
      await stream.writeSSE({ event: "ready", data: "" });
      while (!stream.aborted) {
        await stream.sleep(HEARTBEAT_MS);
        if (!stream.aborted) await stream.write(": ping\n\n");
      }
    }),
  );
}
