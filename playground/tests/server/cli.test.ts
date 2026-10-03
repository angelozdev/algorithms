import { spawnSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../../runner/src/paths.ts";
import { makeProblem, removeTemp, tempDir } from "../../../runner/tests/helpers.ts";
import { startPlayground } from "../../start.ts";

/**
 * A raw request via node:http. fetch() forbids setting an `Origin` header (the Fetch spec treats it as a
 * forbidden request header), so this is the only way to probe how the server answers a cross-origin request.
 */
function rawRequest(url: string, options: http.RequestOptions): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

const root = tempDir();
afterAll(() => removeTemp(root));
const CASES = { entry: "solve", params: [{ name: "n", type: "int" }], returns: "int", examples: [], hidden: [] };
makeProblem(root, "lc-0001-sum-a", CASES);
makeProblem(root, "lc-0002-sum-b", CASES);

describe("pnpm play", () => {
  it("exits 1 and lists the candidates for an ambiguous query, before starting anything", () => {
    const run = spawnSync(TSX_BIN, ["playground/cli.ts", "sum", "--no-open"], {
      cwd: REPO_ROOT,
      env: { ...process.env, ALGO_ROOT: root },
      encoding: "utf8",
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"sum" matches 2');
    expect(run.stderr).toContain("lc-0002");
  });

  it("serves the app and the API on 127.0.0.1", async () => {
    const server = await startPlayground({ route: "/p/lc-0001", open: false, port: 4390 });
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/p\/lc-0001$/);
      expect(await (await fetch(new URL("/api/health", server.url))).json()).toEqual({ ok: true });
      expect(await (await fetch(server.url)).text()).toContain('<div id="root"></div>');

      // Vite's /@fs/ route can serve any file under the workspace root, bypassing Hono: it must never
      // hand out a problem's cases.json (hidden expected values), even by absolute path.
      const casesPath = path.join(root, "problems", "lc-0001-sum-a", "cases.json");
      const fsRes = await fetch(new URL(`/@fs${casesPath}`, server.url));
      expect(fsRes.status).not.toBe(200);
      expect(await fsRes.text()).not.toContain('"entry": "solve"');

      // spec §7: no CORS headers are sent, so another page (any port is "local" to the Host guard) cannot
      // read the response. Vite's own cors middleware runs ahead of Hono's and would otherwise approve it.
      const healthUrl = new URL("/api/health", server.url).href;
      const getRes = await rawRequest(healthUrl, { method: "GET", headers: { Origin: "http://localhost:3000" } });
      expect(getRes.headers["access-control-allow-origin"]).toBeUndefined();
      const preflight = await rawRequest(healthUrl, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await server.close();
    }
  });
});
