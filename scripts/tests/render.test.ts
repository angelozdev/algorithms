import { afterEach, describe, expect, it } from "vitest";
import { isInProgress, scanRepo } from "../../lib/repo.ts";
import { problemGroups } from "../lib/render.ts";
import { cleanupTempDirs, makeStudyRepo, problemReadme, put } from "./fixture.ts";

afterEach(cleanupTempDirs);

const readme = (id: string, title: string, patterns: string[], status: string) =>
  problemReadme({ id, title, slug: title.toLowerCase(), patterns, concepts: [], status, solvedIn: [] });

describe("problemGroups", () => {
  it("sorts the patterns and lists a problem under each of its patterns", () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0042-trap/README.md", readme("lc-0042", "Trap", ["two-pointers", "stack"], "todo"));
    put(root, "problems/lc-0050-bare/README.md", readme("lc-0050", "Bare", [], "todo"));
    const groups = problemGroups(scanRepo(root)).map((group) => [group.pattern, group.problems.map((p) => p.folderId)]);
    expect(groups).toEqual([
      ["(no pattern yet)", ["lc-0050"]],
      ["arrays-hashing", ["lc-0001"]],
      ["stack", ["lc-0020", "lc-0042"]],
      ["two-pointers", ["lc-0042"]],
    ]);
  });
});

describe("isInProgress", () => {
  it("counts solving items, and todo items that already have a solution file", () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0070-stairs/README.md", readme("lc-0070", "Stairs", ["dp-1d"], "todo"));
    put(root, "problems/lc-0071-path/README.md", readme("lc-0071", "Path", ["dp-2d"], "todo"));
    put(root, "problems/lc-0071-path/solution.ts", "export default function f() {}\n");
    const byId = Object.fromEntries(scanRepo(root).problems.map((p) => [p.folderId, isInProgress(p)]));
    expect(byId).toEqual({ "lc-0001": false, "lc-0020": true, "lc-0070": false, "lc-0071": true });
  });
});
