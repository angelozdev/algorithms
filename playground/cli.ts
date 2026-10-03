import { parseArgs } from "node:util";
import { contentRoot } from "../runner/src/paths.ts";
import { listTargets, QueryError, resolveQuery } from "../runner/src/resolver.ts";
import { DEFAULT_PORT, routeFor, startPlayground } from "./start.ts";

const USAGE = `Usage: pnpm play [query] [--no-open] [--port <n>]

<query>: an id (lc-0001, hash-map/01), a LeetCode number (1), or part of a folder name (two-sum).`;

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    strict: true,
    options: { open: { type: "boolean", default: true }, port: { type: "string" } },
  });
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`--port must be a port number (got "${values.port}")`);
  const query = positionals.join(" ").trim();
  // Resolved before the server starts, so a bad query never leaves a server running.
  const route = query ? routeFor(resolveQuery(listTargets(contentRoot()), query)) : "/";
  const playground = await startPlayground({ route, open: values.open, port });
  process.stdout.write(`Playground: ${playground.url}  (Ctrl+C to stop)\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof QueryError) {
    const list = error.candidates.map((t) => `  ${t.id.padEnd(16)} ${t.title}`).join("\n");
    process.stderr.write(`${error.message}\n${list}${list ? "\n" : ""}`);
  } else {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}\n`);
  }
  process.exitCode = 1;
});
