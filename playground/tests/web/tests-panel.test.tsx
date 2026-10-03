import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunResult } from "../../../runner/src/types.ts";
import { ConsolePanel } from "../../web/components/ConsolePanel.tsx";
import { TestsPanel, type TestsPanelProps } from "../../web/components/TestsPanel.tsx";

function result(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: "lc-0001",
    title: "Two Sum",
    lang: "py",
    readme: "problems/lc-0001-two-sum/README.md",
    solution: "problems/lc-0001-two-sum/solution.py",
    fatal: null,
    examples: {
      passed: 2,
      total: 2,
      cases: [
        { id: 1, status: "pass", input: [[2, 7, 11, 15], 9], expected: [0, 1], output: [0, 1], ms: 0.2, stdout: "" },
        { id: 2, status: "pass", input: [[3, 2, 4], 6], expected: [1, 2], output: [1, 2], ms: 83.4, stdout: "" },
      ],
    },
    hidden: { status: "pass", passed: 3, total: 3, firstFailure: null },
    stress: { status: "none", cases: [] },
    green: true,
    ...overrides,
  };
}

const panel = (props: Partial<TestsPanelProps>) =>
  render(<TestsPanel result={null} running={false} elapsedMs={0} stale={false} caseError={null} paramNames={["nums", "target"]} {...props} />);

describe("TestsPanel", () => {
  it("invites a first run", () => {
    panel({});
    expect(screen.getByText(/Press ▶ Run/)).toBeInTheDocument();
  });

  it("shows a green run and points to /review", () => {
    panel({ result: result() });
    expect(screen.getByText(/Green in py/)).toBeInTheDocument();
    expect(screen.getByText("/review")).toBeInTheDocument();
    expect(screen.getByText("0.20 ms")).toBeInTheDocument();
    expect(screen.getByText("83 ms")).toBeInTheDocument();
  });

  it("shows a failing example with named input, expected and got, and skips hidden", () => {
    const failing = result({
      green: false,
      examples: {
        passed: 1,
        total: 2,
        cases: [
          { id: 1, status: "pass", input: [[2, 7, 11, 15], 9], expected: [0, 1], output: [0, 1], ms: 0.2, stdout: "" },
          { id: 2, status: "fail", input: [[3, 2, 4], 6], expected: [1, 2], output: [0, 0], ms: 0.3, stdout: "" },
        ],
      },
      hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
      stress: { status: "skipped", cases: [] },
    });
    panel({ result: failing });
    expect(screen.getByText("nums=[3,2,4], target=6")).toBeInTheDocument();
    expect(screen.getByText("[1,2]")).toBeInTheDocument();
    expect(screen.getByText("[0,0]")).toBeInTheDocument();
    expect(screen.getByText(/Hidden · skipped until the examples pass/)).toBeInTheDocument();
    expect(screen.queryByText(/Green/)).not.toBeInTheDocument();
  });

  it("shows the first hidden failure with the input and the user's output, never an expected value", () => {
    panel({
      result: result({
        green: false,
        hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [[5, 5], 10], output: [0, 0], stdout: "" } },
        stress: { status: "skipped", cases: [] },
      }),
    });
    expect(screen.getByText(/Hidden · 2\/3 passed/)).toBeInTheDocument();
    expect(screen.getByText("nums=[5,5], target=10")).toBeInTheDocument();
    expect(screen.getByText("[0,0]")).toBeInTheDocument();
    expect(screen.queryByText("expected", { exact: true })).not.toBeInTheDocument();
  });

  it("shows a load error with its trace", () => {
    panel({
      result: result({
        green: false,
        fatal: { kind: "load", message: "SyntaxError: expected ':'", trace: 'File "solution.py", line 2' },
        examples: { passed: 0, total: 2, cases: [] },
        hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
        stress: { status: "skipped", cases: [] },
      }),
    });
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Could not load solution.py")).toBeInTheDocument();
    expect(within(alert).getByText("load: SyntaxError: expected ':'")).toBeInTheDocument();
    expect(within(alert).getByText('File "solution.py", line 2')).toBeInTheDocument();
  });

  it("shows stress timings, slow cases and timeouts", () => {
    panel({
      result: result({
        green: false,
        stress: {
          status: "fail",
          cases: [
            { name: "n=1e5 random", status: "pass", ms: 83, limitMs: 2000 },
            { name: "n=1e5 sorted", status: "slow", ms: 2400, limitMs: 2000 },
            { name: "worst case", status: "timeout", limitMs: 2000 },
          ],
        },
      }),
    });
    expect(screen.getByText("83 ms / 2000 ms")).toBeInTheDocument();
    expect(screen.getByText("2400 ms / 2000 ms · too slow")).toBeInTheDocument();
    expect(screen.getByText("timeout (> 2000 ms)")).toBeInTheDocument();
  });

  it("shows a case-file error, a stale result and the running time", () => {
    panel({ result: result(), caseError: "cases.json is invalid:\n  - entry: required", stale: true, running: true, elapsedMs: 1234 });
    expect(screen.getByText(/Case file error/)).toBeInTheDocument();
    expect(screen.getByText(/entry: required/)).toBeInTheDocument();
    expect(screen.getByText("cases changed — run again")).toBeInTheDocument();
    expect(screen.getByText("Running… 1.2 s")).toBeInTheDocument();
  });
});

describe("ConsolePanel", () => {
  it("groups the prints by case", () => {
    const run = result({
      examples: {
        passed: 2,
        total: 2,
        cases: [
          { id: 1, status: "pass", input: [[1], 1], expected: [], output: [], ms: 1, stdout: "seen={}\n" },
          { id: 2, status: "pass", input: [[2], 2], expected: [], output: [], ms: 1, stdout: "" },
        ],
      },
      hidden: { status: "fail", passed: 0, total: 1, firstFailure: { input: [[3], 3], output: [], stdout: "hidden print\n" } },
    });
    render(<ConsolePanel result={run} />);
    expect(within(screen.getByRole("region", { name: "Example 1" })).getByText("seen={}")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Example 2" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Hidden · first failure" })).getByText("hidden print")).toBeInTheDocument();
  });

  it("explains where prints appear", () => {
    render(<ConsolePanel result={null} />);
    expect(screen.getByText(/Prints from your code appear here/)).toBeInTheDocument();
  });
});
