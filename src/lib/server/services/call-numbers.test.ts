// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { biblio, item, staffUser } from "#lib/server/db/schema.js";
import type { BiblioFormInput, ItemFormInput } from "#lib/shared/catalog-schema.js";
import { callNumberScheme, type CallNumberScheme } from "#lib/shared/classification.js";
import { applyBatch } from "./batch-items.js";
import { catalogRules, createBiblio, updateBiblio, type CatalogRules } from "./catalog.js";
import { addItems, updateItem } from "./catalog-items.js";
import { callNumberChanges, refreshCallNumbers } from "./call-numbers.js";

const base = catalogRules(parseConfig(exampleRaw()).config);
const PRINTED = "2026-01-10T10:00:00.000Z";

const record: BiblioFormInput = {
	title: "Il gatto con gli stivali",
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
	genreCode: "G",
	classCode: "",
	readingLevel: "2",
	subjects: "",
	notes: "",
};
const copy: ItemFormInput = {
	readingLevel: "",
	enumeration: "",
	acquisitionDate: "",
	notes: "",
	notForLoan: false,
};

function setup(
	callNumber: CallNumberScheme,
	classPerItem = false,
): { db: Db; actor: { id: number }; rules: CatalogRules } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor, rules: { ...base, scheme: { ...base.scheme, callNumber, classPerItem } } };
}

const copiesOf = (db: Db, id: number): (typeof item.$inferSelect)[] =>
	db.select().from(item).where(eq(item.biblioId, id)).orderBy(item.id).all();

describe("the segnatura of the copies (9.50, Q143)", () => {
	it("follows the title's text, and its proposal while it is empty", () => {
		const { db, actor, rules } = setup(callNumberScheme("genreLevel", "text"));
		const id = createBiblio(db, record, actor, rules);
		addItems(db, id, copy, 2, actor, rules);
		expect(copiesOf(db, id).map((c) => [c.callNumber, c.callHead])).toEqual([
			["G 2 PER", "G 2"],
			["G 2 PER", "G 2"],
		]);
		db.update(item).set({ barcodeLabelPrintedAt: PRINTED, spineLabelPrintedAt: PRINTED }).run();
		updateBiblio(db, id, { ...record, callText: "PERR" }, actor, rules);
		expect(copiesOf(db, id).map((c) => c.callNumber)).toEqual(["G 2 PERR", "G 2 PERR"]);
		expect(copiesOf(db, id).every((c) => c.barcodeLabelPrintedAt === null)).toBe(true);
		// emptied: the proposal again, stored as "follow the author"
		updateBiblio(db, id, { ...record, callText: "" }, actor, rules);
		expect(db.select().from(biblio).where(eq(biblio.id, id)).get()?.callText).toBeNull();
		updateBiblio(db, id, { ...record, author: "Rodari, Gianni" }, actor, rules);
		expect(copiesOf(db, id).map((c) => c.callNumber)).toEqual(["G 2 ROD", "G 2 ROD"]);
		// a form without the text keeps the title's
		updateBiblio(
			db,
			id,
			{ ...record, author: "Rodari, Gianni", callText: "ZZZ" },
			actor,
			rules,
		);
		updateBiblio(db, id, { ...record, author: "Rodari, Gianni", notes: "x" }, actor, rules);
		expect(copiesOf(db, id).map((c) => c.callNumber)).toEqual(["G 2 ZZZ", "G 2 ZZZ"]);
	});

	it("takes each copy's level with the level on the copies", () => {
		const { db, actor, rules } = setup(callNumberScheme("levelGenre", "author"), true);
		const id = createBiblio(db, { ...record, readingLevel: "" }, actor, rules);
		const { ids } = addItems(db, id, { ...copy, readingLevel: "3" }, 2, actor, rules);
		expect(copiesOf(db, id).map((c) => c.callNumber)).toEqual(["3 G PER", "3 G PER"]);
		updateItem(db, ids[1] ?? 0, { ...copy, readingLevel: "4" }, actor, rules);
		expect(copiesOf(db, id).map((c) => c.callNumber)).toEqual(["3 G PER", "4 G PER"]);
		// the batch change of the copies' level too
		applyBatch(db, [ids[0] ?? 0], { kind: "readingLevel", readingLevel: "5" }, rules, actor);
		expect(copiesOf(db, id).map((c) => c.callNumber)).toEqual(["5 G PER", "4 G PER"]);
	});

	it("keeps a copy's own text where the scheme has one, nowhere else", () => {
		const scheme = {
			...callNumberScheme("genreLevel", "author"),
			fictionWithClass: "{{genre}} {{class}} {{copytext}}",
		};
		const { db, actor, rules } = setup(scheme);
		const id = createBiblio(db, record, actor, rules);
		const { ids } = addItems(db, id, { ...copy, callText: "S2" }, 1, actor, rules);
		expect(copiesOf(db, id)[0]).toMatchObject({ callText: "S2", callNumber: "G 2 S2" });
		updateItem(db, ids[0] ?? 0, { ...copy, callText: "S3" }, actor, rules);
		expect(copiesOf(db, id)[0]?.callNumber).toBe("G 2 S3");
		// left out: kept
		updateItem(db, ids[0] ?? 0, { ...copy, notes: "x" }, actor, rules);
		expect(copiesOf(db, id)[0]?.callText).toBe("S3");

		const plain = setup(callNumberScheme("genreLevel", "author"));
		const other = createBiblio(plain.db, record, plain.actor, plain.rules);
		addItems(plain.db, other, { ...copy, callText: "S2" }, 1, plain.actor, plain.rules);
		expect(copiesOf(plain.db, other)[0]).toMatchObject({
			callText: null,
			callNumber: "G 2 PER",
		});
	});

	it("counts the copies a scheme would change without writing, then refreshes them", () => {
		const { db, actor, rules } = setup(callNumberScheme("genreLevel", "author"));
		const id = createBiblio(db, record, actor, rules);
		addItems(db, id, copy, 3, actor, rules);
		const levelFirst = {
			...rules.scheme,
			callNumber: callNumberScheme("levelGenre", "author"),
		};
		expect(callNumberChanges(db, levelFirst)).toHaveLength(3);
		expect(copiesOf(db, id)[0]?.callNumber).toBe("G 2 PER");
		expect(refreshCallNumbers(db, levelFirst, "all")).toBe(3);
		expect(copiesOf(db, id).map((c) => c.callNumber)).toEqual([
			"2 G PER",
			"2 G PER",
			"2 G PER",
		]);
		expect(refreshCallNumbers(db, levelFirst, [id])).toBe(0);
		expect(refreshCallNumbers(db, levelFirst, [])).toBe(0);
	});
});
