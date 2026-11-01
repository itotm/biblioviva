// SPDX-License-Identifier: GPL-3.0-or-later
// Patron photos from Koha (step 3.9b): a ZIP archive uploaded here, or the files an administrator
// copied into `DATA_DIR/imports/photos/`. Permission `admin`.
import { command, form, query } from "$app/server";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";
import { uploadedFile } from "#lib/shared/input-schemas.js";
import { requestLocale, tServer } from "#lib/i18n/server.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { requireFeature } from "#lib/server/features.js";
import { traced } from "#lib/server/log/debug.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import {
	importPatronPhotos,
	photoImportDir,
	readPhotoFolder,
	readPhotoZip,
} from "#lib/server/services/photo-import.js";

/** How many files wait in the drop folder (and where it is). */
export const getPhotoFolder = query(() => {
	requireUser("admin");
	requireFeature("photos");
	const dir = photoImportDir(env().DATA_DIR);
	return { path: dir, files: readPhotoFolder(dir).length };
});

export const importPhotoZip = form(
	v.object({
		file: uploadedFile,
		replace: v.optional(v.boolean(), false),
	}),
	async ({ file, replace }, issue) => {
		const user = requireUser("admin");
		requireFeature("photos");
		let files;
		try {
			files = readPhotoZip(new Uint8Array(await file.arrayBuffer()));
		} catch {
			invalid(issue.file(await tServer(requestLocale(), "admin.photosImport.errors.notZip")));
		}
		if (files.length === 0) {
			invalid(issue.file(await tServer(requestLocale(), "admin.photosImport.errors.empty")));
		}
		return importPatronPhotos(getDb(), env().DATA_DIR, files, getConfig().photos, user, {
			replace,
		});
	},
);

export const importPhotoFolder = command(
	v.object({ replace: v.optional(v.boolean(), false) }),
	({ replace }) =>
		traced("import", "importPhotoFolder", async () => {
			const user = requireUser("admin");
			requireFeature("photos");
			const files = readPhotoFolder(photoImportDir(env().DATA_DIR));
			const summary = await importPatronPhotos(
				getDb(),
				env().DATA_DIR,
				files,
				getConfig().photos,
				user,
				{ replace },
			);
			void getPhotoFolder().refresh();
			return { files: files.length, ...summary };
		}),
);
