// SPDX-License-Identifier: GPL-3.0-or-later
// Export of a report run (steps 6.1–6.2, 9.20): `/export/report?id=<report>&<params>` re-runs the
// report with the same parameters on the read-only connection and writes CSV or ODS — the same
// table as the page, pivot and totals included.
import { requestLocale } from "#lib/i18n/server.js";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { can } from "#lib/server/auth/rbac.js";
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { reportConnection } from "#lib/server/reports/connection.js";
import { reportContext, reportDecorations } from "#lib/server/reports/context.js";
import type { ReportColumn } from "#lib/server/reports/definition.js";
import { executeReport, type ExecutedReport } from "#lib/server/reports/execute.js";
import { loadReports } from "#lib/server/reports/loader.js";
import { ReportParamError } from "#lib/server/reports/run.js";
import { registerExport } from "../registry.js";
import type { ExportColumn } from "../types.js";

const TYPE: Record<ReportColumn["type"], ExportColumn["type"]> = {
	int: "number",
	number: "number",
	percent: "number",
	text: "string",
	date: "date",
	datetime: "datetime",
	classification: "string",
	patronType: "string",
	itemType: "string",
	itemStatus: "string",
	weekday: "string",
	boolean: "string",
	level: "string",
	stage: "string",
	kind: "string",
	month: "string",
	decade: "string",
};

export const reportExportSchema = v.pipe(
	v.record(v.pipe(v.string(), v.maxLength(40)), v.pipe(v.string(), v.maxLength(200))),
	v.check((r) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(r.id ?? ""), "report id expected"),
);

export function registerReportExport(): void {
	registerExport("report", {
		permission: "reports",
		schema: reportExportSchema,
		async build(_db, params, user, timezone) {
			const report = loadReports(env().CONFIG_DIR).reports.find((r) => r.id === params.id);
			if (!report || (report.restricted && !can(user, "admin"))) {
				error(404, "report not found");
			}
			const config = getConfig();
			let run: ExecutedReport;
			try {
				run = executeReport(
					reportConnection(),
					report,
					params,
					reportContext(config),
					await reportDecorations(config, requestLocale()),
				);
			} catch (e) {
				if (e instanceof ReportParamError) {
					error(400, `invalid parameter ${e.param}`);
				}
				throw e;
			}
			return {
				name: report.id,
				timezone,
				columns: run.columns.map((c) => ({
					id: c.key,
					label: c.label,
					type: TYPE[c.type],
				})),
				rows: run.rows,
			};
		},
	});
}
