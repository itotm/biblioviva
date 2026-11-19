// SPDX-License-Identifier: GPL-3.0-or-later
/** The letters Arabic-script search treats as one (alef wasla, alef maksura, Persian yeh, Persian kaf, teh marbuta) and the Greek final sigma. */
const SEARCH_LETTERS: Record<string, string> = {
	"\u0671": "\u0627",
	"\u0649": "\u064a",
	"\u06cc": "\u064a",
	"\u06a9": "\u0643",
	"\u0629": "\u0647",
	"\u03c2": "\u03c3",
};
// The Arabic-Indic (٠–٩) and the Persian (۰–۹) digits next to the Latin ones.
for (let digit = 0; digit < 10; digit++) {
	SEARCH_LETTERS[String.fromCharCode(0x660 + digit)] = String(digit);
	SEARCH_LETTERS[String.fromCharCode(0x6f0 + digit)] = String(digit);
}

/**
 * The fold of every search text, on write and on query: compatibility forms decomposed (NFKD), every
 * combining mark dropped (Latin accents, Greek tonos, Arabic hamza and tashkeel, Hebrew points; not
 * the voicing marks of kana), the
 * Arabic tatweel dropped, the variants of one Arabic letter unified, Arabic-Indic and Persian digits
 * made Latin, lower-case; Hangul syllables put together again. Latin letters give the same result
 * as dropping their accents.
 */
export function foldForSearch(input: string): string {
	return input
		.normalize("NFKD")
		.replace(/(?![\u3099\u309a])\p{M}|\u0640/gu, "")
		.normalize("NFC")
		.toLowerCase()
		.replace(
			/[\u0671\u0649\u06cc\u06a9\u0629\u03c2\u0660-\u0669\u06f0-\u06f9]/gu,
			(c) => SEARCH_LETTERS[c] ?? c,
		);
}

/** The fold, then single spaces between the words: the form used for prefix searches (PLAN.md Q46). */
export function normalizeSearchText(input: string): string {
	return foldForSearch(input)
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
