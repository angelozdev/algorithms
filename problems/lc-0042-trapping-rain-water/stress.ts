import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 20_000;
  const random = rng.intArray(n, 0, 100_000);
  const zigzag = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 100_000 : 0));

  return [
    { name: "n=2e4 random", input: [random] },
    { name: "n=2e4 zigzag", input: [zigzag] },
  ];
}
