// SPDX-License-Identifier: GPL-3.0-or-later
// The tools behind `i18n-packs/` (PLAN.md step 9.39): the English dictionaries cut into chunks a
// translator takes one at a time, the translated chunks checked and put back together into a pack,
// the completeness of a pack, and the zip and the index a release carries. Pure functions; the
// scripts `i18n:work`, `i18n:status` and `i18n:release` read and write the files.
import { strToU8, zipSync } from "fflate";
import { NAMESPACES, type Namespace } from "#lib/i18n/index.js";
import { compareMessage, type Dictionaries, type Dictionary, type PackProblem } from "./packs.js";

/** One message of a chunk: the English text, the Italian original (to settle an ambiguity). */
export interface ChunkEntry {
	en: string;
	it: string;
}

/** A piece of one namespace, with flat keys (`blocks.stocks.drawing`), for one translator run. */
export interface Chunk {
	/** `admin-2`: the namespace and the number of the piece. */
	id: string;
	namespace: Namespace;
	entries: Record<string, ChunkEntry>;
}

function isRecord(value: unknown): value is Dictionary {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The messages of a dictionary as `path → text`, in the order of the file. */
export function flatten(dictionary: Dictionary, prefix = ""): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(dictionary)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			out[path] = value;
		} else if (isRecord(value)) {
			Object.assign(out, flatten(value, path));
		}
	}
	return out;
}

/** The inverse of `flatten`: `path → text` back to nested objects, in the order given. */
export function unflatten(flat: Record<string, string>): Dictionary {
	const root: Dictionary = {};
	for (const [path, text] of Object.entries(flat)) {
		const parts = path.split(".");
		let node = root;
		for (const part of parts.slice(0, -1)) {
			const next = node[part];
			if (isRecord(next)) {
				node = next;
			} else {
				const created: Dictionary = {};
				node[part] = created;
				node = created;
			}
		}
		node[parts[parts.length - 1] ?? ""] = text;
	}
	return root;
}

/**
 * Every namespace cut into chunks of at most `size` messages, English with the Italian beside it;
 * `only` (`namespace:key`) keeps just those messages, to translate what a pack still lacks.
 */
export function splitChunks(
	english: Dictionaries,
	italian: Dictionaries,
	size = 200,
	only?: ReadonlySet<string>,
): Chunk[] {
	const chunks: Chunk[] = [];
	for (const namespace of NAMESPACES) {
		const en = flatten(english[namespace]);
		const it = flatten(italian[namespace]);
		const keys = Object.keys(en).filter((k) => !only || only.has(`${namespace}:${k}`));
		const pieces = Math.max(1, Math.ceil(keys.length / size));
		// pieces of equal size rather than a short last one
		const each = Math.ceil(keys.length / pieces);
		for (let i = 0; i < pieces; i++) {
			const entries: Record<string, ChunkEntry> = {};
			for (const key of keys.slice(i * each, (i + 1) * each)) {
				entries[key] = { en: en[key] ?? "", it: it[key] ?? en[key] ?? "" };
			}
			if (Object.keys(entries).length > 0) {
				chunks.push({ id: `${namespace}-${i + 1}`, namespace, entries });
			}
		}
	}
	return chunks;
}

export interface ChunkReport {
	/** What makes the chunk unusable: a missing key, a lost placeholder, a missing plural form. */
	problems: PackProblem[];
	/** What deserves a second look: a text left in English, one much longer than the English. */
	notes: string[];
}

/** The scripts a language is written in (besides Latin brand names and symbols, always fine). */
const SCRIPTS: Record<string, RegExp> = {
	cyrillic: /[\u0400-\u04FF]/u,
	greek: /[\u0370-\u03FF\u1F00-\u1FFF]/u,
	han: /[\u4E00-\u9FFF]/u,
	kana: /[\u3040-\u30FF]/u,
	hangul: /[\uAC00-\uD7AF\u1100-\u11FF]/u,
	arabic: /[\u0600-\u06FF]/u,
	hebrew: /[\u0590-\u05FF]/u,
};
const OWN_SCRIPTS: Record<string, string[]> = {
	ru: ["cyrillic"],
	uk: ["cyrillic"],
	el: ["greek"],
	zh: ["han"],
	ja: ["han", "kana"],
	ko: ["hangul", "han"],
};

/**
 * The scripts that have no place in a text of this language: a Cyrillic letter in a Swedish word or
 * a Greek one in a Russian word is a slip of the translator, not a choice.
 */
export function foreignScripts(locale: string, text: string): string[] {
	const own = OWN_SCRIPTS[locale.split("-")[0] ?? ""] ?? [];
	return Object.entries(SCRIPTS)
		.filter(([name, pattern]) => !own.includes(name) && pattern.test(text))
		.map(([name]) => name);
}

/** A text is "left in English" when it equals the English one and says more than a name or a code. */
function leftInEnglish(en: string, text: string): boolean {
	const words = en.replace(/\{\{[^}]*\}\}/g, "").trim();
	return text === en && /[a-z]{3,} [a-z]{2,}/i.test(words);
}

