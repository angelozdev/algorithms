import { describe, expect, it } from "vitest";
import { isApplePlatform, shortcut } from "../../web/lib/keys.ts";

describe("shortcut labels", () => {
  it("shows ⌘ on Apple platforms and Ctrl elsewhere", () => {
    expect(isApplePlatform("MacIntel")).toBe(true);
    expect(isApplePlatform("iPad")).toBe(true);
    expect(isApplePlatform("Win32")).toBe(false);
    expect(isApplePlatform("Linux x86_64")).toBe(false);
    expect([shortcut("run", true), shortcut("custom", true), shortcut("save", true)]).toEqual(["⌘↵", "⇧⌘↵", "⌘S"]);
    expect([shortcut("run", false), shortcut("custom", false), shortcut("save", false)]).toEqual([
      "Ctrl+Enter",
      "Ctrl+Shift+Enter",
      "Ctrl+S",
    ]);
  });
});
