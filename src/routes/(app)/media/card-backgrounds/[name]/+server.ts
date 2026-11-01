// SPDX-License-Identifier: GPL-3.0-or-later
// `/media/card-backgrounds/<name>`: a background shipped for the card templates (step 11.17), shown
// by the designer's gallery. Administrators only; the files never change between releases.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { cardBackgroundFile } from "#lib/server/services/template-folders.js";

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals, "admin");
	const bytes = cardBackgroundFile(params.name);
	if (!bytes) {
		error(404, "not found");
	}
	return new Response(new Blob([new Uint8Array(bytes)]), {
		headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=86400" },
	});
};
