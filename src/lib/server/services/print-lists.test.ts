// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { scannedCode } from "#lib/shared/input-schemas.js";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { auditLog, importBatch, patron, staffUser } from "#lib/server/db/schema.js";
import { createPatron } from "./patrons.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { item } from "#lib/server/db/schema.js";
import { savePatronPhoto } from "./media.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	addItemByBarcode,
	addItemsByFilter,
	itemImportBatches,
	itemListRows,
	itemsByQuickFilter,
} from "./print-list-items.js";
import {
	addPatronByCard,
	addPatronsByFilter,
	patronImportBatches,
	patronListRows,
	patronsByQuickFilter,
} from "./print-list-patrons.js";
import {
	addEntries,
	clearPrintList,
	createPrintList,
	deletePrintList,
	entityIdsOf,
	getPrintList,
	isToPrint,
	listPrintLists,
	markPrinted,
	moveEntry,
	PrintListKindError,
	PrintListNameError,
	PrintListNotFoundError,
	removeEntries,
	renamePrintList,
	reorderEntries,
} from "./print-lists.js";
import type { Db } from "#lib/server/db/client.js";
import { itemByBarcode, patronByCard } from "#lib/server/barcodes/lookup.js";
import { TEST_CODES } from "../../../../tests/helpers/codes.js";
import { classId, PATRON_RULES } from "../../../../tests/helpers/school.js";

const rules = PATRON_RULES;

