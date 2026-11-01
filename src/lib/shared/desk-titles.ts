// SPDX-License-Identifier: GPL-3.0-or-later
// Titles as the circulation desk messages show them (Appendix I), on the server and in the page.

/** Titles in desk messages are cut to 40 characters (Appendix I). */
export function shortTitle(title: string): string {
	const chars = Array.from(title.trim());
	return chars.length > 40 ? `${chars.slice(0, 39).join("").trimEnd()}…` : chars.join("");
}

/** The titles of a patron's loans in a desk message: `«A», «B»`. */
export function deskTitles(loans: readonly { title: string }[]): string {
	return loans.map((l) => `«${shortTitle(l.title)}»`).join(", ");
}
