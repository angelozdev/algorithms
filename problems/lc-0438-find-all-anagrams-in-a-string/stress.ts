import type { Rng, StressCase } from "../../runner/src/stress.ts";

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

export default function stress(rng: Rng): StressCase[] {
  const s = Array.from({ length: 30_000 }, () => rng.pick(LETTERS)).join("");
  const p = Array.from({ length: 15_000 }, () => rng.pick(LETTERS)).join("");
  return [{ name: "n=3e4", input: [s, p] }];
}
