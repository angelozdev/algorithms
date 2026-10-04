export type ShortcutAction = "run" | "custom" | "save";

export function isApplePlatform(platform: string = typeof navigator === "undefined" ? "" : navigator.platform): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

const APPLE: Record<ShortcutAction, string> = { run: "⌘↵", custom: "⇧⌘↵", save: "⌘S" };
const OTHERS: Record<ShortcutAction, string> = { run: "Ctrl+Enter", custom: "Ctrl+Shift+Enter", save: "Ctrl+S" };

/** How a shortcut is written on this platform. The keys themselves are bound with "Mod", which follows the same rule. */
export function shortcut(action: ShortcutAction, apple: boolean = isApplePlatform()): string {
  return (apple ? APPLE : OTHERS)[action];
}
