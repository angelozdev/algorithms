import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 10_000;

  const overlapping = Array.from({ length: n }, () => {
    const start = rng.int(0, 10_000);
    const end = Math.min(10_000, start + rng.int(0, 50));
    return [start, end];
  });
  rng.shuffle(overlapping);

  const disjoint = Array.from({ length: n }, (_, i) => [i, i]).reverse();

  return [
    { name: "n=1e4 dense overlaps", input: [overlapping] },
    { name: "n=1e4 disjoint reverse order", input: [disjoint] },
  ];
}
