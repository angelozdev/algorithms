import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../runner/src/paths.ts";
import { cleanupTempDirs, makeTempDir, put } from "./fixture.ts";

const HOOKS = path.join(REPO_ROOT, ".claude", "hooks");
const PROJECT = "/work/algorithms";

function hook(name: string, input: unknown, projectDir: string) {
  const run = spawnSync(process.execPath, [path.join(HOOKS, name)], {
    input: JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf8",
  });
  expect(run.status).toBe(0);
  return run.stdout ? JSON.parse(run.stdout) : null;
}

function decision(input: unknown): string {
  return hook("guard-solution.mjs", input, PROJECT)?.hookSpecificOutput?.permissionDecision ?? "allow";
}

function bashReason(command: string): string {
  return hook("guard-solution.mjs", { tool_name: "Bash", tool_input: { command } }, PROJECT)?.hookSpecificOutput?.permissionDecisionReason ?? "";
}

function expectBash(commands: string[], expected: "allow" | "deny"): void {
  for (const command of commands) {
    expect(decision({ tool_name: "Bash", tool_input: { command } }), command).toBe(expected);
  }
}

describe("guard-solution hook", () => {
  it("denies edits and writes to solution files", () => {
    expect(decision({ tool_name: "Edit", tool_input: { file_path: `${PROJECT}/problems/lc-0001-two-sum/solution.py` } })).toBe("deny");
    expect(decision({ tool_name: "Write", tool_input: { file_path: "concepts/hash-map/exercises/01-first-repeat/solution.ts" } })).toBe("deny");
    expect(decision({ tool_name: "MultiEdit", tool_input: { file_path: `${PROJECT}/problems/x/solution.ts` } })).toBe("deny");
  });

  it("allows other files, including references outside the repo and test scratch space", () => {
    expect(decision({ tool_name: "Edit", tool_input: { file_path: `${PROJECT}/problems/lc-0001-two-sum/README.md` } })).toBe("allow");
    expect(decision({ tool_name: "Write", tool_input: { file_path: "/tmp/algorithms-ref-lc-0001/ref.py" } })).toBe("allow");
    expect(decision({ tool_name: "Write", tool_input: { file_path: `${PROJECT}/runner/tests/.tmp/t-1/problems/p/solution.py` } })).toBe("allow");
  });

  it("denies shell commands that write to, move or delete solution files", () => {
    for (const command of [
      "cat > problems/lc-0001-two-sum/solution.py <<'EOF'\nx = 1\nEOF",
      "echo x >> problems/a/solution.ts",
      "sed -i '' 's/a/b/' problems/a/solution.py",
      "perl -pi -e 's/a/b/' problems/a/solution.py",
      "cp /tmp/ref.py problems/a/solution.py",
      "mv problems/a/solution.py /tmp/",
      "rm problems/a/solution.ts",
      "echo hi | tee problems/a/solution.py",
      "pnpm -s sync && rm -f concepts/x/exercises/01-y/solution.py",
    ]) {
      expect(decision({ tool_name: "Bash", tool_input: { command } }), command).toBe("deny");
    }
  });

  it("allows reading, running and git mv", () => {
    for (const command of [
      "cat problems/a/solution.py",
      "sed -n 1,20p problems/lc-0001-two-sum/solution.py",
      "pnpm -s test lc-0001 --json",
      "git mv python/1_two_sum.py problems/lc-0001-two-sum/solution.py",
      "git diff problems/a/solution.py",
      "python3 problems/a/solution.py",
    ]) {
      expect(decision({ tool_name: "Bash", tool_input: { command } }), command).toBe("allow");
    }
  });

  it("denies recursive deletes of problem and concept folders", () => {
    expectBash(
      [
        "rm -rf problems/lc-0001-two-sum",
        "rm -r concepts/hash-map/exercises/01-first-repeat/",
        "rm -rf problems",
        "rm -Rf ./concepts",
        "rm -fr problems/*",
        "rm --recursive --force concepts/hash-map",
        'rm -rf "$CLAUDE_PROJECT_DIR/problems/lc-0001-two-sum"',
        "cd /tmp && rm -rf /work/algorithms/concepts",
      ],
      "deny",
    );
    expect(bashReason("rm -rf problems/lc-0001-two-sum")).toMatch(/discard.*solution work.*user must run/s);
  });

  it("checks the commands a shell runs from -c or a heredoc", () => {
    expectBash(
      [
        'bash -c "rm -rf problems/lc-0001-two-sum"',
        "sh -c 'git stash'",
        "bash <<'EOF'\nrm problems/a/solution.py\nEOF",
        "sh <<EOF\ngit reset --hard\nEOF",
      ],
      "deny",
    );
  });

  it("resolves relative paths from the working directory of the event", () => {
    const bash = (cwd: string, command: string) => decision({ tool_name: "Bash", cwd, tool_input: { command } });
    expect(bash(`${PROJECT}/problems`, "rm -rf lc-0001-two-sum")).toBe("deny");
    expect(bash(`${PROJECT}/runner`, "rm -r ../concepts/hash-map")).toBe("deny");
    expect(bash("/tmp/scratch", "rm -rf problems")).toBe("allow");
  });

  it("denies git commands that discard or remove solution work, and says the user must run them", () => {
    const commands = [
      "git checkout -- problems/a/solution.py",
      "git checkout HEAD~1 -- concepts/hash-map/exercises/01-first-repeat/solution.ts",
      "git checkout HEAD problems/a/solution.py",
      "git checkout -- problems/lc-0001-two-sum",
      "git checkout .",
      "git checkout -f main",
      "git switch --discard-changes main",
      "git restore problems/a/solution.py",
      "git restore .",
      "git restore --source=HEAD~2 --staged --worktree problems/a/solution.ts",
      "git rm problems/a/solution.py",
      "git rm -r problems/lc-0001-two-sum",
      "git rm -rf concepts/hash-map",
      "git reset --hard",
      "git -C /work/algorithms reset --hard HEAD~1",
      "git clean -fd",
      "git clean -xdf",
      "git clean --force problems/",
      "git stash",
      "git stash push -m wip",
      "git stash -u",
      "git stash pop",
      "git stash drop",
      "pnpm -s sync && git stash",
    ];
    expectBash(commands, "deny");
    for (const command of commands) {
      expect(bashReason(command), command).toMatch(/discard.*uncommitted solution work.*user must run (it|them) themselves/s);
    }
  });

  it("denies inline interpreter code that mentions a solution file", () => {
    expectBash(
      [
        `python3 -c "open('problems/a/solution.py', 'w').write('x')"`,
        `python -c 'import pathlib; pathlib.Path("problems/a/solution.py").write_text("")'`,
        `python3 -c "\nimport pathlib\npathlib.Path('concepts/x/exercises/01-y/solution.py').write_text('')\n"`,
        `python3 - <<'EOF'\nopen('problems/a/solution.py', 'w')\nEOF`,
        `node -e "require('fs').writeFileSync('problems/a/solution.ts', '')"`,
        `node --eval "fs.writeFileSync('concepts/x/exercises/01-y/solution.ts', '')"`,
        `ruby -e 'File.write("problems/a/solution.py", "")'`,
        `perl -e 'open(F, ">problems/a/solution.py")'`,
      ],
      "deny",
    );
  });

  it("denies find -delete, find -exec rm, xargs rm and dd onto solution files", () => {
    expectBash(
      [
        "find problems -name solution.py -delete",
        "find . -name 'solution.*' -delete",
        "find . -name solution.ts -exec rm {} \\;",
        "find concepts -type d -name '01-*' -exec rm -rf {} +",
        "find problems -name '*.pyc' -delete",
        "find problems -name solution.py | xargs rm",
        "dd if=/dev/null of=problems/a/solution.py",
      ],
      "deny",
    );
  });

  it("still allows reads, runs, staging and harmless git and cleanup commands", () => {
    expectBash(
      [
        'grep -rn "def " problems/lc-0001-two-sum/solution.py',
        "git log -p -- problems/a/solution.py",
        "git show HEAD:problems/a/solution.py",
        "pnpm -s test lc-0001 --lang all --json",
        "git add problems/a/solution.py",
        "git status",
        "git stash list",
        "git stash show -p",
        "git restore --staged problems/a/solution.py",
        "git checkout -b study/next",
        "git checkout main",
        "git checkout HEAD -- problems/lc-0001-two-sum/README.md",
        "git clean -n",
        "git reset HEAD problems/a/README.md",
        "git reset --soft HEAD~1",
        "find problems -name README.md",
        "find . -name '*.pyc' -delete",
        'rm -rf "$TMPDIR/algorithms-ref-lc-0001"',
        "rm -rf runner/tests/.tmp",
        'node -e "console.log(1 + 1)"',
        'python3 -c "print(sum(range(10)))"',
        "node --experimental-strip-types problems/a/solution.ts",
        "pnpm -s sync && pnpm -s check",
        "git commit -F - <<'EOF'\nfix(claude): harden the guard\n\ngit reset --hard and rm -rf problems/x are now denied.\nEOF",
      ],
      "allow",
    );
  });
});

