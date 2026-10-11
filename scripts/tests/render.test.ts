import { afterEach, describe, expect, it } from "vitest";
import { isInProgress, scanRepo } from "../../lib/repo.ts";
import { problemGroups } from "../lib/render.ts";
import { cleanupTempDirs, makeStudyRepo, makeTempDir, problemReadme, put } from "./fixture.ts";

afterEach(cleanupTempDirs);

const readme = (id: string, title: string, patterns: string[]) => problemReadme({ id, title, slug: title.toLowerCase(), patterns, concepts: [] });

describe("problemGroups", () => {
  it("sorts the patterns and lists a problem under each of its patterns", () => {
    const root = makeStudyRepo();
    put(root, "problems/lc-0042-trap/README.md", readme("lc-0042", "Trap", ["two-pointers", "stack"]));
    put(root, "problems/lc-0050-bare/README.md", readme("lc-0050", "Bare", []));
    const groups = problemGroups(scanRepo(root)).map((group) => [group.pattern, group.problems.map((p) => p.folderId)]);
    expect(groups).toEqual([
      ["(no pattern yet)", ["lc-0050"]],
      ["arrays-hashing", ["lc-0001"]],
      ["stack", ["lc-0020", "lc-0042"]],
      ["two-pointers", ["lc-0042"]],
    ]);
  });
});

describe("isInProgress (legacy READMEs, until pnpm study migrate)", () => {
  it("counts solving items, and todo items with a solution file in their folder or under .study", () => {
    const root = makeTempDir("algo-legacy-");
    const legacy = (id: string, status: string) => `---\nid: ${id}\ntitle: ${id}\nstatus: ${status}\n---\n# ${id}\n`;
    put(root, "problems/lc-0001-done/README.md", legacy("lc-0001", "solved"));
    put(root, "problems/lc-0020-working/README.md", legacy("lc-0020", "solving"));
    put(root, "problems/lc-0070-stairs/README.md", legacy("lc-0070", "todo"));
    put(root, "problems/lc-0071-path/README.md", legacy("lc-0071", "todo"));
    put(root, "problems/lc-0071-path/solution.ts", "export default function f() {}\n");
    put(root, "problems/lc-0072-study/README.md", legacy("lc-0072", "todo"));
    put(root, ".study/solutions/problems/lc-0072/solution.py", "class Solution:\n    pass\n");
    const byId = Object.fromEntries(scanRepo(root).problems.map((p) => [p.folderId, isInProgress(p)]));
    expect(byId).toEqual({ "lc-0001": false, "lc-0020": true, "lc-0070": false, "lc-0071": true, "lc-0072": true });
  });
});
