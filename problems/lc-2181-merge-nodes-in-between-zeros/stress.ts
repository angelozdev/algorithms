import type { Rng, StressCase } from "../../runner/src/stress.ts";

export default function stress(rng: Rng): StressCase[] {
  const values = [0];
  while (values.length < 199_998) {
    values.push(rng.int(1, 1000));
    if (rng.int(0, 3) === 0) values.push(0);
  }
  if (values[values.length - 1] !== 0) values.push(0);
  return [{ name: "n≈2e5 nodes", input: [values] }];
}
