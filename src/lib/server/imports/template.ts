// SPDX-License-Identifier: GPL-3.0-or-later
// The template of an import (step 9.19, Q115): the header only, with the columns the operator
// chose (`?columns=first_name,last_name,class`), or the required ones; `;`, BOM, CRLF.
import { error } from "@sveltejs/kit";
import { defaultTemplate, templateHeader, type ImportSpec } from "#lib/shared/import-columns.js";
import { readDemoExample } from "#lib/server/demo/examples.js";
import { isDemoPublic } from "#lib/server/demo/public.js";
import { env } from "#lib/server/env.js";
import { writeCsv } from "./csv.js";

export function templateResponse<F extends string>(
	spec: ImportSpec<F>,
	url: URL,
	filename: string,
	kind: string,
): Response {
	// the public demo hands out its example file: the only one it imports (Q121)
	const example = isDemoPublic() ? readDemoExample(env().DATA_DIR, kind) : null;
	if (example) {
		return new Response(new Blob([example.bytes as Uint8Array<ArrayBuffer>]), {
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="${example.name}"`,
				"Cache-Control": "no-store",
			},
		});
	}
	const param = url.searchParams.get("columns");
	const header = param === null ? defaultTemplate(spec) : templateHeader(spec, param.split(","));
	if (!header) {
		error(400, "invalid columns");
	}
	return new Response(writeCsv([header]), {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": "no-store",
		},
	});
}
