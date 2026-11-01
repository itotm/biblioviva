// SPDX-License-Identifier: GPL-3.0-or-later
import { TEST_CODES as CODES, itemCode } from "../../../../tests/helpers/codes.js";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { inClass } from "../../../../tests/helpers/school.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, biblio, item, loan, patron, staffUser } from "#lib/server/db/schema.js";
import type { BiblioFormInput, ItemFormInput } from "#lib/shared/catalog-schema.js";
import {
	BiblioHasItemsError,
	BiblioNotFoundError,
	catalogRules,
	CatalogValidationError,
	classificationOptions,
	createBiblio,
	deleteBiblio,
	findBiblioByIsbn,
	ItemNotFoundError,
	ItemOnLoanError,
	suggestedCallNumber,
	updateBiblio,
	validateBiblio,
	type CatalogRules,
} from "./catalog.js";
import {
	updateBiblioWithItem,
	addItems,
	deleteItem,
	setItemStatus,
	updateItem,
	validateItem,
} from "./catalog-items.js";
import {
	getBiblio,
	searchBiblios,
	catalogDirectHit,
	seriesNames,
	type ItemRow,
} from "./catalog-search.js";
import {
	classifiedCallNumber,
	classifyBiblio,
	listUnclassified,
	nextUnclassified,
	unclassifiedCount,
} from "./catalog-classify.js";
import type { Db } from "#lib/server/db/client.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);

const fiction: BiblioFormInput = {
	title: "Il gatto con gli stivali",
	subtitle: "",
	originalTitle: "",
	responsibility: "",
	author: "Perrault, Charles",
	publisher: "Einaudi",
	publicationPlace: "Torino",
	publicationYear: "2019",
	isbn: "88-04-66823-7",
	issn: "",
	ean: "",
	physicalDescription: "32 p. : ill. ; 24 cm",
	series: "",
	seriesNumber: "",
	dewey: "",
	kind: "fiction",
	genreCode: "G",
	classCode: "",
	readingLevel: "2",
	subjects: "",
	notes: "",
};
const nonfiction: BiblioFormInput = {
	...fiction,
	title: "Gli animali della fattoria",
	author: "Rossi, Anna",
	isbn: "",
	kind: "nonfiction",
	genreCode: "",
	classCode: "590",
	readingLevel: "",
	dewey: "590",
	subjects: "animali, fattoria\nnatura",
};
const copy: ItemFormInput = {
	itemType: "libro",
	callNumber: "",
	readingLevel: "",
	enumeration: "",
	acquisitionDate: "",
	notes: "",
	notForLoan: false,
};

const codes = (fn: () => unknown): string[] => {
	try {
		fn();
		return [];
	} catch (e) {
		if (e instanceof CatalogValidationError) {
			return e.issues.map((i) => `${i.field}:${i.code}`);
		}
		throw e;
	}
};

