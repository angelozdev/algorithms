import { existsSync, readFileSync, type Stats } from "node:fs";
import path from "node:path";
import { type FSWatcher, watch } from "chokidar";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { exerciseIdFromFolder, problemIdFromFolder } from "../../lib/repo.ts";
import { contentVersion } from "./solutions.ts";
import type { RepoEvent } from "./types.ts";

export const HEARTBEAT_MS = 25_000;
const IGNORED_PART = /(^|[/\\])(__pycache__|node_modules|\.[^/\\]+)([/\\]|$)/;

/** What a changed file means for the app, or null when the app does not show it. */
export function classify(root: string, file: string): RepoEvent | null {
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
  const lang = /^solution\.(py|ts)$/.exec(name)?.[1];
  if (lang !== "py" && lang !== "ts") return null;
  return { kind: "solution", target, lang, version: contentVersion(existsSync(file) ? readFileSync(file, "utf8") : "") };
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
    const watcher = watch(this.root, {
      ignoreInitial: true,
      alwaysStat: true,
      usePolling: true,
      interval: 300,
      ignored: (file) => {
        const rel = path.relative(this.root, file);
        if (rel === "") return false;
        const top = rel.split(path.sep)[0];
        return (top !== "problems" && top !== "concepts") || IGNORED_PART.test(rel);
      },
    });
    this.watcher = watcher;
    // chokidar only emits "ready" once every discovered path's poll timer is already registered, so the
    // extra loop turns below are not load-bearing; they are a small inherited margin, kept for parity
    // with the non-polling form of this wait.
    this.ready = new Promise((resolve) => watcher.once("ready", () => setImmediate(() => setImmediate(resolve))));
    watcher.on("all", (kind, file, stats) => this.changed(kind, file, stats));
  }

  private stop(): void {
    void this.watcher?.close();
    this.watcher = null;
    this.seen.clear();
  }

  private changed(kind: string, file: string, stats: Stats | undefined): void {
    const version = kind === "unlink" ? "missing" : stats ? `${stats.size}:${stats.mtimeMs}` : `${Date.now()}`;
    if (this.seen.get(file) === version) return;
    this.seen.set(file, version);
    const event = classify(this.root, file);
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
