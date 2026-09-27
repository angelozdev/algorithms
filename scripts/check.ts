import { contentRoot } from "../runner/src/paths.ts";
import { checkRepo } from "./lib/checks.ts";

const report = checkRepo(contentRoot());
for (const issue of report.errors) console.log(`✗ ${issue.file}: ${issue.message}`);
for (const issue of report.warnings) console.log(`! ${issue.file}: ${issue.message}`);
console.log(`${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
process.exitCode = report.errors.length > 0 ? 1 : 0;
