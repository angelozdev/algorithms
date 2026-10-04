#!/usr/bin/env node
// PreToolUse guard: Claude must never write to the user's solution files or their study folder (CLAUDE.md rule 2).
// The Bash checks are best effort: they catch accidents, not a determined bypass, and try to keep false denies rare.
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const SOLUTION_PATH = /^(problems|concepts)\/.+\/solution\.(py|ts)$/;
/** The user's study folder (study coach spec §3): solutions, their history, the progress database and its snapshot. */
const STUDY_PATH = /^\.study(?:\/|$)/;
const SOLUTION_NAMES = ["solution.py", "solution.ts"];
/** Where solution files live, as path segments under the project. ANY is one folder name. */
const ANY = Symbol("any");
const SOLUTION = Symbol("solution");
const LOCATIONS = [
  ["problems", ANY, SOLUTION],
  ["concepts", ANY, "exercises", ANY, SOLUTION],
];

const NAME = String.raw`\S*solution\.(?:py|ts)\b`;
/** A path into the study folder (.study, ./.study/x, /abs/.study/x), not a name that merely contains ".study". */
const STUDY = String.raw`(?:\S*\/)?\.study(?=\/|\s|$)(?:\/\S*)?`;
/** Shell shapes that write to, empty, move or delete a file whose path matches `name`. */
const writesTo = (name) => [
  new RegExp(String.raw`>>?\|?\s*${name}`), // redirection into the file
  new RegExp(String.raw`\btee\b[^|;&]*${name}`),
  new RegExp(String.raw`\b(?:sed|perl)\b[^|;&]*\s-[a-zA-Z]*i[a-zA-Z.]*\b[^|;&]*${name}`), // in-place edit
  new RegExp(String.raw`\b(?:truncate|unlink|mv)\b[^|;&]*${name}`), // empty, delete or move away (rm: see deletesSolutions)
  new RegExp(String.raw`\b(?:cp|install|ln)\b[^|;&]*\s${name}\s*$`), // copy onto it
  new RegExp(String.raw`\bdd\b[^|;&]*\bof=${name}`),
];
const BASH_WRITES = writesTo(NAME);
const STUDY_WRITES = writesTo(STUDY);
/** Any mention of a solution file, including globs such as solution.* or solution.{py,ts} */
const MENTIONS_SOLUTION = /solution\.(?:py|ts|\*|\{)/;
/** Inline code that names something in the study folder or its database. */
const MENTIONS_STUDY = /(?:^|[^\w.-])\.study\/|study\.db/;
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh"]);
const INTERPRETER = /^(?:python[\d.]*|node|tsx|bun|ruby|perl)$/;
/** Flags whose next word is code: python -c, node -e/-p/--eval, ruby/perl -e (also -ne, -pe…). */
const CODE_FLAG = /^(?:-[a-z]{0,3}[cep]|--eval|--print)$/;
/** Words that run the command after them. */
const WRAPPERS = new Set(["sudo", "env", "nohup", "time", "exec", "command", "builtin", "nice", "timeout", "xargs", "npx", "bunx", "uvx"]);
/** Package managers whose `exec`/`dlx`/`run`/`x` subcommand runs the command after it (pnpm exec node, uv run python). */
const LAUNCHERS = new Set(["pnpm", "npm", "yarn", "bun", "uv"]);
const LAUNCH = new Set(["exec", "dlx", "run", "x"]);
/** Shell words that come before a command: if cond; then cmd; fi, while …; do cmd; done, { cmd; }, ! cmd. */
const KEYWORDS = new Set(["if", "then", "else", "elif", "do", "while", "until", "{", "!", "function"]);

const WRITE_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): solution.py / solution.ts belong to the user. " +
  "Do not write, edit, move or delete them. If the user asked for help, follow the hint skill.";
const DISCARD_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): this command can discard or delete the user's uncommitted solution work " +
  "(solution.py / solution.ts under problems/ or concepts/). Do not run it; if it is really needed, the user must run it themselves.";
