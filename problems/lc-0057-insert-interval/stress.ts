import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(_rng: Rng): StressCase[] {
  const n = 10_000;
  const shifted = Array.from({ length: n }, (_, i) => [2 * i + 10, 2 * i + 10]);

  return [
    { name: "n=1e4 insert merges the whole list", input: [shifted, [0, 100_000]] },
    { name: "n=1e4 insert disjoint before all", input: [shifted, [0, 5]] },
  ];
}
