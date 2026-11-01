// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { staffUser } from "#lib/server/db/schema.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { missingItems, openInventory, recordScan } from "#lib/server/services/inventory.js";
import { getExport } from "../registry.js";
import type { TableExport } from "../types.js";
import { inventoryMissingSchema, registerInventoryMissingExport } from "./inventory-missing.js";
import { TEST_CODES as CODES } from "../../../../../tests/helpers/codes.js";

describe("inventory missing export", () => {
	it("exports the copies not scanned yet, by call number, filtered like the page", async () => {
		const db = createTestDb();
		seedDatabase(db, { patrons: 2, teachers: 0, biblios: 15, items: 25, loans: 0 });
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const campaign = openInventory(db, { name: "Giugno" }, actor);
		const before = missingItems(db, campaign.id);
		expect(before.length).toBeGreaterThan(2);
		recordScan(db, campaign.id, before[0]!.barcode, null, CODES, actor);
		registerInventoryMissingExport(() => ({ callNumber: "Segnatura", barcode: "Codice" }));
		const definition = getExport("inventory-missing")!;
		expect(definition.permission).toBe("catalog");
		const build = async (raw: Record<string, string>): Promise<TableExport> =>
			definition.build(
				db,
				v.parse(inventoryMissingSchema, raw),
				{ id: actor.id } as never,
				"Europe/Rome",
			);

		const table = await build({ inventory: String(campaign.id) });
		expect(table.name).toBe(`inventario-${campaign.id}-mancanti`);
		expect(table.columns.map((c) => c.label)).toEqual([
			"Segnatura",
			"Codice",
			"title",
			"author",
			"itemType",
		]);
		const rows = [...table.rows];
		expect(rows.map((r) => r.barcode)).toEqual(
			missingItems(db, campaign.id).map((m) => m.barcode),
		);
		expect(rows.map((r) => r.barcode)).not.toContain(before[0]!.barcode);

		const shelf = before[1]!.shelf;
		const onShelf = [...(await build({ inventory: String(campaign.id), shelf })).rows];
		expect(onShelf.length).toBeGreaterThan(0);
		expect(onShelf.every((r) => r.shelf === shelf)).toBe(true);
		const itemType = before[1]!.itemType;
		const ofType = [...(await build({ inventory: String(campaign.id), itemType })).rows];
		expect(ofType.every((r) => r.itemType === itemType)).toBe(true);
		expect(() => v.parse(inventoryMissingSchema, { inventory: "x" })).toThrow();
	});
});
