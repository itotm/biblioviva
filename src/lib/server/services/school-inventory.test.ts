// SPDX-License-Identifier: GPL-3.0-or-later
// The school inventory (PLAN.md step 9.64): the numbers of new copies, their uniqueness, the
// origin and value, the withdrawal kept on the copy and the two lists for the school office.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { item, staffUser } from "#lib/server/db/schema.js";
import { loadReports } from "#lib/server/reports/loader.js";
import type { BiblioFormInput, ItemFormInput } from "#lib/shared/catalog-schema.js";
import {
	catalogRules,
	CatalogValidationError,
	createBiblio,
	type CatalogRules,
} from "./catalog.js";
import { addItems, setItemStatus, updateItem } from "./catalog-items.js";
import { getBiblio } from "./catalog-search.js";
import { fastAddBiblio } from "./fast-add.js";
import { nextInventoryNumber } from "./school-inventory.js";

const config = parseConfig(exampleRaw()).config;
const off = catalogRules(config);
const on: CatalogRules = { ...off, inventory: { ...off.inventory, enabled: true } };

const book: BiblioFormInput = {
	title: "Il barone rampante",
	subtitle: "",
	originalTitle: "",
	responsibility: "",
	author: "Calvino, Italo",
	publisher: "Einaudi",
	publicationPlace: "",
	publicationYear: "1957",
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
	readingLevel: "",
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

function setup(): { db: Db; actor: { id: number }; biblioId: number } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const biblioId = createBiblio(db, book, actor, on);
	return { db, actor, biblioId };
}

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

const numbers = (db: Db, biblioId: number): (string | null)[] =>
	getBiblio(db, biblioId, on).items.map((i) => i.inventoryNumber);

describe("inventory numbers", () => {
	it("are the next ones when none is sent, none with the inventory off", () => {
		const { db, actor, biblioId } = setup();
		expect(nextInventoryNumber(db)).toBe("1");
		addItems(db, biblioId, copy, 2, actor, on);
		expect(numbers(db, biblioId)).toEqual(["1", "2"]);
		addItems(db, biblioId, copy, 1, actor, off);
		expect(numbers(db, biblioId)).toEqual(["1", "2", null]);
		expect(nextInventoryNumber(db)).toBe("3");
	});

	it("follow the number typed for the first copy, keeping its zeros", () => {
		const { db, actor, biblioId } = setup();
		addItems(db, biblioId, { ...copy, inventoryNumber: "000098" }, 3, actor, on);
		expect(numbers(db, biblioId)).toEqual(["000098", "000099", "000100"]);
		expect(nextInventoryNumber(db)).toBe("000101");
		// a number with letters counts for none of the next ones
		addItems(db, biblioId, { ...copy, inventoryNumber: "B-5000" }, 1, actor, on);
		expect(nextInventoryNumber(db)).toBe("000101");
	});

	it("leave a copy without one when the field is emptied", () => {
		const { db, actor, biblioId } = setup();
		addItems(db, biblioId, { ...copy, inventoryNumber: "" }, 1, actor, on);
		expect(numbers(db, biblioId)).toEqual([null]);
	});

	it("are unique and well formed", () => {
		const { db, actor, biblioId } = setup();
		addItems(db, biblioId, { ...copy, inventoryNumber: "10" }, 1, actor, on);
		expect(
			codes(() => addItems(db, biblioId, { ...copy, inventoryNumber: "9" }, 2, actor, on)),
		).toEqual(["inventoryNumber:inventoryNumberTaken"]);
		expect(
			codes(() => addItems(db, biblioId, { ...copy, inventoryNumber: "B-1" }, 2, actor, on)),
		).toEqual(["inventoryNumber:inventoryNumberSeries"]);
		expect(
			codes(() => addItems(db, biblioId, { ...copy, inventoryNumber: "1 2" }, 1, actor, on)),
		).toEqual(["inventoryNumber:inventoryNumberInvalid"]);
		const [first] = getBiblio(db, biblioId, on).items;
		addItems(db, biblioId, { ...copy, inventoryNumber: "11" }, 1, actor, on);
		const second = getBiblio(db, biblioId, on).items[1];
		expect(
			codes(() =>
				updateItem(db, second?.id ?? 0, { ...copy, inventoryNumber: "10" }, actor, on),
			),
		).toEqual(["inventoryNumber:inventoryNumberTaken"]);
		// a copy keeps its own number on a save
		expect(
			updateItem(
				db,
				first?.id ?? 0,
				{ ...copy, inventoryNumber: "10", notes: "x" },
				actor,
				on,
			),
		).not.toContain("inventoryNumber");
	});
});

