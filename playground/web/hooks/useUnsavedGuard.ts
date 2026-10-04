import { useConfirmLeave } from "./useConfirmLeave.ts";
import type { SolutionSync } from "./useSolutionSync.ts";

/**
 * Why leaving the editor now could lose its text, or null when it cannot. Text that is not on disk is at risk
 * when nothing will save it by itself: a conflict waits for the user, a save failed (until one succeeds, so
 * typing on does not make it look safe), or the playground server is unreachable. While it is at risk, the
 * language switch stays locked (the reason is its tooltip) and leaving the page asks first. Typing with a
 * healthy server is not at risk: the pending save is sent on the way out.
 */
export function useUnsavedGuard(sync: SolutionSync, connected: boolean, file: string): string | null {
  let reason: string | null = null;
  if (sync.unsaved) {
    if (sync.state === "conflict") reason = "Resolve the conflict first";
    else if (!connected) reason = "Not saved yet: the playground server is not running";
    else if (sync.failing) reason = "Not saved yet: press ⌘S to retry first";
  }
  useConfirmLeave(reason !== null, `You have unsaved changes in ${file}. Leave anyway?`);
  return reason;
}
