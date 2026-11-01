// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run i18n:check <folder>` — validates a language pack folder (step 1.14) against the
// built-in English dictionaries with the same code the app uses at startup, and prints every
// problem. Exit code 1 when the pack would be rejected.
import { basename, resolve } from "node:path";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import { describeProblem, validatePack } from "#lib/server/i18n/packs.js";

const folder = process.argv[2];
if (!folder) {
	console.error("usage: bun run i18n:check <CONFIG_DIR/i18n/<code>>");
	process.exit(2);
}
const dir = resolve(folder);
const code = basename(dir);
const pack = validatePack(code, dir, await builtInDictionaries("en"));
for (const p of pack.problems) {
	console.log(describeProblem(code, p));
}
const errors = pack.problems.filter((p) => p.severity === "error").length;
const warnings = pack.problems.length - errors;
if (pack.valid) {
	console.log(
		`pack "${code}" (${pack.meta?.nativeName ?? "?"}) is valid: ${warnings} warning(s), English fills the gaps`,
	);
	process.exit(0);
}
console.log(`pack "${code}" would be rejected: ${errors} error(s), ${warnings} warning(s)`);
process.exit(1);