describe("reminder hook", () => {
  afterEach(cleanupTempDirs);

  it("lists work in progress with hint levels", () => {
    const root = makeTempDir("algo-hook-");
    put(root, "problems/lc-0001-two-sum/README.md", "---\nid: lc-0001\nstatus: solving\nhints: 1\n---\n");
    put(root, "problems/lc-0009-palindrome-number/README.md", "---\nid: lc-0009\nstatus: solved\nhints: 0\n---\n");
    put(root, "concepts/hash-map/README.md", "---\nslug: hash-map\nstatus: learning\n---\n");
    put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", "---\nid: hash-map/01\nstatus: solving\nhints: 0\n---\n");
    const output = hook("reminder.mjs", { prompt: "hola" }, root);
    expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    const context = output.hookSpecificOutput.additionalContext as string;
    expect(context).toContain("2. Never edit solution.py / solution.ts.");
    expect(context).toContain("Language/syntax questions are not hints");
    expect(context).toContain("In progress: lc-0001 (hints 1), hash-map/01 (hints 0).");
    expect(context).not.toContain("lc-0009");
  });

  it("counts a todo item as in progress once it has a solution file", () => {
    const root = makeTempDir("algo-hook-");
    put(root, "problems/lc-0070-climbing-stairs/README.md", "---\nid: lc-0070\nstatus: todo\nhints: 1\n---\n");
    put(root, "problems/lc-0070-climbing-stairs/solution.ts", "export default function climbStairs(n: number): number {}\n");
    put(root, "concepts/hash-map/README.md", "---\nslug: hash-map\nstatus: learning\n---\n");
    put(root, "concepts/hash-map/exercises/01-first-repeat/README.md", "---\nid: hash-map/01\nstatus: todo\nhints: 0\n---\n");
    put(root, "concepts/hash-map/exercises/01-first-repeat/solution.py", "class Solution:\n    pass\n");
    put(root, "concepts/hash-map/exercises/02-most-frequent/README.md", "---\nid: hash-map/02\nstatus: todo\nhints: 0\n---\n");
    const context = hook("reminder.mjs", { prompt: "hola" }, root).hookSpecificOutput.additionalContext as string;
    expect(context).toContain("In progress: lc-0070 (hints 1), hash-map/01 (hints 0).");
    expect(context).not.toContain("hash-map/02");
  });

  it("does not count a todo item without a solution file", () => {
    const root = makeTempDir("algo-hook-");
    put(root, "concepts/hash-map/exercises/02-most-frequent/README.md", "---\nid: hash-map/02\nstatus: todo\nhints: 0\n---\n");
    put(root, "concepts/hash-map/exercises/02-most-frequent/cases.json", "{}\n");
    const context = hook("reminder.mjs", { prompt: "hola" }, root).hookSpecificOutput.additionalContext as string;
    expect(context).toContain("In progress: nothing.");
  });

  it("says when nothing is in progress", () => {
    const root = makeTempDir("algo-hook-");
    const output = hook("reminder.mjs", { prompt: "hola" }, root);
    expect(output.hookSpecificOutput.additionalContext).toContain("In progress: nothing.");
  });
});

describe("settings.json", () => {
  it("registers both hooks with the project path", () => {
    const settings = JSON.parse(readFileSync(path.join(REPO_ROOT, ".claude", "settings.json"), "utf8"));
    const pre = settings.hooks.PreToolUse[0];
    expect(pre.matcher).toBe("Edit|Write|MultiEdit|NotebookEdit|Bash");
    expect(pre.hooks[0].command).toContain("$CLAUDE_PROJECT_DIR/.claude/hooks/guard-solution.mjs");
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toContain("$CLAUDE_PROJECT_DIR/.claude/hooks/reminder.mjs");
  });
});
