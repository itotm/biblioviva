// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { item, patron, staffUser } from "#lib/server/db/schema.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { addEntries, createPrintList } from "#lib/server/services/print-lists.js";
import { toCsv } from "../csv.js";
import { getExport } from "../registry.js";
import { listItemsExportSchema, registerListItemsExport } from "./list-items.js";

describe("list items export", () => {
	it("exports the copies of an item list in list order, with the status in words", async () => {
		const db = createTestDb();
		seedDatabase(db, { patrons: 4, teachers: 1, biblios: 6, items: 8, loans: 0 });
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const copies = db.select({ id: item.id, barcode: item.barcode }).from(item).all();
		const [first, second, third] = copies;
		const status = { [first!.id]: "available", [second!.id]: "damaged", [third!.id]: "lost" };
		for (const [id, value] of Object.entries(status)) {
			db.update(item)
				.set({ status: value as "available" })
				.where(eq(item.id, Number(id)))
				.run();
		}
		const list = createPrintList(db, "items", "Scarto", actor);
		addEntries(db, list, [third!.id, first!.id, second!.id], actor);
		registerListItemsExport(() => ({
			position: "N.",
			barcode: "Codice",
			status_available: "Disponibile",
			status_damaged: "Danneggiato",
		}));
		const definition = getExport("list-items")!;
		expect(definition.permission).toBe("catalog");
		const params = v.parse(listItemsExportSchema, { list: String(list) });
		const table = await definition.build(db, params, { id: actor.id } as never, "Europe/Rome");
		expect(table.name).toBe(`lista-${list}`);
		expect(table.columns.map((c) => c.label)).toEqual([
			"N.",
			"Codice",
			"title",
			"author",
			"callNumber",
			"status",
		]);
		const rows = [...table.rows];
		expect(rows.map((r) => r.barcode)).toEqual([
			third!.barcode,
			first!.barcode,
			second!.barcode,
		]);
		expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
		// a status without a label keeps its code
		expect(rows.map((r) => r.status)).toEqual(["lost", "Disponibile", "Danneggiato"]);
		expect(toCsv(table)).toContain("N.;Codice;title");

		// a list of patrons has no copies to export
		const patrons = createPrintList(db, "patrons", "Tessere", actor);
		addEntries(
			db,
			patrons,
			db
				.select({ id: patron.id })
				.from(patron)
				.all()
				.map((p) => p.id),
			actor,
		);
		const empty = await definition.build(
			db,
			{ list: String(patrons) },
			{ id: actor.id } as never,
			"Europe/Rome",
		);
		expect([...empty.rows]).toEqual([]);
		expect(() => v.parse(listItemsExportSchema, { list: "1; DROP" })).toThrow();
	});
});
