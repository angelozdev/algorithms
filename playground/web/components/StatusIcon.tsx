import type { ItemStatus } from "../../server/types.ts";

export function statusMark(status: ItemStatus, inProgress: boolean): { icon: string; label: string } {
  if (status === "solved") return { icon: "✅", label: "solved" };
  if (status === "revealed") return { icon: "👁", label: "revealed" };
  if (inProgress) return { icon: "⏳", label: "in progress" };
  return { icon: "○", label: "todo" };
}

export function StatusIcon({ status, inProgress }: { status: ItemStatus; inProgress: boolean }) {
  const mark = statusMark(status, inProgress);
  return (
    <span role="img" aria-label={mark.label} title={mark.label} className="inline-block w-5 text-center">
      {mark.icon}
    </span>
  );
}
