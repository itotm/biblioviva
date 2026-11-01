// SPDX-License-Identifier: GPL-3.0-or-later
// `/print/cards/calibration`: the calibration of printing the cards on both sides (step 9.27,
// Q127) — a 150 × 100 mm card to cut out on side 1, two rulers in mm behind its edges on side 2,
// at the places of the configured flip and offset. Administrators only (the offset is a setting).
import type { RequestHandler } from "./$types";
import { htmlResponse } from "#lib/server/print/route.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { duplexCalibrationHtml } from "#lib/server/services/card-preview.js";

export const GET: RequestHandler = async ({ locals }) => {
	requirePermission(locals, "admin");
	const locale = requestLocale();
	const labels = {
		title: await tServer(locale, "admin.calibration.sheet.title"),
		cut: await tServer(locale, "admin.calibration.sheet.cut"),
		read: await tServer(locale, "admin.calibration.sheet.read"),
	};
	return htmlResponse(duplexCalibrationHtml(getConfig(), labels));
};
