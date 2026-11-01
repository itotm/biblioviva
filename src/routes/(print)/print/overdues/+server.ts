// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/overdues?date=&groups=g12,teacher&pageBreak=0|1&minDays=&template=`: the overdue notices
// (`overdue-by-class`, Appendix H), one block per group in class order, days of delay counted
// from `date` (default today in the library's zone). `patron=<id>` prints one patron's overdue
// loans instead (`overdue-patron`, every overdue loan); `sample=1` renders made-up groups (template
// preview, visual snapshot). Permission `loans`. Printing marks nothing: "Segna solleciti
// stampati" is an explicit action of the overdues page.
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { isoDay, textId } from "#lib/shared/input-schemas.js";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { htmlResponse, rethrowPrintError } from "#lib/server/print/route.js";
import { overdueGroupLabels } from "#lib/server/i18n/overdue-labels.js";
import { audit } from "#lib/server/services/audit.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { openLoanRows } from "#lib/server/services/loan-lists.js";
import { groupOverdues } from "#lib/server/services/overdues.js";
import { requestLocale } from "#lib/i18n/server.js";
import { printWordSource } from "#lib/server/i18n/print-word-source.js";
import {
	renderOverdueNotices,
	renderPatronOverdueSlip,
	sampleOverdueGroups,
	type SlipJob,
} from "#lib/server/services/slips.js";

const querySchema = v.object({
	date: v.optional(isoDay),
	groups: v.optional(
		// group keys of `groupOf`: `g<class id>`, `noclass`, `teacher` (Phase 12)
		v.pipe(v.string(), v.regex(/^(g\d{1,9}|noclass|teacher)(,(g\d{1,9}|noclass|teacher))*$/)),
	),
	pageBreak: v.optional(v.picklist(["0", "1"])),
	minDays: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/))),
	patron: v.optional(textId),
	template: v.optional(v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9_-]*$/i))),
	sample: v.optional(v.picklist(["1"])),
});

const html = (body: string, count: number): Response =>
	htmlResponse(body, { "X-Slip-Count": String(count) });

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requirePermission(locals, "loans");
	const parsed = v.safeParse(querySchema, Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		error(400, "invalid print parameters");
	}
	const q = parsed.output;
	const config = getConfig();
	const today = q.date ?? libraryToday(config);
	const labels = await overdueGroupLabels();
	const words = await printWordSource(requestLocale());
	const configDir = env().CONFIG_DIR;
	let job: SlipJob;
	try {
		if (q.sample === "1") {
			job = renderOverdueNotices(config, configDir, sampleOverdueGroups(labels.teacher), {
				today,
				pageBreak: q.pageBreak === undefined ? undefined : q.pageBreak === "1",
				template: q.template,
				words,
			});
			return html(job.html, job.count);
		}
		const db = getDb();
		if (q.patron) {
			const rows = openLoanRows(db, today, { patronId: Number(q.patron), overdueOnly: true });
			const [group] = groupOverdues(rows, {
				today,
				minDays: 0,
				labels,
				locale: config.ui.locale,
			});
			const first = group?.rows[0];
			if (!group || !first) {
				error(422, "no overdue loans for this patron");
			}
			job = renderPatronOverdueSlip(config, configDir, first, group.rows, {
				today,
				template: q.template,
				words,
			});
		} else {
			const groups = groupOverdues(openLoanRows(db, today, { overdueOnly: true }), {
				today,
				minDays:
					q.minDays === undefined
						? config.circulation.overdueNotice.minDays
						: Number(q.minDays),
				labels,
				locale: config.ui.locale,
				keys: q.groups?.split(","),
			});
			if (groups.length === 0) {
				error(422, "no overdue loans to print");
			}
			job = renderOverdueNotices(config, configDir, groups, {
				today,
				pageBreak: q.pageBreak === undefined ? undefined : q.pageBreak === "1",
				template: q.template,
				words,
			});
		}
	} catch (e) {
		rethrowPrintError(e);
	}
	audit(
		getDb(),
		user,
		"print.overdues",
		q.patron ? "patron" : "loan",
		q.patron ? Number(q.patron) : null,
		{
			count: job.count,
			template: job.template,
		},
	);
	return html(job.html, job.count);
};
