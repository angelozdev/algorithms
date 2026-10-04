/** Values are shown in full up to this length (the terminal cuts at 100). */
export const DISPLAY_MAX = 2000;

export function formatMs(ms: number | undefined): string {
  if (ms === undefined) return "";
  return `${ms < 1 ? ms.toFixed(2) : Math.round(ms)} ms`;
}
