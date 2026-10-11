import { contentRoot } from "../runner/src/paths.ts";
import { envClock } from "./clock.ts";
import { runStudyCli } from "./commands.ts";

process.exitCode = await runStudyCli(process.argv.slice(2), {
  root: contentRoot(),
  clock: envClock(),
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});
