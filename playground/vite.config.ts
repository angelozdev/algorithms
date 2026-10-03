import { fileURLToPath } from "node:url";
import devServer from "@hono/vite-dev-server";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = (file: string): string => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  root: here("./web"),
  server: {
    fs: {
      // Vite's default deny list (checked against the installed Vite), plus the files this playground
      // must never serve: cases.json (hidden expected values) and stress.ts (hidden stress inputs). Vite's
      // /@fs/ route can read any file under the workspace root, bypassing Hono entirely, so the deny has
      // to live here.
      deny: [".env", ".env.*", "*.{crt,pem,key,p12,pfx,cer,der}", ".npmrc", ".yarnrc.yml", "**/.git/**", "**/cases.json", "**/stress.ts"],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // Only /api/* reaches Hono. Every other path is the React app: Vite answers app routes with index.html.
    devServer({ entry: here("./server/app.ts"), exclude: [/^(?!\/api(?:\/|\?|$))/], injectClientScript: false }),
  ],
});
