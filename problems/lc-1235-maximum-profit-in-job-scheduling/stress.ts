import type { Rng, StressCase } from "../../runner/src/stress.ts";

function randomJobs(rng: Rng, n: number): [number[], number[], number[]] {
  const startTime: number[] = [];
  const endTime: number[] = [];
  const profit: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = rng.int(1, 999_000_000);
    const e = rng.int(s + 1, Math.min(s + 2_000_000, 1_000_000_000));
    startTime.push(s);
    endTime.push(e);
    profit.push(rng.int(1, 10_000));
  }
  return [startTime, endTime, profit];
}

export default function stress(rng: Rng): StressCase[] {
  const n = 50_000;
  const random = randomJobs(rng, n);
  const startTime = Array.from({ length: n }, (_, i) => i + 1);
  const endTime = Array.from({ length: n }, (_, i) => i + 2);
  const profit = Array.from({ length: n }, () => rng.int(1, 10_000));
  return [
    { name: "n=5e4 random", input: random },
    { name: "n=5e4 all non-overlapping", input: [startTime, endTime, profit] },
  ];
}
