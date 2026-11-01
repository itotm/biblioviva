// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/demo/class-picture?kind=scan|photo`: a sample class picture of the demo data (Phase 13,
// Q109, Q126: ten cards of cartoon faces, scanned flat or photographed at an angle on a table,
// `demo/census/`), offered by the photo census only while the demo data are loaded. Accounts that
// manage patrons only.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { requireFeature } from "#lib/server/features.js";
import { DEMO_CLASS_PICTURES } from "#lib/server/demo/public.js";
import { env } from "#lib/server/env.js";
import { readDemoInfo } from "#lib/server/services/setup.js";

export const GET: RequestHandler = async ({ locals, url }) => {
	requirePermission(locals, "patrons");
	requireFeature("photos");
	const kind = url.searchParams.get("kind") === "photo" ? "photo" : "scan";
	const file = Bun.file(DEMO_CLASS_PICTURES[kind]);
	if (readDemoInfo(env().DATA_DIR) === null || !(await file.exists())) {
		error(404, "not found");
	}
	return new Response(file, {
		headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
	});
};
