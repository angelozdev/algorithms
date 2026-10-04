import { CircleX } from "lucide-react";
import type { ComponentProps } from "react";
import type { HarnessError } from "../../../runner/src/types.ts";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";

/**
 * `role` lets a caller override Alert's default `role="alert"` (for example to `undefined`, when this box is
 * already read as part of a table row rather than announced on its own). Forwarded through `...rest` instead
 * of a named, defaulted prop so that an explicit `role={undefined}` is distinguishable from not passing it.
 */
export function ErrorBox({ title, error, ...rest }: { title?: string; error: HarnessError } & Pick<ComponentProps<"div">, "role">) {
  return (
    <Alert variant="destructive" {...rest}>
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
