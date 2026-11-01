// SPDX-License-Identifier: GPL-3.0-or-later
// Running a report (PLAN.md §3.11): the parameters typed in the form (all strings, as in the URL)
// are coerced by type and checked against the library's data (classes, sections, item types),
// symbolic date defaults resolved in the library's time zone, bound by name on the read-only
// connection; at most `rowLimit` rows are read, the time is measured and slow runs are logged.
import type { Database } from "bun:sqlite";
import { boundNames, type ReportDefinition, type ReportParam } from "./definition.js";
import { stripSql } from "./safety.js";

/** The `:name` parameters a statement uses. */
function sqlNames(sql: string): string[] {
	return [...stripSql(sql).matchAll(/(?<![:\w]):([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1] ?? "");
}

export interface ReportContext {
	/** Today in the library's zone (`YYYY-MM-DD`). */
	today: string;
	/** First day of the current school year. */
	schoolYearStart: string;
	/** The level and stage codes of the school (Phase 12). */
	levels: readonly string[];
	stages: readonly string[];
	itemTypes: readonly string[];
	/** Every genre and class code of the configuration. */
	classificationCodes: readonly string[];
}

export type ParamValue = string | number | null;

export class ReportParamError extends Error {
	constructor(
		readonly param: string,
		readonly code: "required" | "invalid",
	) {
		super(`report parameter ${param}: ${code}`);
		this.name = "ReportParamError";
	}
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function symbolicDate(value: string, ctx: ReportContext): string {
	switch (value) {
		case "today":
			return ctx.today;
		case "schoolYearStart":
			return ctx.schoolYearStart;
		case "monthStart":
			return `${ctx.today.slice(0, 7)}-01`;
		case "yearStart":
			return `${ctx.today.slice(0, 4)}-01-01`;
		default:
			return value;
	}
}

function coerce(param: ReportParam, name: string, raw: string, ctx: ReportContext): ParamValue {
	const bad = (): never => {
		throw new ReportParamError(name, "invalid");
	};
	switch (param.type) {
		case "date":
		case "dateRange": {
			const date = symbolicDate(raw, ctx);
			return ISO_DATE.test(date) ? date : bad();
		}
		case "int":
		case "group": {
			if (!/^-?\d{1,9}$/.test(raw)) {
				return bad();
			}
			const n = Number(raw);
			if (
				(param.min !== undefined && n < param.min) ||
				(param.max !== undefined && n > param.max) ||
				(param.type === "group" && n < 1)
			) {
				return bad();
			}
			return n;
		}
		case "text":
			return raw.length <= 200 ? raw : bad();
		case "select": {
			const option = param.options?.find((o) => String(o.value) === raw);
			return option ? option.value : bad();
		}
		case "level":
			return ctx.levels.includes(raw) ? raw : bad();
		case "stage":
			return ctx.stages.includes(raw) ? raw : bad();
		case "patronType":
			return raw === "student" || raw === "teacher" ? raw : bad();
		case "itemType":
			return ctx.itemTypes.includes(raw) ? raw : bad();
	}
}

/**
 * The values to bind (by SQL name) and the ones to show back in the form, from the raw strings;
 * an empty value takes the default, a required parameter without one is an error.
 */
export function resolveParams(
	report: ReportDefinition,
	raw: Readonly<Record<string, string | undefined>>,
	ctx: ReportContext,
): { values: Record<string, ParamValue>; shown: Record<string, string> } {
	const values: Record<string, ParamValue> = {
		today: ctx.today,
		schoolYearStart: ctx.schoolYearStart,
		classificationCodes: JSON.stringify(ctx.classificationCodes),
	};
	const shown: Record<string, string> = {};
	for (const param of report.params) {
		for (const name of boundNames(param)) {
			const typed = (raw[name] ?? "").trim();
			const fallback = param.default === undefined ? "" : String(param.default);
			const text = typed || fallback;
			if (!text) {
				if (param.required) {
					throw new ReportParamError(name, "required");
				}
				values[name] = null;
				shown[name] = "";
				continue;
			}
			const value = coerce(param, name, text, ctx);
			values[name] = value;
			shown[name] = value === null ? "" : String(value);
		}
	}
	return { values, shown };
}

/** A run slower than this is logged. */
export const SLOW_MS = 1000;

export interface ReportResult {
	rows: Record<string, unknown>[];
	/** More rows existed than `rowLimit`. */
	truncated: boolean;
	ms: number;
}

/** Runs the statement on the read-only connection, reading at most `rowLimit` rows. */
export function runReport(
	conn: Database,
	report: ReportDefinition,
	values: Record<string, ParamValue>,
): ReportResult {
	const started = performance.now();
	const statement = conn.query<Record<string, unknown>, [Record<string, ParamValue>]>(report.sql);
	// bind only the names the statement uses (SQLite refuses unknown ones in strict mode)
	const used = new Set(statement.paramsCount > 0 ? sqlNames(report.sql) : []);
	const bound = Object.fromEntries(Object.entries(values).filter(([k]) => used.has(k)));
	const rows: Record<string, unknown>[] = [];
	let truncated = false;
	for (const row of statement.iterate(bound)) {
		if (rows.length === report.rowLimit) {
			truncated = true;
			break;
		}
		const out: Record<string, unknown> = {};
		for (const c of report.columns) {
			out[c.key] = row[c.key] ?? null;
		}
		rows.push(out);
	}
	const ms = Math.round(performance.now() - started);
	// the time is returned (the page shows it); slow runs are logged, never the data
	if (ms > SLOW_MS) {
		console.warn(`[report] ${report.id}: ${rows.length} rows in ${ms} ms`);
	}
	return { rows, truncated, ms };
}
