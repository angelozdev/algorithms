import { X } from "lucide-react";
import type { HomeData } from "../../server/types.ts";
import { Button } from "../components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.tsx";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.tsx";
import type { Difficulty } from "../lib/labels.ts";
import { FacetFilter } from "./FacetFilter.tsx";
import { facetOptions } from "./model.ts";
import { clearFilters, GROUP_BY, type GroupBy, type HomeSearch, isFiltered, STATUS_FILTERS, type StatusFilter } from "./search.ts";

const GROUP_LABEL: Record<GroupBy, string> = { none: "None", pattern: "Pattern", concept: "Concept", list: "List", difficulty: "Difficulty", status: "Status" };
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = { all: "All", pending: "Pending", solved: "Solved" };

interface ProblemToolbarProps {
  data: HomeData;
  search: HomeSearch;
  onSearch(change: Partial<HomeSearch>): void;
}

export function ProblemToolbar({ data, search, onSearch }: ProblemToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span aria-hidden className="text-xs text-muted-foreground">
        Group by
      </span>
      <Select value={search.group} onValueChange={(group) => onSearch({ group: group as GroupBy })}>
        <SelectTrigger size="sm" aria-label="Group by" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUP_BY.map((group) => (
            <SelectItem key={group} value={group}>
              {GROUP_LABEL[group]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Status"
        value={search.status}
        onValueChange={(status) => {
          // Radix lets a click on the active item clear the value; the filter always has one.
          if (status) onSearch({ status: status as StatusFilter });
        }}
      >
        {STATUS_FILTERS.map((status) => (
          <ToggleGroupItem key={status} value={status}>
            {STATUS_FILTER_LABEL[status]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <FacetFilter
        title="Difficulty"
        options={facetOptions(data, search, "difficulty")}
        picked={search.difficulty}
        onChange={(difficulty) => onSearch({ difficulty: difficulty as Difficulty[] })}
      />
      <FacetFilter title="Pattern" options={facetOptions(data, search, "pattern")} picked={search.pattern} onChange={(pattern) => onSearch({ pattern })} />
      <FacetFilter title="Concept" options={facetOptions(data, search, "concept")} picked={search.concept} onChange={(concept) => onSearch({ concept })} />
      <FacetFilter title="List" options={facetOptions(data, search, "list")} picked={search.list} onChange={(list) => onSearch({ list })} />
      {isFiltered(search) && (
        <Button variant="ghost" size="sm" onClick={() => onSearch(clearFilters(search))}>
          Reset
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
