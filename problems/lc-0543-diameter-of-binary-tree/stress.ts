import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 4_000;
  const chain: (number | null)[] = [rng.int(-100, 100)];
  for (let i = 1; i < n; i++) {
    chain.push(rng.int(-100, 100));
    chain.push(null);
  }
  return [{ name: "n=4e3 chain", input: [chain] }];
}
