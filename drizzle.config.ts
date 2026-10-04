import { defineConfig } from "drizzle-kit";

// `pnpm exec drizzle-kit generate --name <what-changed>` writes study/migrations/ from study/schema.ts.
export default defineConfig({ dialect: "sqlite", schema: "./study/schema.ts", out: "./study/migrations" });
