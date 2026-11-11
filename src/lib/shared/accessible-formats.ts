// SPDX-License-Identifier: GPL-3.0-or-later
// Accessible books (PLAN.md step 9.66, Q157): the formats a record may have — high readability,
// symbols (CAA), audiobook, large print, tactile — as configured in `catalog.accessibleFormats`.
// A record stores the names as written in the list; the form, the services and the catalogue
// import read and write them through these helpers.
import { normalizeSearchText } from "./text.js";

/** The preset of `catalog.accessibleFormats`. */
export const DEFAULT_ACCESSIBLE_FORMATS = [
	"Alta leggibilità",
	"In simboli (CAA)",
	"Audiolibro",
	"Caratteri grandi",
	"Tattile",
] as const;

/** The catalogue filter's value for "any accessible format". */
export const ANY_ACCESSIBLE_FORMAT = "*";

/** The separator of the form's hidden field and of the import column (`;` or `|` or a new line). */
const SEPARATOR = /[\n;|]+/;

/** The formats as written in a field or a cell: `Audiolibro; Tattile` → `["Audiolibro", "Tattile"]`. */
export function splitFormats(text: string): string[] {
	return text
		.split(SEPARATOR)
		.map((s) => s.replace(/\s+/g, " ").trim())
		.filter(Boolean);
}

/** The form's hidden field. */
export function joinFormats(formats: readonly string[]): string {
	return formats.join("|");
}

/**
 * The formats typed matched against the list (case and accents ignored), in the list's order and
 * spelling, without repetitions; `unknown` holds what the list does not have.
 */
export function matchFormats(
	typed: readonly string[],
	list: readonly string[],
): { formats: string[]; unknown: string[] } {
	const byKey = new Map(list.map((f) => [normalizeSearchText(f), f]));
	const found = new Set<string>();
	const unknown: string[] = [];
	for (const t of typed) {
		const hit = byKey.get(normalizeSearchText(t));
		if (hit) {
			found.add(hit);
		} else if (!unknown.includes(t)) {
			unknown.push(t);
		}
	}
	return { formats: list.filter((f) => found.has(f)), unknown };
}
