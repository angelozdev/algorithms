#!/usr/bin/env node
// UserPromptSubmit: keeps the study rules and the work in progress in Claude's context.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const RULES = [
  "[algorithms study rules — see CLAUDE.md]",
  "1. No solution code or pseudocode for problems/exercises that are not solved or revealed.",
  "2. Never edit solution.py / solution.ts.",
  "3. 'Help' or 'why does it fail' on unsolved work = the hint skill, one level at a time. " +
    "Language/syntax questions are not hints: answer with small generic examples that do not reveal the approach.",
  "4. Never describe hidden cases beyond the runner output.",
  "5. Optimal solution only when green AND explicitly asked, or via /give-up.",
  "Chat in Spanish; write files in English.",
];

function field(text, name) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const line = frontmatter && new RegExp(`^${name}:\\s*(.+)$`, "m").exec(frontmatter[1]);
  return line ? line[1].trim() : null;
}

function subdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

/** Where the user's progress lives: $ALGO_STUDY, or <project>/.study (study coach spec §3). */
function studyDir(root) {
  return process.env.ALGO_STUDY ? path.resolve(process.env.ALGO_STUDY) : path.join(root, ".study");
}

/** Problem and exercise folders that have a README.md, with the .study/solutions folder kind they map to. */
function items(root) {
  const list = subdirs(path.join(root, "problems")).map((dir) => ({ dir, kind: "problems" }));
  for (const concept of subdirs(path.join(root, "concepts"))) {
    list.push(...subdirs(path.join(concept, "exercises")).map((dir) => ({ dir, kind: "exercises" })));
  }
  return list.filter(({ dir }) => existsSync(path.join(dir, "README.md")));
}

/**
 * In progress by READMEs that predate the study coach: status solving, or todo with a solution file in its
 * folder or under .study/solutions. Mirrors lib/repo.ts's isInProgress.
 */
function inProgress(root, item, text) {
  const status = field(text, "status");
  if (status === "solving") return true;
  const id = field(text, "id");
  const dirs = [item.dir, ...(id ? [path.join(studyDir(root), "solutions", item.kind, ...id.split("/"))] : [])];
  return status === "todo" && dirs.some((dir) => ["solution.py", "solution.ts"].some((name) => existsSync(path.join(dir, name))));
}

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const inProgressItems = items(root)
    .map((item) => ({ item, text: readFileSync(path.join(item.dir, "README.md"), "utf8") }))
    .filter(({ item, text }) => inProgress(root, item, text))
    .map(({ text }) => `${field(text, "id")} (hints ${field(text, "hints") ?? "0"})`);
  const context = [
    ...RULES,
    inProgressItems.length ? `In progress: ${inProgressItems.join(", ")}.` : "In progress: nothing.",
  ].join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } }));
} catch (error) {
  process.stderr.write(`reminder hook failed: ${error.message}\n`);
}
