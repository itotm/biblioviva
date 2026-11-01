// SPDX-License-Identifier: GPL-3.0-or-later
// Words for the codes a report returns (steps 6.3, 9.20): columns typed `classification`,
// `patronType`, `itemType`, `itemStatus`, `weekday`, `boolean`, `level`, `stage`, `kind`, `month`
// or `decade` are shown (and exported) in the library's language, with the labels of its
// configuration; the special rows `@teachers` and `@unclassified` get their words too.
import type { ClassificationScheme } from "#lib/shared/classification.js";
import { classOf, genreOf } from "#lib/shared/classification.js";
import type { ReportColumn } from "./definition.js";

export interface Decorations {
	locale: string;
	scheme: ClassificationScheme;
	itemTypes: Readonly<Record<string, string>>;
	patronTypes: Readonly<Record<string, string>>;
	itemStatuses: Readonly<Record<string, string>>;
	/** Level code → its label in the class labels (`3`, `3ª`). */
	levels: Readonly<Record<string, string>>;
	/** Stage code → its name. */
	stages: Readonly<Record<string, string>>;
	/** `fiction`, `nonfiction` → the words of the catalogue. */
	kinds: Readonly<Record<string, string>>;
	/** The row of the teachers in a class-year dimension. */
	teachers: string;
	/** A record still to classify (9.21). */
	unclassified: string;
	/** The total row and column of a pivot table. */
	total: string;
	yes: string;
	no: string;
}

export const TEACHERS = "@teachers";
export const UNCLASSIFIED = "@unclassified";

function weekdayName(n: number, locale: string): string {
	// 1 January 2023 was a Sunday: SQLite's strftime('%w') counts from Sunday = 0
	return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
		new Date(Date.UTC(2023, 0, 1 + n)),
	);
}

function decorate(type: ReportColumn["type"], value: unknown, d: Decorations): unknown {
	if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
		return value;
	}
	const text = String(value);
	switch (type) {
		case "classification": {
			if (text === UNCLASSIFIED) {
				return d.unclassified;
			}
			const node = genreOf(d.scheme, text) ?? classOf(d.scheme, text);
			return node ? `${node.code} · ${node.label}` : text;
		}
		case "level":
			return text === TEACHERS ? d.teachers : (d.levels[text] ?? text);
		case "stage":
			return d.stages[text] ?? text;
		case "kind":
			return text === UNCLASSIFIED ? d.unclassified : (d.kinds[text] ?? text);
		case "month": {
			const m = /^(\d{4})-(\d{2})$/.exec(text);
			return m
				? new Intl.DateTimeFormat(d.locale, {
						month: "long",
						year: "numeric",
						timeZone: "UTC",
					}).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)))
				: text;
		}
		case "decade":
			return /^\d{3,4}$/.test(text) ? `${text}–${Number(text) + 9}` : text;
		case "patronType":
			return d.patronTypes[text] ?? text;
		case "itemType":
			return d.itemTypes[text] ?? text;
		case "itemStatus":
			return d.itemStatuses[text] ?? text;
		case "weekday":
			return /^[0-6]$/.test(text) ? weekdayName(Number(text), d.locale) : text;
		case "boolean":
			return value === 0 || value === "0" || value === false ? d.no : d.yes;
		case "int":
		case "number":
		case "percent":
		case "text":
		case "date":
		case "datetime":
			return value;
	}
}

const DECORATED = new Set<ReportColumn["type"]>([
	"classification",
	"patronType",
	"itemType",
	"itemStatus",
	"weekday",
	"boolean",
	"level",
	"stage",
	"kind",
	"month",
	"decade",
]);

/** The rows with the coded columns turned into words; other columns are untouched. */
export function decorateRows(
	columns: readonly Pick<ReportColumn, "key" | "type">[],
	rows: readonly Record<string, unknown>[],
	d: Decorations,
): Record<string, unknown>[] {
	const coded = columns.filter((c) => DECORATED.has(c.type));
	if (coded.length === 0) {
		return [...rows];
	}
	return rows.map((row) => {
		const out = { ...row };
		for (const c of coded) {
			out[c.key] = decorate(c.type, row[c.key], d);
		}
		return out;
	});
}
