// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, biblio, item, loan, patron, staffUser } from "#lib/server/db/schema.js";
import {
	applyBatch,
	applyReclassify,
	BatchOperationError,
	checkOperation,
	planBatch,
	planReclassify,
} from "./batch-items.js";
import { catalogRules, createBiblio, type CatalogRules } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { createPatron } from "./patrons.js";
import { PATRON_RULES, classId } from "../../../../tests/helpers/school.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);
const perItem: CatalogRules = { ...rules, scheme: { ...rules.scheme, classPerItem: true } };
const copy = {
	itemType: "libro",
	callNumber: "",
	readingLevel: "",
	enumeration: "",
	acquisitionDate: "2020-01-01",
	notes: "",
	notForLoan: false,
};

function setup(): {
	db: Db;
	actor: { id: number };
	fiction: number;
	nonfiction: number;
	ids: number[];
} {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const record = {
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
		kind: "fiction" as const,
		genreCode: "B",
		classCode: "",
		readingLevel: "3",
		subjects: "",
		notes: "",
	};
	const fiction = createBiblio(db, record, actor, rules);
	const nonfiction = createBiblio(
		db,
		{
			...record,
			title: "Animali",
			kind: "nonfiction",
			genreCode: "",
			classCode: "590",
			readingLevel: "",
		},
		actor,
		rules,
	);
	const a = addItems(db, fiction, copy, 3, actor, rules).ids;
	const b = addItems(db, nonfiction, copy, 1, actor, rules).ids;
	// the second copy is on loan
	const p = createPatron(
		db,
		{
			patronType: "student",
			firstName: "Anna",
			lastName: "Rossi",
			levelCode: "3",
			groupId: String(classId(db, "3", "A")),
			groupName: "",
			cardNumber: "",
			externalId: "",
			email: "",
			circulationNote: "",
			notes: "",
		},
		actor,
		PATRON_RULES,
	);
	db.insert(loan)
		.values({
			itemId: a[1] ?? 0,
			patronId: p,
			dueDate: "2099-01-01",
			patronTypeSnapshot: "student",
			schoolYear: "2026/2027",
		})
		.run();
	return { db, actor, fiction, nonfiction, ids: [...a, ...b] };
}

describe("batch operations on copies", () => {
	it("checks the operation against the configuration", () => {
		expect(() =>
			checkOperation({ kind: "status", status: "withdrawn", reason: " " }, rules),
		).toThrow(BatchOperationError);
		expect(() =>
			checkOperation({ kind: "status", status: "damaged", reason: "" }, rules),
		).not.toThrow();
		expect(() =>
			checkOperation({ kind: "status", status: "gone" as "lost", reason: "x" }, rules),
		).toThrow(/statusUnknown/);
		expect(() => checkOperation({ kind: "itemType", itemType: "vinile" }, rules)).toThrow(
			/itemTypeUnknown/,
		);
		expect(() => checkOperation({ kind: "readingLevel", readingLevel: "2" }, rules)).toThrow(
			/readingLevelNotAllowed/,
		);
		expect(() => checkOperation({ kind: "readingLevel", readingLevel: "9" }, perItem)).toThrow(
			/readingLevelOutOfRange/,
		);
		expect(() =>
			checkOperation({ kind: "readingLevel", readingLevel: null }, perItem),
		).not.toThrow();
		expect(() =>
			checkOperation({ kind: "acquisitionDate", acquisitionDate: "ieri" }, rules),
		).toThrow(/dateInvalid/);
		expect(() => checkOperation({ kind: "notForLoan", notForLoan: true }, rules)).not.toThrow();
	});

	it("plans a bulk withdrawal: copies on loan stay, duplicates and missing ids are reported", () => {
		const { db, ids } = setup();
		const plan = planBatch(
			db,
			[...ids, ids[0] ?? 0, 999],
			{ kind: "status", status: "withdrawn", reason: "scarto 2026" },
			rules,
		);
		expect(plan.changes).toBe(3);
		expect(plan.excluded).toEqual({ onLoan: 1, unchanged: 0, notFound: 1, notAllowed: 0 });
		expect(plan.rows.find((r) => r.itemId === ids[1])).toMatchObject({
			exclusion: "onLoan",
			from: "available",
			to: "withdrawn",
		});
		expect(plan.rows.at(-1)).toMatchObject({ itemId: 999, exclusion: "notFound" });
		// nothing written by the plan
		expect(
			db
				.select()
				.from(item)
				.all()
				.every((i) => i.status === "available"),
		).toBe(true);
	});

	it("applies in one transaction with the reason in every audit row, and is idempotent", () => {
		const { db, actor, ids } = setup();
		const op = { kind: "status" as const, status: "withdrawn" as const, reason: "scarto 2026" };
		const result = applyBatch(db, ids, op, rules, actor);
		expect(result.changed).toBe(3);
		expect(
			db
				.select()
				.from(item)
				.where(eq(item.id, ids[1] ?? 0))
				.get()?.status,
		).toBe("available");
		expect(
			db
				.select()
				.from(item)
				.where(eq(item.id, ids[0] ?? 0))
				.get()?.status,
		).toBe("withdrawn");
		const rows = db.select().from(auditLog).where(eq(auditLog.action, "item.status")).all();
		expect(rows).toHaveLength(3);
		expect(rows[0]?.details).toMatchObject({
			from: "available",
			to: "withdrawn",
			reason: "scarto 2026",
			batch: true,
		});
		const summary = db.select().from(auditLog).where(eq(auditLog.action, "item.batch")).get();
		expect(summary).toMatchObject({ entity: "item", entityId: null });
		expect(summary?.details).toMatchObject({
			operation: "status",
			value: "withdrawn",
			changed: 3,
			onLoan: 1,
		});
		// again: the withdrawn ones are unchanged now
		expect(planBatch(db, ids, op, rules).excluded).toMatchObject({ unchanged: 3, onLoan: 1 });
	});

	it("changes item type, loan flag, acquisition date and the copy's class", () => {
		const { db, actor, ids } = setup();
		expect(
			applyBatch(db, ids, { kind: "itemType", itemType: "dvd" }, rules, actor).changed,
		).toBe(4);
		expect(
			applyBatch(db, ids, { kind: "notForLoan", notForLoan: true }, rules, actor).changed,
		).toBe(4);
		expect(
			applyBatch(
				db,
				ids,
				{ kind: "acquisitionDate", acquisitionDate: "2021-05-05" },
				rules,
				actor,
			).changed,
		).toBe(4);
		const first = db
			.select()
			.from(item)
			.where(eq(item.id, ids[0] ?? 0))
			.get();
		expect(first).toMatchObject({ notForLoan: 1, acquisitionDate: "2021-05-05" });
		// the type is the record's (9.45): every copy of the title changes with it
		expect(
			db
				.select({ itemType: biblio.itemType })
				.from(biblio)
				.where(eq(biblio.id, first?.biblioId ?? 0))
				.get()?.itemType,
		).toBe("dvd");
		// the class of a copy exists only for fiction, and only with class per copy
		const plan = planBatch(db, ids, { kind: "readingLevel", readingLevel: "4" }, perItem);
		expect(plan.excluded.notAllowed).toBe(1);
		expect(
			applyBatch(db, ids, { kind: "readingLevel", readingLevel: "4" }, perItem, actor)
				.changed,
		).toBe(3);
		expect(
			db
				.select()
				.from(item)
				.where(eq(item.id, ids[0] ?? 0))
				.get()?.readingLevel,
		).toBe("4");
		expect(
			db.select().from(auditLog).where(eq(auditLog.action, "item.update")).all().length,
		).toBeGreaterThan(10);
	});
});