const PLAYGROUND_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): the playground API (pnpm play) reads and writes the user's solution files " +
  'and their "My explanation". Do not call /api/solution or /api/concept/explanation. If the user asked for help, follow the hint skill.';
const STUDY_REASON =
  "Blocked by the study rules (CLAUDE.md rule 2): .study/ holds the user's solutions, their history and the progress database. " +
  "Do not write, move or delete anything there. Record progress only with pnpm -s study record ….";
const STUDY_COMMAND_REASON =
  "Blocked by the study rules: this study command is for the user only (migrate, start, pause, resume, phase set). " +
  "Ask the user to run it.";
const SQLITE_REASON =
  "Blocked by the study rules: never open the progress database directly. Read it with pnpm -s study status … --json " +
  "and write it with pnpm -s study record ….";
/** Playground routes that touch the user's files or study time (reading a solution creates its stub). */
const PLAYGROUND_FILES = /\/api\/(?:solution|concept\/explanation|study\/(?:start|pause|resume))\b/;
/** Study subcommands only the user runs; phase only with `set`. `curriculum set` stays allowed (spec §6.5). */
const USER_ONLY_STUDY = new Set(["migrate", "start", "pause", "resume"]);
const HTTP_CLIENTS = new Set(["curl", "wget", "http", "https", "xh", "xhs"]);

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    }),
  );
}

// ─── A small shell lexer ─────────────────────────────────────────────────────────────────────────
// Enough to split a command into segments (&&, ||, ;, &, newline), pipeline stages (|) and words
// (quotes removed), to keep heredoc bodies apart, and to collect $(…), `…` and (…) as nested lists.
// It expands nothing.

/** @typedef {{ words: string[], heredocs: string[] }} Stage */
/** @typedef {{ stages: Stage[], nested: Segment[][] }} Segment */

