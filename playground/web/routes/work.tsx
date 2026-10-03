import type { KeyBinding } from "@codemirror/view";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { toast } from "sonner";
import type { Lang } from "../../../runner/src/types.ts";
import type { TargetData } from "../../server/types.ts";
import { ApiError, conceptQuery, getSolution, keys, putSolution, runCustomInput, runTests, targetQuery } from "../api.ts";
import { CodeEditor } from "../components/CodeEditor.tsx";
import { ConceptView } from "../components/ConceptView.tsx";
import { ConsolePanel } from "../components/ConsolePanel.tsx";
import { type CustomInputHandle, CustomInputPanel } from "../components/CustomInputPanel.tsx";
import { Markdown } from "../components/Markdown.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { TestsPanel } from "../components/TestsPanel.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs.tsx";
import { useConnected, useRepoEvents } from "../events.tsx";
import { type SaveState, useSolutionSync } from "../hooks/useSolutionSync.ts";
import { pickLang, readRememberedLang, rememberLang } from "../lang.ts";
import { cn } from "../lib/cn.ts";

type PanelTab = "tests" | "custom" | "console";

const NOT_SAVED = "Your code is not saved yet, so it was not run. Resolve the message at the top, then try again.";

export function ProblemPage() {
  const { id } = useParams({ from: "/p/$id" });
  return <WorkPage key={id} id={id} />;
}

export function ExercisePage() {
  const { concept, nn } = useParams({ from: "/e/$concept/$nn" });
  const id = `${concept}/${nn}`;
  return <WorkPage key={id} id={id} />;
}

function WorkPage({ id }: { id: string }) {
  const target = useQuery(targetQuery(id));
  const [chosen, setChosen] = useState<Lang | null>(null);
  if (target.isPending) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  if (target.isError) {
    if (target.error instanceof ApiError && target.error.status === 404) {
      return <NotFound message={`There is no problem or exercise "${id}".`} />;
    }
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {target.error.message}
      </p>
    );
  }
  const lang = chosen ?? pickLang(target.data.solutions, readRememberedLang());
  // Freeze the first choice: a solution file created later must not switch the editor's language.
  if (chosen === null) setChosen(lang);
  const choose = (next: Lang) => {
    rememberLang(next);
    setChosen(next);
  };
  return <Workspace key={lang} target={target.data} lang={lang} onLang={choose} />;
}

function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const started = performance.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(performance.now() - started), 100);
    return () => clearInterval(timer);
  }, [active]);
  return elapsed;
}

const SAVE_LABEL: Record<SaveState, string> = {
  loading: "loading…",
  saved: "✓ saved",
  pending: "saving…",
  saving: "saving…",
  error: "✕ not saved",
  conflict: "⚠ not saved",
};

function SaveIndicator({ state, connected }: { state: SaveState; connected: boolean }) {
  const label = !connected && (state === "pending" || state === "saving") ? "✕ not saved" : SAVE_LABEL[state];
  const bad = label.startsWith("✕") || label.startsWith("⚠");
  return (
    <span role="status" aria-label="Save status" className={cn("text-xs", bad ? "text-red-600" : "text-neutral-500")}>
      {label}
    </span>
  );
}

function statusTone(status: TargetData["status"]) {
  if (status === "solved") return "green" as const;
  if (status === "revealed") return "amber" as const;
  return "neutral" as const;
}

function WorkHeader(props: {
  target: TargetData;
  lang: Lang;
  onLang(lang: Lang): void;
  saveState: SaveState;
  connected: boolean;
  running: boolean;
  canRun: boolean;
  onRun(): void;
}) {
  const { target } = props;
  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
      <Link to="/" className="text-neutral-500 hover:underline">
        ← Home
      </Link>
      <h1 className="font-semibold">
        {target.id} {target.title}
      </h1>
      {target.difficulty && <Badge>{target.difficulty}</Badge>}
      <Badge tone={statusTone(target.status)}>{target.status}</Badge>
      <span className="text-xs text-neutral-500">hints {target.hints}</span>
      {target.url && (
        <a href={target.url} target="_blank" rel="noreferrer" aria-label="Open the original problem" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          ↗
        </a>
      )}
      <div className="ml-auto flex items-center gap-3">
        <Tabs value={props.lang} onValueChange={(value) => props.onLang(value as Lang)}>
          <TabsList aria-label="Language" className="border-b-0">
            <TabsTrigger value="py">py</TabsTrigger>
            <TabsTrigger value="ts">ts</TabsTrigger>
          </TabsList>
        </Tabs>
        <SaveIndicator state={props.saveState} connected={props.connected} />
        <Button onClick={props.onRun} disabled={!props.canRun} title="Run the tests (⌘↵)">
          {props.running ? "Running…" : "▶ Run"} <kbd className="text-xs opacity-70">⌘↵</kbd>
        </Button>
      </div>
    </header>
  );
}

