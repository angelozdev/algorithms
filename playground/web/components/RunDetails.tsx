import type { HarnessError } from "../../../runner/src/types.ts";

/** Values are shown in full up to this length (the terminal cuts at 100). */
export const DISPLAY_MAX = 2000;

export function formatMs(ms: number | undefined): string {
  if (ms === undefined) return "";
  return `${ms < 1 ? ms.toFixed(2) : Math.round(ms)} ms`;
}

export function ErrorBox({ title, error }: { title?: string; error: HarnessError }) {
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm dark:border-red-800 dark:bg-red-950">
      {title && <p className="font-medium">{title}</p>}
      <p className="font-mono text-xs">
        {error.kind}: {error.message}
      </p>
      {error.trace && <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{error.trace}</pre>}
    </div>
  );
}
