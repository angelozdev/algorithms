import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EventsProvider } from "./events.tsx";
import { router } from "./router.tsx";
import "./styles.css";

// A 404 or a case-file error will not fix itself by retrying; live events refresh what changes.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

// Vite's dev client reloads the page once `pnpm play` is back after a restart. That reload would stop on the
// "Leave site?" prompt, or drop what only this tab holds (an edit not saved yet, run results); the app reconnects
// by itself instead (events.tsx). Vite awaits these listeners before it reloads, so one that never settles keeps
// the page. Hot updates then stay off in this tab until it is reloaded by hand.
import.meta.hot?.on("vite:ws:disconnect", () => new Promise<never>(() => {}));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <EventsProvider>
        <RouterProvider router={router} />
      </EventsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
