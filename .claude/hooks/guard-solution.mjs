#!/usr/bin/env node
// PreToolUse guard: Claude must never write to the user's solution files (CLAUDE.md rule 2).
// The Bash checks are best effort: they catch accidents, not a determined bypass, and try to keep false denies rare.
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
  new RegExp(String.raw`\bdd\b[^|;&]*\bof=${NAME}`),
];
/** Any mention of a solution file, including globs such as solution.* */
const MENTIONS_SOLUTION = /solution\.(?:py|ts|\*)/;
const SOLUTION_ARG = /(?:^|\/)solution\.(?:py|ts|\*)$/;
const INTERPRETER = /^(?:.*\/)?(?:python[\d.]*|node|tsx|bun|ruby|perl)$/;
const SHELL = /^(?:.*\/)?(?:ba|z|da|k)?sh$/;
/** Flags that run code given inline or on stdin: python -c, node -e/-p/--eval, ruby/perl -e (also -ne, -pe…), "-". */
const INLINE_CODE = /^(?:-[a-z]{0,3}[cep]|--eval|--print|-)$/;

const WRITE_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): solution.py / solution.ts belong to the user. " +
  "Do not write, edit, move or delete them. If the user asked for help, follow the hint skill.";
const DISCARD_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): this command can discard or delete the user's uncommitted solution work " +
  "(solution.py / solution.ts under problems/ or concepts/). Do not run it; if it is really needed, the user must run it themselves.";

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    }),
  );
}

/** Shell-like words: whitespace-separated, quotes removed (no escapes or expansions). */
function words(text) {
  const out = [];
  let current = "";
  let quote = null;
  let started = false;
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started || current) out.push(current);
      current = "";
      started = false;
    } else {
      current += char;
    }
  }
  if (started || current) out.push(current);
  return out;
}

/**
 * The command without heredoc bodies: their lines are data (a commit message, a script), not commands.
 * A heredoc fed to a shell (bash <<EOF) is kept, because its lines are commands.
 */
function withoutHeredocs(command) {
  const kept = [];
  let end = null;
  for (const line of command.split("\n")) {
    if (end !== null) {
      if (line.trim() === end) end = null;
      continue;
    }
    kept.push(line);
    const heredoc = /(?<!<)<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/.exec(line);
    if (heredoc && !words(line).some((word) => SHELL.test(word))) end = heredoc[2];
  }
  return kept.join("\n");
}

/** A path under problems/ or concepts/ of the project: relative to `cwd`, absolute, or via $CLAUDE_PROJECT_DIR. */
function contentPath(word, { projectDir, cwd }) {
  const target = path.resolve(cwd, word.replace(/^\$\{?CLAUDE_PROJECT_DIR\}?/, projectDir));
  const relative = path.relative(projectDir, target).split(path.sep).join("/");
  return !relative.startsWith("..") && !path.isAbsolute(relative) && /^(?:problems|concepts)(?:\/|$)/.test(relative);
}

/** A solution file, or a content path that can hold one (a folder or a glob, not a single other file like README.md). */
function holdsSolutions(word, where) {
  if (SOLUTION_ARG.test(word)) return true;
  if (!contentPath(word, where)) return false;
  const last = word.replace(/\/+$/, "").split("/").pop();
  return last.includes("*") || !/\.[A-Za-z0-9]+$/.test(last);
}

const operands = (args) => args.filter((arg) => !arg.startsWith("-"));
const hasShortFlag = (args, letter) => args.some((arg) => new RegExp(`^-[a-zA-Z]*${letter}`).test(arg));

