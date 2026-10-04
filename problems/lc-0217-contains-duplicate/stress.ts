import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  return [{ name: "n=1e5", input: [rng.intArray(100_000, -1_000_000_000, 1_000_000_000)] }];
}
