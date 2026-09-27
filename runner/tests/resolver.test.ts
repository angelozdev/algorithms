import { afterAll, describe, expect, it } from "vitest";
import { parseMarkdown } from "../../lib/frontmatter.ts";
import { scanRepo } from "../../lib/repo.ts";
import { listTargets, QueryError, resolveQuery } from "../src/resolver.ts";
import { removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

function problem(folder: string, title: string, withCases = true): void {
  write(root, `problems/${folder}/README.md`, `---\ntitle: ${title}\nstatus: todo\n---\n# ${title}\n`);
  if (withCases) write(root, `problems/${folder}/cases.json`, "{}");
}
problem("lc-0001-two-sum", "Two Sum");
problem("lc-0010-regular-expression-matching", "Regular Expression Matching");
problem("lc-0015-3sum", "3Sum");
problem("lc-0020-valid-parentheses", "Valid Parentheses", false);
write(root, "concepts/greedy/README.md", "---\nslug: greedy\ntitle: Greedy\n---\n# Greedy\n");
write(root, "concepts/greedy/exercises/01-coins/README.md", "---\ntitle: Coins\n---\n");
write(root, "concepts/greedy/exercises/01-coins/cases.json", "{}");
write(root, "concepts/greedy/exercises/02-intervals/README.md", "---\ntitle: Intervals\n---\n");
write(root, "concepts/greedy/exercises/02-intervals/cases.json", "{}");
write(root, "problems/lc-0099-no-readme/cases.json", "{}");

function candidatesOf(query: string): string[] {
  try {
    resolveQuery(listTargets(root), query);
  } catch (error) {
    if (error instanceof QueryError) return error.candidates.map((t) => t.id);
    throw error;
  }
  return [];
}

describe("parseMarkdown", () => {
  it("splits frontmatter and body, keeping the raw head", () => {
    const text = "---\ntitle: A\nlist: [x, y]\n---\n# A\n";
    const parsed = parseMarkdown(text);
    expect(parsed.data).toEqual({ title: "A", list: ["x", "y"] });
    expect(parsed.head + parsed.body).toBe(text);
    expect(parsed.body).toBe("# A\n");
  });

  it("returns an empty head when there is no frontmatter", () => {
    expect(parseMarkdown("# Hi\n")).toEqual({ head: "", data: {}, body: "# Hi\n" });
  });

  it("throws on invalid YAML", () => {
    expect(() => parseMarkdown("---\ntitle: [unclosed\n---\n")).toThrow();
  });
});

describe("scanRepo", () => {
  it("finds problems, concepts and exercises with their ids", () => {
    const repo = scanRepo(root);
    expect(repo.problems.map((p) => p.folderId)).toEqual(["lc-0001", "lc-0010", "lc-0015", "lc-0020", "lc-0099"]);
    expect(repo.concepts.map((c) => c.slug)).toEqual(["greedy"]);
    expect(repo.exercises.map((e) => e.folderId)).toEqual(["greedy/01", "greedy/02"]);
    expect(repo.problems[0].rel).toBe("problems/lc-0001-two-sum/README.md");
    expect(repo.problems.find((p) => p.folderId === "lc-0099")?.error).toBe("README.md is missing");
  });
});

describe("resolveQuery", () => {
  const targets = () => listTargets(root);

  it("lists only folders that have cases.json", () => {
    expect(targets().map((t) => t.id)).toEqual(["lc-0001", "lc-0010", "lc-0015", "lc-0099", "greedy/01", "greedy/02"]);
    expect(targets()[0]).toMatchObject({ kind: "problem", title: "Two Sum" });
  });

  it("matches exact ids, LeetCode numbers and slug fragments", () => {
    expect(resolveQuery(targets(), "lc-0015").title).toBe("3Sum");
    expect(resolveQuery(targets(), "1").id).toBe("lc-0001");
    expect(resolveQuery(targets(), "0010").id).toBe("lc-0010");
    expect(resolveQuery(targets(), "two").id).toBe("lc-0001");
    expect(resolveQuery(targets(), "greedy/01").title).toBe("Coins");
    expect(resolveQuery(targets(), "INTERVALS").id).toBe("greedy/02");
  });

  it("lists candidates instead of guessing", () => {
    expect(candidatesOf("sum")).toEqual(["lc-0001", "lc-0015"]);
    expect(candidatesOf("greedy")).toEqual(["greedy/01", "greedy/02"]);
  });

  it("explains when nothing matches", () => {
    expect(() => resolveQuery(targets(), "nope")).toThrow('Nothing matches "nope".');
    expect(() => resolveQuery(targets(), " ")).toThrow(QueryError);
  });
});
