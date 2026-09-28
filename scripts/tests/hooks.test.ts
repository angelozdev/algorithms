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
