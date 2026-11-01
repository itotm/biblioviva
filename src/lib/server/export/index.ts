// SPDX-License-Identifier: GPL-3.0-or-later
// Entry point of the export service: file name, body and HTTP response for a TableExport.
import { fileStamp } from "#lib/shared/dates.js";
import { toCsv } from "./csv.js";
import { toOds } from "./ods.js";
import { EXPORT_MIME, type ExportFormat, type TableExport } from "./types.js";

export type { ExportColumn, ExportFormat, ExportRow, TableExport } from "./types.js";
export { EXPORT_FORMATS } from "./types.js";

/** `<table>-<YYYYMMDD-HHmm>.<ext>` in the library time zone. */
export function exportFileName(
	name: string,
	format: ExportFormat,
	now: Date,
	timezone: string,
): string {
	const stem = name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "export";
	return `${stem}-${fileStamp(now, timezone)}.${format}`;
}

export function exportBody(table: TableExport, format: ExportFormat): Uint8Array {
	return format === "csv" ? new TextEncoder().encode(toCsv(table)) : toOds(table);
}

export function exportResponse(
	table: TableExport,
	format: ExportFormat,
	now = new Date(),
): Response {
	const bytes = exportBody(table, format);
	const body = new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
	return new Response(body, {
		headers: {
			"Content-Type": EXPORT_MIME[format],
			"Content-Disposition": `attachment; filename="${exportFileName(table.name, format, now, table.timezone)}"`,
			"Content-Length": String(body.byteLength),
			"Cache-Control": "no-store",
		},
	});
}
