import type { StressCase } from "../../../../runner/src/stress.ts";

export default function stress(): StressCase[] {
  return [
    { name: "n!, n=1e9", input: ["n!", 1_000_000_000] },
    { name: "2^n, n=1e9", input: ["2^n", 1_000_000_000] },
  ];
}
