import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { studyRoot } from "../../../runner/src/paths.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the e2e fixture", () => {
  it("keeps pnpm e2e on the e2e repo's own .study even when ALGO_STUDY is set in the shell", async () => {
    vi.stubEnv("ALGO_STUDY", "/the/users/real/progress");
    // Loaded after the variable is set, as pnpm e2e loads it: before resetRepo() or the servers can run.
    const { E2E_ROOT } = await import("../../e2e/fixture.ts");
    expect(studyRoot(E2E_ROOT)).toBe(path.join(E2E_ROOT, ".study"));
  });
});
