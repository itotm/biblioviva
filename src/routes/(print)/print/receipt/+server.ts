// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/receipt?loans=1,2,3`: the receipt of one checkout (`checkout-receipt`), the books lent in
// the desk session with their due dates. Offered by the checkout desk when `circulation.receipts`
// is on. Permission `loans`.
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { htmlResponse, rethrowPrintError } from "#lib/server/print/route.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { receiptData, ReceiptError } from "#lib/server/services/loan-lists.js";
import { renderReceipt } from "#lib/server/services/slips.js";
import { requestLocale } from "#lib/i18n/server.js";
import { printWordSource } from "#lib/server/i18n/print-word-source.js";

const querySchema = v.object({
	loans: v.pipe(v.string(), v.regex(/^\d+(,\d+){0,99}$/)),
	template: v.optional(v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9_-]*$/i))),
});

export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, "loans");
	const parsed = v.safeParse(querySchema, Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		error(400, "invalid print parameters");
	}
	const config = getConfig();
	try {
		const data = receiptData(getDb(), parsed.output.loans.split(",").map(Number));
		const job = renderReceipt(config, env().CONFIG_DIR, data, {
			today: libraryToday(config),
			template: parsed.output.template,
			words: await printWordSource(requestLocale()),
		});
		return htmlResponse(job.html);
	} catch (e) {
		if (e instanceof ReceiptError) {
			error(404, e.message);
		}
		rethrowPrintError(e);
	}
};
