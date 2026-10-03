import { startPlayground } from "../start.ts";
import { E2E_PORT, E2E_ROOT, resetRepo } from "./fixture.ts";

// The API reads ALGO_ROOT when Vite first loads it, which happens on the first request after this.
resetRepo();
process.env.ALGO_ROOT = E2E_ROOT;
const playground = await startPlayground({ route: "/", open: false, port: E2E_PORT, strictPort: true });
process.stdout.write(`e2e playground: ${playground.url}\n`);
