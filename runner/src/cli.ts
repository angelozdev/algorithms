import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { contentRoot } from "./paths.ts";
import { formatTerminal } from "./reporter.ts";
import { listTargets, QueryError, resolveQuery } from "./resolver.ts";
import { runTarget } from "./run.ts";
import { CaseFileError } from "./schema.ts";
import { solutionPath } from "./stubs.ts";
import { LANGS, type Lang, type RunResult, type Target } from "./types.ts";
import { watchTarget } from "./watcher.ts";

const USAGE = `Usage:
  pnpm watch <query> [--lang py|ts] [--open]
  pnpm test <query> [--lang py|ts|all] [--json]
  pnpm fill-expected <query> --ref <path outside the repo>

<query>: an id (lc-0001, greedy/01), a LeetCode number (1), or part of a folder name (two-sum).`;

class UsageError extends Error {}

function parseLang(value: string | undefined, allowAll: boolean): Lang | "all" {
  const lang = value ?? "py";
  if (lang === "py" || lang === "ts" || (allowAll && lang === "all")) return lang;
  throw new UsageError(`--lang must be py, ts${allowAll ? " or all" : ""} (got "${lang}")`);
}

async function testCommand(target: Target, lang: Lang | "all", json: boolean, root: string): Promise<number> {
  const langs = lang === "all" ? LANGS.filter((l) => existsSync(solutionPath(target.dir, l))) : [lang];
  if (langs.length === 0) {
    throw new UsageError(`${target.id} has no solution files yet. Start with: pnpm watch ${target.id} --open`);
  }
  const results: RunResult[] = [];
  for (const l of langs) results.push(await runTarget(target, l, { root }));
  if (json) process.stdout.write(`${JSON.stringify(lang === "all" ? results : results[0], null, 2)}\n`);
  else process.stdout.write(`${results.map(formatTerminal).join("\n\n")}\n`);
  return results.every((r) => r.green) ? 0 : 1;
}

function parseFlags(args: string[]) {
  try {
    return parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        lang: { type: "string" },
        open: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        ref: { type: "string" },
      },
    });
  } catch (error) {
    throw new UsageError(`${(error as Error).message}\n\n${USAGE}`);
  }
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { values, positionals } = parseFlags(rest);
  if (command !== "test" && command !== "watch") throw new UsageError(USAGE);
  const root = contentRoot();
  const target = resolveQuery(listTargets(root), positionals.join(" "));
  if (command === "watch") {
    await watchTarget(target, parseLang(values.lang, false) as Lang, { open: values.open, root });
    return 0;
  }
  return testCommand(target, parseLang(values.lang, true), values.json, root);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    if (error instanceof QueryError) {
      const list = error.candidates.map((t) => `  ${t.id.padEnd(16)} ${t.title}`).join("\n");
      process.stderr.write(`${error.message}\n${list}${list ? "\n" : ""}`);
      process.exitCode = 1;
    } else if (error instanceof CaseFileError) {
      process.stderr.write(`Case file error (not your code — fix the problem files):\n${error.message}\n`);
      process.exitCode = 2;
    } else if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    } else {
      process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
      process.exitCode = 1;
    }
  },
);
