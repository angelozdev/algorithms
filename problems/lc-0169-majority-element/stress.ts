import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 50_000;
  const majority = rng.int(-1_000_000_000, 1_000_000_000);
  const majorityCount = Math.floor(n / 2) + 1;
  const nums = Array.from({ length: majorityCount }, () => majority);
  for (let i = majorityCount; i < n; i++) nums.push(rng.int(-1_000_000_000, 1_000_000_000));
  rng.shuffle(nums);
  return [{ name: "n=5e4", input: [nums] }];
}
