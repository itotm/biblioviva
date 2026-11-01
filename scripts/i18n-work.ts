// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run i18n:work split <code> <workdir>` and `bun run i18n:work merge <code> <workdir>` (PLAN.md
// step 9.39): the English dictionaries cut into chunks of about 200 messages for a translator
// (`<workdir>/<code>/in/<id>.json`: `key → { en, it }`), and the translated chunks
// (`<workdir>/<code>/out/<id>.json`: `key → text`) checked and put back together into the pack
// `i18n-packs/<code>/`. A chunk with an error (a missing key, a lost placeholder, a missing plural
// form) is left out and listed in `<workdir>/<code>/redo.txt`; the others are merged, so a pack can
// grow chunk by chunk. `--name` and `--native` name a new pack, `--packs` changes the folder.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NAMESPACES } from "#lib/i18n/index.js";
import { builtInDictionaries } from "#lib/server/i18n/registry.js";
import {
	checkChunk,
	completeness,
	mergeChunks,
	missingKeys,
	splitChunks,
} from "#lib/server/i18n/pack-tools.js";
import type { Chunk } from "#lib/server/i18n/pack-tools.js";
import { describeProblem, type Dictionaries } from "#lib/server/i18n/packs.js";
import { APP_VERSION } from "#lib/shared/version.js";

const args = process.argv.slice(2);
const flag = (name: string, fallback = ""): string => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const [command, code, work] = positional;
if ((command !== "split" && command !== "merge") || !code || !work) {
	console.error(
		"usage: bun run i18n:work <split|merge> <code> <workdir> [--size 200] [--packs i18n-packs] [--name English --native Native]",
	);
	process.exit(2);
}
const english = await builtInDictionaries("en");
const italian = await builtInDictionaries("it");
const base = join(resolve(work), code);
const packDirOf = (): string => join(resolve(flag("packs", "i18n-packs")), code);

/** The dictionaries a pack folder holds now (nothing for a pack not started). */
function existingPack(): Partial<Dictionaries> {
	const own: Partial<Dictionaries> = {};
	for (const namespace of NAMESPACES) {
		const file = join(packDirOf(), `${namespace}.json`);
		if (existsSync(file)) {
			own[namespace] = JSON.parse(
				readFileSync(file, "utf8"),
			) as Dictionaries[typeof namespace];
		}
	}
	return own;
}

if (command === "split") {
	const size = Number(flag("size", "200"));
	mkdirSync(join(base, "in"), { recursive: true });
	mkdirSync(join(base, "out"), { recursive: true });
	// `--missing` cuts only the messages the pack does not hold yet (what a release added or what
	// was dropped as changed); the chunks are kept in `chunks.json` so a later merge reads the same
	const only = args.includes("--missing") ? missingKeys(english, existingPack()) : undefined;
	const chunks = splitChunks(english, italian, size, only);
	writeFileSync(join(base, "chunks.json"), JSON.stringify(chunks));
	for (const chunk of chunks) {
		writeFileSync(
			join(base, "in", `${chunk.id}.json`),
			JSON.stringify(chunk.entries, null, "\t"),
		);
	}
	writeFileSync(join(base, "chunks.txt"), `${chunks.map((c) => c.id).join("\n")}\n`);
	console.log(`${chunks.length} chunks in ${join(base, "in")}`);
	process.exit(0);
}

const chunksFile = join(base, "chunks.json");
const chunks: Chunk[] = existsSync(chunksFile)
	? (JSON.parse(readFileSync(chunksFile, "utf8")) as Chunk[])
	: splitChunks(english, italian, Number(flag("size", "200")));
const byId = new Map<string, Chunk>(chunks.map((c) => [c.id, c]));
const delivered: Record<string, Record<string, string>> = {};
const redo: string[] = [];
const outDir = join(base, "out");
for (const file of existsSync(outDir) ? readdirSync(outDir).sort() : []) {
	const id = file.replace(/\.json$/, "");
	const chunk = byId.get(id);
	if (!chunk || !file.endsWith(".json")) {
		continue;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(join(outDir, file), "utf8"));
	} catch {
		parsed = null;
	}
	const report = checkChunk(chunk, parsed, code);
	const errors = report.problems.filter((p) => p.severity === "error");
	for (const p of report.problems) {
		console.log(`${p.severity === "error" ? "ERROR" : "warn "} ${describeProblem(code, p)}`);
	}
	for (const note of report.notes) {
		console.log(`note  ${id} › ${note}`);
	}
	if (errors.length > 0) {
		redo.push(id);
	} else {
		delivered[id] = parsed as Record<string, string>;
	}
}
for (const id of byId.keys()) {
	if (!(id in delivered) && !redo.includes(id)) {
		redo.push(id);
	}
}
const packDir = packDirOf();
mkdirSync(packDir, { recursive: true });
const merged = mergeChunks(english, delivered, existingPack());
for (const namespace of NAMESPACES) {
	writeFileSync(
		join(packDir, `${namespace}.json`),
		`${JSON.stringify(merged[namespace], null, "\t")}\n`,
	);
}
const metaPath = join(packDir, "pack.json");
if (!existsSync(metaPath)) {
	const name = flag("name", code);
	writeFileSync(
		metaPath,
		`${JSON.stringify({ name, nativeName: flag("native", name), appVersion: APP_VERSION, translation: "machine" }, null, "\t")}\n`,
	);
}
writeFileSync(join(base, "redo.txt"), redo.length > 0 ? `${redo.join("\n")}\n` : "");
const { total, translated } = completeness(english, merged);
console.log(
	`${code}: ${translated} of ${total} messages merged (${Math.round((100 * translated) / total)} %), ${redo.length} chunk(s) to do again${redo.length > 0 ? `: ${redo.join(", ")}` : ""}`,
);
process.exit(redo.length > 0 ? 1 : 0);
