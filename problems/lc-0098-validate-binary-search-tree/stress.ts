import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 9_000;
  const chain: (number | null)[] = [0];
  for (let i = 1; i < n; i++) {
    chain.push(null, i);
  }
  return [{ name: "n=9e3 chain", input: [chain] }];
}
