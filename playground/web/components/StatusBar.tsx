import { cn } from "cn";
import { Check, CircleX, LoaderCircle, type LucideIcon, TriangleAlert } from "lucide-react";
import { useConnected } from "../events.tsx";
import type { SaveState } from "../hooks/useSolutionSync.ts";
import { Kbd } from "./ui/kbd.tsx";

export type SaveTone = "ok" | "busy" | "bad" | "warn";

export interface SaveLabel {
  text: string;
  tone: SaveTone;
}

const TONE: Record<SaveTone, { Icon: LucideIcon; className: string; iconClassName: string }> = {
  ok: { Icon: Check, className: "text-muted-foreground", iconClassName: "text-success" },
  busy: { Icon: LoaderCircle, className: "text-muted-foreground", iconClassName: "animate-spin" },
  bad: { Icon: CircleX, className: "text-destructive", iconClassName: "" },
  warn: { Icon: TriangleAlert, className: "text-warning", iconClassName: "" },
};

/** What the status bar says about solution.<ext>. Text typed while the server is down is not saved, whatever the state. */
export function solutionSaveLabel(state: SaveState, connected: boolean): SaveLabel {
  if (!connected && (state === "pending" || state === "saving")) return { text: "Not saved", tone: "bad" };
  switch (state) {
    case "loading":
      return { text: "Loading…", tone: "busy" };
    case "saved":
      return { text: "Saved", tone: "ok" };
    case "pending":
    case "saving":
      return { text: "Saving…", tone: "busy" };
    case "error":
      return { text: "Not saved", tone: "bad" };
    case "conflict":
      return { text: "Conflict", tone: "warn" };
  }
}

export interface Shortcut {
  keys: string;
  label: string;
}

/** A VS Code-like bar at the bottom of a page that edits a file: connection, what is edited, save state, shortcuts. */
export function StatusBar({ subject, save, shortcuts }: { subject: string; save: SaveLabel; shortcuts: readonly Shortcut[] }) {
  const connected = useConnected();
  const { Icon, className, iconClassName } = TONE[save.tone];
  return (
    <footer aria-label="Status bar" className="flex h-6 shrink-0 items-center gap-4 border-t bg-card px-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-warning")} />
        {connected ? "Connected" : "Reconnecting…"}
      </span>
      <span>{subject}</span>
      <span role="status" aria-label="Save status" className={cn("flex items-center gap-1", className)}>
        <Icon aria-hidden className={cn("size-3", iconClassName)} />
        {save.text}
      </span>
      <span className="ml-auto flex items-center gap-3">
        {shortcuts.map((item) => (
          <span key={item.label} className="flex items-center gap-1">
            <Kbd>{item.keys}</Kbd>
            {item.label}
          </span>
        ))}
      </span>
    </footer>
  );
}
