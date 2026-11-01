// SPDX-License-Identifier: GPL-3.0-or-later
// Copy barcodes (PLAN.md §3.7, Phase 12): the configured format (`barcodes.item.format`, default
// `YYYY-CNNNN`), the year being the calendar year of cataloguing in the library's time zone.
// Codes of older formats stay valid; imported copies keep their barcode.
import type { DbOrTx } from "#lib/server/db/client.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { nextCode } from "./counters.js";

/** The next copy barcode of the year. Call inside the transaction that stores the copy. */
export function nextItemBarcode(db: DbOrTx, codes: CodeTable, year: number): string {
	return nextCode(db, "item", codes.item, year);
}
