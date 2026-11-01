// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/class-sheets/frames/<id>?v=<version>`: the straightened photo of a frame of a class
// picture (Phase 13), at the configured photo size; the version in the address changes with the
// crop. For accounts that manage patrons only.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { requireFeature } from "#lib/server/features.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { imageMimeOf } from "#lib/server/images/crop.js";
import { frameFile } from "#lib/server/services/class-sheets.js";

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals, "patrons");
	requireFeature("photos");
	const path = /^\d{1,9}$/.test(params.frame)
		? frameFile(getDb(), env().DATA_DIR, Number(params.frame))
		: null;
	if (!path) {
		error(404, "not found");
	}
	return new Response(Bun.file(path), {
		headers: { "Content-Type": imageMimeOf(path), "Cache-Control": "private, max-age=3600" },
	});
};
