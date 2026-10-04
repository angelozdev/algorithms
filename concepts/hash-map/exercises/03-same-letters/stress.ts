import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 100_000;
  // Every word gets a distinct letter-count signature (no two words are anagrams of each other),
  // so a naive "compare this word against every group formed so far" approach never finds an
  // early match: it ends up scanning all previously-formed groups for every word, O(n^2).
  const letters = "abcde";
  const words = Array.from({ length: n }, (_, i) => {
    let code = i;
    const chars: string[] = [];
    for (const letter of letters) {
      const count = code % 10;
      code = Math.floor(code / 10);
      for (let k = 0; k < count; k++) chars.push(letter);
    }
    return rng.shuffle(chars).join("");
  });
  return [{ name: "n=1e5 words, every word a different bag of letters", input: [words] }];
}