/** @returns {Segment[]} */
function parse(src) {
  let i = 0;
  // Heredocs wait for the end of the current line, even when they start inside $(…) that closes on it.
  const pending = [];

  const list = (closer) => {
    const segments = [];
    let segment = { stages: [], nested: [] };
    let stage = { words: [], heredocs: [] };
    let word = "";
    let started = false;
    const endWord = () => {
      if (started || word) stage.words.push(word);
      word = "";
      started = false;
    };
    const endStage = () => {
      endWord();
      if (stage.words.length || stage.heredocs.length) segment.stages.push(stage);
      stage = { words: [], heredocs: [] };
    };
    const endSegment = () => {
      endStage();
      if (segment.stages.length || segment.nested.length) segments.push(segment);
      segment = { stages: [], nested: [] };
    };
    const readHeredocs = () => {
      for (const { target, end } of pending.splice(0)) {
        const body = [];
        while (i < src.length) {
          let next = src.indexOf("\n", i);
          if (next < 0) next = src.length;
          const line = src.slice(i, next);
          i = next + 1;
          if (line.trim() === end) break;
          body.push(line);
        }
        target.heredocs.push(body.join("\n"));
      }
    };
    const substitution = (close) => {
      segment.nested.push(list(close));
      word += "$(…)";
      started = true;
    };

    while (i < src.length) {
      const c = src[i];
      if (closer && c === closer) {
        i++;
        break;
      }
      if (c === "\n") {
        i++;
        endSegment();
        readHeredocs();
      } else if (c === " " || c === "\t") {
        i++;
        endWord();
      } else if (c === "\\") {
        if (src[i + 1] !== "\n") word += src[i + 1] ?? "";
        started = true;
        i += 2;
      } else if (c === "'") {
        const end = src.indexOf("'", i + 1);
        word += src.slice(i + 1, end < 0 ? src.length : end);
        started = true;
        i = end < 0 ? src.length : end + 1;
      } else if (c === '"') {
        started = true;
        i++;
        while (i < src.length && src[i] !== '"') {
          if (src[i] === "\\" && '$`"\\\n'.includes(src[i + 1] ?? "")) {
            if (src[i + 1] !== "\n") word += src[i + 1];
            i += 2;
          } else if (src.startsWith("$((", i)) {
            word += arithmetic();
          } else if (src.startsWith("$(", i)) {
            i += 2;
            substitution(")");
          } else if (src[i] === "`") {
            i++;
            substitution("`");
          } else {
            word += src[i++];
          }
        }
        i++;
      } else if (src.startsWith("$((", i)) {
        word += arithmetic();
        started = true;
      } else if (src.startsWith("$(", i)) {
        i += 2;
        substitution(")");
      } else if (c === "`") {
        i++;
        substitution("`");
      } else if (c === "(" && !word && !started) {
        i++;
        segment.nested.push(list(")")); // a subshell: its own cwd
      } else if (c === "#" && !word && !started) {
        while (i < src.length && src[i] !== "\n") i++;
      } else if (c === ";") {
        i++;
        endSegment();
      } else if (c === "&") {
        if (src[i + 1] === "&") {
          i += 2;
          endSegment();
        } else if (/[<>]$/.test(word) || src[i + 1] === ">") {
          word += c; // 2>&1, &>file
          i++;
        } else {
          i++;
          endSegment();
        }
      } else if (c === "|") {
        if (src[i + 1] === "|") {
          i += 2;
          endSegment();
        } else if (/>$/.test(word)) {
          word += c; // >| file
          i++;
        } else {
          i += src[i + 1] === "&" ? 2 : 1;
          endStage();
        }
      } else if (src.startsWith("<<<", i)) {
        endWord();
        stage.words.push("<<<");
        i += 3;
      } else if (src.startsWith("<<", i)) {
        endWord();
        i += src[i + 2] === "-" ? 3 : 2;
        while (src[i] === " " || src[i] === "\t") i++;
        let end = "";
        while (i < src.length && !/[\s;&|<>()]/.test(src[i])) {
          if (src[i] === "'" || src[i] === '"') {
            const quote = src[i];
            const close = src.indexOf(quote, i + 1);
            end += src.slice(i + 1, close < 0 ? src.length : close);
            i = close < 0 ? src.length : close + 1;
          } else {
            if (src[i] !== "\\") end += src[i];
            i++;
          }
        }
        if (end) pending.push({ target: stage, end });
      } else {
        word += c;
        started = true;
        i++;
      }
    }
    endSegment();
    return segments;
  };

  /** $(( … )): arithmetic, not a command. Returns its raw text. */
  function arithmetic() {
    const start = i;
    let depth = 0;
    while (i < src.length) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) {
        i++;
        break;
      }
      i++;
    }
    return src.slice(start, i);
  }

  return list(null);
}

// ─── Paths ───────────────────────────────────────────────────────────────────────────────────────

const EXPANSION = /\$\(\(.*?\)\)|\$\(…\)|\$\{([^}]*)\}|\$([A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/g;

/**
 * `word` with ~, $CLAUDE_PROJECT_DIR and known $VARS expanded. Any other expansion inside the path
 * ("problems/$id") counts as "*", any name. A path that starts with one ("$SCRATCH/x") cannot be known: null.
 */
function expand(word, where) {
  let unknownStart = false;
  const home = word === "~" || word.startsWith("~/") ? os.homedir() + word.slice(1) : word;
  const out = home.replace(EXPANSION, (match, braced, bare, offset) => {
    const name = braced ?? bare ?? "";
    if (name === "CLAUDE_PROJECT_DIR") return where.projectDir;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && process.env[name] !== undefined) return process.env[name];
    if (offset === 0) unknownStart = true;
    return "*";
  });
  return unknownStart ? null : out;
}

/** The absolute path `word` names, or null. An unknown cwd counts as the project root (the careful guess). */
function resolveWord(word, where) {
  const expanded = expand(word, where);
  return expanded === null ? null : path.resolve(where.cwd ?? where.projectDir, expanded);
}

function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    const close = c === "[" ? glob.indexOf("]", i + 2) : c === "{" ? glob.indexOf("}", i + 1) : -1;
    if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else if (c === "[" && close > 0) {
      out += `[${glob.slice(i + 1, close).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`;
      i = close;
    } else if (c === "{" && close > 0) {
      out += `(?:${glob
        .slice(i + 1, close)
        .split(",")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})`;
      i = close;
    } else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  try {
    return new RegExp(`^${out}$`);
  } catch {
    return /^/; // a class the shell would reject (e.g. [z-a]): assume it can match anything
  }
}

