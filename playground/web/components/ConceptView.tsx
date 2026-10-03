import { useState } from "react";
import type { ConceptData } from "../../server/types.ts";
import { ApiError } from "../api.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { Markdown } from "./Markdown.tsx";
import { Button } from "./ui/button.tsx";

export const CONFLICT_MESSAGE =
  "The README changed on disk while you were editing. Your text is still here: press Save again to put it in My explanation, or Cancel to keep the version on disk.";

interface ConceptViewProps {
  concept: ConceptData;
  /** The concept page can edit "My explanation"; the work view's side pane cannot. */
  editable: boolean;
  onConcept?: (slug: string) => void;
  save?: (text: string) => Promise<void>;
}

function ExplanationSection({ text, readmePath, editable, save }: { text: string; readmePath: string; editable: boolean; save?: (text: string) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (draft === null || !save) return;
    setSaving(true);
    setError(null);
    try {
      await save(draft);
      setDraft(null);
    } catch (reason) {
      setError({ message: (reason as Error).message, issues: reason instanceof ApiError ? reason.issues : [] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="my-explanation" className="markdown">
      <h2 id="my-explanation" className="flex items-center gap-2">
        My explanation
        {editable && draft === null && (
          <Button size="sm" variant="outline" onClick={() => setDraft(text)}>
            ✎ Edit
          </Button>
        )}
      </h2>
      {draft === null ? (
        text ? (
          <Markdown source={text} readmePath={readmePath} />
        ) : (
          <p className="italic text-neutral-500">{editable ? "Not written yet. Explain the concept in your own words." : "Not written yet."}</p>
        )
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-64 overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700">
              <CodeEditor lang="md" value={draft} onChange={setDraft} ariaLabel="My explanation" className="h-full" autoFocus />
            </div>
            <section aria-label="Preview" className="h-64 overflow-y-auto rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
              <Markdown source={draft} readmePath={readmePath} />
            </section>
          </div>
          {error && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm dark:border-red-800 dark:bg-red-950">
              {error.issues.length > 0 ? (
                <ul className="list-disc pl-5">
                  {error.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                error.message
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ConceptView({ concept, editable, onConcept, save }: ConceptViewProps) {
  if (concept.readmeError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {concept.readme}: {concept.readmeError}
      </p>
    );
  }
  return (
    <article>
      <Markdown source={concept.before} readmePath={concept.readme} onConcept={onConcept} />
      {concept.explanation === null ? (
        <p className="my-4 text-sm text-amber-700 dark:text-amber-400">
          This concept has no "My explanation" section. Run <code>pnpm check</code>.
        </p>
      ) : (
        <ExplanationSection text={concept.explanation} readmePath={concept.readme} editable={editable} save={save} />
      )}
      <Markdown source={concept.after} readmePath={concept.readme} onConcept={onConcept} />
    </article>
  );
}
