import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { removeTemp, tempDir } from "../../../runner/tests/helpers.ts";
import { createApp } from "../../server/app.ts";
import { call, HOST, makeRepo, removeRepos } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));
afterEach(removeRepos);
const app = createApp({ root });

describe("guard", () => {
  it("answers requests addressed to this machine", async () => {
    const res = await call(app, "/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect((await call(app, "/api/health", { headers: { host: "localhost:5000" } })).status).toBe(200);
  });

  it("rejects any other Host (DNS rebinding) and requests without one", async () => {
    for (const host of ["evil.com", "evil.com:4173", "127.0.0.1.evil.com:4173"]) {
      expect((await call(app, "/api/health", { headers: { host } })).status, host).toBe(403);
    }
    expect((await app.request("/api/health")).status).toBe(403);
  });

  it("rejects writes sent from another origin, JSON or form", async () => {
    const json = await call(app, "/api/health", { method: "PUT", json: {}, headers: { origin: "http://evil.com" } });
    expect(json.status).toBe(403);
    const form = await app.request("/api/health", {
      method: "POST",
      headers: { host: HOST, "content-type": "application/x-www-form-urlencoded" },
      body: "a=1",
    });
    expect(form.status).toBe(403);
  });

  it("rejects any request a browser marks as sent from another site, so a cross-site GET cannot create a stub", async () => {
    const repo = makeRepo();
    const repoApp = createApp({ root: repo });
    const stub = path.join(repo, "problems/lc-0001-two-sum/solution.ts");
    const crossSite = await call(repoApp, "/api/solution?id=lc-0001&lang=ts", { headers: { "sec-fetch-site": "cross-site" } });
    expect(crossSite.status).toBe(403);
    expect(await crossSite.json()).toEqual({ error: expect.any(String) });
    expect(existsSync(stub)).toBe(false);
    for (const site of ["same-origin", "same-site", "none"]) {
      expect((await call(repoApp, "/api/health", { headers: { "sec-fetch-site": site } })).status, site).toBe(200);
    }
    expect((await call(repoApp, "/api/solution?id=lc-0001&lang=ts", { headers: { "sec-fetch-site": "same-origin" } })).status).toBe(200);
    expect(existsSync(stub)).toBe(true);
  });
});
