import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { HomeConcept, HomeProblem } from "../../server/types.ts";
import { DifficultyBadge } from "../components/DifficultyBadge.tsx";
import { ErrorMark } from "../components/ErrorMark.tsx";
import { Hint } from "../components/Hint.tsx";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table.tsx";
import { conceptLabel, leetcodeNumber, patternLabel } from "../lib/labels.ts";
import { targetLink } from "../links.ts";
import type { ProblemGroup } from "./model.ts";
import type { SortDir, SortKey } from "./search.ts";

const COLUMNS = 6;

interface ProblemTableProps {
  groups: ProblemGroup[];
  /** False when grouping is "None": the rows show without a group header. */
  grouped: boolean;
  concepts: readonly HomeConcept[];
  sort: SortKey;
  dir: SortDir;
  onSort(key: SortKey): void;
}

function SortHeader({ label, name, column, sort, dir, onSort, className }: { label: string; name: string; column: SortKey; sort: SortKey; dir: SortDir; onSort(key: SortKey): void; className?: string }) {
  const active = sort === column;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    // aria-label repeats the button's name on the <th> itself: the accessible-name-from-content algorithm, as
    // implemented by the dom-accessibility-api version this repo tests against, does not pick up a descendant's
    // own aria-label, so the columnheader would otherwise be named after the button's visible glyph ("#") instead
    // of "Sort by number".
    <TableHead aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} aria-label={name} className={className}>
      <button type="button" aria-label={name} onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <Icon aria-hidden className={cn("size-3", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function ProblemRow({ problem, concepts }: { problem: HomeProblem; concepts: readonly HomeConcept[] }) {
  const number = leetcodeNumber(problem.id);
  const conceptNames = problem.concepts.map((slug) => conceptLabel(slug, concepts)).join(" · ");
  return (
    <TableRow>
      <TableCell className="w-8">
        {problem.error ? <ErrorMark error={problem.error} /> : <StatusIcon status={problem.status} inProgress={problem.inProgress} />}
      </TableCell>
      <TableCell className="w-16 font-mono text-xs text-muted-foreground">{number ?? problem.id}</TableCell>
      <TableCell>
        <Link {...targetLink(problem.id)} className="font-medium hover:underline">
          {problem.title}
        </Link>
      </TableCell>
      <TableCell>
        <DifficultyBadge difficulty={problem.difficulty} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {problem.patterns.map((slug) => (
            <Badge key={slug} variant="outline">
              {patternLabel(slug)}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="max-w-56 text-xs text-muted-foreground">
        {conceptNames && (
          <Hint label={conceptNames}>
            <span className="block truncate">{conceptNames}</span>
          </Hint>
        )}
      </TableCell>
    </TableRow>
  );
}

function GroupRows({ group, grouped, concepts }: { group: ProblemGroup; grouped: boolean; concepts: readonly HomeConcept[] }) {
  // Folded state lives here only: it resets on reload, and a new grouping starts with every group open (spec §4.3).
  const [open, setOpen] = useState(true);
  return (
    <TableBody>
      {grouped && (
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableCell colSpan={COLUMNS} className="py-1">
            <div className="flex items-center gap-2">
              <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 font-semibold">
                {open ? <ChevronDown aria-hidden className="size-3.5" /> : <ChevronRight aria-hidden className="size-3.5" />}
                {group.label}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">{group.problems.length}</span>
              </button>
              {group.conceptSlug && (
                <Link to="/c/$slug" params={{ slug: group.conceptSlug }} aria-label={`Open the ${group.label} concept`} className="text-muted-foreground hover:text-foreground">
                  <BookOpen aria-hidden className="size-3.5" />
                </Link>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
      {open && group.problems.map((problem) => <ProblemRow key={problem.id} problem={problem} concepts={concepts} />)}
    </TableBody>
  );
}

/** The problems as one compact table: a section per group, and headers that sort inside every group. */
export function ProblemTable({ groups, grouped, concepts, sort, dir, onSort }: ProblemTableProps) {
  const header = { sort, dir, onSort };
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <span className="sr-only">Status</span>
            </TableHead>
            <SortHeader label="#" name="Sort by number" column="num" className="w-16" {...header} />
            <SortHeader label="Title" name="Sort by title" column="title" {...header} />
            <SortHeader label="Difficulty" name="Sort by difficulty" column="difficulty" {...header} />
            <TableHead>Patterns</TableHead>
            <TableHead>Concepts</TableHead>
          </TableRow>
        </TableHeader>
        {groups.map((group) => (
          <GroupRows key={group.key} group={group} grouped={grouped} concepts={concepts} />
        ))}
      </Table>
    </div>
  );
}
