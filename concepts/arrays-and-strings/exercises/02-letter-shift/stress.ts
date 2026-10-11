import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const text = Array.from({ length: 100_000 }, () => String.fromCharCode(rng.int(32, 126))).join("");
  return [{ name: "1e5 characters, k=999999937", input: [text, 999_999_937] }];
}
