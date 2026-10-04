import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contentRoot,
  historyPath,
  historyStamp,
  legacySolutionPath,
  REPO_ROOT,
  studyRoot,
  studySolutionDir,
  studySolutionPath,
  targetRoot,
  TSX_TSCONFIG,
  writeStudyTsconfig,
} from "../src/paths.ts";
import type { Target } from "../src/types.ts";
import { removeTemp, tempDir, write } from "./helpers.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("studyRoot", () => {
  it("is .study inside the content root it is given", () => {
    expect(studyRoot("/work/repo")).toBe(path.join("/work/repo", ".study"));
  });

  it("defaults to the content root, which follows ALGO_ROOT", () => {
    vi.stubEnv("ALGO_ROOT", "/tmp/fixture-repo");
    expect(contentRoot()).toBe(path.resolve("/tmp/fixture-repo"));
    expect(studyRoot()).toBe(path.join(path.resolve("/tmp/fixture-repo"), ".study"));
  });

  it("uses ALGO_STUDY when it is set, made absolute", () => {
    vi.stubEnv("ALGO_STUDY", "progress/mine");
    expect(studyRoot("/work/repo")).toBe(path.resolve("progress/mine"));
  });

  it("runs every test with ALGO_STUDY cleared, so no test can reach the user's own progress", () => {
    expect(process.env.ALGO_STUDY).toBe("");
    expect(studyRoot("/work/repo")).toBe(path.join("/work/repo", ".study"));
  });
});

describe("solution locations", () => {
  const problem: Target = { id: "lc-0001", kind: "problem", dir: "/work/repo/problems/lc-0001-two-sum", title: "Two Sum" };
  const exercise: Target = {
    id: "hash-map/01",
    kind: "exercise",
    dir: "/work/repo/concepts/hash-map/exercises/01-first-repeat",
    title: "First repeat",
  };

  it("finds the content root of a problem and of an exercise", () => {
    expect(targetRoot(problem)).toBe("/work/repo");
    expect(targetRoot(exercise)).toBe("/work/repo");
  });

  it("keeps solutions under .study/solutions by kind and id, and knows the old in-folder place", () => {
    expect(studySolutionDir(problem)).toBe("/work/repo/.study/solutions/problems/lc-0001");
    expect(studySolutionPath(problem, "py")).toBe("/work/repo/.study/solutions/problems/lc-0001/solution.py");
    expect(studySolutionPath(exercise, "ts")).toBe("/work/repo/.study/solutions/exercises/hash-map/01/solution.ts");
    expect(legacySolutionPath(problem, "py")).toBe("/work/repo/problems/lc-0001-two-sum/solution.py");
  });

  it("names history files with a file-name-safe ISO time, and marks migrated ones -legacy", () => {
    const at = new Date("2026-10-04T10:00:00.000Z");
    expect(historyStamp(at)).toBe("2026-10-04T10-00-00-000Z");
    expect(historyPath(problem, "py", at)).toBe("/work/repo/.study/solutions/problems/lc-0001/history/2026-10-04T10-00-00-000Z.py");
    expect(historyPath(exercise, "ts", at, { legacy: true })).toBe(
      "/work/repo/.study/solutions/exercises/hash-map/01/history/2026-10-04T10-00-00-000Z-legacy.ts",
    );
  });

  it("follows ALGO_STUDY", () => {
    vi.stubEnv("ALGO_STUDY", "/progress");
    expect(studySolutionPath(problem, "py")).toBe("/progress/solutions/problems/lc-0001/solution.py");
  });
});

describe(".study/tsconfig.json", () => {
  it("extends the repo's tsconfig, points at its @types, takes solutions and leaves history out; onlyIfMissing keeps an existing one", () => {
    const root = tempDir();
    const dir = path.join(root, ".study");
    writeStudyTsconfig(dir);
    const text = readFileSync(path.join(dir, "tsconfig.json"), "utf8");
    expect(text.startsWith("// Generated")).toBe(true);
    const config = JSON.parse(text.slice(text.indexOf("{")));
    expect(path.resolve(dir, config.extends)).toBe(TSX_TSCONFIG);
    expect(path.resolve(dir, config.compilerOptions.typeRoots[0])).toBe(path.join(REPO_ROOT, "node_modules", "@types"));
    expect(config.include).toEqual(["solutions/**/*.ts"]);
    expect(config.exclude).toEqual(["solutions/**/history"]);
    writeFileSync(path.join(dir, "tsconfig.json"), "{}\n");
    writeStudyTsconfig(dir, { onlyIfMissing: true });
    expect(readFileSync(path.join(dir, "tsconfig.json"), "utf8")).toBe("{}\n");
    removeTemp(root);
  });

  it("lets tsc resolve lc for a solution under .study, and skips history", () => {
    const root = tempDir();
    const dir = path.join(root, ".study");
    write(dir, "solutions/problems/lc-0001/solution.ts", 'import { ListNode } from "lc";\nexport default function f(head: ListNode | null): number {\n  return head ? head.val : 0;\n}\n');
    write(dir, "solutions/problems/lc-0001/history/old.ts", 'const broken: number = "not a number";\nexport default broken;\n');
    writeStudyTsconfig(dir);
    const run = spawnSync(path.join(REPO_ROOT, "node_modules", ".bin", "tsc"), ["-p", path.join(dir, "tsconfig.json")], { encoding: "utf8" });
    expect(run.stdout + run.stderr).toBe("");
    expect(run.status).toBe(0);
    removeTemp(root);
  });
});
