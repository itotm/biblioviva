// SPDX-License-Identifier: GPL-3.0-or-later
// Export of the patrons grid with its filters (name search, type, level, class, status).
import * as v from "valibot";
import { configCodeOrEmpty, levelCodeOrEmpty } from "#lib/shared/input-schemas.js";
import { getConfig } from "#lib/server/config/index.js";
import { searchPatrons } from "#lib/server/services/patron-search.js";
import { todayIn } from "#lib/shared/dates.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

export const patronsExportSchema = v.object({
	q: v.optional(v.pipe(v.string(), v.maxLength(80)), ""),
	patronType: v.optional(v.union([v.picklist(["student", "teacher"]), v.literal("")]), ""),
	levelCode: v.optional(levelCodeOrEmpty, ""),
	groupId: v.optional(v.pipe(v.string(), v.regex(/^\d{0,9}$/)), ""),
	stage: v.optional(configCodeOrEmpty, ""),
	status: v.optional(v.union([v.picklist(["active", "anonymized"]), v.literal("")]), ""),
});

export function patronsExportColumns(labels: Record<string, string>): ExportColumn[] {
	return [
		{ id: "lastName", label: labels.lastName ?? "lastName", type: "string", widthMm: 40 },
		{ id: "firstName", label: labels.firstName ?? "firstName", type: "string", widthMm: 35 },
		{ id: "patronType", label: labels.patronType ?? "patronType", type: "string", widthMm: 22 },
		{ id: "classLabel", label: labels.classLabel ?? "classLabel", type: "string", widthMm: 24 },
		{ id: "cardNumber", label: labels.cardNumber ?? "cardNumber", type: "string", widthMm: 30 },
		{ id: "status", label: labels.status ?? "status", type: "string", widthMm: 22 },
		{ id: "openLoans", label: labels.openLoans ?? "openLoans", type: "number", widthMm: 18 },
		{
			id: "overdueLoans",
			label: labels.overdueLoans ?? "overdueLoans",
			type: "number",
			widthMm: 18,
		},
	];
}

export function registerPatronsExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("patrons", {
		permission: "patrons",
		schema: patronsExportSchema,
		async build(db, params, _user, timezone) {
			// the exact results only: an export never carries the approximate ones (9.24)
			const rows = searchPatrons(
				db,
				{ ...params, limit: 2000 },
				todayIn(timezone),
				getConfig().ui.locale,
			).rows.filter((r) => !r.similar);
			const l = await labels();
			return {
				name: "patrons",
				timezone,
				columns: patronsExportColumns(l),
				rows: rows.map((r) => ({
					...r,
					patronType: l[`type_${r.patronType}`] ?? r.patronType,
					status: l[`status_${r.status}`] ?? r.status,
				})),
			};
		},
	});
}
