import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiError, conceptQuery, keys, putExplanation } from "../api.ts";
import { ConceptView, ExplanationConflict } from "../components/ConceptView.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { Badge } from "../components/ui/badge.tsx";

export function ConceptPage() {
  const { slug } = useParams({ from: "/c/$slug" });
  // Keyed by slug, like the work view: a "My explanation" draft belongs to one concept, and going to another
  // concept must start a fresh page instead of carrying the draft (and its Save) over to it.
  return <ConceptContent key={slug} slug={slug} />;
}

function ConceptContent({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const concept = useQuery(conceptQuery(slug));

  if (concept.isPending) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  if (concept.isError) {
    if (concept.error instanceof ApiError && concept.error.status === 404) return <NotFound message={`There is no concept "${slug}".`} />;
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {concept.error.message}
      </p>
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
    <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-6">
      <nav className="mb-4 flex items-center gap-3 text-sm">
        <Link to="/" className="text-neutral-500 hover:underline">
          ← Home
        </Link>
        <Badge>{concept.data.status}</Badge>
      </nav>
      <ConceptView concept={concept.data} editable save={save} />
    </main>
  );
}
