// SPDX-License-Identifier: GPL-3.0-or-later
// Counters of the generated codes (PLAN.md §3.7, Phase 12): one `sequence` row per format (and per
// year when the pattern has one), named after the pattern, so changing the format starts a counter
// of its own and coming back to a format continues where it stopped. Before a code is generated
// the counter is moved past the highest code of the same shape already stored (imported codes)
// and past the numbers of the older formats, so a number is never given twice.
import { sql } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { ensureAtLeast, nextValue } from "#lib/server/db/sequence.js";
import {
	capacity,
	counterOf,
	generateCode,
	type CompiledFormat,
} from "#lib/shared/barcodes/pattern.js";
import type { CompiledKind } from "#lib/shared/barcodes/table.js";

export type CodeColumn = "item.barcode" | "patron.card_number";

/** The `sequence` row of a format (and year). */
export function sequenceName(
	kind: "item" | "card",
	format: CompiledFormat,
	year: number | null,
): string {
	const base = `${kind}:${format.def.pattern}`;
	return format.year && year !== null ? `${base}:${String(year)}` : base;
}

/** A SQLite GLOB matching every code of the format's shape (of one year, when given). */
export function shapeGlob(format: CompiledFormat, year: number | null = null): string {
	const yearText = format.year && year !== null ? String(year).slice(-format.year.length) : null;
	return format.slots
		.map((slot, i) => {
			if (yearText !== null && format.year && i >= format.year.start) {
				const k = i - format.year.start;
				if (k < format.year.length) {
					return yearText.charAt(k);
				}
			}
			switch (slot.type) {
				case "digit":
					return "[0-9]";
				case "letter":
					return `[${slot.letters}]`;
				case "char":
					return slot.char;
			}
		})
		.join("");
}

/** The codes of a column with the format's shape (of one year, when given). */
export function codesOfShape(
	db: DbOrTx,
	column: CodeColumn,
	format: CompiledFormat,
	year: number | null = null,
): string[] {
	const glob = shapeGlob(format, year);
	const rows =
		column === "item.barcode"
			? db.all<{ code: string }>(
					sql`select barcode as code from item where barcode glob ${glob}`,
				)
			: db.all<{ code: string }>(
					sql`select card_number as code from patron where card_number glob ${glob}`,
				);
	return rows.map((r) => r.code);
}

/** The highest counter among the stored codes of the format's shape (0 when none). */
export function highestCounter(
	db: DbOrTx,
	column: CodeColumn,
	format: CompiledFormat,
	year: number | null = null,
): number {
	let max = 0;
	for (const code of codesOfShape(db, column, format, year)) {
		max = Math.max(max, counterOf(format, code) ?? 0);
	}
	return max;
}

/**
 * The number a code of an older format stands for: its counter, or the whole number for an
 * all-digit shape without one (the plain cards of an older system, `NNNNNNNNNN`).
 */
function olderValue(format: CompiledFormat, code: string): number | null {
	if (format.counter) {
		return counterOf(format, code);
	}
	return format.slots.every((s) => s.type === "digit" || (s.type === "char" && /\d/.test(s.char)))
		? Number(code)
		: null;
}

/**
 * The next code of a kind's current format. Call inside the transaction that stores it (a rollback
 * must not burn the number). The counter continues above the stored codes of the same shape and
 * above the numbers of the kind's older formats (of the same year, when the format has one), so a
 * new code never repeats the number of an old one (`2026-E0042` after the old `2026-0042`);
 * numbers too large for the new counter cannot collide and are ignored. `minimum` is the lowest
 * counter allowed (the card counter start).
 */
export function nextCode(
	db: DbOrTx,
	kind: "item" | "card",
	formats: CompiledKind,
	year: number,
	minimum = 1,
): string {
	const column: CodeColumn = kind === "item" ? "item.barcode" : "patron.card_number";
	const format = formats.current;
	const y = format.year ? year : null;
	const top = capacity(format);
	let lastUsed = Math.max(highestCounter(db, column, format, y), minimum - 1);
	for (const older of [...formats.retired, ...formats.legacy]) {
		if (y !== null && !older.year) {
			continue;
		}
		for (const code of codesOfShape(db, column, older, older.year ? y : null)) {
			const value = olderValue(older, code);
			if (value !== null && value <= top) {
				lastUsed = Math.max(lastUsed, value);
			}
		}
	}
	const name = sequenceName(kind, format, y);
	if (lastUsed > 0) {
		ensureAtLeast(db, name, lastUsed);
	}
	return generateCode(format, { counter: nextValue(db, name), year });
}
