// SPDX-License-Identifier: GPL-3.0-or-later
// Streams one backup file to an administrator (step 1.9). The name is validated against the
// backup pattern, so no other file than a backup of BACKUP_DIR can be reached.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getDb } from "#lib/server/db/index.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { audit } from "#lib/server/services/audit.js";
import { backupPath } from "#lib/server/services/backup.js";

export const GET: RequestHandler = ({ locals, params }) => {
	const user = requirePermission(locals, "admin");
	assertNotDemo("archives");
	const path = backupPath(params.name);
	if (!path) {
		error(404, "backup not found");
	}
	audit(getDb(), user, "backup.download", "backup", params.name);
	return new Response(Bun.file(path), {
		headers: {
			"Content-Type": params.name.endsWith(".zip")
				? "application/zip"
				: "application/vnd.sqlite3",
			"Content-Disposition": `attachment; filename="${params.name}"`,
			"Cache-Control": "no-store",
		},
	});
};
