import { describe, expect, it } from "vitest";
import type { RunResult } from "../../../runner/src/types.ts";
import { runChips } from "../../web/lib/run-summary.ts";

const base: RunResult = {
  id: "lc-0001",
  title: "Two Sum",
  lang: "py",
  readme: "problems/lc-0001-two-sum/README.md",
  solution: "problems/lc-0001-two-sum/solution.py",
  fatal: null,
  examples: { passed: 0, total: 0, cases: [] },
  hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
  stress: { status: "none", cases: [] },
  green: false,
};

describe("run chips", () => {
  it("gives every example a chip, and points the failing ones at their explanation", () => {
    const chips = runChips({
      ...base,
      examples: {
        passed: 1,
        total: 4,
        cases: [
          { id: 1, status: "pass", input: [], expected: 1, output: 1, ms: 0.2, stdout: "" },
          { id: 2, status: "fail", input: [], expected: 1, output: 2, ms: 0.3, stdout: "" },
          { id: 3, status: "timeout", input: [], expected: 1, stdout: "" },
          { id: 4, status: "error", input: [], expected: 1, error: { kind: "exception", message: "boom", trace: "" }, ms: 1, stdout: "" },
        ],
      },
    });
    expect(chips.map((chip) => [chip.label, chip.state, chip.description, chip.rowId])).toEqual([
      ["1", "passed", "Example 1: passed, 0.20 ms", null],
      ["2", "failed", "Example 2: failed, 0.30 ms", "case-2"],
      ["3", "timeout", "Example 3: timeout", "case-3"],
      ["4", "error", "Example 4: error, 1 ms", "case-4"],
      ["Hidden", "skipped", "Hidden: skipped until the examples pass", null],
    ]);
  });

  it("sums up the hidden cases and lists each stress case", () => {
    const chips = runChips({
      ...base,
      hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [], output: 0, stdout: "" } },
      stress: {
        status: "fail",
        cases: [
          { name: "n=1e5 random", status: "pass", ms: 83, limitMs: 2000 },
          { name: "n=1e5 sorted", status: "slow", ms: 2400, limitMs: 2000 },
          { name: "worst case", status: "timeout", limitMs: 2000 },
        ],
      },
    });
    expect(chips.map((chip) => [chip.label, chip.state, chip.description, chip.rowId])).toEqual([
      ["Hidden 2/3", "failed", "Hidden: 2 of 3 passed", "case-hidden"],
      ["n=1e5 random", "passed", "Stress n=1e5 random: passed, 83 ms of 2000 ms", null],
      ["n=1e5 sorted", "slow", "Stress n=1e5 sorted: too slow, 2400 ms of 2000 ms", "stress-1"],
      ["worst case", "timeout", "Stress worst case: timeout, over 2000 ms", "stress-2"],
    ]);
  });

  it("shows stress that was skipped as a whole as one chip", () => {
    const chips = runChips({ ...base, hidden: { status: "pass", passed: 3, total: 3, firstFailure: null }, stress: { status: "skipped", cases: [] } });
    expect(chips.map((chip) => [chip.label, chip.state, chip.description])).toEqual([
      ["Hidden 3/3", "passed", "Hidden: 3 of 3 passed"],
      ["Stress", "skipped", "Stress: skipped"],
    ]);
  });
});
