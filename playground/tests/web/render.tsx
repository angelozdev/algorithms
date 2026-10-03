import { act, render } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Renders `ui` inside a memory router, so TanStack Router <Link>s get their hrefs. */
export async function renderWithRouter(ui: ReactNode, path = "/") {
  const rootRoute = createRootRoute({ component: () => <>{ui}</> });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: [path] }) });
  await act(() => router.load());
  return { router, ...render(<RouterProvider router={router} />) };
}
