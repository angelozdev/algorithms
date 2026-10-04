import { TriangleAlert } from "lucide-react";
import { useConnected } from "../events.tsx";
import { Alert, AlertDescription } from "./ui/alert.tsx";

/** Loud on purpose: without the server, nothing is saved. The status bar's dot says the same, quietly. */
export function ConnectionBanner() {
  if (useConnected()) return null;
  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <TriangleAlert aria-hidden />
      <AlertDescription className="text-foreground">
        Disconnected — run <code className="font-mono">pnpm play</code> again. Unsaved changes stay in this tab and are saved when it reconnects.
      </AlertDescription>
    </Alert>
  );
}
