// SPDX-License-Identifier: GPL-3.0-or-later
// The reports library in the Configurazione area (steps 11.9, 9.20): the definitions with their
// origin and the files that do not load, a definition uploaded as JSON (checked and compiled
// first), a file of the configuration removed; the editor: a definition as a draft, the catalogue
// of the guided form with the choices of this library, a draft previewed (200 rows) and saved.
// Permission `admin`.
import { assertNotDemo } from "#lib/server/demo/public.js";
import { command, form, query } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { uploadedFile } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { refusal, refusedWithCode, refusing } from "#lib/server/http/errors.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { getConfig } from "#lib/server/config/index.js";
import { schoolOf } from "#lib/server/school/structure.js";
import { classOptions } from "#lib/server/services/patron-census.js";
import { SOURCES } from "#lib/server/reports/builder/catalogue.js";
import { QUERY_SOURCES } from "#lib/server/reports/builder/spec.js";
import { reportConnection } from "#lib/server/reports/connection.js";
import { reportContext, reportDecorations } from "#lib/server/reports/context.js";
import { localize, type ReportDefinition } from "#lib/server/reports/definition.js";
import { executeReport } from "#lib/server/reports/execute.js";
import { parseReport } from "#lib/server/reports/loader.js";
import { probeParams, tryReport } from "#lib/server/reports/probe.js";
import { ReportParamError } from "#lib/server/reports/run.js";
import {
	installReport,
	reportDraft,
	saveReportDraft,
	MAX_REPORT_BYTES,
	removeReportFile,
	reportLibraryView,
	ReportLibraryError,
} from "#lib/server/services/report-library.js";
import { getConfigHistory, getConfigOverview } from "./config.remote.js";

/** A report compiled and run with its defaults before it is saved: SQLite's refusals stop it. */
function check(report: ReportDefinition): void {
	tryReport(reportConnection(), report, reportContext(getConfig()));
}

function refreshAll(): void {
	void getReportLibrary().refresh();
	void getConfigOverview().refresh();
	void getConfigHistory().refresh();
}

export const getReportLibrary = query(() => {
	requireUser("admin");
	return reportLibraryView(env().CONFIG_DIR, requestLocale());
});

export const uploadReportDefinition = form(
	v.object({
		definition: uploadedFile,
	}),
	async ({ definition }, issue) => {
		const user = requireUser("admin");
		try {
			const result = installReport(
				getDb(),
				env().CONFIG_DIR,
				new Uint8Array(await definition.arrayBuffer()),
				check,
				user,
			);
			refreshAll();
			return { id: result.id, replaced: result.replaced };
		} catch (e) {
			if (e instanceof ReportLibraryError) {
				invalid(
					issue.definition(
						await tServer(requestLocale(), `config.reports.errors.${e.code}`, {
							details: e.details.slice(0, 8).join("; "),
							maxKb: MAX_REPORT_BYTES / 1024,
						}),
					),
				);
			}
			throw e;
		}
	},
);

export const removeReportDefinition = command(
	v.object({ file: v.pipe(v.string(), v.maxLength(120)) }),
	({ file }) => {
		const user = requireUser("admin");
		return refusing(
			() => {
				const change = removeReportFile(getDb(), env().CONFIG_DIR, file, user);
				refreshAll();
				return { ok: true as const, change: change.id };
			},
			ReportLibraryError,
			refusedWithCode,
		);
	},
);

const reportId = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]{0,63}$/));
/** A draft of the editor: the JSON of a definition, checked by `parseReport` on the server. */
const draftSchema = v.record(v.string(), v.unknown());

/** A definition as a draft for the editor (the file in use: the school's copy first). */
export const getReportDraft = query(reportId, (id) => {
	requireUser("admin");
	return refusing(
		() => ({ ok: true as const, ...reportDraft(env().CONFIG_DIR, id) }),
		ReportLibraryError,
		refusedWithCode,
	);
});

/**
 * The catalogue of the guided form in the installation's language, with the choices of this
 * library for the fixed filters (levels, stages, classes, item types).
 */
export const getReportBuilder = query(() => {
	requireUser("admin");
	const locale = requestLocale();
	const config = getConfig();
	const t = (w: { it: string; en: string }): string => localize(w, locale);
	const choices: Record<string, { value: string; label: string }[]> = {
		level: config.school.levels.map((l) => ({ value: l.code, label: l.name })),
		stage: config.school.stages.map((st) => ({ value: st.code, label: st.name })),
		itemType: config.library.itemTypes.map((it) => ({ value: it.code, label: it.label })),
		group: classOptions(getDb(), schoolOf(config)).groups.map((g) => ({
			value: String(g.id),
			label: g.label,
		})),
	};
	return QUERY_SOURCES.map((key) => {
		const source = SOURCES[key];
		return {
			key,
			label: t(source.label),
			dimensions: source.dimensions.map((d) => ({ key: d.key, label: t(d.label) })),
			measures: source.measures.map((m) => ({ key: m.key, label: t(m.label) })),
			filters: source.filters.map((f) => ({
				key: f.key,
				label: t(f.label),
				kind: f.def.kind === "code" ? f.def.param : f.def.kind,
				options:
					f.def.kind === "choice"
						? f.def.options.map((o) => ({ value: o.value, label: t(o.label) }))
						: f.def.kind === "code" && f.def.param !== "patronType"
							? (choices[f.def.param] ?? [])
							: f.def.kind === "group"
								? (choices.group ?? [])
								: [],
			})),
		};
	});
});

/**
 * Checks a draft and runs it with the defaults of its parameters, a sample for a required one
 * without default (at most 200 rows): the problems, or the table, the chart and its SQL.
 */
export const previewReportDraft = command(draftSchema, async (draft) => {
	requireUser("admin");
	const parsed = parseReport(draft);
	if ("problems" in parsed) {
		return { ok: false as const, problems: parsed.problems };
	}
	const report = parsed.report;
	// a statement written by hand could run for ever: never in the public demo (9.17, Q118)
	if (report.query === undefined) {
		assertNotDemo("sqlReports");
	}
	const config = getConfig();
	const ctx = reportContext(config);
	return refusing(async () => {
		reportConnection().prepare(report.sql);
		const run = executeReport(
			reportConnection(),
			report,
			probeParams(report, ctx),
			ctx,
			await reportDecorations(config, requestLocale()),
			{ rowLimit: 200 },
		);
		return {
			ok: true as const,
			...run,
			compiled: {
				sql: report.sql,
				columns: report.columns,
				params: report.params,
				pivot: report.pivot,
				chart: report.chart,
			},
		};
	}, [
		refusal(ReportParamError, (e) => ({
			ok: false as const,
			problems: [`params.${e.param}: ${e.code}`],
		})),
		// anything else is SQLite refusing the statement
		refusal(Error, (e) => ({ ok: false as const, problems: [`sql: ${e.message}`] })),
	]);
});

/** Saves a draft (same checks as an upload): the customised copy of a built-in, or a new report. */
export const saveReportDefinition = command(draftSchema, (draft) => {
	const user = requireUser("admin");
	return refusing(
		() => {
			const result = saveReportDraft(getDb(), env().CONFIG_DIR, draft, check, user);
			refreshAll();
			void getReportDraft(result.id).refresh();
			return { ok: true as const, id: result.id, replaced: result.replaced };
		},
		ReportLibraryError,
		(e) => ({ ok: false as const, code: e.code, problems: e.details }),
	);
});
