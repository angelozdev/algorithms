#!/usr/bin/env node
// PreToolUse guard: Claude must never write to the user's solution files (CLAUDE.md rule 2).
import { readFileSync } from "node:fs";
import path from "node:path";

const SOLUTION_PATH = /^(problems|concepts)\/.+\/solution\.(py|ts)$/;
const NAME = String.raw`\S*solution\.(?:py|ts)\b`;
const BASH_WRITES = [
  new RegExp(String.raw`>>?\|?\s*${NAME}`), // redirection into the file
  new RegExp(String.raw`\btee\b[^|;&]*${NAME}`),
  new RegExp(String.raw`\b(?:sed|perl)\b[^|;&]*\s-[a-zA-Z]*i[a-zA-Z.]*\b[^|;&]*${NAME}`), // in-place edit
  new RegExp(String.raw`\b(?:rm|truncate|unlink|mv)\b[^|;&]*${NAME}`), // delete or move away
  new RegExp(String.raw`\b(?:cp|install|ln)\b[^|;&]*\s${NAME}\s*$`), // copy onto it
];
const REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): solution.py / solution.ts belong to the user. " +
  "Do not write, edit, move or delete them. If the user asked for help, follow the hint skill.";

function deny() {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: REASON },
    }),
  );
}

try {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const projectDir = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const input = event.tool_input ?? {};
  if (event.tool_name === "Bash") {
    const segments = String(input.command ?? "")
      .split(/&&|\|\||;|\n/)
      .map((segment) => segment.trim());
    const writes = segments.some((segment) => !/^git\s+mv\b/.test(segment) && BASH_WRITES.some((re) => re.test(segment)));
    if (writes) deny();
  } else {
    const target = input.file_path ?? input.notebook_path;
    if (target) {
      const relative = path.relative(projectDir, path.resolve(projectDir, String(target))).split(path.sep).join("/");
      if (SOLUTION_PATH.test(relative)) deny();
    }
  }
} catch (error) {
  process.stderr.write(`guard-solution hook failed: ${error.message}\n`);
}
