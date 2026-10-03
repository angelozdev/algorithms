import { createRootRoute, createRoute, createRouter, Outlet, stripSearchParams } from "@tanstack/react-router";
import { ConnectionBanner } from "./components/ConnectionBanner.tsx";
import { NotFound } from "./components/NotFound.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import { DEFAULT_SEARCH, homeSearchSchema } from "./home/search.ts";
import { ConceptPage } from "./routes/concept.tsx";
import { HomePage } from "./routes/home.tsx";
import { ExercisePage, ProblemPage } from "./routes/work.tsx";

export const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-dvh flex-col">
      <ConnectionBanner />
      <Outlet />
      <Toaster position="bottom-right" />
    </div>
  ),
  notFoundComponent: () => <NotFound />,
});

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
  // The list's grouping, sorting and filters live in the URL; defaults stay out of it (spec §4.3).
  validateSearch: homeSearchSchema,
  search: { middlewares: [stripSearchParams(DEFAULT_SEARCH)] },
});
export const problemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/p/$id", component: ProblemPage });
export const exerciseRoute = createRoute({ getParentRoute: () => rootRoute, path: "/e/$concept/$nn", component: ExercisePage });
export const conceptRoute = createRoute({ getParentRoute: () => rootRoute, path: "/c/$slug", component: ConceptPage });

export const routeTree = rootRoute.addChildren([homeRoute, problemRoute, exerciseRoute, conceptRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
