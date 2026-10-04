import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 200_000;
  const capacity = 3000;
  const ops: string[] = ["LRUCache"];
  const args: number[][] = [[capacity]];
  for (let i = 0; i < n; i++) {
    const key = rng.int(0, 10_000);
    if (rng.next() < 0.5) {
      ops.push("get");
      args.push([key]);
    } else {
      ops.push("put");
      args.push([key, rng.int(0, 100_000)]);
    }
  }
  return [{ name: "n=2e5 ops", input: { ops, args } }];
}
