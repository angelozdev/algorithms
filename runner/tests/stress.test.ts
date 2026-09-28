import { utimesSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CaseFileError, parseCaseFile } from "../src/schema.ts";
import { createRng, loadStressCases, seedFromId } from "../src/stress.ts";
import { removeTemp, tempDir, write } from "./helpers.ts";

const dir = tempDir();
afterAll(() => removeTemp(dir));

describe("createRng", () => {
  it("is deterministic for a seed and respects bounds", () => {
    const a = createRng(seedFromId("lc-0001"));
    const b = createRng(seedFromId("lc-0001"));
    const first = a.intArray(1000, -5, 5);
    expect(b.intArray(1000, -5, 5)).toEqual(first);
    expect(Math.min(...first)).toBe(-5);
    expect(Math.max(...first)).toBe(5);
    expect(createRng(seedFromId("lc-0002")).intArray(1000, -5, 5)).not.toEqual(first);
  });

  it("shuffles in place into a permutation", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const shuffled = createRng(7).shuffle([...items]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });
});

describe("loadStressCases", () => {
  it("returns null when the folder has no stress.ts", async () => {
    expect(await loadStressCases(path.join(dir, "none"), "x")).toBeNull();
  });

  it("calls the default export with a seeded rng", async () => {
    const folder = path.join(dir, "ok");
    write(
      folder,
      "stress.ts",
      [
        'import type { Rng, StressCase } from "../../../../src/stress.ts";',
        "export default function stress(rng: Rng): StressCase[] {",
        '  return [{ name: "big", input: [rng.intArray(5, 0, 9)], limitMs: 50 }];',
        "}",
        "",
      ].join("\n"),
    );
    const cases = await loadStressCases(folder, "lc-0001");
    expect(cases).toEqual([
      { name: "big", input: [createRng(seedFromId("lc-0001")).intArray(5, 0, 9)], limitMs: 50 },
    ]);
  });

  it("reloads the file after it changes, even when its mtime does not", async () => {
    const folder = path.join(dir, "reload");
    const stamp = new Date("2026-01-01T00:00:00Z");
    const file = write(folder, "stress.ts", 'export default () => [{ name: "v1", input: [1] }];\n');
    utimesSync(file, stamp, stamp);
    expect((await loadStressCases(folder, "x"))?.[0].name).toBe("v1");
    write(folder, "stress.ts", 'export default () => [{ name: "v2", input: [1] }];\n');
    utimesSync(file, stamp, stamp);
    expect((await loadStressCases(folder, "x"))?.[0].name).toBe("v2");
  });

  it("rejects files without a default function or with bad cases", async () => {
    const noDefault = path.join(dir, "no-default");
    write(noDefault, "stress.ts", "export const x = 1;\n");
    await expect(loadStressCases(noDefault, "x")).rejects.toBeInstanceOf(CaseFileError);

    const bad = path.join(dir, "bad");
    write(bad, "stress.ts", 'export default () => [{ input: [1], limitMs: -1 }];\n');
    await expect(loadStressCases(bad, "x")).rejects.toThrow(/\[0\]\.name: required/);
  });

  it("checks every input against the signature in cases.json", async () => {
    const pair = parseCaseFile({
      entry: "solve",
      params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
      returns: "int",
      examples: [{ input: [[1], 1], expected: 1 }],
      hidden: [],
    });
    const folder = path.join(dir, "arity");
    write(
      folder,
      "stress.ts",
      'export default () => [{ name: "ok", input: [[1, 2], 3] }, { name: "flat", input: [1, 2, 3] }, { name: "bare", input: 7 }];\n',
    );
    const error = await loadStressCases(folder, "x", pair).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CaseFileError);
    expect((error as CaseFileError).message).toMatch(/^stress\.ts is invalid/);
    expect((error as CaseFileError).issues).toEqual([
      "[1].input: expected 2 params, got 3",
      "[2].input: expected an array of 2 params",
    ]);

    const stack = parseCaseFile({
      mode: "class",
      entry: "MinStack",
      examples: [{ input: { ops: ["MinStack", "push"], args: [[], [1]] }, expected: [null, null] }],
      hidden: [],
    });
    const classFolder = path.join(dir, "class");
    write(
      classFolder,
      "stress.ts",
      'export default () => [{ name: "ok", input: { ops: ["MinStack", "push"], args: [[], [1]] } }, { name: "no-ctor", input: { ops: ["push"], args: [[1]] } }, { name: "plain", input: [1] }];\n',
    );
    const classError = await loadStressCases(classFolder, "x", stack).catch((caught: unknown) => caught);
    expect(classError).toBeInstanceOf(CaseFileError);
    expect((classError as CaseFileError).issues).toEqual([
      '[1].input.ops[0]: expected "MinStack"',
      '[2].input: expected { "ops": [...], "args": [...] }',
    ]);
  });

  it("reports files that fail to load or whose generator throws as case-file errors", async () => {
    const broken = path.join(dir, "broken");
    write(broken, "stress.ts", 'export default () => [{ name: "half", input: [1] }\n');
    const loading = loadStressCases(broken, "x");
    await expect(loading).rejects.toBeInstanceOf(CaseFileError);
    await expect(loading).rejects.toThrow(/failed to load/);

    const throwing = path.join(dir, "throwing");
    write(throwing, "stress.ts", 'export default () => { throw new TypeError("boom"); };\n');
    const generating = loadStressCases(throwing, "x");
    await expect(generating).rejects.toBeInstanceOf(CaseFileError);
    await expect(generating).rejects.toThrow(/stress\(\) threw: boom/);
  });

  it("stops a generator that never returns and reports it as a case-file error", async () => {
    const folder = path.join(dir, "endless");
    write(folder, "stress.ts", "export default () => { for (;;) {} };\n");
    const started = Date.now();
    const error = await loadStressCases(folder, "x", undefined, { timeoutMs: 1000 }).catch((caught: unknown) => caught);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(error).toBeInstanceOf(CaseFileError);
    expect((error as CaseFileError).message).toMatch(/^stress\.ts is invalid/);
    expect((error as CaseFileError).issues).toEqual(["stress() did not return within 1000 ms (an infinite loop?)"]);
  });

  it("reports a generator process that dies as a case-file error", async () => {
    const folder = path.join(dir, "dying");
    write(folder, "stress.ts", "export default () => process.exit(7);\n");
    const error = await loadStressCases(folder, "x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CaseFileError);
    expect((error as CaseFileError).issues[0]).toMatch(/^the generator exited without returning cases \(exit code 7\)/);
  });

  it("ignores what the generator prints", async () => {
    const folder = path.join(dir, "chatty");
    write(folder, "stress.ts", 'export default () => { console.log("building"); console.error("still building"); return [{ name: "n=1", input: [1] }]; };\n');
    expect(await loadStressCases(folder, "x")).toEqual([{ name: "n=1", input: [1] }]);
  });
});
