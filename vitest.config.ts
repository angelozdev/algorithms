import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["runner/tests/**/*.test.ts", "scripts/tests/**/*.test.ts", "playground/tests/server/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [react()],
        resolve: { alias: { "@": fileURLToPath(new URL("./playground/web", import.meta.url)) } },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["playground/tests/web/**/*.test.{ts,tsx}"],
          setupFiles: ["playground/tests/web/setup.ts"],
        },
      },
    ],
  },
});
