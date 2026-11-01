// SPDX-License-Identifier: GPL-3.0-or-later
// `/admin/config/languages/<code>`: one folder of `CONFIG_DIR/i18n/` as a zip (step 11.8), to start
// a translation from the English or Italian example or to keep a copy of a pack. Administrators only.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { env } from "#lib/server/env.js";
import { LanguagePackError, packZip } from "#lib/server/services/language-packs.js";

export const GET: RequestHandler = ({ locals, params }) => {
	requirePermission(locals, "admin");
	try {
		const zip = packZip(env().CONFIG_DIR, params.code);
		return new Response(new Blob([new Uint8Array(zip)]), {
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="biblioviva-language-${params.code}.zip"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		if (e instanceof LanguagePackError) {
			error(404, "not found");
		}
		throw e;
	}
};
