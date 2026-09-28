import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const nums = rng.shuffle(Array.from({ length: 100_000 }, (_, i) => i * 7));
  nums.push(nums[0]);
  return [{ name: "n=1e5, only the last value repeats", input: [nums] }];
}
