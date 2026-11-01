// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run ui:audit` — the factoring rule of PLAN.md step 1.15 (owner decision): a set
// of at least 3 Tailwind classes repeated on 2 or more elements, or a set of exactly 2 classes
// repeated 4 or more times, must live in one Svelte component (or one CSS utility) instead of being
// copied around. Static `class="…"` attributes of every `.svelte` file under src/ are compared as
// sorted sets; the script lists the offenders with their files and fails when any exists.
// Class attributes with expressions (`class="a {b}"`) count with their static part (9.13, round 2):
// the variable part is what a component would receive as a prop, the fixed classes around it are
// the shared look. `class:` / `class={…}` bindings stay out of scope.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";
const THRESHOLDS = [
	{ minClasses: 3, minOccurrences: 2 },
	{ minClasses: 2, maxClasses: 2, minOccurrences: 4 },
];
/** Sets that are the single definition of a shared look (the component that owns them). */
const ALLOW = new Set<string>();

function walk(dir: string, out: string[]): void {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			// `src/routes/dev` is the style guide: it shows raw Skeleton primitives on purpose
			if (
				name !== "node_modules" &&
				name !== "vendor" &&
				path !== join(ROOT, "routes", "dev")
			) {
				walk(path, out);
			}
		} else if (name.endsWith(".svelte")) {
			out.push(path);
		}
	}
}

interface Occurrence {
	file: string;
	tag: string;
}

const files: string[] = [];
walk(ROOT, files);
const sets = new Map<string, Occurrence[]>();
const attribute = /<([a-zA-Z][\w.:-]*)\b[^>]*?\sclass="([^"]*)"/gs;
for (const file of files) {
	const source = readFileSync(file, "utf8");
	for (const match of source.matchAll(attribute)) {
		// the static part: expressions (`{…}`) removed, with any class glued to one
		const fixed = (match[2] ?? "").replace(/\{[^}]*\}/g, " ");
		const classes = [
			...new Set(fixed.split(/\s+/).filter((c) => c && !c.includes("{") && !c.includes("}"))),
		].sort();
		if (classes.length < 2) {
			continue;
		}
		const key = classes.join(" ");
		const list = sets.get(key) ?? [];
		list.push({ file: relative(".", file), tag: match[1] ?? "?" });
		sets.set(key, list);
	}
}

const offenders = [...sets.entries()]
	.filter(([key, list]) => {
		if (ALLOW.has(key)) {
			return false;
		}
		const size = key.split(" ").length;
		return THRESHOLDS.some(
			(t) =>
				size >= t.minClasses &&
				(t.maxClasses === undefined || size <= t.maxClasses) &&
				list.length >= t.minOccurrences,
		);
	})
	.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

const verbose = process.argv.includes("--verbose");
for (const [key, list] of offenders) {
	const byFile = new Map<string, number>();
	for (const o of list) {
		byFile.set(o.file, (byFile.get(o.file) ?? 0) + 1);
	}
	const tags = [...new Set(list.map((o) => o.tag))].join(",");
	console.log(`${String(list.length).padStart(3)}×  <${tags}>  ${key}`);
	if (verbose) {
		for (const [file, n] of byFile) {
			console.log(`       ${n}× ${file}`);
		}
	}
}
console.log(
	`${files.length} files, ${sets.size} distinct class sets, ${offenders.length} above the thresholds (3 classes × 2, 2 classes × 4)`,
);
process.exit(offenders.length > 0 ? 1 : 0);
