import type { Rng, StressCase } from "../../runner/src/stress.ts";

function randomGrid(rng: Rng, rows: number, cols: number, landChance: number): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(rng.next() < landChance ? "1" : "0");
    grid.push(row);
  }
  return grid;
}

function checkerboard(rows: number, cols: number): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push((r + c) % 2 === 0 ? "1" : "0");
    grid.push(row);
  }
  return grid;
}

export default function stress(rng: Rng): StressCase[] {
  const rows = 300;
  const cols = 300;
  return [
    { name: "n=300x300 dense", input: [randomGrid(rng, rows, cols, 0.6)] },
    { name: "n=300x300 checkerboard", input: [checkerboard(rows, cols)] },
  ];
}
