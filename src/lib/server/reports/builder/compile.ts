// SPDX-License-Identifier: GPL-3.0-or-later
// A guided report compiled into the parts of an SQL report (PLAN.md step 9.20, ADR-033): the
// statement made of the catalogue's fragments, the columns with their labels, the parameters of
// the filters asked at run time, the pivot of a column dimension and the chart. Fixed filter values
// are checked against strict shapes before they become literals.
import { SOURCES, type Dimension, type Filter, type Measure, type Words } from "./catalogue.js";
import type { PivotTotals, ReportQuery } from "./spec.js";

export class QueryCompileError extends Error {
	constructor(readonly problems: string[]) {
		super(problems.join("; "));
		this.name = "QueryCompileError";
	}
}

/** The hidden column that orders the values of a column dimension. */
export const COLUMN_ORDER_KEY = "_corder";

export interface CompiledParam {
	name: string;
	label: Words;
	type: "date" | "patronType" | "level" | "stage" | "itemType" | "group" | "select";
	required: boolean;
	default?: string | number;
	options?: { value: string; label: Words }[];
}

export interface CompiledColumn {
	key: string;
	label: Words;
	type: string;
	hidden?: boolean;
}

export interface CompiledReport {
	sql: string;
	columns: CompiledColumn[];
	params: CompiledParam[];
	pivot?: {
		rows: string[];
		columns: string;
		value: string;
		columnOrder: string;
		totals: PivotTotals;
	};
	chart?: { type: "bar" | "line" | "doughnut"; x: string[]; y: string[] };
}

const PERIOD = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;
const CODE = /^[A-Za-z0-9_-]{1,40}$/;

const literal = (value: string): string => `'${value}'`;

/** The condition of one filter, and the parameters it adds when asked. */
function filterSql(
	filter: Filter,
	value: string | number | undefined,
	ask: boolean,
	problems: string[],
): { condition: string | null; params: CompiledParam[] } {
	const def = filter.def;
	if (def.kind === "period") {
		const fixed = value === undefined ? null : PERIOD.exec(String(value));
		if (value !== undefined && !fixed) {
			problems.push(`filters.${filter.key}: a period is YYYY-MM-DD..YYYY-MM-DD`);
			return { condition: null, params: [] };
		}
		if (ask || !fixed) {
			return {
				condition: `${def.column} BETWEEN :from AND :to`,
				params: [
					{
						name: "from",
						label: { it: "Dal", en: "From" },
						type: "date",
						required: true,
						default: fixed?.[1] ?? "schoolYearStart",
					},
					{
						name: "to",
						label: { it: "Al", en: "To" },
						type: "date",
						required: true,
						default: fixed?.[2] ?? "today",
					},
				],
			};
		}
		return {
			condition: `${def.column} BETWEEN ${literal(fixed[1] ?? "")} AND ${literal(fixed[2] ?? "")}`,
			params: [],
		};
	}
	const name = filter.key;
	if (value !== undefined) {
		const ok =
			def.kind === "group"
				? Number.isInteger(Number(value)) && Number(value) > 0
				: def.kind === "choice"
					? def.options.some((o) => o.value === String(value))
					: CODE.test(String(value));
		if (!ok) {
			problems.push(`filters.${filter.key}: invalid value "${String(value)}"`);
			return { condition: null, params: [] };
		}
	}
	const fixedRef =
		value === undefined
			? null
			: def.kind === "group"
				? String(Number(value))
				: literal(String(value));
	if (!ask && fixedRef === null) {
		problems.push(`filters.${filter.key}: a fixed filter needs a value`);
		return { condition: null, params: [] };
	}
	const ref = ask ? `:${name}` : (fixedRef ?? "");
	const test =
		def.kind === "choice" ? def.condition.replaceAll(":value", ref) : `${def.column} = ${ref}`;
	if (!ask) {
		return { condition: test, params: [] };
	}
	const param: CompiledParam = {
		name,
		label: filter.label,
		type: def.kind === "group" ? "group" : def.kind === "choice" ? "select" : def.param,
		required: false,
		...(value === undefined ? {} : { default: value }),
		...(def.kind === "choice" ? { options: def.options } : {}),
	};
	return { condition: `(:${name} IS NULL OR ${test})`, params: [param] };
}

