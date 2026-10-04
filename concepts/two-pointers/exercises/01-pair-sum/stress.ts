import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  // Only even values and an odd target: no pair exists, so every candidate must be ruled out.
  const nums = rng.intArray(100_000, -1_000_000_000, 1_000_000_000).map((x) => x - (x % 2));
  nums.sort((a, b) => a - b);
  return [{ name: "n=1e5, no pair adds up to target", input: [nums, 1] }];
}
