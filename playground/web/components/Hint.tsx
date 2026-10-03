import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.tsx";

/**
 * A tooltip around one element. Each hint brings its own provider, so components work (and are tested) on their
 * own. A hint repeats what the element's accessible name or visible text already says; it never carries
 * information found nowhere else.
 */
export function Hint({ label, children, side = "bottom" }: { label: ReactNode; children: ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
