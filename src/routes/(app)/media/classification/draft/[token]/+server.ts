// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/classification/draft/<token>`: a pictogram uploaded in the classification editor and
// not saved yet (step 11.1). Administrators only; the file never changes under its token.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { env } from "#lib/server/env.js";
import { stagedPictogramPath } from "#lib/server/services/taxonomy-pictograms.js";

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals, "admin");
	const path = stagedPictogramPath(env().DATA_DIR, params.token);
	if (!path) {
		error(404, "not found");
	}
	return new Response(Bun.file(path), {
		headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
	});
};