describe("origin and value", () => {
	it("are saved with the inventory on and kept when it is off", () => {
		const { db, actor, biblioId } = setup();
		addItems(db, biblioId, { ...copy, origin: "Dono", value: "12,50" }, 1, actor, on);
		const it1 = getBiblio(db, biblioId, on).items[0];
		expect(it1).toMatchObject({ origin: "Dono", valueCents: 1250, inventoryNumber: "1" });
		expect(
			codes(() => updateItem(db, it1?.id ?? 0, { ...copy, value: "dodici" }, actor, on)),
		).toEqual(["value:valueInvalid"]);
		// off: what is sent is ignored and the copy keeps its values
		updateItem(
			db,
			it1?.id ?? 0,
			{ ...copy, origin: "Acquisto", value: "1", inventoryNumber: "" },
			actor,
			off,
		);
		expect(getBiblio(db, biblioId, on).items[0]).toMatchObject({
			origin: "Dono",
			valueCents: 1250,
			inventoryNumber: "1",
		});
		// on: an empty value clears it
		expect(updateItem(db, it1?.id ?? 0, { ...copy, value: "" }, actor, on)).toEqual([
			"valueCents",
		]);
	});

	it("come with Nuovo libro, the copies numbered in a row", () => {
		const { db, actor } = setup();
		const r = fastAddBiblio(
			db,
			{
				...book,
				title: "Le città invisibili",
				copies: "2",
				itemReadingLevel: "",
				acquisitionDate: "",
				itemOrigin: "Acquisto",
				itemValue: "9.90",
				source: "manual",
				sourceId: "",
			},
			actor,
			on,
		);
		expect(getBiblio(db, r.biblioId, on).items).toMatchObject([
			{ inventoryNumber: "1", origin: "Acquisto", valueCents: 990 },
			{ inventoryNumber: "2", origin: "Acquisto", valueCents: 990 },
		]);
	});
});

describe("withdrawals", () => {
	it("keep their day and reason on the copy, cleared when the copy comes back", () => {
		const { db, actor, biblioId } = setup();
		addItems(db, biblioId, copy, 1, actor, on);
		const id = getBiblio(db, biblioId, on).items[0]?.id ?? 0;
		const day = new Date("2026-11-30T23:30:00Z");
		setItemStatus(db, id, "withdrawn", "usurato", actor, day, "Europe/Rome");
		const row = (): typeof item.$inferSelect | undefined =>
			db.select().from(item).where(eq(item.id, id)).get();
		// the library's day, not the UTC one
		expect(row()).toMatchObject({ withdrawnOn: "2026-12-01", withdrawnReason: "usurato" });
		// set again: the first day stays
		setItemStatus(db, id, "withdrawn", "altro", actor, new Date("2027-01-10T10:00:00Z"));
		expect(row()).toMatchObject({ withdrawnOn: "2026-12-01", withdrawnReason: "usurato" });
		setItemStatus(db, id, "available", null, actor);
		expect(row()).toMatchObject({ withdrawnOn: null, withdrawnReason: null });
	});
});

describe("the lists for the school office", () => {
	const library = loadReports("/nonexistent-config-dir");
	const sqlOf = (id: string): string => {
		const r = library.reports.find((x) => x.id === id);
		if (!r) {
			throw new Error(`no report ${id}`);
		}
		return r.sql;
	};

	it("list the copies withdrawn and entered in a period", () => {
		const { db, actor, biblioId } = setup();
		addItems(
			db,
			biblioId,
			{ ...copy, acquisitionDate: "2026-09-15", origin: "Dono", value: "10" },
			2,
			actor,
			on,
		);
		addItems(db, biblioId, { ...copy, acquisitionDate: "2025-01-10" }, 1, actor, on);
		const ids = getBiblio(db, biblioId, on).items.map((i) => i.id);
		setItemStatus(
			db,
			ids[0] ?? 0,
			"withdrawn",
			"smarrito",
			actor,
			new Date("2026-10-05T10:00:00Z"),
		);
		setItemStatus(db, ids[2] ?? 0, "withdrawn", null, actor, new Date("2025-06-05T10:00:00Z"));
		const run = (id: string): Record<string, unknown>[] =>
			db.$client
				.query<Record<string, unknown>, [Record<string, string>]>(sqlOf(id))
				.all({ from: "2026-09-01", to: "2027-08-31" });
		expect(run("withdrawn-copies")).toEqual([
			expect.objectContaining({
				inventory_number: "1",
				title: "Il barone rampante",
				withdrawn_on: "2026-10-05",
				reason: "smarrito",
				origin: "Dono",
				value: 10,
			}),
		]);
		expect(run("entered-copies").map((r) => r.inventory_number)).toEqual(["1", "2"]);
	});
});
