// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/templates/<kind>/<name>/<file>`: one file of a template's `assets/` folder (built-in or
// in CONFIG_DIR), for the thumbnails of the template folders page (step 11.6). Administrators only.
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { env } from "#lib/server/env.js";
import { ASSET_NAME } from "#lib/server/services/template-folders.js";
import { findTemplate } from "#lib/server/templates/engine.js";

const MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif": "image/gif",
	".svg": "image/svg+xml",
};

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals, "admin");
	const kind = params.kind;
	const mime = MIME[extname(params.file).toLowerCase()];
	if ((kind !== "cards" && kind !== "labels" && kind !== "slips") || !mime) {
		error(404, "not found");
	}
	const folder = findTemplate(kind, params.name, env().CONFIG_DIR);
	const path = folder ? join(folder.dir, "assets", params.file) : "";
	if (!folder || !ASSET_NAME.test(params.file) || !existsSync(path)) {
		error(404, "not found");
	}
	return new Response(Bun.file(path), {
		headers: {
			"Content-Type": mime,
			"Cache-Control": "private, no-cache",
			// an SVG opened on its own never runs anything
			"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			"X-Content-Type-Options": "nosniff",
		},
	});
};
