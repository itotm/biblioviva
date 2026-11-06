// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import {
	auditLog,
	importBatch,
	item,
	loan,
	loanEvent,
	patron,
	staffUser,
} from "#lib/server/db/schema.js";
import { catalogRules, createBiblio } from "#lib/server/services/catalog.js";
import { addItems, setItemStatus } from "#lib/server/services/catalog-items.js";
import { createPatron } from "#lib/server/services/patrons.js";
import { readCsv, writeCsv } from "./csv.js";
import {
	commitLoanImport,
	detectLoanFormat,
	validateLoanImport,
	type LoanImportInput,
} from "./loans.js";
import { ImportNotReadyError, mapRows, mappingComplete } from "./pipeline.js";
import { LOAN_FIELDS, LOAN_IMPORT } from "#lib/shared/import-columns.js";

import { TEST_CODES } from "../../../../tests/helpers/codes.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

const CODES = TEST_CODES;
const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);
/** The due date of a loan without one: 30 days for every patron and copy in these tests. */
const dueOf = (patronType: string, itemType: string, issuedOn: string): string =>
	`${issuedOn}|${patronType}|${itemType}`;
const options = { today: "2026-09-25", schoolYearStart: "09-01", codes: CODES, dueOf };

interface Fixture {
	db: Db;
	actor: { id: number };
	cards: string[];
	barcodes: string[];
	patronIds: number[];
}

