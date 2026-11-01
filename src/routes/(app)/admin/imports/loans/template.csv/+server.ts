// SPDX-License-Identifier: GPL-3.0-or-later
// The template of the open loans import with the columns chosen on the page (steps 3.9, 9.19).
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { templateResponse } from "#lib/server/imports/template.js";
import { LOAN_IMPORT } from "#lib/shared/import-columns.js";

export const GET: RequestHandler = ({ locals, url }) => {
	requirePermission(locals, "admin");
	return templateResponse(LOAN_IMPORT, url, "loans-template.csv", "loans");
};
