import type { MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";

const LOCAL_NAMES = new Set(["127.0.0.1", "localhost"]);
const SAFE_METHOD = /^(GET|HEAD|OPTIONS)$/;

/** `127.0.0.1:4173` or `localhost`, any port. A rebinding attack changes the name, not the port. */
export function isLocalHost(host: string | undefined): boolean {
  const name = host === undefined ? undefined : /^([^:]+)(?::\d+)?$/.exec(host)?.[1];
  return name !== undefined && LOCAL_NAMES.has(name);
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && LOCAL_NAMES.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Only this machine may use the API: the Host must be local (blocks DNS rebinding), and a write that says
 * where it comes from must come from a local page. hono/csrf alone only checks form-encoded requests.
 */
export const hostGuard: MiddlewareHandler = async (c, next) => {
  if (!isLocalHost(c.req.header("host"))) return c.json({ error: "Forbidden: not a local host" }, 403);
  const origin = c.req.header("origin");
  if (origin !== undefined && !SAFE_METHOD.test(c.req.method) && !isLocalOrigin(origin)) {
    return c.json({ error: "Forbidden: request from another site" }, 403);
  }
  await next();
};

/** Form posts from other sites (no Origin needed to reject them). */
export const formCsrf = csrf({ origin: (origin) => isLocalOrigin(origin) });
