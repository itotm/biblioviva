// SPDX-License-Identifier: GPL-3.0-or-later
// Language packs (PLAN.md step 1.14, Q81): a folder `CONFIG_DIR/i18n/<code>/` with `pack.json` and
// the same namespace files as the built-in English dictionaries. Packs are validated against
// English before they are offered: a pack with errors is skipped with one warning per problem;
// a pack with gaps is served with English filling the missing keys (sveltekit-i18n's fallback).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";
import { LOCALES, NAMESPACES, type Namespace } from "#lib/i18n/index.js";
import { APP_VERSION } from "#lib/shared/version.js";
import { LOCALE_CODE } from "#lib/shared/input-schemas.js";
import { neededPluralCategories, pluralExpressions, pluralProblems } from "#lib/shared/plural.js";

export const PACKS_DIR = "i18n";
export const PACK_FILE = "pack.json";
export { LOCALE_CODE };

export type Dictionary = Record<string, unknown>;
export type Dictionaries = Record<Namespace, Dictionary>;

export const packMetaSchema = v.object({
	/** Name in English ("German"). */
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
	/** Name in the language itself ("Deutsch"), shown in the pickers. */
	nativeName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
	/** The app version the pack was written for (informative). */
	appVersion: v.optional(v.string(), ""),
	/** `machine` for a translation made by a program and not read by a native speaker (informative). */
	translation: v.optional(v.picklist(["machine", "reviewed"])),
});
export type PackMeta = v.InferOutput<typeof packMetaSchema>;

export interface PackProblem {
	severity: "error" | "warning";
	file: string;
	key: string | null;
	kind:
		| "bad_code"
		| "missing_pack_file"
		| "bad_pack_file"
		| "missing_file"
		| "bad_json"
		| "missing_key"
		| "extra_key"
		| "not_a_string"
		| "placeholders"
		| "plural_forms"
		| "wrong_script";
	detail?: string;
}

