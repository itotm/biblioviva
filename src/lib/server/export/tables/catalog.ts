// SPDX-License-Identifier: GPL-3.0-or-later
// Export of the catalogue grid with its filters (search, kind, genre, class, reading level, item
// type, series).
import * as v from "valibot";
import { levelCodeOrEmpty } from "#lib/shared/input-schemas.js";
import { getConfig } from "#lib/server/config/index.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import { searchBiblios } from "#lib/server/services/catalog-search.js";
import { classificationOf } from "#lib/shared/classification.js";
import { formatSeries } from "#lib/shared/series.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

export const catalogExportSchema = v.object({
	q: v.optional(v.pipe(v.string(), v.maxLength(120)), ""),
	kind: v.optional(
		v.union([v.picklist(["fiction", "nonfiction", "unclassified"]), v.literal("")]),
		"",
	),
	genreCode: v.optional(v.pipe(v.string(), v.maxLength(16)), ""),
	classCode: v.optional(v.pipe(v.string(), v.maxLength(16)), ""),
	readingLevel: v.optional(levelCodeOrEmpty, ""),
	itemType: v.optional(v.pipe(v.string(), v.maxLength(32)), ""),
	series: v.optional(v.pipe(v.string(), v.maxLength(200)), ""),
});

export function catalogExportColumns(labels: Record<string, string>): ExportColumn[] {
	return [
		{ id: "title", label: labels.title ?? "title", type: "string", widthMm: 60 },
		{
			id: "originalTitle",
			label: labels.originalTitle ?? "originalTitle",
			type: "string",
			widthMm: 50,
		},
		{ id: "series", label: labels.series ?? "series", type: "string", widthMm: 40 },
		{ id: "author", label: labels.author ?? "author", type: "string", widthMm: 40 },
		{ id: "year", label: labels.year ?? "year", type: "number", widthMm: 14 },
		{ id: "isbn", label: labels.isbn ?? "isbn", type: "string", widthMm: 30 },
		{ id: "kind", label: labels.kind ?? "kind", type: "string", widthMm: 22 },
		{
			id: "classification",
			label: labels.classification ?? "classification",
			type: "string",
			widthMm: 40,
		},
		{
			id: "readingLevel",
			label: labels.readingLevel ?? "readingLevel",
			type: "number",
			widthMm: 14,
		},
		{
			id: "copiesTotal",
			label: labels.copiesTotal ?? "copiesTotal",
			type: "number",
			widthMm: 14,
		},
		{
			id: "copiesAvailable",
			label: labels.copiesAvailable ?? "copiesAvailable",
			type: "number",
			widthMm: 16,
		},
	];
}

export function registerCatalogExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("catalog", {
		schema: catalogExportSchema,
		async build(db, params, _user, timezone) {
			const rules = catalogRules(getConfig());
			// the exact results only: an export never carries the approximate ones (9.24)
			const rows = searchBiblios(db, { ...params, limit: 2000 }, rules).rows.filter(
				(r) => !r.similar,
			);
			const l = await labels();
			return {
				name: "catalog",
				timezone,
				columns: catalogExportColumns(l),
				rows: rows.map((r) => {
					const node = classificationOf(rules.scheme, r);
					return {
						title: r.title,
						originalTitle: r.originalTitle,
						series: formatSeries(r.series, r.seriesNumber),
						author: r.author,
						year: r.publicationYear,
						isbn: r.isbn,
						// a record still to classify (step 9.21)
						kind: l[`kind_${r.kind ?? "unclassified"}`] ?? r.kind,
						classification: node
							? `${node.code} ${node.label}`
							: (r.genreCode ?? r.classCode),
						readingLevel: r.readingLevel,
						callNumber: r.callNumbers,
						acquiredAt: r.acquiredAt,
						copiesTotal: r.copiesTotal,
						copiesAvailable: r.copiesAvailable,
					};
				}),
			};
		},
	});
}
