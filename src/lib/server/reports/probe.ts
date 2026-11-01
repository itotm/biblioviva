// SPDX-License-Identifier: GPL-3.0-or-later
// A report tried before it is saved (steps 11.9, 9.20): compiled and run on the read-only
// connection with every parameter at its default — or a sample value when it has none, so a
// required parameter does not hide the statement — reading the rows a real run reads. An error of
// SQLite (an unknown table or column, a function given the wrong data…) is thrown with its message.
import type { Database } from "bun:sqlite";
import { boundNames, type ReportDefinition, type ReportParam } from "./definition.js";
import { resolveParams, runReport, type ReportContext } from "./run.js";

/** A value of the parameter's type when it has no default (never shown, only bound). */
function sample(param: ReportParam, ctx: ReportContext): string {
	switch (param.type) {
		case "date":
		case "dateRange":
			return ctx.today;
		case "int":
			return String(param.min ?? 1);
		case "group":
			return "1";
		case "text":
			return "x";
		case "select":
			return String(param.options?.[0]?.value ?? "");
		case "level":
			return ctx.levels[0] ?? "";
		case "stage":
			return ctx.stages[0] ?? "";
		case "patronType":
			return "student";
		case "itemType":
			return ctx.itemTypes[0] ?? "";
	}
}

/** The form values of a trial run: a sample for every required parameter without a default. */
export function probeParams(report: ReportDefinition, ctx: ReportContext): Record<string, string> {
	const raw: Record<string, string> = {};
	for (const param of report.params) {
		if (param.default === undefined && param.required) {
			for (const name of boundNames(param)) {
				raw[name] = sample(param, ctx);
			}
		}
	}
	return raw;
}

/** Compiles and runs the report; throws when SQLite refuses it. */
export function tryReport(conn: Database, report: ReportDefinition, ctx: ReportContext): void {
	conn.prepare(report.sql);
	const { values } = resolveParams(report, probeParams(report, ctx), ctx);
	runReport(conn, report, values);
}
