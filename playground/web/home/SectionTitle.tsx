import type { ReactNode } from "react";

export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 font-mono text-xs font-medium text-muted-foreground">
      {children}
    </h2>
  );
}
