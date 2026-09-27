import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["runner/tests/**/*.test.ts", "scripts/tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
