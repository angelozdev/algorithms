import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 30_000;
  const ops: string[] = ["MinStack"];
  const args: number[][] = [[]];
  let size = 0;
  for (let i = 0; i < n; i++) {
    const choice = size === 0 ? "push" : rng.pick(["push", "push", "pop", "top", "getMin"]);
    if (choice === "push") {
      args.push([rng.int(-2_147_483_648, 2_147_483_647)]);
      size++;
    } else {
      args.push([]);
      if (choice === "pop") size--;
    }
    ops.push(choice);
  }
  return [{ name: "n=3e4 ops", input: { ops, args } }];
}
