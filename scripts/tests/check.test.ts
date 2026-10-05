import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT, TSX_BIN } from "../../runner/src/paths.ts";
import { fixedClock } from "../../study/clock.ts";
import { initStudy } from "../../study/init.ts";
import { makeLegacyRepo } from "../../study/tests/legacy-fixture.ts";
import { checkRepo, sectionText } from "../lib/checks.ts";
import { sync } from "../lib/sync.ts";
import { cleanupTempDirs, conceptReadme, makeStudyRepo, problemReadme, put } from "./fixture.ts";

const messages = async (root: string) => (await checkRepo(root)).errors.map((e) => `${e.file}: ${e.message}`);
const edit = (root: string, rel: string, from: string, to: string) =>
  put(root, rel, readFileSync(path.join(root, rel), "utf8").replace(from, to));

describe("checkRepo", () => {
  afterEach(cleanupTempDirs);

  it("accepts a synced valid repo and warns about missing concepts", async () => {
    const root = makeStudyRepo();
    sync(root);
    const report = await checkRepo(root);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([{ file: "concepts", message: '"stack" is referenced but not created (lc-0020)' }]);
  });

  it("reports broken links but ignores links inside code", async () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "Short paraphrase.", "See [x](../nowhere.md) and `[y](../code.md)`.\n\n```md\n[z](../fence.md)\n```");
    expect(await messages(root)).toEqual(["problems/lc-0001-two-sum/README.md: broken link: ../nowhere.md"]);
  });

  it("validates frontmatter against the schema and the pattern vocabulary", async () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "difficulty: easy", "difficulty: impossible");
    edit(root, "problems/lc-0001-two-sum/README.md", "patterns: [arrays-hashing]", "patterns: [hashing]");
    const errors = await messages(root);
    expect(errors.some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter difficulty:"))).toBe(true);
    expect(errors.some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter patterns[0]:"))).toBe(true);
  });

  it("checks that ids match folders", async () => {
    const root = makeStudyRepo();
    edit(root, "problems/lc-0001-two-sum/README.md", "id: lc-0001", "id: lc-0002");
    expect(await messages(root)).toContain('problems/lc-0001-two-sum/README.md: id "lc-0002" does not match the folder id "lc-0001"');
  });

  it("detects requires cycles", async () => {
    const root = makeStudyRepo();
    edit(root, "concepts/arrays/README.md", "requires: []", "requires: [hash-map]");
    expect(await messages(root)).toContain("concepts: requires has a cycle: arrays → hash-map → arrays");
  });

  it("requires every hidden expected value", async () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0001-two-sum/cases.json", JSON.stringify({ entry: "f", params: [{ name: "n", type: "int" }], returns: "int", examples: [{ input: [1], expected: 1 }], hidden: [{ input: [2] }] }));
    expect(await messages(root)).toContain("problems/lc-0001-two-sum/cases.json: hidden[0].expected: missing (run pnpm fill-expected)");
  });

  it("warns about personal progress in content until the study store exists, then reports each place as an error", async () => {
    const root = makeLegacyRepo();
    const before = await checkRepo(root);
    expect(before.errors).toEqual([]);
    expect(before.warnings).toEqual([
      { file: ".", message: "7 place(s) still hold personal progress from before the study coach; pnpm study migrate moves it to .study/ (study coach spec §9)" },
    ]);
    initStudy(root, { clock: fixedClock("2026-10-04T10:00:00Z"), timezone: "UTC" });
    expect(await messages(root)).toEqual([
      "problems/lc-9001-sample-sum/README.md: personal progress in content: status, hints, solution_revealed, solved_in, complexity, ## Log (pnpm study migrate moves it to .study/)",
      "problems/lc-9001-sample-sum/solution.py: solution file in a content folder (pnpm study migrate archives it in .study/solutions)",
      "problems/lc-9002-sample-pairs/README.md: personal progress in content: status, hints, solution_revealed, solved_in, complexity, ## Log (pnpm study migrate moves it to .study/)",
      "problems/lc-9002-sample-pairs/solution.ts: solution file in a content folder (pnpm study migrate archives it in .study/solutions)",
      "concepts/sample-map/exercises/01-first/README.md: personal progress in content: status, hints, solution_revealed, solved_in, ## Log (pnpm study migrate moves it to .study/)",
      "concepts/sample-map/exercises/01-first/solution.py: solution file in a content folder (pnpm study migrate archives it in .study/solutions)",
      'concepts/sample-map/README.md: personal progress in content: status, "My explanation" text (pnpm study migrate moves it to .study/)',
    ]);
  });

  it("requires the auto sections", async () => {
    const root = makeStudyRepo();
    put(
      root,
      "problems/lc-0001-two-sum/README.md",
      problemReadme({ id: "lc-0001", title: "Two Sum", slug: "two-sum", patterns: ["arrays-hashing"], concepts: [] }).replace("<!-- auto:concepts -->\n<!-- /auto -->\n", ""),
    );
    expect(await messages(root)).toContain("problems/lc-0001-two-sum/README.md: missing <!-- auto:concepts --> … <!-- /auto --> section");
  });

  it("requires every auto section to be closed", async () => {
    const root = makeStudyRepo();
    edit(root, "concepts/hash-map/README.md", "<!-- auto:exercises -->\n<!-- /auto -->\n", "<!-- auto:exercises -->\n");
    expect(await messages(root)).toContain("concepts/hash-map/README.md: missing <!-- auto:exercises --> … <!-- /auto --> section");
  });

  it("loads every stress.ts and reports malformed ones against the file, without creating solutions", async () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0020-valid-parentheses/stress.ts", 'export default () => [{ name: "n=1", input: [1] }];\n');
    put(root, "problems/lc-0001-two-sum/stress.ts", 'export default () => [{ name: "unwrapped", input: 5 }];\n');
    put(root, "concepts/hash-map/exercises/01-first-repeat/stress.ts", 'export default () => [{ name: "half", input: [1] }\n');
    const errors = await messages(root);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toBe("problems/lc-0001-two-sum/stress.ts: [0].input: expected an array of 1 params");
    expect(errors[1]).toMatch(/^concepts\/hash-map\/exercises\/01-first-repeat\/stress\.ts: failed to load: /);
    for (const folder of ["problems/lc-0001-two-sum", "problems/lc-0020-valid-parentheses", "concepts/hash-map/exercises/01-first-repeat"]) {
      expect(readdirSync(path.join(root, folder)).filter((name) => name.startsWith("solution."))).toEqual([]);
    }
  });

  it("stops a stress generator that never returns and keeps checking the rest", async () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0001-two-sum/stress.ts", "export default () => { for (;;) {} };\n");
    put(root, "problems/lc-0020-valid-parentheses/stress.ts", 'export default () => [{ name: "unwrapped", input: 5 }];\n');
    const started = Date.now();
    const errors = (await checkRepo(root, { stressLoadMs: 3000 })).errors.map((e) => `${e.file}: ${e.message}`);
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(errors).toEqual([
      "problems/lc-0001-two-sum/stress.ts: stress() did not return within 3000 ms (an infinite loop?)",
      "problems/lc-0020-valid-parentheses/stress.ts: [0].input: expected an array of 1 params",
    ]);
  });

  it("exits 1 from the CLI when there are errors", () => {
    const root = makeStudyRepo();
    const run = () => spawnSync(TSX_BIN, ["scripts/check.ts"], { cwd: REPO_ROOT, env: { ...process.env, ALGO_ROOT: root }, encoding: "utf8" });
    const clean = run();
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain("0 error(s), 1 warning(s)");
    edit(root, "problems/lc-0001-two-sum/README.md", "id: lc-0001", "id: nope");
    const broken = run();
    expect(broken.status).toBe(1);
    expect(broken.stdout).toContain('✗ problems/lc-0001-two-sum/README.md: id "nope" does not match');
  });

  it("accepts a kebab-case lists field on problems and rejects anything else", async () => {
    const root = makeStudyRepo();
    sync(root);
    edit(root, "problems/lc-0001-two-sum/README.md", "concepts: [hash-map]", "concepts: [hash-map]\nlists: [grind-75]");
    expect(await messages(root)).toEqual([]);
    edit(root, "problems/lc-0001-two-sum/README.md", "lists: [grind-75]", "lists: [Grind 75]");
    expect((await messages(root)).some((e) => e.startsWith("problems/lc-0001-two-sum/README.md: frontmatter lists[0]:"))).toBe(true);
  });
});

describe("sectionText", () => {
  it("returns a section's text without HTML comments", () => {
    const body = "## A\n\n<!-- hint -->\nhello\n\n## B\nbye\n";
    expect(sectionText(body, "A")).toBe("hello");
    expect(sectionText(body, "B")).toBe("bye");
    expect(sectionText(body, "C")).toBeNull();
  });
});