describe("reclassification of records", () => {
	it("plans and applies a new classification, rewriting call numbers and labels to reprint", () => {
		const { db, actor, fiction, nonfiction } = setup();
		db.update(item)
			.set({
				spineLabelPrintedAt: "2026-01-01T00:00:00Z",
				barcodeLabelPrintedAt: "2026-01-01T00:00:00Z",
			})
			.run();
		const target = {
			kind: "fiction" as const,
			genreCode: "D",
			classCode: "",
			readingLevel: "2",
			resuggestCallNumbers: true,
		};
		const plan = planReclassify(db, [fiction, nonfiction, 999], target, rules);
		expect(plan.changes).toBe(2);
		expect(plan.rows.map((r) => [r.from, r.to, r.copies, r.exclusion])).toEqual([
			["B 3", "D 2", 3, null],
			["590", "D 2", 1, null],
			["", "D 2", 0, "notFound"],
		]);
		const result = applyReclassify(db, [fiction, nonfiction], target, rules, actor);
		expect(result).toEqual({ changed: 2, callNumbers: 4 });
		expect(db.select().from(biblio).where(eq(biblio.id, nonfiction)).get()).toMatchObject({
			kind: "fiction",
			genreCode: "D",
			classCode: null,
			readingLevel: "2",
		});
		const copies = db.select().from(item).where(eq(item.biblioId, fiction)).all();
		expect(copies.map((c) => c.callNumber)).toEqual(["D 2 PER", "D 2 PER", "D 2 PER"]);
		expect(
			copies.every((c) => c.spineLabelPrintedAt === null && c.barcodeLabelPrintedAt === null),
		).toBe(true);
		// the same target again: nothing changes
		expect(planReclassify(db, [fiction], target, rules).changes).toBe(0);
		expect(() => planReclassify(db, [fiction], { ...target, genreCode: "ZZ" }, rules)).toThrow(
			/classificationUnknown/,
		);
	});

	it("computes the call numbers again: a changed one sends its barcode label back to print", () => {
		const { db, actor, fiction } = setup();
		db.update(item)
			.set({
				spineLabelPrintedAt: "2026-01-01T00:00:00Z",
				barcodeLabelPrintedAt: "2026-01-01T00:00:00Z",
			})
			.run();
		applyReclassify(
			db,
			[fiction],
			{
				kind: "nonfiction",
				genreCode: "",
				classCode: "590",
				readingLevel: "",
			},
			rules,
			actor,
		);
		const copies = db.select().from(item).where(eq(item.biblioId, fiction)).all();
		expect(copies.map((c) => c.callNumber)).toEqual(["590 PER", "590 PER", "590 PER"]);
		expect(
			copies.every((c) => c.spineLabelPrintedAt === null && c.barcodeLabelPrintedAt === null),
		).toBe(true);
		expect(db.select().from(patron).all()).toHaveLength(1);
	});
});