export interface PackInfo {
	code: string;
	dir: string;
	meta: PackMeta | null;
	valid: boolean;
	problems: PackProblem[];
	/** Present only for valid packs. */
	dictionaries: Dictionaries | null;
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * The names of the placeholders of a message, sorted and without repeats: a plural selector may
 * hold the number inside each option (`{{count:plural; one:{{count}} book; …}}`) in one language and
 * once outside it in another, so how many times a name appears is the translator's.
 */
export function placeholders(value: string): string {
	return [...new Set([...value.matchAll(PLACEHOLDER)].map((m) => m[1] ?? ""))].sort().join(",");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Compares one message of a pack with the English one: its type, its placeholders, its plural forms. */
export function compareMessage(
	file: string,
	key: string,
	reference: string,
	value: unknown,
	problems: PackProblem[],
	locale = "en",
): void {
	if (typeof value !== "string") {
		problems.push({ severity: "error", file, key, kind: "not_a_string" });
	} else if (placeholders(value) !== placeholders(reference)) {
		problems.push({
			severity: "error",
			file,
			key,
			kind: "placeholders",
			detail: `expected {{${placeholders(reference).split(",").join("}}, {{")}}}`,
		});
	} else if (pluralExpressions(reference).length > 0) {
		// the words that agree with a number need every form the language uses (an absent form
		// renders as an empty text); a message without any selector is only a disagreement
		const needed = neededPluralCategories(locale).join(", ");
		if (pluralExpressions(value).length === 0) {
			problems.push({
				severity: "warning",
				file,
				key,
				kind: "plural_forms",
				detail: `no plural selector; ${locale} uses ${needed}`,
			});
		}
		for (const issue of pluralProblems(value, locale)) {
			problems.push({
				severity: issue.missing.length > 0 ? "error" : "warning",
				file,
				key,
				kind: "plural_forms",
				detail:
					issue.missing.length > 0
						? `missing ${issue.missing.join(", ")}; ${locale} uses ${needed}`
						: `${issue.unused.join(", ")} not used by ${locale}`,
			});
		}
	}
}

/** Compares one namespace of the pack with the English one, key by key (recursive). */
export function compareDictionary(
	file: string,
	reference: Dictionary,
	candidate: Dictionary,
	problems: PackProblem[],
	prefix = "",
	locale = "en",
): void {
	for (const [key, refValue] of Object.entries(reference)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (!(key in candidate)) {
			problems.push({ severity: "warning", file, key: path, kind: "missing_key" });
			continue;
		}
		const value = candidate[key];
		if (isRecord(refValue)) {
			if (!isRecord(value)) {
				problems.push({ severity: "error", file, key: path, kind: "not_a_string" });
				continue;
			}
			compareDictionary(file, refValue, value, problems, path, locale);
		} else if (typeof refValue === "string") {
			compareMessage(file, path, refValue, value, problems, locale);
		}
	}
	for (const key of Object.keys(candidate)) {
		if (!(key in reference)) {
			problems.push({
				severity: "warning",
				file,
				key: prefix ? `${prefix}.${key}` : key,
				kind: "extra_key",
			});
		}
	}
}

/** Validates one pack folder against the English dictionaries. */
export function validatePack(code: string, dir: string, english: Dictionaries): PackInfo {
	const problems: PackProblem[] = [];
	let meta: PackMeta | null = null;
	if (!LOCALE_CODE.test(code) || (LOCALES as readonly string[]).includes(code)) {
		problems.push({ severity: "error", file: dir, key: null, kind: "bad_code" });
	}
	const metaPath = join(dir, PACK_FILE);
	if (!existsSync(metaPath)) {
		problems.push({ severity: "error", file: PACK_FILE, key: null, kind: "missing_pack_file" });
	} else {
		try {
			meta = v.parse(packMetaSchema, JSON.parse(readFileSync(metaPath, "utf8")));
		} catch (e) {
			problems.push({
				severity: "error",
				file: PACK_FILE,
				key: null,
				kind: "bad_pack_file",
				detail: e instanceof Error ? e.message : String(e),
			});
		}
	}
	const dictionaries = {} as Dictionaries;
	for (const ns of NAMESPACES) {
		const file = `${ns}.json`;
		const path = join(dir, file);
		if (!existsSync(path)) {
			problems.push({ severity: "error", file, key: null, kind: "missing_file" });
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(path, "utf8"));
		} catch (e) {
			problems.push({
				severity: "error",
				file,
				key: null,
				kind: "bad_json",
				detail: e instanceof Error ? e.message : String(e),
			});
			continue;
		}
		if (!isRecord(parsed)) {
			problems.push({ severity: "error", file, key: null, kind: "bad_json" });
			continue;
		}
		compareDictionary(file, english[ns], parsed, problems, "", code);
		dictionaries[ns] = parsed;
	}
	const valid = problems.every((p) => p.severity !== "error");
	return { code, dir, meta, valid, problems, dictionaries: valid ? dictionaries : null };
}

/** Every folder under `CONFIG_DIR/i18n`, validated; sorted by code. */
export function discoverPacks(configDir: string, english: Dictionaries): PackInfo[] {
	const root = join(configDir, PACKS_DIR);
	if (!existsSync(root)) {
		return [];
	}
	return (
		readdirSync(root, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			// the built-in languages written there as examples are not packs
			.filter((code) => !(LOCALES as readonly string[]).includes(code))
			.sort()
			.map((code) => validatePack(code, join(root, code), english))
	);
}

/** One readable line per problem, without any personal data (paths and keys only). */
export function describeProblem(code: string, p: PackProblem): string {
	const where = p.key ? `${p.file} › ${p.key}` : p.file;
	return `[i18n] pack "${code}": ${p.kind.replace(/_/g, " ")} at ${where}${p.detail ? ` (${p.detail})` : ""}`;
}

/**
 * Writes the built-in dictionaries of `locale` as a pack under `CONFIG_DIR/i18n/<locale>/`
 * (the example to clone), leaving existing files alone. Returns the files written.
 */
export function writeBuiltInPack(
	configDir: string,
	locale: string,
	dictionaries: Dictionaries,
	meta: PackMeta,
): string[] {
	const dir = join(configDir, PACKS_DIR, locale);
	mkdirSync(dir, { recursive: true });
	const written: string[] = [];
	const metaPath = join(dir, PACK_FILE);
	if (!existsSync(metaPath)) {
		writeFileSync(
			metaPath,
			`${JSON.stringify({ ...meta, appVersion: APP_VERSION }, null, "\t")}\n`,
		);
		written.push(PACK_FILE);
	}
	for (const ns of NAMESPACES) {
		const path = join(dir, `${ns}.json`);
		if (!existsSync(path)) {
			writeFileSync(path, `${JSON.stringify(dictionaries[ns], null, "\t")}\n`);
			written.push(`${ns}.json`);
		}
	}
	return written;
}
