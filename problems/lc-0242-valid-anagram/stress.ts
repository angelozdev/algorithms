import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 50_000;
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const sChars: string[] = [];
  for (let i = 0; i < n; i++) sChars.push(alphabet[rng.int(0, 25)]);
  const tChars = rng.shuffle([...sChars]);
  return [{ name: "n=5e4", input: [sChars.join(""), tChars.join("")] }];
}
