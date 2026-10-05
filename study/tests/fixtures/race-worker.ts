// One of several processes started together by record.test.ts to race on the same item (spec §12).
import { recordWork } from "../../record.ts";
import { openStudy } from "../../store.ts";

const [root, go] = process.argv.slice(2);
const study = openStudy(root);
while (Date.now() < Number(go)) {
  // wait for the others, so the writes really overlap
}
const result = recordWork(study, "lc-0001", { type: "run", lang: "py", green: false }, "cli");
study.close();
process.stdout.write(JSON.stringify(result));
