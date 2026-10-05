import { writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { put } from "../../../scripts/tests/fixture.ts";
import { resetStudy, seedClosedAttempt, seedOpenAttempt } from "../../../study/tests/seed.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, PY_SUM, removeRepos, SUM_CASES } from "./helpers.ts";

afterEach(removeRepos);

// The root tsconfig has no DOM lib, so `Response` here is @types/node's (undici-types), whose
// `.json()` returns `Promise<unknown>` rather than DOM's `Promise<any>`. Cast once here; each
// test asserts the actual shape it expects.
const json = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

describe("GET /api/home", () => {
  it("lists problems with status and in-progress, the pattern groups, and concepts with their exercises", async () => {
    const root = makeRepo();
    seedOpenAttempt(root, "lc-0020");
    const { status, body } = await json(await call(createApp({ root }), "/api/home"));
    expect(status).toBe(200);
    expect(body.problems).toEqual([
      { id: "lc-0001", title: "Two Sum", difficulty: "easy", patterns: ["arrays-hashing"], concepts: ["hash-map"], lists: [], status: "solved", inProgress: false, error: null },
      { id: "lc-0020", title: "Valid Parentheses", difficulty: "easy", patterns: ["stack"], concepts: [], lists: [], status: "solving", inProgress: true, error: null },
    ]);
    expect(body.groups).toEqual([
      { pattern: "arrays-hashing", ids: ["lc-0001"] },
      { pattern: "stack", ids: ["lc-0020"] },
    ]);
    expect(body.concepts).toEqual([
      {
        slug: "hash-map",
        title: "Hash map",
        status: "new",
        error: null,
        exercises: [{ id: "hash-map/01", title: "First repeat", status: "todo", inProgress: false, error: null }],
      },
    ]);
  });

  it("marks a README with broken frontmatter instead of failing", async () => {
    const root = makeRepo();
    put(root, "problems/lc-0030-broken/README.md", "---\ntitle: [unclosed\n---\n# Broken\n");
    const { body } = await json(await call(createApp({ root }), "/api/home"));
    const broken = body.problems.find((p: { id: string }) => p.id === "lc-0030");
    expect(broken.title).toBe("lc-0030-broken");
    expect(broken.error).toMatch(/^frontmatter:/);
  });

  it("gives a problem whose concepts field is not a list no concepts", async () => {
    const root = makeRepo();
    put(
      root,
      "problems/lc-0035-search-insert-position/README.md",
      "---\nid: lc-0035\ntitle: Search Insert Position\ndifficulty: easy\npatterns: [binary-search]\nconcepts: binary-search\nstatus: todo\n---\n# 35. Search Insert Position\n",
    );
    const { body } = await json(await call(createApp({ root }), "/api/home"));
    expect(body.problems.find((p: { id: string }) => p.id === "lc-0035").concepts).toEqual([]);
  });

  it("gives a problem with no concepts key at all no concepts", async () => {
    const root = makeRepo();
    put(
      root,
      "problems/lc-0036-valid-sudoku/README.md",
      "---\nid: lc-0036\ntitle: Valid Sudoku\ndifficulty: medium\npatterns: [arrays-hashing]\nstatus: todo\n---\n# 36. Valid Sudoku\n",
    );
    const { body } = await json(await call(createApp({ root }), "/api/home"));
    expect(body.problems.find((p: { id: string }) => p.id === "lc-0036").concepts).toEqual([]);
  });

  it("works on an empty repo", async () => {
    const root = makeRepo();
    const empty = path.join(root, "empty");
    const { body } = await json(await call(createApp({ root: empty }), "/api/home"));
    expect(body).toEqual({ problems: [], groups: [], concepts: [] });
  });

  it("reads the lists a problem belongs to, and gives none when the field is missing", async () => {
    const root = makeRepo();
    put(
      root,
      "problems/lc-0035-search-insert-position/README.md",
      "---\nid: lc-0035\ntitle: Search Insert Position\ndifficulty: easy\npatterns: [binary-search]\nconcepts: [binary-search]\nlists: [grind-75]\nstatus: todo\n---\n# 35. Search Insert Position\n",
    );
    const { body } = await json(await call(createApp({ root }), "/api/home"));
    expect(body.problems.find((p: { id: string }) => p.id === "lc-0035").lists).toEqual(["grind-75"]);
    expect(body.problems.find((p: { id: string }) => p.id === "lc-0001").lists).toEqual([]);
  });
});

describe("GET /api/target", () => {
  it("returns the statement without frontmatter, the signature and which solution files exist", async () => {
    const root = makeRepo();
    put(root, "problems/lc-0001-two-sum/solution.py", PY_SUM);
    const { status, body } = await json(await call(createApp({ root }), "/api/target?id=lc-0001"));
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: "lc-0001",
      kind: "problem",
      title: "Two Sum",
      readme: "problems/lc-0001-two-sum/README.md",
      readmeError: null,
      difficulty: "easy",
      url: "https://leetcode.com/problems/two-sum/",
      status: "solved",
      hints: 0,
      signature: { mode: "function", entry: "solve", params: [{ name: "nums", type: "int[]" }], returns: "int" },
      exampleInput: [[1, 2]],
      caseError: null,
      solutions: { py: true, ts: false },
    });
    expect(body.markdown).toMatch(/^# Two Sum\n/);
    expect(body.markdown).not.toContain("status: solved");
  });

  it("finds an exercise by its id", async () => {
    const { body } = await json(await call(createApp({ root: makeRepo() }), "/api/target?id=hash-map%2F01"));
    expect(body).toMatchObject({ id: "hash-map/01", kind: "exercise", title: "First repeat", difficulty: null, url: null, status: "todo" });
  });

  it("reports a broken cases.json and hidden cases that have no expected value", async () => {
    const root = makeRepo();
    writeFileSync(path.join(root, "problems/lc-0001-two-sum/cases.json"), "{ nope");
    writeFileSync(
      path.join(root, "problems/lc-0020-valid-parentheses/cases.json"),
      JSON.stringify({ ...SUM_CASES, hidden: [{ input: [[1]] }] }),
    );
    const app = createApp({ root });
    const broken = (await json(await call(app, "/api/target?id=lc-0001"))).body;
    expect(broken.signature).toBeNull();
    expect(broken.caseError).toMatch(/cases\.json is invalid/);
    const unfilled = (await json(await call(app, "/api/target?id=lc-0020"))).body;
    expect(unfilled.signature).not.toBeNull();
    expect(unfilled.caseError).toContain("pnpm fill-expected");
  });

  it("answers 404 for anything that is not an exact id, and 400 without an id", async () => {
    const app = createApp({ root: makeRepo() });
    for (const id of ["lc-9999", "two-sum", "1", "../../etc", "lc-0001-two-sum"]) {
      expect((await call(app, `/api/target?id=${encodeURIComponent(id)}`)).status, id).toBe(404);
    }
    expect((await call(app, "/api/target")).status).toBe(400);
  });
});

