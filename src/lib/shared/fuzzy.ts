// SPDX-License-Identifier: GPL-3.0-or-later
// Search that forgives typing mistakes (PLAN.md step 9.24, Q124, ADR-036): the words of a search
// are compared with the words of the records by a bounded edit distance (optimal string
// alignment: an insertion, a deletion, a change or two letters swapped each count as one), never
// for words shorter than four letters or articles; one mistake up to six letters, two from seven.
import { normalizeSearchText } from "./text.js";

/** Words of four letters or more that are never corrected: articles and prepositions. */
const NEVER_CORRECTED = new Set([
	"agli",
	"alla",
	"alle",
	"allo",
	"dagli",
	"dalla",
	"dalle",
	"dallo",
	"degli",
	"della",
	"delle",
	"dello",
	"negli",
	"nella",
	"nelle",
	"nello",
	"sugli",
	"sulla",
	"sulle",
	"sullo",
	"from",
	"that",
	"their",
	"this",
	"with",
]);

type Rows = [Int32Array, Int32Array, Int32Array];
let rows: Rows = [new Int32Array(32), new Int32Array(32), new Int32Array(32)];

/** How many mistakes a word of the search may carry: 0 under four letters, 1 up to six, then 2. */
export function maxEdits(word: string): number {
	if (word.length < 4 || NEVER_CORRECTED.has(word)) {
		return 0;
	}
	return word.length <= 6 ? 1 : 2;
}

/**
 * The optimal string alignment distance of `a` and `b`, or `max + 1` as soon as it is certainly
 * larger than `max` (the work stops early, so a long vocabulary is cheap to scan).
 */
export function editDistance(a: string, b: string, max: number): number {
	if (a === b) {
		return 0;
	}
	if (Math.abs(a.length - b.length) > max) {
		return max + 1;
	}
	// three rows of the table, reused from call to call: a search scores thousands of words
	if (rows[0].length <= b.length) {
		rows = [0, 1, 2].map(() => new Int32Array(b.length * 2 + 2)) as Rows;
	}
	let [before, previous, current] = rows;
	for (let j = 0; j <= b.length; j++) {
		previous[j] = j;
	}
	for (let i = 1; i <= a.length; i++) {
		current[0] = i;
		let rowMin = i;
		const ai = a.charCodeAt(i - 1);
		for (let j = 1; j <= b.length; j++) {
			const bj = b.charCodeAt(j - 1);
			let d = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + (ai === bj ? 0 : 1),
			);
			if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj) {
				d = Math.min(d, (before[j - 2] ?? 0) + 1);
			}
			current[j] = d;
			rowMin = Math.min(rowMin, d);
		}
		if (rowMin > max) {
			return max + 1;
		}
		[before, previous, current] = [previous, current, before];
	}
	return Math.min(previous[b.length] ?? max + 1, max + 1);
}

/** The words of a search box text, normalised like the records (at most twelve). */
export function searchWords(text: string): string[] {
	return normalizeSearchText(text).split(" ").filter(Boolean).slice(0, 12);
}

/**
 * How a word of the search meets a word of a record: 0 when the record's word starts with it
 * (as the exact search reads it), else the number of mistakes when within `maxEdits`, else null.
 */
export function wordDistance(word: string, recordWord: string): number | null {
	if (recordWord.startsWith(word)) {
		return 0;
	}
	const max = maxEdits(word);
	if (max === 0) {
		return null;
	}
	const d = editDistance(word, recordWord, max);
	return d <= max ? d : null;
}

/** The corrections of a word in a vocabulary: the words within its mistakes, the closest first. */
export function corrections(
	word: string,
	vocabulary: Iterable<string>,
	limit = 20,
): { term: string; distance: number }[] {
	const max = maxEdits(word);
	if (max === 0) {
		return [];
	}
	const found: { term: string; distance: number }[] = [];
	for (const term of vocabulary) {
		if (term === word || term.startsWith(word)) {
			continue;
		}
		const distance = editDistance(word, term, max);
		if (distance <= max) {
			found.push({ term, distance });
		}
	}
	return found
		.sort((a, b) => a.distance - b.distance || a.term.localeCompare(b.term))
		.slice(0, limit);
}

/** How close a record is to a search: words found (more is better), then mistakes (fewer). */
export interface Closeness {
	words: number;
	mistakes: number;
}

/**
 * The closeness of the words of a record (`recordWords`) to the words of a search, each search
 * word taking its best match; null when no word of four letters or more is found, since short
 * words alone would match half the catalogue.
 */
export function closeness(
	words: readonly string[],
	recordWords: readonly string[],
): Closeness | null {
	let found = 0;
	let mistakes = 0;
	let anchored = false;
	for (const word of words) {
		let best: number | null = null;
		for (const recordWord of recordWords) {
			const d = wordDistance(word, recordWord);
			if (d !== null && (best === null || d < best)) {
				best = d;
			}
			if (best === 0) {
				break;
			}
		}
		if (best !== null) {
			found += 1;
			mistakes += best;
			anchored ||= maxEdits(word) > 0;
		}
	}
	return anchored ? { words: found, mistakes } : null;
}

/** Orders by closeness: every word before some, then fewer mistakes. */
export function byCloseness(a: Closeness, b: Closeness): number {
	return b.words - a.words || a.mistakes - b.mistakes;
}

/** Below this many exact results the approximate ones are added (Q124). */
export const SIMILAR_THRESHOLD = 3;
