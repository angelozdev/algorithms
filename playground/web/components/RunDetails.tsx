import { CircleX } from "lucide-react";
import type { HarnessError } from "../../../runner/src/types.ts";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";

/** Values are shown in full up to this length (the terminal cuts at 100). */
export const DISPLAY_MAX = 2000;

export function formatMs(ms: number | undefined): string {
  if (ms === undefined) return "";
  return `${ms < 1 ? ms.toFixed(2) : Math.round(ms)} ms`;
}

export function ErrorBox({ title, error }: { title?: string; error: HarnessError }) {
  return (
    <Alert variant="destructive">
      <CircleX aria-hidden />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="space-y-1">
        <p className="font-mono text-xs">
          {error.kind}: {error.message}
        </p>
        {error.trace && <pre className="font-mono text-xs whitespace-pre-wrap">{error.trace}</pre>}
      </AlertDescription>
    </Alert>
  );
}
