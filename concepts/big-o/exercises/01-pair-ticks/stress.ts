import type { StressCase } from "../../../../runner/src/stress.ts";

export default function stress(): StressCase[] {
  return [{ name: "n=1e6", input: [1_000_000] }];
}
