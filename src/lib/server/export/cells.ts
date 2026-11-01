// SPDX-License-Identifier: GPL-3.0-or-later
// Cell value normalisation shared by the writers: dates in the library time zone, numbers as-is.
import { zonedParts } from "#lib/shared/dates.js";
import type { ExportColumnType } from "./types.js";

export interface Cell {
	type: ExportColumnType;
	/** Text as shown in a CSV cell. */
	text: string;
	/** ISO value for typed ODS cells (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm:ss`), numbers, booleans. */
	value: string | number | boolean | null;
}

function toDate(value: unknown): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "string" || typeof value === "number") {
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}

function localParts(d: Date, timezone: string): { date: string; time: string } {
	const z = zonedParts(d, timezone);
	return {
		date: `${z.year}-${z.month}-${z.day}`,
		time: `${z.hour}:${z.minute}:${z.second}`,
	};
}

/** Text of any exported value: objects as JSON, everything else as JavaScript prints it. */
function stringify(value: unknown): string {
	switch (typeof value) {
		case "string":
			return value;
		case "number":
		case "bigint":
		case "boolean":
			return value.toString();
		case "object":
			return JSON.stringify(value);
		case "symbol":
		case "undefined":
		case "function":
			return "";
	}
}

export function toCell(value: unknown, type: ExportColumnType, timezone: string): Cell {
	if (value === null || value === undefined || value === "") {
		return { type, text: "", value: null };
	}
	const asText = stringify(value);
	switch (type) {
		case "number": {
			const n = typeof value === "number" ? value : Number(value);
			return Number.isFinite(n)
				? { type, text: String(n), value: n }
				: { type: "string", text: asText, value: asText };
		}
		case "boolean": {
			const b = value === true || value === 1 || value === "true" || value === "1";
			return { type, text: b ? "true" : "false", value: b };
		}
		case "date": {
			const d = toDate(value);
			if (!d) {
				return { type: "string", text: asText, value: asText };
			}
			// a plain `YYYY-MM-DD` string is a calendar date already: keep it as written
			const text =
				typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
					? value
					: localParts(d, timezone).date;
			return { type, text, value: text };
		}
		case "datetime": {
			const d = toDate(value);
			if (!d) {
				return { type: "string", text: asText, value: asText };
			}
			const { date, time } = localParts(d, timezone);
			return { type, text: `${date} ${time.slice(0, 5)}`, value: `${date}T${time}` };
		}
		case "string": {
			return { type: "string", text: asText, value: asText };
		}
	}
}
