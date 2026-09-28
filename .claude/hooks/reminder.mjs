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

/** Problem and exercise folders that have a README.md. */
function itemDirs(root) {
  const dirs = [...subdirs(path.join(root, "problems"))];
  for (const concept of subdirs(path.join(root, "concepts"))) dirs.push(...subdirs(path.join(concept, "exercises")));
  return dirs.filter((dir) => existsSync(path.join(dir, "README.md")));
}

/** In progress: status solving, or todo with a solution file (e.g. created by pnpm watch). See CLAUDE.md. */
function inProgress(dir, text) {
  const status = field(text, "status");
  if (status === "solving") return true;
  return status === "todo" && ["solution.py", "solution.ts"].some((name) => existsSync(path.join(dir, name)));
}

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const inProgressItems = itemDirs(root)
    .map((dir) => ({ dir, text: readFileSync(path.join(dir, "README.md"), "utf8") }))
    .filter(({ dir, text }) => inProgress(dir, text))
    .map(({ text }) => `${field(text, "id")} (hints ${field(text, "hints") ?? "0"})`);
  const context = [
    ...RULES,
    inProgressItems.length ? `In progress: ${inProgressItems.join(", ")}.` : "In progress: nothing.",
  ].join("\n");
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: context } }));
} catch (error) {
  process.stderr.write(`reminder hook failed: ${error.message}\n`);
}
