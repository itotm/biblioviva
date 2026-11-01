// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run config:check [path/to/config.json] [--explain a.b.c]` — checks the configuration folder
// (the given config.json with the fragments of its folder, or CONFIG_DIR) without starting the
// server, as the import of an archive checks one: the schema and its cross-checks, the templates,
// the pictograms, the reports and the language packs (a pack that is not valid is a warning here,
// since the server skips it and starts). `--explain` prints which file defines a key (PLAN.md §3.6).
import { dirname } from "node:path";
import { originOf } from "#lib/server/config/folder.js";
import { env } from "#lib/server/env.js";
import { checkFolder } from "#lib/server/services/config-check.js";

const args = process.argv.slice(2);
const explainAt = args.indexOf("--explain");
const explain = explainAt === -1 ? undefined : args[explainAt + 1];
const file = args.find((a, i) => !a.startsWith("--") && (explainAt === -1 || i !== explainAt + 1));
const dir = file ? dirname(file) : env().CONFIG_DIR;
const { loaded, issues, ok } = await checkFolder(dir, {
	...(file ? { base: file } : {}),
	packsAsWarnings: true,
});
if (loaded?.source === "example") {
	console.warn(`No config.json in ${dir}; validated the shipped example folder instead.`);
}
for (const i of issues) {
	const line = `${i.level === "error" ? "error  " : "warning"}  ${i.path}${i.file ? ` (${i.file})` : ""}: ${i.message}`;
	if (i.level === "error") {
		console.error(line);
	} else {
		console.warn(line);
	}
}
if (!ok || !loaded) {
	console.error(`${file ?? dir}: the configuration is not valid`);
	process.exit(1);
}
if (explain) {
	console.log(`${explain}: defined in ${originOf(loaded.origins, explain) ?? "(nowhere)"}`);
}
const warnings = issues.filter((i) => i.level === "warning").length;
console.log(`OK: ${loaded.path} is valid (${loaded.files.length} file(s), ${warnings} warning(s))`);
for (const f of loaded.files) {
	console.log(`  ${f}`);
}
