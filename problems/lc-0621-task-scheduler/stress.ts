import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 10_000;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const skewed = Array.from({ length: n }, () => "A");
  const uniform = Array.from({ length: n }, () => rng.pick(letters));
  return [
    { name: "n=1e4 single letter, cooldown=100", input: [skewed, 100] },
    { name: "n=1e4 uniform letters, cooldown=50", input: [uniform, 50] },
  ];
}
