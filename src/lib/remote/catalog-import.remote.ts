// SPDX-License-Identifier: GPL-3.0-or-later
// Catalogue import and migration from Koha (steps 3.9, 9.19): upload → detect and map → validate (pure,
// repeatable, with the class-per-copy question) → commit (one transaction), the steps of every
// import (`#lib/server/imports/handlers.ts`). Permission `catalog.import`; the open loans of the
// switch have their own admin-only import.
import { command, form } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { uploadedFile, uploadId } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import { commitImport, receiveUpload, validateImport } from "#lib/server/imports/handlers.js";
import { CATALOG_IMPORT_KIND } from "#lib/server/imports/kinds.js";
import { traced } from "#lib/server/log/debug.js";
import { CATALOG_FIELDS } from "#lib/shared/import-columns.js";

const uploadSchema = v.object({
	file: uploadedFile,
});

export const uploadCatalogCsv = form(uploadSchema, async ({ file }, issue) => {
	requireUser("catalog.import");
	const upload = await receiveUpload(CATALOG_IMPORT_KIND, env().DATA_DIR, file);
	if ("refused" in upload) {
		invalid(
			issue.file(await tServer(requestLocale(), upload.refused.key, upload.refused.params)),
		);
	}
	return upload;
});

const runSchema = v.object({
	uploadId,
	mapping: v.pipe(
		v.array(v.nullable(v.picklist(CATALOG_FIELDS))),
		v.minLength(1),
		v.maxLength(64),
	),
	header: v.boolean(),
	useSpecialValues: v.optional(v.boolean(), false),
	/** The class-per-copy answer: omitted while not asked or not answered. */
	enableClassPerItem: v.optional(v.boolean()),
	/** The item-type answer (Q139): omitted while not asked or not answered. */
	useMajorityType: v.optional(v.boolean()),
	useComputedCallNumbers: v.optional(v.boolean()),
});

/** The validate phase: repeatable, writes nothing. */
export const validateCatalogCsv = command(runSchema, (input) =>
	traced("import", "validateCatalogCsv", () => {
		const user = requireUser("catalog.import");
		return validateImport(CATALOG_IMPORT_KIND, serverContext(), input, user);
	}),
);

/** The commit phase: validates again and writes everything in one transaction. */
export const commitCatalogCsv = command(runSchema, (input) =>
	traced("import", "commitCatalogCsv", () => {
		const user = requireUser("catalog.import");
		return commitImport(CATALOG_IMPORT_KIND, serverContext(), input, user);
	}),
);
