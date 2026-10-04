import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const amount = 4_000;
  const smallCoins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const mixedCoins = [1, ...rng.intArray(11, 100, 1_000_000_000)];
  return [
    { name: "amount=4e3 small denominations", input: [smallCoins, amount] },
    { name: "amount=4e3 mixed denominations", input: [mixedCoins, amount] },
  ];
}
