import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { resetStudy, seedAcceptance, seedClosedAttempt, seedOpenAttempt } from "../../../study/tests/seed.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

// The root tsconfig has no DOM lib, so `Response` here is @types/node's (undici-types), whose
// `.json()` returns `Promise<unknown>` rather than DOM's `Promise<any>`. Cast once here, as
// targets.test.ts does; each test asserts the actual shape it expects.
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

const README = "concepts/hash-map/README.md";
const EXPLANATION = ".study/explanations/hash-map.md";
const putExplanation = async (app: ReturnType<typeof createApp>, text: string, baseVersion: string) =>
  call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "hash-map", text, baseVersion } });
const getConcept = async (app: ReturnType<typeof createApp>, slug = "hash-map") => (await json(await call(app, `/api/concept?slug=${slug}`))).body;

describe("GET /api/concept", () => {
  it("returns the note split around My explanation, and a version", async () => {
    const root = makeRepo();
    const { status, body: concept } = await json(await call(createApp({ root }), "/api/concept?slug=hash-map"));
    expect(status).toBe(200);
    expect(concept).toMatchObject({ slug: "hash-map", title: "Hash map", readme: README, explanation: "", readmeError: null });
    expect(concept.before).toMatch(/^# Hash map\n\n## Intuition/);
    expect(concept.before).not.toContain("My explanation");
    expect(concept.after).toBe("## Problems\n\n<!-- auto:problems -->\n<!-- /auto -->\n");
    expect(concept.version).toMatch(/^[0-9a-f]{16}$/);
  });

  it("reads the explanation from .study/explanations once it is there, and from the README's section before that", async () => {
    const root = makeRepo();
    put(root, README, readFileSync(path.join(root, README), "utf8").replace("<!-- USER: in your own words -->", "<!-- USER: in your own words -->\n\nOld words in the README."));
    const app = createApp({ root });
    expect((await getConcept(app)).explanation).toBe("Old words in the README.");
    put(root, EXPLANATION, "Newer words.\n");
    expect((await getConcept(app)).explanation).toBe("Newer words.");
  });

  it("answers 404 for unknown slugs", async () => {
    const app = createApp({ root: makeRepo() });
    for (const slug of ["nope", "../hash-map", "hash"]) {
      expect((await call(app, `/api/concept?slug=${encodeURIComponent(slug)}`)).status, slug).toBe(404);
    }
  });
});

describe("PUT /api/concept/explanation", () => {
  it("writes .study/explanations/<slug>.md and leaves the README byte for byte", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const readme = readFileSync(path.join(root, README), "utf8");
    const res = await putExplanation(app, "A hash map turns keys into positions.", (await getConcept(app)).version);
    expect(res.status).toBe(200);
    expect(readFileSync(path.join(root, EXPLANATION), "utf8")).toBe("A hash map turns keys into positions.\n");
    expect(readFileSync(path.join(root, README), "utf8")).toBe(readme);
    const after = await getConcept(app);
    expect(after.explanation).toBe("A hash map turns keys into positions.");
    expect((await json(res)).body.version).toBe(after.version);
  });

  it("keeps Spanish, emoji and headings byte for byte: the text no longer lives inside the README", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const text = "Un mapa hash es como el guardarropa 🎟️: la clave da la posición. ¡Ñandú!\n\n## Mi resumen\n\n- llaves y valores";
    expect((await putExplanation(app, text, (await getConcept(app)).version)).status).toBe(200);
    expect(readFileSync(path.join(root, EXPLANATION), "utf8")).toBe(`${text}\n`);
  });

  it("answers 409 with the fresh concept when the README or the explanation changed since it was loaded", async () => {
    const root = makeRepo();
    const app = createApp({ root });
    const first = await getConcept(app);
    writeFileSync(path.join(root, README), readFileSync(path.join(root, README), "utf8").replace("An analogy.", "A better analogy."));
    const stale = await putExplanation(app, "Mine.", first.version);
    expect(stale.status).toBe(409);
    const fresh = (await json(stale)).body;
    expect(fresh.before).toContain("A better analogy.");
    put(root, EXPLANATION, "Written in another tab.\n");
    expect((await putExplanation(app, "Mine.", fresh.version)).status).toBe(409);
    expect(readFileSync(path.join(root, EXPLANATION), "utf8")).toBe("Written in another tab.\n");
  });

  it("saves even when the README has no My explanation section, and answers 404 for unknown slugs", async () => {
    const root = makeRepo();
    put(root, "concepts/bare/README.md", "---\nslug: bare\ntitle: Bare\nrequires: []\nrelated: []\n---\n# Bare\n\n## Intuition\n\nx\n");
    const app = createApp({ root });
    const concept = await getConcept(app, "bare");
    expect(concept.explanation).toBe("");
    expect(concept.before).toBe("# Bare\n\n## Intuition\n\nx\n");
    const saved = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "bare", text: "x", baseVersion: concept.version } });
    expect(saved.status).toBe(200);
    expect(readFileSync(path.join(root, ".study/explanations/bare.md"), "utf8")).toBe("x\n");
    const missing = await call(app, "/api/concept/explanation", { method: "PUT", json: { slug: "nope", text: "x", baseVersion: "0" } });
    expect(missing.status).toBe(404);
  });
});

describe("concept status from the study store", () => {
  it("is new until the explanation is accepted or an exercise is attempted, and mastered once learned", async () => {
    const root = makeRepo();
    resetStudy(root);
    const app = createApp({ root });
    expect((await getConcept(app)).status).toBe("new");
    seedOpenAttempt(root, "hash-map/01");
    expect((await getConcept(app)).status).toBe("learning");
    seedAcceptance(root, "hash-map");
    seedClosedAttempt(root, "hash-map/01", "green");
    expect((await getConcept(app)).status).toBe("mastered");
  });
});
