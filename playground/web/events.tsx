import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { RepoEvent } from "../server/types.ts";
import { keys } from "./api.ts";

type Listener = (event: RepoEvent) => void;

interface EventsValue {
  connected: boolean;
  subscribe(listener: Listener): () => void;
}

const EventsContext = createContext<EventsValue>({ connected: true, subscribe: () => () => {} });

/**
 * One EventSource for the whole app. It refreshes the queries a change affects (badges update when Claude
 * edits a README) and passes every event to the pages that listen.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("ready", () => setConnected(true));
    source.onerror = () => setConnected(false);
    source.onmessage = (message: MessageEvent<string>) => {
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
    return () => source.close();
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
