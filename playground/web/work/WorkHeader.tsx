import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Lightbulb, LoaderCircle, Play } from "lucide-react";
import { Fragment } from "react";
import { type Lang, LANGS } from "../../../runner/src/types.ts";
import type { HomeData, TargetData } from "../../server/types.ts";
import { homeQuery } from "../api.ts";
import { DifficultyBadge } from "../components/DifficultyBadge.tsx";
import { Hint } from "../components/Hint.tsx";
import { Logo } from "../components/Logo.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/ui/breadcrumb.tsx";
import { Button } from "../components/ui/button.tsx";
import { Kbd } from "../components/ui/kbd.tsx";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.tsx";
import { shortcut } from "../lib/keys.ts";
import { conceptLabel, patternLabel, STATUS_LABEL, type StatusKind, statusKind } from "../lib/labels.ts";

export interface WorkHeaderProps {
  target: TargetData;
  lang: Lang;
  onLang(lang: Lang): void;
  running: boolean;
  /** Time since Run, shown on the button while running. */
  elapsedMs: number;
  canRun: boolean;
  onRun(): void;
  /** Why the language cannot change now (text that is not on disk and nothing will save by itself), or null. */
  langLock: string | null;
}

type Crumb = { label: string; pattern: string } | { label: string; concept: string } | { label: string };

/** The crumbs between "Algorithms" and the page. They need the home data (patterns, concept titles) and wait for it. */
export function middleCrumbs(target: TargetData, home: HomeData | undefined): Crumb[] {
  if (!home) return [];
  if (target.kind === "exercise") {
    const slug = target.id.slice(0, target.id.indexOf("/"));
    return [{ label: "Concepts" }, { label: conceptLabel(slug, home.concepts), concept: slug }];
  }
  const pattern = home.problems.find((problem) => problem.id === target.id)?.patterns[0];
  return pattern ? [{ label: patternLabel(pattern), pattern }] : [];
}

const STATUS_BADGE: Record<StatusKind, "warning" | "outline" | "secondary" | "default"> = {
  "in-progress": "warning",
  todo: "outline",
  revealed: "secondary",
  solved: "default",
};

function LanguageSwitch({ lang, onLang, lock }: { lang: Lang; onLang(lang: Lang): void; lock: string | null }) {
  const group = (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Language"
      value={lang}
      onValueChange={(value) => {
        // Radix lets a click on the active item clear the value; a language is always chosen.
        if (value === "py" || value === "ts") onLang(value);
      }}
    >
      {LANGS.map((value) => (
        <ToggleGroupItem key={value} value={value} disabled={lock !== null} className="font-mono">
          {value}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
  if (lock === null) return group;
  // Disabled buttons get no pointer events, so the reason hangs on a wrapper that does.
  return (
    <Hint label={lock}>
      <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        {group}
      </span>
    </Hint>
  );
}

export function WorkHeader({ target, lang, onLang, running, elapsedMs, canRun, onRun, langLock }: WorkHeaderProps) {
  const home = useQuery(homeQuery());
  const crumbs = middleCrumbs(target, home.data);
  const kind = statusKind(target.status, false);
  const short = target.kind === "exercise" ? target.id.slice(target.id.indexOf("/") + 1) : target.id;
  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b bg-card px-3 text-[13px]">
      <Breadcrumb>
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="flex items-center gap-2 font-medium text-foreground">
                <Logo />
                Algorithms
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.map((crumb) => (
            <Fragment key={crumb.label}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {"pattern" in crumb ? (
                  <BreadcrumbLink asChild>
                    <Link to="/" search={{ pattern: [crumb.pattern] }}>
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : "concept" in crumb ? (
                  <BreadcrumbLink asChild>
                    <Link to="/c/$slug" params={{ slug: crumb.concept }}>
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">
              <span className="font-mono text-xs font-normal text-muted-foreground">{short}</span> {target.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <DifficultyBadge difficulty={target.difficulty} />
      <Badge variant={STATUS_BADGE[kind]}>{STATUS_LABEL[kind]}</Badge>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lightbulb aria-hidden className="size-3.5" />
        {target.hints} {target.hints === 1 ? "hint" : "hints"}
      </span>
      {target.url && (
        <Hint label="Open the original problem">
          <a href={target.url} target="_blank" rel="noreferrer" aria-label="Open the original problem" className="text-muted-foreground hover:text-foreground">
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </Hint>
      )}
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitch lang={lang} onLang={onLang} lock={langLock} />
        <Hint
          label={
            <>
              Run the tests <Kbd>{shortcut("run")}</Kbd>
            </>
          }
        >
          <Button onClick={onRun} disabled={!canRun}>
            {running ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
            {running ? `Running… ${(elapsedMs / 1000).toFixed(1)} s` : "Run"}
          </Button>
        </Hint>
      </div>
    </header>
  );
}
