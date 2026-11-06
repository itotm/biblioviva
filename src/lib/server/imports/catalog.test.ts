// SPDX-License-Identifier: GPL-3.0-or-later
import { itemCode, withWrongCheck } from "../../../../tests/helpers/codes.js";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb, sequenceValue } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, biblio, importBatch, item, staffUser } from "#lib/server/db/schema.js";
import { catalogRules, createBiblio, type CatalogRules } from "#lib/server/services/catalog.js";
import { addItems } from "#lib/server/services/catalog-items.js";
import { moveClassesToItems } from "#lib/server/services/taxonomy.js";
import { readCsv, writeCsv } from "./csv.js";
import {
	commitCatalogImport,
	detectCatalogFormat,
	validateCatalogImport,
	type CatalogImportInput,
	type CatalogImportOptions,
	type CatalogImportSummary,
} from "./catalog.js";
import { ImportNotReadyError, mapRows, mappingComplete } from "./pipeline.js";
import { CATALOG_FIELDS, CATALOG_IMPORT } from "#lib/shared/import-columns.js";
import { callNumberScheme } from "#lib/shared/classification.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);
const TODAY = "2026-09-25";
const base: CatalogImportOptions = { rules, useSpecialValues: false, today: TODAY };

function setup(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

function inputsOf(csv: string): CatalogImportInput[] {
	const parsed = readCsv(new TextEncoder().encode(csv));
	const detection = detectCatalogFormat(parsed.rows);
	return mapRows(parsed.rows, detection.mapping, detection.header, CATALOG_FIELDS, parsed.lines);
}

const koha = (): CatalogImportInput[] =>
	inputsOf(readFileSync("docs/import/catalog-koha-sample.tsv", "utf8"));

function commit(
	db: Db,
	actor: { id: number },
	inputs: CatalogImportInput[],
	options = base,
): CatalogImportSummary {
	return commitCatalogImport(db, inputs, {
		...options,
		actor,
		filename: "catalogo.csv",
		storeFile: () => "imports/1/catalogo.csv",
	});
}

describe("format detection and mapping", () => {
	it("recognises the English header names only, in any case (Q115)", () => {
		const own = detectCatalogFormat([
			[
				"biblio_key",
				"isbn",
				"Title",
				"AUTHOR",
				"publisher",
				"classification",
				"reading level",
				"call-number",
				"boh",
			],
		]);
		expect(own.header).toBe(true);
		expect(own.mapping).toEqual([
			"biblioKey",
			"isbn",
			"title",
			"author",
			"publisher",
			"classification",
			"readingLevel",
			"callNumber",
			null,
		]);
		expect(own.certain).toBe(true);
		// the Italian names and Koha's own column names are no aliases
		const old = detectCatalogFormat([
			["titolo", "autore", "biblionumber", "ccode", "itemcallnumber", "kind"],
		]);
		expect(old).toMatchObject({ header: false, certain: false });
		const none = detectCatalogFormat([
			["a", "b"],
			["c", "d"],
		]);
		expect(none).toMatchObject({ header: false, certain: false, mapping: [null, null] });
		expect(mappingComplete(CATALOG_IMPORT, ["title", "author", "publisher"])).toBe(true);
		expect(mappingComplete(CATALOG_IMPORT, ["title", "author"])).toBe(false);
	});
});

describe("validate", () => {
	it("groups the Koha export by biblionumber, recognises the classification and asks the class question", () => {
		const { db } = setup();
		const result = validateCatalogImport(db, koha(), { ...base, useSpecialValues: true });
		// title 101 has copies in classes 3 and 4 while classPerItem is off: a question, not yet an answer
		expect(result.classPerItemQuestion).toBe(1);
		expect(result.canCommit).toBe(false);
		const [a, b, c, d] = result.rows;
		expect(a?.reasons.map((r) => r.code)).toEqual(["classQuestion"]);
		expect(a?.reasons[0]?.params).toEqual({ classes: "3, 4" });
		expect(b?.status).toBe("error");
		expect(c?.status).toBe("new");
		expect(d?.status).toBe("new");

		const yes = validateCatalogImport(db, koha(), {
			...base,
			useSpecialValues: true,
			enableClassPerItem: true,
		});
		expect(yes.canCommit).toBe(true);
		expect(yes.counts).toMatchObject({ new: 4, error: 0 });
		expect(yes.titles).toEqual({ new: 3, existing: 0 });

		const no = validateCatalogImport(db, koha(), {
			...base,
			useSpecialValues: true,
			enableClassPerItem: false,
		});
		expect(no.rows[0]?.reasons.map((r) => r.code)).toEqual(["classDiffers"]);
		expect(no.canCommit).toBe(false);
	});

	it("reports the missing author and publisher unless the special values are allowed", () => {
		const { db } = setup();
		const result = validateCatalogImport(db, koha(), { ...base, enableClassPerItem: true });
		const encyclopedia = result.rows.find((r) => r.data.biblioKey === "103");
		expect(encyclopedia?.status).toBe("error");
		expect(encyclopedia?.reasons.map((r) => r.code)).toEqual([
			"authorMissing",
			"publisherMissing",
		]);
	});

	it("explains every kind of row error", () => {
		const { db, actor } = setup();
		const existing = createBiblio(
			db,
			{
				title: "Già presente",
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Verdi, Anna",
				publisher: "Giunti",
				publicationPlace: "",
				publicationYear: "",
				isbn: "9788809766778",
				issn: "",
				ean: "",
				physicalDescription: "",
				series: "",
				seriesNumber: "",
				dewey: "",
				kind: "fiction",
				genreCode: "A",
				classCode: "",
				readingLevel: "",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
		const copy = {
			itemType: "libro",
			callNumber: "",
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "",
			notes: "",
			notForLoan: false,
		};
		addItems(db, existing, copy, 2, actor, rules);
		const [taken = "", ownCopy = ""] = db
			.select({ barcode: item.barcode })
			.from(item)
			.all()
			.map((i) => i.barcode);
		const csv = writeCsv([
			[
				"title",
				"author",
				"publisher",
				"isbn",
				"classification",
				"barcode",
				"status",
				"not_for_loan",
				"acquisition_date",
				"item_type",
			],
			["Uno", "A", "B", "123", "A", "", "", "", "", ""],
			["Due", "A", "B", "", "ZZZ", "", "", "", "", ""],
			["Tre", "A", "B", "", "A", "a;b", "", "", "", ""],
			["Quattro", "A", "B", "", "A", withWrongCheck(itemCode(2026, 423)), "", "", "", ""],
			["Cinque", "A", "B", "", "A", "X1", "", "", "", ""],
			["Sei", "A", "B", "", "A", "X1", "", "", "", ""],
			["Sette", "A", "B", "", "A", taken, "", "", "", ""],
			["Otto", "A", "B", "", "A", "", "sparito", "forse", "31/02/2020", ""],
			["Nove", "A", "B", "", "A", "", "", "", "", "vinile"],
			["", "A", "B", "", "A", "", "", "", "", ""],
			["Dieci", "A", "B", "", "", "", "", "", "", ""],
			["Undici", "A", "B", "", "", "", "", "", "", ""],
			["Già presente", "Verdi, Anna", "Giunti", "978-88-09-76677-8", "A", "", "", "", "", ""],
			[
				"Già presente",
				"Verdi, Anna",
				"Giunti",
				"9788809766778",
				"A",
				ownCopy,
				"",
				"",
				"",
				"",
			],
		]);
		const result = validateCatalogImport(db, inputsOf(csv), base);
		const codes = (line: number): string[] =>
			result.rows.find((r) => r.line === line)?.reasons.map((r) => r.code) ?? [];
		expect(codes(2)).toEqual(["isbnInvalid"]);
		expect(codes(3)).toContain("classificationUnknown");
		expect(codes(4)).toEqual(["barcodeInvalid"]);
		expect(codes(5)).toEqual(["barcodeCheckDigit"]);
		expect(codes(6)).toEqual([]);
		expect(codes(7)).toEqual(["barcodeDuplicateInFile"]);
		expect(codes(8)).toEqual(["barcodeTaken"]);
		expect(codes(9)).toEqual(["statusUnknown", "notForLoanUnknown", "dateInvalid"]);
		expect(codes(10)).toEqual(["catalog.itemTypeUnknown"]);
		expect(codes(11)).toEqual(["titleMissing"]);
		// no classification: the titles go to "Da classificare" (9.21), no error
		expect(codes(12)).toEqual([]);
		expect(codes(13)).toEqual([]);
		expect(result.toClassify).toBe(2);
		// copies without a barcode get one at commit
		expect(result.generatedBarcodes).toBeGreaterThan(0);
		// same ISBN as a record in the catalogue: copies are added to it; the copy it already has is skipped
		expect(codes(14)).toEqual(["mergedIntoExisting"]);
		expect(result.rows.find((r) => r.line === 14)?.biblioId).toBe(existing);
		expect(codes(15)).toEqual(["copyExists"]);
		expect(result.rows.find((r) => r.line === 15)?.status).toBe("unchanged");
		expect(result.titles.existing).toBe(1);
		expect(result.canCommit).toBe(false);
	});

	it("applies the length caps of the forms to every text column", () => {
		const { db } = setup();
		const csv = writeCsv([
			["title", "author", "publisher", "classification", "notes", "item_notes"],
			["x".repeat(301), "A", "B", "A", "n".repeat(2001), ""],
			["Giusto", "A", "B", "A", "n".repeat(2000), "c".repeat(501)],
		]);
		const result = validateCatalogImport(db, inputsOf(csv), base);
		expect(result.rows[0]?.reasons).toEqual([
			{ code: "tooLong", params: { column: "title", max: 300 } },
			{ code: "tooLong", params: { column: "notes", max: 2000 } },
		]);
		expect(result.rows[1]?.reasons).toEqual([
			{ code: "tooLong", params: { column: "item_notes", max: 500 } },
		]);
		expect(result.canCommit).toBe(false);
	});

	it("reads a reading level by code or name in any case, and Koha's S as none", () => {
		const { db } = setup();
		const csv = writeCsv([
			["title", "author", "publisher", "classification", "reading_level"],
			["Uno", "A", "B", "D", "4ª"],
			["Due", "A", "B", "D", "s"],
			["Tre", "A", "B", "D", "zz"],
		]);
		const result = validateCatalogImport(db, inputsOf(csv), base);
		const codes = (line: number): string[] =>
			result.rows.find((r) => r.line === line)?.reasons.map((r) => r.code) ?? [];
		expect(codes(2)).toEqual([]);
		expect(codes(3)).toEqual([]);
		expect(codes(4)).toContain("catalog.readingLevelOutOfRange");
	});

	it("flags a shared key used by two different titles and non-fiction with a reading level", () => {
		const { db } = setup();
		const csv = writeCsv([
			["biblio_key", "title", "author", "publisher", "classification", "reading_level"],
			["7", "Primo", "A", "B", "A", "2"],
			["7", "Secondo", "A", "B", "A", "2"],
			["8", "Terzo", "A", "B", "590", "S"],
		]);
		const result = validateCatalogImport(db, inputsOf(csv), base);
		expect(result.rows[1]?.reasons.map((r) => r.code)).toEqual(["groupConflict"]);
		// Koha's `S` in the class column of a non-fiction copy is not a class
		expect(result.rows[2]?.status).toBe("new");
	});
});

describe("commit", () => {
	it("puts the class-per-copy flag back when the transaction fails", () => {
		const { db, actor } = setup();
		const flag: boolean[] = [];
		// the disk or a constraint fails inside the transaction
		db.transaction = () => {
			throw new Error("disk full");
		};
		expect(() =>
			commitCatalogImport(db, koha(), {
				...base,
				useSpecialValues: true,
				enableClassPerItem: true,
				actor,
				filename: "catalogo.csv",
				storeFile: () => "imports/1/catalogo.csv",
				setClassPerItemInConfig: (on) => {
					flag.push(on);
				},
			}),
		).toThrow("disk full");
		// switched on for the import, then off again: the records keep their classes
		expect(flag).toEqual([true, false]);
	});

	it("imports the Koha sample in one transaction: records, copies, legacy barcodes, class per copy", () => {
		const { db, actor } = setup();
		let enabled = 0;
		const summary = commitCatalogImport(db, koha(), {
			...base,
			useSpecialValues: true,
			enableClassPerItem: true,
			actor,
			filename: "catalogo.csv",
			storeFile: () => "imports/1/catalogo.csv",
			setClassPerItemInConfig: (on) => {
				enabled += on ? 1 : 100;
			},
		});
		expect(enabled).toBe(1);
		expect(summary).toMatchObject({
			titlesCreated: 3,
			titlesMerged: 0,
			copiesCreated: 4,
			copiesSkipped: 0,
			classPerItemEnabled: true,
		});
		expect(summary.generatedItemIds).toEqual([]);
		const cat = db.select().from(biblio).where(eq(biblio.sourceId, "101")).get();
		expect(cat).toMatchObject({
			title: "Il gatto con gli stivali",
			isbn: "9788804668237",
			kind: "fiction",
			genreCode: "D",
			readingLevel: null,
			source: "import",
			physicalDescription: "32 p. : ill. ; 24 cm",
			publicationPlace: "Torino",
		});
		const copies = db
			.select()
			.from(item)
			.where(eq(item.biblioId, cat?.id ?? 0))
			.all();
		expect(copies.map((c) => [c.barcode, c.readingLevel, c.callNumber])).toEqual([
			["2019-0042", "3", "D 3 PER"],
			["2019-0043", "4", "D 4 PER"],
		]);
		// the labels on the shelves came from the old system
		expect(copies[0]?.barcodeLabelPrintedAt).not.toBeNull();
		const animals = db.select().from(biblio).where(eq(biblio.sourceId, "102")).get();
		expect(animals).toMatchObject({ kind: "nonfiction", classCode: "590" });
		const lost = db.select().from(item).where(eq(item.barcode, "217")).get();
		expect(lost).toMatchObject({
			status: "lost",
			notes: "copertina rovinata",
			acquisitionDate: "2021-03-15",
		});
		const encyclopedia = db.select().from(biblio).where(eq(biblio.sourceId, "103")).get();
		expect(encyclopedia).toMatchObject({
			author: "Anonimo",
			publisher: "s.n.",
			classCode: "030",
			// Koha's reference type: a book whose copy is kept from loans (Q139)
			itemType: "libro",
		});
		expect(db.select().from(item).where(eq(item.barcode, "218")).get()).toMatchObject({
			notForLoan: 1,
			enumeration: "vol. 1",
		});
		const batch = db.select().from(importBatch).get();
		expect(batch).toMatchObject({ kind: "catalog", storedPath: "imports/1/catalogo.csv" });
		expect((batch?.summary as { createdItemIds: number[] }).createdItemIds).toHaveLength(4);
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "import.catalog")).all(),
		).toHaveLength(1);

		// the same file again: every copy exists, nothing to import
		const again = validateCatalogImport(db, koha(), {
			...base,
			useSpecialValues: true,
			enableClassPerItem: true,
		});
		expect(again.counts).toMatchObject({ new: 0, unchanged: 4, error: 0 });
		expect(again.canCommit).toBe(false);
	});

	it("generates barcodes for copies without one and moves the year's counter past imported codes", () => {
		const { db, actor } = setup();
		const csv = writeCsv([
			["title", "author", "publisher", "classification", "barcode"],
			["Nuovo", "A", "B", "A", itemCode(2026, 40)],
			["Senza codice", "A", "B", "A", ""],
		]);
		const summary = commit(db, actor, inputsOf(csv));
		expect(summary.copiesCreated).toBe(2);
		expect(summary.generatedItemIds).toHaveLength(1);
		const generated = db
			.select()
			.from(item)
			.where(eq(item.id, summary.generatedItemIds[0] ?? 0))
			.get();
		// counter 40 was imported: the new code is the 41st of the year, with no label printed yet
		expect(generated?.barcode).toBe(itemCode(2026, 41));
		expect(generated?.barcodeLabelPrintedAt).toBeNull();
		expect(generated?.acquisitionDate).toBe(TODAY);
		expect(generated?.callNumber).toBe("A A");
		expect(sequenceValue(db, "item:YYYY-CNNNN:2026")).toBe(41);
	});

	it("imports the series and its number, splitting a statement without a number column", () => {
		const { db, actor } = setup();
		const csv = writeCsv([
			["title", "author", "publisher", "classification", "series", "series_number"],
			["Primo", "A", "B", "A", "Pepe Lampo", "1"],
			["Secondo", "A", "B", "A", "Pepe Lampo ; 2", ""],
			["Terzo", "A", "B", "A", "", ""],
		]);
		commit(db, actor, inputsOf(csv));
		const rows = db
			.select({ title: biblio.title, series: biblio.series, n: biblio.seriesNumber })
			.from(biblio)
			.all();
		expect(rows).toEqual([
			{ title: "Primo", series: "Pepe Lampo", n: "1" },
			{ title: "Secondo", series: "Pepe Lampo", n: "2" },
			{ title: "Terzo", series: null, n: null },
		]);
	});

	it("asks which material a title takes when its copies differ (9.45, Q139)", () => {
		const { db, actor } = setup();
		const csv = writeCsv([
			["biblio_key", "title", "author", "publisher", "classification", "item_type"],
			["1", "Atlante", "A", "B", "A", "dvd"],
			["1", "Atlante", "A", "B", "A", "rivista"],
			["1", "Atlante", "A", "B", "A", "rivista"],
			["2", "Fiabe", "A", "B", "A", ""],
			// Koha's reference type is a copy excluded from loans, not a material
			["3", "Enciclopedia", "A", "B", "A", "dvd"],
			["3", "Enciclopedia", "A", "B", "A", "consultazione"],
		]);
		const asked = validateCatalogImport(db, inputsOf(csv), base);
		expect(asked.typeQuestion).toBe(1);
		expect(asked.canCommit).toBe(false);
		expect(asked.rows[0]?.reasons).toEqual([
			{ code: "typeQuestion", params: { types: "rivista, dvd" } },
		]);
		expect(asked.rows[4]?.status).toBe("new");
		const no = validateCatalogImport(db, inputsOf(csv), { ...base, useMajorityType: false });
		expect(no.rows[0]?.reasons.map((r) => r.code)).toEqual(["typeDiffers"]);
		expect(() => commit(db, actor, inputsOf(csv))).toThrow(ImportNotReadyError);
		// yes: the record takes the type of most of its copies, a title without a type the first one
		commit(db, actor, inputsOf(csv), { ...base, useMajorityType: true });
		const types = db
			.select({ title: biblio.title, itemType: biblio.itemType })
			.from(biblio)
			.all();
		expect(types).toEqual([
			{ title: "Atlante", itemType: "rivista" },
			{ title: "Fiabe", itemType: rules.itemTypes[0]?.code },
			{ title: "Enciclopedia", itemType: "dvd" },
		]);
		// only the reference copy is kept from loans
		expect(
			db
				.select({ n: item.notForLoan })
				.from(item)
				.all()
				.map((r) => r.n),
		).toEqual([0, 0, 0, 0, 0, 1]);
	});

	it("asks whether copies take the computed segnatura when the file's differs (9.50, Q143)", () => {
		const { db, actor } = setup();
		const csv = writeCsv([
			[
				"biblio_key",
				"title",
				"author",
				"publisher",
				"classification",
				"barcode",
				"call_number",
			],
			["1", "Pinocchio", "Collodi, Carlo", "B", "A", "100", "A COL"],
			["1", "Pinocchio", "Collodi, Carlo", "B", "A", "101", "A PIN"],
			["2", "Favole", "Rodari, Gianni", "B", "A", "102", ""],
		]);
		const asked = validateCatalogImport(db, inputsOf(csv), base);
		expect(asked.callNumberQuestion).toBe(1);
		expect(asked.canCommit).toBe(false);
		expect(asked.rows.map((r) => r.status)).toEqual(["new", "error", "new"]);
		expect(asked.rows[1]?.reasons).toEqual([
			{ code: "callNumberQuestion", params: { value: "A PIN", computed: "A COL" } },
		]);
		const no = validateCatalogImport(db, inputsOf(csv), {
			...base,
			useComputedCallNumbers: false,
		});
		expect(no.rows[1]?.reasons.map((r) => r.code)).toEqual(["callNumberDiffers"]);
		expect(() => commit(db, actor, inputsOf(csv))).toThrow(ImportNotReadyError);
		commit(db, actor, inputsOf(csv), { ...base, useComputedCallNumbers: true });
		const copies = db.select().from(item).all();
		expect(copies.map((c) => c.callNumber)).toEqual(["A COL", "A COL", "A ROD"]);
		// the old labels show another segnatura: that copy's are to print again
		expect(copies.map((c) => c.barcodeLabelPrintedAt === null)).toEqual([false, true, false]);
	});

	it("reads the title's text and the copies' texts from the file's segnature (9.50, Q143)", () => {
		const csv = writeCsv([
			["biblio_key", "title", "author", "publisher", "classification", "call_number"],
			["1", "Pinocchio", "Collodi, Carlo", "B", "A", "A COLL"],
			["1", "Pinocchio", "Collodi, Carlo", "B", "A", "A COLL"],
			["2", "Favole", "Rodari, Gianni", "B", "A", "A ROD"],
		]);
		const text = {
			...rules,
			scheme: { ...rules.scheme, callNumber: callNumberScheme("genreLevel", "text") },
		};
		const one = setup();
		const read = validateCatalogImport(one.db, inputsOf(csv), { ...base, rules: text });
		expect(read.callNumberQuestion).toBe(0);
		commit(one.db, one.actor, inputsOf(csv), { ...base, rules: text });
		// the proposal (the author's initials) is not stored: it follows the author
		expect(one.db.select({ t: biblio.callText }).from(biblio).all()).toEqual([
			{ t: "COLL" },
			{ t: null },
		]);
		expect(
			one.db
				.select({ c: item.callNumber })
				.from(item)
				.all()
				.map((r) => r.c),
		).toEqual(["A COLL", "A COLL", "A ROD"]);
		// the free scheme keeps each segnatura as it is, as the copy's text
		const free = {
			...rules,
			scheme: { ...rules.scheme, callNumber: callNumberScheme("free", "author") },
		};
		const two = setup();
		expect(
			validateCatalogImport(two.db, inputsOf(csv), { ...base, rules: free })
				.callNumberQuestion,
		).toBe(0);
		commit(two.db, two.actor, inputsOf(csv), { ...base, rules: free });
		expect(two.db.select({ t: item.callText, c: item.callNumber }).from(item).all()).toEqual([
			{ t: "A COLL", c: "A COLL" },
			{ t: "A COLL", c: "A COLL" },
			{ t: "A ROD", c: "A ROD" },
		]);
	});

	it("imports the original title of a translation (9.23)", () => {
		const { db, actor } = setup();
		const csv = writeCsv([
			["title", "author", "publisher", "classification", "original_title"],
			[
				"Il piccolo principe",
				"Saint-Exupéry, Antoine de",
				"Bompiani",
				"A",
				"Le petit prince",
			],
			["Pinocchio", "Collodi, Carlo", "Giunti", "A", ""],
		]);
		commit(db, actor, inputsOf(csv));
		expect(
			db.select({ title: biblio.title, original: biblio.originalTitle }).from(biblio).all(),
		).toEqual([
			{ title: "Il piccolo principe", original: "Le petit prince" },
			{ title: "Pinocchio", original: null },
		]);
	});

	it("refuses a file with errors or an unanswered question and writes nothing", () => {
		const { db, actor } = setup();
		expect(() => commit(db, actor, koha(), { ...base, useSpecialValues: true })).toThrow(
			ImportNotReadyError,
		);
		expect(() => commit(db, actor, koha())).toThrow(ImportNotReadyError);
		expect(db.select().from(biblio).all()).toHaveLength(0);
		expect(db.select().from(importBatch).all()).toHaveLength(0);
	});

	it("moves the class of existing records onto their copies when class per copy is turned on", () => {
		const { db, actor } = setup();
		const record = createBiblio(
			db,
			{
				title: "Vecchio",
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Neri, Ugo",
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
				kind: "fiction",
				genreCode: "B",
				classCode: "",
				readingLevel: "2",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
		addItems(
			db,
			record,
			{
				readingLevel: "",
				enumeration: "",
				acquisitionDate: "",
				notes: "",
				notForLoan: false,
			},
			2,
			actor,
			rules,
		);
		expect(moveClassesToItems(db)).toBe(2);
		expect(db.select().from(biblio).get()?.readingLevel).toBeNull();
		expect(
			db
				.select()
				.from(item)
				.all()
				.map((i) => i.readingLevel),
		).toEqual(["2", "2"]);
		const perItem: CatalogRules = { ...rules, scheme: { ...rules.scheme, classPerItem: true } };
		const r = validateCatalogImport(db, koha(), {
			...base,
			rules: perItem,
			useSpecialValues: true,
		});
		// with the flag already on, there is no question and each copy keeps its own class
		expect(r.classPerItemQuestion).toBe(0);
		expect(r.canCommit).toBe(true);
	});

	it("imports 1 000 copies in less than five seconds", () => {
		const { db, actor } = setup();
		const rows = [
			[
				"biblio_key",
				"title",
				"author",
				"publisher",
				"classification",
				"reading_level",
				"barcode",
			],
		];
		for (let i = 0; i < 1000; i++) {
			const key = String(Math.floor(i / 2));
			rows.push([
				key,
				`Titolo ${key}`,
				"Rossi, Anna",
				"Giunti",
				i % 3 ? "B" : "590",
				i % 3 ? "2" : "S",
				String(10_000 + i),
			]);
		}
		const started = performance.now();
		const summary = commit(db, actor, inputsOf(writeCsv(rows)));
		expect(performance.now() - started).toBeLessThan(5000);
		expect(summary.copiesCreated).toBe(1000);
		expect(summary.titlesCreated).toBe(500);
	});
});
