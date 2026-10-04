import type { Rng, StressCase } from "../../runner/src/stress.ts";

function buildBase(rng: Rng, n: number): number[] {
  const nums = Array.from({ length: n }, () => rng.pick([-1, 1]));
  const largeValues = [-4, -3, -2, 2, 3, 4];
  for (let i = 0; i < 12; i++) {
    const pos = Math.floor((i * n) / 12);
    nums[pos] = rng.pick(largeValues);
  }
  return nums;
}

export default function stress(rng: Rng): StressCase[] {
  const n = 100_000;
  const noZeros = buildBase(rng, n);

  const oneZero = buildBase(rng, n);
  oneZero[Math.floor(n / 2) + 1] = 0;

  return [
    { name: "n=1e5 no zeros", input: [noZeros] },
    { name: "n=1e5 one zero", input: [oneZero] },
  ];
}
