import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const singletons = rng.intArray(10_000, -10_000, 10_000).map((v) => [v]);
  const wide = Array.from({ length: 20 }, () => rng.intArray(500, -10_000, 10_000).sort((a, b) => a - b));
  return [
    { name: "k=1e4 singletons", input: [singletons] },
    { name: "k=20 lists of 500", input: [wide] },
  ];
}
