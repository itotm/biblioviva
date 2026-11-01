// SPDX-License-Identifier: GPL-3.0-or-later
// `/admin/exports/<kind>`: the administrator's exports (steps 7.3, 9.19), streamed — students,
// teachers, catalogue and open loans in the formats of the imports, the loan history with
// snapshots, the JSON dump.
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requirePermission } from "#lib/server/auth/load-guard.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { audit } from "#lib/server/services/audit.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import {
	catalogCsv,
	databaseDump,
	loansHistoryCsv,
	openLoansCsv,
	studentsCsv,
	teachersCsv,
} from "#lib/server/services/data-exports.js";
import { textStream } from "#lib/server/services/stream.js";
import { APP_VERSION } from "#lib/shared/version.js";

const KINDS = {
	students: { file: "students.csv", make: studentsCsv },
	teachers: { file: "teachers.csv", make: teachersCsv },
	catalog: { file: "catalog.csv", make: catalogCsv },
	"open-loans": { file: "open-loans.csv", make: openLoansCsv },
	"loans-history": { file: "loans-history.csv", make: loansHistoryCsv },
	dump: {
		file: "data.json",
		make: (sqlite: Parameters<typeof studentsCsv>[0]) =>
			databaseDump(sqlite, { version: APP_VERSION }),
	},
} as const;

export const GET: RequestHandler = ({ locals, params }) => {
	const user = requirePermission(locals, "admin");
	const kind = KINDS[params.kind as keyof typeof KINDS] as
		(typeof KINDS)[keyof typeof KINDS] | undefined;
	if (!kind) {
		error(404, "unknown export");
	}
	const db = getDb();
	audit(db, user, "export.admin", "export", null, { kind: params.kind });
	const name = `biblioviva-${libraryToday(getConfig())}-${kind.file}`;
	return new Response(textStream(kind.make(db.$client)), {
		headers: {
			"Content-Type": kind.file.endsWith(".json")
				? "application/json; charset=utf-8"
				: "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${name}"`,
			"Cache-Control": "no-store",
		},
	});
};
