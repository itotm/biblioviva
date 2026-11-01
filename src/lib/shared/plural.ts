// SPDX-License-Identifier: GPL-3.0-or-later
// Plural forms in the dictionaries (PLAN.md step 9.39, ADR-051): a message writes the words that must
// agree with a number as `{{count:plural; one:student; other:students;}}`, and the parser picks the
// option by the locale's plural rules. A category the locale needs but the message lacks gives an
// EMPTY text, so a language pack is checked for every category its language uses.

/** The categories of the CLDR plural rules. */
export const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

export interface PluralExpression {
	/** The placeholder the number comes from (`count`). */
	name: string;
	/** The option keys, in order: `one`, `few`, `=0`, `default`… */
	options: string[];
}

/** The text between a `{{` and its `}}` (nested pairs count), or null when it never closes. */
function closingIndex(text: string, from: number): number {
	let depth = 0;
	for (let i = from; i < text.length - 1; i++) {
		if (text.startsWith("{{", i)) {
			depth++;
			i++;
		} else if (text.startsWith("}}", i)) {
			depth--;
			i++;
			if (depth === 0) {
				return i - 1;
			}
		}
	}
	return -1;
}

/** The options of the body after `plural;`, split on the `;` that sit outside nested `{{ }}`. */
function optionKeys(body: string): string[] {
	const keys: string[] = [];
	let depth = 0;
	let start = 0;
	const take = (end: number): void => {
		const piece = body.slice(start, end);
		const colon = piece.indexOf(":");
		if (colon > 0) {
			keys.push(piece.slice(0, colon).trim());
		}
	};
	for (let i = 0; i < body.length; i++) {
		if (body.startsWith("{{", i)) {
			depth++;
			i++;
		} else if (body.startsWith("}}", i)) {
			depth--;
			i++;
		} else if (body[i] === ";" && depth === 0) {
			take(i);
			start = i + 1;
		}
	}
	take(body.length);
	return keys;
}

/** Every `{{name:plural; …}}` of a message, with the keys of its options. */
export function pluralExpressions(message: string): PluralExpression[] {
	const found: PluralExpression[] = [];
	for (let i = 0; i < message.length - 1; i++) {
		if (!message.startsWith("{{", i)) {
			continue;
		}
		const end = closingIndex(message, i);
		if (end < 0) {
			break;
		}
		const inner = message.slice(i + 2, end - 1);
		const head = /^\s*([\w.]+)\s*:\s*plural\s*;/.exec(inner);
		if (head) {
			found.push({
				name: head[1] ?? "",
				options: optionKeys(inner.slice(head[0].length)),
			});
			// the options may hold placeholders of their own, plain ones: scan on after the head
			i += head[0].length + 1;
		} else {
			i = end;
		}
	}
	return found;
}

/**
 * The categories a locale really selects for the numbers a school counts (0 to 1000): `many` of
 * French, Spanish, Italian and Portuguese only starts at a million, so it is not needed there.
 */
export function neededPluralCategories(locale: string): PluralCategory[] {
	let rules: Intl.PluralRules;
	try {
		rules = new Intl.PluralRules(locale);
	} catch {
		rules = new Intl.PluralRules("en");
	}
	const used = new Set<string>();
	for (let n = 0; n <= 1000; n++) {
		used.add(rules.select(n));
	}
	return PLURAL_CATEGORIES.filter((c) => used.has(c) || c === "other");
}

/**
 * What is wrong with the plural expressions of a message written for `locale`: an expression
 * without `other`, or without a category the language needs, or with a category it never uses.
 */
export function pluralProblems(
	message: string,
	locale: string,
): { missing: PluralCategory[]; unused: string[] }[] {
	const needed = neededPluralCategories(locale);
	const out: { missing: PluralCategory[]; unused: string[] }[] = [];
	for (const expression of pluralExpressions(message)) {
		const keys = new Set(expression.options);
		const missing = needed.filter((c) => !keys.has(c) && !keys.has("default"));
		const unused = [...keys].filter(
			(k) =>
				(PLURAL_CATEGORIES as readonly string[]).includes(k) &&
				!needed.includes(k as PluralCategory) &&
				k !== "many",
		);
		if (missing.length > 0 || unused.length > 0) {
			out.push({ missing, unused });
		}
	}
	return out;
}
