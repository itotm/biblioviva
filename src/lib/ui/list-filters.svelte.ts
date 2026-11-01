// SPDX-License-Identifier: GPL-3.0-or-later
// The filters of a list page (catalogue, patrons, open loans; Q83): the grid loads nothing until a
// filter is set or the search box holds a word of `MIN_QUERY` characters or a code of any length.
// The page keeps its filter values in one `ListFilters` (bound to its inputs), builds the query
// from them and asks `hasFilter` whether there is anything to load. Given a snapshot id, the filters
// are kept when the page is left and given back on Back (SvelteKit's `snapshot`).
import { snapshot } from "$app/navigation";

/** Words count from this many characters. */
export const MIN_QUERY = 3;

/** A code typed at any length: digits (a card number, part of an ISBN). */
export const DIGITS = /^\d+$/;
/** A code typed at any length: digits and hyphens (a copy barcode as `2024-C0001`). */
export const DIGITS_AND_HYPHENS = /^[\d-]+$/;

/** The search text of a query: the box's text when it is long enough or a code, else nothing. */
export function searchText(q: string, code: RegExp): string {
	const text = q.trim();
	return text.length >= MIN_QUERY || code.test(text) ? text : "";
}

/** Is any filter of a query set (a text, a choice, a "1" flag)? */
export function hasFilter(query: Record<string, string | boolean | undefined>): boolean {
	return Object.values(query).some((v) => v !== "" && v !== false && v !== undefined);
}

/** The values of a list page's filters, bound to its inputs, and their reset. */
export class ListFilters<T extends object> {
	readonly #empty: T;
	values: T;

	/**
	 * `empty`: every filter unset; `initial`: the values the page opens with (from the URL);
	 * `keep`: the page's snapshot id, so Back finds the filters as they were left (created while
	 * the page initialises).
	 */
	constructor(empty: T, initial: Partial<T> = {}, keep?: string) {
		this.#empty = { ...empty };
		this.values = $state({ ...empty, ...initial });
		if (keep !== undefined) {
			snapshot({ id: keep, capture: () => this.capture(), restore: (v) => this.restore(v) });
		}
	}

	/** Every filter back to unset, the search box too. */
	clear(): void {
		Object.assign(this.values, this.#empty);
	}

	/** The filters as they are, to keep when leaving the page. */
	capture(): T {
		// the filters are plain values: a shallow copy leaves the reactive proxy behind
		return { ...this.values };
	}

	/** The filters kept when the page was left, given back. */
	restore(kept: T): void {
		Object.assign(this.values, kept);
	}
}
