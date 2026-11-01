// SPDX-License-Identifier: GPL-3.0-or-later
// `/admin/exports/patron/<id>`: everything the library holds about one patron, as JSON, for an
// access request (step 7.3). Permission `admin`; audited without the patron's data.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getDb } from "#lib/server/db/index.js";
import { audit } from "#lib/server/services/audit.js";
import { patronDataExport } from "#lib/server/services/data-exports.js";

export const GET: RequestHandler = ({ locals, params }) => {
	const user = requirePermission(locals, "admin");
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) {
		error(404, "patron not found");
	}
	const db = getDb();
	const data = patronDataExport(db.$client, id);
	if (!data) {
		error(404, "patron not found");
	}
	audit(db, user, "export.patron", "patron", id);
	return new Response(`${JSON.stringify(data, null, 2)}\n`, {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="biblioviva-utente-${id}.json"`,
			"Cache-Control": "no-store",
		},
	});
};
