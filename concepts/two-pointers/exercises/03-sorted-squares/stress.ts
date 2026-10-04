import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const nums = rng.intArray(100_000, -10_000, 10_000).sort((a, b) => a - b);
  return [{ name: "n=1e5, mixed signs", input: [nums] }];
}
