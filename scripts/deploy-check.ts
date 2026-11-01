// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run deploy:check https://biblioviva.<tailnet>.ts.net` — checks a deployed instance from a
// device on the tailnet (step 8.4): health, HTTPS and certificate, HSTS, headers, login page.
import { checkDeployment } from "../src/lib/server/deploy-check.ts";

const url = process.argv[2];
if (!url) {
	console.error("usage: bun run deploy:check https://biblioviva.<tailnet>.ts.net");
	process.exit(2);
}
const checks = await checkDeployment(url);
for (const c of checks) {
	console.warn(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
}
const failed = checks.filter((c) => !c.ok).length;
console.warn(failed === 0 ? "All checks passed." : `${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
