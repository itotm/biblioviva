// SPDX-License-Identifier: GPL-3.0-or-later
// The texts of the interface that the steps of the shot list look for (a button, a label, a
// message), read from the dictionaries of `src/lib/i18n/<lang>/` so that every picture is taken
// in every language of the site and a renamed text is followed, never typed twice. A key is
// `<file>.<path>`, as in the application (`common.actions.close`); a key that does not exist fails.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Translate = (key: string, params?: Record<string, string | number>) => string;

const cache = new Map<string, Map<string, string>>();

function flatten(value: unknown, prefix: string, into: Map<string, string>): void {
	if (typeof value === "string") {
		into.set(prefix, value);
	} else if (value && typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			flatten(child, `${prefix}.${key}`, into);
		}
	}
}

function dictionary(lang: string): Map<string, string> {
	let found = cache.get(lang);
	if (!found) {
		found = new Map();
		const dir = join("src", "lib", "i18n", lang);
		for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
			const json: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
			flatten(json, file.replace(/\.json$/, ""), found);
		}
		cache.set(lang, found);
	}
	return found;
}

/** Fills `{{name}}` and the plural form `{{name:plural; one:text; other:text;}}` of a dictionary text. */
export function fill(text: string, params: Record<string, string | number> = {}): string {
	return text.replace(
		/\{\{\s*(\w+)\s*(?::\s*plural\s*;([^}]*))?\}\}/g,
		(_all, name: string, forms?: string) => {
			const value = params[name];
			if (value === undefined) {
				throw new Error(`no value for {{${name}}} in "${text}"`);
			}
			if (forms === undefined) {
				return String(value);
			}
			const wanted = Number(value) === 1 ? "one" : "other";
			const form = forms
				.split(";")
				.map((f) => f.trim())
				.find((f) => f.startsWith(`${wanted}:`));
			return form ? form.slice(wanted.length + 1).trim() : "";
		},
	);
}

/** The translator of a language. */
export function translator(lang: string): Translate {
	const words = dictionary(lang);
	return (key, params) => {
		const text = words.get(key);
		if (text === undefined) {
			throw new Error(`no text "${key}" in the ${lang} dictionaries`);
		}
		return fill(text, params);
	};
}
