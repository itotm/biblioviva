// SPDX-License-Identifier: GPL-3.0-or-later
// Heuristic (warning only, PLAN.md 0.8): finds text nodes with letters in Svelte markup that
// are not wrapped in an expression, which usually means a hardcoded UI string.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/routes", "src/lib/components", "src/lib/ui"];
const SKIP = ["src/routes/dev"]; // the style guide is not product UI

function walk(dir: string, out: string[]): void {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (SKIP.some((s) => path.startsWith(s))) {
			continue;
		}
		if (statSync(path).isDirectory()) {
			walk(path, out);
		} else if (path.endsWith(".svelte")) {
			out.push(path);
		}
	}
}

const files: string[] = [];
for (const root of ROOTS) {
	try {
		walk(root, files);
	} catch {
		/* folder may not exist yet */
	}
}

let warnings = 0;
for (const file of files) {
	const source = readFileSync(file, "utf8")
		.replace(/<script[\s\S]*?<\/script>/g, "")
		.replace(/<style[\s\S]*?<\/style>/g, "")
		.replace(/<!--[\s\S]*?-->/g, "");
	// Text between tags, with expressions removed.
	const texts = source.replace(/\{[^}]*\}/g, "").match(/>([^<>{}]+)</g) ?? [];
	for (const raw of texts) {
		const text = raw.slice(1, -1).trim();
		if (/\p{L}{2,}/u.test(text) && !/^[×…·]+$/.test(text)) {
			warnings++;
			console.warn(`${file}: possible hardcoded text "${text.slice(0, 60)}"`);
		}
	}
}
console.log(
	warnings === 0
		? "No hardcoded UI text found"
		: `${warnings} possible hardcoded UI text(s) (warning only)`,
);
