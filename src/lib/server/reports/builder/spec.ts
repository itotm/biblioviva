// SPDX-License-Identifier: GPL-3.0-or-later
// The guided form of a report (PLAN.md step 9.20, Q116, ADR-033): instead of `sql`, a definition
// may carry `query` — the source, the filters (each fixed or asked at run time), the rows, an
// optional column dimension (a pivot table), the measures, the totals and the chart. The names are
// the keys of the catalogue in `catalogue.ts`; `compile.ts` turns the query into SQL.
import * as v from "valibot";

export const QUERY_SOURCES = ["loans", "items", "patrons"] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];

export const PIVOT_TOTALS = ["none", "rows", "columns", "both"] as const;
export type PivotTotals = (typeof PIVOT_TOTALS)[number];

const key = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/));

export const queryFilterSchema = v.object({
	/** A filter of the source (`period`, `patronType`, `level`, …). */
	field: key,
	/** The fixed value (a code, an id, `YYYY-MM-DD..YYYY-MM-DD` for a period); absent when asked. */
	value: v.optional(v.union([v.pipe(v.string(), v.maxLength(40)), v.number()])),
	/** Asked in the report's form at run time (the value, if any, is the default). */
	ask: v.optional(v.boolean(), false),
});

export const querySchema = v.object({
	source: v.picklist(QUERY_SOURCES),
	filters: v.optional(v.array(queryFilterSchema), []),
	/** One or two dimensions, one row per value (or pair of values). */
	rows: v.pipe(v.array(key), v.minLength(1), v.maxLength(2)),
	/** A dimension whose values become the columns: a pivot table with one measure. */
	columns: v.optional(key),
	measures: v.pipe(v.array(key), v.minLength(1), v.maxLength(3)),
	/** Pivot tables only: the total column of each row, the total row, both or none. */
	totals: v.optional(v.picklist(PIVOT_TOTALS), "both"),
	/** `measure`: the biggest first (top lists); `dimension`: in the order of the rows. */
	sort: v.optional(v.picklist(["dimension", "measure"]), "dimension"),
	/** At most this many rows (top lists). */
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500))),
	chart: v.optional(v.nullable(v.picklist(["bar", "line", "doughnut"])), null),
});
export type ReportQuery = v.InferOutput<typeof querySchema>;
