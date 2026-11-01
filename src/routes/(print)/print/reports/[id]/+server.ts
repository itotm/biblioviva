// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/reports/<id>?<params>`: the print view of a report (step 6.2): title, parameters, print
// date and the bordered table of the rows, A4 landscape. Permission `reports` (restricted reports:
// `admin`).
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { can } from "#lib/server/auth/rbac.js";
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { htmlResponse } from "#lib/server/print/route.js";
import { escapeHtml, printDocument } from "#lib/server/templates/document.js";
import { reportConnection } from "#lib/server/reports/connection.js";
import { reportContext, reportDecorations } from "#lib/server/reports/context.js";
import { localize } from "#lib/server/reports/definition.js";
import { executeReport, type ExecutedReport } from "#lib/server/reports/execute.js";
import { loadReports } from "#lib/server/reports/loader.js";
import { ReportParamError } from "#lib/server/reports/run.js";
import { formatDateTime } from "#lib/shared/dates.js";

/** A text or number of the report, escaped; anything else prints nothing. */
const esc = (value: unknown): string =>
	typeof value === "string" || typeof value === "number" ? escapeHtml(value) : "";

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requirePermission(locals, "reports");
	const report = loadReports(env().CONFIG_DIR).reports.find((r) => r.id === params.id);
	if (!report || (report.restricted && !can(user, "admin"))) {
		error(404, "report not found");
	}
	const config = getConfig();
	const locale = requestLocale();
	const raw = Object.fromEntries(url.searchParams);
	let run: ExecutedReport;
	try {
		run = executeReport(
			reportConnection(),
			report,
			raw,
			reportContext(config),
			await reportDecorations(config, locale),
		);
	} catch (e) {
		if (e instanceof ReportParamError) {
			error(400, `invalid parameter ${e.param}`);
		}
		throw e;
	}
	const { rows, columns } = run;
	const resolved = { shown: run.shown };
	const numeric = new Set(["int", "number", "percent"]);
	const paramLine = report.params
		.map((p) => {
			const values =
				p.type === "dateRange"
					? [resolved.shown[`${p.name}From`], resolved.shown[`${p.name}To`]]
					: [resolved.shown[p.name]];
			const text = values.filter(Boolean).join(" – ");
			return text ? `${esc(localize(p.label, locale))}: <strong>${esc(text)}</strong>` : "";
		})
		.filter(Boolean)
		.join(" · ");
	const printed = await tServer(locale, "reports.printedOn", {
		date: formatDateTime(new Date().toISOString(), locale, config.library.timezone),
	});
	const head = columns
		.map((c) => `<th${numeric.has(c.type) ? ' class="n"' : ""}>${esc(c.label)}</th>`)
		.join("");
	const body = rows
		.map(
			(r, i) =>
				`<tr${run.totalRow && i === rows.length - 1 ? ' class="total"' : ""}>${columns
					.map(
						(c) =>
							`<td${numeric.has(c.type) ? ' class="n"' : ""}>${esc(r[c.key])}</td>`,
					)
					.join("")}</tr>`,
		)
		.join("\n");
	const title = localize(report.title, locale);
	const html = printDocument({
		title,
		lang: locale,
		styles: [
			`
@page { size: A4 landscape; margin: 12mm; }
body { margin: 0; font-family: Arial, Helvetica, "Liberation Sans", sans-serif; font-size: 9.5pt; color: #000; }
h1 { font-size: 14pt; margin: 0 0 2mm; }
p { margin: 0 0 1.5mm; }
.meta { color: #333; margin-bottom: 4mm; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 0.25mm solid #000; padding: 1.2mm 1.8mm; text-align: left; vertical-align: top; }
th { background: #eee; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.n { text-align: right; white-space: nowrap; }
thead { display: table-header-group; }
tr.total td { font-weight: 700; }
tr { break-inside: avoid; }
@media screen { body { padding: 10mm; } }
`,
		],
		body: `
<h1>${esc(title)}</h1>
<p class="meta">${esc(config.library.name)} · ${esc(printed)}${paramLine ? `<br>${paramLine}` : ""}</p>
<table><thead><tr>${head}</tr></thead><tbody>
${body}
</tbody></table>
`,
	});
	return htmlResponse(html);
};
