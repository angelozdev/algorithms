import type { RunResult } from "../../../runner/src/types.ts";

export function ConsolePanel({ result }: { result: RunResult | null }) {
  const blocks = result
    ? [
        ...result.examples.cases.filter((c) => c.stdout).map((c) => ({ label: `Example ${c.id}`, text: c.stdout })),
        ...(result.hidden.firstFailure?.stdout ? [{ label: "Hidden · first failure", text: result.hidden.firstFailure.stdout }] : []),
      ]
    : [];
  if (blocks.length === 0) {
    return <p className="p-3 text-xs text-muted-foreground">{result ? "No prints in the last run." : "Nothing printed yet — print() / console.log output shows up here."}</p>;
  }
  return (
    <div className="space-y-3 p-3">
      {blocks.map((block) => (
        <section key={block.label} aria-label={block.label}>
          <h3 className="mb-1 font-mono text-[11px] text-muted-foreground">{block.label}</h3>
          <pre className="rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">{block.text}</pre>
        </section>
      ))}
    </div>
  );
}
