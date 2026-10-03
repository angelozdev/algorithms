import { cn } from "cn";
import { CircleCheck, CirclePause, CircleX, FlaskConical, LoaderCircle, Lock, type LucideIcon, Snail, Timer, TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { formatNamedInput, formatOutput } from "../../../runner/src/format.ts";
import type { HarnessError, RunResult, StressStatus } from "../../../runner/src/types.ts";
import { shortcut } from "../lib/keys.ts";
import { type Chip, type ChipState, exampleRowId, HIDDEN_ROW_ID, runChips, stressRowId } from "../lib/run-summary.ts";
import { Hint } from "./Hint.tsx";
import { DISPLAY_MAX, ErrorBox, formatMs } from "./RunDetails.tsx";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";
import { Badge } from "./ui/badge.tsx";
import { Kbd } from "./ui/kbd.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.tsx";

export interface TestsPanelProps {
  result: RunResult | null;
  running: boolean;
  /** Time since Run, shown while running. */
  elapsedMs: number;
  /** cases.json or stress.ts changed after this result was produced. */
  stale: boolean;
  caseError: string | null;
  paramNames: readonly string[];
}

type Format = (value: unknown) => string;

const LOOK: Record<ChipState, { Icon: LucideIcon; chip: string; text: string }> = {
  passed: { Icon: CircleCheck, chip: "border-success/40 bg-success/10 text-success", text: "text-success" },
  failed: { Icon: CircleX, chip: "border-destructive/40 bg-destructive/10 text-destructive", text: "text-destructive" },
  error: { Icon: CircleX, chip: "border-destructive/40 bg-destructive/10 text-destructive", text: "text-destructive" },
  timeout: { Icon: Timer, chip: "border-destructive/40 bg-destructive/10 text-destructive", text: "text-destructive" },
  slow: { Icon: Snail, chip: "border-warning/40 bg-warning/10 text-warning", text: "text-warning" },
  skipped: { Icon: CirclePause, chip: "border-dashed text-muted-foreground", text: "text-muted-foreground" },
};
const CHIP = "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px]";

/** Moves to the row that explains a chip. */
function jumpTo(rowId: string) {
  const row = document.getElementById(rowId);
  row?.scrollIntoView({ block: "nearest" });
  row?.focus();
}

function Chips({ chips }: { chips: Chip[] }) {
  return (
    <ul aria-label="Results" className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const { Icon, chip: look } = LOOK[chip.state];
        const body = (
          <>
            <Icon aria-hidden className="size-3" />
            {chip.label}
          </>
        );
        const rowId = chip.rowId;
        return (
          <li key={chip.key}>
            <Hint label={chip.description}>
              {rowId ? (
                <button type="button" aria-label={chip.description} onClick={() => jumpTo(rowId)} className={cn(CHIP, look, "cursor-pointer hover:brightness-95")}>
                  {body}
                </button>
              ) : (
                <span role="img" aria-label={chip.description} className={cn(CHIP, look)}>
                  {body}
                </span>
              )}
            </Hint>
          </li>
        );
      })}
    </ul>
  );
}

interface FailureRow {
  id: string;
  label: string;
  input: string;
  /** null for a hidden case: its answer never leaves the server. */
  expected: string | null;
  got: string;
  error?: HarnessError;
}

function failureRows(result: RunResult, input: Format): FailureRow[] {
  const rows: FailureRow[] = result.examples.cases
    .filter((c) => c.status === "fail" || c.status === "error" || c.status === "timeout")
    .map((c) => ({
      id: exampleRowId(c.id),
      label: String(c.id),
      input: input(c.input),
      expected: formatOutput(c.expected, DISPLAY_MAX),
      got: c.status === "fail" ? formatOutput(c.output, DISPLAY_MAX) : c.status,
      error: c.error,
    }));
  const failure = result.hidden.firstFailure;
  if (result.hidden.status === "fail" && failure) {
    rows.push({
      id: HIDDEN_ROW_ID,
      label: "Hidden",
      input: input(failure.input),
      expected: null,
      got: failure.error ? "error" : formatOutput(failure.output, DISPLAY_MAX),
      error: failure.error,
    });
  }
  return rows;
}

const WRAP = "font-mono text-xs break-all whitespace-normal";

