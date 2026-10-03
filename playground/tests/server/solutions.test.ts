import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { createApp } from "../../server/app.ts";
import type { ApiErrorBody, SolutionData } from "../../server/types.ts";
import { call, HOST, makeRepo, PY_SUM, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

const SOLUTION = "problems/lc-0001-two-sum/solution.py";

// The root tsconfig has no DOM lib, so `Response` here is @types/node's (undici-types), whose
// `.json()` returns `Promise<unknown>` rather than DOM's `Promise<any>`. Cast once per call site.
const json = <T>(res: Response): Promise<T> => res.json() as Promise<T>;

describe("GET/PUT /api/solution", () => {
  it("creates the stub on first read, then saves new code when the version matches", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await json<SolutionData>(await call(app, "/api/solution?id=lc-0001&lang=py"));
    expect(first.code).toContain("def solve(self, nums: list[int]) -> int:");
    expect(readFileSync(path.join(root, SOLUTION), "utf8")).toBe(first.code);

    const saved = await call(app, "/api/solution", {
      method: "PUT",
      json: { id: "lc-0001", lang: "py", code: PY_SUM, baseVersion: first.version },
    });
    expect(saved.status).toBe(200);
    const { version } = await json<{ version: string }>(saved);
    expect(readFileSync(path.join(root, SOLUTION), "utf8")).toBe(PY_SUM);
    expect(await (await call(app, "/api/solution?id=lc-0001&lang=py")).json()).toEqual({ code: PY_SUM, version });
  });

  it("never overwrites a file that changed on disk, and returns what is there", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await json<SolutionData>(await call(app, "/api/solution?id=lc-0001&lang=py"));
    writeFileSync(path.join(root, SOLUTION), "# edited in VS Code\n");
    const res = await call(app, "/api/solution", {
      method: "PUT",
      json: { id: "lc-0001", lang: "py", code: PY_SUM, baseVersion: first.version },
    });
    expect(res.status).toBe(409);
    const current = await json<SolutionData>(res);
    expect(current.code).toBe("# edited in VS Code\n");
    expect(current.version).not.toBe(first.version);
    expect(readFileSync(path.join(root, SOLUTION), "utf8")).toBe("# edited in VS Code\n");
  });

  it("keeps Spanish and emoji text byte for byte", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await json<SolutionData>(await call(app, "/api/solution?id=lc-0001&lang=py"));
    const code = "# ñandú 🎵 — café\nclass Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)  # «suma»\n";
    const { version } = await json<{ version: string }>(
      await call(app, "/api/solution", { method: "PUT", json: { id: "lc-0001", lang: "py", code, baseVersion: first.version } }),
    );
    expect(readFileSync(path.join(root, SOLUTION))).toEqual(Buffer.from(code, "utf8"));
    expect(await (await call(app, "/api/solution?id=lc-0001&lang=py")).json()).toEqual({ code, version });
  });

  it("answers 422 when the stub cannot be made from a broken cases.json, 404 for unknown ids, 400 for a bad language", async () => {
    const root = makeRepo();
    writeFileSync(path.join(root, "problems/lc-0001-two-sum/cases.json"), "{ nope");
    const app = createApp({ root });
    const broken = await call(app, "/api/solution?id=lc-0001&lang=py");
    expect(broken.status).toBe(422);
    expect((await json<ApiErrorBody>(broken)).error).toMatch(/cases\.json is invalid/);
    expect((await call(app, "/api/solution?id=lc-9999&lang=py")).status).toBe(404);
    expect((await call(app, "/api/solution?id=lc-0001&lang=rs")).status).toBe(400);
  });

  it("rejects a non-JSON body and leaves the solution file unchanged", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    await call(app, "/api/solution?id=lc-0001&lang=py");
    const before = readFileSync(path.join(root, SOLUTION), "utf8");
    // A valid-looking JSON string with the wrong Content-Type: Hono's json validator only reads the
    // body for an `application/*+json` Content-Type, so this never even reaches zod's success path.
    const res = await app.request("/api/solution", {
      method: "PUT",
      headers: { host: HOST, origin: `http://${HOST}`, "content-type": "text/plain" },
      body: JSON.stringify({ id: "lc-0001", lang: "py", code: PY_SUM, baseVersion: "deadbeefdeadbeef" }),
    });
    expect(res.status).toBe(400);
    expect(readFileSync(path.join(root, SOLUTION), "utf8")).toBe(before);
  });
});

describe("POST /api/run", () => {
  it("returns the engine's RunResult", async () => {
    const root = makeRepo();
    put(root, SOLUTION, PY_SUM);
    const res = await call(createApp({ root }), "/api/run", { json: { id: "lc-0001", lang: "py" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "lc-0001",
      lang: "py",
      fatal: null,
      examples: { passed: 2, total: 2 },
      hidden: { status: "pass", passed: 1, total: 1, firstFailure: null },
      green: true,
    });
  });

  it("answers 422 for a broken cases.json", async () => {
    const root = makeRepo();
    put(root, SOLUTION, PY_SUM);
    writeFileSync(path.join(root, "problems/lc-0001-two-sum/cases.json"), "{ nope");
    const res = await call(createApp({ root }), "/api/run", { json: { id: "lc-0001", lang: "py" } });
    expect(res.status).toBe(422);
  });
});

describe("POST /api/run-custom", () => {
  it("runs one input without judging it", async () => {
    const root = makeRepo();
    put(root, SOLUTION, "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        print(len(nums))\n        return sum(nums)\n");
    const res = await call(createApp({ root }), "/api/run-custom", { json: { id: "lc-0001", lang: "py", input: [[7, 8]] } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ fatal: null, output: 15, stdout: "2\n" });
  });

  it("lists the issues when the input does not fit the signature, and needs an input", async () => {
    const app = createApp({ root: makeRepo() });
    const res = await call(app, "/api/run-custom", { json: { id: "lc-0001", lang: "py", input: [[1], 2] } });
    expect(res.status).toBe(422);
    expect((await json<ApiErrorBody>(res)).issues).toEqual(["custom.input: expected 1 params, got 2"]);
    expect((await call(app, "/api/run-custom", { json: { id: "lc-0001", lang: "py" } })).status).toBe(400);
  });
});
