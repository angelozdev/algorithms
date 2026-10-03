import { useConnected } from "../events.tsx";

export function ConnectionBanner() {
  if (useConnected()) return null;
  return (
    <div role="alert" className="bg-red-600 px-3 py-1.5 text-center text-sm text-white">
      Disconnected — run <code>pnpm play</code> again. Unsaved changes stay in this tab and are saved when it reconnects.
    </div>
  );
}
