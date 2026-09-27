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
