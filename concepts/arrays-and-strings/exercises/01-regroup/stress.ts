import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const manyRows = Array.from({ length: 100_000 }, () => [rng.int(-1_000_000_000, 1_000_000_000)]);
  const oneRow = [rng.intArray(100_000, -1_000_000_000, 1_000_000_000)];
  return [
    { name: "1e5 rows of one widget, cols=3", input: [manyRows, 3] },
    { name: "one row of 1e5 widgets, cols=1", input: [oneRow, 1] },
  ];
}
