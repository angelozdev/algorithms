import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { fixedClock } from "../../study/clock.ts";
import { initStudy } from "../../study/init.ts";
import { itemStatusView } from "../../study/schema.ts";
import { openStudy } from "../../study/store.ts";
import { REPO_ROOT, TSX_BIN } from "../src/paths.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const CASES = {
  entry: "solve",
  params: [{ name: "nums", type: "int[]" }],
  returns: "int",
  examples: [{ input: [[1, 2]], expected: 3 }],
  hidden: [{ input: [[4]], expected: 4 }, { input: [[-1, 1]], expected: 123456789 }],
};
const PY = "class Solution:\n    def solve(self, nums: list[int]) -> int:\n        return sum(nums)\n";
const TS = "export default function solve(nums: number[]): number {\n  return nums.reduce((a, b) => a + b, 0);\n}\n";

makeProblem(root, "lc-0001-sum", { ...CASES, hidden: [{ input: [[4]], expected: 4 }] }, { "solution.py": PY, "solution.ts": TS });
makeProblem(root, "lc-0002-sum-leak", CASES, { "solution.py": PY });
makeProblem(root, "lc-0003-empty", { ...CASES, hidden: [] });
write(root, "problems/lc-0004-broken/README.md", "---\ntitle: Broken\n---\n");
write(root, "problems/lc-0004-broken/cases.json", "{ not json");

function cli(...args: string[]) {
  return spawnSync(TSX_BIN, ["runner/src/cli.ts", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ALGO_ROOT: root },
    encoding: "utf8",
  });
}

describe("pnpm test", () => {
  it("prints JSON for one language and exits 0 when green", () => {
    const run = cli("test", "lc-0001", "--json");
    expect(run.status).toBe(0);
    const parsed = JSON.parse(run.stdout);
    expect(parsed).toMatchObject({ id: "lc-0001", lang: "py", green: true });
  });

  it("prints an array for --lang all with every language that has a solution", () => {
    const run = cli("test", "lc-0001", "--lang", "all", "--json");
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout).map((r: { lang: string }) => r.lang)).toEqual(["py", "ts"]);
  });

  it("exits 1 when not green and never prints hidden expected values", () => {
    const json = cli("test", "lc-0002", "--json");
    expect(json.status).toBe(1);
    expect(json.stdout).not.toContain("123456789");
    const terminal = cli("test", "lc-0002");
    expect(terminal.status).toBe(1);
    expect(terminal.stdout).not.toContain("123456789");
    expect(terminal.stdout).toContain("1/2 passed");
  });

  it("lists candidates for ambiguous queries", () => {
    const run = cli("test", "sum");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('"sum" matches 2');
    expect(run.stderr).toContain("lc-0001");
    expect(run.stderr).toContain("lc-0002");
  });

  it("explains --lang all without solutions", () => {
    const run = cli("test", "lc-0003", "--lang", "all");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("has no solution files yet");
  });

  it("exits 2 on case-file errors", () => {
    const run = cli("test", "lc-0004");
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("Case file error");
    expect(run.stderr).toContain("invalid JSON");
  });

  it("rejects unknown flags with the usage text", () => {
    const run = cli("test", "lc-0001", "--nope");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Usage:");
  });
});

describe("recording the user's runs (study coach spec §7)", () => {
  it("records pnpm test's run and green, and nothing with --no-record", () => {
    const rec = tempDir();
    try {
      makeProblem(rec, "lc-0001-sum", { ...CASES, hidden: [{ input: [[4]], expected: 4 }] }, { "solution.py": PY });
      initStudy(rec, { clock: fixedClock("2026-10-04T10:00:00Z"), timezone: "UTC" });
      const run = (...args: string[]) => spawnSync(TSX_BIN, ["runner/src/cli.ts", ...args], { cwd: REPO_ROOT, env: { ...process.env, ALGO_ROOT: rec }, encoding: "utf8" });
      const statuses = () => {
        const study = openStudy(rec);
        try {
          return study.db.select().from(itemStatusView).all().map((row) => [row.itemId, row.status]);
        } finally {
          study.close();
        }
      };
      expect(run("test", "lc-0001", "--no-record").status).toBe(0);
      expect(statuses()).toEqual([]);
      expect(run("test", "lc-0001").status).toBe(0);
      expect(statuses()).toEqual([["lc-0001", "solved"]]);
      expect(existsSync(`${rec}/.study/state.json`)).toBe(true);
    } finally {
      removeTemp(rec);
    }
  });
});
