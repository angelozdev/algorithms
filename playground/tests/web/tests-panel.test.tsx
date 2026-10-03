import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((cell) => cell.textContent);
const tableRows = (name: string) => within(screen.getByRole("table", { name })).getAllByRole("row").slice(1);

describe("TestsPanel", () => {
  it("invites a first run with the shortcuts", () => {
    panel({});
    expect(screen.getByText("Run the tests")).toBeInTheDocument();
    expect(screen.getByText("Or try your own input")).toBeInTheDocument();
  });

  it("shows a green run and points to /review", () => {
    panel({ result: result() });
    expect(screen.getByText(/Green in py/)).toBeInTheDocument();
    expect(screen.getByText("/review")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Example 1: passed, 0.20 ms" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Example 2: passed, 83 ms" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Failures" })).not.toBeInTheDocument();
    expect(screen.getByText("No stress cases")).toBeInTheDocument();
  });

  it("puts a failing example in the failures table, and its chip jumps there", async () => {
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
    const [row] = tableRows("Failures");
    expect(cells(row!)).toEqual(["2", "nums=[3,2,4], target=6", "[1,2]", "[0,0]"]);
    expect(screen.getByRole("img", { name: "Hidden: skipped until the examples pass" })).toBeInTheDocument();
    expect(screen.queryByText(/Green/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Example 2: failed, 0.30 ms" }));
    expect(row).toHaveFocus();
  });

  it("shows the first hidden failure with the input and the user's output, never an expected value", () => {
    panel({
      result: result({
        green: false,
        hidden: { status: "fail", passed: 2, total: 3, firstFailure: { input: [[5, 5], 10], output: [0, 0], stdout: "" } },
        stress: { status: "skipped", cases: [] },
      }),
    });
    expect(screen.getByRole("button", { name: "Hidden: 2 of 3 passed" })).toBeInTheDocument();
    expect(cells(tableRows("Failures")[0]!)).toEqual(["Hidden", "nums=[5,5], target=10", "hidden", "[0,0]"]);
  });

  it("shows an exception with its trace under its row", () => {
    panel({
      result: result({
        green: false,
        examples: {
          passed: 0,
          total: 1,
          cases: [{ id: 1, status: "error", input: [[1], 1], expected: [0, 0], error: { kind: "exception", message: "IndexError: list index out of range", trace: "line 3, in twoSum" }, ms: 1, stdout: "" }],
        },
        hidden: { status: "skipped", passed: 0, total: 3, firstFailure: null },
        stress: { status: "skipped", cases: [] },
      }),
    });
    expect(cells(tableRows("Failures")[0]!)).toEqual(["1", "nums=[1], target=1", "[0,0]", "error"]);
    expect(screen.getByText("exception: IndexError: list index out of range")).toBeInTheDocument();
    expect(screen.getByText("line 3, in twoSum")).toBeInTheDocument();
  });

  it("shows a load error with its trace instead of the results", () => {
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
    expect(screen.queryByRole("list", { name: "Results" })).not.toBeInTheDocument();
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
    expect(tableRows("Stress").map(cells)).toEqual([
      ["n=1e5 random", "83 ms", "2000 ms", "passed"],
      ["n=1e5 sorted", "2400 ms", "2000 ms", "too slow"],
      ["worst case", "—", "2000 ms", "timeout"],
    ]);
    expect(screen.getByRole("button", { name: "Stress n=1e5 sorted: too slow, 2400 ms of 2000 ms" })).toBeInTheDocument();
  });

  it("shows a case-file error, a stale result and the running time", () => {
    panel({ result: result(), caseError: "cases.json is invalid:\n  - entry: required", stale: true, running: true, elapsedMs: 1234 });
    expect(screen.getByText(/Case file error/)).toBeInTheDocument();
    expect(screen.getByText(/entry: required/)).toBeInTheDocument();
    expect(screen.getByText("Cases changed — run again")).toBeInTheDocument();
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
    expect(screen.getByText("Nothing printed yet — print() / console.log output shows up here.")).toBeInTheDocument();
  });
});
