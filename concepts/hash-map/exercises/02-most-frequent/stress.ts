import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  return [{ name: "n=1e5 values in [0, 5e4]", input: [rng.intArray(100_000, 0, 50_000)] }];
}
