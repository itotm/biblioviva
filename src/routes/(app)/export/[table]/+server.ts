// SPDX-License-Identifier: GPL-3.0-or-later
// `/export/<table>?format=csv|ods&<filters>`: re-runs the grid's query server-side and streams the
// file (§3.19); a list of books or copies also gives MARC (`format=marc21|marc21-xml|unimarc|
// unimarc-xml`, step 9.65). The table must be registered, the account must hold its permission.
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import {
	exportFileName,
	exportResponse,
	EXPORT_FORMATS,
	type ExportFormat,
} from "#lib/server/export/index.js";
import { MARC_FORMATS, marcFile, type MarcFormat } from "#lib/server/services/marc-export.js";
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
	const marc = (MARC_FORMATS as readonly string[]).includes(format)
		? (format as MarcFormat)
		: null;
	if (!(EXPORT_FORMATS as readonly string[]).includes(format) && !(marc && definition.marc)) {
		error(400, "unknown format");
	}
	const query = searchParamsRecord(url.searchParams);
	delete query.format;
	const parsed = v.safeParse(definition.schema, query);
	if (!parsed.success) {
		error(400, "invalid export parameters");
	}

	const db = getDb();
	const config = getConfig();
	const timezone = config.library.timezone;
	// a list of books or copies in MARC (step 9.65)
	if (marc && definition.marc) {
		const { name, selection } = definition.marc(db, parsed.output);
		const file = marcFile(db, selection, marc, {
			unknownAuthor: config.catalog.specialAuthors[0] ?? "Anonimo",
			locale: config.ui.locale,
			timezone,
		});
		audit(db, user, "export.download", params.table, null, {
			format,
			filters: Object.keys(query),
		});
		const now = new Date();
		const stem = exportFileName(name, "csv", now, timezone).replace(/\.csv$/, "");
		const body = new Uint8Array(
			file.body.buffer as ArrayBuffer,
			file.body.byteOffset,
			file.body.byteLength,
		);
		return new Response(body, {
			headers: {
				"Content-Type": file.mime,
				"Content-Disposition": `attachment; filename="${stem}-${marc}.${file.extension}"`,
				"Content-Length": String(body.byteLength),
				"Cache-Control": "no-store",
			},
		});
	}
	const table = await definition.build(db, parsed.output, user, timezone);
	audit(db, user, "export.download", params.table, null, { format, filters: Object.keys(query) });
	return exportResponse(table, format as ExportFormat);
};
