import { afterEach, describe, expect, it } from "vitest";
import { scanRepo, strList } from "../../lib/repo.ts";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { cleanupTempDirs, put } from "../../scripts/tests/fixture.ts";
import { loadCatalog } from "../catalog.ts";
import { DEFAULT_TIMEBOX, listImport, listPresets, loadPreset, patternOrder, PresetError, timeboxMinutes, tryLoadPreset } from "../curriculum.ts";
import { makeCoachRepo, PRESETS } from "./coach-fixture.ts";

afterEach(cleanupTempDirs);

const issues = (root: string, id: string): string[] => {
  try {
    loadPreset(root, id);
    return [];
  } catch (error) {
    if (error instanceof PresetError) return error.issues;
    throw error;
  }
};

describe("the shipped presets (spec §5)", () => {
  it("are grind-75, grind-169 and neetcode-150, and all of them are valid", () => {
    expect(listPresets(REPO_ROOT)).toEqual(["grind-169", "grind-75", "neetcode-150"]);
    for (const id of listPresets(REPO_ROOT)) expect(loadPreset(REPO_ROOT, id).id).toBe(id);
  });

  it("grind-75 opens with the five phase-0 concepts and lists every pattern of the imported Grind 75 problems", () => {
    const preset = loadPreset(REPO_ROOT, "grind-75");
    expect(preset.phases.bases.concepts).toEqual(["big-o", "recursion", "arrays-and-strings", "maps-and-sets", "sorting"]);
    expect(preset.phases).toMatchObject({
      learn: { list: "grind-75", size: 75, block: 3, mix_after_block: 3 },
      master: { list: "grind-75", first_try_success: 0.8 },
      expand: { choose_from: ["grind-169", "neetcode-150"], window: 20, unseen_medium_success: 0.65, medium_minutes: 35 },
    });
    expect(preset.timebox_minutes).toEqual({ easy: 15, medium: 35, hard: 50 });
    expect(preset.patterns.slice(0, 2)).toEqual([
      { pattern: "arrays-hashing", concept: "hash-map" },
      { pattern: "two-pointers", concept: "two-pointers" },
    ]);
    const listed = new Set(preset.patterns.map((entry) => entry.pattern as string));
    const used = scanRepo(REPO_ROOT)
      .problems.filter((p) => strList(p.data.lists).includes("grind-75"))
      .map((p) => strList(p.data.patterns)[0]);
    expect(used.filter((pattern) => !listed.has(pattern))).toEqual([]);
  });

  it("grind-169 and neetcode-150 keep their own pattern order", () => {
    expect(loadPreset(REPO_ROOT, "grind-169").patterns.map((e) => e.pattern)).toEqual([
      "arrays-hashing", "stack", "linked-list", "strings", "trees", "binary-search", "graphs", "dp-1d", "dp-2d",
      "intervals", "heap", "two-pointers", "sliding-window", "tries", "backtracking", "bit-manipulation", "greedy", "math",
    ]);
    expect(loadPreset(REPO_ROOT, "neetcode-150").patterns.map((e) => e.pattern)).toEqual([
      "arrays-hashing", "two-pointers", "sliding-window", "stack", "binary-search", "linked-list", "trees", "heap",
      "backtracking", "tries", "graphs", "dp-1d", "dp-2d", "greedy", "intervals", "math", "bit-manipulation",
    ]);
    expect(loadPreset(REPO_ROOT, "grind-169").phases.learn.size).toBe(169);
    expect(loadPreset(REPO_ROOT, "neetcode-150").phases.learn.size).toBe(150);
  });

  it("report grind-169 and neetcode-150 as not imported yet", () => {
    const catalog = loadCatalog(REPO_ROOT);
    expect(listImport(REPO_ROOT, catalog, "grind-169")).toEqual({ list: "grind-169", imported: 0, size: 169 });
    expect(listImport(REPO_ROOT, catalog, "neetcode-150")).toEqual({ list: "neetcode-150", imported: 0, size: 150 });
  });
});

describe("loadPreset (spec §13: zod issues with paths)", () => {
  it("lists every issue with its path", () => {
    const root = makeCoachRepo();
    put(root, "curriculum/bad.yaml", PRESETS["demo-list"].replace("id: demo-list", "id: bad").replace("block: 2", "block: 0").replace("pattern: stack", "pattern: stacks"));
    expect(issues(root, "bad")).toEqual([
      "phases.learn.block: Too small: expected number to be >0",
      'patterns[2].pattern: Invalid option: expected one of "arrays-hashing"|"two-pointers"|"sliding-window"|"stack"|"binary-search"|"linked-list"|"trees"|"tries"|"heap"|"backtracking"|"graphs"|"dp-1d"|"dp-2d"|"greedy"|"intervals"|"math"|"bit-manipulation"|"strings"',
    ]);
  });

  it("rejects broken YAML, a duplicated pattern, an id that is not the file name, and an unknown preset", () => {
    const root = makeCoachRepo();
    put(root, "curriculum/syntax.yaml", "id: [unclosed\n");
    expect(issues(root, "syntax")[0]).toMatch(/^YAML: /);
    put(root, "curriculum/twice.yaml", PRESETS["demo-list"].replace("id: demo-list", "id: twice").replace("pattern: stack", "pattern: two-pointers"));
    expect(issues(root, "twice")).toEqual(['patterns[2].pattern: "two-pointers" is listed twice']);
    put(root, "curriculum/other.yaml", PRESETS["demo-list"]);
    expect(issues(root, "other")).toEqual(['id: "demo-list" does not match the file name']);
    expect(issues(root, "nope")).toEqual(['there is no preset "nope" (presets: demo-list, ghost-list, other, syntax, twice, wide-list)']);
    expect(() => loadPreset(root, "nope")).toThrow(/curriculum\/nope\.yaml: there is no preset/);
    expect(tryLoadPreset(root, "syntax")).toBeNull();
  });
});

describe("patterns and time-boxes", () => {
  it("puts patterns of the list that the preset misses after the listed ones (spec §5)", () => {
    const root = makeCoachRepo();
    expect(patternOrder(loadPreset(root, "demo-list"), loadCatalog(root))).toEqual(["arrays-hashing", "two-pointers", "stack", "greedy"]);
  });

  it("takes the time-box by difficulty, medium when unknown, and the defaults without a preset", () => {
    const root = makeCoachRepo();
    expect(timeboxMinutes(loadPreset(root, "demo-list"), "hard")).toBe(50);
    expect(timeboxMinutes(null, null)).toBe(35);
    expect(DEFAULT_TIMEBOX).toEqual({ easy: 15, medium: 35, hard: 50 });
  });

  it("knows how much of a list is imported", () => {
    const root = makeCoachRepo();
    expect(listImport(root, loadCatalog(root), "wide-list")).toEqual({ list: "wide-list", imported: 11, size: 12 });
  });
});
