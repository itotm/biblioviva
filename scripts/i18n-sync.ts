// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run i18n:sync <git-ref> [--drop] [--packs i18n-packs]` (PLAN.md step 9.39): the English messages
// added, changed or removed since `<git-ref>` (the last release's tag), and with `--drop` those changed
// or removed taken out of every pack, so that `bun run i18n:work split <code> <workdir> --missing`
// cuts exactly what has to be translated again (new and changed messages) and `merge` puts it back.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NAMESPACES } from "#lib/i18n/index.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import { changedKeys, flatten, unflatten } from "#lib/server/i18n/pack-tools.js";
import type { Dictionaries } from "#lib/server/i18n/packs.js";
import { packCodes } from "./i18n-packs-dir.js";

const args = process.argv.slice(2);
const ref = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--packs");
if (!ref) {
	console.error("usage: bun run i18n:sync <git-ref> [--drop] [--packs i18n-packs]");
	process.exit(2);
}
const at = args.indexOf("--packs");
const root = resolve(at === -1 ? "i18n-packs" : (args[at + 1] ?? "i18n-packs"));
const before = {} as Dictionaries;
for (const namespace of NAMESPACES) {
	const shown = Bun.spawnSync(["git", "show", `${ref}:src/lib/i18n/en/${namespace}.json`]);
	// a namespace that did not exist yet is all new
	before[namespace] =
		shown.exitCode === 0
			? (JSON.parse(shown.stdout.toString()) as Dictionaries[typeof namespace])
			: {};
}
const after = await builtInDictionaries("en");
const { added, changed, removed } = changedKeys(before, after);
console.log(
	`since ${ref}: ${added.length} added, ${changed.length} changed, ${removed.length} removed English message(s)`,
);
for (const line of [
	...added.map((k) => `+ ${k}`),
	...changed.map((k) => `~ ${k}`),
	...removed.map((k) => `- ${k}`),
]) {
	console.log(line);
}
if (args.includes("--drop")) {
	const drop = new Set([...changed, ...removed]);
	for (const code of packCodes(root)) {
		let dropped = 0;
		for (const namespace of NAMESPACES) {
			const file = join(root, code, `${namespace}.json`);
			if (!existsSync(file)) {
				continue;
			}
			const flat = flatten(
				JSON.parse(readFileSync(file, "utf8")) as Dictionaries[typeof namespace],
			);
			const kept = Object.fromEntries(
				Object.entries(flat).filter(([key]) => !drop.has(`${namespace}:${key}`)),
			);
			dropped += Object.keys(flat).length - Object.keys(kept).length;
			writeFileSync(file, `${JSON.stringify(unflatten(kept), null, "\t")}\n`);
		}
		console.log(`${code}: ${dropped} message(s) dropped, to translate again`);
	}
}
