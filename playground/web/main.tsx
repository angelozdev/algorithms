import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EventsProvider } from "./events.tsx";
import { router } from "./router.tsx";
import "./styles.css";

// A 404 or a case-file error will not fix itself by retrying; live events refresh what changes.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <EventsProvider>
        <RouterProvider router={router} />
      </EventsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
