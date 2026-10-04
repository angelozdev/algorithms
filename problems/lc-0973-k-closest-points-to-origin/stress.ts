import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 10_000;
  const points = Array.from({ length: n }, () => [rng.int(-10_000, 10_000), rng.int(-10_000, 10_000)]);
  return [
    { name: "n=1e4 k=n/2", input: [points, Math.floor(n / 2)] },
    { name: "n=1e4 k=n-1", input: [points, n - 1] },
  ];
}
