import type { Rng, StressCase } from "../../runner/src/stress.ts";

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function stress(rng: Rng): StressCase[] {
  const s = Array.from({ length: 100_000 }, () => rng.pick(LETTERS)).join("");
  const t = Array.from({ length: 50 }, () => rng.pick(LETTERS)).join("");
  return [{ name: "n=1e5", input: [s, t] }];
}
