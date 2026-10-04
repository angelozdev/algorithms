import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { createApp } from "../../server/app.ts";
import { contentVersion } from "../../server/solutions.ts";
import { call, makeRepo, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

// The root tsconfig has no DOM lib, so `Response` here is @types/node's (undici-types), whose
// `.json()` returns `Promise<unknown>` rather than DOM's `Promise<any>`. Cast once here, as
// targets.test.ts does; each test asserts the actual shape it expects.
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

const README = "concepts/hash-map/README.md";
const putExplanation = async (app: ReturnType<typeof createApp>, text: string, baseVersion: string) =>
  call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "hash-map", text, baseVersion } });

describe("GET /api/concept", () => {
  it("returns the note split around My explanation, and the README version", async () => {
    const root = makeRepo();
    const { status, body: concept } = await json(await call(createApp({ root }), "/api/concept?slug=hash-map"));
    expect(status).toBe(200);
    expect(concept).toMatchObject({ slug: "hash-map", title: "Hash map", status: "learning", readme: README, explanation: "", readmeError: null });
    expect(concept.before).toMatch(/^# Hash map\n\n## Intuition/);
    expect(concept.before).not.toContain("My explanation");
    expect(concept.after).toBe("## Problems\n\n<!-- auto:problems -->\n<!-- /auto -->\n");
    expect(concept.version).toBe(contentVersion(readFileSync(path.join(root, README), "utf8")));
  });

  it("answers 404 for unknown slugs", async () => {
    const app = createApp({ root: makeRepo() });
    for (const slug of ["nope", "../hash-map", "hash"]) {
      expect((await call(app, `/api/concept?slug=${encodeURIComponent(slug)}`)).status, slug).toBe(404);
    }
  });
});

describe("PUT /api/concept/explanation", () => {
  it("replaces only the section's text: every other byte of the README stays the same", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const original = readFileSync(path.join(root, README), "utf8");
    const res = await putExplanation(app, "A hash map turns keys into positions.", contentVersion(original));
    expect(res.status).toBe(200);
    const updated = readFileSync(path.join(root, README), "utf8");
    expect(updated).toBe(
      original.replace(
        "<!-- USER: in your own words -->\n\n## Problems",
        "<!-- USER: in your own words -->\n\nA hash map turns keys into positions.\n\n## Problems",
      ),
    );
    expect((await json(res)).body.version).toBe(contentVersion(updated));
    expect((await json(await call(app, "/api/concept?slug=hash-map"))).body.explanation).toBe("A hash map turns keys into positions.");
  });

  it("keeps Spanish and emoji text byte for byte", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const text = "Un mapa hash es como el guardarropa 🎟️: la clave da la posición. ¡Ñandú!";
    const version = contentVersion(readFileSync(path.join(root, README), "utf8"));
    expect((await putExplanation(app, text, version)).status).toBe(200);
    expect(readFileSync(path.join(root, README)).includes(Buffer.from(text, "utf8"))).toBe(true);
    expect((await json(await call(app, "/api/concept?slug=hash-map"))).body.explanation).toBe(text);
  });

  it("works when the section is the last one and the file has no trailing newline", async () => {
    const root = makeRepo();
    const original = "---\nslug: last\ntitle: Last\nstatus: new\nrequires: []\nrelated: []\n---\n# Last\n\n## Intuition\n\nx\n\n## My explanation\n\n<!-- c -->";
    put(root, "concepts/last/README.md", original);
    const res = await call(createApp({ root }), "/api/concept/explanation", {
      method: "PUT",
      json: { slug: "last", text: "Mine.", baseVersion: contentVersion(original) },
    });
    expect(res.status).toBe(200);
    expect(readFileSync(path.join(root, "concepts/last/README.md"), "utf8")).toBe(`${original}\n\nMine.\n`);
  });

  it("rejects text that would break the README, and leaves the file alone", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const original = readFileSync(path.join(root, README), "utf8");
    for (const text of ["## Mine", "Title\n---", "<!-- auto:problems -->", "```python\nx = 1"]) {
      const res = await putExplanation(app, text, contentVersion(original));
      expect(res.status, text).toBe(422);
      expect((await json(res)).body.issues.length, text).toBeGreaterThan(0);
    }
    expect(readFileSync(path.join(root, README), "utf8")).toBe(original);
  });

  it("answers 409 with the fresh concept when the README changed since it was loaded", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const stale = contentVersion(readFileSync(path.join(root, README), "utf8"));
    writeFileSync(path.join(root, README), readFileSync(path.join(root, README), "utf8").replace("An analogy.", "A better analogy."));
    const res = await putExplanation(app, "Mine.", stale);
    expect(res.status).toBe(409);
    const { body: fresh } = await json(res);
    expect(fresh.before).toContain("A better analogy.");
    expect(fresh.version).not.toBe(stale);
  });

  it("answers 422 when the README has no My explanation section, and 404 for unknown slugs", async () => {
    const root = makeRepo();
    const text = "---\nslug: bare\ntitle: Bare\nstatus: new\nrequires: []\nrelated: []\n---\n# Bare\n\n## Intuition\n\nx\n";
    put(root, "concepts/bare/README.md", text);
    const app = createApp({ root });
    const { body: concept } = await json(await call(app, "/api/concept?slug=bare"));
    expect(concept.explanation).toBeNull();
    expect(concept.before).toBe("# Bare\n\n## Intuition\n\nx\n");
    const res = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "bare", text: "x", baseVersion: contentVersion(text) } });
    expect(res.status).toBe(422);
    expect((await json(res)).body.error).toContain("pnpm check");
    const missing = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "nope", text: "x", baseVersion: "0" } });
    expect(missing.status).toBe(404);
  });
});
