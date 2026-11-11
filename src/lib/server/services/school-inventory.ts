// SPDX-License-Identifier: GPL-3.0-or-later
// The school inventory of the copies (PLAN.md step 9.64, Q155): the next inventory number, the one
// after the highest number made of digits only (numbers with letters, kept from another
// register, do not count).
import { sql } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { item } from "#lib/server/db/schema.js";

/** The next inventory number: the highest one of digits only plus one, `1` for the first. */
export function nextInventoryNumber(db: DbOrTx): string {
	const row = db
		.select({
			top: sql<number | null>`max(cast(${item.inventoryNumber} as integer))`,
			width: sql<number | null>`max(length(${item.inventoryNumber}))`,
		})
		.from(item)
		.where(
			sql`${item.inventoryNumber} is not null and ${item.inventoryNumber} not glob '*[^0-9]*'`,
		)
		.get();
	const top = row?.top ?? 0;
	const next = String(top + 1);
	// numbers written with leading zeros (`000123`) keep their width
	return next.padStart(Math.min(row?.width ?? 0, 15), "0");
}
