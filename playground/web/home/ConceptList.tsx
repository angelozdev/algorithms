import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { ErrorMark } from "../components/ErrorMark.tsx";
import { StatusIcon } from "../components/StatusIcon.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Progress } from "../components/ui/progress.tsx";
import { prettifySlug } from "../lib/labels.ts";
import { targetLink } from "../links.ts";
import type { ConceptRow } from "./model.ts";
import { SectionTitle } from "./SectionTitle.tsx";

export function ConceptList({ rows, hasConcepts }: { rows: ConceptRow[]; hasConcepts: boolean }) {
  return (
    <section aria-labelledby="home-concepts" className="mb-8">
      <SectionTitle id="home-concepts">Concepts</SectionTitle>
      {!hasConcepts && <p className="text-muted-foreground">No concepts yet.</p>}
      {rows.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map(({ concept, exercises, solved }) => (
            <li key={concept.slug} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <BookOpen aria-hidden className="size-4 text-muted-foreground" />
                <Link to="/c/$slug" params={{ slug: concept.slug }} className="font-medium hover:underline">
                  {concept.title}
                </Link>
                <Badge variant="secondary">{prettifySlug(concept.status)}</Badge>
                {concept.error && <ErrorMark error={concept.error} />}
                <span className="ml-auto text-xs text-muted-foreground">
                  {solved}/{concept.exercises.length} exercises
                </span>
                <Progress
                  value={concept.exercises.length === 0 ? 0 : (solved / concept.exercises.length) * 100}
                  aria-label={`${concept.title} exercises solved`}
                  className="w-20"
                />
              </div>
              {exercises.length > 0 && (
                <ul className="mt-1.5 ml-6 space-y-1">
                  {exercises.map((exercise) => (
                    <li key={exercise.id} className="flex items-center gap-2">
                      <StatusIcon status={exercise.status} inProgress={exercise.inProgress} />
                      <Link {...targetLink(exercise.id)} className="hover:underline">
                        <span className="font-mono text-xs text-muted-foreground">{exercise.id}</span> {exercise.title}
                      </Link>
                      {exercise.error && <ErrorMark error={exercise.error} />}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
