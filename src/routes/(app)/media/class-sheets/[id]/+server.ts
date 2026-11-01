// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/class-sheets/<id>`: a class picture of the photo census (Phase 13), JPEG, for accounts
// that manage patrons only — it is personal data of minors. A frame erased with a removed patron is
// painted over before the picture is served (Q106). The ETag follows the stored file, which a
// painting replaces: the browser revalidates and gets the covered picture.
import { basename } from "node:path";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { requireFeature } from "#lib/server/features.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { sheetFile } from "#lib/server/services/class-sheets.js";
import { paintErasedFrames } from "#lib/server/services/class-sheet-erasure.js";

export const GET: RequestHandler = async ({ locals, params, request }) => {
	requirePermission(locals, "patrons");
	requireFeature("photos");
	if (!/^\d{1,9}$/.test(params.id)) {
		error(404, "not found");
	}
	const id = Number(params.id);
	await paintErasedFrames(getDb(), env().DATA_DIR, id);
	const path = sheetFile(getDb(), env().DATA_DIR, id);
	if (!path) {
		error(404, "not found");
	}
	const etag = `"${basename(path)}"`;
	const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
	if (request.headers.get("if-none-match") === etag) {
		return new Response(null, { status: 304, headers });
	}
	return new Response(Bun.file(path), { headers: { ...headers, "Content-Type": "image/jpeg" } });
};
