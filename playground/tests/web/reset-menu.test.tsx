import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResetPreview, TargetData } from "../../server/types.ts";
import { ResetMenu } from "../../web/work/ResetMenu.tsx";

const TARGET = { id: "lc-0020" } as TargetData;
let preview: ResetPreview;
let order: string[];
let posts: unknown[];
const prepare = vi.fn(async () => {
  order.push("prepare");
  return true;
});

beforeEach(() => {
  preview = { open: null, attempts: 1, hints: 0, versions: 0, examLocked: false };
  order = [];
  posts = [];
  prepare.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.pathname !== "/api/study/reset/lc-0020") return Response.json({ error: "unexpected request" }, { status: 500 });
      if (method === "GET") return Response.json(preview);
      const body = JSON.parse(String(init?.body)) as { action: string };
      order.push("post");
      posts.push(body);
      return Response.json({ action: body.action });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onReset = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ResetMenu target={TARGET} prepare={prepare} onReset={onReset} />
    </QueryClientProvider>,
  );
  return { onReset };
}

/** Radix opens a menu on pointerdown, which jsdom's click does not send. */
async function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Reset options" }), { button: 0, ctrlKey: false });
  await screen.findByRole("menu");
}

async function enabledItem(name: RegExp) {
  const item = await screen.findByRole("menuitem", { name });
  await waitFor(() => expect(item).not.toHaveAttribute("aria-disabled"));
  return item;
}

describe("ResetMenu (item reset spec §5.2)", () => {
  it("cleans the code at once, after saving the editor's text", async () => {
    const { onReset } = renderMenu();
    await openMenu();
    await userEvent.click(await enabledItem(/^Clean code/));
    await waitFor(() => expect(onReset).toHaveBeenCalled());
    expect(posts).toEqual([{ action: "code" }]);
    expect(order).toEqual(["prepare", "post"]);
  });

  it("says why Discard attempt is off when no attempt is open", async () => {
    renderMenu();
    await openMenu();
    const discard = await screen.findByRole("menuitem", { name: /^Discard attempt/ });
    await waitFor(() => expect(discard).toHaveTextContent("No attempt is open."));
    expect(discard).toHaveAttribute("aria-disabled", "true");
  });

  it("asks before discarding, with what the attempt loses", async () => {
    preview = { ...preview, open: { hints: 2, minutes: 14 } };
    renderMenu();
    await openMenu();
    await userEvent.click(await enabledItem(/^Discard attempt/));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("You lose 2 hints and 14 min of this attempt.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(posts).toEqual([{ action: "attempt" }]));
  });

  it("erases only once the id is typed", async () => {
    renderMenu();
    await openMenu();
    await userEvent.click(await enabledItem(/^Erase everything/));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("This erases 1 attempt, 0 hints, its review schedule and 0 saved versions. It cannot be undone.");
    const erase = within(dialog).getByRole("button", { name: "Erase" });
    expect(erase).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Type lc-0020 to confirm/ }), "lc-0020");
    expect(erase).toBeEnabled();
    await userEvent.click(erase);
    await waitFor(() => expect(posts).toEqual([{ action: "all" }]));
  });

  it("posts nothing and never calls onReset when prepare (saving the editor's text) fails", async () => {
    prepare.mockRejectedValueOnce(new Error("Your code is not saved yet."));
    const toastError = vi.spyOn(toast, "error");
    const { onReset } = renderMenu();
    await openMenu();
    await userEvent.click(await enabledItem(/^Clean code/));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Your code is not saved yet."));
    expect(posts).toEqual([]);
    expect(onReset).not.toHaveBeenCalled();
    toastError.mockRestore();
  });

  it("locks Discard and Erase for an item with an exam attempt, and keeps Clean code", async () => {
    preview = { ...preview, open: { hints: 0, minutes: 3 }, examLocked: true };
    renderMenu();
    await openMenu();
    for (const name of [/^Discard attempt/, /^Erase everything/]) {
      const item = await screen.findByRole("menuitem", { name });
      await waitFor(() => expect(item).toHaveTextContent("Exam attempts are kept: only the code can be cleaned."));
      expect(item).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByRole("menuitem", { name: /^Clean code/ })).not.toHaveAttribute("aria-disabled");
  });
});
