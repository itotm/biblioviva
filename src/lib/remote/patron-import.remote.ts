// SPDX-License-Identifier: GPL-3.0-or-later
// Student and teacher imports (steps 2.6, 9.19): upload → detect and map → validate (pure,
// repeatable) → commit (one transaction), the steps of every import
// (`#lib/server/imports/handlers.ts`), each call naming its import (`students` or `teachers`).
// Permission `patrons.import`; the removal of missing patrons in the synchronisation mode also
// needs `anonymize`.
import { command, form } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { uploadedFile, uploadId } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import { commitImport, receiveUpload, validateImport } from "#lib/server/imports/handlers.js";
import { PATRON_IMPORT_KINDS } from "#lib/server/imports/kinds.js";
import { PATRON_AUDIENCES, PATRON_IMPORT_COLUMNS } from "#lib/server/imports/patrons.js";
import { traced } from "#lib/server/log/debug.js";

const uploadSchema = v.object({
	audience: v.picklist(PATRON_AUDIENCES),
	file: uploadedFile,
});

export const uploadPatronCsv = form(uploadSchema, async ({ audience, file }, issue) => {
	requireUser("patrons.import");
	const upload = await receiveUpload(PATRON_IMPORT_KINDS[audience], env().DATA_DIR, file);
	if ("refused" in upload) {
		invalid(
			issue.file(await tServer(requestLocale(), upload.refused.key, upload.refused.params)),
		);
	}
	return upload;
});

const runSchema = v.object({
	audience: v.picklist(PATRON_AUDIENCES),
	uploadId,
	mapping: v.pipe(
		v.array(v.nullable(v.picklist(PATRON_IMPORT_COLUMNS))),
		v.minLength(1),
		v.maxLength(64),
	),
	header: v.boolean(),
	mode: v.picklist(["upsert", "sync"]),
	duplicatePolicy: v.optional(v.picklist(["update", "skip", "create"]), "update"),
	resolutions: v.optional(
		v.record(v.pipe(v.string(), v.regex(/^\d+$/)), v.union([v.number(), v.literal("create")])),
		{},
	),
});

/** The validate phase: repeatable, writes nothing. */
export const validatePatronCsv = command(runSchema, (input) =>
	traced("import", "validatePatronCsv", () => {
		const user = requireUser("patrons.import");
		return validateImport(PATRON_IMPORT_KINDS[input.audience], serverContext(), input, user);
	}),
);

/** The commit phase: validates again and writes everything in one transaction. */
export const commitPatronCsv = command(
	v.object({ ...runSchema.entries, removeMissing: v.optional(v.boolean(), false) }),
	(input) =>
		traced("import", "commitPatronCsv", () => {
			const user = requireUser("patrons.import");
			return commitImport(PATRON_IMPORT_KINDS[input.audience], serverContext(), input, user);
		}),
);
