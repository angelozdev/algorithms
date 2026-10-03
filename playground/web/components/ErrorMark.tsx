import { TriangleAlert } from "lucide-react";
import { Hint } from "./Hint.tsx";

/** A warning icon for a file that cannot be read; the error is its accessible name and its tooltip. */
export function ErrorMark({ error, label = "Broken README" }: { error: string; label?: string }) {
  return (
    <Hint label={error}>
      <span role="img" aria-label={`${label}: ${error}`} className="inline-flex shrink-0 text-warning">
        <TriangleAlert aria-hidden className="size-4" />
      </span>
    </Hint>
  );
}
