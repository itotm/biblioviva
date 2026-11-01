// SPDX-License-Identifier: GPL-3.0-or-later
// Report definitions (PLAN.md §3.11, Appendix B, step 9.20): one JSON file per report with its
// parameters, a single read-only SQL statement or a guided `query` compiled into one, the
// columns, an optional pivot (a column dimension whose values become the columns, with totals) and
// an optional chart. Texts may be a plain string or one string per language
// (`{ "it": "…", "en": "…" }`), so the built-ins speak both.
import * as v from "valibot";
import { localeCode } from "#lib/shared/input-schemas.js";
import { PIVOT_TOTALS, querySchema } from "./builder/spec.js";

export const localizedText = v.union([
	v.pipe(v.string(), v.minLength(1), v.maxLength(300)),
	v.pipe(
		v.record(localeCode, v.pipe(v.string(), v.maxLength(300))),
		v.check((r) => Object.keys(r).length > 0, "at least one language"),
	),
]);
export type LocalizedText = v.InferOutput<typeof localizedText>;

/** The text in `locale`, else English, else the first language given. */
export function localize(text: LocalizedText, locale: string): string {
	if (typeof text === "string") {
		return text;
	}
	return text[locale] ?? text.en ?? Object.values(text)[0] ?? "";
}

export const REPORT_CATEGORIES = ["loans", "books", "patrons", "ops"] as const;
export const PARAM_TYPES = [
	"date",
	"dateRange",
	"int",
	"text",
	"select",
	// Phase 12: a level of the school (code), a stage (code), a class (group id)
	"level",
	"stage",
	"group",
	"patronType",
	"itemType",
] as const;
/**
 * Column types: values, and codes the app turns into words in the library's language
 * (`classification`: "590" → "590 · Animali", `@unclassified` → "Da classificare";
 * `patronType`, `itemType`, `itemStatus`, `weekday` 0 = Sunday … 6, `boolean` 0/1 → no/yes;
 * `level` a level code, `@teachers` the teachers' row; `stage` a stage code; `kind`
 * fiction/nonfiction/`@unclassified`; `month` `2026-09`; `decade` 1990 → "1990–1999").
 */
export const COLUMN_TYPES = [
	"int",
	"number",
	"text",
	"date",
	"datetime",
	"percent",
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
] as const;

/**
 * Parameters every report may use without declaring them: today and the first day of the school
 * year in the library's zone, and the known classification codes as a JSON array (for
 * `json_each(:classificationCodes)`).
 */
export const IMPLICIT_PARAMS = ["today", "schoolYearStart", "classificationCodes"] as const;
/** Chart.js controllers the app registers (lazy chunk): bar, line and doughnut only. */
export const CHART_TYPES = ["bar", "line", "doughnut"] as const;

const name = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/));

export const reportParamSchema = v.object({
	name,
	label: localizedText,
	type: v.picklist(PARAM_TYPES),
	required: v.optional(v.boolean(), false),
	/**
	 * A literal (`"2026-09-01"`, `10`) or, for dates, a symbolic day resolved in the library's time
	 * zone by `run.ts`: `today`, `schoolYearStart`, `monthStart`, `yearStart`.
	 */
	default: v.optional(v.union([v.string(), v.number()])),
	/** `select` only. */
	options: v.optional(
		v.array(v.object({ value: v.union([v.string(), v.number()]), label: localizedText })),
	),
	min: v.optional(v.number()),
	max: v.optional(v.number()),
});
export type ReportParam = v.InferOutput<typeof reportParamSchema>;

export const reportColumnSchema = v.object({
	key: v.pipe(v.string(), v.regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/)),
	label: localizedText,
	type: v.optional(v.picklist(COLUMN_TYPES), "text"),
	/** Read but not shown (the order of the values of a pivot's column dimension). */
	hidden: v.optional(v.boolean(), false),
});
export type ReportColumn = v.InferOutput<typeof reportColumnSchema>;

