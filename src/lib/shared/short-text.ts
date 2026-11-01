// SPDX-License-Identifier: GPL-3.0-or-later
// The short forms of a record printed where room is scarce (PLAN.md Appendix G and H): the author's
// surname on the labels and the slips, the title cut to `labels.titleMaxChars` on the labels.

/** `Rossi, Anna` → `Rossi`; `Anonimo` → `Anonimo`. */
export function authorShort(author: string): string {
	return (author.split(",")[0] ?? author).trim();
}

/** Title cut to `maxChars` characters, as the reference printout does. */
export function titleShort(title: string, maxChars: number): string {
	const clean = title.replace(/\s+/g, " ").trim();
	return Array.from(clean).slice(0, maxChars).join("").trimEnd();
}
