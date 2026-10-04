import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 100_000;
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const magazineChars: string[] = [];
  for (let i = 0; i < n; i++) magazineChars.push(alphabet[rng.int(0, 25)]);
  const ransomChars = rng.shuffle([...magazineChars]);
  return [{ name: "n=1e5", input: [ransomChars.join(""), magazineChars.join("")] }];
}
