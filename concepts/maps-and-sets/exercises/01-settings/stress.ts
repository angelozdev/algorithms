import type { Rng, StressCase } from "../../../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const n = 100_000;
  const distinct = Array.from({ length: n }, (_, i) => `key${i}`);
  const values = Array.from({ length: n }, () => `v${rng.int(0, 999)}`);
  const churnKeys = Array.from({ length: n }, () => `key${rng.int(0, 49_999)}`);
  const churnValues = Array.from({ length: n }, () => (rng.int(0, 3) === 0 ? "" : `v${rng.int(0, 999)}`));
  return [
    { name: "1e5 different keys", input: [distinct, values] },
    { name: "1e5 changes on 5e4 keys, a quarter of them removals", input: [churnKeys, churnValues] },
  ];
}
