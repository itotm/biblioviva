// SPDX-License-Identifier: GPL-3.0-or-later
// Reports (PLAN.md §3.11, steps 6.1–6.2): the library of definitions, one definition ready for its
// form (texts in the installation's language, choices from the configuration) and a run with the
// parameters typed in the form. Permission `reports`; `restricted` reports need `admin`.
import { requestLocale } from "#lib/i18n/server.js";
import { classOptions } from "#lib/server/services/patron-census.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { query } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { requireUser } from "#lib/server/auth/guard.js";
import { can } from "#lib/server/auth/rbac.js";
import type { AuthUser } from "#lib/server/auth/types.js";
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { refusing } from "#lib/server/http/errors.js";
import { reportConnection } from "#lib/server/reports/connection.js";
import { reportContext, reportDecorations } from "#lib/server/reports/context.js";
import { localize } from "#lib/server/reports/definition.js";
import { executeReport } from "#lib/server/reports/execute.js";
import { loadReports, type LoadedReport } from "#lib/server/reports/loader.js";
import { ReportParamError } from "#lib/server/reports/run.js";
import { getDb } from "#lib/server/db/index.js";

const reportId = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{0,63}$/));

function visible(report: LoadedReport, user: AuthUser): boolean {
	return !report.restricted || can(user, "admin");
}

function findReport(id: string, user: AuthUser): LoadedReport {
	const report = loadReports(env().CONFIG_DIR).reports.find((r) => r.id === id);
	if (!report || !visible(report, user)) {
		error(404, "report not found");
	}
	return report;
}

export const listReports = query(() => {
	const user = requireUser("reports");
	const locale = requestLocale();
	const library = loadReports(env().CONFIG_DIR);
	return {
		reports: library.reports
			.filter((r) => visible(r, user))
			.map((r) => ({
				id: r.id,
				title: localize(r.title, locale),
				description: r.description ? localize(r.description, locale) : "",
				category: r.category,
				restricted: r.restricted,
				source: r.source,
				chart: r.chart?.type ?? null,
				guided: r.query !== undefined,
			})),
		// broken files are the administrator's business
		problems: can(user, "admin") ? library.problems : [],
	};
});

/** One definition for its page: localized texts and the choices of each parameter. */
export const getReport = query(reportId, (id) => {
	const user = requireUser("reports");
	const report = findReport(id, user);
	const locale = requestLocale();
	const config = getConfig();
	return {
		id: report.id,
		title: localize(report.title, locale),
		description: report.description ? localize(report.description, locale) : "",
		category: report.category,
		params: report.params.map((p) => ({
			name: p.name,
			label: localize(p.label, locale),
			type: p.type,
			required: p.required,
			default: p.default === undefined ? "" : String(p.default),
			min: p.min,
			max: p.max,
			options:
				p.type === "select"
					? (p.options ?? []).map((o) => ({
							value: String(o.value),
							label: localize(o.label, locale),
						}))
					: p.type === "level"
						? config.school.levels.map((l) => ({ value: l.code, label: l.name }))
						: p.type === "stage"
							? config.school.stages.map((s) => ({ value: s.code, label: s.name }))
							: p.type === "group"
								? classOptions(getDb(), schoolOf(config)).groups.map((g) => ({
										value: String(g.id),
										label: g.label,
									}))
								: p.type === "itemType"
									? config.library.itemTypes.map((t) => ({
											value: t.code,
											label: t.label,
										}))
									: [],
		})),
		chart: report.chart?.type ?? null,
		pivot: report.pivot !== undefined,
		defaultSort: report.defaultSort ?? null,
		rowLimit: report.rowLimit,
	};
});

export const runReportQuery = query(
	v.object({
		id: reportId,
		params: v.record(v.pipe(v.string(), v.maxLength(40)), v.pipe(v.string(), v.maxLength(200))),
	}),
	async ({ id, params }) => {
		const user = requireUser("reports");
		const report = findReport(id, user);
		const config = getConfig();
		return refusing(
			async () => {
				const decorations = await reportDecorations(config, requestLocale());
				return {
					ok: true as const,
					...executeReport(
						reportConnection(),
						report,
						params,
						reportContext(config),
						decorations,
					),
				};
			},
			ReportParamError,
			(e) => ({ ok: false as const, param: e.param, code: e.code }),
		);
	},
);
