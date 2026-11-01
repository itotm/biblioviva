// SPDX-License-Identifier: GPL-3.0-or-later
// Open loans import (steps 3.9, 9.19): the loans running in Koha on the day of the switch, with
// their original dates (or today and the due date of the rules when the file has none), through
// the steps of every import (`#lib/server/imports/handlers.ts`). Used once, permission `admin`.
import { command, form } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { uploadedFile, uploadId } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import { commitImport, receiveUpload, validateImport } from "#lib/server/imports/handlers.js";
import { LOAN_IMPORT_KIND } from "#lib/server/imports/kinds.js";
import { traced } from "#lib/server/log/debug.js";
import { LOAN_FIELDS } from "#lib/shared/import-columns.js";

const uploadSchema = v.object({
	file: uploadedFile,
});

export const uploadLoanCsv = form(uploadSchema, async ({ file }, issue) => {
	requireUser("admin");
	const upload = await receiveUpload(LOAN_IMPORT_KIND, env().DATA_DIR, file);
	if ("refused" in upload) {
		invalid(
			issue.file(await tServer(requestLocale(), upload.refused.key, upload.refused.params)),
		);
	}
	return upload;
});

const runSchema = v.object({
	uploadId,
	mapping: v.pipe(v.array(v.nullable(v.picklist(LOAN_FIELDS))), v.minLength(1), v.maxLength(64)),
	header: v.boolean(),
});

export const validateLoanCsv = command(runSchema, (input) =>
	traced("import", "validateLoanCsv", () => {
		const user = requireUser("admin");
		return validateImport(LOAN_IMPORT_KIND, serverContext(), input, user);
	}),
);

export const commitLoanCsv = command(runSchema, (input) =>
	traced("import", "commitLoanCsv", () => {
		const user = requireUser("admin");
		return commitImport(LOAN_IMPORT_KIND, serverContext(), input, user);
	}),
);