describe("statuses from the study store (study coach spec §10)", () => {
  it("come from recorded attempts once the store exists, ignoring the old frontmatter", async () => {
    const root = makeRepo();
    resetStudy(root);
    seedOpenAttempt(root, "lc-0020", { hints: 1 });
    seedClosedAttempt(root, "hash-map/01", "gave_up");
    const app = createApp({ root });
    const { body } = await json(await call(app, "/api/home"));
    expect(body.problems.map((p: { id: string; status: string; inProgress: boolean }) => [p.id, p.status, p.inProgress])).toEqual([
      ["lc-0001", "todo", false],
      ["lc-0020", "solving", true],
    ]);
    expect(body.concepts[0]).toMatchObject({ status: "learning", exercises: [{ id: "hash-map/01", status: "revealed", inProgress: false }] });
    expect((await json(await call(app, "/api/target?id=lc-0020"))).body).toMatchObject({ status: "solving", hints: 1 });
  });

  it("keep reading the old frontmatter for items and concepts while there is no study database", async () => {
    const root = makeRepo({ study: false });
    put(
      root,
      "problems/lc-0001-two-sum/README.md",
      "---\nid: lc-0001\ntitle: Two Sum\ndifficulty: easy\npatterns: [arrays-hashing]\nconcepts: [hash-map]\nstatus: solved\nhints: 2\n---\n# Two Sum\n",
    );
    // conceptView's own fallback (not just itemView's): a legacy concept README reads its status straight
    // from its frontmatter, since there is no study database for conceptProgress to derive it from instead.
    put(
      root,
      "concepts/hash-map/README.md",
      "---\nslug: hash-map\ntitle: Hash map\nstatus: learning\nrequires: []\nrelated: []\n---\n# Hash map\n",
    );
    const app = createApp({ root });
    const { body } = await json(await call(app, "/api/home"));
    expect(body.problems[0]).toMatchObject({ id: "lc-0001", status: "solved" });
    expect(body.concepts[0]).toMatchObject({ slug: "hash-map", status: "learning" });
    expect((await json(await call(app, "/api/target?id=lc-0001"))).body).toMatchObject({ status: "solved", hints: 2 });
  });
});
