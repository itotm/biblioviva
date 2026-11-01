// SPDX-License-Identifier: GPL-3.0-or-later
// Atomic named counters (card numbers, per-year item barcodes). Always call inside the
// transaction that uses the value, so a rolled-back operation does not burn a number.
import { sql } from "drizzle-orm";
import type { DbOrTx } from "./client.js";

export function nextValue(db: DbOrTx, name: string): number {
	const row = db.get<{ value: number }>(
		sql`INSERT INTO sequence(name, value) VALUES (${name}, 1)
		 ON CONFLICT(name) DO UPDATE SET value = value + 1
		 RETURNING value`,
	);
	if (!row) {
		throw new Error(`sequence ${name}: no value returned`);
	}
	return row.value;
}

/** Records `minimum` as the last used value, so the next one is above it (used after imports). */
export function ensureAtLeast(db: DbOrTx, name: string, minimum: number): void {
	db.run(
		sql`INSERT INTO sequence(name, value) VALUES (${name}, ${minimum})
		 ON CONFLICT(name) DO UPDATE SET value = MAX(value, ${minimum})`,
	);
}
