import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const nums = rng.intArray(100_000, -100, 100).sort((a, b) => a - b);
  return [{ name: "n=1e5 sorted values in [-100, 100]", input: [nums] }];
}
