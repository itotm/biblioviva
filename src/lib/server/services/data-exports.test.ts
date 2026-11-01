// SPDX-License-Identifier: GPL-3.0-or-later
// Exports that go back in (step 7.3 acceptance): patrons, catalogue and open loans exported from
// a seeded library are imported into an empty one through the real import pipelines (2.6, 3.9).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { biblio, item, loan, patron, staffUser } from "#lib/server/db/schema.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { commitCatalogImport, detectCatalogFormat } from "#lib/server/imports/catalog.js";
import { readCsv } from "#lib/server/imports/csv.js";
import { commitLoanImport, detectLoanFormat } from "#lib/server/imports/loans.js";
import { mapRows } from "#lib/server/imports/pipeline.js";
import {
	CATALOG_FIELDS,
	CATALOG_IMPORT,
	headerMapping,
	isComplete,
	LOAN_FIELDS,
	LOAN_IMPORT,
	missingColumns,
	STUDENT_IMPORT,
	TEACHER_IMPORT,
	type ImportSpec,
} from "#lib/shared/import-columns.js";
import {
	commitPatronImport,
	detectPatronFormat,
	mapPatronRows,
	type PatronImportColumn,
} from "#lib/server/imports/patrons.js";
import { catalogRules } from "./catalog.js";
import {
	CATALOG_EXPORT_HEADER,
	OPEN_LOANS_EXPORT_HEADER,
	STUDENT_EXPORT_HEADER,
	TEACHER_EXPORT_HEADER,
	catalogCsv,
	databaseDump,
	loansHistoryCsv,
	openLoansCsv,
	patronDataExport,
	studentsCsv,
	teachersCsv,
} from "./data-exports.js";

import { TEST_CODES as CODES } from "../../../../tests/helpers/codes.js";
import {
	classId,
	mirrorTestSchool,
	PATRON_RULES,
	teacherGroupId,
} from "../../../../tests/helpers/school.js";
const config = parseConfig(exampleRaw()).config;
const TODAY = "2026-09-25";
const dataDir = mkdtempSync(join(tmpdir(), "bv-exports-"));
afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

const text = (chunks: Iterable<string>): string => [...chunks].join("");
const csv = (chunks: Iterable<string>): ReturnType<typeof readCsv> =>
	readCsv(new TextEncoder().encode(text(chunks)));

function source(): Db {
	const db = createTestDb();
	seedDatabase(db, { patrons: 30, teachers: 4, biblios: 20, items: 30, loans: 40, today: TODAY });
	mirrorTestSchool(db);
	return db;
}

/** An empty library with the classes of `from`: the patron import never creates classes. */
function target(from: Db): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const classes = from.$client
		.query<{ level: string; name: string }, []>(
			`SELECT gl.level_code AS level, g.name AS name FROM class_group g
			JOIN class_group_level gl ON gl.group_id = g.id WHERE g.kind = 'students'`,
		)
		.all();
	for (const c of classes) {
		classId(db, c.level, c.name);
	}
	teacherGroupId(db);
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

