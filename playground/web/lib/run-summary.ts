import type { CaseStatus, RunResult, StressCaseResult, StressStatus } from "../../../runner/src/types.ts";
import { formatMs } from "./format.ts";

export type ChipState = "passed" | "failed" | "error" | "timeout" | "skipped" | "slow";

export interface Chip {
  key: string;
  /** Short text on the chip: the example number, "Hidden 2/3", or the stress case's name. */
  label: string;
  state: ChipState;
  /** Spoken, and shown on hover: "Example 2: failed, 0.30 ms". */
  description: string;
  /** Id of the row that explains this chip (failures or stress table), or null when nothing needs explaining. */
  rowId: string | null;
}

export const exampleRowId = (id: number): string => `case-${id}`;
export const HIDDEN_ROW_ID = "case-hidden";
export const stressRowId = (index: number): string => `stress-${index}`;

const EXAMPLE_STATE: Record<CaseStatus, ChipState> = { pass: "passed", fail: "failed", error: "error", timeout: "timeout", skipped: "skipped" };
const STRESS_STATE: Record<StressStatus, ChipState> = { pass: "passed", slow: "slow", timeout: "timeout", error: "error", skipped: "skipped" };
const WORDS: Record<ChipState, string> = { passed: "passed", failed: "failed", error: "error", timeout: "timeout", skipped: "skipped", slow: "too slow" };

const explains = (state: ChipState) => state !== "passed" && state !== "skipped";

export function stressDetail(c: StressCaseResult): string {
  if (c.status === "pass") return `passed, ${formatMs(c.ms)} of ${c.limitMs} ms`;
  if (c.status === "slow") return `too slow, ${formatMs(c.ms)} of ${c.limitMs} ms`;
  if (c.status === "timeout") return `timeout, over ${c.limitMs} ms`;
  return WORDS[STRESS_STATE[c.status]];
}

/** One chip per example, one for the hidden cases, and one per stress case (or one when stress was skipped as a whole). */
export function runChips(result: RunResult): Chip[] {
  const examples = result.examples.cases.map((c): Chip => {
    const state = EXAMPLE_STATE[c.status];
    const time = c.ms === undefined ? "" : `, ${formatMs(c.ms)}`;
    return { key: `example-${c.id}`, label: String(c.id), state, description: `Example ${c.id}: ${WORDS[state]}${time}`, rowId: explains(state) ? exampleRowId(c.id) : null };
  });

  const { hidden } = result;
  const hiddenChip: Chip =
    hidden.status === "skipped"
      ? { key: "hidden", label: "Hidden", state: "skipped", description: result.fatal ? "Hidden: skipped" : "Hidden: skipped until the examples pass", rowId: null }
      : {
          key: "hidden",
          label: `Hidden ${hidden.passed}/${hidden.total}`,
          state: hidden.status === "pass" ? "passed" : "failed",
          description: `Hidden: ${hidden.passed} of ${hidden.total} passed`,
          rowId: hidden.status === "fail" && hidden.firstFailure ? HIDDEN_ROW_ID : null,
        };

  const { stress } = result;
  const stressChips =
    stress.status === "skipped" && stress.cases.length === 0
      ? [{ key: "stress", label: "Stress", state: "skipped" as const, description: "Stress: skipped", rowId: null }]
      : stress.cases.map((c, index): Chip => {
          const state = STRESS_STATE[c.status];
          return { key: `stress-${index}`, label: c.name, state, description: `Stress ${c.name}: ${stressDetail(c)}`, rowId: explains(state) ? stressRowId(index) : null };
        });

  return [...examples, hiddenChip, ...stressChips];
}
