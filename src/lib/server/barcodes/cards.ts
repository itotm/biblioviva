// SPDX-License-Identifier: GPL-3.0-or-later
// Card numbers (PLAN.md §3.7, Phase 12): the configured format (`barcodes.patron.format`, default
// `CNNNNNN`). The counter never goes back, so a retired number is never reused, and it always
// continues above the highest stored number of the same shape (legacy numbers included).
import type { DbOrTx } from "#lib/server/db/client.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { nextCode } from "./counters.js";

/** `barcodes.patron.counterStart`: after the highest stored number, or not below a given one. */
export type CardCounterStart = "afterLegacyMax" | number;

/**
 * The next card number. Call inside the transaction that stores it. `year` is the library's
 * current year (used only by a pattern with a year).
 */
export function nextCardNumber(
	db: DbOrTx,
	codes: CodeTable,
	counterStart: CardCounterStart,
	year: number,
): string {
	const minimum = typeof counterStart === "number" ? counterStart : 1;
	return nextCode(db, "card", codes.card, year, minimum);
}
