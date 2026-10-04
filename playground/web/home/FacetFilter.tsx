import { cn } from "cn";
import { Check, CirclePlus } from "lucide-react";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../components/ui/command.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.tsx";
import { Separator } from "../components/ui/separator.tsx";
import type { FacetOption } from "./model.ts";

interface FacetFilterProps {
  title: string;
  options: FacetOption[];
  picked: readonly string[];
  onChange(next: string[]): void;
}

/** A multi-select filter with counts, as in shadcn's data-table example. */
export function FacetFilter({ title, options, picked, onChange }: FacetFilterProps) {
  const toggle = (value: string) => onChange(picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value]);
  const pickedLabels = options.filter((option) => picked.includes(option.value)).map((option) => option.label);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(picked.length === 0 && "border-dashed")}>
          <CirclePlus aria-hidden />
          {title}
          {picked.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-3.5" />
              <Badge variant="secondary">{picked.length > 2 ? `${picked.length} selected` : pickedLabels.join(", ")}</Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const on = picked.includes(option.value);
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <span
                      aria-hidden
                      className={cn("flex size-3.5 items-center justify-center rounded-sm border", on ? "border-primary bg-primary text-primary-foreground" : "opacity-60")}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span>{option.label}</span>{" "}
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">{option.count}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {picked.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className="justify-center">
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
