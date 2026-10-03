import type { RunResult } from "../../../runner/src/types.ts";

export function ConsolePanel({ result }: { result: RunResult | null }) {
  const blocks = result
    ? [
        ...result.examples.cases.filter((c) => c.stdout).map((c) => ({ label: `Example ${c.id}`, text: c.stdout })),
        ...(result.hidden.firstFailure?.stdout ? [{ label: "Hidden · first failure", text: result.hidden.firstFailure.stdout }] : []),
      ]
    : [];
  if (blocks.length === 0) {
    return (
      <p className="p-3 text-xs text-neutral-500">
        {result ? "No prints in the last run." : "Prints from your code appear here after ▶ Run."}
      </p>
    );
  }
  return (
    <div className="space-y-3 p-3 font-mono text-xs">
      {blocks.map((block) => (
        <section key={block.label} aria-label={block.label}>
          <h3 className="text-neutral-500">{block.label} ▸</h3>
          <pre className="whitespace-pre-wrap">{block.text}</pre>
        </section>
      ))}
    </div>
  );
}
