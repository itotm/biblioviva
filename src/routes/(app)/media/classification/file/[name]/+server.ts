// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/classification/file/<name>`: one image file of `CONFIG_DIR/classification/images/`, for
// the pictogram gallery of the classification editor (step 11.1). Administrators only.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { env } from "#lib/server/env.js";
import { pictogramMime } from "#lib/server/services/classification-media.js";
import { IMAGE_FILE, IMAGES_DIR } from "#lib/server/services/taxonomy-pictograms.js";

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals, "admin");
	const mime = pictogramMime(params.name);
	const path = join(env().CONFIG_DIR, IMAGES_DIR, params.name);
	if (!IMAGE_FILE.test(params.name) || !mime || !existsSync(path)) {
		error(404, "not found");
	}
	return new Response(Bun.file(path), {
		headers: { "Content-Type": mime, "Cache-Control": "private, max-age=300" },
	});
};
