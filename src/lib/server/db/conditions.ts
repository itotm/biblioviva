// SPDX-License-Identifier: GPL-3.0-or-later
// SQL conditions several services share, built from the rules of `#lib/shared/copy-status.ts`, so a
// status added there reaches every query that names it.
import { sql, type SQL } from "drizzle-orm";
import { LEAVING_STATUS_LIST, LENDABLE_STATUS_LIST } from "#lib/shared/copy-status.js";
import { item } from "./schema.js";

/** `('a', 'b')`: a list of status literals for raw SQL (constants of the code, never input). */
function statusList(values: readonly string[]): SQL {
	return sql.raw(`(${values.map((v) => `'${v}'`).join(", ")})`);
}

/** A copy still in the collection: not lost, not withdrawn. */
export function inCollection(): SQL {
	return sql`${item.status} not in ${statusList(LEAVING_STATUS_LIST)}`;
}

/** The statuses of a copy that can go home, for raw SQL over an item alias (`i.status in …`). */
export const lendableStatusesSql: SQL = statusList(LENDABLE_STATUS_LIST);

/**
 * The open loans of the patron of the row (`patron.id` written literally: Drizzle would render the
 * column unqualified inside the subquery).
 */
export const openLoansOfPatronSql = sql<number>`(select count(*) from loan l where l.patron_id = patron.id and l.returned_at is null)`;
