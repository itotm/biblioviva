// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/branding/logo`: the library's logo (step 4.10) for logged-in accounts. The URL carries
// the file's version (`?v=`), so the browser may keep it.
import { error } from "@sveltejs/kit";
import { existsSync } from "node:fs";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { env } from "#lib/server/env.js";
import { logoPath } from "#lib/server/services/branding.js";

export const GET: RequestHandler = ({ locals }) => {
	requirePermission(locals);
	const path = logoPath(env().CONFIG_DIR);
	if (!existsSync(path)) {
		error(404, "not found");
	}
	return new Response(Bun.file(path), {
		headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
	});
};
