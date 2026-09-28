import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const nums = rng.intArray(30_000, -100, 100).sort((a, b) => a - b);
  return [{ name: "n=3e4 sorted values in [-100, 100]", input: [nums] }];
}
