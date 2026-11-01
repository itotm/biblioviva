// SPDX-License-Identifier: GPL-3.0-or-later
// "Importa configurazione" of the Configurazione area: an archive checked aside, then the chosen
// parts applied as one change; and the parts an export of the configuration can hold.
// Permission `admin`.
import { command, form, query } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { megabytes } from "#lib/shared/bytes.js";
import { uploadedFile } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { refusal, refusing } from "#lib/server/http/errors.js";
import { serverContext } from "#lib/server/context.js";
import { env } from "#lib/server/env.js";
import {
	applyConfigArchive,
	ArchiveNotReadyError,
	checkUploadedConfigArchive,
	discardConfigArchive,
	recheckConfigArchive,
} from "#lib/server/services/full-restore.js";
import { ArchiveReadError, MAX_UPLOAD_BYTES } from "#lib/server/services/export-archive.js";
import { isPartId, type PartId } from "#lib/shared/archive-parts.js";
import { configRefused, failureOf, failureWith } from "#lib/server/services/config-commit.js";
import { partsIn } from "#lib/server/services/config-parts.js";
import { getConfigOverview } from "./config.remote.js";

const token = v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/));

/**
 * "Importa configurazione", first half: any archive (a backup, "Esporta tutto", "Esporta
 * configurazione") unpacked aside with only its configuration and checked (nothing changes).
 */
export const checkConfigImport = form(
	v.object({
		archive: uploadedFile,
	}),
	async ({ archive }, issue) => {
		requireUser("admin");
		try {
			return await checkUploadedConfigArchive(
				serverContext(),
				new Uint8Array(await archive.arrayBuffer()),
			);
		} catch (e) {
			if (e instanceof ArchiveReadError) {
				invalid(
					issue.archive(
						await tServer(requestLocale(), `config.archive.errors.${e.code}`, {
							name: e.detail,
							maxMb: megabytes(MAX_UPLOAD_BYTES, requestLocale()),
						}),
					),
				);
			}
			throw e;
		}
	},
);

const partIds = v.pipe(
	v.array(v.pipe(v.string(), v.check(isPartId, "unknown part"))),
	v.maxLength(100),
	v.transform((list) => list as PartId[]),
);

/** The parts an export of the configuration can hold (step 11.12). */
export const getConfigArchiveParts = query(() => {
	requireUser("admin");
	return partsIn(env().CONFIG_DIR);
});

/** The staged archive checked again with the parts chosen. */
export const recheckConfigImport = command(
	v.object({ token, parts: partIds }),
	async ({ token: id, parts }) => {
		requireUser("admin");
		return refusing(
			async () => ({
				ok: true as const,
				check: await recheckConfigArchive(serverContext(), id, parts),
			}),
			ArchiveNotReadyError,
			() => ({ ok: false as const }),
		);
	},
);

/** Second half: the chosen parts replace those of the configuration (one change, undoable). */
export const applyConfigImport = command(
	v.object({ token, parts: partIds }),
	async ({ token: id, parts }) => {
		const user = requireUser("admin");
		return refusing(async () => {
			const change = await applyConfigArchive(serverContext(), id, user, { parts });
			void getConfigOverview().refresh();
			return { ok: true as const, change: change.id };
		}, [
			refusal(ArchiveNotReadyError, (e) => failureWith({ check: e.check })),
			refusal(configRefused(), (e) => failureOf(e, { check: null })),
		]);
	},
);

export const discardConfigImport = command(v.object({ token }), ({ token: id }) => {
	requireUser("admin");
	discardConfigArchive(env().DATA_DIR, id);
	return { ok: true as const };
});
