// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/labels/{pair|barcode|spine}?ids=1,2|biblios=3,4|list=<id>|pending=1|from=&to=` with
// `stock=`, `start=` (1-based first unit on the first page, to skip used labels), `template=`:
// the A4 sheets of label units on the stock grid (step 3.8); `list` is a print list of copies.
// `sample=1` renders a page of made-up copies (template page), `preview=1` skips the audit row.
// Permission `catalog`. Printing marks nothing: "Segna come stampate" is an explicit action of
// the print list, the record page and the print dialog.
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { entryId, isoDay, textId } from "#lib/shared/input-schemas.js";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { serverContext } from "#lib/server/context.js";
import { htmlResponse, printSelection, rethrowPrintError } from "#lib/server/print/route.js";
import { audit } from "#lib/server/services/audit.js";
import type { LabelSelection } from "#lib/server/services/label-items.js";
import { LABEL_KINDS } from "#lib/server/services/label-templates.js";
import { renderLabelsSheet, sampleLabelsSheet } from "#lib/server/services/labels.js";

const idList = v.pipe(v.string(), v.regex(/^\d+(,\d+)*$/));
const templateName = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9_-]*$/i));

const querySchema = v.object({
	ids: v.optional(idList),
	biblios: v.optional(idList),
	list: v.optional(textId),
	pending: v.optional(v.picklist(["1"])),
	from: v.optional(isoDay),
	to: v.optional(isoDay),
	stock: v.optional(entryId),
	start: v.optional(v.pipe(v.string(), v.regex(/^\d{1,3}$/))),
	template: v.optional(templateName),
	sample: v.optional(v.picklist(["1"])),
	preview: v.optional(v.picklist(["1"])),
});

export const GET: RequestHandler = async ({ locals, url, params }) => {
	const user = requirePermission(locals, "catalog");
	const kind = v.safeParse(v.picklist(LABEL_KINDS), params.kind);
	const parsed = v.safeParse(querySchema, Object.fromEntries(url.searchParams));
	if (!kind.success || !parsed.success) {
		error(400, "invalid print parameters");
	}
	const q = parsed.output;
	const options = {
		templateName: q.template,
		stockId: q.stock,
		start: q.start === undefined ? undefined : Number(q.start),
	};
	const ctx = serverContext();
	const { db } = ctx;
	try {
		if (q.sample === "1") {
			const job = sampleLabelsSheet(ctx.config, ctx.configDir, kind.output, options);
			return htmlResponse(job.html, { "X-Labels-Count": String(job.count) });
		}
		const selection: LabelSelection = {
			ids: printSelection(db, q, "items").ids,
			biblioIds: q.biblios?.split(",").map(Number),
			pending: q.pending === "1" ? kind.output : undefined,
			from: q.from,
			to: q.to,
		};
		const job = await renderLabelsSheet(ctx, kind.output, selection, options);
		if (q.preview !== "1") {
			audit(db, user, "print.labels", "item", null, {
				kind: kind.output,
				count: job.count,
				pages: job.pages,
				template: job.template,
				stock: job.stock,
				list: q.list ? Number(q.list) : undefined,
			});
		}
		return htmlResponse(job.html, {
			"X-Labels-Count": String(job.count),
			"X-Labels-Pages": String(job.pages),
		});
	} catch (e) {
		rethrowPrintError(e);
	}
};
