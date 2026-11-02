// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { nextItemBarcode } from "#lib/server/barcodes/items.js";
import { author3 } from "#lib/shared/classification.js";
import { recognise } from "#lib/shared/scan.js";
import { todayActivity } from "#lib/server/services/loan-lists.js";
import { schoolEmail, seedDatabase } from "./seed.js";
import { TEST_CODES as CODES } from "../../../../tests/helpers/codes.js";

describe("seed", () => {
	it("leaves a few loans and returns made this morning at the desk", () => {
		const db = createTestDb();
		seedDatabase(db, { patrons: 60, teachers: 6, biblios: 200, items: 260, loans: 300 });
		const day = todayActivity(db, "2026-09-19", "Europe/Rome");
		expect(day.issued.length).toBeGreaterThanOrEqual(6);
		expect(day.returned).toHaveLength(4);
		// a copy returned today was lent before today, and it is back on the shelf
		const returnedIds = day.returned.map((r) => r.loanId);
		const loans = db.$client
			.query<{ issued_at: string; returned_at: string }, []>(
				`SELECT issued_at, returned_at FROM loan WHERE id IN (${returnedIds.join(",")})`,
			)
			.all();
		expect(loans.every((l) => l.issued_at < "2026-09-19" && l.returned_at > l.issued_at)).toBe(
			true,
		);
	});

	it("fills the database with deterministic synthetic data in under 10 seconds", () => {
		const db = createTestDb();
		const started = performance.now();
		const summary = seedDatabase(db);
		expect(performance.now() - started).toBeLessThan(10_000);
		expect(summary.patrons).toBe(300);
		expect(summary.biblios).toBe(4000);
		expect(summary.items).toBe(5000);
		expect(summary.loans).toBeGreaterThan(3500);
		expect(summary.openLoans).toBeGreaterThan(50);
		expect(summary.overdueLoans).toBeGreaterThan(10);

		const count = (sqlText: string): number =>
			(db.$client.query<{ n: number }, []>(sqlText).get() as { n: number }).n;
		// every code in the current format (9.12): cards of 10 digits, copies YYYY-NNNNC, both with
		// a valid check digit
		const cards = db.$client
			.query<{ c: string }, []>("SELECT card_number AS c FROM patron")
			.all();
		expect(cards.every((r) => recognise(r.c, CODES).kind === "card")).toBe(true);
		const codes = db.$client.query<{ b: string }, []>("SELECT barcode AS b FROM item").all();
		expect(codes.every((r) => recognise(r.b, CODES).kind === "item")).toBe(true);
		expect(count("SELECT COUNT(DISTINCT substr(barcode, 1, 4)) AS n FROM item")).toBe(8);
		// the sequences continue after the seeded counters
		for (const year of [2019, 2026]) {
			const next = nextItemBarcode(db, CODES, year);
			expect(codes.some((r) => r.b === next)).toBe(false);
		}
		// one open loan per item at most, FTS populated, two school years
		expect(
			count(
				"SELECT COUNT(*) AS n FROM (SELECT item_id FROM loan WHERE returned_at IS NULL GROUP BY item_id HAVING COUNT(*) > 1)",
			),
		).toBe(0);
		expect(
			count("SELECT COUNT(*) AS n FROM biblio_fts WHERE biblio_fts MATCH 'a*'"),
		).toBeGreaterThan(0);
		expect(count("SELECT COUNT(DISTINCT school_year) AS n FROM loan")).toBe(2);
		// the notable dates of the calendar (9.25): four in the next 30 days, one a period
		expect(count("SELECT COUNT(*) AS n FROM calendar_event")).toBe(6);
		expect(
			count(
				"SELECT COUNT(*) AS n FROM calendar_event WHERE starts_on BETWEEN '2026-09-19' AND '2026-10-19'",
			),
		).toBe(4);
		expect(count("SELECT COUNT(*) AS n FROM calendar_event WHERE ends_on IS NOT NULL")).toBe(1);
		// a few translations carry their original title (9.23)
		expect(count("SELECT COUNT(*) AS n FROM biblio WHERE original_title IS NOT NULL")).toBe(8);
		expect(
			count(
				"SELECT COUNT(*) AS n FROM biblio_fts WHERE biblio_fts MATCH 'original_title:petit'",
			),
		).toBe(1);
		// every patron has a school address of their own (9.22)
		expect(count("SELECT COUNT(DISTINCT email) AS n FROM patron")).toBe(300);
		expect(
			count(
				"SELECT COUNT(*) AS n FROM patron WHERE email NOT GLOB '[a-z0-9]*.[a-z0-9]*@scuola.example'",
			),
		).toBe(0);
		// copies of the same title in two different classes exist for the classPerItem scenario
		expect(
			count("SELECT COUNT(*) AS n FROM item WHERE reading_level IS NOT NULL"),
		).toBeGreaterThan(0);
		// three lists of patrons and two of copies, every entry pointing at a row of its kind
		const lists = db.$client
			.query<{ kind: string; n: number }, []>(
				"SELECT kind, COUNT(*) AS n FROM print_list GROUP BY kind ORDER BY kind",
			)
			.all();
		expect(lists).toEqual([
			{ kind: "items", n: 2 },
			{ kind: "patrons", n: 3 },
		]);
		expect(
			count(
				"SELECT COUNT(*) AS n FROM print_list l JOIN print_list_entry e ON e.list_id = l.id WHERE (l.kind = 'patrons' AND e.entity_id NOT IN (SELECT id FROM patron)) OR (l.kind = 'items' AND e.entity_id NOT IN (SELECT id FROM item))",
			),
		).toBe(0);
		expect(
			count(
				"SELECT MIN(n) AS n FROM (SELECT COUNT(*) AS n FROM print_list_entry GROUP BY list_id)",
			),
		).toBeGreaterThan(3);
	});

	it("writes every author as the catalogue does, surname first, and files the copies by it", () => {
		const db = createTestDb();
		seedDatabase(db, { patrons: 10, teachers: 2, biblios: 300, items: 320, loans: 30 });
		const rows = db.$client
			.query<{ author: string; call: string | null }, []>(
				"SELECT b.author AS author, i.call_number AS call FROM biblio b JOIN item i ON i.biblio_id = b.id",
			)
			.all();
		// "Surname, Name", or one word ("Plato"), or a special value
		const special = new Set(["Anonimo", "AA. VV."]);
		const wrong = rows.filter(
			(r) => !special.has(r.author) && !/^([^,\s]+|[^,]+, [^,]+)$/.test(r.author),
		);
		expect(wrong).toEqual([]);
		// the segnatura ends with the first three letters of the surname (9.44)
		const misfiled = rows.filter((r) => !r.call?.endsWith(author3(r.author)));
		expect(misfiled).toEqual([]);
	});

	it("is deterministic and refuses to run twice", () => {
		const a = createTestDb();
		const b = createTestDb();
		seedDatabase(a, { patrons: 10, teachers: 2, biblios: 20, items: 25, loans: 30 });
		seedDatabase(b, { patrons: 10, teachers: 2, biblios: 20, items: 25, loans: 30 });
		const names = (db: typeof a): unknown[] =>
			db.$client.query("SELECT last_name, email FROM patron ORDER BY id").all();
		expect(names(a)).toEqual(names(b));
		expect(() => seedDatabase(a)).toThrow(/already contains/);
	});

	it("builds the school address from the names, without accents, spaces or duplicates", () => {
		const taken = new Set<string>();
		expect(schoolEmail("Niccolò", "De Luca", "scuola.example", taken)).toBe(
			"niccolo.deluca@scuola.example",
		);
		expect(schoolEmail("Anna Maria", "D'Angelo", "scuola.example", taken)).toBe(
			"annamaria.dangelo@scuola.example",
		);
		expect(schoolEmail("Niccolò", "De Luca", "scuola.example", taken)).toBe(
			"niccolo.deluca2@scuola.example",
		);
		expect(schoolEmail("Łukasz", "Wójcik", "school.example", taken)).toBe(
			"lukasz.wojcik@school.example",
		);
	});
});
