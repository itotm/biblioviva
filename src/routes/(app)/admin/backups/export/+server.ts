// SPDX-License-Identifier: GPL-3.0-or-later
// "Esporta tutto" (step 1.9b), or the parts of `?parts=` (11.12): streams one archive with the
// database snapshot, the uploads and the configuration folder to an administrator, in the one
// archive format. Nothing is buffered beyond the snapshot file.
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { audit } from "#lib/server/services/audit.js";
import { createExportStream, exportArchiveName } from "#lib/server/services/export-archive.js";
import { isPartId } from "#lib/shared/archive-parts.js";

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requirePermission(locals, "admin");
	assertNotDemo("archives");
	const config = getConfig();
	const db = getDb();
	const now = new Date();
	const name = exportArchiveName(now, config.library.timezone);
	// `?parts=data:catalog,config:reports` (11.12): only those; every part without it
	const parts = url.searchParams.get("parts")?.split(",").filter(isPartId);
	const { stream, manifest } = await createExportStream(db, env().DATA_DIR, env().CONFIG_DIR, {
		timezone: config.library.timezone,
		library: config.library.name,
		now,
		parts,
	});
	audit(db, user, "backup.export", "backup", name, {
		databaseBytes: manifest.database.bytes,
		photos: manifest.uploads.photos,
		covers: manifest.uploads.covers,
		configFiles: manifest.config.files,
		parts: manifest.parts,
	});
	return new Response(stream, {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="${name}"`,
			"Cache-Control": "no-store",
		},
	});
};
