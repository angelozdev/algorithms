import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkRepo } from "../../scripts/lib/checks.ts";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { fixedClock } from "../clock.ts";
import { type CliIo, runStudyCli } from "../commands.ts";
import { applyMigration, MigrationError, planMigration } from "../migrate.ts";
import { profile } from "../schema.ts";
import { openStudy } from "../store.ts";
import { EXPLANATION_TEXT, git, makeLegacyRepo, snapshotTree } from "./legacy-fixture.ts";

afterEach(cleanupTempDirs);

const T0 = "2026-10-04T10:00:00.000Z";
const STAMP = "2026-10-04T10-00-00-000Z";

async function migrate(root: string, ...flags: string[]) {
  let out = "";
  let err = "";
  const io: CliIo = { root, clock: fixedClock(T0), out: (text) => (out += text), err: (text) => (err += text) };
  const code = await runStudyCli(["migrate", "--timezone", "UTC", ...flags], io);
  return { code, out, err };
}

const read = (root: string, rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("pnpm study migrate --dry-run", () => {
  it("prints every action and changes nothing, not even .study or the git index", async () => {
    const root = makeLegacyRepo();
    const tree = snapshotTree(root);
    const status = git(root, "status", "--porcelain");
    const result = await migrate(root, "--dry-run");
    expect(result.code).toBe(0);
    expect(result.out.split("\n")).toEqual(
      expect.arrayContaining([
        "init        .study/ (study.db, tsconfig.json, profile)",
        `archive     problems/lc-9001-sample-sum/solution.py → .study/solutions/problems/lc-9001/history/${STAMP}-legacy.py (tracked: git rm --cached)`,
        `archive     problems/lc-9002-sample-pairs/solution.ts → .study/solutions/problems/lc-9002/history/${STAMP}-legacy.ts`,
        `archive     concepts/sample-map/exercises/01-first/solution.py → .study/solutions/exercises/sample-map/01/history/${STAMP}-legacy.py`,
        "strip       problems/lc-9001-sample-sum/README.md (status, hints, solution_revealed, solved_in, complexity, ## Log)",
        "strip       problems/lc-9002-sample-pairs/README.md (status, hints, solution_revealed, solved_in, complexity, ## Log)",
        "strip       concepts/sample-map/exercises/01-first/README.md (status, hints, solution_revealed, solved_in, ## Log)",
        "explanation sample-map → .study/explanations/sample-map.md",
        "strip       concepts/sample-map/README.md (status, My explanation text)",
        "sync        INDEX.md, concepts/INDEX.md and the auto-sections, as pure content",
        "Dry run: nothing was changed. Run pnpm study migrate to apply.",
      ]),
    );
    expect(snapshotTree(root)).toEqual(tree);
    expect(git(root, "status", "--porcelain")).toBe(status);
    expect(existsSync(path.join(root, ".study"))).toBe(false);
  });
});

describe("pnpm study migrate", () => {
  it("archives every solution byte for byte, git-removes the tracked one, and leaves the commit to the user", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    for (const rel of ["problems/lc-9001-sample-sum/solution.py", "problems/lc-9002-sample-pairs/solution.ts", "concepts/sample-map/exercises/01-first/solution.py"]) {
      expect(existsSync(path.join(root, rel)), rel).toBe(false);
    }
    expect(read(root, `.study/solutions/problems/lc-9001/history/${STAMP}-legacy.py`)).toBe("# tracked work\n");
    expect(read(root, `.study/solutions/problems/lc-9002/history/${STAMP}-legacy.ts`)).toBe("// untracked work\n");
    expect(read(root, `.study/solutions/exercises/sample-map/01/history/${STAMP}-legacy.py`)).toBe("# exercise work\n");
    const status = git(root, "status", "--porcelain").split("\n");
    expect(status).toContain("D  problems/lc-9001-sample-sum/solution.py");
    expect(status).toContain(" M problems/lc-9001-sample-sum/README.md");
    expect(git(root, "log", "--oneline").trim().split("\n")).toHaveLength(1);
  });

  it("moves My explanation to .study, strips every README, and sets up the store with a profile", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    expect(read(root, ".study/explanations/sample-map.md")).toBe(`${EXPLANATION_TEXT}\n`);
    const concept = read(root, "concepts/sample-map/README.md");
    expect(concept).not.toContain(EXPLANATION_TEXT);
    expect(concept).not.toMatch(/^status:/m);
    expect(concept).toContain("## My explanation\n\n<!-- Write this yourself, in your own words. Claude never fills this section. -->\n\n## Problems");
    for (const rel of ["problems/lc-9001-sample-sum/README.md", "problems/lc-9002-sample-pairs/README.md", "concepts/sample-map/exercises/01-first/README.md"]) {
      const text = read(root, rel);
      expect(text, rel).not.toMatch(/^(status|hints|solution_revealed|solved_in|complexity):/m);
      expect(text, rel).not.toContain("## Log");
    }
    const study = openStudy(root);
    expect(study.db.select({ timezone: profile.timezone }).from(profile).all()).toEqual([{ timezone: "UTC" }]);
    study.close();
    expect(existsSync(path.join(root, ".study", "state.json"))).toBe(true);
  });

  it("writes each stripped README through a temp file and a rename, leaving no stray temp file behind", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    for (const file of snapshotTree(root).keys()) {
      expect(file, file).not.toMatch(/\.tmp$/);
    }
    // The final content is still correct (asserted in detail by the test above): a rename only ever
    // lands the fully-written temp file on the real path, never a half-written one.
    expect(read(root, "problems/lc-9001-sample-sum/README.md")).not.toMatch(/^status:/m);
  });

  it("finds nothing left to do the second time", async () => {
    const root = makeLegacyRepo();
    await migrate(root);
    const tree = snapshotTree(root);
    const again = await migrate(root);
    expect(again.code).toBe(0);
    expect(again.out).toContain("Nothing to migrate.");
    expect(snapshotTree(root)).toEqual(tree);
  });

  it("keeps newer text already in .study/explanations and saves the README's next to it", async () => {
    const root = makeLegacyRepo();
    put(root, ".study/explanations/sample-map.md", "Newer words.\n");
    const result = await migrate(root);
    expect(result.out).toContain(
      `explanation sample-map: .study/explanations/sample-map.md has newer text; the README's goes to .study/explanations/history/sample-map-${STAMP}-legacy.md`,
    );
    expect(read(root, ".study/explanations/sample-map.md")).toBe("Newer words.\n");
    expect(read(root, `.study/explanations/history/sample-map-${STAMP}-legacy.md`)).toBe(`${EXPLANATION_TEXT}\n`);
  });

  it("reuses an identical legacy copy left by an interrupted run instead of copying twice", async () => {
    const root = makeLegacyRepo();
    const history = path.join(root, ".study/solutions/problems/lc-9002/history");
    mkdirSync(history, { recursive: true });
    writeFileSync(path.join(history, "2026-10-03T09-00-00-000Z-legacy.ts"), "// untracked work\n");
    expect((await migrate(root)).code).toBe(0);
    expect(existsSync(path.join(history, `${STAMP}-legacy.ts`))).toBe(false);
    expect(existsSync(path.join(root, "problems/lc-9002-sample-pairs/solution.ts"))).toBe(false);
  });

  it("fails clearly instead of a raw error when a previous archive attempt left a corrupted copy at the destination", async () => {
    const root = makeLegacyRepo();
    const history = path.join(root, ".study/solutions/problems/lc-9002/history");
    mkdirSync(history, { recursive: true });
    // Same timestamp the plan will compute (the clock is fixed to T0), but different bytes: not the
    // interrupted-run case above, so the retry's copy (COPYFILE_EXCL) hits an existing file and raises EEXIST.
    const corrupted = path.join(history, `${STAMP}-legacy.ts`);
    writeFileSync(corrupted, "truncated by a crash");
    const result = await migrate(root);
    expect(result.code).toBe(1);
    expect(result.err).toContain(
      `a previous archive copy at .study/solutions/problems/lc-9002/history/${STAMP}-legacy.ts is corrupted or incomplete — remove it and retry`,
    );
    // Neither the user's original nor the corrupted leftover was touched: nothing was lost.
    expect(readFileSync(corrupted, "utf8")).toBe("truncated by a crash");
    expect(readFileSync(path.join(root, "problems/lc-9002-sample-pairs/solution.ts"), "utf8")).toBe("// untracked work\n");
  });

  it("refuses to start while a README cannot be stripped, and changes nothing", async () => {
    const root = makeLegacyRepo();
    put(root, "problems/lc-9003-broken/README.md", "---\ntitle: [unclosed\n---\n# Broken\n");
    const tree = snapshotTree(root);
    const result = await migrate(root);
    expect(result.code).toBe(1);
    expect(result.err).toContain("Cannot migrate yet. Fix these READMEs first:\n  - problems/lc-9003-broken/README.md: frontmatter:");
    expect(snapshotTree(root)).toEqual(tree);
  });

  it("applyMigration itself refuses a blocked plan, even called directly and bypassing the CLI's own check", async () => {
    const root = makeLegacyRepo();
    put(root, "problems/lc-9003-broken/README.md", "---\ntitle: [unclosed\n---\n# Broken\n");
    const plan = planMigration(root, new Date(T0));
    expect(plan.blockers.length).toBeGreaterThan(0);
    const tree = snapshotTree(root);
    expect(() => applyMigration(plan, { clock: fixedClock(T0), timezone: "UTC" })).toThrow(MigrationError);
    expect(snapshotTree(root)).toEqual(tree);
  });

  it("regenerates INDEX.md and the auto-sections as pure content", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    const index = read(root, "INDEX.md");
    expect(index).toContain("- [lc-9001 · Sample Sum](problems/lc-9001-sample-sum/README.md) · easy");
    expect(index).not.toMatch(/[✓…↺○]/);
    expect(read(root, "problems/lc-9001-sample-sum/README.md")).toContain(
      "<!-- auto:concepts -->\n- [Sample map](../../concepts/sample-map/README.md)\n<!-- /auto -->",
    );
    expect(read(root, "concepts/INDEX.md")).not.toContain("## By status");
  });

  it("leaves a repo that pnpm check accepts, with no personal data left (spec §9.4)", async () => {
    const root = makeLegacyRepo();
    expect((await migrate(root)).code).toBe(0);
    const report = await checkRepo(root);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });
});
