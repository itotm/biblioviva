// SPDX-License-Identifier: GPL-3.0-or-later
// Common descriptor for table exports (PLAN.md §3.19): the same object feeds the CSV and ODS writers.

export type ExportColumnType = "string" | "number" | "date" | "datetime" | "boolean";

export interface ExportColumn {
	id: string;
	label: string;
	type?: ExportColumnType;
	/** Column width in millimetres (ODS); defaults by type. */
	widthMm?: number;
}

export type ExportRow = Record<string, unknown>;

export interface TableExport {
	/** File name stem, e.g. `patrons`, `audit`. */
	name: string;
	columns: ExportColumn[];
	rows: Iterable<ExportRow>;
	/** Library time zone used to render dates and datetimes. */
	timezone: string;
}

export type ExportFormat = "csv" | "ods";

export const EXPORT_FORMATS: readonly ExportFormat[] = ["csv", "ods"];

export const EXPORT_MIME: Record<ExportFormat, string> = {
	csv: "text/csv; charset=utf-8",
	ods: "application/vnd.oasis.opendocument.spreadsheet",
};
