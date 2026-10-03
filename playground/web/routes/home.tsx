import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { HomeData, HomeProblem, ItemStatus } from "../../server/types.ts";
import { homeQuery } from "../api.ts";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { targetLink } from "../links.ts";

interface Item {
  id: string;
  title: string;
  status: ItemStatus;
  inProgress: boolean;
  error: string | null;
  detail?: string | null;
}

const sectionTitle = "mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500";

function ItemRow({ item }: { item: Item }) {
  return (
    <li className="flex items-baseline gap-2 py-0.5 text-sm">
      <StatusIcon status={item.status} inProgress={item.inProgress} />
      <Link {...targetLink(item.id)} className="hover:underline">
        {item.id} {item.title}
      </Link>
      {item.detail && <span className="text-xs text-neutral-500">· {item.detail}</span>}
      {item.error && (
        <span className="text-xs text-amber-700 dark:text-amber-400" title={item.error}>
          ⚠ {item.error}
        </span>
      )}
    </li>
  );
}

export function HomeView({ data }: { data: HomeData }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matches = (id: string, title: string) =>
    query === "" || id.toLowerCase().includes(query) || title.toLowerCase().includes(query);
  const problems = new Map(data.problems.map((p) => [p.id, p]));
  const exercises = data.concepts.flatMap((c) => c.exercises);
  const inProgress: Item[] = [...data.problems, ...exercises].filter((item) => item.inProgress && matches(item.id, item.title));
  const solved = data.problems.filter((p) => p.status === "solved").length;
  const concepts = data.concepts.filter((c) => matches(c.slug, c.title) || c.exercises.some((e) => matches(e.id, e.title)));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
      <header className="mb-8 flex items-center gap-4">
        <h1 className="text-xl font-semibold">Algorithms</h1>
        <input
          type="search"
          aria-label="Search"
          placeholder="Search…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-8 w-56 rounded-md border border-neutral-300 bg-transparent px-2 text-sm dark:border-neutral-700"
        />
        <span className="ml-auto text-sm text-neutral-500">
          {solved}/{data.problems.length} solved
        </span>
      </header>

      {inProgress.length > 0 && (
        <section aria-labelledby="home-in-progress" className="mb-8">
          <h2 id="home-in-progress" className={sectionTitle}>
            In progress
          </h2>
          <ul>
            {inProgress.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="home-problems" className="mb-8">
        <h2 id="home-problems" className={sectionTitle}>
          Problems
        </h2>
        {data.problems.length === 0 && <p className="text-sm text-neutral-500">No problems yet. Paste one into Claude Code to start.</p>}
        {data.groups.map((group) => {
          const items = group.ids
            .map((id) => problems.get(id))
            .filter((p): p is HomeProblem => p !== undefined && matches(p.id, p.title));
          if (items.length === 0) return null;
          return (
            <div key={group.pattern} className="mb-4">
              <h3 className="mb-1 text-sm font-medium">{group.pattern}</h3>
              <ul>
                {items.map((p) => (
                  <ItemRow key={p.id} item={{ ...p, detail: p.difficulty }} />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="home-concepts" className="mb-8">
        <h2 id="home-concepts" className={sectionTitle}>
          Concepts
        </h2>
        {data.concepts.length === 0 && <p className="text-sm text-neutral-500">No concepts yet.</p>}
        <ul>
          {concepts.map((c) => {
            const done = c.exercises.filter((e) => e.status === "solved").length;
            const rows = c.exercises.filter((e) => matches(e.id, e.title));
            return (
              <li key={c.slug} className="py-0.5 text-sm">
                <Link to="/c/$slug" params={{ slug: c.slug }} className="hover:underline">
                  {c.title}
                </Link>
                <span className="text-xs text-neutral-500">
                  {" "}
                  · {c.status} · {done}/{c.exercises.length} exercises
                </span>
                {c.error && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">⚠ {c.error}</span>}
                {rows.length > 0 && (
                  <ul className="ml-5">
                    {rows.map((e) => (
                      <ItemRow key={e.id} item={e} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-xs text-neutral-500">○ todo · ⏳ in progress · ✅ solved · 👁 revealed</p>
    </main>
  );
}

export function HomePage() {
  const home = useQuery(homeQuery());
  if (home.isPending) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  if (home.isError) {
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {home.error.message}
      </p>
    );
  }
  return <HomeView data={home.data} />;
}