const columnRef = v.pipe(v.string(), v.minLength(1));

export const pivotSchema = v.object({
	/** The row dimensions (one row per value or pair of values). */
	rows: v.pipe(v.array(columnRef), v.minLength(1), v.maxLength(2)),
	/** The column whose values become the columns of the table. */
	columns: columnRef,
	/** The number summed in each cell. */
	value: columnRef,
	/** The column that orders the values of `columns` (else their first appearance). */
	columnOrder: v.optional(columnRef),
	totals: v.optional(v.picklist(PIVOT_TOTALS), "both"),
});
export type ReportPivot = v.InferOutput<typeof pivotSchema>;

const entries = {
	id: v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{0,63}$/)),
	title: localizedText,
	description: v.optional(localizedText),
	category: v.picklist(REPORT_CATEGORIES),
	/** Only administrators may run it (e.g. the readers' ranking). */
	restricted: v.optional(v.boolean(), false),
	params: v.optional(v.array(reportParamSchema), []),
	/** The guided form (9.20): compiled into `sql`, `columns`, `params`, `pivot`, `chart`. */
	query: v.optional(querySchema),
	pivot: v.optional(pivotSchema),
	chart: v.optional(
		v.object({
			type: v.picklist(CHART_TYPES),
			/** Column(s) on the x axis (joined with a space, e.g. class + section). */
			x: v.union([columnRef, v.array(columnRef)]),
			/** Column(s) plotted as series (a pivot plots one series per column value). */
			y: v.union([columnRef, v.array(columnRef)]),
		}),
	),
	defaultSort: v.optional(
		v.object({ key: columnRef, dir: v.optional(v.picklist(["asc", "desc"]), "asc") }),
	),
	rowLimit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50_000)), 5000),
};

const sqlText = v.pipe(v.string(), v.minLength(6), v.maxLength(20_000));
const columnList = v.pipe(v.array(reportColumnSchema), v.minLength(1));

/**
 * A report file: an SQL report (`sql` and `columns`) or a guided one (`query`, the rest is
 * compiled from it); never both.
 */
export const reportFileSchema = v.pipe(
	v.object({ ...entries, sql: v.optional(sqlText), columns: v.optional(columnList) }),
	v.check(
		(d) => (d.sql === undefined) !== (d.query === undefined),
		"a report has either sql or query",
	),
	v.check(
		(d) => d.query !== undefined || d.columns !== undefined,
		"an SQL report declares its columns",
	),
);

/** A report ready to run: its SQL and columns, written or compiled from `query`. */
export const reportDefinitionSchema = v.pipe(
	v.object({ ...entries, sql: sqlText, columns: columnList }),
	v.check(
		(d) => new Set(d.params.map((p) => p.name)).size === d.params.length,
		"parameter names must be unique",
	),
	v.check(
		(d) => d.params.every((p) => p.type !== "select" || (p.options?.length ?? 0) > 0),
		"a select parameter needs options",
	),
	v.check((d) => {
		const keys = new Set(d.columns.map((c) => c.key));
		const refs = d.chart ? [d.chart.x, d.chart.y].flat() : [];
		return refs.every((r) => keys.has(r)) && (!d.defaultSort || keys.has(d.defaultSort.key));
	}, "chart and sort must name declared columns"),
	v.check((d) => {
		if (!d.pivot) {
			return true;
		}
		const keys = new Set(d.columns.map((c) => c.key));
		const p = d.pivot;
		return [...p.rows, p.columns, p.value, ...(p.columnOrder ? [p.columnOrder] : [])].every(
			(k) => keys.has(k),
		);
	}, "the pivot must name declared columns"),
);
export type ReportDefinition = v.InferOutput<typeof reportDefinitionSchema>;

/** The SQL parameter names a report parameter provides: a date range gives `<name>From`/`<name>To`. */
export function boundNames(param: ReportParam): string[] {
	return param.type === "dateRange" ? [`${param.name}From`, `${param.name}To`] : [param.name];
}
