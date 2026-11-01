// SPDX-License-Identifier: GPL-3.0-or-later
// Recognition of scanned or typed codes (PLAN.md §3.7, Phase 12): repair of scanner layout mishaps
// and the classification into copy / card / ISBN / ambiguous legacy code, driven by the format
// table of the configuration (`#lib/shared/barcodes/table.ts`).
import { repairCandidates } from "./barcodes/layouts.js";
import {
	checkValid,
	counterOf,
	matchesShape,
	separatorPositions,
	yearOf,
	type CompiledFormat,
} from "./barcodes/pattern.js";
import { CODE_KINDS, type CodeKind, type CodeTable } from "./barcodes/table.js";
import {
	cleanIsbn,
	ISBN10_PATTERN,
	ISBN13_PATTERN,
	isbn10Valid,
	isbn10To13,
	isIsbnBarcode,
} from "./isbn.js";

export type ScanKind = "item" | "legacy_item" | "card" | "isbn" | "ambiguous" | "invalid";

export interface ScanResult {
	kind: ScanKind;
	/** Canonical value (`2026-E0267`, `U012345`, ISBN-13). For `invalid`, the input as typed. */
	value: string;
	/** Reason code for `invalid` (i18n key under `common.scan.errors`). */
	reason?:
		"item_check_digit" | "card_check_digit" | "isbn_check_digit" | "unrecognised" | "empty";
}

function generatedFormats(table: CodeTable, kind: CodeKind): CompiledFormat[] {
	return [table[kind].current, ...table[kind].retired];
}

/** A year written in a legacy code must look like one (a plain number is not `1234-5678`). */
function plausibleYear(format: CompiledFormat, code: string): boolean {
	const year = yearOf(format, code);
	return year === null || (year >= 1900 && year <= 2099);
}

/** True when the text is a code the table knows exactly (any kind, check right) or a valid ISBN. */
function known(table: CodeTable, code: string): boolean {
	for (const kind of CODE_KINDS) {
		if (
			generatedFormats(table, kind).some((f) => matchesShape(f, code) && checkValid(f, code))
		) {
			return true;
		}
		if (table[kind].legacy.some((f) => matchesShape(f, code) && plausibleYear(f, code))) {
			return true;
		}
	}
	return isIsbnBarcode(code) || isbn10Valid(cleanIsbn(code));
}

/** The text with the dashes of a format put back, when its length is the format's without them. */
function withDashes(format: CompiledFormat, text: string): string | null {
	const dashes = separatorPositions(format);
	if (
		dashes.length === 0 ||
		text.includes("-") ||
		text.length !== format.length - dashes.length
	) {
		return null;
	}
	const chars = Array.from(text);
	for (const pos of dashes) {
		chars.splice(pos, 0, "-");
	}
	return chars.join("");
}

/**
 * Canonical text of a scan: trims, drops a trailing Enter/Tab and repairs the mishaps of a scanner
 * typing on another keyboard layout (`'`, `ß`, `)` or a space for `-`, swapped letters, the AZERTY
 * digit row) or losing the dash (`202600425` → `2026-00425`). A repaired reading is used only when
 * it is a code the table knows; otherwise the text is returned as typed.
 */
export function normalizeScan(raw: string, table: CodeTable): string {
	const s = raw.replace(/[\r\n\t]+$/g, "").trim();
	const candidates = repairCandidates(s, table.formats.layout);
	for (const c of candidates) {
		if (known(table, c)) {
			return c;
		}
	}
	const formats = CODE_KINDS.flatMap((kind) => [
		...generatedFormats(table, kind),
		...table[kind].legacy,
	]);
	for (const c of candidates) {
		for (const f of formats) {
			const dashed = withDashes(f, c);
			if (dashed !== null && known(table, dashed)) {
				return dashed;
			}
		}
	}
	return s;
}

/** The ISBN-13 a text stands for (ISBN-13, or ISBN-10 converted), hyphens and spaces allowed. */
export function recogniseIsbn(text: string): string | null {
	const s = text.replace(/[\s-]/g, "");
	if (ISBN13_PATTERN.test(s)) {
		return isIsbnBarcode(s) ? s : null;
	}
	const isbn = cleanIsbn(s);
	return isbn10Valid(isbn) ? isbn10To13(isbn) : null;
}

/** Classify a code (§3.7) with the format table. Call `normalizeScan` first for raw scanner input. */
export function recognise(code: string, table: CodeTable): ScanResult {
	const s = code.trim();
	if (!s) {
		return { kind: "invalid", value: s, reason: "empty" };
	}
	if (ISBN13_PATTERN.test(s)) {
		return isIsbnBarcode(s)
			? { kind: "isbn", value: s }
			: { kind: "invalid", value: s, reason: "isbn_check_digit" };
	}
	// a generated code with its check right is what it says (the rule of Q90 keeps the kinds apart)
	let badCheck: { kind: CodeKind; format: CompiledFormat } | null = null;
	for (const kind of CODE_KINDS) {
		for (const f of generatedFormats(table, kind)) {
			if (matchesShape(f, s)) {
				if (checkValid(f, s)) {
					return { kind, value: s };
				}
				badCheck ??= { kind, format: f };
			}
		}
	}
	const itemLegacy = table.item.legacy.some((f) => matchesShape(f, s));
	const cardLegacy = table.card.legacy.some((f) => matchesShape(f, s));
	if (itemLegacy && cardLegacy) {
		return { kind: "ambiguous", value: s };
	}
	if (itemLegacy) {
		return { kind: "legacy_item", value: s };
	}
	if (cardLegacy) {
		// a legacy card may have the shape of the generated cards (the formats of 2026): from the
		// configured counter start on, a wrong check means a mistyped code, not an old card
		const start = table.formats.cardCounterStart;
		if (badCheck?.kind === "card" && start !== undefined) {
			const counter = counterOf(badCheck.format, s);
			if (counter !== null && counter >= start) {
				return isbn10Valid(s)
					? { kind: "isbn", value: isbn10To13(s) }
					: { kind: "ambiguous", value: s };
			}
		}
		return { kind: "card", value: s };
	}
	if (badCheck) {
		return { kind: "invalid", value: s, reason: `${badCheck.kind}_check_digit` };
	}
	const isbn = cleanIsbn(s);
	if (ISBN10_PATTERN.test(isbn) && isbn.endsWith("X")) {
		return isbn10Valid(isbn)
			? { kind: "isbn", value: isbn10To13(isbn) }
			: { kind: "invalid", value: s, reason: "isbn_check_digit" };
	}
	if (/^\d+$/.test(s)) {
		return { kind: "ambiguous", value: s };
	}
	return { kind: "invalid", value: s, reason: "unrecognised" };
}

/** Raw scanner or typed input classified: its canonical text (`normalizeScan`) and what it is. */
export function recogniseScan(raw: string, table: CodeTable): { code: string; result: ScanResult } {
	const code = normalizeScan(raw, table);
	return { code, result: recognise(code, table) };
}
