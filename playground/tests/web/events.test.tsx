import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoEvent } from "../../server/types.ts";
import { ConnectionBanner } from "../../web/components/ConnectionBanner.tsx";
import { EventsProvider, RECONNECT_MS, useRepoEvents } from "../../web/events.tsx";

/** Stands in for the browser's EventSource (jsdom has none). Tests play the server and the browser's retries. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static all: FakeEventSource[] = [];
  static get latest(): FakeEventSource {
    return FakeEventSource.all[FakeEventSource.all.length - 1];
  }

  readyState = FakeEventSource.CONNECTING;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.all.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  /** The server accepted the connection and is reporting file changes. */
  ready(): void {
    this.readyState = FakeEventSource.OPEN;
    for (const listener of this.listeners.get("ready") ?? []) listener(new Event("ready"));
  }

  send(event: RepoEvent): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(event) }));
  }

  /** The connection dropped and the browser will retry it by itself. */
  drop(): void {
    this.readyState = FakeEventSource.CONNECTING;
    this.onerror?.(new Event("error"));
  }

  /** The server answered a retry with an error instead of the stream, and the browser gave up on this connection for good. */
  fail(): void {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.(new Event("error"));
  }
}

let fetches = 0;
const heard: RepoEvent[] = [];

/** A page that shows server data (refetched by the provider) and listens to file changes. */
function Page() {
  useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      fetches += 1;
      return fetches;
    },
  });
  useRepoEvents((event) => heard.push(event));
  return <p>page</p>;
}

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EventsProvider>
        <ConnectionBanner />
        <Page />
      </EventsProvider>
    </QueryClientProvider>,
  );
}

const banner = () => screen.queryByText(/Disconnected/);

/** Lets pending promise chains (query fetches) finish. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", FakeEventSource);
  FakeEventSource.all = [];
  fetches = 0;
  heard.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("EventsProvider", () => {
  it("opens a new connection when the browser gives up on one, and clears the banner once the server is back", async () => {
    renderApp();
    await settle();
    expect(FakeEventSource.all).toHaveLength(1);
    act(() => FakeEventSource.latest.ready());
    expect(banner()).not.toBeInTheDocument();

    act(() => FakeEventSource.latest.fail());
    expect(banner()).toBeInTheDocument();
    await advance(RECONNECT_MS.first);
    expect(FakeEventSource.all).toHaveLength(2);
    expect(FakeEventSource.all[0].readyState).toBe(FakeEventSource.CLOSED);

    act(() => FakeEventSource.latest.ready()); // the server answers again
    expect(banner()).not.toBeInTheDocument();
    const event: RepoEvent = { kind: "solution", target: "lc-0001", lang: "py", version: "v2" };
    act(() => FakeEventSource.latest.send(event));
    expect(heard).toEqual([event]);
  });

  it("keeps trying while the server stays down, waiting longer each time but never more than the cap", async () => {
    renderApp();
    await settle();
    act(() => FakeEventSource.latest.ready());
    const waits: number[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      act(() => FakeEventSource.latest.fail());
      const before = FakeEventSource.all.length;
      let waited = 0;
      while (FakeEventSource.all.length === before) {
        await advance(100);
        waited += 100;
        expect(waited).toBeLessThanOrEqual(RECONNECT_MS.max);
      }
      waits.push(waited);
    }
    expect(waits[0]).toBe(RECONNECT_MS.first);
    expect(waits[1]).toBeGreaterThan(waits[0]);
    expect(waits.at(-1)).toBe(RECONNECT_MS.max);
    expect(banner()).toBeInTheDocument();

    act(() => FakeEventSource.latest.ready());
    act(() => FakeEventSource.latest.fail());
    await advance(RECONNECT_MS.first);
    expect(FakeEventSource.latest.readyState).toBe(FakeEventSource.CONNECTING); // back to the first, short wait
  });

  it("refetches what the page shows after a reconnect, since changes made meanwhile were never reported", async () => {
    renderApp();
    await settle();
    expect(fetches).toBe(1);
    act(() => FakeEventSource.latest.ready());
    await settle();
    expect(fetches).toBe(1); // the first connection has nothing to catch up on

    act(() => FakeEventSource.latest.fail());
    await advance(RECONNECT_MS.first);
    act(() => FakeEventSource.latest.ready());
    await settle();
    expect(fetches).toBe(2);
  });

  it("also catches up when the browser restores a dropped connection by itself (pnpm play stopped and started)", async () => {
    renderApp();
    await settle();
    act(() => FakeEventSource.latest.ready());
    act(() => FakeEventSource.latest.drop());
    expect(banner()).toBeInTheDocument();
    await advance(RECONNECT_MS.max);
    expect(FakeEventSource.all).toHaveLength(1); // the browser is retrying; no second connection
    act(() => FakeEventSource.latest.ready());
    await settle();
    expect(banner()).not.toBeInTheDocument();
    expect(fetches).toBe(2);
  });

  it("stops reconnecting when the app closes", async () => {
    const view = renderApp();
    await settle();
    act(() => FakeEventSource.latest.ready());
    act(() => FakeEventSource.latest.fail());
    view.unmount();
    await advance(RECONNECT_MS.max);
    expect(FakeEventSource.all).toHaveLength(1);
  });
});
