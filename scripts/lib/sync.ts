import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type DocEntry, scanRepo } from "../../lib/repo.ts";
import { replaceAuto } from "./auto.ts";
import {
  conceptBySlug,
  renderConceptExercises,
  renderConceptIndex,
  renderConceptProblems,
  renderProblemConcepts,
  renderProblemIndex,
} from "./render.ts";

/** Regenerates auto sections and both indexes. Returns the relative paths that changed. */
export function sync(root: string): string[] {
  const repo = scanRepo(root);
  const bySlug = conceptBySlug(repo);
  const changed: string[] = [];

  const writeIfChanged = (file: string, content: string): void => {
    if (existsSync(file) && readFileSync(file, "utf8") === content) return;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    changed.push(path.relative(root, file).split(path.sep).join("/"));
  };

  const updateSections = (entry: DocEntry, sections: [string, string][]): void => {
    if (entry.error) return;
    let body = entry.body;
    for (const [name, content] of sections) body = replaceAuto(body, name, content) ?? body;
    writeIfChanged(entry.readme, entry.head + body);
  };

  for (const problem of repo.problems) updateSections(problem, [["concepts", renderProblemConcepts(problem, bySlug)]]);
  for (const concept of repo.concepts) {
    updateSections(concept, [
      ["exercises", renderConceptExercises(concept, repo)],
      ["problems", renderConceptProblems(concept, repo)],
    ]);
  }
  writeIfChanged(path.join(root, "INDEX.md"), renderProblemIndex(repo));
  writeIfChanged(path.join(root, "concepts", "INDEX.md"), renderConceptIndex(repo));
  return changed;
}
