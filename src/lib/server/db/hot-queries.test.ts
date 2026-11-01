// SPDX-License-Identifier: GPL-3.0-or-later
// The hottest queries of the desk, the catalogue and the dashboard (PLAN.md step 9.2): each one
// is planned by SQLite on an index, never by reading a whole table of copies, records or loans.
// The patron name search is the one allowed scan: it matches inside names (`% word%`) on a table
// bounded by the size of a school (≤ 1 000 patrons).
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import type { Db } from "./client.js";
import { seedDatabase } from "./seed.js";

let db: Db;
beforeAll(() => {
	db = createTestDb();
	seedDatabase(db, { patrons: 60, teachers: 5, biblios: 80, items: 120, loans: 150 });
	db.$client.run("ANALYZE");
});

const HOT: Record<string, string> = {
	"copy by barcode": "SELECT * FROM item WHERE barcode = '2026-00017'",
	"patron by card": "SELECT * FROM patron WHERE card_number = '1000000009'",
	"open loan of a copy": "SELECT * FROM loan WHERE item_id = 3 AND returned_at IS NULL",
	"open loans of a patron": "SELECT * FROM loan WHERE patron_id = 3 AND returned_at IS NULL",
	"loans of a patron": "SELECT * FROM loan WHERE patron_id = 3 ORDER BY issued_at DESC",
	"loans of a copy": "SELECT * FROM loan WHERE item_id = 3 ORDER BY issued_at DESC",
	"copies of a record": "SELECT * FROM item WHERE biblio_id = 5",
	overdue: `SELECT l.id, p.last_name, b.title FROM loan l
		JOIN patron p ON p.id = l.patron_id JOIN item i ON i.id = l.item_id JOIN biblio b ON b.id = i.biblio_id
		WHERE l.returned_at IS NULL AND l.due_date < '2026-10-01' ORDER BY l.due_date`,
	"catalogue search": `SELECT b.id FROM biblio_fts f JOIN biblio b ON b.id = f.rowid
		WHERE biblio_fts MATCH 'rosso*' LIMIT 50`,
	"open loans count": "SELECT COUNT(*) FROM loan WHERE returned_at IS NULL",
	"labels to print": "SELECT COUNT(*) FROM item WHERE spine_label_printed_at IS NULL",
	"audit log page": "SELECT * FROM audit_log ORDER BY at DESC LIMIT 50",
	"print list entries": "SELECT * FROM print_list_entry WHERE list_id = 1 ORDER BY position",
};

const BIG = /\bSCAN (item|biblio|loan|loan_event|audit_log)\b(?! USING)/;

function plan(sql: string): string {
	return (db.$client.query(`EXPLAIN QUERY PLAN ${sql}`).all() as { detail: string }[])
		.map((r) => r.detail)
		.join(" | ");
}

describe("hot queries", () => {
	it.each(Object.entries(HOT))("%s uses an index", (_, sql) => {
		expect(plan(sql)).not.toMatch(BIG);
	});

	it("scans only the patrons when searching a name inside it", () => {
		const p = plan(
			"SELECT id FROM patron WHERE search_name LIKE 'ros%' OR search_name LIKE '% ros%' ORDER BY search_name LIMIT 20",
		);
		expect(p).not.toMatch(BIG);
	});
});
