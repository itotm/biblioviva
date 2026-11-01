// SPDX-License-Identifier: GPL-3.0-or-later
// One run of a report for every view (PLAN.md §3.11, step 9.20): the parameters resolved, the
// statement run on the read-only connection, the codes turned into words, a pivot built from the
// long rows (columns from the values found, missing cells 0, totals), the visible columns with
// their labels in the installation's language and the chart. The page, the print view and the
// CSV/ODS export all read this, so they show the same table.
import { collatorFor } from "#lib/shared/collation.js";
import type { Database } from "bun:sqlite";
import {
	localize,
	type ReportColumn,
	type ReportDefinition,
	type ReportPivot,
} from "./definition.js";
import { decorateRows, type Decorations } from "./decorate.js";
import { resolveParams, runReport, type ReportContext } from "./run.js";

export interface ShownColumn {
	key: string;
	label: string;
	type: ReportColumn["type"];
}

export interface ReportChartData {
	type: "bar" | "line" | "doughnut";
	labels: string[];
	series: { label: string; data: number[] }[];
	/** A pivot's columns are stacked bars. */
	stacked: boolean;
}

export interface ExecutedReport {
	columns: ShownColumn[];
	rows: Record<string, unknown>[];
	/** The values the report ran with, as the form shows them. */
	shown: Record<string, string>;
	truncated: boolean;
	ms: number;
	chart: ReportChartData | null;
	/** A pivot table ends with a total row (left out of the chart, kept last when sorting). */
	totalRow: boolean;
}

const text = (v: unknown): string =>
	typeof v === "string" || typeof v === "number" ? String(v) : "";

/** The pivot of long rows: one row per row-dimension tuple, one column per column value. */
export function pivotRows(
	pivot: ReportPivot,
	columns: readonly ShownColumn[],
	rows: readonly Record<string, unknown>[],
	totalLabel: string,
	/** The installation's language: the order of the column values (9.41). */
	locale = "it",
): { columns: ShownColumn[]; rows: Record<string, unknown>[] } {
	const collator = collatorFor(locale);
	const valueType = columns.find((c) => c.key === pivot.value)?.type ?? "int";
	// the values of the column dimension, in their order; empty values count in the totals only
	const order = new Map<string, number>();
	for (const [i, row] of rows.entries()) {
		const value = row[pivot.columns];
		if (value === null || value === undefined || value === "") {
			continue;
		}
		const key = text(value);
		const rank = pivot.columnOrder ? Number(row[pivot.columnOrder] ?? i) : i;
		order.set(key, Math.min(order.get(key) ?? Infinity, rank));
	}
	const values = [...order.keys()].sort(
		(a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || collator.compare(a, b),
	);
	const cellKey = new Map(values.map((v, i) => [v, `c${i}`]));
	const rowTotals = pivot.totals === "rows" || pivot.totals === "both";
	const columnTotals = pivot.totals === "columns" || pivot.totals === "both";
	const rowColumns = pivot.rows.map(
		(k): ShownColumn => columns.find((c) => c.key === k) ?? { key: k, label: k, type: "text" },
	);
	const outColumns: ShownColumn[] = [
		...rowColumns,
		...values.map((v): ShownColumn => ({
			key: cellKey.get(v) ?? "",
			label: v,
			type: valueType,
		})),
		...(rowTotals ? [{ key: "_total", label: totalLabel, type: valueType }] : []),
	];
	const byRow = new Map<string, Record<string, unknown>>();
	const sums = new Map<string, number>();
	let grand = 0;
	for (const row of rows) {
		const id = JSON.stringify(pivot.rows.map((k) => row[k] ?? null));
		let out = byRow.get(id);
		if (!out) {
			out = Object.fromEntries(pivot.rows.map((k) => [k, row[k] ?? null]));
			for (const key of cellKey.values()) {
				out[key] = 0;
			}
			out._total = 0;
			byRow.set(id, out);
		}
		const amount = Number(row[pivot.value] ?? 0);
		const key = cellKey.get(text(row[pivot.columns]));
		if (key) {
			out[key] = Number(out[key] ?? 0) + amount;
			sums.set(key, (sums.get(key) ?? 0) + amount);
		}
		out._total = Number(out._total ?? 0) + amount;
		grand += amount;
	}
	const outRows = [...byRow.values()].map((r) => {
		if (!rowTotals) {
			delete r._total;
		}
		return r;
	});
	if (columnTotals) {
		const total: Record<string, unknown> = Object.fromEntries(
			pivot.rows.map((k, i) => [k, i === 0 ? totalLabel : ""]),
		);
		for (const key of cellKey.values()) {
			total[key] = sums.get(key) ?? 0;
		}
		if (rowTotals) {
			total._total = grand;
		}
		outRows.push(total);
	}
	return { columns: outColumns, rows: outRows };
}

/**
 * Runs a report with the raw parameters of the form (or the URL). Throws `ReportParamError` for
 * a missing or invalid parameter.
 */
export function executeReport(
	conn: Database,
	report: ReportDefinition,
	raw: Readonly<Record<string, string | undefined>>,
	ctx: ReportContext,
	decorations: Decorations,
	options: { rowLimit?: number } = {},
): ExecutedReport {
	const { values, shown } = resolveParams(report, raw, ctx);
	const limited = options.rowLimit
		? { ...report, rowLimit: Math.min(report.rowLimit, options.rowLimit) }
		: report;
	const result = runReport(conn, limited, values);
	const locale = decorations.locale;
	const declared: ShownColumn[] = report.columns.map((c) => ({
		key: c.key,
		label: localize(c.label, locale),
		type: c.type,
	}));
	const decorated = decorateRows(report.columns, result.rows, decorations);
	const hidden = new Set(report.columns.filter((c) => c.hidden).map((c) => c.key));
	let columns = declared.filter((c) => !hidden.has(c.key));
	let rows = decorated;
	let totalRow = false;
	if (report.pivot) {
		const pivoted = pivotRows(report.pivot, declared, decorated, decorations.total, locale);
		columns = pivoted.columns;
		rows = pivoted.rows;
		totalRow = report.pivot.totals === "columns" || report.pivot.totals === "both";
	}
	return {
		columns,
		rows,
		shown,
		truncated: result.truncated,
		ms: result.ms,
		chart: chartOf(report, columns, rows, totalRow),
		totalRow,
	};
}

function chartOf(
	report: ReportDefinition,
	columns: readonly ShownColumn[],
	rows: readonly Record<string, unknown>[],
	totalRow: boolean,
): ReportChartData | null {
	const def = report.chart;
	if (!def || rows.length === 0) {
		return null;
	}
	const points = totalRow ? rows.slice(0, -1) : rows;
	const xs = [def.x].flat();
	const labels = points.map((row) => xs.map((x) => text(row[x])).join(" "));
	if (report.pivot) {
		const series = columns
			.filter((c) => /^c\d+$/.test(c.key))
			.map((c) => ({ label: c.label, data: points.map((row) => Number(row[c.key] ?? 0)) }));
		return { type: def.type, labels, series, stacked: def.type === "bar" };
	}
	const series = [def.y].flat().map((y) => ({
		label: columns.find((c) => c.key === y)?.label ?? y,
		data: points.map((row) => Number(row[y] ?? 0)),
	}));
	return { type: def.type, labels, series, stacked: false };
}
