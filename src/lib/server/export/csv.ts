// SPDX-License-Identifier: GPL-3.0-or-later
// CSV writer (§3.19): UTF-8 with BOM, `;` separator (the default of spreadsheets set to Italian), CRLF,
// dates as YYYY-MM-DD. Every field that needs it is quoted; quotes are doubled.
import { toCell } from "./cells.js";
import type { TableExport } from "./types.js";

export const CSV_BOM = "﻿";
export const CSV_SEPARATOR = ";";

/** A first character that makes a spreadsheet read the cell as a formula. */
export const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One field. A text that a spreadsheet would read as a formula (`=`, `+`, `-`, `@`, tab, carriage
 * return first) gets a leading `'`, which spreadsheet programs show as plain text, and quotes;
 * numbers (`-3`) stay numbers. The imports drop that `'` again (`#lib/server/imports/csv.ts`).
 */
export function csvField(text: string, kind: "text" | "number" = "text"): string {
	const formula = kind === "text" && FORMULA_START.test(text);
	const value = formula ? `'${text}` : text;
	const needsQuotes = formula || /[";\r\n]/.test(value) || /^\s|\s$/.test(value);
	return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(table: TableExport): string {
	const lines: string[] = [table.columns.map((c) => csvField(c.label)).join(CSV_SEPARATOR)];
	for (const row of table.rows) {
		lines.push(
			table.columns
				.map((c) => {
					const cell = toCell(row[c.id], c.type ?? "string", table.timezone);
					return csvField(cell.text, cell.type === "number" ? "number" : "text");
				})
				.join(CSV_SEPARATOR),
		);
	}
	return `${CSV_BOM + lines.join("\r\n")}\r\n`;
}
