import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveResult } from "../../web/api.ts";
import { AUTOSAVE_MS, type SolutionSource, useSolutionSync } from "../../web/hooks/useSolutionSync.ts";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/** An in-memory solution file that follows the server's version rules. */
function fakeFile(initial: string) {
  const file = { text: initial, saves: [] as string[] };
  const version = (text: string) => `v:${text}`;
  const source = {
    load: vi.fn(async () => ({ code: file.text, version: version(file.text) })),
    save: vi.fn(async (code: string, base: string): Promise<SaveResult> => {
      if (base !== version(file.text)) return { ok: false, current: { code: file.text, version: version(file.text) } };
      file.text = code;
      file.saves.push(code);
      return { ok: true, version: version(code) };
    }),
  } satisfies SolutionSource;
  /** Someone else (VS Code, git) writes the file. Returns the new version. */
  const writeOutside = (text: string) => {
    file.text = text;
    return version(text);
  };
  return { file, source, version, writeOutside };
}

/** Lets pending promise chains (loads, saves) finish. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });

const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await settle();
};

async function mount(source: SolutionSource, onReloaded?: () => void) {
  const hook = renderHook(() => useSolutionSync(source, onReloaded));
  await settle();
  return hook;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useSolutionSync", () => {
  it("loads the file, then saves once, 500 ms after the last edit", async () => {
    const { file, source } = fakeFile("start");
    const { result } = await mount(source);
    expect(result.current).toMatchObject({ code: "start", state: "saved" });
    act(() => result.current.edit("a"));
    await wait(300);
    act(() => result.current.edit("ab"));
    await wait(AUTOSAVE_MS - 1);
    expect(file.saves).toEqual([]);
    expect(result.current.state).toBe("pending");
    await wait(1);
    expect(file.saves).toEqual(["ab"]);
    expect(result.current.state).toBe("saved");
  });

  it("flush saves a pending edit right away and resolves true once it is on disk", async () => {
    const { file, source } = fakeFile("start");
    const { result } = await mount(source);
    act(() => result.current.edit("x"));
    let saved = false;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(true);
    expect(file.saves).toEqual(["x"]);
  });

  it("flush waits for a save that is already running (Run right after typing)", async () => {
    const { file, source } = fakeFile("start");
    let release = () => {};
    source.save.mockImplementationOnce(async (code: string) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      file.text = code;
      file.saves.push(code);
      return { ok: true, version: `v:${code}` };
    });
    const { result } = await mount(source);
    act(() => result.current.edit("slow"));
    await wait(AUTOSAVE_MS);
    expect(result.current.state).toBe("saving");
    let flushed: boolean | null = null;
    const flushing = result.current.flush().then((ok) => {
      flushed = ok;
    });
    await settle();
    expect(flushed).toBeNull();
    release();
    await act(async () => {
      await flushing;
    });
    expect(flushed).toBe(true);
    expect(file.saves).toEqual(["slow"]);
  });

  it("reloads a clean editor when the file changes on disk, and ignores its own saves", async () => {
    const { file, source, version, writeOutside } = fakeFile("start");
    const onReloaded = vi.fn();
    const { result } = await mount(source, onReloaded);
    act(() => result.current.edit("mine"));
    await wait(AUTOSAVE_MS);
    expect(file.saves).toEqual(["mine"]);
    act(() => result.current.diskChanged(version("mine")));
    await settle();
    expect(source.load).toHaveBeenCalledTimes(1);

    const outside = writeOutside("from VS Code");
    act(() => result.current.diskChanged(outside));
    await settle();
    expect(result.current).toMatchObject({ code: "from VS Code", state: "saved" });
    expect(onReloaded).toHaveBeenCalledTimes(1);
  });

  it("keeps a clean editor's text unchanged and reports a failed reload instead of losing it silently", async () => {
    const { source } = fakeFile("start");
    const { result } = await mount(source);
    source.load.mockRejectedValueOnce(new Error("disk unreadable"));
    act(() => result.current.diskChanged("v:someone-else"));
    await settle();
    expect(source.load).toHaveBeenCalledTimes(2); // once on mount, once for this reload attempt
    expect(result.current.code).toBe("start");
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("disk unreadable"));
  });

  it("never overwrites a file that changed on disk: conflict, then the disk version or mine", async () => {
    const { file, source, writeOutside } = fakeFile("start");
    const { result } = await mount(source);
    act(() => result.current.edit("mine"));
    writeOutside("theirs");
    await wait(AUTOSAVE_MS);
    expect(result.current.state).toBe("conflict");
    expect(result.current.conflict?.code).toBe("theirs");
    act(() => result.current.edit("mine, still typing"));
    await wait(AUTOSAVE_MS);
    expect(file.saves).toEqual([]);
    expect(file.text).toBe("theirs");

    act(() => result.current.takeDisk());
    expect(result.current).toMatchObject({ code: "theirs", state: "saved", conflict: null });

    act(() => result.current.edit("mine again"));
    writeOutside("theirs again");
    await wait(AUTOSAVE_MS);
    expect(result.current.state).toBe("conflict");
    await act(async () => {
      await result.current.keepMine();
    });
    expect(file.text).toBe("mine again");
    expect(result.current.state).toBe("saved");
  });

  it("saves the last edit when the editor closes (route change or language switch)", async () => {
    const { file, source } = fakeFile("start");
    const { result, unmount } = await mount(source);
    act(() => result.current.edit("typed just before leaving"));
    unmount();
    await settle();
    expect(file.saves).toEqual(["typed just before leaving"]);
  });

  it("reports a conflict that only resolves after unmount instead of losing the edit silently", async () => {
    const { file, source, writeOutside } = fakeFile("start");
    const { result, unmount } = await mount(source);
    act(() => result.current.edit("typed just before leaving"));
    writeOutside("someone else's edit");
    unmount();
    await settle();
    expect(file.saves).toEqual([]); // the flush-on-exit save lost the version race; nothing was written
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("changed on disk"));
  });

  it("warns when the editor closes while an already-open conflict was never resolved", async () => {
    const { source, writeOutside } = fakeFile("start");
    const { result, unmount } = await mount(source);
    act(() => result.current.edit("mine"));
    writeOutside("theirs");
    await wait(AUTOSAVE_MS);
    // The conflict is already open and shown (not racing with unmount this time); edit() stopped
    // scheduling autosave the moment it appeared, so nothing else would ever warn about this edit.
    expect(result.current.state).toBe("conflict");
    unmount();
    await settle();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("changed on disk"));
  });

  it("does not warn on unmount once the editor's text matches the disk version shown in the conflict", async () => {
    const { source, writeOutside } = fakeFile("start");
    const { result, unmount } = await mount(source);
    act(() => result.current.edit("mine"));
    writeOutside("theirs");
    await wait(AUTOSAVE_MS);
    expect(result.current.state).toBe("conflict");
    act(() => result.current.edit("theirs")); // retyped to match disk by hand, without clicking either button
    unmount();
    await settle();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports a save error that only resolves after unmount instead of losing the edit silently", async () => {
    const { file, source } = fakeFile("start");
    source.save.mockRejectedValueOnce(new Error("server offline"));
    const { result, unmount } = await mount(source);
    act(() => result.current.edit("typed just before leaving"));
    unmount();
    await settle();
    expect(file.saves).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("server offline"));
  });

  it("saves the last edit when the tab closes", async () => {
    const { file, source } = fakeFile("start");
    const { result } = await mount(source);
    act(() => result.current.edit("typed just before closing"));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await settle();
    expect(file.saves).toEqual(["typed just before closing"]);
  });

  it("reports a failed save and retries on flush", async () => {
    const { file, source } = fakeFile("start");
    source.save.mockRejectedValueOnce(new Error("server offline"));
    const { result } = await mount(source);
    act(() => result.current.edit("x"));
    await wait(AUTOSAVE_MS);
    expect(result.current).toMatchObject({ state: "error", error: "server offline" });
    let saved = false;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(true);
    expect(file.saves).toEqual(["x"]);
    expect(result.current.state).toBe("saved");
  });
});
