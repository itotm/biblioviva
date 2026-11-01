// SPDX-License-Identifier: GPL-3.0-or-later
// The order of names and labels in the installation's language (9.41): every sort of text the
// operator reads goes through it, never through the host's default order or a hard-coded language.

const collators = new Map<string, Intl.Collator>();

/** The order of names in the installation's language (Å after Z in Swedish), Italian if none. */
export function collatorFor(locale = "it"): Intl.Collator {
	let c = collators.get(locale);
	if (!c) {
		c = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
		collators.set(locale, c);
	}
	return c;
}
