import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 100_000;
  const random = rng.intArray(n, 0, 10_000);
  const increasing = Array.from({ length: n }, (_, i) => i % 10_001);
  const allEqual = Array.from({ length: n }, () => 10_000);

  return [
    { name: "n=1e5 random", input: [random] },
    { name: "n=1e5 increasing", input: [increasing] },
    { name: "n=1e5 all equal", input: [allEqual] },
  ];
}
