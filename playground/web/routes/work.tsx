import type { KeyBinding } from "@codemirror/view";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, CircleX, TriangleAlert } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { toast } from "sonner";
import type { Lang, RunResult } from "../../../runner/src/types.ts";
import type { TargetData } from "../../server/types.ts";
import { ApiError, conceptQuery, getSolution, keys, putSolution, runCustomInput, runTests, targetQuery } from "../api.ts";
import { CodeEditor } from "../components/CodeEditor.tsx";
import { ConceptView } from "../components/ConceptView.tsx";
import { ConsolePanel } from "../components/ConsolePanel.tsx";
import { type CustomInputHandle, CustomInputPanel } from "../components/CustomInputPanel.tsx";
import { Markdown } from "../components/Markdown.tsx";
import { NotFound } from "../components/NotFound.tsx";
import { solutionSaveLabel, StatusBar } from "../components/StatusBar.tsx";
import { TestsPanel } from "../components/TestsPanel.tsx";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs.tsx";
import { useConnected, useRepoEvents } from "../events.tsx";
import { useSolutionSync } from "../hooks/useSolutionSync.ts";
import { useUnsavedGuard } from "../hooks/useUnsavedGuard.ts";
import { pickLang, readRememberedLang, rememberLang } from "../lang.ts";
import { shortcut } from "../lib/keys.ts";
import { WorkHeader } from "../work/WorkHeader.tsx";
import { cn } from "cn";

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

function WorkSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 items-center gap-3 border-b px-3">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="ml-auto h-6 w-32" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-2/5 space-y-2 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="m-4 flex-1" />
      </div>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="m-6 w-auto">
      <TriangleAlert aria-hidden />
      <AlertTitle>Could not load this page</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function WorkPage({ id }: { id: string }) {
  const target = useQuery(targetQuery(id));
  const [chosen, setChosen] = useState<Lang | null>(null);
  if (target.isPending) return <WorkSkeleton />;
  // A failed refresh (a live event refetches the target) keeps the last data: unmounting the workspace for it
  // would throw away the editor and any text it has not saved yet.
  if (target.isError && !target.data) {
    if (target.error instanceof ApiError && target.error.status === 404) {
      return <NotFound message={`There is no problem or exercise "${id}".`} />;
    }
    return <LoadError message={target.error.message} />;
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

const LANG_NAME: Record<Lang, string> = { py: "Python", ts: "TypeScript" };

function ConflictAlert({ file, onDisk, onMine }: { file: string; onDisk(): void; onMine(): void }) {
  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <TriangleAlert aria-hidden />
      <AlertTitle>{file} changed on disk.</AlertTitle>
      <AlertDescription className="flex items-center gap-2">
        Keep one version:
        <Button size="sm" variant="outline" onClick={onDisk}>
          Use disk version
        </Button>
        <Button size="sm" variant="outline" onClick={onMine}>
          Keep mine
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function SideConcept({ slug, onConcept }: { slug: string; onConcept(slug: string): void }) {
  const concept = useQuery(conceptQuery(slug));
  if (concept.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading" className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }
  if (concept.isError) return <LoadError message={concept.error.message} />;
  return <ConceptView concept={concept.data} editable={false} onConcept={onConcept} />;
}

function StatementPane({ target, trail, onConcept, onBack }: { target: TargetData; trail: string[]; onConcept(slug: string): void; onBack(): void }) {
  const slug = trail.at(-1);
  if (slug) {
    return (
      <div>
        <nav aria-label="Concept trail" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
          <span>Statement › {trail.join(" › ")}</span>
          <Link to="/c/$slug" params={{ slug }} className="ml-auto text-primary underline underline-offset-2">
            Open the concept page
          </Link>
        </nav>
        <SideConcept key={slug} slug={slug} onConcept={onConcept} />
      </div>
    );
  }
  if (target.readmeError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert aria-hidden />
        <AlertDescription>
          {target.readme || "README.md"}: {target.readmeError}
        </AlertDescription>
      </Alert>
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
  // Text only in memory that nothing will save by itself locks the language switch and makes leaving ask first.
  const langLock = useUnsavedGuard(sync, connected, `solution.${lang}`);
  const [tab, setTab] = useState<PanelTab>("tests");
  // Kept across a re-run (and a failed one) so the previous result stays visible, dimmed, while running.
  const [result, setResult] = useState<RunResult | null>(null);
  const [stale, setStale] = useState(false);
  const [trail, setTrail] = useState<string[]>([]);
  const custom = useRef<CustomInputHandle>(null);
  const columns = useDefaultLayout({ id: "work-columns", storage: localStorage });
  const rows = useDefaultLayout({ id: "work-rows", storage: localStorage });

  useRepoEvents((event) => {
    if (event.kind === "solution" && event.target === target.id && event.lang === lang) sync.diskChanged(event.version);
    if ((event.kind === "cases" || event.kind === "stress") && event.target === target.id) setStale(true);
  });

  // When the live connection comes back: send what piled up while the server was unreachable, and reload a clean
  // editor whose file changed meanwhile (no event reported it).
  const { flush, diskChanged } = sync;
  useEffect(() => {
    if (!connected) return;
    void flush();
    diskChanged();
  }, [connected, flush, diskChanged]);

  const run = useMutation({
    scope: { id: `${target.id}:${lang}` },
    mutationFn: async () => {
      if (!(await flush())) throw new Error(NOT_SAVED);
      return runTests(target.id, lang);
    },
    onMutate: () => setTab("tests"),
    onSuccess: (data) => {
      setResult(data);
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

  // 1 px lines that turn blue on hover or drag; a wider invisible strip keeps them easy to grab.
  const separator = "relative bg-border transition-colors hover:bg-primary active:bg-primary after:absolute";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkHeader
        target={target}
        lang={lang}
        onLang={onLang}
        running={run.isPending}
        elapsedMs={elapsed}
        canRun={canRun}
        onRun={actions.run}
        langLock={langLock}
      />
      {sync.conflict && <ConflictAlert file={`solution.${lang}`} onDisk={sync.takeDisk} onMine={() => void sync.keepMine()} />}
      {sync.state === "error" && sync.error && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <CircleX aria-hidden />
          <AlertDescription>Not saved: {sync.error}</AlertDescription>
        </Alert>
      )}
      <Group orientation="horizontal" className="min-h-0 flex-1" defaultLayout={columns.defaultLayout} onLayoutChanged={columns.onLayoutChanged}>
        <Panel id="statement" defaultSize="40%" minSize="20%" className="overflow-y-auto bg-card p-4">
          <StatementPane
            target={target}
            trail={trail}
            onConcept={(slug) => setTrail((current) => (current.at(-1) === slug ? current : [...current, slug]))}
            onBack={() => setTrail((current) => current.slice(0, -1))}
          />
        </Panel>
        <Separator className={cn("w-px after:inset-y-0 after:-inset-x-1", separator)} />
        <Panel id="code" minSize="30%">
          <Group orientation="vertical" defaultLayout={rows.defaultLayout} onLayoutChanged={rows.onLayoutChanged}>
            <Panel id="editor" defaultSize="60%" minSize="20%">
              {sync.code === null ? (
                sync.error ? (
                  <Alert variant="destructive" className="m-4 w-auto">
                    <CircleX aria-hidden />
                    <AlertDescription>{sync.error}</AlertDescription>
                  </Alert>
                ) : (
                  <Skeleton aria-busy="true" aria-label="Loading the editor" className="m-4 h-40" />
                )
              ) : (
                <CodeEditor lang={lang} value={sync.code} onChange={sync.edit} bindings={bindings} ariaLabel={`solution.${lang}`} className="h-full" autoFocus />
              )}
            </Panel>
            <Separator className={cn("h-px after:inset-x-0 after:-inset-y-1", separator)} />
            <Panel id="panels" minSize="15%">
              <Tabs value={tab} onValueChange={(value) => setTab(value as PanelTab)} className="flex h-full flex-col gap-0">
                <TabsList variant="line" className="w-full justify-start border-b px-2">
                  <TabsTrigger value="tests">
                    Tests
                    {result && (
                      <Badge variant={result.examples.passed === result.examples.total ? "success" : "destructive"} className="font-mono">
                        {result.examples.passed}/{result.examples.total}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="custom">Custom input</TabsTrigger>
                  <TabsTrigger value="console">Console</TabsTrigger>
                </TabsList>
                <TabsContent value="tests" className="min-h-0 overflow-auto">
                  <TestsPanel
                    result={result}
                    running={run.isPending}
                    elapsedMs={elapsed}
                    stale={stale}
                    caseError={target.caseError}
                    paramNames={target.signature?.params.map((param) => param.name) ?? []}
                  />
                </TabsContent>
                {/* Always mounted, so its fields and last result survive tab switches and ⇧⌘↵ works from the editor. */}
                <TabsContent value="custom" forceMount className="min-h-0 overflow-auto data-[state=inactive]:hidden">
                  <CustomInputPanel ref={custom} targetId={target.id} signature={target.signature} exampleInput={target.exampleInput} run={runCustom} />
                </TabsContent>
                <TabsContent value="console" className="min-h-0 overflow-auto">
                  <ConsolePanel result={result} />
                </TabsContent>
              </Tabs>
            </Panel>
          </Group>
        </Panel>
      </Group>
      <StatusBar
        subject={`${LANG_NAME[lang]} · solution.${lang}`}
        save={solutionSaveLabel(sync.state, connected)}
        shortcuts={[
          { keys: shortcut("run"), label: "Run" },
          { keys: shortcut("custom"), label: "Custom" },
          { keys: shortcut("save"), label: "Save" },
        ]}
      />
    </div>
  );
}
