import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { contentRoot } from "../../runner/src/paths.ts";
import { conceptRoutes } from "./concepts.ts";
import { EventHub, eventRoutes } from "./events.ts";
import { formCsrf, hostGuard } from "./guard.ts";
import { solutionRoutes } from "./solutions.ts";
import { targetRoutes } from "./targets.ts";

export interface ServerContext {
  /** Folder that contains problems/ and concepts/. */
  root: string;
}

export function createApp(ctx: ServerContext) {
  const hub = new EventHub(ctx.root);
  const app = new Hono()
    .use("/api/*", hostGuard, formCsrf)
    .get("/api/health", (c) => c.json({ ok: true as const }, 200))
    .route("/api", targetRoutes(ctx.root))
    .route("/api", solutionRoutes(ctx.root))
    .route("/api", conceptRoutes(ctx.root))
    .route("/api", eventRoutes(hub));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    console.error(error);
    return c.json({ error: error.message }, 500);
  });
  return app;
}

export type AppType = ReturnType<typeof createApp>;

/** The app Vite serves (@hono/vite-dev-server loads the default export). */
export default createApp({ root: contentRoot() });
