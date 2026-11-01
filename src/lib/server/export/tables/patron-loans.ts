// SPDX-License-Identifier: GPL-3.0-or-later
// Export of one patron's loan history (the "Storico" tab, step 2.7).
import * as v from "valibot";
import { textId } from "#lib/shared/input-schemas.js";
import { getConfig } from "#lib/server/config/index.js";
import { patronHistory } from "#lib/server/services/loan-lists.js";
import { todayIn } from "#lib/shared/dates.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

export const patronLoansExportSchema = v.object({
	patron: textId,
});

export function patronLoansExportColumns(labels: Record<string, string>): ExportColumn[] {
	const col = (id: string, type: ExportColumn["type"], widthMm: number): ExportColumn => ({
		id,
		label: labels[id] ?? id,
		type,
		widthMm,
	});
	return [
		col("issuedAt", "datetime", 32),
		col("dueDate", "date", 24),
		col("returnedAt", "datetime", 32),
		col("outcome", "string", 26),
		col("title", "string", 60),
		col("author", "string", 40),
		col("barcode", "string", 26),
		col("renewals", "number", 16),
		col("schoolYear", "string", 20),
	];
}

export function registerPatronLoansExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("patron-loans", {
		permission: "patrons",
		schema: patronLoansExportSchema,
		async build(db, params, _user, timezone) {
			const rows = patronHistory(
				db,
				Number(params.patron),
				todayIn(timezone),
				getConfig().library.schoolYearLabel,
			);
			const l = await labels();
			return {
				name: `patron-${params.patron}-loans`,
				timezone,
				columns: patronLoansExportColumns(l),
				rows: rows.map((r) => ({ ...r, outcome: l[`outcome_${r.outcome}`] ?? r.outcome })),
			};
		},
	});
}
