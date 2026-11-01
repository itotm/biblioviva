// SPDX-License-Identifier: GPL-3.0-or-later
// Export of the wishlist (step 9.15): the grid's search and sort, for the purchases; who asked is
// never exported.
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { canAny } from "#lib/server/auth/rbac.js";
import { listWishes } from "#lib/server/services/wishlist.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

export const wishlistExportSchema = v.object({
	q: v.optional(v.pipe(v.string(), v.maxLength(120)), ""),
	sort: v.optional(v.picklist(["recent", "requests", "title", "author"]), "recent"),
});

export function wishlistExportColumns(labels: Record<string, string>): ExportColumn[] {
	const col = (id: string, type: ExportColumn["type"], widthMm: number): ExportColumn => ({
		id,
		label: labels[id] ?? id,
		type,
		widthMm,
	});
	return [
		col("title", "string", 60),
		col("author", "string", 40),
		col("series", "string", 40),
		col("seriesNumber", "string", 14),
		col("requests", "number", 16),
		col("note", "string", 50),
		col("createdAt", "datetime", 30),
	];
}

export function registerWishlistExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("wishlist", {
		schema: wishlistExportSchema,
		async build(db, params, user, timezone) {
			if (!canAny(user, ["loans", "catalog"])) {
				error(403, "forbidden: loans or catalog");
			}
			const l = await labels();
			return {
				name: "lista-desideri",
				timezone,
				columns: wishlistExportColumns(l),
				rows: listWishes(db, params).map((w) => ({
					title: w.title,
					author: w.author,
					series: w.series,
					seriesNumber: w.seriesNumber,
					requests: w.requests,
					note: w.note,
					createdAt: w.createdAt,
				})),
			};
		},
	});
}
