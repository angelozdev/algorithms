import { contentRoot } from "../runner/src/paths.ts";
import { sync } from "./lib/sync.ts";

const changed = sync(contentRoot());
console.log(changed.length > 0 ? `Updated:\n${changed.map((file) => `  ${file}`).join("\n")}` : "Everything is in sync.");
