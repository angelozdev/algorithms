import { renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { renderRun, watchFiles } from "../src/watcher.ts";
import { makeProblem, removeTemp, tempDir, write } from "./helpers.ts";

const root = tempDir();
afterAll(() => removeTemp(root));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("watchFiles", () => {
  it("debounces bursts of writes into one call", async () => {
    const dir = path.join(root, "burst");
    write(dir, "solution.py", "a");
    await sleep(150); // let the creation event settle before watching
    let calls = 0;
    const watcher = watchFiles(dir, ["solution.py"], () => calls++, 100);
    await sleep(50); // let the watcher arm: on macOS fs.watch starts its FSEvents stream asynchronously
    writeFileSync(path.join(dir, "solution.py"), "b");
    writeFileSync(path.join(dir, "solution.py"), "c");
    await sleep(400);
    watcher.close();
    expect(calls).toBe(1);
  });

  it("reacts to atomic saves (temp file renamed onto the solution)", async () => {
    const dir = path.join(root, "atomic");
    write(dir, "solution.py", "a");
    await sleep(150); // let the creation event settle before watching
    let calls = 0;
    const watcher = watchFiles(dir, ["solution.py"], () => calls++, 50);
    await sleep(50); // let the watcher arm: on macOS fs.watch starts its FSEvents stream asynchronously
    writeFileSync(path.join(dir, ".solution.py.swp"), "b");
    renameSync(path.join(dir, ".solution.py.swp"), path.join(dir, "solution.py"));
    await sleep(300);
    watcher.close();
    expect(calls).toBe(1);
  });

  it("ignores files it does not watch", async () => {
    const dir = path.join(root, "ignore");
    write(dir, "solution.py", "a");
    await sleep(150); // let the creation event settle before watching
    let calls = 0;
    const watcher = watchFiles(dir, ["solution.py"], () => calls++, 50);
    await sleep(50); // let the watcher arm: on macOS fs.watch starts its FSEvents stream asynchronously
    writeFileSync(path.join(dir, "notes.txt"), "x");
    await sleep(300);
    watcher.close();
    expect(calls).toBe(0);
  });
});

describe("renderRun", () => {
  it("renders a normal run", async () => {
    const target = makeProblem(
      root,
      "lc-0001-render",
      {
        entry: "solve",
        params: [{ name: "n", type: "int" }],
        returns: "int",
        examples: [{ input: [2], expected: 4 }],
        hidden: [],
      },
      { "solution.py": "class Solution:\n    def solve(self, n: int) -> int:\n        return n * 2\n" },
    );
    const text = await renderRun(target, "py", root);
    expect(text).toContain("example 1");
    expect(text).toContain("GREEN");
  });

  it("shows case-file errors as text so watch keeps going", async () => {
    const target = makeProblem(root, "lc-0002-broken", {});
    write(target.dir, "cases.json", "{ oops");
    const text = await renderRun(target, "py", root);
    expect(text).toContain("Case file error");
    expect(text).toContain("invalid JSON");
  });
});
