import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import type { Target } from "../runner/src/types.ts";

export const DEFAULT_PORT = 4173;
const CONFIG = fileURLToPath(new URL("./vite.config.ts", import.meta.url));

/** App route of a problem or an exercise: /p/lc-0001 or /e/hash-map/01. */
export function routeFor(target: Target): string {
  return target.kind === "problem" ? `/p/${target.id}` : `/e/${target.id}`;
}

export interface Playground {
  url: string;
  close(): Promise<void>;
}

/** Starts the Vite dev server (React app + /api) on 127.0.0.1. Takes the next free port unless strictPort. */
export async function startPlayground(options: {
  route: string;
  open: boolean;
  port?: number;
  strictPort?: boolean;
}): Promise<Playground> {
  const server = await createServer({
    configFile: CONFIG,
    logLevel: "warn",
    server: {
      host: "127.0.0.1",
      port: options.port ?? DEFAULT_PORT,
      strictPort: options.strictPort ?? false,
      open: options.open ? options.route : false,
    },
  });
  await server.listen();
  const base = server.resolvedUrls?.local[0];
  if (!base) {
    await server.close();
    throw new Error("the playground server did not report its address");
  }
  return { url: new URL(options.route, base).href, close: () => server.close() };
}