/**
 * Compiles a guided report. Every name must exist in the catalogue of its source; a column
 * dimension makes a pivot table and allows one measure.
 */
export function compileQuery(query: ReportQuery): CompiledReport {
	const source = SOURCES[query.source];
	const problems: string[] = [];
	const dimension = (key: string, where: string): Dimension | null => {
		const d = source.dimensions.find((x) => x.key === key);
		if (!d) {
			problems.push(`${where}: unknown dimension "${key}" for ${query.source}`);
		}
		return d ?? null;
	};
	const rows = query.rows.map((k, i) => dimension(k, `rows[${i}]`));
	const column = query.columns === undefined ? null : dimension(query.columns, "columns");
	const measures = query.measures.map((k, i): Measure | null => {
		const m = source.measures.find((x) => x.key === k);
		if (!m) {
			problems.push(`measures[${i}]: unknown measure "${k}" for ${query.source}`);
		}
		return m ?? null;
	});
	const used = [...query.rows, ...(query.columns === undefined ? [] : [query.columns])];
	if (
		new Set(used).size !== used.length ||
		new Set(query.measures).size !== query.measures.length
	) {
		problems.push("a dimension or a measure is used twice");
	}
	if (column && query.measures.length !== 1) {
		problems.push("a pivot table (columns) has exactly one measure");
	}
	const conditions = [...source.where];
	const params: CompiledParam[] = [];
	const seenFilters = new Set<string>();
	for (const [i, f] of query.filters.entries()) {
		const filter = source.filters.find((x) => x.key === f.field);
		if (!filter) {
			problems.push(`filters[${i}]: unknown filter "${f.field}" for ${query.source}`);
			continue;
		}
		if (seenFilters.has(f.field)) {
			problems.push(`filters[${i}]: "${f.field}" twice`);
			continue;
		}
		seenFilters.add(f.field);
		const out = filterSql(filter, f.value, f.ask, problems);
		if (out.condition) {
			conditions.push(out.condition);
		}
		params.push(...out.params);
	}
	if (problems.length > 0) {
		throw new QueryCompileError(problems);
	}
	const rowDims = rows as Dimension[];
	const ms = measures as Measure[];
	const select = [
		...rowDims.map((d) => `${d.expr} AS ${d.key}`),
		...(column
			? [
					`${column.expr} AS ${column.key}`,
					`MIN(${column.order ?? column.expr}) AS ${COLUMN_ORDER_KEY}`,
				]
			: []),
		...ms.map((m) => `${m.expr} AS ${m.key}`),
	];
	const groupBy = [...rowDims, ...(column ? [column] : [])].map((d) => d.expr);
	const orderBy = [
		...(query.sort === "measure" && !column ? [`${ms[0]?.key ?? "1"} DESC`] : []),
		...rowDims.flatMap((d) => (d.order ? [`MIN(${d.order})`, d.expr] : [d.expr])),
		...(column ? [`MIN(${column.order ?? column.expr})`] : []),
	];
	const sql = [
		`SELECT ${select.join(", ")}`,
		`FROM ${source.from}`,
		conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
		`GROUP BY ${groupBy.join(", ")}`,
		`ORDER BY ${orderBy.join(", ")}`,
		query.limit !== undefined && !column ? `LIMIT ${query.limit}` : "",
	]
		.filter(Boolean)
		.join(" ");
	const columns: CompiledColumn[] = [
		...rowDims.map((d) => ({ key: d.key, label: d.label, type: d.type })),
		...(column
			? [
					{ key: column.key, label: column.label, type: column.type },
					{
						key: COLUMN_ORDER_KEY,
						label: { it: "Ordine", en: "Order" },
						type: "int",
						hidden: true,
					},
				]
			: []),
		...ms.map((m) => ({ key: m.key, label: m.label, type: m.type })),
	];
	const rowKeys = rowDims.map((d) => d.key);
	return {
		sql,
		columns,
		params,
		...(column
			? {
					pivot: {
						rows: rowKeys,
						columns: column.key,
						value: ms[0]?.key ?? "",
						columnOrder: COLUMN_ORDER_KEY,
						totals: query.totals,
					},
				}
			: {}),
		...(query.chart
			? { chart: { type: query.chart, x: rowKeys, y: ms.map((m) => m.key) } }
			: {}),
	};
}
