// SPDX-License-Identifier: GPL-3.0-or-later
// Export of the copies still missing in a stocktaking campaign (step 9.8), by call number,
// filtered like the page (shelf, item type).
import * as v from "valibot";
import { textId } from "#lib/shared/input-schemas.js";
import { getConfig } from "#lib/server/config/index.js";
import { missingItems } from "#lib/server/services/inventory.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

export const inventoryMissingSchema = v.object({
	inventory: textId,
	shelf: v.optional(v.pipe(v.string(), v.maxLength(40))),
	itemType: v.optional(v.pipe(v.string(), v.maxLength(40))),
});

export function registerInventoryMissingExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("inventory-missing", {
		permission: "catalog",
		schema: inventoryMissingSchema,
		// the missing copies with their titles, in MARC (9.65)
		marc(db, params) {
			return {
				name: `inventario-${params.inventory}-mancanti`,
				selection: {
					itemIds: missingItems(db, Number(params.inventory), {
						shelf: params.shelf ?? null,
						itemType: params.itemType ?? null,
					}).map((m) => m.itemId),
				},
			};
		},
		async build(db, params, _user, timezone) {
			const l = await labels();
			const col = (id: string, widthMm: number): ExportColumn => ({
				id,
				label: l[id] ?? id,
				type: "string",
				widthMm,
			});
			return {
				name: `inventario-${params.inventory}-mancanti`,
				timezone,
				columns: [
					// the school inventory's number, for the five-yearly check (9.64)
					...(getConfig().catalog.inventory.enabled ? [col("inventoryNumber", 22)] : []),
					col("callNumber", 26),
					col("barcode", 26),
					col("title", 70),
					col("author", 40),
					col("itemType", 20),
				],
				rows: missingItems(db, Number(params.inventory), {
					shelf: params.shelf ?? null,
					itemType: params.itemType ?? null,
				}).map((m) => ({ ...m })),
			};
		},
	});
}
