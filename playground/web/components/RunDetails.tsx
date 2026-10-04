import { CircleX } from "lucide-react";
import type { HarnessError } from "../../../runner/src/types.ts";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";

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
