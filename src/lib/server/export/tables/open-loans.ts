// SPDX-License-Identifier: GPL-3.0-or-later
// Export of the loans grid (step 4.6): the open loans with the grid's filters.
import { patronSortName } from "#lib/shared/patron-name.js";
import { getConfig } from "#lib/server/config/index.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { openLoanRows } from "#lib/server/services/loan-lists.js";
import { loanFiltersSchema, toLoanFilters } from "#lib/shared/loan-filters.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

export function openLoansExportColumns(labels: Record<string, string>): ExportColumn[] {
	const col = (id: string, type: ExportColumn["type"], widthMm: number): ExportColumn => ({
		id,
		label: labels[id] ?? id,
		type,
		widthMm,
	});
	return [
		col("patron", "string", 45),
		col("classLabel", "string", 18),
		col("title", "string", 60),
		col("barcode", "string", 26),
		col("issuedAt", "datetime", 32),
		col("dueDate", "date", 24),
		col("daysOverdue", "number", 18),
		col("renewals", "number", 16),
		col("lastNoticeAt", "datetime", 32),
	];
}

export function registerOpenLoansExport(
	labels: () => Record<string, string> | Promise<Record<string, string>>,
): void {
	registerExport("open-loans", {
		permission: "loans",
		schema: loanFiltersSchema,
		async build(db, params, _user, timezone) {
			const l = await labels();
			const rows = openLoanRows(db, libraryToday(getConfig()), toLoanFilters(params));
			return {
				name: "prestiti-in-corso",
				timezone,
				columns: openLoansExportColumns(l),
				rows: rows.map((r) => ({
					...r,
					patron: patronSortName(r),
					classLabel: r.patronType === "teacher" ? l.teacher : (r.classLabel ?? ""),
				})),
			};
		},
	});
}
