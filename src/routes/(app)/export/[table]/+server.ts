// SPDX-License-Identifier: GPL-3.0-or-later
// `/export/<table>?format=csv|ods&<filters>`: re-runs the grid's query server-side and streams the
// file (§3.19). The table must be registered, the account must hold its permission.
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { exportResponse, EXPORT_FORMATS, type ExportFormat } from "#lib/server/export/index.js";
import { getExport, searchParamsRecord } from "#lib/server/export/registry.js";
import { registerAllExports } from "#lib/server/export/tables/index.js";
import { audit } from "#lib/server/services/audit.js";

export const GET: RequestHandler = async ({ locals, params, url }) => {
	registerAllExports();
	const definition = getExport(params.table);
	if (!definition) {
		error(404, "unknown export");
	}
	const user = requirePermission(locals, definition.permission);

	const format = url.searchParams.get("format") ?? "csv";
	if (!(EXPORT_FORMATS as readonly string[]).includes(format)) {
		error(400, "unknown format");
	}
	const query = searchParamsRecord(url.searchParams);
	delete query.format;
	const parsed = v.safeParse(definition.schema, query);
	if (!parsed.success) {
		error(400, "invalid export parameters");
	}

	const db = getDb();
	const timezone = getConfig().library.timezone;
	const table = await definition.build(db, parsed.output, user, timezone);
	audit(db, user, "export.download", params.table, null, { format, filters: Object.keys(query) });
	return exportResponse(table, format as ExportFormat);
};
