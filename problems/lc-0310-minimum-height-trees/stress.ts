import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 20_000;

  const pathEdges: number[][] = [];
  for (let i = 1; i < n; i++) pathEdges.push([i - 1, i]);

  const randomEdges: number[][] = [];
  for (let i = 1; i < n; i++) randomEdges.push([rng.int(0, i - 1), i]);

  return [
    { name: "n=2e4 path", input: [n, pathEdges] },
    { name: "n=2e4 random tree", input: [n, randomEdges] },
  ];
}