function ConflictBanner({ file, onDisk, onMine }: { file: string; onDisk(): void; onMine(): void }) {
  return (
    <div role="alert" className="flex items-center gap-3 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span>{file} changed on disk.</span>
      <Button size="sm" variant="outline" onClick={onDisk}>
        Use disk version
      </Button>
      <Button size="sm" variant="outline" onClick={onMine}>
        Keep mine
      </Button>
    </div>
  );
}

function SideConcept({ slug, onConcept }: { slug: string; onConcept(slug: string): void }) {
  const concept = useQuery(conceptQuery(slug));
  if (concept.isPending) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (concept.isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {concept.error.message}
      </p>
    );
  }
  return <ConceptView concept={concept.data} editable={false} onConcept={onConcept} />;
}

function StatementPane({ target, trail, onConcept, onBack }: { target: TargetData; trail: string[]; onConcept(slug: string): void; onBack(): void }) {
  const slug = trail.at(-1);
  if (slug) {
    return (
      <div>
        <nav aria-label="Concept trail" className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
          <Button size="sm" variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <span>Statement › {trail.join(" › ")}</span>
          <Link to="/c/$slug" params={{ slug }} className="ml-auto underline">
            Open the concept page
          </Link>
        </nav>
        <SideConcept key={slug} slug={slug} onConcept={onConcept} />
      </div>
    );
  }
  if (target.readmeError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {target.readme || "README.md"}: {target.readmeError}
      </p>
    );
  }
  return <Markdown source={target.markdown} readmePath={target.readme} onConcept={onConcept} />;
}