/** True when a git command can discard or remove solution work in the working tree. */
function gitDiscards(stage, where) {
  const at = stage.findIndex((word) => /(?:^|\/)git$/.test(word));
  if (at < 0) return false;
  let i = at + 1;
  while (i < stage.length && stage[i].startsWith("-")) i += stage[i] === "-C" || stage[i] === "-c" ? 2 : 1;
  const sub = stage[i];
  const args = stage.slice(i + 1);
  const covers = (arg) => [".", "./", "*", ":/"].includes(arg) || holdsSolutions(arg, where);
  switch (sub) {
    case "checkout":
      return args.includes("--force") || hasShortFlag(args, "f") || operands(args).some(covers);
    case "switch":
      return args.includes("--discard-changes") || args.includes("--force") || hasShortFlag(args, "f");
    case "restore": {
      const staged = args.includes("--staged") || hasShortFlag(args, "S");
      const worktree = args.includes("--worktree") || hasShortFlag(args, "W");
      if (staged && !worktree) return false; // only unstages; the files keep their content
      return operands(args).some(covers);
    }
    case "rm":
      return operands(args).some(covers);
    case "reset":
      return args.includes("--hard");
    case "clean":
      return args.includes("--force") || hasShortFlag(args, "f");
    case "stash":
      return args[0] !== "list" && args[0] !== "show";
    default:
      return false;
  }
}

/** rm -r, find -delete / -exec rm, or xargs rm aimed at problems/, concepts/ or solution files. */
function deletesContent(stage, segment, where) {
  const rm = stage.findIndex((word) => /(?:^|\/)rm$/.test(word));
  if (rm >= 0) {
    const args = stage.slice(rm + 1);
    const recursive = args.includes("--recursive") || hasShortFlag(args, "[rR]");
    if (recursive && operands(args).some((arg) => holdsSolutions(arg, where))) return true;
  }
  const find = stage.findIndex((word) => /(?:^|\/)find$/.test(word));
  const xargs = stage.findIndex((word) => word === "xargs");
  const findDeletes =
    find >= 0 &&
    stage.some((word, i) => i > find && (word === "-delete" || (/^-(?:exec|execdir|ok)$/.test(word) && /(?:^|\/)rm$/.test(stage[i + 1] ?? ""))));
  const xargsDeletes = xargs >= 0 && rm > xargs;
  if (!findDeletes && !xargsDeletes) return false;
  return MENTIONS_SOLUTION.test(segment) || words(segment).some((word) => contentPath(word, where));
}

function runsInlineCode(stage) {
  const at = stage.findIndex((word) => INTERPRETER.test(word));
  return at >= 0 && stage.slice(at + 1).some((word) => INLINE_CODE.test(word) || word.startsWith("<<"));
}

/** The reason to deny a Bash command run in `where.cwd`, or null to let it through. */
function bashReason(command, where) {
  const segments = withoutHeredocs(command)
    .split(/&&|\|\||;|\n/)
    .map((segment) => segment.trim());
  const stagesOf = (segment) => segment.split("|").map(words);
  // Inline code can span lines (python3 -c "…\n…" or a heredoc), so the solution may be named in a later segment.
  if (MENTIONS_SOLUTION.test(command) && segments.some((segment) => stagesOf(segment).some(runsInlineCode))) {
    return WRITE_REASON;
  }
  for (const segment of segments) {
    if (/^git\s+mv\b/.test(segment)) continue;
    const stages = stagesOf(segment);
    for (const stage of stages) {
      // bash -c "…": the inner string is a command too.
      const shell = stage.findIndex((word) => SHELL.test(word));
      const inner = shell >= 0 && /^-[a-z]*c$/.test(stage[shell + 1] ?? "") ? bashReason(stage[shell + 2] ?? "", where) : null;
      if (inner) return inner;
    }
    if (stages.some((stage) => gitDiscards(stage, where) || deletesContent(stage, segment, where))) {
      return DISCARD_REASON;
    }
    if (BASH_WRITES.some((re) => re.test(segment))) return WRITE_REASON;
  }
  return null;
}

try {
  const event = JSON.parse(readFileSync(0, "utf8"));
  const projectDir = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  const input = event.tool_input ?? {};
  if (event.tool_name === "Bash") {
    const reason = bashReason(String(input.command ?? ""), { projectDir, cwd: event.cwd || projectDir });
    if (reason) deny(reason);
  } else {
    const target = input.file_path ?? input.notebook_path;
    if (target) {
      const relative = path.relative(projectDir, path.resolve(projectDir, String(target))).split(path.sep).join("/");
      if (SOLUTION_PATH.test(relative)) deny(WRITE_REASON);
    }
  }
} catch (error) {
  process.stderr.write(`guard-solution hook failed: ${error.message}\n`);
}
