// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/cards/test?template=<name>`: the test sheet of a card template — empty units with cut
// lines and marks plus a 10 cm ruler, to check the printer scale before printing real cards.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { htmlResponse, rethrowPrintError } from "#lib/server/print/route.js";
import { testSheetHtml } from "#lib/server/services/card-preview.js";

export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, "patrons");
	const config = getConfig();
	const template = url.searchParams.get("template") ?? config.cards.defaultTemplate;
	if (!/^[a-z0-9][a-z0-9_-]*$/i.test(template)) {
		error(400, "invalid template name");
	}
	const locale = requestLocale();
	const labels = {
		title: await tServer(locale, "admin.templates.test.title"),
		front: await tServer(locale, "admin.templates.preview.front"),
		back: await tServer(locale, "admin.templates.preview.back"),
		ruler: await tServer(locale, "admin.templates.test.ruler"),
	};
	try {
		return htmlResponse(testSheetHtml(config, env().CONFIG_DIR, template, labels));
	} catch (e) {
		rethrowPrintError(e);
	}
};
