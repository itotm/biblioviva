// SPDX-License-Identifier: GPL-3.0-or-later
// The template of the teacher import with the columns chosen on the page (step 9.19, Q115).
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { templateResponse } from "#lib/server/imports/template.js";
import { TEACHER_IMPORT } from "#lib/shared/import-columns.js";

export const GET: RequestHandler = ({ locals, url }) => {
	requirePermission(locals, "patrons.import");
	return templateResponse(TEACHER_IMPORT, url, "teachers-template.csv", "teachers");
};
