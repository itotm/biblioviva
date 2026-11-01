// SPDX-License-Identifier: GPL-3.0-or-later
// The cross-table guard (PLAN.md Phase 12, Q90): a card number may never be a copy barcode and a
// copy barcode may never be a card number, whatever their formats (manual edits and imports of
// legacy codes included). The two columns keep their own UNIQUE indexes.
import type { DbOrTx } from "#lib/server/db/client.js";
import { itemByBarcode, patronByCard } from "./lookup.js";

export function isCopyBarcode(db: DbOrTx, code: string): boolean {
	return itemByBarcode(db, code) !== null;
}

/** Removed patrons' card numbers count too: a number is never handed out twice. */
export function isCardNumber(db: DbOrTx, code: string): boolean {
	return patronByCard(db, code, { anonymized: true }) !== null;
}
