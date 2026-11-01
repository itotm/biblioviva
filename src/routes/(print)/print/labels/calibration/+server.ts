// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/labels/calibration?stock=<id>[&kind=pair]`: the cells of an adhesive stock outlined on an
// A4 page with a 10 cm ruler, printed on plain paper to check the margins; with `kind` the units
// of the configured template of that kind (pairs: two stacked cells) are outlined too.
import type { RequestHandler } from "./$types";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { LABEL_KINDS, loadLabelTemplate } from "#lib/server/services/label-templates.js";
import { calibrationSheetHtml } from "#lib/server/services/labels.js";
import { env } from "#lib/server/env.js";
import { htmlResponse, rethrowPrintError } from "#lib/server/print/route.js";
import * as v from "valibot";

export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, "catalog");
	const config = getConfig();
	const kind = v.safeParse(v.picklist(LABEL_KINDS), url.searchParams.get("kind"));
	const stock =
		url.searchParams.get("stock") ??
		(kind.success ? config.labels[kind.output].stock : config.labels.pair.stock);
	const locale = requestLocale();
	const labels = {
		title: await tServer(locale, "admin.templates.calibration.title"),
		ruler: await tServer(locale, "admin.templates.test.ruler"),
	};
	try {
		const cells = kind.success
			? loadLabelTemplate(config.labels[kind.output].template, env().CONFIG_DIR).meta.unit
					.cells
			: 1;
		return htmlResponse(calibrationSheetHtml(config, stock, labels, cells));
	} catch (e) {
		rethrowPrintError(e);
	}
};
