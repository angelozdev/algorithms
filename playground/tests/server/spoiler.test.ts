import { afterEach, describe, expect, it } from "vitest";
import { problemReadme, put } from "../../../scripts/tests/fixture.ts";
import { createApp } from "../../server/app.ts";
import { call, makeRepo, removeRepos } from "./helpers.ts";

afterEach(removeRepos);

const SECRET = "SECRET-4242";
const ECHO = {
  entry: "echo",
  params: [{ name: "s", type: "string" }],
  returns: "string",
  examples: [{ input: ["a"], expected: "a" }],
  hidden: [{ input: ["b"], expected: SECRET }],
};

function echoProblem(root: string, folder: string, id: string, solution: string): void {
  put(root, `problems/${folder}/README.md`, problemReadme({ id, title: folder, slug: folder, patterns: ["strings"], concepts: [], status: "solving", solvedIn: [] }));
  put(root, `problems/${folder}/cases.json`, JSON.stringify(ECHO));
  put(root, `problems/${folder}/solution.py`, solution);
}

describe("anti-spoiler", () => {
  it("no route ever sends the expected value of a hidden case", async () => {
    const root = makeRepo();
    echoProblem(root, "lc-0100-echo-fail", "lc-0100", "class Solution:\n    def echo(self, s: str) -> str:\n        return s\n");
    // Builds the answer at run time, so the secret is not in the source either.
    echoProblem(root, "lc-0101-echo-pass", "lc-0101", "class Solution:\n    def echo(self, s: str) -> str:\n        return 'SECRET-' + str(4242) if s == 'b' else s\n");
    const app = createApp({ root });
    const responses = await Promise.all([
      call(app, "/api/home"),
      call(app, "/api/target?id=lc-0100"),
      call(app, "/api/target?id=lc-0101"),
      call(app, "/api/solution?id=lc-0100&lang=py"),
      call(app, "/api/solution?id=lc-0101&lang=py"),
      call(app, "/api/run", { json: { id: "lc-0100", lang: "py" } }),
      call(app, "/api/run", { json: { id: "lc-0101", lang: "py" } }),
      call(app, "/api/run-custom", { json: { id: "lc-0100", lang: "py", input: ["z"] } }),
      call(app, "/api/concept?slug=hash-map"),
    ]);
    const texts = await Promise.all(responses.map((res) => res.text()));
    expect(JSON.parse(texts[5]).hidden.status).toBe("fail");
    expect(JSON.parse(texts[6]).hidden.status).toBe("pass");
    for (const text of texts) expect(text).not.toContain(SECRET);
  });
});
