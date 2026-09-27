import { describe, expect, it } from "vitest";
import { formatInput, formatOutput, formatTerminal } from "../src/reporter.ts";
import type { RunResult } from "../src/types.ts";

const strip = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: "lc-0001",
    title: "Two Sum",
    lang: "py",
    readme: "problems/lc-0001-two-sum/README.md",
    solution: "problems/lc-0001-two-sum/solution.py",
    fatal: null,
    examples: {
      passed: 1,
      total: 1,
      cases: [{ id: 1, status: "pass", input: [[2, 7, 11, 15], 9], expected: [0, 1], output: [0, 1], ms: 0.01, stdout: "" }],
    },
    hidden: { status: "pass", passed: 3, total: 3, firstFailure: null },
    stress: { status: "none", cases: [] },
    green: true,
    ...overrides,
  };
}

describe("formatInput / formatOutput", () => {
  it("joins positional arguments and shows in-place results", () => {
    expect(formatInput([[2, 7, 11, 15], 9])).toBe("[2,7,11,15], 9");
    expect(formatOutput({ ret: 2, param: [1, 2, 2] })).toBe("returned 2, array is now [1,2,2]");
    expect(formatOutput("x".repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe("formatTerminal", () => {
  it("renders a green run", () => {
    const text = strip(formatTerminal(result()));
    expect(text).toContain("lc-0001 · Two Sum · py");
    expect(text).toContain("problems/lc-0001-two-sum/README.md");
    expect(text).toContain("✓ example 1   [2,7,11,15], 9 → [0,1]");
    expect(text).toContain("0.01ms");
    expect(text).toContain("✓ hidden      3/3 passed");
    expect(text).toContain("· stress      no stress cases");
    expect(text).toContain("1/1 examples · 3/3 hidden · GREEN ✓");
  });

  it("renders a failing example with expected, got and stdout, and skips later phases", () => {
    const text = strip(
      formatTerminal(
        result({
          examples: {
            passed: 0,
            total: 1,
            cases: [{ id: 1, status: "fail", input: [[3, 3], 6], expected: [0, 1], output: [0, 0], ms: 0.02, stdout: "seen {3: 0}\nnext\n" }],
          },
          hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
          stress: { status: "skipped", cases: [] },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✗ example 1   [3,3], 6");
    expect(text).toContain("    expected  [0,1]");
    expect(text).toContain("    got       [0,0]");
    expect(text).toContain("    stdout    > seen {3: 0}");
    expect(text).toContain("              > next");
    expect(text).toContain("– hidden      skipped (fix examples first)");
    expect(text).toContain("– stress      skipped");
    expect(text).not.toContain("GREEN");
  });

  it("renders the first hidden failure without an expected line", () => {
    const text = strip(
      formatTerminal(
        result({
          hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [[-1, 1]], output: 1, stdout: "" } },
          stress: { status: "skipped", cases: [] },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✗ hidden      2/3 passed");
    expect(text).toContain("    input     [-1,1]");
    expect(text).toContain("    got       1");
    expect(text).toContain("– stress      skipped (fix hidden cases first)");
    expect(text.split("expected").length).toBe(1);
  });

  it("renders stress timings and slow cases", () => {
    const text = strip(
      formatTerminal(
        result({
          stress: {
            status: "fail",
            cases: [
              { name: "n=1e5", status: "pass", ms: 12, limitMs: 2000 },
              { name: "n=1e6", status: "slow", ms: 2500, limitMs: 2000 },
            ],
          },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✓ stress      n=1e5");
    expect(text).toContain("12ms / 2000ms");
    expect(text).toContain("✗ stress      n=1e6 — too slow");
    expect(text).toContain("2500ms / 2000ms");
  });

  it("renders load errors", () => {
    const text = strip(
      formatTerminal(
        result({
          fatal: { kind: "load", message: "SyntaxError: expected ':'", trace: "  line 2: def solve(self)" },
          examples: { passed: 0, total: 1, cases: [{ id: 1, status: "skipped", input: [[1], 1], expected: [0], stdout: "" }] },
          hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
          stress: { status: "skipped", cases: [] },
          green: false,
        }),
      ),
    );
    expect(text).toContain("✗ load        could not load solution.py");
    expect(text).toContain("    error     SyntaxError: expected ':'");
    expect(text).toContain("line 2: def solve(self)");
    expect(text).not.toContain("example 1");
  });
});