function setup(): Fixture {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const patronRules = PATRON_RULES;
	const groupId = String(classId(db, "3", "A"));
	const patronIds = ["Rossi", "Bianchi"].map((lastName) =>
		createPatron(
			db,
			{
				patronType: "student",
				firstName: "Anna",
				lastName,
				levelCode: "3",
				groupId,
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			patronRules,
		),
	);
	const cards = patronIds.map(
		(id) =>
			db.select({ c: patron.cardNumber }).from(patron).where(eq(patron.id, id)).get()?.c ??
			"",
	);
	const record = createBiblio(
		db,
		{
			title: "Il gatto",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Perrault, Charles",
			publisher: "Einaudi",
			publicationPlace: "",
			publicationYear: "",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
			kind: "fiction",
			genreCode: "B",
			classCode: "",
			readingLevel: "3",
			subjects: "",
			notes: "",
		},
		actor,
		rules,
	);
	const { barcodes } = addItems(
		db,
		record,
		{
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "",
			notes: "",
			notForLoan: false,
		},
		4,
		actor,
		rules,
	);
	return { db, actor, cards, barcodes, patronIds };
}

function inputsOf(rows: string[][]): LoanImportInput[] {
	const parsed = readCsv(new TextEncoder().encode(writeCsv(rows)));
	const detection = detectLoanFormat(parsed.rows);
	return mapRows(parsed.rows, detection.mapping, detection.header, LOAN_FIELDS, parsed.lines);
}

describe("open loans import", () => {
	it("detects the English columns by header (Q115) or takes them by position", () => {
		expect(
			detectLoanFormat([["card_number", "barcode", "issued_on", "due_on"]]).mapping,
		).toEqual(["cardNumber", "barcode", "issuedOn", "dueOn"]);
		expect(detectLoanFormat([["Card number", "due_on", "BARCODE"]]).mapping).toEqual([
			"cardNumber",
			"dueOn",
			"barcode",
		]);
		// the Italian and Koha names of the old template are not headers
		expect(detectLoanFormat([["tessera", "barcode", "data_prestito", "scadenza"]]).header).toBe(
			false,
		);
		expect(detectLoanFormat([["0000001240", "2019-0042"]]).mapping).toEqual([
			"cardNumber",
			"barcode",
		]);
		const positional = detectLoanFormat([
			["0000001240", "2019-0042", "2026-09-10", "2026-10-10"],
		]);
		expect(positional).toMatchObject({ header: false, certain: false });
		expect(mappingComplete(LOAN_IMPORT, positional.mapping)).toBe(true);
		expect(detectLoanFormat([["a"]]).mapping).toEqual([null]);
	});

	it("validates every row and explains the errors", () => {
		const { db, actor, cards, barcodes } = setup();
		const [c1 = "", c2 = ""] = cards;
		const [b1 = "", b2 = "", b3 = "", b4 = ""] = barcodes;
		setItemStatus(
			db,
			db.select().from(item).where(eq(item.barcode, b4)).get()?.id ?? 0,
			"withdrawn",
			null,
			actor,
		);
		const result = validateLoanImport(
			db,
			inputsOf([
				["card_number", "barcode", "issued_on", "due_on"],
				[c1, b1, "10/09/2026", "2026-10-10"],
				[c2, b2, "2026-08-01", "2026-09-01"],
				[c2, b1, "2026-09-10", "2026-10-10"],
				["", b3, "2026-09-10", "2026-10-10"],
				["9999999999", "", "2026-09-10", "2026-10-10"],
				[c1, "2099-0001", "2026-09-10", "2026-10-10"],
				[c1, b3, "domani", "2026-09-01"],
				[c1, b3, "2026-12-01", "x"],
				[c1, b3, "2026-09-10", "2026-09-01"],
				[c1, b4, "2026-09-10", "2026-10-10"],
			]),
			options,
		);
		const codes = result.rows.map((r) => r.reasons.map((x) => x.code));
		expect(codes).toEqual([
			[],
			["overdue"],
			["duplicateInFile"],
			["cardMissing"],
			["cardUnknown", "barcodeMissing"],
			["barcodeUnknown"],
			// the same copy as line 5: listed as a duplicate too
			["duplicateInFile", "issueDateInvalid"],
			["duplicateInFile", "issueDateFuture", "dueDateInvalid"],
			["duplicateInFile", "dueBeforeIssue"],
			["itemWithdrawn"],
		]);
		expect(result.rows[0]).toMatchObject({
			status: "new",
			issuedOn: "2026-09-10",
			patronName: "Rossi Anna",
		});
		// an overdue loan is information, not an error
		expect(result.rows[1]?.status).toBe("new");
		expect(result.overdue).toBe(1);
		expect(result.counts).toMatchObject({ new: 2, error: 8 });
		expect(result.canCommit).toBe(false);
	});

	it("lends today and computes the due date when the file has no dates (9.19)", () => {
		const { db, cards, barcodes } = setup();
		const result = validateLoanImport(
			db,
			inputsOf([
				["card_number", "barcode"],
				[cards[0] ?? "", barcodes[0] ?? ""],
			]),
			options,
		);
		expect(result.rows[0]).toMatchObject({
			status: "new",
			issuedOn: "2026-09-25",
			dueOn: "2026-09-25|student|libro",
		});
		// an empty date cell is the same as no column
		const empty = validateLoanImport(
			db,
			inputsOf([
				["card_number", "barcode", "issued_on", "due_on"],
				[cards[1] ?? "", barcodes[1] ?? "", "2026-09-01", ""],
			]),
			options,
		);
		expect(empty.rows[0]).toMatchObject({
			issuedOn: "2026-09-01",
			dueOn: "2026-09-01|student|libro",
		});
	});

	it("accepts a copy of a book still to classify, with a warning (9.21)", () => {
		const { db, actor, cards } = setup();
		const later = createBiblio(
			db,
			{
				title: "Da classificare",
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Rossi, Anna",
				publisher: "Giunti",
				publicationPlace: "",
				publicationYear: "",
				isbn: "",
				issn: "",
				ean: "",
				physicalDescription: "",
				series: "",
				seriesNumber: "",
				dewey: "",
				kind: "",
				genreCode: "",
				classCode: "",
				readingLevel: "",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
		const copy = addItems(
			db,
			later,
			{
				readingLevel: "",
				enumeration: "",
				acquisitionDate: "",
				notes: "",
				notForLoan: false,
			},
			1,
			actor,
			rules,
		);
		const result = validateLoanImport(
			db,
			inputsOf([
				["card_number", "barcode", "issued_on", "due_on"],
				[cards[0] ?? "", copy.barcodes[0] ?? "", "2026-09-10", "2026-10-10"],
			]),
			options,
		);
		expect(result.rows[0]).toMatchObject({
			status: "new",
			reasons: [{ code: "itemUnclassified", params: { value: copy.barcodes[0] } }],
		});
		expect(result.canCommit).toBe(true);
	});

	it("creates the loans with their original dates and an issue event, in one transaction", () => {
		const { db, actor, cards, barcodes, patronIds } = setup();
		const inputs = inputsOf([
			["card_number", "barcode", "issued_on", "due_on"],
			[cards[0] ?? "", barcodes[0] ?? "", "2026-09-10", "2026-10-10"],
			[cards[1] ?? "", barcodes[1] ?? "", "2026-06-01", "2026-06-30"],
		]);
		const summary = commitLoanImport(db, inputs, {
			...options,
			actor,
			filename: "loans.csv",
			storeFile: () => "imports/1/loans.csv",
		});
		expect(summary).toMatchObject({ created: 2, overdue: 1 });
		const loans = db.select().from(loan).all();
		expect(
			loans.map((l) => [l.patronId, l.dueDate, l.issuedAt.slice(0, 10), l.schoolYear]),
		).toEqual([
			[patronIds[0], "2026-10-10", "2026-09-10", "2026/2027"],
			[patronIds[1], "2026-06-30", "2026-06-01", "2025/2026"],
		]);
		expect(loans[0]).toMatchObject({
			levelSnapshot: "3",
			groupSnapshot: "A",
			classLabelSnapshot: "3 A",
			patronTypeSnapshot: "student",
		});
		const events = db.select().from(loanEvent).all();
		expect(events.map((e) => [e.type, e.details])).toEqual([
			["issue", { imported: summary.batchId }],
			["issue", { imported: summary.batchId }],
		]);
		expect(db.select().from(importBatch).get()).toMatchObject({
			kind: "loans",
			storedPath: "imports/1/loans.csv",
		});
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "import.loans")).all(),
		).toHaveLength(1);

		// the same file again: the copies are on loan now, so nothing can be imported twice
		const again = validateLoanImport(db, inputs, options);
		expect(again.rows.map((r) => r.reasons[0]?.code)).toEqual([
			"alreadyOnLoan",
			"alreadyOnLoan",
		]);
		expect(() =>
			commitLoanImport(db, inputs, {
				...options,
				actor,
				filename: "x.csv",
				storeFile: () => null,
			}),
		).toThrow(ImportNotReadyError);
		expect(db.select().from(loan).all()).toHaveLength(2);
	});
});
