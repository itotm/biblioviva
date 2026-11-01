// SPDX-License-Identifier: GPL-3.0-or-later
// `bun run patrons:import-photos <folder|file.zip> [--replace]` (step 3.9b) — stores the patron
// photos exported from Koha, one file per patron named after the card number (`0000001240.jpg`),
// with the same service as Administration → "Foto degli utenti da Koha". Photos already present
// are kept unless `--replace`. Prints counts and the files that match nobody (no names printed).
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { getConfig } from "#lib/server/config/index.js";
import { closeDb, getDb } from "#lib/server/db/index.js";
import { env } from "#lib/server/env.js";
import {
	importPatronPhotos,
	readPhotoFolder,
	readPhotoZip,
} from "#lib/server/services/photo-import.js";

const source = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!source) {
	console.error("usage: bun run patrons:import-photos <folder|file.zip> [--replace]");
	process.exit(2);
}
const path = resolve(source);
const files = statSync(path).isDirectory()
	? readPhotoFolder(path)
	: readPhotoZip(new Uint8Array(await Bun.file(path).arrayBuffer()));
const db = getDb();
try {
	const summary = await importPatronPhotos(db, env().DATA_DIR, files, getConfig().photos, null, {
		replace: process.argv.includes("--replace"),
	});
	console.log(
		`${files.length} file(s): ${summary.imported} imported, ${summary.replaced} replaced, ${summary.kept} kept (photo already present), ${summary.unmatched.length} unmatched, ${summary.unreadable.length} unreadable`,
	);
	for (const name of summary.unmatched) {
		console.log(`unmatched: ${name}`);
	}
	for (const name of summary.unreadable) {
		console.log(`unreadable: ${name}`);
	}
} finally {
	closeDb();
}