/** The translated chunk against the English one: the keys, the placeholders, the plural forms. */
export function checkChunk(chunk: Chunk, translated: unknown, locale: string): ChunkReport {
	const problems: PackProblem[] = [];
	const notes: string[] = [];
	const file = `${chunk.id}.json`;
	if (!isRecord(translated)) {
		problems.push({ severity: "error", file, key: null, kind: "bad_json" });
		return { problems, notes };
	}
	for (const [key, entry] of Object.entries(chunk.entries)) {
		if (!(key in translated)) {
			problems.push({ severity: "error", file, key, kind: "missing_key" });
			continue;
		}
		const value = translated[key];
		compareMessage(file, key, entry.en, value, problems, locale);
		if (typeof value === "string") {
			const foreign = foreignScripts(locale, value);
			if (foreign.length > 0) {
				problems.push({
					severity: "error",
					file,
					key,
					kind: "wrong_script",
					detail: `${foreign.join(", ")} letters in a ${locale} text`,
				});
			}
			if (value.trim() === "") {
				problems.push({
					severity: "error",
					file,
					key,
					kind: "not_a_string",
					detail: "empty",
				});
			} else if (leftInEnglish(entry.en, value)) {
				notes.push(`${key}: left in English`);
			} else if (value.length > 24 && value.length > entry.en.length * 2.5) {
				notes.push(
					`${key}: ${Math.round(value.length / entry.en.length)}× longer than English`,
				);
			}
		}
	}
	for (const key of Object.keys(translated)) {
		if (!(key in chunk.entries)) {
			problems.push({ severity: "error", file, key, kind: "extra_key" });
		}
	}
	return { problems, notes };
}

/**
 * The dictionaries of a pack from its translated chunks (`chunk id → flat translations`), in the
 * order of the English files, laid over `base` (what the pack already holds); a message neither
 * delivered nor in `base` is left out (the pack is then incomplete and English fills the gaps).
 */
export function mergeChunks(
	english: Dictionaries,
	delivered: Record<string, Record<string, string>>,
	base: Partial<Dictionaries> = {},
): Dictionaries {
	const out = {} as Dictionaries;
	for (const namespace of NAMESPACES) {
		const flat: Record<string, string> = {};
		const taken: Record<string, string> = flatten(base[namespace] ?? {});
		for (const [id, messages] of Object.entries(delivered)) {
			if (id.replace(/-\d+$/, "") === namespace) {
				Object.assign(taken, messages);
			}
		}
		for (const key of Object.keys(flatten(english[namespace]))) {
			const text = taken[key];
			if (text !== undefined) {
				flat[key] = text;
			}
		}
		out[namespace] = unflatten(flat);
	}
	return out;
}

/** How many messages of the English dictionaries a pack translates. */
export function completeness(
	english: Dictionaries,
	pack: Partial<Dictionaries>,
): { total: number; translated: number } {
	let total = 0;
	let translated = 0;
	for (const namespace of NAMESPACES) {
		const en = flatten(english[namespace]);
		const own = flatten(pack[namespace] ?? {});
		for (const key of Object.keys(en)) {
			total++;
			if (own[key] !== undefined) {
				translated++;
			}
		}
	}
	return { total, translated };
}

/** The `namespace:key` of every English message a pack does not hold. */
export function missingKeys(english: Dictionaries, pack: Partial<Dictionaries>): Set<string> {
	const missing = new Set<string>();
	for (const namespace of NAMESPACES) {
		const own = flatten(pack[namespace] ?? {});
		for (const key of Object.keys(flatten(english[namespace]))) {
			if (own[key] === undefined) {
				missing.add(`${namespace}:${key}`);
			}
		}
	}
	return missing;
}

/** The messages whose English text differs between two versions of the dictionaries (or is new). */
export function changedKeys(
	before: Dictionaries,
	after: Dictionaries,
): { added: string[]; changed: string[]; removed: string[] } {
	const added: string[] = [];
	const changed: string[] = [];
	const removed: string[] = [];
	for (const namespace of NAMESPACES) {
		const was = flatten(before[namespace] ?? {});
		const now = flatten(after[namespace] ?? {});
		for (const [key, text] of Object.entries(now)) {
			if (!(key in was)) {
				added.push(`${namespace}:${key}`);
			} else if (was[key] !== text) {
				changed.push(`${namespace}:${key}`);
			}
		}
		for (const key of Object.keys(was)) {
			if (!(key in now)) {
				removed.push(`${namespace}:${key}`);
			}
		}
	}
	return { added, changed, removed };
}

/** What the index of a release says of one pack. */
export interface PackIndexEntry {
	code: string;
	name: string;
	nativeName: string;
	/** `machine`: translated by a program, not read by a native speaker; `reviewed` otherwise. */
	translation: "machine" | "reviewed";
	/** Messages translated out of all of them. */
	translated: number;
	total: number;
	/** The file of the zip in the release and its size and SHA-256. */
	file: string;
	bytes: number;
	sha256: string;
}

/** One pack folder as a zip with the folder inside, the layout the upload of the admin UI reads. */
export function buildPackZip(code: string, files: Record<string, string>): Uint8Array {
	const entries: Record<string, Uint8Array> = {};
	for (const name of Object.keys(files).sort()) {
		entries[`${code}/${name}`] = strToU8(files[name] ?? "");
	}
	return zipSync(entries, { level: 9 });
}

/** The hex SHA-256 of some bytes. */
export async function sha256(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes.slice());
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