function Workspace({ target, lang, onLang }: { target: TargetData; lang: Lang; onLang(lang: Lang): void }) {
  const queryClient = useQueryClient();
  const connected = useConnected();
  const source = useMemo(
    () => ({
      load: () => getSolution(target.id, lang),
      save: (code: string, baseVersion: string) => putSolution(target.id, lang, code, baseVersion),
    }),
    [target.id, lang],
  );
  const sync = useSolutionSync(source, () => toast("Reloaded from disk"));
  const [tab, setTab] = useState<PanelTab>("tests");
  const [stale, setStale] = useState(false);
  const [trail, setTrail] = useState<string[]>([]);
  const custom = useRef<CustomInputHandle>(null);
  const columns = useDefaultLayout({ id: "work-columns", storage: localStorage });
  const rows = useDefaultLayout({ id: "work-rows", storage: localStorage });

  useRepoEvents((event) => {
    if (event.kind === "solution" && event.target === target.id && event.lang === lang) sync.diskChanged(event.version);
    if ((event.kind === "cases" || event.kind === "stress") && event.target === target.id) setStale(true);
  });

  // Saves what piled up while the server was unreachable.
  const { flush } = sync;
  useEffect(() => {
    if (connected) void flush();
  }, [connected, flush]);

  const run = useMutation({
    scope: { id: `${target.id}:${lang}` },
    mutationFn: async () => {
      if (!(await flush())) throw new Error(NOT_SAVED);
      return runTests(target.id, lang);
    },
    onMutate: () => setTab("tests"),
    onSuccess: () => {
      setStale(false);
      void queryClient.invalidateQueries({ queryKey: keys.target(target.id) });
    },
    onError: (error) => toast.error(error.message),
  });
  const elapsed = useElapsed(run.isPending);
  const canRun = target.caseError === null && sync.code !== null && !run.isPending;

  const runCustom = async (input: unknown) => {
    if (!(await flush())) throw new Error(NOT_SAVED);
    return runCustomInput(target.id, lang, input);
  };

  const actions = {
    run: () => {
      if (canRun) run.mutate();
    },
    custom: () => {
      setTab("custom");
      void custom.current?.submit();
    },
    save: () => {
      void flush();
    },
  };
  const latest = useRef(actions);
  useLayoutEffect(() => {
    latest.current = actions;
  });
  // Inside the editor. CodeMirror's own Mod-Enter would insert a blank line, so these take precedence.
  const bindings = useMemo<KeyBinding[]>(
    () => [
      { key: "Mod-Enter", run: () => (latest.current.run(), true) },
      { key: "Shift-Mod-Enter", run: () => (latest.current.custom(), true) },
      { key: "Mod-s", run: () => (latest.current.save(), true), preventDefault: true },
    ],
    [],
  );
  // Outside the editor. react-hotkeys-hook ignores content-editable targets, so the editor never runs twice.
  useHotkeys("mod+enter", () => latest.current.run(), { preventDefault: true });
  useHotkeys("mod+shift+enter", () => latest.current.custom(), { preventDefault: true, enableOnFormTags: true });
  useHotkeys("mod+s", () => latest.current.save(), { preventDefault: true, enableOnFormTags: true });

  const separator = "bg-neutral-200 transition-colors hover:bg-blue-400 dark:bg-neutral-800";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkHeader
        target={target}
        lang={lang}
        onLang={onLang}
        saveState={sync.state}
        connected={connected}
        running={run.isPending}
        canRun={canRun}
        onRun={actions.run}
      />
      {sync.conflict && <ConflictBanner file={`solution.${lang}`} onDisk={sync.takeDisk} onMine={() => void sync.keepMine()} />}
      {sync.state === "error" && sync.error && (
        <p role="alert" className="bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Not saved: {sync.error}
        </p>
      )}
      <Group orientation="horizontal" className="min-h-0 flex-1" defaultLayout={columns.defaultLayout} onLayoutChanged={columns.onLayoutChanged}>
        <Panel id="statement" defaultSize="40%" minSize="20%" className="overflow-y-auto p-4">
          <StatementPane
            target={target}
            trail={trail}
            onConcept={(slug) => setTrail((current) => (current.at(-1) === slug ? current : [...current, slug]))}
            onBack={() => setTrail((current) => current.slice(0, -1))}
          />
        </Panel>
        <Separator className={cn("w-1", separator)} />
        <Panel id="code" minSize="30%">
          <Group orientation="vertical" defaultLayout={rows.defaultLayout} onLayoutChanged={rows.onLayoutChanged}>
            <Panel id="editor" defaultSize="60%" minSize="20%">
              {sync.code === null ? (
                <p className="p-4 text-sm text-neutral-500">{sync.error ?? "Loading…"}</p>
              ) : (
                <CodeEditor lang={lang} value={sync.code} onChange={sync.edit} bindings={bindings} ariaLabel={`solution.${lang}`} className="h-full" autoFocus />
              )}
            </Panel>
            <Separator className={cn("h-1", separator)} />
            <Panel id="panels" minSize="15%">
              <Tabs value={tab} onValueChange={(value) => setTab(value as PanelTab)} className="flex h-full flex-col">
                <TabsList>
                  <TabsTrigger value="tests">Tests{run.data ? ` ${run.data.examples.passed}/${run.data.examples.total}` : ""}</TabsTrigger>
                  <TabsTrigger value="custom">Custom input</TabsTrigger>
                  <TabsTrigger value="console">Console</TabsTrigger>
                </TabsList>
                <TabsContent value="tests">
                  <TestsPanel
                    result={run.data ?? null}
                    running={run.isPending}
                    elapsedMs={elapsed}
                    stale={stale}
                    caseError={target.caseError}
                    paramNames={target.signature?.params.map((param) => param.name) ?? []}
                  />
                </TabsContent>
                {/* Always mounted, so its fields and last result survive tab switches and ⇧⌘↵ works from the editor. */}
                <TabsContent value="custom" forceMount>
                  <CustomInputPanel ref={custom} targetId={target.id} signature={target.signature} exampleInput={target.exampleInput} run={runCustom} />
                </TabsContent>
                <TabsContent value="console">
                  <ConsolePanel result={run.data ?? null} />
                </TabsContent>
              </Tabs>
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
