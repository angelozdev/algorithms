import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Inbox, SearchX, TriangleAlert } from "lucide-react";
import type { HomeData } from "../../server/types.ts";
import { homeQuery } from "../api.ts";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Button } from "../components/ui/button.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { ConceptList } from "../home/ConceptList.tsx";
import { ContinueCards } from "../home/ContinueCards.tsx";
import { HomeHeader } from "../home/HomeHeader.tsx";
import { conceptRows, continueItems, problemList } from "../home/model.ts";
import { ProblemTable } from "../home/ProblemTable.tsx";
import { ProblemToolbar } from "../home/ProblemToolbar.tsx";
import { clearFilters, type HomeSearch, type SortKey } from "../home/search.ts";
import { SectionTitle } from "../home/SectionTitle.tsx";

const route = getRouteApi("/");

export interface HomeViewProps {
  data: HomeData;
  search: HomeSearch;
  /** Changes part of the view; the page writes it to the URL. */
  onSearch(change: Partial<HomeSearch>): void;
}

export function HomeView({ data, search, onSearch }: HomeViewProps) {
  const list = problemList(data, search);
  const solved = data.problems.filter((problem) => problem.status === "solved").length;
  const sortBy = (key: SortKey) => onSearch(search.sort === key ? { dir: search.dir === "asc" ? "desc" : "asc" } : { sort: key, dir: "asc" });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-6 text-[13px]">
      <HomeHeader solved={solved} total={data.problems.length} query={search.q} onQuery={(q) => onSearch({ q })} />
      <ContinueCards items={continueItems(data, search.q)} />
      <section aria-labelledby="home-problems" className="mb-8">
        <SectionTitle id="home-problems">Problems</SectionTitle>
        {data.problems.length === 0 ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Inbox aria-hidden className="size-4" />
            No problems yet. Paste one into Claude Code to start.
          </p>
        ) : (
          <>
            <ProblemToolbar data={data} search={search} onSearch={onSearch} />
            {list.matching === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                <SearchX aria-hidden className="size-5 text-muted-foreground" />
                <p className="font-medium">No problems match</p>
                <Button variant="outline" size="sm" onClick={() => onSearch(clearFilters(search))}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <ProblemTable groups={list.groups} grouped={search.group !== "none"} concepts={data.concepts} sort={search.sort} dir={search.dir} onSort={sortBy} />
            )}
          </>
        )}
      </section>
      <ConceptList rows={conceptRows(data, search.q)} hasConcepts={data.concepts.length > 0} />
    </main>
  );
}

function HomeSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
      <Skeleton className="mb-6 h-8 w-80" />
      <div className="mb-8 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
    </main>
  );
}

export function HomePage() {
  const home = useQuery(homeQuery());
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/" });
  // The search box replaces the history entry, so typing does not add one per keystroke. Other changes push one,
  // so Back returns to the previous view. Reset and "Clear filters" touch `q` too, but alongside every other
  // filter: that is not the search box typing, so it must push like any other change.
  const onSearch = (change: Partial<HomeSearch>) =>
    void navigate({ search: (current) => ({ ...current, ...change }), replace: Object.keys(change).length === 1 && "q" in change });

  if (home.isPending) return <HomeSkeleton />;
  if (home.isError) {
    return (
      <Alert variant="destructive" className="m-6 w-auto">
        <TriangleAlert aria-hidden />
        <AlertTitle>Could not load the problems</AlertTitle>
        <AlertDescription>{home.error.message}</AlertDescription>
      </Alert>
    );
  }
  return <HomeView data={home.data} search={search} onSearch={onSearch} />;
}
