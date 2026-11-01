// SPDX-License-Identifier: GPL-3.0-or-later
// `/admin/config/reports/<id>/file.json`: the definition in use with this id as a JSON file (step 11.9), to
// customise a built-in report or keep a copy. Administrators only.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { env } from "#lib/server/env.js";
import { reportFileContent, ReportLibraryError } from "#lib/server/services/report-library.js";

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals, "admin");
	try {
		const file = reportFileContent(env().CONFIG_DIR, params.id);
		return new Response(file.content, {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Content-Disposition": `attachment; filename="${params.id}.json"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		if (e instanceof ReportLibraryError) {
			error(404, "not found");
		}
		throw e;
	}
};
