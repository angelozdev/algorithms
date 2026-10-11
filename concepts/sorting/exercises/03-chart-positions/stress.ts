import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  return [
    { name: "n=1e5, counts up to 1e9", input: [rng.intArray(100_000, 0, 1_000_000_000)] },
    { name: "n=1e5, counts up to 5e4 (many ties)", input: [rng.intArray(100_000, 0, 50_000)] },
  ];
}