function setup(): {
	db: Db;
	actor: { id: number };
	add: (
		lastName: string,
		level?: string,
		group?: string,
		patronType?: "student" | "teacher",
	) => number;
} {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const add = (
		lastName: string,
		level = "1",
		group = "A",
		patronType: "student" | "teacher" = "student",
	): number =>
		createPatron(
			db,
			{
				patronType,
				firstName: "N",
				lastName,
				levelCode: patronType === "teacher" ? "" : level,
				groupId: patronType === "teacher" ? "" : String(classId(db, level, group)),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			rules,
		);
	return { db, actor, add };
}

describe("print lists", () => {
	it("creates, renames, duplicates with entries, lists newest first and deletes", () => {
		const { db, actor, add } = setup();
		const a = add("Alfa");
		const b = add("Beta");
		expect(() => createPrintList(db, "patrons", "   ", actor)).toThrow(PrintListNameError);
		const first = createPrintList(db, "patrons", " Classe 1A ", actor, new Date("2026-09-01"));
		const second = createPrintList(db, "patrons", "Docenti", actor, new Date("2026-09-02"));
		expect(getPrintList(db, first)).toMatchObject({
			name: "Classe 1A",
			count: 0,
			kind: "patrons",
		});
		addEntries(db, first, [a, b], actor, new Date("2026-09-03"));
		expect(listPrintLists(db, "patrons").map((l) => l.id)).toEqual([first, second]);
		expect(isToPrint(getPrintList(db, first))).toBe(true);
		// an empty list has nothing to print
		expect(isToPrint(getPrintList(db, second))).toBe(false);
		renamePrintList(db, first, "Prime", actor);
		expect(getPrintList(db, first).name).toBe("Prime");
		deletePrintList(db, second, actor);
		expect(() => getPrintList(db, second)).toThrow(PrintListNotFoundError);
		expect(() => renamePrintList(db, 999, "x", actor)).toThrow(PrintListNotFoundError);
		expect(() => entityIdsOf(db, 999)).toThrow(PrintListNotFoundError);
		// a print route asks for the kind it prints: a list of patrons is no list of copies
		expect(entityIdsOf(db, first, "patrons")).toEqual([a, b]);
		expect(() => entityIdsOf(db, first, "items")).toThrow(PrintListKindError);
		const actions = db
			.select({ a: auditLog.action })
			.from(auditLog)
			.all()
			.map((r) => r.a);
		expect(actions).toEqual(
			expect.arrayContaining([
				"print_list.create",
				"print_list.rename",
				"print_list.delete",
				"print_list.add",
			]),
		);
	});

	it("keeps every entity once, appends in order, removes and renumbers, reorders and moves", () => {
		const { db, actor, add } = setup();
		const [a, b, c, d] = [add("A"), add("B"), add("C"), add("D")];
		const list = createPrintList(db, "patrons", "L", actor);
		expect(addEntries(db, list, [a, b, a], actor)).toEqual({ added: 2, skipped: [a] });
		expect(addEntries(db, list, [b, c], actor)).toEqual({ added: 1, skipped: [b] });
		expect(entityIdsOf(db, list)).toEqual([a, b, c]);
		expect(removeEntries(db, list, [b, 999], actor)).toBe(1);
		expect(patronListRows(db, list).map((r) => [r.entityId, r.position, r.classLabel])).toEqual(
			[
				[a, 1, "1 A"],
				[c, 2, "1 A"],
			],
		);
		addEntries(db, list, [d, b], actor);
		expect(reorderEntries(db, list, [b, 999, a], actor)).toEqual([b, a, c, d]);
		expect(entityIdsOf(db, list)).toEqual([b, a, c, d]);
		expect(moveEntry(db, list, c, "up", actor)).toEqual([b, c, a, d]);
		expect(moveEntry(db, list, b, "up", actor)).toEqual([b, c, a, d]);
		expect(moveEntry(db, list, d, "down", actor)).toEqual([b, c, a, d]);
		expect(moveEntry(db, list, 999, "down", actor)).toEqual([b, c, a, d]);
		expect(removeEntries(db, list, [], actor)).toBe(0);
		expect(clearPrintList(db, list, actor)).toBe(4);
		expect(entityIdsOf(db, list)).toEqual([]);
	});

	it("marks the list and the cards as printed, optionally clearing the list", () => {
		const { db, actor, add } = setup();
		const a = add("A");
		const b = add("B");
		const list = createPrintList(db, "patrons", "L", actor);
		addEntries(db, list, [a, b], actor);
		const when = new Date("2026-09-20T10:00:00Z");
		expect(markPrinted(db, list, actor, { now: when })).toEqual({ marked: 2, cleared: false });
		expect(getPrintList(db, list).lastPrintedAt).toBe(when.toISOString());
		expect(isToPrint(getPrintList(db, list))).toBe(false);
		expect(db.select().from(patron).where(eq(patron.id, a)).get()?.cardPrintedAt).toBe(
			when.toISOString(),
		);
		expect(markPrinted(db, list, actor, { clear: true })).toEqual({ marked: 2, cleared: true });
		expect(getPrintList(db, list).count).toBe(0);
		const items = createPrintList(db, "items", "Copie", actor);
		expect(markPrinted(db, items, actor).marked).toBe(0);
	});

	it("quick filters select patrons by class, type, missing card or photo, import batch and date", async () => {
		const { db, actor, add } = setup();
		const a = add("Alfa", "1", "A");
		const b = add("Beta", "1", "B");
		const t = add("Tau", "", "", "teacher");
		const dataDir = mkdtempSync(join(tmpdir(), "bv-pl-"));
		try {
			await savePatronPhoto(
				db,
				dataDir,
				a,
				new Uint8Array(readFileSync("tests/fixtures/images/portrait-exif.jpg")),
				parseConfig(exampleRaw()).config.photos,
				actor,
			);
		} finally {
			rmSync(dataDir, { recursive: true, force: true });
		}
		db.update(patron)
			.set({ cardPrintedAt: "2026-09-01T00:00:00Z" })
			.where(eq(patron.id, b))
			.run();
		db.update(patron)
			.set({ createdAt: "2026-01-01T00:00:00.000Z" })
			.where(eq(patron.id, t))
			.run();
		expect(patronsByQuickFilter(db, {})).toEqual([]);
		expect(patronsByQuickFilter(db, { levelCode: "1" })).toEqual([a, b]);
		expect(patronsByQuickFilter(db, { groupId: classId(db, "1", "B") })).toEqual([b]);
		expect(
			patronsByQuickFilter(db, { levelCode: "1", groupId: classId(db, "1", "B") }),
		).toEqual([b]);
		expect(patronsByQuickFilter(db, { patronType: "teacher" })).toEqual([t]);
		expect(patronsByQuickFilter(db, { withoutPrintedCard: true })).toEqual([a, t]);
		expect(patronsByQuickFilter(db, { withoutPhoto: true })).toEqual([b, t]);
		expect(patronsByQuickFilter(db, { createdAfter: "2026-06-01" })).toEqual([a, b]);
		const batch = db
			.insert(importBatch)
			.values({
				kind: "patrons",
				filename: "x.csv",
				finishedAt: "2026-09-02T00:00:00Z",
				summary: { created: 1, createdIds: [b] },
			})
			.returning({ id: importBatch.id })
			.get();
		db.insert(importBatch)
			.values({
				kind: "patrons",
				filename: "empty.csv",
				summary: { created: 0, createdIds: [] },
			})
			.run();
		expect(patronsByQuickFilter(db, { importBatchId: batch.id })).toEqual([b]);
		expect(patronsByQuickFilter(db, { importBatchId: 999 })).toEqual([]);
		expect(patronImportBatches(db).map((x) => [x.filename, x.created])).toEqual([
			["empty.csv", 0],
			["x.csv", 1],
		]);
		const card = db.select({ c: patron.cardNumber }).from(patron).where(eq(patron.id, a)).get()!
			.c!;
		expect(patronByCard(db, card)?.id).toBe(a);
		expect(patronByCard(db, "0000000000")).toBeNull();
		expect(patronListRows(db, createPrintList(db, "patrons", "x", actor))).toEqual([]);

		// the adders of the list page: a quick filter, a scanned card, never a list of copies
		const people = createPrintList(db, "patrons", "Classe", actor);
		expect(addPatronsByFilter(db, people, { levelCode: "1" }, actor)).toEqual({
			found: 2,
			added: 2,
			skipped: [],
		});
		expect(addPatronByCard(db, people, card, TEST_CODES, actor)).toMatchObject({
			patronId: a,
			duplicate: true,
			row: { entityId: a, lastName: "Alfa" },
		});
		// a reading in lower case, padded and with the scanner's Enter is the same card
		expect(card).toMatch(/[A-Z]/);
		const typed = v.parse(scannedCode, `  ${card.toLowerCase()} \r\n`);
		expect(addPatronByCard(db, people, typed, TEST_CODES, actor)).toMatchObject({
			patronId: a,
			duplicate: true,
		});
		expect(addPatronByCard(db, people, "0000000000", TEST_CODES, actor)).toBeNull();
		const copies = createPrintList(db, "items", "Copie", actor);
		expect(() => addPatronsByFilter(db, copies, { levelCode: "1" }, actor)).toThrow(
			PrintListKindError,
		);
		expect(() => addPatronByCard(db, copies, card, TEST_CODES, actor)).toThrow(
			PrintListKindError,
		);
	});

	it("item lists: quick filters, rows, barcode lookup and the printed flags of a kind", () => {
		const { db, actor } = setup();
		const config = parseConfig(exampleRaw()).config;
		const rules = catalogRules(config);
		const record = {
			title: "Il gatto",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Perrault, Charles",
			publisher: "Einaudi",
			publicationPlace: "",
			publicationYear: "2019",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
			kind: "fiction" as const,
			genreCode: "B",
			classCode: "",
			readingLevel: "4",
			subjects: "",
			notes: "",
		};
		const copy = {
			callNumber: "",
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "2026-02-01",
			notes: "",
			notForLoan: false,
		};
		const fictionId = createBiblio(db, record, actor, rules);
		const nonfictionId = createBiblio(
			db,
			{
				...record,
				title: "Animali",
				itemType: "dvd",
				kind: "nonfiction",
				genreCode: "",
				classCode: "590",
				readingLevel: "",
			},
			actor,
			rules,
		);
		const f = addItems(db, fictionId, copy, 2, actor, rules);
		const n = addItems(
			db,
			nonfictionId,
			{ ...copy, acquisitionDate: "2026-03-05" },
			1,
			actor,
			rules,
		);
		const [f1, f2] = f.ids as [number, number];
		const n1 = n.ids[0]!;

		expect(itemsByQuickFilter(db, {})).toEqual([]);
		expect(itemsByQuickFilter(db, { pendingLabels: "pair" })).toEqual([f1, f2, n1]);
		expect(itemsByQuickFilter(db, { genreCode: "B" })).toEqual([f1, f2]);
		expect(itemsByQuickFilter(db, { classCodes: ["500", "590"] })).toEqual([n1]);
		expect(itemsByQuickFilter(db, { itemType: "dvd" })).toEqual([n1]);
		expect(itemsByQuickFilter(db, { acquiredFrom: "2026-03-01" })).toEqual([n1]);
		expect(
			itemsByQuickFilter(db, { acquiredFrom: "2026-01-01", acquiredTo: "2026-02-28" }),
		).toEqual([f1, f2]);
		const batch = db
			.insert(importBatch)
			.values({
				kind: "catalog",
				filename: "libri.csv",
				finishedAt: "2026-09-02T00:00:00Z",
				summary: { createdItemIds: [f2] },
			})
			.returning({ id: importBatch.id })
			.get();
		expect(itemsByQuickFilter(db, { importBatchId: batch.id })).toEqual([f2]);
		expect(itemsByQuickFilter(db, { importBatchId: 999 })).toEqual([]);
		expect(itemImportBatches(db).map((b) => [b.filename, b.created])).toEqual([
			["libri.csv", 1],
		]);

		const list = createPrintList(db, "items", "Etichette", actor);
		addEntries(db, list, [n1, f1], actor);
		const rows = itemListRows(db, list);
		expect(rows.map((r) => [r.position, r.barcode, r.title, r.callNumber])).toEqual([
			[1, n.barcodes[0], "Animali", "590 PER"],
			[2, f.barcodes[0], "Il gatto", "B 4 PER"],
		]);
		expect(rows[0]?.barcodeLabelPrintedAt).toBeNull();
		expect(itemByBarcode(db, f.barcodes[0]!)?.id).toBe(f1);
		expect(itemByBarcode(db, "nope")).toBeNull();

		// "Segna come stampate" with a kind: spine sets one flag, pair both
		expect(markPrinted(db, list, actor, { labelKind: "spine" })).toEqual({
			marked: 2,
			cleared: false,
		});
		expect(itemsByQuickFilter(db, { pendingLabels: "spine" })).toEqual([f2]);
		expect(itemsByQuickFilter(db, { pendingLabels: "barcode" })).toEqual([f1, f2, n1]);
		expect(markPrinted(db, list, actor, { clear: true })).toEqual({ marked: 2, cleared: true });
		expect(itemsByQuickFilter(db, { pendingLabels: "pair" })).toEqual([f2]);
		expect(
			db.select().from(item).where(eq(item.id, n1)).get()?.barcodeLabelPrintedAt,
		).not.toBeNull();
		expect(itemListRows(db, list)).toEqual([]);

		// the adders of the list page: a parent class takes its children, a scanned barcode, never
		// a list of patrons
		const more = createPrintList(db, "items", "Altre", actor);
		expect(addItemsByFilter(db, rules.scheme, more, { classCode: "500" }, actor)).toEqual({
			found: 1,
			added: 1,
			skipped: [],
		});
		expect(addItemByBarcode(db, more, n.barcodes[0]!, TEST_CODES, actor)).toMatchObject({
			itemId: n1,
			duplicate: true,
			row: { entityId: n1, title: "Animali" },
		});
		expect(addItemByBarcode(db, more, f.barcodes[0]!, TEST_CODES, actor)).toMatchObject({
			itemId: f1,
			duplicate: false,
		});
		expect(addItemByBarcode(db, more, "nope", TEST_CODES, actor)).toBeNull();
		// recognised as at the desk: a scanner that lost the dash still finds the copy
		expect(
			addItemByBarcode(db, more, f.barcodes[0]!.replace("-", ""), TEST_CODES, actor),
		).toMatchObject({ itemId: f1, duplicate: true });
		const people = createPrintList(db, "patrons", "Persone", actor);
		expect(() => addItemsByFilter(db, rules.scheme, people, {}, actor)).toThrow(
			PrintListKindError,
		);
		expect(() => addItemByBarcode(db, people, "nope", TEST_CODES, actor)).toThrow(
			PrintListKindError,
		);
	});
});
