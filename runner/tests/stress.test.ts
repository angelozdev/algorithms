import { utimesSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CaseFileError } from "../src/schema.ts";
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

  it("reloads the file after it changes", async () => {
    const folder = path.join(dir, "reload");
    const file = write(folder, "stress.ts", 'export default () => [{ name: "v1", input: [1] }];\n');
    expect((await loadStressCases(folder, "x"))?.[0].name).toBe("v1");
    write(folder, "stress.ts", 'export default () => [{ name: "v2", input: [1] }];\n');
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
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
});
