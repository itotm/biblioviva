// SPDX-License-Identifier: GPL-3.0-or-later
// Backups page (step 1.9): list, run now, off-site status. Download is a +server route. Since
// step 11.12: a backup of chosen parts (a zip in the backups folder), and the restore of a backup
// or of an uploaded archive — staged, checked with the parts chosen, then applied.
import { command, form, query } from "$app/server";
import { assertNotDemo } from "#lib/server/demo/public.js";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { megabytes } from "#lib/shared/bytes.js";
import { uploadedFile } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { isPartId, type PartId } from "#lib/shared/archive-parts.js";
import {
	archiveBackupNow,
	ArchiveReadError,
	exportableParts,
	MAX_UPLOAD_BYTES,
} from "#lib/server/services/export-archive.js";
import {
	applyRestore,
	checkRestore,
	discardRestore,
	RestoreNotReadyError,
	stageRestore,
	stageUploadedRestore,
} from "#lib/server/services/full-restore.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { traced } from "#lib/server/log/debug.js";
import { serverContext } from "#lib/server/context.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import { refusing } from "#lib/server/http/errors.js";
import { join } from "node:path";
import {
	backupPath,
	backupsDir,
	listBackupsMarked,
	readOffsiteStatus,
	backupNow,
	summarizeUploads,
	UPLOADS_MIRROR,
} from "#lib/server/services/backup.js";

export const getBackups = query(() => {
	requireUser("admin");
	const config = getConfig();
	return {
		/** Each marked when it was made at start because the scheduled one was missed (9.33). */
		backups: listBackupsMarked(getDb()),
		/** What the nightly mirror under BACKUP_DIR/uploads currently holds. */
		mirror: summarizeUploads(join(backupsDir(), UPLOADS_MIRROR)),
		uploads: summarizeUploads(join(env().DATA_DIR, "uploads")),
		offsite: readOffsiteStatus(),
		offsiteEnabled: config.backup.offsite.enabled,
		offsiteRemote: config.backup.offsite.remote,
		cron: config.backup.cron,
		keepDays: config.backup.keepDays,
		parts: exportableParts(env().CONFIG_DIR),
		maxUploadMb: megabytes(MAX_UPLOAD_BYTES, requestLocale()),
	};
});

export const createBackupNow = command(() =>
	traced("backup", "createBackupNow", async () => {
		const user = requireUser("admin");
		const config = getConfig();
		const result = await backupNow(
			getDb(),
			env().DATA_DIR,
			{ timezone: config.library.timezone, keepDays: config.backup.keepDays },
			user,
		);
		// single-flight mutation: the refreshed list travels back with this response
		void getBackups().refresh();
		return result;
	}),
);

const partIds = v.pipe(
	v.array(v.pipe(v.string(), v.check(isPartId, "unknown part"))),
	v.maxLength(100),
	v.transform((list) => list as PartId[]),
);
const token = v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/));

/** A backup of the parts chosen, written as a zip into the backups folder. */
export const createArchiveBackupNow = command(
	v.object({ parts: v.pipe(partIds, v.minLength(1)) }),
	({ parts }) =>
		traced("backup", "createArchiveBackupNow", async () => {
			const user = requireUser("admin");
			const ctx = serverContext();
			const { library } = ctx.config;
			const result = await archiveBackupNow(
				ctx,
				{ timezone: library.timezone, library: library.name, parts },
				user,
			);
			void getBackups().refresh();
			return result;
		}),
);

/** A backup of the folder staged for a restore, checked with every part it holds. */
export const stageBackupRestore = command(v.object({ name: v.string() }), async ({ name }) => {
	requireUser("admin");
	const path = backupPath(name);
	if (!path) {
		return { ok: false as const };
	}
	const ctx = serverContext();
	const staged = await stageRestore(ctx.dataDir, path, name);
	return { ok: true as const, check: await checkRestore(ctx, staged) };
});

/** An archive from another computer, uploaded (up to the size the server accepts), staged. */
export const uploadRestoreArchive = form(
	v.object({
		archive: uploadedFile,
	}),
	async ({ archive }, issue) => {
		requireUser("admin");
		// refused as such before the upload is read (not as "not an archive")
		assertNotDemo("restore");
		try {
			const ctx = serverContext();
			const staged = await stageUploadedRestore(
				ctx.dataDir,
				new Uint8Array(await archive.arrayBuffer()),
				"archivio.zip",
			);
			return await checkRestore(ctx, staged);
		} catch (e) {
			// the reasons of the one reader, as "Importa configurazione" shows them
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
			if (e instanceof Error && !(e instanceof RestoreNotReadyError)) {
				invalid(
					issue.archive(
						await tServer(requestLocale(), "admin.backups.restore.notArchive"),
					),
				);
			}
			throw e;
		}
	},
);

export const recheckRestore = command(
	v.object({ token, parts: partIds }),
	async ({ token: t, parts }) => {
		requireUser("admin");
		return refusing(
			async () => ({
				ok: true as const,
				check: await checkRestore(serverContext(), t, parts),
			}),
			RestoreNotReadyError,
			() => ({ ok: false as const }),
		);
	},
);

export const applyRestoreNow = command(v.object({ token, parts: partIds }), ({ token: t, parts }) =>
	traced("backup", "applyRestoreNow", async () => {
		const user = requireUser("admin");
		return refusing(
			async () => {
				const { check, change } = await applyRestore(serverContext(), t, parts, user);
				void getBackups().refresh();
				return { ok: true as const, parts: check.selected, change: change?.id ?? null };
			},
			RestoreNotReadyError,
			(e) => ({ ok: false as const, check: e.check }),
		);
	}),
);

export const discardRestoreNow = command(v.object({ token }), ({ token: t }) => {
	requireUser("admin");
	discardRestore(env().DATA_DIR, t);
	return { ok: true as const };
});
