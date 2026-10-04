import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const insertCount = 15_000;
  const queryCount = 15_000;
  const sharedPrefix = "x".repeat(90);
  const suffixAlphabet = "abcdefghijklmnopqrstuvwxyz";
  const ops: string[] = ["Trie"];
  const args: string[][] = [[]];
  for (let i = 0; i < insertCount; i++) {
    let suffix = "";
    let n = i;
    do {
      suffix = suffixAlphabet[n % 26] + suffix;
      n = Math.floor(n / 26);
    } while (n > 0);
    ops.push("insert");
    args.push([sharedPrefix + suffix]);
  }
  for (let i = 0; i < queryCount; i++) {
    ops.push(rng.pick(["search", "startsWith"]));
    const len = rng.int(1, sharedPrefix.length);
    args.push([sharedPrefix.slice(0, len)]);
  }
  return [{ name: "n=3e4 ops, shared prefix", input: { ops, args } }];
}
