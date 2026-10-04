import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 100_000;
  return [
    { name: "n=1e5 random", input: [rng.intArray(n, -10_000, 10_000)] },
    { name: "n=1e5 all negative", input: [Array.from({ length: n }, () => rng.int(-10_000, -1))] },
  ];
}
