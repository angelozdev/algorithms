import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import type { SolutionData } from "../../server/types.ts";
import type { SaveResult } from "../api.ts";

export const AUTOSAVE_MS = 500;

export type SaveState = "loading" | "saved" | "pending" | "saving" | "error" | "conflict";

export interface SolutionSource {
  load(): Promise<SolutionData>;
  save(code: string, baseVersion: string): Promise<SaveResult>;
}

export interface SolutionSync {
  /** What the editor shows; null until the file is loaded. */
  code: string | null;
  state: SaveState;
  error: string | null;
  /** What is on disk while state is "conflict". */
  conflict: SolutionData | null;
  edit(code: string): void;
  /** Saves any pending edit now. Resolves true when the disk has exactly what the editor shows. */
  flush(): Promise<boolean>;
  /** A solution event from the server: the file on disk now has `version`. */
  diskChanged(version: string): void;
  /** Resolve a conflict by loading what is on disk. */
  takeDisk(): void;
  /** Resolve a conflict by saving the editor's text over it. */
  keepMine(): Promise<boolean>;
}

/** Synchronous bookkeeping, so decisions never wait for a React render. */
interface Tracked {
  loaded: boolean;
  code: string;
  /** Version of the file on disk that `code` is based on. */
  base: string;
  /** The editor has text that is not on disk yet (true until a save of it answers). */
  dirty: boolean;
  /** The last save threw (server down) and no save has started since: the text is only in memory. */
  failed: boolean;
  conflict: SolutionData | null;
}

/**
 * Keeps one solution file and the editor in step: autosave 500 ms after the last edit, one save at a time,
 * never overwriting a file that changed on disk, and reloading a clean editor when someone else edits the file.
 */
export function useSolutionSync(source: SolutionSource, onReloaded?: () => void): SolutionSync {
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SolutionData | null>(null);
  const tracked = useRef<Tracked>({ loaded: false, code: "", base: "", dirty: false, failed: false, conflict: null });
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const latest = useRef({ source, onReloaded });
  useEffect(() => {
    latest.current = { source, onReloaded };
  });

  // A save that is still running when the editor closes (unmount flushes it) can resolve after there is
  // no one left to show its result. Only a mounted hook can rely on state; an unmounted one must toast instead.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // A conflict already open when the editor closes is never retried: edit() skips autosave while
      // t.conflict is set, so flushOnExit has nothing pending to send. Warn only when the text shown
      // still differs from what is on disk; equal text means there is nothing left to lose.
      const t = tracked.current;
      if (t.conflict && t.code !== t.conflict.code) {
        toast.error("Your last edit was not saved: the file changed on disk.");
      } else if (t.loaded && t.dirty && t.failed && !t.conflict && !debounced.isPending()) {
        // A failed save is only retried by the next edit, ⌘S, Run or a reconnect, none of which can happen
        // any more: try once more, so a second failure reaches the after-unmount toast in save(). A pending
        // debounce is still visible here (this cleanup runs before useDebouncedCallback's flushOnExit) and
        // sends itself. `debounced` and `queueSave` are stable, so the first render's references are fine.
        void queueSave();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    source.load().then(
      (data) => {
        if (cancelled) return;
        tracked.current = { loaded: true, code: data.code, base: data.version, dirty: false, failed: false, conflict: null };
        setCode(data.code);
        setState("saved");
      },
      (reason: unknown) => {
        if (cancelled) return;
        setError((reason as Error).message);
        setState("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source]);

  const save = useCallback(async (): Promise<boolean> => {
    const t = tracked.current;
    if (!t.loaded || t.conflict) return false;
    if (!t.dirty) return true;
    const sent = t.code;
    t.failed = false;
    setState("saving");
    try {
      const result = await latest.current.source.save(sent, t.base);
      if (!result.ok) {
        t.conflict = result.current;
        if (!mounted.current) {
          // Nothing shows the conflict banner any more; say so, or the edit is lost without a trace.
          toast.error("Your last edit was not saved: the file changed on disk.");
          return false;
        }
        setConflict(result.current);
        setState("conflict");
        return false;
      }
      t.base = result.version;
      if (t.code === sent) t.dirty = false;
      setError(null);
      setState(t.dirty ? "pending" : "saved");
      return !t.dirty;
    } catch (reason) {
      t.failed = true;
      if (!mounted.current) {
        toast.error(`Your last edit was not saved: ${(reason as Error).message}`);
        return false;
      }
      setError((reason as Error).message);
      setState("error");
      return false;
    }
  }, []);

  /** Saves run one after another, each with the base version the previous one produced. */
  const queueSave = useCallback((): Promise<boolean> => {
    const next = queue.current.then(save, save);
    queue.current = next;
    return next;
  }, [save]);

  // flushOnExit: leaving the page or switching language saves the last edit.
  const debounced = useDebouncedCallback(queueSave, AUTOSAVE_MS, { flushOnExit: true });

  // Closing the tab does not unmount React, so pagehide sends the pending save (keepalive lets it finish).
  useEffect(() => {
    const onHide = () => {
      if (debounced.isPending()) debounced.flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [debounced]);

  const edit = useCallback(
    (next: string) => {
      const t = tracked.current;
      if (!t.loaded || next === t.code) return;
      t.code = next;
      t.dirty = true;
      setCode(next);
      if (t.conflict) return; // no autosave until the conflict is resolved
      setState("pending");
      debounced();
    },
    [debounced],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    const t = tracked.current;
    if (!t.loaded || t.conflict) return false;
    if (debounced.isPending()) debounced.flush();
    else if (t.dirty) void queueSave();
    await queue.current;
    return !tracked.current.dirty && !tracked.current.conflict;
  }, [debounced, queueSave]);

  const diskChanged = useCallback(
    (version: string) => {
      const t = tracked.current;
      // Own saves come back with the version we already have; dirty covers a save still on its way.
      if (!t.loaded || version === t.base || t.conflict || t.dirty || debounced.isPending()) return;
      latest.current.source.load().then(
        (data) => {
          const now = tracked.current;
          if (now.dirty || now.conflict || data.version === now.base) return;
          now.code = data.code;
          now.base = data.version;
          setCode(data.code);
          setState("saved");
          latest.current.onReloaded?.();
        },
        (reason: unknown) => {
          // Reload failed; leave the editor exactly as it was and surface the problem instead of losing it silently.
          toast.error(`Could not reload the solution from disk: ${(reason as Error).message}`);
        },
      );
    },
    [debounced],
  );

  const takeDisk = useCallback(() => {
    const t = tracked.current;
    if (!t.conflict) return;
    debounced.cancel();
    t.code = t.conflict.code;
    t.base = t.conflict.version;
    t.dirty = false;
    t.conflict = null;
    setCode(t.code);
    setConflict(null);
    setState("saved");
  }, [debounced]);

  const keepMine = useCallback(async (): Promise<boolean> => {
    const t = tracked.current;
    if (!t.conflict) return true;
    t.base = t.conflict.version;
    t.conflict = null;
    t.dirty = true;
    setConflict(null);
    return queueSave();
  }, [queueSave]);

  return { code, state, error, conflict, edit, flush, diskChanged, takeDisk, keepMine };
}
