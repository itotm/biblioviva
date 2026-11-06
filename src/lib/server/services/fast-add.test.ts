// SPDX-License-Identifier: GPL-3.0-or-later
import { itemCode } from "../../../../tests/helpers/codes.js";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, biblio, item, staffUser } from "#lib/server/db/schema.js";
import type { FastAddInput } from "#lib/shared/catalog-schema.js";
import { catalogRules, CatalogValidationError } from "./catalog.js";
import { fastAddBiblio } from "./fast-add.js";
import type { Db } from "#lib/server/db/client.js";

const rules = catalogRules(parseConfig(exampleRaw()).config);
function setup(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}
const input = (over: Partial<FastAddInput> = {}): FastAddInput => ({
	title: "1984",
	subtitle: "",
	originalTitle: "",
	responsibility: "George Orwell",
	author: "Orwell, George",
	publisher: "Mondadori",
	publicationPlace: "Milano",
	publicationYear: "2016",
	isbn: "9788804668237",
	issn: "",
	ean: "",
	physicalDescription: "333 p.",
	series: "",
	seriesNumber: "",
	dewey: "823.912",
	kind: "fiction",
	genreCode: "A",
	classCode: "",
	readingLevel: "3",
	subjects: "",
	notes: "",
	copies: "2",
	itemType: "libro",
	itemReadingLevel: "",
	acquisitionDate: "",
	source: "sbn",
	sourceId: "IT\\ICCU\\RMB\\0803390",
	...over,
});

describe("fastAddBiblio", () => {
	it("creates the record and its copies in one go with sequential Luhn barcodes", () => {
		const { db, actor } = setup();
		const now = new Date("2026-03-02T10:00:00Z");
		const result = fastAddBiblio(db, input(), actor, rules, now);
		expect(result.itemIds).toHaveLength(2);
		expect(result.barcodes).toEqual([itemCode(2026, 1), itemCode(2026, 2)]);
		const row = db.select().from(biblio).where(eq(biblio.id, result.biblioId)).get();
		expect(row).toMatchObject({
			source: "sbn",
			sourceId: "IT\\ICCU\\RMB\\0803390",
			isbn: "9788804668237",
		});
		const items = db.select().from(item).where(eq(item.biblioId, result.biblioId)).all();
		expect(items.map((i) => i.callNumber)).toEqual(["A 3 ORW", "A 3 ORW"]);
		expect(items.every((i) => i.acquisitionDate === "2026-03-02")).toBe(true);
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.map((a) => a.action),
		).toEqual(["biblio.create", "item.create"]);
	});

	it("rejects a bad copy count and rolls everything back on an invalid record", () => {
		const { db, actor } = setup();
		expect(() => fastAddBiblio(db, input({ copies: "0" }), actor, rules)).toThrow(
			CatalogValidationError,
		);
		expect(() => fastAddBiblio(db, input({ genreCode: "" }), actor, rules)).toThrow(
			CatalogValidationError,
		);
		// unknown item type: the biblio insert is undone with the failed item insert
		expect(() => fastAddBiblio(db, input({ itemType: "nope" }), actor, rules)).toThrow(
			CatalogValidationError,
		);
		expect(db.select().from(biblio).all()).toHaveLength(0);
		// typed source falls back to manual; the call number is computed (a copy text is ignored
		// by a scheme without one, Q143)
		const r = fastAddBiblio(
			db,
			input({ source: "", sourceId: "", itemCallText: "X 1", copies: "1" }),
			actor,
			rules,
		);
		expect(db.select().from(biblio).where(eq(biblio.id, r.biblioId)).get()).toMatchObject({
			source: "manual",
			sourceId: null,
		});
		expect(db.select().from(item).all()[0]).toMatchObject({
			callNumber: expect.any(String),
			callText: null,
		});
	});
});
