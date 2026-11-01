// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run i18n:status [--packs i18n-packs]` (PLAN.md step 9.39): every pack of the repository
// validated against the English dictionaries (the same check the app makes when it loads a pack)
// with how much of it is translated. Exit code 1 when a pack would be rejected.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NAMESPACES } from "#lib/i18n/index.js";
import { packCodes } from "./i18n-packs-dir.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import { completeness } from "#lib/server/i18n/pack-tools.js";
import { describeProblem, validatePack, type Dictionaries } from "#lib/server/i18n/packs.js";

const args = process.argv.slice(2);
const at = args.indexOf("--packs");
const root = resolve(at === -1 ? "i18n-packs" : (args[at + 1] ?? "i18n-packs"));
const verbose = args.includes("--verbose");
const english = await builtInDictionaries("en");
const codes = packCodes(root);
let rejected = 0;
for (const code of codes) {
	const dir = join(root, code);
	const pack = validatePack(code, dir, english);
	const own: Partial<Dictionaries> = {};
	for (const ns of NAMESPACES) {
		const file = join(dir, `${ns}.json`);
		if (existsSync(file)) {
			own[ns] = JSON.parse(readFileSync(file, "utf8")) as Dictionaries[typeof ns];
		}
	}
	const { total, translated } = completeness(english, own);
	const errors = pack.problems.filter((p) => p.severity === "error").length;
	const warnings = pack.problems.length - errors;
	console.log(
		`${code.padEnd(6)} ${pack.valid ? "valid  " : "REJECTED"} ${String(Math.round((100 * translated) / total)).padStart(3)} %  ${pack.meta?.nativeName ?? "?"}  (${errors} error(s), ${warnings} warning(s))`,
	);
	if (!pack.valid) {
		rejected++;
	}
	if (verbose || !pack.valid) {
		for (const p of pack.problems
			.filter((x) => verbose || x.severity === "error")
			.slice(0, 20)) {
			console.log(`         ${describeProblem(code, p)}`);
		}
	}
}
console.log(`${codes.length} pack(s), ${rejected} rejected`);
process.exit(rejected > 0 ? 1 : 0);
