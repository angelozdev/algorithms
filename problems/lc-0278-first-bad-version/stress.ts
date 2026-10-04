import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 2147483647;
  return [{ name: "n=2147483647", input: [n, rng.int(1, n)] }];
}
