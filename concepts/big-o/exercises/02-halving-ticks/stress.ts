import type { StressCase } from "../../../../runner/src/stress.ts";

export default function stress(): StressCase[] {
  return [{ name: "n=1e15", input: [1_000_000_000_000_000] }];
}
