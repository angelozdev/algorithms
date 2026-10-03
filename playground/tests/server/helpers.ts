import type { createApp } from "../../server/app.ts";

export const HOST = "127.0.0.1:4173";
export const ORIGIN = `http://${HOST}`;
export type App = ReturnType<typeof createApp>;

/** Calls the app the way the browser does: a local Host header, and for JSON bodies a local Origin. */
export function call(
  app: App,
  url: string,
  init: { method?: string; json?: unknown; headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { host: HOST, ...init.headers };
  let body: string | undefined;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    headers.origin ??= ORIGIN;
    body = JSON.stringify(init.json);
  }
  return Promise.resolve(app.request(url, { method: init.method ?? (body ? "POST" : "GET"), headers, body }));
}
