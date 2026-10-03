import { useState } from "react";
import type { ConceptData } from "../../server/types.ts";
import { ApiError } from "../api.ts";
import { useConfirmLeave } from "../hooks/useConfirmLeave.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { Markdown } from "./Markdown.tsx";
import { Button } from "./ui/button.tsx";

export const CONFLICT_MESSAGE =
  "The README changed on disk while you were editing. Your text is still here: press Save again to put it in My explanation, or Cancel to keep the version on disk.";

/** The server refused a save (409) because the README changed on disk; `current` is the section's text there now. */
export class ExplanationConflict extends ApiError {
  constructor(readonly current: string) {
    super(409, CONFLICT_MESSAGE);
    this.name = "ExplanationConflict";
  }
}

interface ConceptViewProps {
  concept: ConceptData;
  /** The concept page can edit "My explanation"; the work view's side pane cannot. */
  editable: boolean;
  onConcept?: (slug: string) => void;
  save?: (text: string) => Promise<void>;
}

interface ExplanationProps {
  /** The section's text on disk; null when the README has no such section or cannot be read. */
  text: string | null;
  /** The README cannot be read now: ConceptView already shows why. */
  broken: boolean;
  readmePath: string;
  editable: boolean;
  save?: (text: string) => Promise<void>;
}

/** Why an open draft cannot be saved right now, or null. The draft stays open either way, so no text is lost. */
function unsavable(text: string | null, broken: boolean): string | null {
  if (broken) return "The README cannot be read right now, so this text cannot be saved. Copy your text somewhere safe, or fix the README and press Save.";
  if (text === null) {
    return 'The README no longer has a "My explanation" section, so this text cannot be saved. Copy your text somewhere safe, or put the section back (pnpm check) and press Save.';
  }
  return null;
}

function ExplanationSection({ text, broken, readmePath, editable, save }: ExplanationProps) {
  const [draft, setDraft] = useState<string | null>(null);
  /** The section's text on disk that the draft is based on: what it started from, or what a conflict last reported. */
  const [base, setBase] = useState("");
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  useConfirmLeave(draft !== null && draft !== base, "You have unsaved changes in My explanation. Leave anyway?");

  const submit = async () => {
    if (draft === null || !save || text === null || broken) return;
    // Live events refresh `text` (and the version the page saves with) while the draft is open, so the
    // server's version check alone would accept this save and drop the other text. Changes to other
    // sections (pnpm sync, a status change) leave `text` alone and save without a conflict.
    if (text !== base) {
      setBase(text); // the next Save is the user's explicit "keep mine"
      setError({ message: CONFLICT_MESSAGE, issues: [] });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await save(draft);
      setDraft(null);
    } catch (reason) {
      if (reason instanceof ExplanationConflict) setBase(reason.current);
      setError({ message: (reason as Error).message, issues: reason instanceof ApiError ? reason.issues : [] });
    } finally {
      setSaving(false);
    }
  };

  if (draft === null && broken) return null;
  if (draft === null && text === null) {
    return (
      <p className="my-4 text-sm text-amber-700 dark:text-amber-400">
        This concept has no "My explanation" section. Run <code>pnpm check</code>.
      </p>
    );
  }
  const problem = draft === null ? null : unsavable(text, broken);

  return (
    <section aria-labelledby="my-explanation" className="markdown">
      <h2 id="my-explanation" className="flex items-center gap-2">
        My explanation
        {editable && draft === null && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(text ?? "");
              setBase(text ?? "");
            }}
          >
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
          {problem && (
            <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {problem}
            </p>
          )}
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
            <Button onClick={() => void submit()} disabled={saving || problem !== null}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ConceptView({ concept, editable, onConcept, save }: ConceptViewProps) {
  const broken = concept.readmeError !== null;
  return (
    <article>
      {broken ? (
        <p role="alert" className="text-sm text-red-600">
          {concept.readme}: {concept.readmeError}
        </p>
      ) : (
        <Markdown source={concept.before} readmePath={concept.readme} onConcept={onConcept} />
      )}
      {/* Always in the same place, so a draft open in it survives a README that breaks or loses the section on disk. */}
      <ExplanationSection text={broken ? null : concept.explanation} broken={broken} readmePath={concept.readme} editable={editable} save={save} />
      {!broken && <Markdown source={concept.after} readmePath={concept.readme} onConcept={onConcept} />}
    </article>
  );
}
