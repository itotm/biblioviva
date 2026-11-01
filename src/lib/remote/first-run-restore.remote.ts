// SPDX-License-Identifier: GPL-3.0-or-later
// Restore from the first-run wizard (step 9.43): an archive of "Esporta tutto" uploaded instead of
// answering the wizard, checked first, then restored whole. Only while the setup mode holds
// (`requireSetupMode`, 404 afterwards), never in the public demo. The answers carry codes, not
// texts: the wizard's language is the page's (`?lang=`), which a remote request does not know.
import { command, form } from "$app/server";
import * as v from "valibot";
import { requireSetupMode } from "#lib/server/auth/setup-guard.js";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import { refusal, refusing } from "#lib/server/http/errors.js";
import { ArchiveReadError } from "#lib/server/services/export-archive.js";
import {
	applyFirstRunRestore,
	checkFirstRunRestore,
	discardFirstRunRestore,
	FirstRunRestoreError,
} from "#lib/server/services/first-run-restore.js";
import { RestoreNotReadyError } from "#lib/server/services/full-restore.js";
import { uploadedFile } from "#lib/shared/input-schemas.js";

const token = v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/));

/** Why an archive was refused: the code and what it names (a file, a version, the missing parts). */
const refused = (code: string, detail: string): { ok: false; code: string; detail: string } => ({
	ok: false,
	code,
	detail,
});

/** First half: the uploaded archive staged and checked; nothing is written to the library. */
export const checkRestoreArchive = form(
	v.object({ archive: uploadedFile }),
	async ({ archive }) => {
		requireSetupMode();
		assertNotDemo("restore");
		return refusing(
			async () => ({
				ok: true as const,
				check: await checkFirstRunRestore(
					serverContext(),
					new Uint8Array(await archive.arrayBuffer()),
				),
			}),
			[
				refusal(ArchiveReadError, (e) => refused(e.code, e.detail)),
				refusal(FirstRunRestoreError, (e) => refused(e.code, e.detail)),
			],
		);
	},
);

/** Second half: the checked archive restored whole; the answer lists the accounts of the archive. */
export const applyRestoreArchive = command(v.object({ token }), ({ token: t }) => {
	requireSetupMode();
	assertNotDemo("restore");
	return refusing(
		async () => ({
			ok: true as const,
			accounts: (await applyFirstRunRestore(serverContext(), t)).accounts,
		}),
		[
			refusal(FirstRunRestoreError, (e) => refused(e.code, e.detail)),
			// the staged archive is gone (a new upload replaced it, or it was dropped)
			refusal(RestoreNotReadyError, () => refused("gone", "")),
		],
	);
});

/** The operator gave up: the staged archive is dropped. */
export const discardRestoreArchive = command(v.object({ token }), ({ token: t }) => {
	requireSetupMode();
	discardFirstRunRestore(env().DATA_DIR, t);
	return { ok: true as const };
});
