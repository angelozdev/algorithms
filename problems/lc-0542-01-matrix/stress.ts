import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const rows = 100;
  const cols = 100;
  const single: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) row.push(1);
    single.push(row);
  }
  single[rows - 1][cols - 1] = 0;

  const scattered: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) row.push(1);
    scattered.push(row);
  }
  for (let i = 0; i < 20; i++) {
    scattered[rng.int(0, rows - 1)][rng.int(0, cols - 1)] = 0;
  }

  return [
    { name: "n=1e4 single zero", input: [single] },
    { name: "n=1e4 scattered zeros", input: [scattered] },
  ];
}