function setup(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

/** A copy as the record page shows it (the test reads back what the services wrote). */
function copyOf(db: Db, biblioId: number, itemId: number): ItemRow {
	const found = getBiblio(db, biblioId, rules).items.find((i) => i.id === itemId);
	if (!found) {
		throw new Error(`copy ${String(itemId)} not found`);
	}
	return found;
}

describe("biblio validation (§3.17)", () => {
	it("normalises identifiers and subjects, checks the year", () => {
		const data = validateBiblio(fiction, rules);
		expect(data.isbn).toBe("9788804668237");
		expect(data.publicationYear).toBe(2019);
		expect(validateBiblio(nonfiction, rules).subjects).toEqual([
			"animali",
			"fattoria",
			"natura",
		]);
		expect(codes(() => validateBiblio({ ...fiction, isbn: "12345" }, rules))).toEqual([
			"isbn:isbnInvalid",
		]);
		expect(codes(() => validateBiblio({ ...fiction, publicationYear: "1200" }, rules))).toEqual(
			["publicationYear:yearImplausible"],
		);
		expect(codes(() => validateBiblio({ ...fiction, ean: "4006381333931" }, rules))).toEqual(
			[],
		);
		expect(codes(() => validateBiblio({ ...fiction, ean: "4006381333930" }, rules))).toEqual([
			"ean:eanInvalid",
		]);
		expect(codes(() => validateBiblio({ ...fiction, issn: "1234-567X" }, rules))).toEqual([]);
		expect(codes(() => validateBiblio({ ...fiction, issn: "abc" }, rules))).toEqual([
			"issn:issnInvalid",
		]);
	});

	it("fiction needs a known genre, non-fiction a known class; the other code is refused", () => {
		expect(codes(() => validateBiblio({ ...fiction, genreCode: "" }, rules))).toEqual([
			"genreCode:genreRequired",
		]);
		expect(codes(() => validateBiblio({ ...fiction, genreCode: "ZZ" }, rules))).toEqual([
			"genreCode:genreUnknown",
		]);
		expect(codes(() => validateBiblio({ ...fiction, classCode: "590" }, rules))).toEqual([
			"classCode:classCodeNotForFiction",
		]);
		expect(codes(() => validateBiblio({ ...nonfiction, classCode: "" }, rules))).toEqual([
			"classCode:classCodeRequired",
		]);
		expect(codes(() => validateBiblio({ ...nonfiction, classCode: "999" }, rules))).toEqual([
			"classCode:classCodeUnknown",
		]);
		expect(codes(() => validateBiblio({ ...nonfiction, genreCode: "A" }, rules))).toEqual([
			"genreCode:genreNotForNonfiction",
		]);
		expect(codes(() => validateBiblio({ ...nonfiction, readingLevel: "2" }, rules))).toEqual([
			"readingLevel:readingLevelNotAllowed",
		]);
	});

	it("the associated class follows the flags: on the record, on the copy, or nowhere", () => {
		expect(validateBiblio(fiction, rules).readingLevel).toBe("2");
		expect(codes(() => validateBiblio({ ...fiction, readingLevel: "9" }, rules))).toEqual([
			"readingLevel:readingLevelOutOfRange",
		]);
		const noClass: CatalogRules = {
			...rules,
			scheme: { ...rules.scheme, fictionByClass: false },
		};
		expect(codes(() => validateBiblio(fiction, noClass))).toEqual([
			"readingLevel:readingLevelNotAllowed",
		]);
		expect(validateBiblio({ ...fiction, readingLevel: "" }, noClass).readingLevel).toBeNull();
		const perItem: CatalogRules = { ...rules, scheme: { ...rules.scheme, classPerItem: true } };
		expect(codes(() => validateBiblio(fiction, perItem))).toEqual([
			"readingLevel:readingLevelNotAllowed",
		]);
		// the copy carries the class only with the flag on
		expect(codes(() => validateItem({ ...copy, readingLevel: "3" }, rules, "fiction"))).toEqual(
			["readingLevel:readingLevelNotAllowed"],
		);
		expect(validateItem({ ...copy, readingLevel: "3" }, perItem, "fiction").readingLevel).toBe(
			"3",
		);
		expect(
			codes(() => validateItem({ ...copy, readingLevel: "3" }, perItem, "nonfiction")),
		).toEqual(["readingLevel:readingLevelNotAllowed"]);
		expect(
			codes(() => validateItem({ ...copy, readingLevel: "8" }, perItem, "fiction")),
		).toEqual(["readingLevel:readingLevelOutOfRange"]);
		expect(codes(() => validateItem({ ...copy, itemType: "vhs" }, rules, "fiction"))).toEqual([
			"itemType:itemTypeUnknown",
		]);
		expect(
			codes(() => validateItem({ ...copy, acquisitionDate: "20/09/2026" }, rules, "fiction")),
		).toEqual(["acquisitionDate:acquisitionDateInvalid"]);
		// reference copies are not for loan by their item type
		expect(
			validateItem({ ...copy, itemType: "consultazione" }, rules, "fiction").notForLoan,
		).toBe(true);
	});
});

describe("catalog service", () => {
	it("creates, reads, updates and refuses duplicate ISBNs and deletion with copies", () => {
		const { db, actor } = setup();
		const id = createBiblio(db, fiction, actor, rules);
		expect(findBiblioByIsbn(db, "9788804668237")).toEqual({ id, title: fiction.title });
		expect(codes(() => createBiblio(db, { ...fiction, title: "Altro" }, actor, rules))).toEqual(
			["isbn:isbnTaken"],
		);
		const detail = getBiblio(db, id, rules);
		expect(detail).toMatchObject({
			title: fiction.title,
			kind: "fiction",
			genreCode: "G",
			readingLevel: "2",
			items: [],
			hasCover: false,
		});
		expect(detail.classification).toMatchObject({
			code: "G",
			label: "Favole e Fiabe",
			image: "G.svg",
		});

		expect(
			updateBiblio(db, id, { ...fiction, publicationYear: "2020", notes: "n" }, actor, rules),
		).toEqual(["publicationYear", "notes"]);
		expect(
			updateBiblio(db, id, { ...fiction, publicationYear: "2020", notes: "n" }, actor, rules),
		).toEqual([]);
		expect(() => updateBiblio(db, 999, fiction, actor, rules)).toThrow(BiblioNotFoundError);

		const { ids, barcodes } = addItems(
			db,
			id,
			copy,
			2,
			actor,
			rules,
			new Date("2026-09-20T10:00:00Z"),
		);
		expect(barcodes).toEqual([itemCode(2026, 1), itemCode(2026, 2)]);
		expect(() => deleteBiblio(db, id, actor)).toThrow(BiblioHasItemsError);
		for (const itemId of ids) {
			deleteItem(db, itemId, actor);
		}
		deleteBiblio(db, id, actor);
		expect(() => getBiblio(db, id, rules)).toThrow(BiblioNotFoundError);
		expect(() => deleteBiblio(db, id, actor)).toThrow(BiblioNotFoundError);
		const actions = db
			.select({ a: auditLog.action })
			.from(auditLog)
			.all()
			.map((r) => r.a);
		expect(actions).toEqual(
			expect.arrayContaining([
				"biblio.create",
				"biblio.update",
				"item.create",
				"item.delete",
				"biblio.delete",
			]),
		);
	});

	it("adds copies with sequential barcodes, suggested call numbers and today's date", () => {
		const { db, actor } = setup();
		const now = new Date("2026-09-20T10:00:00Z");
		const id = createBiblio(db, nonfiction, actor, rules);
		// a legacy barcode of this year already exists: the new range starts above it
		db.insert(item).values({ biblioId: id, barcode: "2026-0007", itemType: "libro" }).run();
		const { barcodes } = addItems(db, id, copy, 2, actor, rules, now);
		expect(barcodes).toEqual([itemCode(2026, 8), itemCode(2026, 9)]);
		const detail = getBiblio(db, id, rules);
		const fresh = detail.items.filter((i) => i.barcode.length === 10);
		expect(fresh.map((i) => i.callNumber)).toEqual(["590 ROS", "590 ROS"]);
		expect(fresh[0]?.acquisitionDate).toBe("2026-09-20");
		expect(fresh[0]?.status).toBe("available");
		expect(suggestedCallNumber(rules, detail, null)).toBe("590 ROS");
		expect(codes(() => addItems(db, id, copy, 0, actor, rules))).toEqual([
			"copies:copiesOutOfRange",
		]);
		expect(() => addItems(db, 999, copy, 1, actor, rules)).toThrow(BiblioNotFoundError);
		// with the class-per-copy flag the copy's class feeds the call number
		const perItem: CatalogRules = { ...rules, scheme: { ...rules.scheme, classPerItem: true } };
		const fid = createBiblio(db, { ...fiction, readingLevel: "" }, actor, perItem);
		const added = addItems(db, fid, { ...copy, readingLevel: "4" }, 1, actor, perItem, now);
		expect(copyOf(db, fid, added.ids[0]!).callNumber).toBe("G 4 PER");
	});

	it("gives the labels back to print when the segnatura is edited by hand (9.42)", () => {
		const { db, actor } = setup();
		const id = createBiblio(db, fiction, actor, rules);
		const { ids } = addItems(db, id, copy, 1, actor, rules);
		const itemId = ids[0]!;
		const printed = "2026-01-10T10:00:00.000Z";
		const flags = (): { barcode: string | null; spine: string | null } => {
			const row = db.select().from(item).where(eq(item.id, itemId)).get()!;
			return { barcode: row.barcodeLabelPrintedAt, spine: row.spineLabelPrintedAt };
		};
		db.update(item)
			.set({ barcodeLabelPrintedAt: printed, spineLabelPrintedAt: printed })
			.where(eq(item.id, itemId))
			.run();
		const stored = copyOf(db, id, itemId);
		const edit = {
			...copy,
			callNumber: stored.callNumber ?? "",
			acquisitionDate: stored.acquisitionDate ?? "",
		};
		// another field: the printed labels stay printed
		updateItem(db, itemId, { ...edit, notes: "copertina rovinata" }, actor, rules);
		expect(flags()).toEqual({ barcode: printed, spine: printed });
		// the segnatura changes: the spine band and the label (it shows the segnatura) again
		updateItem(
			db,
			itemId,
			{ ...edit, notes: "copertina rovinata", callNumber: "G 2 PE" },
			actor,
			rules,
		);
		expect(flags()).toEqual({ barcode: null, spine: null });
	});

	it("edits copies, changes their status with a reason and protects lent ones", () => {
		const { db, actor } = setup();
		const id = createBiblio(db, fiction, actor, rules);
		const { ids } = addItems(db, id, copy, 1, actor, rules);
		const itemId = ids[0]!;
		// the edit form is prefilled with the stored values; here the acquisition date
		const edit = { ...copy, acquisitionDate: copyOf(db, id, itemId).acquisitionDate ?? "" };
		expect(
			updateItem(
				db,
				itemId,
				{ ...edit, callNumber: "G 2 PE", notes: "copertina rovinata" },
				actor,
				rules,
			),
		).toEqual(["callNumber", "notes"]);
		expect(
			updateItem(
				db,
				itemId,
				{ ...edit, callNumber: "G 2 PE", notes: "copertina rovinata" },
				actor,
				rules,
			),
		).toEqual([]);
		setItemStatus(db, itemId, "damaged", "pagine strappate", actor);
		expect(copyOf(db, id, itemId).status).toBe("damaged");
		setItemStatus(db, itemId, "available", null, actor);
		expect(() => setItemStatus(db, 999, "lost", null, actor)).toThrow(ItemNotFoundError);
		expect(() => updateItem(db, 999, copy, actor, rules)).toThrow(ItemNotFoundError);

		const pid = db
			.insert(patron)
			.values({
				firstName: "Anna",
				lastName: "Verdi",
				patronType: "student",
				...inClass(db, 3, "A"),
			})
			.returning({ id: patron.id })
			.get().id;
		db.insert(loan)
			.values({
				itemId,
				patronId: pid,
				dueDate: "2026-10-01",
				patronTypeSnapshot: "student",
				schoolYear: "2026/2027",
			})
			.run();
		expect(copyOf(db, id, itemId).loan).toMatchObject({
			patronName: "Verdi Anna",
			dueDate: "2026-10-01",
		});
		expect(() => setItemStatus(db, itemId, "withdrawn", null, actor)).toThrow(ItemOnLoanError);
		expect(() => deleteItem(db, itemId, actor)).toThrow(ItemOnLoanError);
		const reasons = db
			.select({ d: auditLog.details })
			.from(auditLog)
			.all()
			.map((r) => r.d);
		expect(reasons).toContainEqual({
			from: "available",
			to: "damaged",
			reason: "pagine strappate",
		});
		expect(getBiblio(db, id, rules).items[0]?.loan?.patronId).toBe(pid);
		expect(searchBiblios(db, {}, rules).rows[0]).toMatchObject({
			copiesTotal: 1,
			copiesAvailable: 0,
		});
	});

	it("searches by words of title, author or ISBN and filters by classification", () => {
		const { db, actor } = setup();
		const f = createBiblio(db, fiction, actor, rules);
		const n = createBiblio(db, nonfiction, actor, rules);
		addItems(db, f, copy, 2, actor, rules);
		addItems(db, n, { ...copy, itemType: "consultazione" }, 1, actor, rules);
		const all = searchBiblios(db, {}, rules);
		expect(all.total).toBe(2);
		expect(all.rows.map((r) => [r.title, r.copiesTotal, r.copiesAvailable])).toEqual([
			["Gli animali della fattoria", 1, 0],
			["Il gatto con gli stivali", 2, 2],
		]);
		expect(searchBiblios(db, { q: "stivali" }, rules).rows.map((r) => r.id)).toEqual([f]);
		expect(searchBiblios(db, { q: "rossi" }, rules).rows.map((r) => r.id)).toEqual([n]);
		expect(searchBiblios(db, { q: "978-88-04-66823-7" }, rules).rows.map((r) => r.id)).toEqual([
			f,
		]);
		expect(searchBiblios(db, { kind: "nonfiction" }, rules).total).toBe(1);
		expect(searchBiblios(db, { genreCode: "G" }, rules).total).toBe(1);
		expect(searchBiblios(db, { classCode: "500" }, rules).total).toBe(1);
		expect(searchBiblios(db, { classCode: "590" }, rules).total).toBe(1);
		expect(searchBiblios(db, { classCode: "600" }, rules).total).toBe(0);
		expect(searchBiblios(db, { readingLevel: "2" }, rules).total).toBe(1);
		expect(searchBiblios(db, { itemType: "consultazione" }, rules).total).toBe(1);
		expect(searchBiblios(db, { sort: "author" }, rules).rows[0]?.id).toBe(f);
		expect(searchBiblios(db, { sort: "year" }, rules).rows).toHaveLength(2);
		expect(searchBiblios(db, { sort: "created", limit: 1 }, rules).rows).toHaveLength(1);
		const perItem: CatalogRules = { ...rules, scheme: { ...rules.scheme, classPerItem: true } };
		expect(searchBiblios(db, { readingLevel: "2" }, perItem).total).toBe(0);
		db.update(item).set({ readingLevel: "2" }).where(eq(item.biblioId, f)).run();
		expect(searchBiblios(db, { readingLevel: "2" }, perItem).total).toBe(1);
		// full text: prefixes, several words, diacritics, subjects
		expect(searchBiblios(db, { q: "gatt stiv" }, rules).rows.map((r) => r.id)).toEqual([f]);
		expect(searchBiblios(db, { q: "FATTORIA natura" }, rules).rows.map((r) => r.id)).toEqual([
			n,
		]);
		expect(searchBiblios(db, { q: "gàtto" }, rules).total).toBe(1);
		// no exact result: the book with one of the two words follows as approximate (9.24)
		expect(searchBiblios(db, { q: "gatto zebra" }, rules).rows.map((r) => r.similar)).toEqual([
			true,
		]);
		expect(searchBiblios(db, { q: '"*()' }, rules).total).toBe(2);
		// relevance: the title weighs more than the subjects
		const both = createBiblio(
			db,
			{ ...nonfiction, title: "Natura e animali", subjects: "", isbn: "" },
			actor,
			rules,
		);
		expect(searchBiblios(db, { q: "natura" }, rules).rows.map((r) => r.id)).toEqual([both, n]);
		// availability and year range
		expect(searchBiblios(db, { available: "1" }, rules).rows.map((r) => r.id)).toEqual([f]);
		expect(searchBiblios(db, { yearFrom: "2019", yearTo: "2019" }, rules).total).toBe(3);
		expect(searchBiblios(db, { yearFrom: "2020" }, rules).total).toBe(0);
		db.delete(biblio).where(eq(biblio.id, both)).run();
		// withdrawn books leave the results; a record without copies stays
		db.update(item).set({ status: "withdrawn" }).where(eq(item.biblioId, n)).run();
		expect(searchBiblios(db, {}, rules).rows.map((r) => r.id)).toEqual([f]);
		expect(searchBiblios(db, { withdrawn: "1" }, rules).total).toBe(2);
		const empty = createBiblio(
			db,
			{ ...fiction, title: "Senza copie", isbn: "" },
			actor,
			rules,
		);
		expect(searchBiblios(db, {}, rules).rows.map((r) => r.id)).toContain(empty);
	});

	it("keeps the series, searches it, lists its books in order and suggests its name (9.14)", () => {
		const { db, actor } = setup();
		const book = (title: string, series: string, seriesNumber: string): number =>
			createBiblio(db, { ...fiction, title, isbn: "", series, seriesNumber }, actor, rules);
		const ten = book("Il decimo", "Pepe Lampo", "10");
		const two = book("Il secondo", "pepe lampo", "2");
		const roman = book("Il primo romano", "Pepe Lampo", "I");
		const loose = book("Senza numero", "Pepe Lampo", "");
		const alone = book("Da solo", "", "7");
		expect(db.select().from(biblio).where(eq(biblio.id, alone)).get()).toMatchObject({
			series: null,
			seriesNumber: null,
		});
		// the link of the record page: the series whatever the case, numbers as numbers
		expect(searchBiblios(db, { series: "Pepe Lampo" }, rules).rows.map((r) => r.id)).toEqual([
			two,
			ten,
			roman,
			loose,
		]);
		expect(searchBiblios(db, { q: "lampo" }, rules).total).toBe(4);
		expect(searchBiblios(db, { sort: "series" }, rules).rows.at(-1)?.id).toBe(alone);
		expect(searchBiblios(db, { series: "Pepe Lampo" }, rules).rows[0]).toMatchObject({
			series: "pepe lampo",
			seriesNumber: "2",
		});
		expect(seriesNames(db)).toEqual(["Pepe Lampo"]);
	});

	it("keeps the original title of a translation and finds the book by it (9.23)", () => {
		const { db, actor } = setup();
		const id = createBiblio(
			db,
			{
				...fiction,
				title: "Il piccolo principe",
				originalTitle: " Le petit prince ",
				isbn: "",
			},
			actor,
			rules,
		);
		const row = (): typeof biblio.$inferSelect | undefined =>
			db.select().from(biblio).where(eq(biblio.id, id)).get();
		expect(row()?.originalTitle).toBe("Le petit prince");
		const found = searchBiblios(db, { q: "petit prince" }, rules).rows;
		expect(found.map((r) => [r.id, r.originalTitle])).toEqual([[id, "Le petit prince"]]);
		expect(
			updateBiblio(
				db,
				id,
				{ ...fiction, title: "Il piccolo principe", originalTitle: "", isbn: "" },
				actor,
				rules,
			),
		).toEqual(["originalTitle"]);
		expect(row()?.originalTitle).toBeNull();
		expect(searchBiblios(db, { q: "petit" }, rules).total).toBe(0);
	});

	it("exposes the picker options with inherited images", () => {
		const o = classificationOptions(rules);
		expect(o.genres.map((g) => g.code)).toContain("G");
		const science = o.nonfiction.find((n) => n.code === "500");
		expect(science?.children.find((c) => c.code === "590")?.image).toBe("500.svg");
		expect(o.itemTypes.map((t) => t.code)).toContain("libro");
		expect(o.specialAuthors).toContain("Anonimo");
	});
});

describe("books to classify (step 9.21)", () => {
	const later: BiblioFormInput = {
		...fiction,
		isbn: "",
		kind: "",
		genreCode: "G",
		readingLevel: "2",
	};

	it("saves a record without classification, whatever the pickers held", () => {
		const data = validateBiblio(later, rules);
		expect(data.kind).toBeNull();
		expect(data.genreCode).toBeNull();
		expect(data.classCode).toBeNull();
		expect(data.readingLevel).toBeNull();
		// a copy of it takes no class and gets no call number yet
		expect(codes(() => validateItem({ ...copy, readingLevel: "3" }, rules, null))).toEqual([
			"readingLevel:readingLevelNotAllowed",
		]);
		expect(suggestedCallNumber(rules, { ...data, author: "Rossi", title: "T" })).toBe("");
	});

	it("lists the records still to classify, the oldest first, and goes on after each one", () => {
		const { db, actor } = setup();
		const a = createBiblio(db, { ...later, title: "A" }, actor, rules, {
			now: new Date("2026-01-01T10:00:00Z"),
		});
		createBiblio(db, { ...nonfiction, title: "classified" }, actor, rules);
		const b = createBiblio(db, { ...later, title: "B" }, actor, rules, {
			now: new Date("2026-01-02T10:00:00Z"),
		});
		const c = createBiblio(db, { ...later, title: "C" }, actor, rules, {
			now: new Date("2026-01-02T10:00:00Z"),
		});
		expect(listUnclassified(db).map((r) => r.title)).toEqual(["A", "B", "C"]);
		expect(unclassifiedCount(db)).toBe(3);
		expect(nextUnclassified(db, a)).toBe(b);
		// two records of the same moment follow their id
		expect(nextUnclassified(db, b)).toBe(c);
		expect(nextUnclassified(db, c)).toBeNull();
		expect(nextUnclassified(db, 999)).toBeNull();
		const filtered = searchBiblios(db, { q: "", kind: "unclassified" } as never, rules);
		expect(filtered.rows.map((r) => r.title).sort()).toEqual(["A", "B", "C"]);
		expect(filtered.rows[0]?.kind).toBeNull();
	});

	it("classifies later: the other fields stay, the copies get their call numbers", () => {
		const { db, actor } = setup();
		const id = createBiblio(
			db,
			{ ...later, author: "Rossi, Anna", subjects: "animali\nfattoria", notes: "nota" },
			actor,
			rules,
		);
		addItems(db, id, copy, 2, actor, rules);
		addItems(db, id, { ...copy, callNumber: "MIA" }, 1, actor, rules);
		expect(getBiblio(db, id, rules).items.map((i) => i.callNumber)).toEqual([
			null,
			null,
			"MIA",
		]);
		// what the flow shows before saving
		const toNonfiction = {
			kind: "nonfiction",
			genreCode: "",
			classCode: "590",
			readingLevel: "",
		} as const;
		expect(classifiedCallNumber(db, id, toNonfiction, rules)).toBe("590 ROS");
		expect(classifiedCallNumber(db, 999, toNonfiction, rules)).toBe("");
		expect(
			codes(() =>
				classifyBiblio(
					db,
					id,
					{ kind: "nonfiction", genreCode: "", classCode: "", readingLevel: "" },
					actor,
					rules,
				),
			),
		).toEqual(["classCode:classCodeRequired"]);
		const changed = classifyBiblio(
			db,
			id,
			{ kind: "nonfiction", genreCode: "", classCode: "590", readingLevel: "" },
			actor,
			rules,
		);
		expect(changed).toEqual(["kind", "classCode"]);
		const detail = getBiblio(db, id, rules);
		expect(detail.kind).toBe("nonfiction");
		expect(detail.subjects).toEqual(["animali", "fattoria"]);
		expect(detail.notes).toBe("nota");
		expect(detail.items.map((i) => i.callNumber)).toEqual(["590 ROS", "590 ROS", "MIA"]);
		expect(listUnclassified(db)).toEqual([]);
		expect(() =>
			classifyBiblio(
				db,
				999,
				{ kind: "fiction", genreCode: "G", classCode: "", readingLevel: "" },
				actor,
				rules,
			),
		).toThrow(BiblioNotFoundError);
	});
});

describe("updateBiblioWithItem", () => {
	it("saves the record and its single copy together, or nothing when the copy is refused", () => {
		const { db, actor } = setup();
		const id = createBiblio(db, fiction, actor, rules);
		const { ids } = addItems(db, id, copy, 1, actor, rules);
		const itemId = ids[0]!;
		const changed = updateBiblioWithItem(
			db,
			id,
			{ ...fiction, title: "Nuovo titolo" },
			itemId,
			{ ...copy, callNumber: "X 1 ABC", acquisitionDate: "2026-01-15" },
			actor,
			rules,
		);
		expect(changed).toEqual({ biblio: ["title"], item: ["callNumber", "acquisitionDate"] });
		expect(getBiblio(db, id, rules).items[0]).toMatchObject({
			callNumber: "X 1 ABC",
			acquisitionDate: "2026-01-15",
		});
		// a refused copy value rolls the record change back too
		expect(() =>
			updateBiblioWithItem(
				db,
				id,
				{ ...fiction, title: "Mai salvato" },
				itemId,
				{ ...copy, acquisitionDate: "31/02/2026" },
				actor,
				rules,
			),
		).toThrow(CatalogValidationError);
		expect(getBiblio(db, id, rules).title).toBe("Nuovo titolo");
		// the copy must belong to the record
		const other = createBiblio(db, { ...fiction, title: "Altro", isbn: "" }, actor, rules);
		expect(() => updateBiblioWithItem(db, other, fiction, itemId, copy, actor, rules)).toThrow(
			ItemNotFoundError,
		);
	});
});

describe("filters on the copies, with record and copy ids that differ", () => {
	it("item type, per-copy class and withdrawn copies are matched against their own record", () => {
		const { db, actor } = setup();
		// many copies first, so copy ids and record ids never coincide
		const many = createBiblio(db, fiction, actor, rules);
		addItems(db, many, copy, 5, actor, rules);
		const dvd = createBiblio(db, { ...nonfiction, title: "Documentario" }, actor, rules);
		const [dvdCopy] = addItems(db, dvd, { ...copy, itemType: "dvd" }, 1, actor, rules).ids;
		const gone = createBiblio(db, { ...nonfiction, title: "Ritirato" }, actor, rules);
		addItems(db, gone, copy, 2, actor, rules);
		db.update(item).set({ status: "withdrawn" }).where(eq(item.biblioId, gone)).run();
		expect(searchBiblios(db, { itemType: "dvd" }, rules).rows.map((r) => r.id)).toEqual([dvd]);
		expect(searchBiblios(db, {}, rules).rows.map((r) => r.id)).not.toContain(gone);
		expect(searchBiblios(db, { withdrawn: "1" }, rules).rows.map((r) => r.id)).toContain(gone);
		const perItem: CatalogRules = { ...rules, scheme: { ...rules.scheme, classPerItem: true } };
		db.update(item)
			.set({ readingLevel: "4" })
			.where(eq(item.id, dvdCopy ?? 0))
			.run();
		expect(searchBiblios(db, { readingLevel: "4" }, perItem).rows.map((r) => r.id)).toEqual([
			dvd,
		]);
	});
});

describe("direct hits (step 5.1)", () => {
	it("opens a copy's record by barcode or ISBN, suggests plain numbers", () => {
		const { db, actor } = setup();
		const f = createBiblio(db, fiction, actor, rules);
		const added = addItems(db, f, copy, 1, actor, rules);
		const barcode = added.barcodes[0] ?? "";
		expect(catalogDirectHit(db, barcode, CODES)).toEqual({
			kind: "open",
			biblioId: f,
			itemId: added.ids[0],
		});
		expect(catalogDirectHit(db, barcode.replace("-", "'"), CODES)).toMatchObject({
			kind: "open",
		});
		expect(catalogDirectHit(db, "978-88-04-66823-7", CODES)).toEqual({
			kind: "open",
			biblioId: f,
		});
		db.update(item).set({ barcode: "1984" }).run();
		expect(catalogDirectHit(db, "1984", CODES)).toMatchObject({
			kind: "suggest",
			barcode: "1984",
			title: "Il gatto con gli stivali",
		});
		expect(catalogDirectHit(db, "1985", CODES)).toBeNull();
		expect(catalogDirectHit(db, "gatto", CODES)).toBeNull();
		expect(catalogDirectHit(db, "  ", CODES)).toBeNull();
		expect(catalogDirectHit(db, "9780306406157", CODES)).toBeNull();
	});
});
