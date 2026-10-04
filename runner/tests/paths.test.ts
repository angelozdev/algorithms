import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentRoot, studyRoot } from "../src/paths.ts";

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
