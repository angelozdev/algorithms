import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

/** The i-th distinct name of up to four lowercase letters: a, b, …, z, ba, bb, … */
function name(i: number): string {
  let text = "";
  do {
    text = String.fromCharCode(97 + (i % 26)) + text;
    i = Math.floor(i / 26);
  } while (i > 0);
  return text;
}

export default function stress(rng: Rng): StressCase[] {
  const names = rng.shuffle(Array.from({ length: 100_000 }, (_, i) => name(i)));
  return [
    { name: "n=1e5, spread-out scores", input: [names, rng.intArray(100_000, -1_000_000_000, 1_000_000_000)] },
    { name: "n=1e5, scores from 0 to 9 (many ties)", input: [names, rng.intArray(100_000, 0, 9)] },
  ];
}
