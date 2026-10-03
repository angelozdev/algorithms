import { formatNamedInput, formatOutput } from "../../../runner/src/format.ts";
import type { ExampleResult, RunResult, StressCaseResult } from "../../../runner/src/types.ts";
import { cn } from "cn";
import { DISPLAY_MAX, ErrorBox, formatMs } from "./RunDetails.tsx";
import { Badge } from "./ui/badge.tsx";

export interface TestsPanelProps {
  result: RunResult | null;
  running: boolean;
  /** Time since ▶ Run, shown while running. */
  elapsedMs: number;
  /** cases.json or stress.ts changed after this result was produced. */
  stale: boolean;
  caseError: string | null;
  paramNames: readonly string[];
}

type Format = (value: unknown) => string;

const muted = "text-xs text-neutral-500";

function Values({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="ml-6 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-neutral-500">{label}</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExampleRow({ example, input }: { example: ExampleResult; input: Format }) {
  const label = `Example ${example.id}`;
  if (example.status === "pass") {
    return (
      <li>
        ✅ {label} <span className={muted}>{formatMs(example.ms)}</span>
      </li>
    );
  }
  if (example.status === "skipped") return <li className="text-neutral-500">⏸ {label} · skipped</li>;
  const rows: [string, string][] = [["input", input(example.input)]];
  if (example.status === "fail") {
    rows.push(["expected", formatOutput(example.expected, DISPLAY_MAX)], ["got", formatOutput(example.output, DISPLAY_MAX)]);
  }
  return (
    <li className="space-y-1">
      <p>
        ❌ {label}
        {example.status === "timeout" && " · timeout"} <span className={muted}>{formatMs(example.ms)}</span>
      </p>
      <Values rows={rows} />
      {example.error && (
        <div className="ml-6">
          <ErrorBox error={example.error} />
        </div>
      )}
    </li>
  );
}

function Hidden({ result, input }: { result: RunResult; input: Format }) {
  const hidden = result.hidden;
  if (hidden.status === "skipped") {
    return <p className="text-neutral-500">⏸ Hidden · {result.fatal ? "skipped" : "skipped until the examples pass"}</p>;
  }
  if (hidden.status === "pass") {
    return (
      <p>
        ✅ Hidden · {hidden.passed}/{hidden.total} passed
      </p>
    );
  }
  const failure = hidden.firstFailure;
  return (
    <div className="space-y-1">
      <p>
        ❌ Hidden · {hidden.passed}/{hidden.total} passed
      </p>
      {failure && (
        <>
          <p className={cn(muted, "ml-6")}>First failing case (its answer stays hidden):</p>
          <Values rows={failure.error ? [["input", input(failure.input)]] : [["input", input(failure.input)], ["got", formatOutput(failure.output, DISPLAY_MAX)]]} />
          {failure.error && (
            <div className="ml-6">
              <ErrorBox error={failure.error} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STRESS_MARK: Record<StressCaseResult["status"], string> = { pass: "✅", slow: "🐢", timeout: "⏱", error: "❌", skipped: "⏸" };

function stressDetail(c: StressCaseResult): string {
  if (c.status === "pass") return `${formatMs(c.ms)} / ${c.limitMs} ms`;
  if (c.status === "slow") return `${formatMs(c.ms)} / ${c.limitMs} ms · too slow`;
  if (c.status === "timeout") return `timeout (> ${c.limitMs} ms)`;
  return c.status;
}

function Stress({ result }: { result: RunResult }) {
  const stress = result.stress;
  if (stress.status === "none") return <p className="text-neutral-500">· Stress · no stress cases</p>;
  if (stress.status === "skipped") return <p className="text-neutral-500">⏸ Stress · skipped</p>;
  return (
    <ul className="space-y-1">
      {stress.cases.map((c) => (
        <li key={c.name}>
          {STRESS_MARK[c.status]} Stress · {c.name} <span className={muted}>{stressDetail(c)}</span>
          {c.error && (
            <div className="ml-6">
              <ErrorBox error={c.error} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TestsPanel({ result, running, elapsedMs, stale, caseError, paramNames }: TestsPanelProps) {
  const input: Format = (value) => formatNamedInput(paramNames, value, DISPLAY_MAX);
  return (
    <div className="space-y-3 p-3 text-sm">
      {caseError && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950">
          <p className="font-medium">Case file error — not your code. Fix the problem files, or ask Claude.</p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{caseError}</pre>
        </div>
      )}
      {running && (
        <p role="status" className="text-neutral-500">
          Running… {(elapsedMs / 1000).toFixed(1)} s
        </p>
      )}
      {!result && !running && !caseError && <p className="text-neutral-500">Press ▶ Run (⌘↵) to test your code.</p>}
      {result && (
        <div className={cn("space-y-3", running && "opacity-50")}>
          {stale && <Badge variant="warning">cases changed — run again</Badge>}
          {result.green && (
            <p className="rounded-md bg-green-50 p-2 font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
              ✅ Green in {result.lang}. Ask Claude for <code>/review</code> in the terminal to mark it solved.
            </p>
          )}
          {result.fatal ? (
            <ErrorBox title={`Could not load ${result.solution.split("/").at(-1)}`} error={result.fatal} />
          ) : (
            <ul className="space-y-2">
              {result.examples.cases.map((example) => (
                <ExampleRow key={example.id} example={example} input={input} />
              ))}
            </ul>
          )}
          <Hidden result={result} input={input} />
          <Stress result={result} />
        </div>
      )}
    </div>
  );
}
