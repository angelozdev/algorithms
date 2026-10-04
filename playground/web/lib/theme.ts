import { useSyncExternalStore } from "react";

const QUERY = "(prefers-color-scheme: dark)";

/** Follows the operating system's light/dark setting. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
