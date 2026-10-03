export type Lang = "py" | "ts";
export const LANGS: readonly Lang[] = ["py", "ts"];

export type CompareMode = "exact" | "unordered" | "float" | "any-of";

export interface Param {
  name: string;
  type: string;
}

export interface InPlace {
  param: string;
  prefix?: "return";
}

/** One entry of `examples` or `hidden`. `expected === undefined` means "not filled yet". */
export interface CaseEntry {
  input: unknown;
  expected?: unknown;
}

/** Normalized cases.json (defaults applied). */
export interface CaseFile {
  mode: "function" | "class";
  entry: string;
  params: Param[];
  returns: string | null;
  compare: CompareMode;
  inPlace: InPlace | null;
  examples: CaseEntry[];
  hidden: CaseEntry[];
}

export type TargetKind = "problem" | "exercise";

/** A runnable folder (it has a cases.json): a problem or a concept exercise. */
export interface Target {
  id: string;
  kind: TargetKind;
  dir: string;
  title: string;
}

export type HarnessErrorKind =
  | "load"
  | "missing-entry"
  | "exception"
  | "serialization"
  | "timeout"
  | "crash";

export interface HarnessError {
  kind: HarnessErrorKind;
  message: string;
  trace: string;
}

/** Sent to a harness on stdin. Never contains expected values. */
export interface HarnessRequest {
  solutionPath: string;
  mode: "function" | "class";
  entry: string;
  params: Param[];
  returns: string | null;
  inPlace: InPlace | null;
  discardOutput: boolean;
  cases: { id: string; input: unknown }[];
}

/** One JSON line written by a harness on fd 3. */
export type HarnessMessage =
  | { type: "ready" }
  | { type: "fatal"; error: HarnessError }
  | { type: "start"; id: string }
  | { type: "case"; id: string; ok: true; output: unknown; ms: number; stdout: string }
  | { type: "case"; id: string; ok: false; error: HarnessError; ms: number; stdout: string };

export interface CaseRun {
  id: string;
  ok: boolean;
  output?: unknown;
  error?: HarnessError;
  ms: number;
  stdout: string;
}

export interface HarnessOutcome {
  fatal: HarnessError | null;
  runs: Map<string, CaseRun>;
  /** Case that was running when the wall-clock limit killed the process. */
  timedOutCase: string | null;
  stderr: string;
}

export type CaseStatus = "pass" | "fail" | "error" | "timeout" | "skipped";

export interface ExampleResult {
  id: number;
  status: CaseStatus;
  input: unknown;
  expected: unknown;
  output?: unknown;
  error?: HarnessError;
  ms?: number;
  stdout: string;
}

/** Never carries an expected value: hidden answers stay inside the orchestrator. */
export interface HiddenFailure {
  input: unknown;
  output?: unknown;
  error?: HarnessError;
  stdout: string;
}

export interface HiddenResult {
  status: "pass" | "fail" | "skipped";
  passed: number;
  total: number;
  firstFailure: HiddenFailure | null;
}

export type StressStatus = "pass" | "slow" | "timeout" | "error" | "skipped";

export interface StressCaseResult {
  name: string;
  status: StressStatus;
  ms?: number;
  limitMs: number;
  error?: HarnessError;
}

export interface StressResult {
  status: "pass" | "fail" | "skipped" | "none";
  cases: StressCaseResult[];
}

export interface RunResult {
  id: string;
  title: string;
  lang: Lang;
  readme: string;
  solution: string;
  fatal: HarnessError | null;
  examples: { passed: number; total: number; cases: ExampleResult[] };
  hidden: HiddenResult;
  stress: StressResult;
  green: boolean;
}

/** One run of the user's code on an input of their own. Nothing is judged, so there is no expected value. */
export interface CustomResult {
  /** The solution did not load (syntax error, missing entry…). */
  fatal: HarnessError | null;
  output?: unknown;
  error?: HarnessError;
  ms?: number;
  /** Prints, cut to 20 lines. */
  stdout: string;
}
