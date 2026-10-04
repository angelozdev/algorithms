import type { CaseFile, CompareMode } from "./types.ts";

export const FLOAT_TOLERANCE = 1e-5;

/** JSON text with sorted object keys: equal values give equal strings (-0 and 0 included). */
export function canonical(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
          )
        : item,
    ) ?? "undefined"
  );
}

function floatEqual(expected: unknown, output: unknown): boolean {
  if (typeof expected === "number" && typeof output === "number") {
    return Math.abs(expected - output) <= FLOAT_TOLERANCE;
  }
  if (Array.isArray(expected) && Array.isArray(output)) {
    return expected.length === output.length && expected.every((item, i) => floatEqual(item, output[i]));
  }
  return canonical(expected) === canonical(output);
}

function unorderedEqual(expected: unknown, output: unknown): boolean {
  if (!Array.isArray(expected) || !Array.isArray(output) || expected.length !== output.length) return false;
  const a = expected.map(canonical).sort();
  const b = output.map(canonical).sort();
  return a.every((item, i) => item === b[i]);
}

/** An inner array's canonical text with its items sorted, so [2, 1] and [1, 2] give the same key. */
function sortedKey(item: unknown): string {
  return Array.isArray(item) ? `[${item.map(canonical).sort().join(",")}]` : canonical(item);
}

/** Like unordered, but each inner array may also come in any order (sets of sets: 3Sum, Subsets…). */
function unorderedNestedEqual(expected: unknown, output: unknown): boolean {
  if (!Array.isArray(expected) || !Array.isArray(output) || expected.length !== output.length) return false;
  const a = expected.map(sortedKey).sort();
  const b = output.map(sortedKey).sort();
  return a.every((item, i) => item === b[i]);
}

export function compareValue(mode: CompareMode, expected: unknown, output: unknown): boolean {
  switch (mode) {
    case "exact":
      return canonical(expected) === canonical(output);
    case "float":
      return floatEqual(expected, output);
    case "unordered":
      return unorderedEqual(expected, output);
    case "unordered-nested":
      return unorderedNestedEqual(expected, output);
    case "any-of":
      return Array.isArray(expected) && expected.some((candidate) => canonical(candidate) === canonical(output));
  }
}

/** The part of a harness output that is judged. null when an in-place output is malformed. */
export function judgedValue(cf: Pick<CaseFile, "inPlace">, output: unknown): { value: unknown } | null {
  if (!cf.inPlace) return { value: output };
  if (typeof output !== "object" || output === null || !("param" in output)) return null;
  const { ret, param } = output as { ret: unknown; param: unknown };
  if (cf.inPlace.prefix !== "return") return { value: param };
  if (typeof ret !== "number" || !Number.isInteger(ret) || ret < 0) return null;
  if (!Array.isArray(param) || ret > param.length) return null;
  return { value: param.slice(0, ret) };
}

export function matches(
  cf: Pick<CaseFile, "compare" | "inPlace">,
  expected: unknown,
  output: unknown,
): boolean {
  const judged = judgedValue(cf, output);
  return judged !== null && compareValue(cf.compare, expected, judged.value);
}
