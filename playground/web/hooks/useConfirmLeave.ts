import { useBlocker } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * While `unsaved` is true, asks before the page goes away with text that is not on disk: a link, Home or
 * Back shows `message` in a confirm dialog, and closing or reloading the tab shows the browser's own
 * "Leave site?" prompt. When `unsaved` is false no blocker is registered at all, so nothing ever asks.
 */
export function useConfirmLeave(unsaved: boolean, message: string): void {
  // Returning true blocks the navigation: the user chose to stay.
  const shouldBlockFn = useCallback(() => !window.confirm(message), [message]);
  useBlocker({ shouldBlockFn, enableBeforeUnload: unsaved, disabled: !unsaved });
}
