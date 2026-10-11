import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const staircase = Array.from({ length: 100_000 }, () => rng.pick(["U", "R"])).join("");
  const wander = Array.from({ length: 100_000 }, () => rng.pick(["U", "D", "L", "R"])).join("");
  return [
    { name: "1e5 moves, never back to a visited cell", input: [staircase] },
    { name: "1e5 random moves", input: [wander] },
  ];
}
