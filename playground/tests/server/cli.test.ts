import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../../runner/src/paths.ts";
import { makeProblem, removeTemp, tempDir } from "../../../runner/tests/helpers.ts";
import { startPlayground } from "../../start.ts";

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
    } finally {
      await server.close();
    }
  });
});