const couldBeSolution = (glob) => SOLUTION_NAMES.some((name) => globToRegExp(glob).test(name));

/** Does the path segment `glob` match the location segment `slot`? */
function segmentMatches(glob, slot) {
  if (slot === ANY) return true;
  if (slot === SOLUTION) return couldBeSolution(glob);
  return globToRegExp(glob).test(slot);
}

/**
 * Can removing `word` remove a solution file? It can when it names one (a glob counts), or, when
 * `recursive`, when it names a folder that holds one: an item folder, problems/, concepts/, the project or above.
 */
function reachesSolutions(word, where, recursive) {
  const target = resolveWord(word, where);
  if (!target) return false;
  const targetParts = target.split(path.sep).filter(Boolean);
  const projectParts = where.projectDir.split(path.sep).filter(Boolean);
  const inside = projectParts.every((part, i) => i < targetParts.length && segmentMatches(targetParts[i], part));
  if (!inside) {
    // The project itself or one of its ancestors (e.g. rm -rf . from the root, rm -rf /work/*).
    return recursive && targetParts.length < projectParts.length && targetParts.every((part, i) => segmentMatches(part, projectParts[i]));
  }
  const rel = targetParts.slice(projectParts.length);
  return LOCATIONS.some(
    (location) =>
      (recursive ? rel.length <= location.length : rel.length === location.length) &&
      rel.every((part, i) => segmentMatches(part, location[i])),
  );
}

