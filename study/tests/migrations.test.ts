import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../runner/src/paths.ts";

describe("study/migrations", () => {
  it("match study/schema.ts: generating against a copy finds no changes", () => {
    const copy = mkdtempSync(path.join(os.tmpdir(), "algo-migrations-"));
    try {
      cpSync(path.join(REPO_ROOT, "study", "migrations"), copy, { recursive: true });
      // --out must be relative to cwd here: drizzle-kit 0.31.11 mis-joins an absolute --out with "./"
      // (drizzle-team/drizzle-orm#3807), turning e.g. "/tmp/x" into the ENOENT path ".//tmp/x".
      const run = spawnSync(
        path.join(REPO_ROOT, "node_modules", ".bin", "drizzle-kit"),
        ["generate", "--dialect", "sqlite", "--schema", "./study/schema.ts", "--out", path.relative(REPO_ROOT, copy)],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
      // Anything else (a new migration, or a rename prompt that fails without a TTY) means schema.ts changed
      // without `pnpm exec drizzle-kit generate --name <what-changed>`.
      expect(run.stdout).toContain("No schema changes");
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });
});
