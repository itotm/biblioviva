// SPDX-License-Identifier: GPL-3.0-or-later
/** Lower-case, diacritics stripped, single spaces: the form used for prefix searches (PLAN.md Q46). */
export function normalizeSearchText(input: string): string {
	return input
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

/** The characters a name search waits for (the desk, the census), as the catalogue's search. */
export const SEARCH_MIN_CHARS = 3;

/** Text for a SQL `LIKE … ESCAPE '\'`: `%`, `_` and `\` match themselves, never as wildcards. */
export function escapeLike(input: string): string {
	return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** A form field as stored: trimmed, or null when nothing is left. */
export function blankToNull(input: string): string | null {
	const trimmed = input.trim();
	return trimmed === "" ? null : trimmed;
}
