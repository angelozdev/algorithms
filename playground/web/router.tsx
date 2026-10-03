import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ConnectionBanner } from "./components/ConnectionBanner.tsx";
import { NotFound } from "./components/NotFound.tsx";
import { ConceptPage } from "./routes/concept.tsx";
import { HomePage } from "./routes/home.tsx";

export const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-dvh flex-col">
      <ConnectionBanner />
      <Outlet />
      <Toaster position="bottom-right" theme="system" richColors />
    </div>
  ),
  notFoundComponent: () => <NotFound />,
});

export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
export const problemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/p/$id" });
export const exerciseRoute = createRoute({ getParentRoute: () => rootRoute, path: "/e/$concept/$nn" });
export const conceptRoute = createRoute({ getParentRoute: () => rootRoute, path: "/c/$slug", component: ConceptPage });

export const routeTree = rootRoute.addChildren([homeRoute, problemRoute, exerciseRoute, conceptRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
