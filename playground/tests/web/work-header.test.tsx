import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomeData, TargetData } from "../../server/types.ts";
import { keys } from "../../web/api.ts";
import { WorkHeader, type WorkHeaderProps } from "../../web/work/WorkHeader.tsx";
import { renderWithRouter } from "./render.tsx";

const target = (extra: Partial<TargetData> = {}): TargetData => ({
  id: "lc-0021",
  kind: "problem",
  title: "Merge Two Sorted Lists",
  readme: "problems/lc-0021-merge-two-sorted-lists/README.md",
  markdown: "",
  readmeError: null,
  difficulty: "medium",
  url: "https://leetcode.com/problems/merge-two-sorted-lists/",
  status: "solving",
  hints: 1,
  signature: null,
  exampleInput: null,
  caseError: null,
  solutions: { py: true, ts: false },
  ...extra,
});

const HOME: HomeData = {
  problems: [
    { id: "lc-0021", title: "Merge Two Sorted Lists", difficulty: "medium", patterns: ["linked-list", "two-pointers"], concepts: [], status: "solving", inProgress: true, error: null },
  ],
  groups: [],
  concepts: [{ slug: "hash-map", title: "Hash map", status: "learning", error: null, exercises: [] }],
};

afterEach(() => vi.unstubAllGlobals());

async function renderHeader(data: TargetData, home: HomeData | null, props: Partial<WorkHeaderProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  if (home) client.setQueryData(keys.home, home);
  else vi.stubGlobal("fetch", () => new Promise(() => {})); // the home data never arrives
  const handlers = { onLang: vi.fn(), onRun: vi.fn() };
  await renderWithRouter(
    <QueryClientProvider client={client}>
      <WorkHeader target={data} lang="py" running={false} elapsedMs={0} canRun langLock={null} {...handlers} {...props} />
    </QueryClientProvider>,
  );
  return handlers;
}

const trailLinks = () => within(screen.getByRole("navigation", { name: "breadcrumb" })).getAllByRole("link");

describe("WorkHeader", () => {
  it("shows where a problem sits: home, its first pattern, then the problem itself", async () => {
    await renderHeader(target(), HOME);
    const links = trailLinks();
    expect(links.map((link) => link.textContent)).toEqual(["Algorithms", "Linked list", "lc-0021 Merge Two Sorted Lists"]);
    expect(links[0]).toHaveAttribute("href", "/");
    expect(new URL(links[1]!.getAttribute("href")!, "http://localhost").searchParams.get("pattern")).toBe('["linked-list"]');
    expect(links[2]).toHaveAttribute("aria-current", "page");
  });

  it("shows where an exercise sits: home, Concepts, its concept, then the exercise", async () => {
    await renderHeader(target({ id: "hash-map/01", kind: "exercise", title: "First repeat", difficulty: null, url: null }), HOME);
    expect(trailLinks().map((link) => link.textContent)).toEqual(["Algorithms", "Hash map", "01 First repeat"]);
    expect(trailLinks()[1]).toHaveAttribute("href", "/c/hash-map");
    expect(within(screen.getByRole("navigation", { name: "breadcrumb" })).getByText("Concepts")).toBeInTheDocument();
  });

  it("leaves the middle of the trail out until the home data is there", async () => {
    await renderHeader(target(), null);
    expect(trailLinks().map((link) => link.textContent)).toEqual(["Algorithms", "lc-0021 Merge Two Sorted Lists"]);
  });

  it("shows the difficulty, the status, the hints and the original link", async () => {
    await renderHeader(target(), HOME);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("1 hint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the original problem" })).toHaveAttribute("href", "https://leetcode.com/problems/merge-two-sorted-lists/");
  });

  it("reads a todo problem with a solution file on disk as in progress, like the home page does", async () => {
    await renderHeader(target({ status: "todo", solutions: { py: true, ts: false } }), HOME);
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.queryByText("To do")).not.toBeInTheDocument();
  });

  it("switches the language and runs the tests", async () => {
    const { onLang, onRun } = await renderHeader(target(), HOME);
    await userEvent.click(screen.getByRole("radio", { name: "ts" }));
    expect(onLang).toHaveBeenCalledWith("ts");
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("locks the language switch and says why when nothing would save the text", async () => {
    await renderHeader(target(), HOME, { langLock: "Resolve the conflict first" });
    expect(screen.getByRole("radio", { name: "ts" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "py" })).toBeDisabled(); // the active language too, not just the one not in use
    await userEvent.hover(screen.getByRole("radiogroup", { name: "Language" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Resolve the conflict first");
  });

  it("shows the run time while the tests run", async () => {
    await renderHeader(target(), HOME, { running: true, canRun: false, elapsedMs: 1234 });
    expect(screen.getByRole("button", { name: "Running… 1.2 s" })).toBeDisabled();
  });
});
