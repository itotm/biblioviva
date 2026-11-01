// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/covers/<id>/main|thumb`: the cover (JPEG or WebP, by its file) for logged-in accounts (there is no public
// interface, Q18), or a placeholder when the record has none (step 3.7) or covers are switched off (9.38).
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { featureOn } from "#lib/server/features.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { imageMimeOf } from "#lib/server/images/crop.js";
import { COVER_SIZES, coverFile, type CoverSize } from "#lib/server/services/covers.js";

const PLACEHOLDER =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" width="120" height="160">' +
	'<rect width="120" height="160" fill="#e5e7eb"/>' +
	'<rect x="30" y="40" width="60" height="80" rx="4" fill="none" stroke="#9ca3af" stroke-width="6"/>' +
	'<path d="M45 40v80" stroke="#9ca3af" stroke-width="6"/></svg>';

export const GET: RequestHandler = ({ locals, params, setHeaders }) => {
	requirePermission(locals);
	if (!/^\d+$/.test(params.id) || !(params.size in COVER_SIZES)) {
		error(404, "not found");
	}
	// covers switched off (9.38): the placeholder, the stored file stays where it is
	const path = featureOn("covers")
		? coverFile(getDb(), env().DATA_DIR, Number(params.id), params.size as CoverSize)
		: null;
	if (!path) {
		setHeaders({ "Cache-Control": "private, no-cache" });
		return new Response(PLACEHOLDER, {
			headers: { "Content-Type": "image/svg+xml; charset=utf-8" },
		});
	}
	return new Response(Bun.file(path), {
		headers: { "Content-Type": imageMimeOf(path), "Cache-Control": "private, max-age=3600" },
	});
};