function FailuresTable({ rows }: { rows: FailureRow[] }) {
  return (
    <Table aria-label="Failures">
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Case</TableHead>
          <TableHead>Input</TableHead>
          <TableHead>Expected</TableHead>
          <TableHead>Got</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <Fragment key={row.id}>
            <TableRow id={row.id} tabIndex={-1} className="outline-none focus:bg-destructive/10">
              <TableCell>{row.label}</TableCell>
              <TableCell className={WRAP}>{row.input}</TableCell>
              <TableCell className={cn(WRAP, "text-success")}>
                {row.expected === null ? (
                  <span className="inline-flex items-center gap-1 font-sans text-muted-foreground">
                    <Lock aria-hidden className="size-3" />
                    hidden
                  </span>
                ) : (
                  row.expected
                )}
              </TableCell>
              <TableCell className={cn(WRAP, "bg-destructive/5 text-destructive")}>{row.got}</TableCell>
            </TableRow>
            {row.error && (
              <TableRow>
                <TableCell colSpan={4} className="whitespace-normal">
                  <ErrorBox error={row.error} />
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

const STRESS_RESULT: Record<StressStatus, { text: string; state: ChipState }> = {
  pass: { text: "passed", state: "passed" },
  slow: { text: "too slow", state: "slow" },
  timeout: { text: "timeout", state: "timeout" },
  error: { text: "error", state: "error" },
  skipped: { text: "skipped", state: "skipped" },
};

function StressTable({ result }: { result: RunResult }) {
  const { stress } = result;
  if (stress.status === "none") return <p className="text-muted-foreground">No stress cases</p>;
  // Skipped as a whole: its chip says so.
  if (stress.cases.length === 0) return null;
  return (
    <Table aria-label="Stress">
      <TableHeader>
        <TableRow>
          <TableHead>Case</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Limit</TableHead>
          <TableHead>Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stress.cases.map((c, index) => {
          const outcome = STRESS_RESULT[c.status];
          const { Icon, text } = LOOK[outcome.state];
          return (
            <Fragment key={c.name}>
              <TableRow id={stressRowId(index)} tabIndex={-1} className="outline-none focus:bg-destructive/10">
                <TableCell>{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.ms === undefined ? "—" : formatMs(c.ms)}</TableCell>
                <TableCell className="font-mono text-xs">{c.limitMs} ms</TableCell>
                <TableCell>
                  <span className={cn("inline-flex items-center gap-1", text)}>
                    <Icon aria-hidden className="size-3" />
                    {outcome.text}
                  </span>
                </TableCell>
              </TableRow>
              {c.error && (
                <TableRow>
                  <TableCell colSpan={4} className="whitespace-normal">
                    <ErrorBox error={c.error} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function FirstRun() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
      <FlaskConical aria-hidden className="size-6" />
      <p className="flex items-center gap-1.5 text-foreground">
        Run the tests <Kbd>{shortcut("run")}</Kbd>
      </p>
      <p className="flex items-center gap-1.5 text-xs">
        Or try your own input <Kbd>{shortcut("custom")}</Kbd>
      </p>
    </div>
  );
}

export function TestsPanel({ result, running, elapsedMs, stale, caseError, paramNames }: TestsPanelProps) {
  const input: Format = (value) => formatNamedInput(paramNames, value, DISPLAY_MAX);
  const failures = result && !result.fatal ? failureRows(result, input) : [];
  return (
    <div className="space-y-3 p-3 text-[13px]">
      {caseError && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Case file error — not your code. Fix the problem files, or ask Claude.</AlertTitle>
          <AlertDescription>
            <pre className="font-mono text-xs whitespace-pre-wrap">{caseError}</pre>
          </AlertDescription>
        </Alert>
      )}
      {running && (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Running… {(elapsedMs / 1000).toFixed(1)} s
        </p>
      )}
      {!result && !running && !caseError && <FirstRun />}
      {result && (
        <div className={cn("space-y-3", running && "opacity-50")}>
          {stale && <Badge variant="warning">Cases changed — run again</Badge>}
          {result.green && (
            <Alert variant="success">
              <CircleCheck aria-hidden />
              <AlertTitle>Green in {result.lang}.</AlertTitle>
              <AlertDescription>
                Ask Claude for <code>/review</code> in the terminal to mark it solved.
              </AlertDescription>
            </Alert>
          )}
          {result.fatal ? (
            <ErrorBox title={`Could not load ${result.solution.split("/").at(-1)}`} error={result.fatal} />
          ) : (
            <>
              <Chips chips={runChips(result)} />
              {failures.length > 0 && <FailuresTable rows={failures} />}
              <StressTable result={result} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
