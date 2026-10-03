import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { contentRoot } from "../../runner/src/paths.ts";
import { formCsrf, hostGuard } from "./guard.ts";
import { targetRoutes } from "./targets.ts";

export interface ServerContext {
  /** Folder that contains problems/ and concepts/. */
  root: string;
}

export function createApp(ctx: ServerContext) {
  const app = new Hono()
    .use("/api/*", hostGuard, formCsrf)
    .get("/api/health", (c) => c.json({ ok: true as const }, 200))
    .route("/api", targetRoutes(ctx.root));
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
