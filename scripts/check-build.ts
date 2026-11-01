// SPDX-License-Identifier: GPL-3.0-or-later
// Post-build checks (step 0.9): no dark-mode media query in the shipped CSS (light theme only).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "build/client";
const offenders: string[] = [];

function walk(dir: string): void {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			walk(path);
		} else if (
			path.endsWith(".css") &&
			readFileSync(path, "utf8").includes("prefers-color-scheme: dark")
		) {
			offenders.push(path);
		}
	}
}

walk(root);
if (offenders.length > 0) {
	console.error(`Dark-mode media query found in:\n  ${offenders.join("\n  ")}`);
	process.exit(1);
}
console.log("Build check OK: no prefers-color-scheme: dark in the shipped CSS");
