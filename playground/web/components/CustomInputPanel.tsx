import { type Ref, useId, useImperativeHandle, useState } from "react";
import { formatOutput } from "../../../runner/src/format.ts";
import type { CustomResult } from "../../../runner/src/types.ts";
import type { Signature } from "../../server/types.ts";
import { ApiError } from "../api.ts";
import { DISPLAY_MAX, ErrorBox, formatMs } from "./RunDetails.tsx";
import { Button } from "./ui/button.tsx";

export interface CustomInputHandle {
  submit(): Promise<void>;
}

interface CustomInputPanelProps {
  targetId: string;
  signature: Signature | null;
  exampleInput: unknown;
  run: (input: unknown) => Promise<CustomResult>;
  ref?: Ref<CustomInputHandle>;
}

type Texts = Record<string, string>;

/** Keeps the browser from correcting or suggesting inside the JSON fields. */
const NO_WRITING_AIDS = { spellCheck: false, autoCorrect: "off", autoCapitalize: "off", writingsuggestions: "false" } as const;
const storageKey = (id: string) => `algo.custom.${id}`;

export function fieldNames(signature: Signature): string[] {
  return signature.mode === "class" ? ["ops", "args"] : signature.params.map((param) => param.name);
}

export function exampleTexts(signature: Signature, exampleInput: unknown): Texts {
  if (signature.mode === "class") {
    const call = (exampleInput ?? {}) as { ops?: unknown; args?: unknown };
    return { ops: JSON.stringify(call.ops ?? []), args: JSON.stringify(call.args ?? []) };
  }
  const values = Array.isArray(exampleInput) ? exampleInput : [];
  return Object.fromEntries(fieldNames(signature).map((name, i) => [name, i < values.length ? JSON.stringify(values[i]) : ""]));
}

function savedTexts(id: string, signature: Signature, exampleInput: unknown): Texts {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(id)) ?? "null");
    if (saved && typeof saved === "object" && fieldNames(signature).every((name) => typeof (saved as Texts)[name] === "string")) {
      return saved as Texts;
    }
  } catch {
    // Storage blocked or unreadable: start from the example.
  }
  return exampleTexts(signature, exampleInput);
}

function CustomResultView({ result }: { result: CustomResult }) {
  if (result.fatal) return <ErrorBox title="Could not load the solution" error={result.fatal} />;
  return (
    <div className="space-y-2">
      {result.error ? (
        <ErrorBox error={result.error} />
      ) : (
        <p>
          <span className="text-neutral-500">Output</span> <code className="font-mono">{formatOutput(result.output, DISPLAY_MAX)}</code>{" "}
          <span className="text-xs text-neutral-500">{formatMs(result.ms)}</span>
        </p>
      )}
      {result.stdout && (
        <pre aria-label="Prints" className="whitespace-pre-wrap rounded bg-neutral-100 p-2 font-mono text-xs dark:bg-neutral-900">
          {result.stdout}
        </pre>
      )}
    </div>
  );
}

function CustomInputForm({ targetId, signature, exampleInput, run, ref }: CustomInputPanelProps & { signature: Signature }) {
  const id = useId();
  const names = fieldNames(signature);
  const [texts, setTexts] = useState<Texts>(() => savedTexts(targetId, signature, exampleInput));
  const [errors, setErrors] = useState<Texts>({});
  const [result, setResult] = useState<CustomResult | null>(null);
  const [failure, setFailure] = useState<{ message: string; issues: string[] } | null>(null);
  const [pending, setPending] = useState(false);

  const update = (name: string, value: string) => {
    const next = { ...texts, [name]: value };
    setTexts(next);
    try {
      localStorage.setItem(storageKey(targetId), JSON.stringify(next));
    } catch {
      // Not remembered; the field still works.
    }
  };

  const reset = () => {
    setTexts(exampleTexts(signature, exampleInput));
    setErrors({});
    try {
      localStorage.removeItem(storageKey(targetId));
    } catch {
      // Nothing to forget.
    }
  };

  const submit = async () => {
    const values: unknown[] = [];
    const nextErrors: Texts = {};
    for (const name of names) {
      try {
        values.push(JSON.parse(texts[name] ?? ""));
      } catch {
        nextErrors[name] = 'Not valid JSON. Write it like [1,2], "text", true, false or null.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const input = signature.mode === "class" ? { ops: values[0], args: values[1] } : values;
    setPending(true);
    setFailure(null);
    try {
      setResult(await run(input));
    } catch (error) {
      setResult(null);
      setFailure({ message: (error as Error).message, issues: error instanceof ApiError ? error.issues : [] });
    } finally {
      setPending(false);
    }
  };

  useImperativeHandle(ref, () => ({ submit }));

  return (
    <form
      className="space-y-3 p-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {names.map((name) => (
        <div key={name}>
          <label htmlFor={`${id}-${name}`} className="font-mono text-xs text-neutral-500">
            {name}
          </label>
          <textarea
            id={`${id}-${name}`}
            value={texts[name] ?? ""}
            onChange={(event) => update(name, event.target.value)}
            rows={1}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
            className="mt-0.5 block w-full resize-y rounded-md border border-neutral-300 bg-transparent p-1.5 font-mono text-xs dark:border-neutral-700"
            {...NO_WRITING_AIDS}
          />
          {errors[name] && (
            <p id={`${id}-${name}-error`} className="mt-0.5 text-xs text-red-600">
              {errors[name]}
            </p>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Running…" : "Run custom input"} <kbd className="text-xs opacity-70">⇧⌘↵</kbd>
        </Button>
        <Button variant="outline" onClick={reset}>
          Reset
        </Button>
      </div>
      {failure && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-xs dark:border-red-800 dark:bg-red-950">
          <p>{failure.issues.length > 0 ? "The server could not use this input:" : failure.message}</p>
          {failure.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-mono">
              {failure.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result && <CustomResultView result={result} />}
    </form>
  );
}

export function CustomInputPanel(props: CustomInputPanelProps) {
  if (!props.signature) {
    return <p className="p-3 text-sm text-neutral-500">Custom input needs a valid cases.json. See the Tests tab.</p>;
  }
  return <CustomInputForm {...props} signature={props.signature} />;
}
