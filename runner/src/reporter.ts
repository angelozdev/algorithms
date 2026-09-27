import path from "node:path";
import { styleText } from "node:util";
import type { ExampleResult, HarnessError, RunResult, StressCaseResult } from "./types.ts";

type Paint = (text: string) => string;

const WIDTH = 77;
const MAX_VALUE = 100;
const green: Paint = (text) => styleText("green", text);
const red: Paint = (text) => styleText("red", text);
const dim: Paint = (text) => styleText("gray", text);

function truncate(text: string, max = MAX_VALUE): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Positional arguments as the user would write them: `[2,7,11,15], 9`. */
export function formatInput(input: unknown): string {
  const text = Array.isArray(input) ? input.map((arg) => JSON.stringify(arg)).join(", ") : JSON.stringify(input);
  return truncate(text ?? "undefined");
}

export function formatOutput(output: unknown): string {
  if (output && typeof output === "object" && !Array.isArray(output) && "param" in output) {
    const { ret, param } = output as { ret: unknown; param: unknown };
    return truncate(`returned ${JSON.stringify(ret)}, array is now ${JSON.stringify(param)}`);
  }
  return truncate(JSON.stringify(output) ?? "undefined");
}

function ms(value: number | undefined): string {
  if (value === undefined) return "";
  return `${value < 1 ? value.toFixed(2) : Math.round(value)}ms`;
}

/** "✓ label       text ............ right" with the mark colored and the right part dimmed. */
function row(mark: string, paint: Paint, label: string, text: string, right = ""): string {
  const body = `${label.padEnd(11)} ${text}`;
  const plainLength = 2 + body.length;
  const gap = right ? " ".repeat(Math.max(2, WIDTH - plainLength - right.length)) : "";
  return `${paint(mark)} ${body}${gap}${right ? dim(right) : ""}`;
}

function detail(label: string, text: string): string {
  return `    ${label.padEnd(9)} ${text}`;
}

function stdoutLines(stdout: string): string[] {
  if (!stdout) return [];
  return stdout
    .replace(/\n$/, "")
    .split("\n")
    .map((line, i) => (i === 0 ? detail("stdout", `> ${line}`) : `              > ${line}`));
}

function errorLines(error: HarnessError): string[] {
  const lines = [detail(error.kind === "timeout" ? "timeout" : "error", error.message)];
  if (error.trace) lines.push(...error.trace.split("\n").map((line) => `      ${line.trim()}`));
  return lines;
}

function exampleLines(c: ExampleResult): string[] {
  const label = `example ${c.id}`;
  switch (c.status) {
    case "pass":
      return [row("✓", green, label, `${formatInput(c.input)} → ${formatOutput(c.output)}`, ms(c.ms)), ...stdoutLines(c.stdout)];
    case "fail":
      return [
        row("✗", red, label, formatInput(c.input)),
        detail("expected", truncate(JSON.stringify(c.expected) ?? "undefined")),
        detail("got", formatOutput(c.output)),
        ...stdoutLines(c.stdout),
      ];
    case "error":
    case "timeout":
      return [row("✗", red, label, formatInput(c.input)), ...(c.error ? errorLines(c.error) : []), ...stdoutLines(c.stdout)];
    case "skipped":
      return [row("–", dim, label, "skipped")];
  }
}

function hiddenLines(r: RunResult): string[] {
  const h = r.hidden;
  if (h.status === "skipped") return [row("–", dim, "hidden", r.fatal ? "skipped" : "skipped (fix examples first)")];
  if (h.status === "pass") return [row("✓", green, "hidden", `${h.passed}/${h.total} passed`)];
  const lines = [row("✗", red, "hidden", `${h.passed}/${h.total} passed`)];
  const failure = h.firstFailure;
  if (failure) {
    lines.push(detail("input", formatInput(failure.input)));
    if (failure.error) lines.push(...errorLines(failure.error));
    else lines.push(detail("got", formatOutput(failure.output)));
    lines.push(...stdoutLines(failure.stdout));
  }
  return lines;
}

function stressRow(c: StressCaseResult): string[] {
  const timing = `${ms(c.ms) || "—"} / ${c.limitMs}ms`;
  switch (c.status) {
    case "pass":
      return [row("✓", green, "stress", c.name, timing)];
    case "slow":
      return [row("✗", red, "stress", `${c.name} — too slow`, timing)];
    case "timeout":
      return [row("✗", red, "stress", `${c.name} — timeout`, `> ${c.limitMs}ms`)];
    case "error":
      return [row("✗", red, "stress", c.name), ...(c.error ? errorLines(c.error) : [])];
    case "skipped":
      return [row("–", dim, "stress", `${c.name} — skipped`)];
  }
}

function stressLines(r: RunResult): string[] {
  const s = r.stress;
  if (s.status === "none") return [row("·", dim, "stress", "no stress cases")];
  if (s.status === "skipped") {
    const examplesPassed = !r.fatal && r.examples.passed === r.examples.total;
    return [row("–", dim, "stress", examplesPassed && r.hidden.status === "fail" ? "skipped (fix hidden cases first)" : "skipped")];
  }
  return s.cases.flatMap(stressRow);
}

function summary(r: RunResult): string {
  if (r.fatal) return red("could not load the solution");
  const parts = [`${r.examples.passed}/${r.examples.total} examples`];
  if (r.hidden.status !== "skipped") parts.push(`${r.hidden.passed}/${r.hidden.total} hidden`);
  if (r.stress.status === "pass" || r.stress.status === "fail") parts.push(`stress ${r.stress.status === "pass" ? "ok" : "failed"}`);
  return `${parts.join(" · ")}${r.green ? ` · ${green("GREEN ✓")}` : ""}`;
}

export function formatTerminal(r: RunResult): string {
  const header = `${r.id} · ${r.title} · ${r.lang}`;
  const rule = dim("─".repeat(WIDTH));
  const lines = [`${header}${" ".repeat(Math.max(2, WIDTH - header.length - r.readme.length))}${dim(r.readme)}`, rule];
  if (r.fatal) {
    lines.push(row("✗", red, "load", `could not load ${path.basename(r.solution)}`), ...errorLines(r.fatal));
  } else {
    lines.push(...r.examples.cases.flatMap(exampleLines));
  }
  lines.push(...hiddenLines(r), ...stressLines(r), rule, summary(r));
  return lines.join("\n");
}
