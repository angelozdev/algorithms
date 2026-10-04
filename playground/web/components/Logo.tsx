import { CodeXml } from "lucide-react";

export function Logo() {
  return (
    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
      <CodeXml className="size-3.5" />
    </span>
  );
}
