// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/patrons/<id>/main|thumb`: the patron photo (JPEG or WebP, by its file) for the accounts that see
// patrons (`loans` at the desk, `patrons`: never the cataloguing or report accounts, minors), or the
// placeholder avatar when there is none (step 2.3) or photos are switched off (9.38). Private cache: the file name changes per version.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAnyPermission } from "#lib/server/auth/load-guard.js";
import { featureOn } from "#lib/server/features.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { imageMimeOf } from "#lib/server/images/crop.js";
import { patronPhotoFile, PHOTO_SIZES, type PhotoSize } from "#lib/server/services/media.js";

const PLACEHOLDER =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" width="120" height="160">' +
	'<rect width="120" height="160" fill="#e5e7eb"/>' +
	'<circle cx="60" cy="62" r="26" fill="#9ca3af"/>' +
	'<path d="M20 150c4-30 24-46 40-46s36 16 40 46z" fill="#9ca3af"/></svg>';

export const GET: RequestHandler = ({ locals, params, setHeaders }) => {
	requireAnyPermission(locals, ["loans", "patrons"]);
	if (!/^\d+$/.test(params.id) || !(params.size in PHOTO_SIZES)) {
		error(404, "not found");
	}
	// photos switched off (9.38): the placeholder, the stored file stays where it is
	const path = featureOn("photos")
		? patronPhotoFile(getDb(), env().DATA_DIR, Number(params.id), params.size as PhotoSize)
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
