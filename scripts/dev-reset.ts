// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run dev:reset --yes` — back to the first-run state for local testing: removes the database,
// uploads, imports and the demo marker under DATA_DIR, the backups folder (BACKUP_DIR), and under
// CONFIG_DIR `config.json`, the uploaded library logo and the configuration history (default
// folders copied at first run stay). The next start opens the wizard again.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { env } from "#lib/server/env.js";

const { DATA_DIR, CONFIG_DIR, BACKUP_DIR } = env();
const targets = [
	join(DATA_DIR, "db"),
	join(DATA_DIR, "uploads"),
	join(DATA_DIR, "imports"),
	BACKUP_DIR,
	join(DATA_DIR, "tmp"),
	join(DATA_DIR, "demo-data.json"),
	join(CONFIG_DIR, "config.json"),
	join(CONFIG_DIR, "branding"),
	join(CONFIG_DIR, "history"),
];

if (!process.argv.includes("--yes")) {
	console.log("This removes every local datum and the configuration written by the wizard:");
	for (const t of targets) {
		console.log(`  ${existsSync(t) ? "rm " : "   "} ${t}`);
	}
	console.log("Run again with --yes to proceed.");
	process.exit(1);
}
for (const t of targets) {
	if (existsSync(t)) {
		rmSync(t, { recursive: true, force: true });
		console.log(`removed ${t}`);
	}
}
console.log("Reset done: the next start shows the first-run wizard.");
