import type { Rng, StressCase } from "../../runner/src/stress.ts";

function buildCase(
  keyCount: number,
  setCount: number,
  getCount: number,
  rng: Rng,
): { ops: string[]; args: unknown[][] } {
  const ops: string[] = ["TimeMap"];
  const args: unknown[][] = [[]];
  const keys = Array.from({ length: keyCount }, (_, i) => `k${i}`);
  let timestamp = 0;
  for (let i = 0; i < setCount; i++) {
    timestamp += rng.int(1, 5);
    const key = keys[i % keyCount];
    ops.push("set");
    args.push([key, `v${i}`, timestamp]);
  }
  for (let i = 0; i < getCount; i++) {
    const key = rng.pick(keys);
    ops.push("get");
    args.push([key, rng.int(1, timestamp)]);
  }
  return { ops, args };
}

export default function stress(rng: Rng): StressCase[] {
  const single = buildCase(1, 90_000, 90_000, rng);
  const many = buildCase(1_000, 90_000, 90_000, rng);
  return [
    { name: "n=1.8e5 single key", input: single },
    { name: "n=1.8e5 many keys", input: many },
  ];
}
