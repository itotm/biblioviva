// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { openExportDb, type ExportDb } from "../../../../../tests/helpers/export-db.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import { item, patron } from "#lib/server/db/schema.js";
import { openInventory } from "#lib/server/services/inventory.js";
import { addEntries, createPrintList } from "#lib/server/services/print-lists.js";
import { exportTables, getExport } from "../registry.js";
import { registerAllExports } from "./index.js";

const admin: AuthUser = {
	id: 1,
	username: "admin",
	displayName: "Admin",
	roles: ["admin"],
	permissions: ["loans", "patrons", "catalog", "reports", "admin"],
};

let fx: ExportDb;
beforeAll(() => {
	fx = openExportDb();
	admin.id = fx.actor.id;
});
afterAll(() => fx.close());

describe("registerAllExports", () => {
	it("registers every table once and resolves localized labels", async () => {
		registerAllExports();
		registerAllExports();
		expect(exportTables()).toEqual(
			expect.arrayContaining(["audit", "patrons", "patron-loans"]),
		);
		const db = createTestDb();
		const audit = await getExport("audit")!.build(db, {}, { id: 1 } as never, "Europe/Rome");
		expect(audit.columns.map((c) => c.label)).toEqual([
			"Quando",
			"Account",
			"Operazione",
			"Oggetto",
			"ID",
			"Dettagli",
		]);
		const patrons = await getExport("patrons")!.build(
			db,
			{},
			{ id: 1 } as never,
			"Europe/Rome",
		);
		expect(patrons.columns[0]?.label).toBe("Cognome");
		const loans = getExport("patron-loans")!;
		await expect(
			loans.build(db, { patron: "999" }, { id: 1 } as never, "Europe/Rome"),
		).rejects.toThrow();
	});

	it("gives every column of every table a translated header", async () => {
		registerAllExports();
		const { db, actor } = fx;
		const list = createPrintList(db, "items", "Scarto", actor);
		addEntries(
			db,
			list,
			db
				.select({ id: item.id })
				.from(item)
				.limit(3)
				.all()
				.map((r) => r.id),
			actor,
		);
		const inventory = openInventory(db, { name: "Giugno" }, actor);
		const someone = db.select({ id: patron.id }).from(patron).limit(1).get()!;
		const params: Record<string, Record<string, string>> = {
			audit: {},
			catalog: {},
			"inventory-missing": { inventory: String(inventory.id) },
			"list-items": { list: String(list) },
			"open-loans": {},
			"patron-loans": { patron: String(someone.id) },
			patrons: {},
			report: { id: "acquisitions-by-year" },
			wishlist: {},
		};
		expect(exportTables()).toEqual(Object.keys(params).sort());
		for (const [table, raw] of Object.entries(params)) {
			const definition = getExport(table)!;
			const built = await definition.build(
				db,
				v.parse(definition.schema, raw),
				admin,
				"Europe/Rome",
			);
			for (const column of built.columns) {
				// a missing translation comes back as its key, a missing label as the column id
				expect(column.label, `${table}.${column.id}`).not.toMatch(/^[a-z]+(\.\w+)+$/);
				expect(column.label, `${table}.${column.id}`).not.toBe(column.id);
			}
		}
	});
});
