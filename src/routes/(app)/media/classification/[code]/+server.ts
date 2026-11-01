// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/classification/<code>`: the pictogram of a genre or class (configured file, or the
// generated placeholder disc) for logged-in accounts (§3.17).
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { env } from "#lib/server/env.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import {
	classificationImage,
	placeholderPictogram,
} from "#lib/server/services/classification-media.js";

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals);
	if (!/^[\w.-]{1,16}$/.test(params.code)) {
		error(404, "not found");
	}
	const image = classificationImage(
		catalogRules(getConfig()).scheme,
		env().CONFIG_DIR,
		params.code,
	);
	if (!image) {
		error(404, "not found");
	}
	if (!image.path) {
		return new Response(placeholderPictogram(image.node), {
			headers: {
				"Content-Type": "image/svg+xml; charset=utf-8",
				"Cache-Control": "private, max-age=3600",
			},
		});
	}
	return new Response(Bun.file(image.path), {
		headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=3600" },
	});
};
