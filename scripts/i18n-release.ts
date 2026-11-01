// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run i18n:release [--out dist/i18n] [--packs i18n-packs]` (PLAN.md step 9.39): the files a
// release carries for the language packs: `biblioviva-i18n-<code>-<version>.zip` for every valid
// pack of the repository (the layout the upload of the admin UI reads) and
// `biblioviva-i18n-index.json`, the list the app reads to offer them (name, how much is translated,
// whether a native speaker has read it, size and SHA-256). A pack that would be rejected stops the
// build.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NAMESPACES } from "#lib/i18n/index.js";
import { packCodes } from "./i18n-packs-dir.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import {
	buildPackZip,
	completeness,
	sha256,
	type PackIndexEntry,
} from "#lib/server/i18n/pack-tools.js";
import { describeProblem, validatePack, type Dictionaries } from "#lib/server/i18n/packs.js";
import { APP_VERSION } from "#lib/shared/version.js";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const root = resolve(flag("packs", "i18n-packs"));
const out = resolve(flag("out", "dist/i18n"));
const version = flag("version", APP_VERSION);
const english = await builtInDictionaries("en");
mkdirSync(out, { recursive: true });
const entries: PackIndexEntry[] = [];
let rejected = 0;
const codes = packCodes(root);
for (const code of codes) {
	const dir = join(root, code);
	const pack = validatePack(code, dir, english);
	if (!pack.valid || !pack.meta) {
		rejected++;
		for (const p of pack.problems.filter((x) => x.severity === "error").slice(0, 10)) {
			console.error(describeProblem(code, p));
		}
		continue;
	}
	const files: Record<string, string> = {
		"pack.json": `${JSON.stringify({ ...pack.meta, appVersion: version }, null, "\t")}\n`,
	};
	const own: Partial<Dictionaries> = {};
	for (const ns of NAMESPACES) {
		const text = readFileSync(join(dir, `${ns}.json`), "utf8");
		files[`${ns}.json`] = text;
		own[ns] = JSON.parse(text) as Dictionaries[typeof ns];
	}
	const zip = buildPackZip(code, files);
	const file = `biblioviva-i18n-${code}-${version}.zip`;
	writeFileSync(join(out, file), zip);
	const { total, translated } = completeness(english, own);
	entries.push({
		code,
		name: pack.meta.name,
		nativeName: pack.meta.nativeName,
		translation: pack.meta.translation ?? "reviewed",
		translated,
		total,
		file,
		bytes: zip.byteLength,
		sha256: await sha256(zip),
	});
}
writeFileSync(
	join(out, "biblioviva-i18n-index.json"),
	`${JSON.stringify({ version, packs: entries }, null, "\t")}\n`,
);
console.log(`${entries.length} pack(s) in ${out}${rejected > 0 ? `, ${rejected} rejected` : ""}`);
process.exit(rejected > 0 ? 1 : 0);