/** Does `word` name the study folder or anything in it (globs count), or anything under ALGO_STUDY? */
function reachesStudy(word, where) {
  const target = resolveWord(word, where);
  if (!target) return false;
  const parts = target.split(path.sep).filter(Boolean);
  const project = where.projectDir.split(path.sep).filter(Boolean);
  const inside = project.every((part, i) => i < parts.length && segmentMatches(parts[i], part));
  if (inside && parts.length > project.length && segmentMatches(parts[project.length], ".study")) return true;
  if (!process.env.ALGO_STUDY) return false;
  const rel = path.relative(path.resolve(process.env.ALGO_STUDY), target);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** Is `dir` the project or inside it? An unknown dir (null) counts as inside. */
function inProject(dir, where) {
  if (dir === null) return true;
  const rel = path.relative(where.projectDir, dir);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

// ─── Commands ────────────────────────────────────────────────────────────────────────────────────

/** The command a stage runs, past env assignments and wrappers such as sudo, env or xargs. */
function commandOf(words) {
  let i = 0;
  let viaXargs = false;
  while (i < words.length) {
    const base = path.basename(words[i]);
    const next = words.slice(i + 1).find((word) => !word.startsWith("-"));
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || KEYWORDS.has(words[i]) || /^[\w.-]+\(\)$/.test(words[i])) {
      i++; // an assignment, a keyword, or a function definition: name() { cmd; }
    } else if (LAUNCHERS.has(base) && LAUNCH.has(next ?? "")) {
      i = words.indexOf(next, i + 1) + 1;
      while (i < words.length && words[i].startsWith("-")) i++;
    } else if (WRAPPERS.has(base)) {
      viaXargs ||= base === "xargs";
      i++;
      while (i < words.length && words[i].startsWith("-")) i += /^-[nILPdsEu]$/.test(words[i]) ? 2 : 1;
      if (base === "timeout" && /^\d/.test(words[i] ?? "")) i++;
    } else {
      return { name: base, args: words.slice(i + 1), viaXargs };
    }
  }
  return { name: "", args: [], viaXargs };
}

const operands = (args) => {
  const end = args.indexOf("--");
  const before = end < 0 ? args : args.slice(0, end);
  return [...before.filter((arg) => !arg.startsWith("-")), ...(end < 0 ? [] : args.slice(end + 1))];
};
const hasFlag = (args, long, letters) =>
  args.some((arg) => arg === long || new RegExp(`^-[a-zA-Z]*[${letters}]`).test(arg));

/** True when `git <args>` can discard or remove solution work in this project's working tree. */
function gitDiscards(args, where) {
  let cwd = where.cwd;
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    if (args[i] === "-C") {
      const dir = expand(args[i + 1] ?? "", where);
      cwd = dir === null || cwd === null ? null : path.resolve(cwd, dir);
      i += 2;
    } else i += ["-c", "--git-dir", "--work-tree", "--namespace"].includes(args[i]) ? 2 : 1;
  }
  const here = { ...where, cwd };
  if (!inProject(cwd, where)) return false; // another repository
  const [sub, ...rest] = args.slice(i);
  const covers = (spec) =>
    reachesStudy(spec, here) ||
    spec.startsWith(":/") ||
    reachesSolutions(spec, here, true) ||
    (/[*?[{]/.test(spec) && !spec.includes("/") && couldBeSolution(spec)); // a pathspec glob matches at any depth
  switch (sub) {
    case "checkout":
      return hasFlag(rest, "--force", "f") || operands(rest).some(covers);
    case "switch":
      return rest.includes("--discard-changes") || hasFlag(rest, "--force", "f");
    case "restore": {
      const staged = hasFlag(rest, "--staged", "S");
      if (staged && !hasFlag(rest, "--worktree", "W")) return false; // only unstages
      return operands(rest).some(covers);
    }
    case "rm":
      return !rest.includes("--cached") && operands(rest).some(covers);
    case "reset":
      return rest.includes("--hard");
    case "clean": {
      if (!hasFlag(rest, "--force", "f")) return false;
      const specs = operands(rest);
      return specs.length === 0 ? reachesSolutions(".", here, true) : specs.some(covers);
    }
    case "stash":
      return rest[0] !== "list" && rest[0] !== "show";
    default:
      return false;
  }
}

/** rm, find -delete / -exec rm, or xargs rm that can remove solution files. */
function deletesSolutions(command, segmentWords, where) {
  const { name, args, viaXargs } = command;
  if (name === "rm") {
    if (viaXargs) {
      return (
        segmentWords.some((word) => MENTIONS_SOLUTION.test(word) || reachesSolutions(word, where, true)) ||
        operands(args).some((arg) => reachesSolutions(arg, where, true)) ||
        reachesSolutions(".", where, false) // run from inside an item folder
      );
    }
    const recursive = hasFlag(args, "--recursive", "rR");
    return operands(args).some((arg) => reachesSolutions(arg, where, recursive));
  }
  if (name !== "find") return false;
  const exec = args.findIndex((arg, i) => /^-(?:exec|execdir|ok|okdir)$/.test(arg) && path.basename(args[i + 1] ?? "") === "rm");
  if (!args.includes("-delete") && exec < 0) return false;
  const recursiveExec = exec >= 0 && hasFlag(args.slice(exec + 2), "--recursive", "rR");
  const starts = [];
  for (const arg of args) {
    if (arg.startsWith("-") || arg === "(" || arg === "!") break;
    starts.push(arg);
  }
  const patterns = args.flatMap((arg, i) => (/^-(?:i?name|i?path|i?wholename)$/.test(arg) ? [args[i + 1] ?? ""] : []));
  const namesSolution =
    args.some((arg) => MENTIONS_SOLUTION.test(arg)) || patterns.some((pattern) => couldBeSolution(pattern.split("/").pop()));
  return (starts.length ? starts : ["."]).some((start) => {
    if (!reachesSolutions(start, where, true)) return false;
    const target = resolveWord(start, where);
    const underContent = target !== null && /^(?:problems|concepts)(?:\/|$)/.test(path.relative(where.projectDir, target).split(path.sep).join("/"));
    return underContent || namesSolution || patterns.length === 0 || recursiveExec;
  });
}

/** rm, find -delete / -exec rm, or xargs rm that can remove something under the study folder. */
function deletesStudy(command, segmentWords, where) {
  const { name, args, viaXargs } = command;
  if (name === "rm") {
    if (viaXargs && segmentWords.some((word) => MENTIONS_STUDY.test(word) || reachesStudy(word, where))) return true;
    return operands(args).some((arg) => reachesStudy(arg, where));
  }
  if (name !== "find") return false;
  const exec = args.findIndex((arg, i) => /^-(?:exec|execdir|ok|okdir)$/.test(arg) && path.basename(args[i + 1] ?? "") === "rm");
  if (!args.includes("-delete") && exec < 0) return false;
  return args.some((arg) => reachesStudy(arg, where) || /(?:^|[/*])\.study(?:\/|$)/.test(arg));
}

/** The words after `study` when this stage runs the study CLI (pnpm [-s] study …, pnpm run study …, tsx|node … study/cli.ts …). */
function studyArgs(command) {
  const words = (list) => list.filter((arg) => !arg.startsWith("-"));
  if (command.name === "study") return words(command.args);
  if (LAUNCHERS.has(command.name)) {
    const rest = words(command.args);
    return rest[0] === "study" ? rest.slice(1) : null;
  }
  if (command.name === "tsx" || command.name === "node") {
    const at = command.args.findIndex((arg) => /(?:^|\/)study\/cli\.ts$/.test(arg));
    return at >= 0 ? words(command.args.slice(at + 1)) : null;
  }
  return null;
}

function userOnlyStudy(command) {
  const args = studyArgs(command);
  if (!args) return false;
  return USER_ONLY_STUDY.has(args[0]) || (args[0] === "phase" && args[1] === "set");
}

/** WRITE_REASON or STUDY_REASON when an interpreter in stage `index` runs inline or stdin code that names a solution file, the playground API or the study folder. */
function inlineCodeReason(segment, index, command, stage) {
  if (!INTERPRETER.test(command.name)) return null;
  const { args } = command;
  const code = [...stage.heredocs];
  args.forEach((arg, i) => {
    if (CODE_FLAG.test(arg) || arg === "<<<") code.push(args[i + 1] ?? "");
  });
  // python3 -c "…open(sys.argv[1], 'w')" problems/a/solution.py: the code's own arguments count too.
  const codeAt = args.findIndex((arg) => CODE_FLAG.test(arg));
  if (codeAt >= 0) code.push(...args.slice(codeAt + 2));
  // Code piped in: `… | python3` or `… | python3 -`, but not `… | python3 -c "…"`, which reads its data from the pipe.
  const script = operands(args).filter((arg) => !code.includes(arg));
  const readsStdin = args.includes("-") || (index > 0 && code.length === 0 && script.length === 0);
  if (readsStdin) code.push(...segment.stages.slice(0, index).flatMap((previous) => previous.words));
  if (code.some((text) => MENTIONS_STUDY.test(text))) return STUDY_REASON;
  return code.some((text) => MENTIONS_SOLUTION.test(text) || PLAYGROUND_FILES.test(text)) ? WRITE_REASON : null;
}

/** The segment as text for BASH_WRITES: words with spaces inside (messages, code) become "_". */
function segmentText(segment) {
  return segment.stages.map((stage) => stage.words.map((word) => (/\s/.test(word) ? "_" : word)).join(" ")).join(" | ");
}

/** Where `cd <args>` leads from `where.cwd`; null when it cannot be known. */
function changeDir(args, where) {
  const target = args.find((arg) => !/^-[LPe@]+$/.test(arg));
  if (target === undefined) return os.homedir();
  if (target === "-") return null;
  const expanded = expand(target, where);
  if (expanded === null || (where.cwd === null && !path.isAbsolute(expanded))) return null;
  return path.resolve(where.cwd ?? where.projectDir, expanded);
}

function segmentReason(segment, where) {
  const first = commandOf(segment.stages[0]?.words ?? []);
  if (first.name === "git" && first.args[0] === "mv") return null;
  const segmentWords = segment.stages.flatMap((stage) => stage.words);
  for (const [index, stage] of segment.stages.entries()) {
    const command = commandOf(stage.words);
    if (SHELLS.has(command.name)) {
      const flag = command.args.findIndex((arg) => /^-[a-z]*c[a-z]*$/.test(arg));
      const scripts = [...(flag >= 0 ? [command.args[flag + 1] ?? ""] : []), ...stage.heredocs];
      // `… | bash` runs what the earlier stages print: check their heredocs and words (printf '…\n' included).
      if (flag < 0 && index > 0 && operands(command.args).length === 0) {
        for (const previous of segment.stages.slice(0, index)) {
          scripts.push(...previous.heredocs, ...previous.words.map((word) => word.replaceAll("\\n", "\n")));
        }
      }
      for (const script of scripts) {
        const reason = bashReason(script, where);
        if (reason) return reason;
      }
    }
    if (command.name === "eval") {
      const reason = bashReason(command.args.join(" "), where);
      if (reason) return reason;
    }
    if ((command.name === "git" && gitDiscards(command.args, where)) || deletesSolutions(command, segmentWords, where)) {
      return DISCARD_REASON;
    }
    if (HTTP_CLIENTS.has(command.name) && command.args.some((arg) => PLAYGROUND_FILES.test(arg))) return PLAYGROUND_REASON;
    if (userOnlyStudy(command)) return STUDY_COMMAND_REASON;
    if (command.name === "sqlite3" && command.args.some((arg) => /study\.db/.test(arg))) return SQLITE_REASON;
    if (deletesStudy(command, segmentWords, where)) return STUDY_REASON;
    const inline = inlineCodeReason(segment, index, command, stage);
    if (inline) return inline;
  }
  const text = segmentText(segment);
  if (STUDY_WRITES.some((re) => re.test(text))) return STUDY_REASON;
  return BASH_WRITES.some((re) => re.test(text)) ? WRITE_REASON : null;
}

function segmentsReason(segments, where) {
  const here = { ...where };
  for (const segment of segments) {
    for (const nested of segment.nested) {
      const reason = segmentsReason(nested, here); // $(…), `…` and (…) keep their own cwd
      if (reason) return reason;
    }
    const reason = segmentReason(segment, here);
    if (reason) return reason;
    const command = segment.stages.length === 1 ? commandOf(segment.stages[0].words) : null;
    if (command?.name === "cd") here.cwd = changeDir(command.args, here);
  }
  return null;
}

/** The reason to deny a Bash command run in `where.cwd`, or null to let it through. */
function bashReason(command, where) {
  return segmentsReason(parse(command), where);
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
      const absolute = path.resolve(projectDir, String(target));
      const relative = path.relative(projectDir, absolute).split(path.sep).join("/");
      const override = process.env.ALGO_STUDY ? path.relative(path.resolve(process.env.ALGO_STUDY), absolute) : null;
      const underOverride = override !== null && !override.startsWith("..") && !path.isAbsolute(override);
      if (SOLUTION_PATH.test(relative)) deny(WRITE_REASON);
      else if (STUDY_PATH.test(relative) || underOverride) deny(STUDY_REASON);
    }
  }
} catch (error) {
  process.stderr.write(`guard-solution hook failed: ${error.message}\n`);
}
