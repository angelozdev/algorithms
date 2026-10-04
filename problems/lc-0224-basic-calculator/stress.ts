import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const depth = 149_999;
  const deeplyNested = "(".repeat(depth) + "1" + ")".repeat(depth);

  const termCount = 150_000;
  const parts: string[] = [String(rng.int(1, 9))];
  for (let i = 1; i < termCount; i++) {
    parts.push(rng.pick(["+", "-"]), String(rng.int(1, 9)));
  }
  const longChain = parts.join("");

  return [
    { name: "n≈3e5 deeply nested parens", input: [deeplyNested] },
    { name: "n≈3e5 long flat chain", input: [longChain] },
  ];
}
