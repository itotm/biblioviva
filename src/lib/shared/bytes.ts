// SPDX-License-Identifier: GPL-3.0-or-later
// Sizes of files as people read them: decimal units (1 kB = 1000 bytes, 1 MB = 1 000 000 bytes,
// as the operating systems and the browsers show them), written in the installation's language.

const UNITS = [
	["gigabyte", 1_000_000_000],
	["megabyte", 1_000_000],
	["kilobyte", 1000],
] as const;

/** A size in megabytes as a number of the language (`5`, `2,5`): the `{{maxMb}}` of the messages. */
export function megabytes(bytes: number, locale: string): string {
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1_000_000);
}

/** A size with its unit, from bytes to gigabytes (`512 byte`, `12,3 kB`, `2,5 MB`). */
export function formatBytes(bytes: number, locale: string): string {
	const [unit, size] = UNITS.find(([, s]) => bytes >= s) ?? ["byte", 1];
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		unitDisplay: "short",
		maximumFractionDigits: size === 1 ? 0 : 1,
	}).format(bytes / size);
}
