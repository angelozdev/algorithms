import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TodayJson } from "../../server/types.ts";
import { announcementText, reasonText, TodaySection, TodayView } from "../../web/home/TodaySection.tsx";
import { renderWithRouter } from "./render.tsx";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const PLAN: TodayJson = {
  initialized: true,
  started: true,
  date: "2026-10-05",
  paused: null,
  phase: { id: "learn", since: "2026-10-01T14:00:00.000Z", preset: "grind-75", progress: { done: 12, total: 75 }, list: { list: "grind-75", imported: 75, size: 75 }, expansion: null },
  announcements: [{ id: 3, key: "phase-advanced", at: "2026-10-05T14:00:00.000Z", payload: { from: "bases", to: "learn" } }],
  mode: "normal",
  items: [
    { kind: "continue", id: "hash-map/01", title: "First repeat", minutes: 15, reason: "in progress · hash-map", done: false, missing: false },
    { kind: "review", id: "lc-0020", title: "Valid Parentheses", minutes: 9, reason: "due 2 days ago", done: true, missing: false },
    { kind: "new", id: "lc-0001", title: "Two Sum", minutes: 15, reason: "block 1/3 · arrays-hashing", done: false, missing: false },
    { kind: "concept", id: "two-pointers", title: "Two pointers", minutes: 20, reason: "opens two-pointers", done: false, missing: false },
    { kind: "concept", id: "string-parsing", title: "string-parsing", minutes: 20, reason: "opens strings", done: false, missing: true },
  ],
  backlog: { waiting: 4, days: 2 },
  budget: { minutes: 45, planned: 79 },
};

const noop = { onAck: () => {}, onPause: () => {}, onResume: () => {}, busy: false };
const region = () => screen.getByRole("region", { name: "Today" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TodayView (spec §11)", () => {
  it("lists today's items as links to where they are worked, with their kind, reason and minutes", async () => {
    await renderWithRouter(<TodayView data={PLAN} {...noop} />);
    const plan = within(region()).getByRole("list", { name: "Today's plan" });
    const rows = within(plan).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Continuehash-map/01First repeatin progress · hash-map15 min",
      "Reviewlc-0020Valid Parenthesesdue 2 days ago9 min",
      "Newlc-0001Two Sumblock 1/3 · Arrays & hashing15 min",
      "ConceptTwo pointersopens Two pointers20 min",
      "Conceptstring-parsing · not in the repo yet: ask Claude to create itopens Strings20 min",
    ]);
    expect(within(plan).getByRole("link", { name: "hash-map/01 First repeat" })).toHaveAttribute("href", "/e/hash-map/01");
    expect(within(plan).getByRole("link", { name: "lc-0020 Valid Parentheses" })).toHaveAttribute("href", "/p/lc-0020");
    expect(within(plan).getByRole("link", { name: "two-pointers Two pointers" })).toHaveAttribute("href", "/c/two-pointers");
    expect(within(plan).queryByRole("link", { name: /string-parsing/ })).not.toBeInTheDocument();
    expect(within(rows[1]).getByRole("img", { name: "Done" })).toBeInTheDocument();
    expect(within(region()).getByText("Phase 1 · Learn the list · 12/75")).toBeInTheDocument();
    expect(within(region()).getByText("4 more review(s) wait for the coming days (about 2 day(s)).")).toBeInTheDocument();
  });

  it("shows each announcement once until acknowledged", async () => {
    const onAck = vi.fn();
    await renderWithRouter(<TodayView data={PLAN} {...noop} onAck={onAck} />);
    const banner = within(region()).getByRole("status");
    expect(banner).toHaveTextContent("New phase: 1 · Learn the list. You finished 0 · Bases.");
    await userEvent.click(within(banner).getByRole("button", { name: "Got it" }));
    expect(onAck).toHaveBeenCalledWith(3);
  });

  it("pauses, and while paused says so and offers to resume", async () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const { unmount } = await renderWithRouter(<TodayView data={PLAN} {...noop} onPause={onPause} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalled();
    unmount();
    await renderWithRouter(<TodayView data={{ ...PLAN, paused: { since: "2026-10-05T14:00:00.000Z" }, items: [] }} {...noop} onResume={onResume} />);
    expect(screen.getByText(/^Paused since/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(onResume).toHaveBeenCalled();
  });

  it("says what to run before the store exists, and before the coach starts", async () => {
    const { unmount } = await renderWithRouter(<TodayView data={{ initialized: false, next: "migrate" }} {...noop} />);
    expect(region()).toHaveTextContent("Your progress is not set up yet. Run pnpm study migrate");
    unmount();
    await renderWithRouter(<TodayView data={{ ...PLAN, started: false, phase: null, announcements: [], items: [] }} {...noop} />);
    expect(region()).toHaveTextContent("The coach has not started yet.");
  });

  it("warns about a partially imported list and a missing expansion choice", async () => {
    await renderWithRouter(
      <TodayView
        data={{ ...PLAN, phase: { ...PLAN.phase!, id: "expand", list: { list: "grind-169", imported: 100, size: 169 }, expansion: { list: null, choices: ["grind-169"] } } }}
        {...noop}
      />,
    );
    expect(region()).toHaveTextContent("Only 100 of the 169 problems of Grind 169 are imported.");
    expect(region()).toHaveTextContent("Choose the list to expand with: ask Claude.");
  });

  it("words announcements and reasons for people", () => {
    expect(announcementText({ id: 1, key: "welcome-back", at: "", payload: { date: "2026-10-05", daysAway: 9 } })).toBe(
      "Welcome back after 9 days! Today starts with the reviews you are most likely to remember.",
    );
    expect(announcementText({ id: 2, key: "curriculum-switched", at: "", payload: { from: { preset: "grind-75", phase: "master" }, to: { preset: "grind-169", phase: "learn" } } })).toBe(
      "Switched to Grind 169: phase 1 · Learn the list.",
    );
    expect(reasonText("mix · dp-1d")).toBe("mix · 1-D DP");
  });
});

describe("TodaySection", () => {
  it("loads today's plan and acknowledges an announcement through the API", async () => {
    let acked = false;
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(`${init?.method ?? "GET"} ${new URL(url, "http://localhost").pathname}`);
      if (url.includes("/api/study/ack/3")) {
        acked = true;
        return Response.json({ acked: true });
      }
      return Response.json(acked ? { ...PLAN, announcements: [] } : PLAN);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await renderWithRouter(
      <QueryClientProvider client={client}>
        <TodaySection />
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(calls).toEqual(["GET /api/study/today", "POST /api/study/ack/3", "GET /api/study/today"]);
  });

  it("toasts the server's error when Pause fails, instead of leaving the user with no feedback", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/api/study/pause")) return Response.json({ error: "Already paused." }, { status: 409 });
      return Response.json(PLAN);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await renderWithRouter(
      <QueryClientProvider client={client}>
        <TodaySection />
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Pause" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Already paused."));
  });
});