describe("exports that go back in", () => {
	it("write the headers of their imports, every column one the import reads", () => {
		// the exported files stay the same byte for byte
		expect(STUDENT_EXPORT_HEADER.join(";")).toBe(
			"first_name;last_name;level;section;external_id;card_number;email",
		);
		expect(TEACHER_EXPORT_HEADER.join(";")).toBe(
			"first_name;last_name;group;external_id;card_number;email",
		);
		expect(CATALOG_EXPORT_HEADER.join(";")).toBe(
			"biblio_key;isbn;issn;ean;title;subtitle;original_title;responsibility;author;publisher;" +
				"publication_place;publication_year;physical_description;series;series_number;dewey;" +
				"classification;reading_level;subjects;notes;barcode;call_number;item_type;" +
				"enumeration;status;not_for_loan;acquisition_date;item_notes",
		);
		expect(OPEN_LOANS_EXPORT_HEADER.join(";")).toBe("card_number;barcode;issued_on;due_on");
		const exports: [ImportSpec, string[]][] = [
			[STUDENT_IMPORT, STUDENT_EXPORT_HEADER],
			[TEACHER_IMPORT, TEACHER_EXPORT_HEADER],
			[CATALOG_IMPORT, CATALOG_EXPORT_HEADER],
			[LOAN_IMPORT, OPEN_LOANS_EXPORT_HEADER],
		];
		for (const [spec, header] of exports) {
			const mapping = headerMapping(spec, header) ?? [];
			expect(mapping).not.toContain(null);
			expect(mapping).toHaveLength(header.length);
			expect(isComplete(missingColumns(spec, mapping))).toBe(true);
		}
	});

	it("patrons, catalogue and open loans round-trip through the imports", () => {
		const from = source();
		const to = target(from);

		// students and teachers go back in through their own imports (9.19)
		let created = 0;
		for (const [audience, make] of [
			["students", studentsCsv],
			["teachers", teachersCsv],
		] as const) {
			const patrons = csv(make(from.$client));
			const pDetect = detectPatronFormat(patrons.rows, audience);
			expect(pDetect.header).toBe(true);
			expect(pDetect.certain).toBe(true);
			const columns = pDetect.mapping.filter((c): c is PatronImportColumn => c !== null);
			created += commitPatronImport(
				to.db,
				mapPatronRows(
					patrons.rows,
					pDetect.mapping,
					pDetect.header,
					audience,
					patrons.lines,
				),
				{
					audience,
					mode: "upsert",
					duplicatePolicy: "create",
					rules: PATRON_RULES,
					columns,
					canRemove: false,
					actor: to.actor,
					filename: `${audience}.csv`,
					storeFile: () => null,
					removeMissing: false,
					dataDir,
				},
			).created;
		}
		const people = (db: Db): string[] =>
			db.$client
				.query<Record<string, string | null>, []>(
					`SELECT p.last_name, p.first_name, p.patron_type, pc.class_label, p.card_number
					FROM patron p LEFT JOIN patron_class pc ON pc.patron_id = p.id`,
				)
				.all()
				.map((p) => Object.values(p).join("|"))
				.sort();
		expect(created).toBe(from.select().from(patron).all().length);
		expect(people(to.db)).toEqual(people(from));

		const catalog = csv(catalogCsv(from.$client));
		const cDetect = detectCatalogFormat(catalog.rows);
		expect(cDetect.header).toBe(true);
		commitCatalogImport(
			to.db,
			mapRows(catalog.rows, cDetect.mapping, cDetect.header, CATALOG_FIELDS, catalog.lines),
			{
				rules: catalogRules(config),
				useSpecialValues: false,
				today: TODAY,
				actor: to.actor,
				filename: "catalog.csv",
				storeFile: () => null,
			},
		);
		const barcodes = (db: Db): string[] =>
			db
				.select({ b: item.barcode })
				.from(item)
				.all()
				.map((r) => r.b)
				.sort();
		expect(barcodes(to.db)).toEqual(barcodes(from));
		expect(to.db.select().from(biblio).all().length).toBe(
			from.select().from(biblio).all().length,
		);
		// the original titles of the translations go back unchanged (9.23)
		const originals = (db: Db): string[] =>
			db
				.select({ title: biblio.title, original: biblio.originalTitle })
				.from(biblio)
				.all()
				.filter((r) => r.original !== null)
				.map((r) => `${r.title}|${r.original}`)
				.sort();
		expect(originals(from).length).toBeGreaterThan(0);
		expect(originals(to.db)).toEqual(originals(from));

		const open = csv(openLoansCsv(from.$client));
		const lDetect = detectLoanFormat(open.rows);
		const lSummary = commitLoanImport(
			to.db,
			mapRows(open.rows, lDetect.mapping, lDetect.header, LOAN_FIELDS, open.lines),
			{
				today: TODAY,
				schoolYearStart: config.library.schoolYearStart,
				codes: CODES,
				dueOf: () => TODAY,
				actor: to.actor,
				filename: "open-loans.csv",
				storeFile: () => null,
			},
		);
		const openCount = (db: Db): number =>
			db.select().from(loan).where(isNull(loan.returnedAt)).all().length;
		expect(lSummary.created).toBe(openCount(from));
		expect(openCount(to.db)).toBe(openCount(from));
	});

	it("writes the loan history with snapshots, the JSON dump and one patron's data", () => {
		const from = source();
		const history = csv(loansHistoryCsv(from.$client)).rows;
		expect(history[0]?.slice(0, 6)).toEqual([
			"loan",
			"card_number",
			"patron",
			"patron_type",
			"class",
			"school_year",
		]);
		expect(history.length - 1).toBe(from.select().from(loan).all().length);

		const dump = JSON.parse(text(databaseDump(from.$client, { version: "0.1.0" }))) as {
			format: string;
			tables: Record<string, Record<string, unknown>[]>;
		};
		expect(dump.format).toBe("biblioviva-dump");
		expect(dump.tables.patron?.length).toBe(from.select().from(patron).all().length);
		expect(dump.tables.loan?.length).toBe(from.select().from(loan).all().length);
		expect(Object.keys(dump.tables)).not.toContain("session");
		expect(Object.keys(dump.tables)).not.toContain("staff_user");

		const borrower = from.select({ id: loan.patronId }).from(loan).get()?.id ?? 0;
		const data = patronDataExport(from.$client, borrower) as {
			patron: { id: number };
			loans: unknown[];
		};
		expect(data.patron.id).toBe(borrower);
		expect(data.loans.length).toBe(
			from
				.select()
				.from(loan)
				.all()
				.filter((l) => l.patronId === borrower).length,
		);
		expect(patronDataExport(from.$client, 99_999)).toBeNull();
	});
});

describe("exports downloaded at the same time", () => {
	it("stream each its own rows when two run interleaved", () => {
		// the load test of 9.29: two catalogue downloads at once broke one of them ("This iterator
		// was invalidated: its statement was run again"), the two streams shared one statement
		const db = source();
		for (const make of [catalogCsv, openLoansCsv, loansHistoryCsv]) {
			const first = make(db.$client);
			const second = make(db.$client);
			const a = [first.next().value, first.next().value];
			const b = [second.next().value, second.next().value];
			const restA = [...first];
			const restB = [...second];
			expect([...a, ...restA].join("")).toBe([...b, ...restB].join(""));
		}
		const first = databaseDump(db.$client, { version: "test" });
		const second = databaseDump(db.$client, { version: "test" });
		first.next();
		first.next();
		second.next();
		second.next();
		expect([...first].join("").length).toBeGreaterThan(0);
		expect([...second].join("").length).toBeGreaterThan(0);
	});
});
