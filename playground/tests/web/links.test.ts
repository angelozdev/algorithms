import { describe, expect, it } from "vitest";
import { exerciseIdFromFolder, problemIdFromFolder } from "../../../lib/repo.ts";
import { type LinkTarget, routeForLink } from "../../web/links.ts";

const PROBLEM = "problems/lc-0001-two-sum/README.md";
const CONCEPT = "concepts/hash-map/README.md";
const EXERCISE = "concepts/hash-map/exercises/01-first-repeat/README.md";
const conceptLink = (slug: string): LinkTarget => ({ kind: "app", link: { to: "/c/$slug", params: { slug } } });
const problemLink = (id: string): LinkTarget => ({ kind: "app", link: { to: "/p/$id", params: { id } } });

const CASES: [readme: string, href: string, expected: LinkTarget][] = [
  [PROBLEM, "../../concepts/hash-map/README.md", conceptLink("hash-map")],
  [CONCEPT, "../../problems/lc-0001-two-sum/README.md", problemLink("lc-0001")],
  [CONCEPT, "../../problems/lc-0001-two-sum/README.md#log", problemLink("lc-0001")],
  [CONCEPT, "exercises/01-first-repeat/README.md", { kind: "app", link: { to: "/e/$concept/$nn", params: { concept: "hash-map", nn: "01" } } }],
  [EXERCISE, "../../README.md", conceptLink("hash-map")],
  ["README.md", "INDEX.md", { kind: "app", link: { to: "/" } }],
  [CONCEPT, "../INDEX.md", { kind: "app", link: { to: "/" } }],
  [PROBLEM, "https://leetcode.com/problems/two-sum/", { kind: "external", href: "https://leetcode.com/problems/two-sum/" }],
  [PROBLEM, "solution.py", { kind: "none" }],
  [PROBLEM, "../../problems/", { kind: "none" }],
  [PROBLEM, "../../../../etc/passwd", { kind: "none" }],
  [PROBLEM, "#statement", { kind: "none" }],
  [PROBLEM, "mailto:someone@example.com", { kind: "none" }],
];

describe("routeForLink", () => {
  it.each(CASES)("%s → %s", (readme, href, expected) => {
    expect(routeForLink(readme, href)).toEqual(expected);
  });

  it("uses the same id rules as the repo scanner", () => {
    expect(problemIdFromFolder("lc-0217-contains-duplicate")).toBe("lc-0217");
    expect(exerciseIdFromFolder("greedy", "02-coins")).toBe("greedy/02");
  });
});
