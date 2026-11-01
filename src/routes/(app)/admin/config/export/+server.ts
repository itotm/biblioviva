// SPDX-License-Identifier: GPL-3.0-or-later
// `/admin/config/export`: "Esporta configurazione" (steps 11.3, 11.12), the archive of the
// configuration parts — all of them, or those of `?parts=` — in the one archive format (the
// configuration under `config/`, a manifest; no database, no uploads); the history and the
// secrets (environment variables) stay out.
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { audit } from "#lib/server/services/audit.js";
import { partsIn } from "#lib/server/services/config-parts.js";
import { configArchiveName, createExportStream } from "#lib/server/services/export-archive.js";

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requirePermission(locals, "admin");
	assertNotDemo("archives");
	const config = getConfig();
	const db = getDb();
	const now = new Date();
	// `?parts=config:reports,section:library` (11.12): only those; every configuration part without it
	const asked = url.searchParams.get("parts")?.split(",");
	const available = partsIn(env().CONFIG_DIR);
	const parts = asked ? available.filter((p) => asked.includes(p)) : available;
	const { stream, manifest } = await createExportStream(db, env().DATA_DIR, env().CONFIG_DIR, {
		timezone: config.library.timezone,
		library: config.library.name,
		now,
		parts,
	});
	audit(db, user, "config.export", "config", null, {
		files: manifest.config.files,
		parts: asked ? parts : "all",
	});
	return new Response(stream, {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="${configArchiveName(now, config.library.timezone)}"`,
			"Cache-Control": "no-store",
		},
	});
};
