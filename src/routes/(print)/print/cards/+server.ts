// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/cards?ids=1,2|group=3|level=2|missingCard=1|type=teacher[&template=<name>][&layout=…]`:
// the A4 sheets of the cards, front and back side by side (one page every `cards.sheet.rows` units)
// or on the two sides of the sheet (`layout=duplex`, 9.27: a page of fronts, a page of backs);
// without `layout`, `cards.layout`.
// `list=<id>` prints a print list of patrons in its own order (step 2.8). The cards of each
// template are printed on sheets of their own size; the audit row names the templates used.
// Permission `patrons`. Printing marks nothing:
// "Segna come stampate" is an explicit action of the patron page / print list. `sample=1` renders
// a page of the made-up sample patron and `preview=1` skips the audit row (template page, 2.5b).
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { levelCode, textId } from "#lib/shared/input-schemas.js";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { serverContext } from "#lib/server/context.js";
import { htmlResponse, printSelection, rethrowPrintError } from "#lib/server/print/route.js";
import { audit } from "#lib/server/services/audit.js";
import { type CardSelection, renderCardsSheet } from "#lib/server/services/cards.js";
import { sampleSheetHtml } from "#lib/server/services/card-preview.js";
import { CARD_LAYOUTS } from "#lib/shared/card-layout.js";
import { requestLocale } from "#lib/i18n/server.js";
import { printWordSource } from "#lib/server/i18n/print-word-source.js";

const querySchema = v.object({
	ids: v.optional(v.pipe(v.string(), v.regex(/^\d+(,\d+)*$/))),
	/** A class (group id, Phase 12) or every pupil of a level. */
	group: v.optional(v.pipe(v.string(), v.regex(/^\d{1,9}$/))),
	level: v.optional(levelCode),
	type: v.optional(v.picklist(["student", "teacher"])),
	missingCard: v.optional(v.picklist(["1"])),
	template: v.optional(v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9_-]*$/i))),
	list: v.optional(textId),
	sample: v.optional(v.picklist(["1"])),
	preview: v.optional(v.picklist(["1"])),
	layout: v.optional(v.picklist(CARD_LAYOUTS)),
});

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requirePermission(locals, "patrons");
	const parsed = v.safeParse(querySchema, Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		error(400, "invalid print parameters");
	}
	const q = parsed.output;
	const ctx = serverContext();
	const { db, config } = ctx;
	if (q.sample === "1") {
		try {
			const name = q.template ?? config.cards.defaultTemplate;
			return htmlResponse(
				sampleSheetHtml(config, ctx.configDir, name, "Tessere", {
					words: await printWordSource(requestLocale()),
					layout: q.layout,
				}),
			);
		} catch (e) {
			rethrowPrintError(e);
		}
	}
	const { ids, orderedIds } = printSelection(db, q, "patrons");
	const selection: CardSelection = {
		ids,
		groupId: q.group === undefined ? undefined : Number(q.group),
		levelCode: q.level || undefined,
		patronType: q.type,
		missingCard: q.missingCard === "1",
	};
	try {
		const job = await renderCardsSheet(ctx, selection, {
			templateName: q.template,
			orderedIds,
			layout: q.layout,
			words: await printWordSource(requestLocale()),
		});
		if (q.preview !== "1") {
			audit(db, user, "print.cards", "patron", null, {
				count: job.count,
				skipped: job.skipped.length,
				templates: job.templates,
				layout: q.layout ?? config.cards.layout,
				list: q.list ? Number(q.list) : undefined,
			});
		}
		return htmlResponse(job.html, {
			"X-Cards-Count": String(job.count),
			"X-Cards-Skipped": job.skipped.join(","),
		});
	} catch (e) {
		rethrowPrintError(e);
	}
};
