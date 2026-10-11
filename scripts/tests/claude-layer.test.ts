import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../lib/frontmatter.ts";
import { REPO_ROOT } from "../../runner/src/paths.ts";

const SKILLS = ["problem", "concept", "hint", "review", "give-up"];
const skill = (name: string) => parseMarkdown(readFileSync(path.join(REPO_ROOT, ".claude", "skills", name, "SKILL.md"), "utf8"));

describe("project skills", () => {
  it.each(SKILLS)("%s has parseable frontmatter with its name and a real description", (name) => {
    const { data } = skill(name);
    expect(data.name).toBe(name);
    expect(typeof data.description).toBe("string");
    expect((data.description as string).length).toBeGreaterThan(60);
  });

  it("give-up can only be invoked by the user", () => {
    expect(skill("give-up").data["disable-model-invocation"]).toBe(true);
    for (const name of SKILLS.filter((n) => n !== "give-up")) {
      expect(skill(name).data["disable-model-invocation"]).toBeUndefined();
    }
  });
});

describe("CLAUDE.md", () => {
  it("states the language split and seven numbered hard rules", () => {
    const text = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(text).toContain("Talk to the user in **Spanish**.");
    expect(text).toContain("Write **every file in English**");
    for (let i = 1; i <= 7; i++) expect(text).toMatch(new RegExp(`^${i}\\. `, "m"));
  });
});

describe("progress goes through the study CLI (study coach spec §7, §8)", () => {
  const text = (name: string) => readFileSync(path.join(REPO_ROOT, ".claude", "skills", name, "SKILL.md"), "utf8");

  it.each([
    ["hint", ["pnpm -s study status <id> --json", "pnpm -s study record hint <id>", "--no-record", "exam"]],
    ["give-up", ["pnpm -s study record give-up <id>"]],
    ["review", ["--no-record", "pnpm -s study status <id> --json", "pnpm -s study record complexity <id>"]],
    ["concept", ["pnpm -s study status <slug> --json", "pnpm -s study record explanation <slug>"]],
    ["problem", ["pnpm -s study status <slug> --json"]],
  ])("%s reads and records through the CLI", (name, phrases) => {
    for (const phrase of phrases) expect(text(name)).toContain(phrase);
  });

  it("hint, give-up and review no longer write progress into READMEs", () => {
    for (const name of ["hint", "give-up", "review"]) {
      for (const stale of ["solution_revealed", "solved_in", "to the Log", "set it to `solving`", "pnpm -s sync"]) {
        expect(text(name), `${name}: ${stale}`).not.toContain(stale);
      }
    }
  });

  it("CLAUDE.md reads solved and revealed from study status and runs tests with --no-record", () => {
    const claude = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(claude).toContain("pnpm -s study status <id> --json");
    expect(claude).toContain("`everGreen: true`");
    expect(claude).toContain("never volunteer a solved problem's code or approach");
    expect(claude).toContain("pnpm -s test <query> --lang all --json --no-record");
  });
});

describe("content-only templates and docs (study coach spec §3, §10)", () => {
  const text = (name: string) => readFileSync(path.join(REPO_ROOT, ".claude", "skills", name, "SKILL.md"), "utf8");

  it("the problem and concept templates hold content only", () => {
    // Frontmatter lines and the Log heading, anchored at the line start ("**Typical complexity:**" is content).
    for (const stale of [/^status: /m, /^hints: /m, /^solution_revealed: /m, /^solved_in: /m, /^complexity: /m, /^## Log$/m]) {
      expect(text("problem"), String(stale)).not.toMatch(stale);
      expect(text("concept"), String(stale)).not.toMatch(stale);
    }
  });

  it("CLAUDE.md maps .study and README.md explains init, migrate and status", () => {
    const claude = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(claude).toContain("`.study/`");
    expect(claude).toContain("`study/`");
    expect(claude).not.toContain("Log lines");
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    for (const command of ["pnpm study init", "pnpm study migrate", "pnpm study status", "--no-record"]) expect(readme).toContain(command);
  });
});

describe("the study coach's commands (study coach spec §11)", () => {
  it("README.md lists them and CLAUDE.md says how Claude reads today's plan", () => {
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    for (const command of ["pnpm today", "pnpm study start", "pnpm study pause", "pnpm study curriculum", "pnpm study rebuild"]) expect(readme).toContain(command);
    const claude = readFileSync(path.join(REPO_ROOT, "CLAUDE.md"), "utf8");
    expect(claude).toContain("pnpm -s today --json");
    expect(claude).toContain("pnpm -s study ack <id>");
  });
});

describe("the playground's Today section (study coach spec §11)", () => {
  it("README.md explains Today and Start review", () => {
    const readme = readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toContain("today's plan from the study coach");
    expect(readme).toContain("**Start review:**");
  });
});
