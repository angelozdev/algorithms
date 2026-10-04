import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { DifficultyBadge } from "../components/DifficultyBadge.tsx";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { targetLink } from "../links.ts";
import type { ContinueItem } from "./model.ts";
import { SectionTitle } from "./SectionTitle.tsx";

export function ContinueCards({ items }: { items: ContinueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="home-continue" className="mb-8">
      <SectionTitle id="home-continue">Continue</SectionTitle>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              {...targetLink(item.id)}
              aria-label={`${item.id} ${item.title}`}
              className="flex h-full flex-col gap-1.5 rounded-lg border bg-card p-3 transition-colors hover:border-primary/60"
            >
              <span className="flex items-center gap-2">
                <StatusIcon status={item.status} inProgress={item.inProgress} />
                <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                <DifficultyBadge difficulty={item.difficulty} />
              </span>
              <span className="font-medium">{item.title}</span>
              <span className="mt-auto flex items-center text-xs text-muted-foreground">
                {item.context}
                <span className="ml-auto inline-flex items-center gap-0.5 font-medium text-primary">
                  Continue
                  <ChevronRight aria-hidden className="size-3.5" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
