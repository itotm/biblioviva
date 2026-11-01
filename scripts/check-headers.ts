// SPDX-License-Identifier: GPL-3.0-or-later
// Verifies that every source file starts with the SPDX license header (CLAUDE.md).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const HEADER = "SPDX-License-Identifier: GPL-3.0-or-later";
const ROOTS = ["src", "scripts", "tests"];
const EXTENSIONS = new Set([".ts", ".js", ".svelte", ".css", ".sh"]);
const SKIP_DIRS = new Set(["node_modules", "assets", "vendor"]);

function walk(dir: string, out: string[]): void {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			if (!SKIP_DIRS.has(name)) {
				walk(path, out);
			}
		} else if (EXTENSIONS.has(path.slice(path.lastIndexOf("."))) && !path.endsWith(".d.ts")) {
			out.push(path);
		}
	}
}

const files: string[] = [];
for (const root of ROOTS) {
	walk(root, files);
}

const missing = files.filter((f) => !readFileSync(f, "utf8").slice(0, 400).includes(HEADER));
if (missing.length > 0) {
	console.error(`Missing SPDX header (${HEADER}) in:\n  ${missing.join("\n  ")}`);
	process.exit(1);
}
console.log(`SPDX headers OK (${files.length} files)`);
