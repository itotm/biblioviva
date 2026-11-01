// SPDX-License-Identifier: GPL-3.0-or-later
// Patron photos from Koha (PLAN.md step 3.9b, Q80): a set of image files named after the card
// number (`0000001240.jpg`, legacy numbers too), from a folder or a ZIP archive, matched to the
// patrons and stored through the ordinary photo service (re-encoded, EXIF dropped, thumbnail).
// Every file is checked before anything is written: an unmatched or unreadable file never leaves
// half an import behind. Shared by `bun run patrons:import-photos` and Administration.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, parse } from "node:path";
import { ne } from "drizzle-orm";
import { unzipSync } from "fflate";
import type { Db } from "#lib/server/db/client.js";
import { patron } from "#lib/server/db/schema.js";
import { audit, type AuditActor } from "./audit.js";
import { encodePhoto, MediaError, savePatronPhoto, type PhotoSettings } from "./media.js";

export interface PhotoFile {
	name: string;
	bytes: Uint8Array;
}

const IMAGE_EXTENSIONS = new Set([
	".jpg",
	".jpeg",
	".png",
	".webp",
	".gif",
	".bmp",
	".heic",
	".avif",
]);

/** The folder where an administrator can drop the exported files (`DATA_DIR/imports/photos/`). */
export function photoImportDir(dataDir: string): string {
	return join(dataDir, "imports", "photos");
}

/** Every regular file of a folder (not recursive), sorted by name. */
export function readPhotoFolder(dir: string): PhotoFile[] {
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.filter((name) => !name.startsWith(".") && statSync(join(dir, name)).isFile())
		.sort()
		.map((name) => ({ name, bytes: new Uint8Array(readFileSync(join(dir, name))) }));
}

/** The files of a ZIP archive (folders inside flattened, hidden and system entries skipped). */
export function readPhotoZip(bytes: Uint8Array): PhotoFile[] {
	const entries = unzipSync(bytes);
	return Object.entries(entries)
		.filter(([path, data]) => !path.endsWith("/") && data.byteLength > 0)
		.map(([path, data]) => ({ name: path.split("/").pop() ?? path, bytes: data }))
		.filter((f) => !f.name.startsWith(".") && !f.name.startsWith("__MACOSX"))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export interface PhotoImportSummary {
	imported: number;
	replaced: number;
	/** Patrons who already had a photo and "sostituisci" was not ticked. */
	kept: number;
	/** File names whose card number matches no patron (downloadable as CSV). */
	unmatched: string[];
	/** File names that are not a readable image. */
	unreadable: string[];
}

/**
 * Matches every file to a patron by card number (the file name without extension), checks that
 * it decodes, then stores the photos. `replace` overwrites existing photos.
 */
export async function importPatronPhotos(
	db: Db,
	dataDir: string,
	files: readonly PhotoFile[],
	settings: PhotoSettings,
	actor: AuditActor | null,
	options: { replace?: boolean } = {},
): Promise<PhotoImportSummary> {
	const byCard = new Map<string, { id: number; hasPhoto: boolean }>();
	for (const p of db
		.select({ id: patron.id, cardNumber: patron.cardNumber, photoPath: patron.photoPath })
		.from(patron)
		.where(ne(patron.status, "anonymized"))
		.all()) {
		if (p.cardNumber) {
			byCard.set(p.cardNumber, { id: p.id, hasPhoto: p.photoPath !== null });
		}
	}
	const summary: PhotoImportSummary = {
		imported: 0,
		replaced: 0,
		kept: 0,
		unmatched: [],
		unreadable: [],
	};
	// phase 1: match and decode every file, write nothing
	const ready: { file: PhotoFile; patronId: number; replacing: boolean }[] = [];
	const seen = new Set<number>();
	for (const file of files) {
		if (!IMAGE_EXTENSIONS.has(extname(file.name).toLowerCase())) {
			summary.unreadable.push(file.name);
			continue;
		}
		const card = parse(file.name).name.replace(/\s+/g, "");
		const match = byCard.get(card);
		if (!match || seen.has(match.id)) {
			summary.unmatched.push(file.name);
			continue;
		}
		try {
			await encodePhoto(file.bytes, settings, "thumb");
		} catch (e) {
			if (!(e instanceof MediaError)) {
				throw e;
			}
			summary.unreadable.push(file.name);
			continue;
		}
		seen.add(match.id);
		if (match.hasPhoto && !options.replace) {
			summary.kept++;
			continue;
		}
		ready.push({ file, patronId: match.id, replacing: match.hasPhoto });
	}
	// phase 2: store them (each through the photo service: files first, then the row)
	for (const r of ready) {
		await savePatronPhoto(db, dataDir, r.patronId, r.file.bytes, settings, actor);
		if (r.replacing) {
			summary.replaced++;
		} else {
			summary.imported++;
		}
	}
	audit(db, actor, "import.photos", "patron", null, {
		imported: summary.imported,
		replaced: summary.replaced,
		kept: summary.kept,
		unmatched: summary.unmatched.length,
		unreadable: summary.unreadable.length,
	});
	return summary;
}
