import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ConceptData, HomeData } from "../../server/types.ts";
import { ApiError, conceptQuery, homeQuery, keys, putExplanation } from "../api.ts";
import { CLOSED_DRAFT, ConceptView, type DraftState, ExplanationConflict } from "../components/ConceptView.tsx";
import { Logo } from "../components/Logo.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { type SaveLabel, StatusBar } from "../components/StatusBar.tsx";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/ui/breadcrumb.tsx";
import { Progress } from "../components/ui/progress.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { shortcut } from "../lib/keys.ts";
import { prettifySlug } from "../lib/labels.ts";

export function ConceptPage() {
  const { slug } = useParams({ from: "/c/$slug" });
  // Keyed by slug, like the work view: a "My explanation" draft belongs to one concept, and going to another
  // concept must start a fresh page instead of carrying the draft (and its Save) over to it.
  return <ConceptContent key={slug} slug={slug} />;
}

/** What the status bar says about "My explanation". */
export function draftSaveLabel(draft: DraftState): SaveLabel {
  if (draft.saving) return { text: "Saving…", tone: "busy" };
  if (draft.failed) return { text: "Not saved", tone: "bad" };
  if (draft.dirty) return { text: "Unsaved changes", tone: "warn" };
  return { text: "Saved", tone: "ok" };
}

function ConceptHeader({ concept, home }: { concept: ConceptData; home: HomeData | undefined }) {
  // Progress comes from the home data; it is left out until that loads (or if it fails), never an error here.
  const exercises = home?.concepts.find((c) => c.slug === concept.slug)?.exercises ?? [];
  const solved = exercises.filter((exercise) => exercise.status === "solved").length;
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
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span>Concepts</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">{concept.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Badge variant="secondary">{prettifySlug(concept.status)}</Badge>
      {exercises.length > 0 && (
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {solved}/{exercises.length} exercises
          <Progress value={(solved / exercises.length) * 100} aria-label="Exercises solved" className="w-20" />
        </span>
      )}
    </header>
  );
}

function ConceptSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-3xl space-y-3 px-6 py-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ConceptContent({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const concept = useQuery(conceptQuery(slug));
  const home = useQuery(homeQuery());
  const [draft, setDraft] = useState<DraftState>(CLOSED_DRAFT);

  if (concept.isPending) return <ConceptSkeleton />;
  // A failed refresh (a live event refetches the concept) keeps the last data: replacing the page with the
  // error would throw away an open "My explanation" draft.
  if (concept.isError && !concept.data) {
    if (concept.error instanceof ApiError && concept.error.status === 404) return <NotFound message={`There is no concept "${slug}".`} />;
    return (
      <Alert variant="destructive" className="m-6 w-auto">
        <TriangleAlert aria-hidden />
        <AlertTitle>Could not load this concept</AlertTitle>
        <AlertDescription>{concept.error.message}</AlertDescription>
      </Alert>
    );
  }

  const save = async (text: string) => {
    const result = await putExplanation(slug, text, concept.data.version);
    if (!result.ok) {
      // Show the fresh README; the next Save uses its version.
      queryClient.setQueryData(keys.concept(slug), result.current);
      throw new ExplanationConflict(result.current.explanation ?? "");
    }
    await queryClient.invalidateQueries({ queryKey: keys.concept(slug) });
    toast.success("My explanation saved");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConceptHeader concept={concept.data} home={home.data} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-6">
          {concept.isError && (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlert aria-hidden />
              <AlertDescription>Could not refresh this concept ({concept.error.message}). Showing the last version loaded.</AlertDescription>
            </Alert>
          )}
          <ConceptView concept={concept.data} editable save={save} onDraft={setDraft} />
        </div>
      </main>
      <StatusBar subject="My explanation" save={draftSaveLabel(draft)} shortcuts={draft.open ? [{ keys: shortcut("save"), label: "Save" }] : []} />
    </div>
  );
}
