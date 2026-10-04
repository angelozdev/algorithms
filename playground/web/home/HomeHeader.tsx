import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "../components/Logo.tsx";
import { Input } from "../components/ui/input.tsx";
import { Progress } from "../components/ui/progress.tsx";

/**
 * The search box. Its text is written to the URL on every keystroke, and the URL's value comes back a moment later.
 * Echoes of what was typed are ignored, so a late echo never overwrites newer text. Any other change (Reset, Back)
 * replaces the text.
 */
function SearchBox({ query, onQuery }: { query: string; onQuery(query: string): void }) {
  const [text, setText] = useState(query);
  const sent = useRef<string[]>([]);
  useEffect(() => {
    const echo = sent.current.indexOf(query);
    if (echo >= 0) {
      sent.current = sent.current.slice(echo + 1);
      return;
    }
    // Not one of our own echoes. If the box already reads this (nothing to sync), drop whatever is left in
    // the queue instead of leaving it there: a render that merges several keystrokes can leave an entry no
    // echo will ever reach, and that stale entry could wrongly swallow a later outside change.
    if (query === text) {
      sent.current = [];
      return;
    }
    setText(query);
  }, [query]);
  return (
    <div className="relative w-64">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Search"
        placeholder="Search problems…"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          sent.current.push(event.target.value);
          onQuery(event.target.value);
        }}
        className="h-8 pl-7"
      />
    </div>
  );
}

export function HomeHeader({ solved, total, query, onQuery }: { solved: number; total: number; query: string; onQuery(query: string): void }) {
  return (
    <header className="mb-6 flex items-center gap-4">
      <h1 className="flex items-center gap-2 text-base font-semibold">
        <Logo />
        Algorithms
      </h1>
      <SearchBox query={query} onQuery={onQuery} />
      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {solved}/{total} solved
        </span>
        <Progress value={total === 0 ? 0 : (solved / total) * 100} aria-label="Problems solved" className="w-28" />
      </div>
    </header>
  );
}
