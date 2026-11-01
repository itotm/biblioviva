// SPDX-License-Identifier: GPL-3.0-or-later
// The barcode formats of the test configuration (tests/fixtures/config): new copies `YYYY-CNNNN`
// and cards `CNNNNNN` with the mod-23 letter, legacy `YYYY-NNNN` copies, 10-digit cards and plain
// numbers up to 9 digits (PLAN.md Phase 12).
import { generateCode } from "#lib/shared/barcodes/pattern.js";
import { DEFAULT_CODE_FORMATS } from "#lib/shared/barcodes/presets.js";
import { buildCodeTable, type CodeFormats } from "#lib/shared/barcodes/table.js";

export const TEST_FORMATS: CodeFormats = {
	...DEFAULT_CODE_FORMATS,
	item: { ...DEFAULT_CODE_FORMATS.item, legacy: [{ pattern: "YYYY-NNNN", check: "none" }] },
	card: { ...DEFAULT_CODE_FORMATS.card, legacy: [{ pattern: "NNNNNNNNNN", check: "none" }] },
	plainMaxLength: 9,
};

export const TEST_CODES = buildCodeTable(TEST_FORMATS);

/** What the patron services need to give card numbers (PatronRules without classes). */
export const CARD_RULES = {
	codes: TEST_CODES,
	cardCounterStart: "afterLegacyMax" as const,
	year: 2026,
};

/**
 * The formats BiblioViva generated before Phase 12 (PLAN.md §3.7, Q7–Q8: the `classic` preset with
 * Luhn), with their legacy shapes.
 */
export const FORMATS_2026: CodeFormats = {
	item: {
		current: { pattern: "YYYY-NNNNC", check: "luhn" },
		retired: [],
		legacy: [{ pattern: "YYYY-NNNN", check: "none" }],
	},
	card: {
		current: { pattern: "NNNNNNNNNC", check: "luhn" },
		retired: [],
		legacy: [{ pattern: "NNNNNNNNNN", check: "none" }],
	},
	plainMaxLength: 9,
	libraryCode: "",
	layout: "it",
};

/** A copy barcode of the test format. */
export function itemCode(year: number, counter: number): string {
	return generateCode(TEST_CODES.item.current, { year, counter });
}

/** A card number of the test format. */
export function cardCode(counter: number): string {
	return generateCode(TEST_CODES.card.current, { counter, year: 2026 });
}

/** The same code with a wrong check character (another letter or digit in its place). */
export function withWrongCheck(code: string, kind: "item" | "card" = "item"): string {
	const format = TEST_CODES[kind].current;
	const at = format.check ?? code.length - 1;
	const c = code.charAt(at);
	const other = /\d/.test(c) ? String((Number(c) + 1) % 10) : c === "A" ? "B" : "A";
	return `${code.slice(0, at)}${other}${code.slice(at + 1)}`;
}
