import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { RepoEvent } from "../server/types.ts";
import { keys } from "./api.ts";

type Listener = (event: RepoEvent) => void;

interface EventsValue {
  connected: boolean;
  subscribe(listener: Listener): () => void;
}

/** How long to wait before opening a new connection after the browser gave up on one: doubling from `first` up to `max`. */
export const RECONNECT_MS = { first: 500, max: 5_000 } as const;

const EventsContext = createContext<EventsValue>({ connected: true, subscribe: () => () => {} });

/**
 * One live connection for the whole app. It refreshes the queries a change affects (badges update when Claude
 * edits a README) and passes every event to the pages that listen. After an outage it catches up on what changed
 * meanwhile, and if the browser gave up on the connection, a new one is opened, waiting a little longer each time.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let wait: number = RECONNECT_MS.first;
    /** The connection was lost since the last "ready": files may have changed meanwhile with no event for them. */
    let missed = false;

    const open = () => {
      const current = new EventSource("/api/events");
      source = current;
      current.addEventListener("ready", () => {
        wait = RECONNECT_MS.first;
        if (missed) {
          missed = false;
          // Events sent while the connection was down are never replayed: refetch everything the app shows.
          void queryClient.invalidateQueries();
        }
        setConnected(true);
      });
      current.onerror = () => {
        missed = true;
        setConnected(false);
        // The browser retries a dropped connection by itself (CONNECTING), even while `pnpm play` is stopped, but
        // closes it for good (CLOSED) when the server answers with an error instead of the stream (for example
        // while the API fails to load). Then nothing would ever reconnect: open a new one.
        if (current.readyState !== EventSource.CLOSED) return;
        current.close();
        retry = setTimeout(open, wait);
        wait = Math.min(wait * 2, RECONNECT_MS.max);
      };
      current.onmessage = (message: MessageEvent<string>) => {
        const event = JSON.parse(message.data) as RepoEvent;
        if (event.kind === "readme") {
          void queryClient.invalidateQueries({ queryKey: keys.home });
          if (event.target) void queryClient.invalidateQueries({ queryKey: keys.target(event.target) });
          if (event.concept) void queryClient.invalidateQueries({ queryKey: keys.concept(event.concept) });
        } else if (event.kind === "cases") {
          void queryClient.invalidateQueries({ queryKey: keys.target(event.target) });
        } else if (event.kind === "solution") {
          // A new stub turns a todo item into "in progress".
          void queryClient.invalidateQueries({ queryKey: keys.home });
        }
        for (const listener of listeners.current) listener(event);
      };
    };

    open();
    return () => {
      clearTimeout(retry);
      source?.close();
    };
  }, [queryClient]);

  const value = useMemo<EventsValue>(
    () => ({
      connected,
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [connected],
  );
  return <EventsContext value={value}>{children}</EventsContext>;
}

/** False while the playground server cannot be reached. */
export function useConnected(): boolean {
  return useContext(EventsContext).connected;
}

/** Calls `listener` for every file change the server reports while the component is mounted. */
export function useRepoEvents(listener: Listener): void {
  const { subscribe } = useContext(EventsContext);
  const onEvent = useEffectEvent(listener);
  useEffect(() => subscribe((event) => onEvent(event)), [subscribe]);
}
