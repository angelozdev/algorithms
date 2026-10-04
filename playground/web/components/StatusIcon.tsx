import { cn } from "cn";
import { Circle, CircleCheck, Clock, Eye, type LucideIcon } from "lucide-react";
import type { ItemStatus } from "../../server/types.ts";
import { STATUS_LABEL, type StatusKind, statusKind } from "../lib/labels.ts";
import { Hint } from "./Hint.tsx";

const LOOK: Record<StatusKind, { Icon: LucideIcon; className: string }> = {
  "in-progress": { Icon: Clock, className: "text-warning" },
  todo: { Icon: Circle, className: "text-muted-foreground" },
  revealed: { Icon: Eye, className: "text-muted-foreground" },
  solved: { Icon: CircleCheck, className: "text-success" },
};

/** The status of a problem or exercise as an icon, named by the status for screen readers and tests, and on
 * hover for mouse users (as ErrorMark does). */
export function StatusIcon({ status, inProgress, className }: { status: ItemStatus; inProgress: boolean; className?: string }) {
  const kind = statusKind(status, inProgress);
  const { Icon, className: tone } = LOOK[kind];
  const label = STATUS_LABEL[kind];
  return (
    <Hint label={label}>
      <span role="img" aria-label={label} className={cn("inline-flex shrink-0", tone, className)}>
        <Icon aria-hidden className="size-4" />
      </span>
    </Hint>
  );
}
