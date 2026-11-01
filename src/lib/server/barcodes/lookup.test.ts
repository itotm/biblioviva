// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cardCode, itemCode, TEST_CODES, withWrongCheck } from "../../../../tests/helpers/codes.js";
import { createTestDb } from "../../../../tests/helpers/db.js";
import type { Db } from "#lib/server/db/client.js";
import { biblio, item, patron } from "#lib/server/db/schema.js";
import { itemByBarcode, patronByCard, resolveScan } from "./lookup.js";

const CODES = TEST_CODES;

function setup(): { db: Db; student: number; card: string; copy: number; barcode: string } {
	const db = createTestDb();
	const card = cardCode(1);
	const student = db
		.insert(patron)
		.values({ firstName: "Anna", lastName: "Rossi", patronType: "student", cardNumber: card })
		.returning({ id: patron.id })
		.get().id;
	const biblioId = db
		.insert(biblio)
		.values({
			title: "Il gatto con gli stivali e altre storie di animali parlanti",
			author: "Perrault, Charles",
			publisher: "Einaudi",
			kind: "fiction",
		})
		.returning({ id: biblio.id })
		.get().id;
	const barcode = itemCode(2026, 1);
	const copy = db
		.insert(item)
		.values({ biblioId, barcode, itemType: "libro" })
		.returning({ id: item.id })
		.get().id;
	return { db, student, card, copy, barcode };
}

describe("lookups", () => {
	it("find the copy of a barcode and the patron of a card, removed patrons only on request", () => {
		const { db, student, card, copy, barcode } = setup();
		expect(itemByBarcode(db, barcode)).toMatchObject({ id: copy });
		expect(itemByBarcode(db, itemCode(2026, 2))).toBeNull();
		expect(patronByCard(db, card)).toMatchObject({ id: student, lastName: "Rossi" });
		db.update(patron).set({ status: "anonymized" }).where(eq(patron.id, student)).run();
		expect(patronByCard(db, card)).toBeNull();
		expect(patronByCard(db, card, { anonymized: true })).toMatchObject({ id: student });
	});
});

describe("scan resolution", () => {
	it("tells cards, copies, legacy numbers, unknown codes and wrong check digits apart", () => {
		const { db, student, card, copy, barcode } = setup();
		expect(resolveScan(db, card, CODES)).toMatchObject({
			kind: "patron",
			patronId: student,
			name: "Anna Rossi",
		});
		// the title as the desk messages show it, cut to 40 characters
		expect(resolveScan(db, barcode, CODES)).toEqual({
			kind: "item",
			itemId: copy,
			code: barcode,
			title: "Il gatto con gli stivali e altre storie…",
		});
		// a scanner on the wrong layout: ' instead of -
		expect(resolveScan(db, barcode.replace("-", "'"), CODES)).toMatchObject({
			kind: "item",
			code: barcode,
		});
		expect(resolveScan(db, withWrongCheck(itemCode(2026, 18)), CODES)).toMatchObject({
			kind: "badCheckDigit",
		});
		expect(resolveScan(db, withWrongCheck(cardCode(5), "card"), CODES)).toMatchObject({
			kind: "badCheckDigit",
		});
		expect(resolveScan(db, "9788804668238", CODES)).toMatchObject({ kind: "badCheckDigit" });
		expect(resolveScan(db, itemCode(2099, 1), CODES)).toMatchObject({ kind: "unknown" });
		expect(resolveScan(db, cardCode(9), CODES)).toMatchObject({ kind: "unknown" });
		expect(resolveScan(db, "9788804668237", CODES)).toMatchObject({ kind: "unknown" });
		expect(resolveScan(db, "xyz", CODES)).toEqual({ kind: "unknown", code: "xyz" });
		// a legacy plain counter used both as a card and as a copy barcode
		db.update(patron).set({ cardNumber: "1234" }).where(eq(patron.id, student)).run();
		db.update(item).set({ barcode: "1234" }).where(eq(item.id, copy)).run();
		expect(resolveScan(db, "1234", CODES)).toMatchObject({
			kind: "ambiguous",
			patronId: student,
			itemId: copy,
			name: "Anna Rossi",
		});
		db.update(item).set({ barcode: "4321" }).where(eq(item.id, copy)).run();
		expect(resolveScan(db, "1234", CODES)).toMatchObject({ kind: "patron" });
		expect(resolveScan(db, "4321", CODES)).toMatchObject({ kind: "item" });
		expect(resolveScan(db, "5555", CODES)).toMatchObject({ kind: "unknown" });
	});

	it("does not find the card of a removed patron", () => {
		const { db, student, card } = setup();
		db.update(patron).set({ status: "anonymized" }).where(eq(patron.id, student)).run();
		expect(resolveScan(db, card, CODES)).toEqual({ kind: "unknown", code: card });
	});
});
