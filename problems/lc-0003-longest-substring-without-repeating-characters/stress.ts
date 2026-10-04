import type { Rng, StressCase } from "../../runner/src/stress.ts";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@# ".split("");

export default function stress(rng: Rng): StressCase[] {
  const chars = Array.from({ length: 100_000 }, () => rng.pick(ALPHABET));
  return [{ name: "n=1e5", input: [chars.join("")] }];
}
