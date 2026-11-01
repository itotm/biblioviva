// SPDX-License-Identifier: GPL-3.0-or-later
// Export of a list of copies (step 3.10): the entries of an item print list in list order, e.g.
// the books scanned for a withdrawal, to keep with the paperwork.
import * as v from "valibot";
import { textId } from "#lib/shared/input-schemas.js";
import { itemListRows } from "#lib/server/services/print-list-items.js";
import { getPrintList } from "#lib/server/services/print-lists.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

export const listItemsExportSchema = v.object({
	list: textId,
});

export function listItemsExportColumns(labels: Record<string, string>): ExportColumn[] {
	const col = (id: string, type: ExportColumn["type"], widthMm: number): ExportColumn => ({
		id,
		label: labels[id] ?? id,
		type,
		widthMm,
	});
	return [
		col("position", "number", 12),
		col("barcode", "string", 26),
		col("title", "string", 70),
		col("author", "string", 40),
		col("callNumber", "string", 26),
		col("status", "string", 24),
	];
}

export function registerListItemsExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("list-items", {
		permission: "catalog",
		schema: listItemsExportSchema,
		async build(db, params, _user, timezone) {
			const listId = Number(params.list);
			const list = getPrintList(db, listId);
			const l = await labels();
			return {
				name: `lista-${listId}`,
				timezone,
				columns: listItemsExportColumns(l),
				rows:
					list.kind === "items"
						? itemListRows(db, listId).map((r) => ({
								...r,
								status: l[`status_${r.status}`] ?? r.status,
							}))
						: [],
			};
		},
	});
}
