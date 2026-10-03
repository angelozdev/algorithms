import { act, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SaveResult } from "../../web/api.ts";
import { type SolutionSource, type SolutionSync, useSolutionSync } from "../../web/hooks/useSolutionSync.ts";
import { useUnsavedGuard } from "../../web/hooks/useUnsavedGuard.ts";
import { renderWithRouter } from "./render.tsx";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const LEAVE = "You have unsaved changes in solution.py. Leave anyway?";

/** A solution file behind a server that can go down (every save throws) and come back. */
function server() {
  const state = { up: true, saves: [] as string[], text: "start" };
  const source: SolutionSource = {
    load: async () => ({ code: state.text, version: `v:${state.text}` }),
    save: async (code: string, base: string): Promise<SaveResult> => {
      if (!state.up) throw new Error("Failed to fetch");
      if (base !== `v:${state.text}`) return { ok: false, current: { code: state.text, version: `v:${state.text}` } };
      state.text = code;
      state.saves.push(code);
      return { ok: true, version: `v:${code}` };
    },
  };
  return { state, source };
}

/** The work view's editor bookkeeping: the solution sync, the live connection flag and the guard. */
async function renderEditor(source: SolutionSource, initiallyConnected: boolean) {
  const view = { sync: null as unknown as SolutionSync, lock: null as string | null, setConnected: (_value: boolean) => {} };
  function Editor() {
    const [connected, setConnected] = useState(initiallyConnected);
    view.sync = useSolutionSync(source);
    view.lock = useUnsavedGuard(view.sync, connected, "solution.py");
    view.setConnected = setConnected;
    return <p>{view.sync.code === null ? "loading" : "ready"}</p>;
  }
  const { router } = await renderWithRouter(<Editor />);
  await screen.findByText("ready");
  return { view, router };
}

/** Tries to leave for another page; returns whether the app asked first. */
async function tryToLeave(router: Awaited<ReturnType<typeof renderEditor>>["router"], confirm: ReturnType<typeof vi.spyOn>) {
  confirm.mockClear();
  await act(async () => router.history.push("/elsewhere"));
  return confirm.mock.calls.length > 0;
}

afterEach(() => vi.restoreAllMocks());

describe("useUnsavedGuard", () => {
  it("while the server is unreachable, asks before leaving from the first keystroke on, with no gap between keystrokes", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false); // the user stays
    const { state, source } = server();
    state.up = false;
    const { view, router } = await renderEditor(source, false);

    act(() => view.sync.edit("typed while down"));
    expect(view.lock).toBe("Not saved yet: the playground server is not running");
    expect(await tryToLeave(router, confirm)).toBe(true);
    expect(confirm).toHaveBeenCalledWith(LEAVE);

    await waitFor(() => expect(view.sync.state).toBe("error"));
    act(() => view.sync.edit("typed while down, more"));
    expect(view.sync.state).toBe("pending");
    expect(view.lock).not.toBeNull();
    expect(await tryToLeave(router, confirm)).toBe(true);
    expect(router.history.location.pathname).toBe("/");

    // The server is back: the reconnect sends the text, and leaving no longer asks.
    state.up = true;
    act(() => view.setConnected(true));
    await act(async () => {
      await view.sync.flush();
    });
    expect(state.saves).toEqual(["typed while down, more"]);
    expect(view.lock).toBeNull();
    expect(await tryToLeave(router, confirm)).toBe(false);
    expect(router.history.location.pathname).toBe("/elsewhere");
  });

  it("after a failed save, keeps asking while the user types on, until a save succeeds", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { state, source } = server();
    const failOnce = vi.spyOn(source, "save").mockRejectedValueOnce(new Error("disk full"));
    const { view, router } = await renderEditor(source, true);

    act(() => view.sync.edit("first"));
    await waitFor(() => expect(view.sync.state).toBe("error"));
    expect(view.lock).toBe("Not saved yet: press ⌘S to retry first");

    act(() => view.sync.edit("first, then more"));
    expect(view.sync.state).toBe("pending");
    expect(view.lock).toBe("Not saved yet: press ⌘S to retry first");
    expect(await tryToLeave(router, confirm)).toBe(true);

    await waitFor(() => expect(view.sync.state).toBe("saved"));
    expect(failOnce).toHaveBeenCalledTimes(2);
    expect(state.saves).toEqual(["first, then more"]);
    expect(view.lock).toBeNull();
    expect(await tryToLeave(router, confirm)).toBe(false);
  });

  it("never asks while typing with a healthy server: leaving saves the text on the way out", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const { source } = server();
    const { view, router } = await renderEditor(source, true);
    act(() => view.sync.edit("typing"));
    expect(view.sync.state).toBe("pending");
    expect(view.lock).toBeNull();
    expect(await tryToLeave(router, confirm)).toBe(false);
    expect(router.history.location.pathname).toBe("/elsewhere");
  });

  it("asks while a conflict waits for the user, connected or not", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { state, source } = server();
    const { view, router } = await renderEditor(source, true);
    act(() => view.sync.edit("mine"));
    state.text = "theirs"; // written outside the browser before the autosave
    await waitFor(() => expect(view.sync.state).toBe("conflict"));
    expect(view.lock).toBe("Resolve the conflict first");
    expect(await tryToLeave(router, confirm)).toBe(true);
    act(() => view.setConnected(false));
    expect(view.lock).toBe("Resolve the conflict first");
  });
});
