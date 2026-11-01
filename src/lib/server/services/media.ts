// SPDX-License-Identifier: GPL-3.0-or-later
// Patron photos (PLAN.md step 2.3, §3.10): validate, re-encode with Bun.Image (which also drops
// EXIF/GPS metadata), write atomically under DATA_DIR/uploads/patrons (the stored-image module),
// store the path on the patron.
import { demoPicture } from "#lib/server/demo/content.js";
import { eq } from "drizzle-orm";
import type { Db } from "#lib/server/db/client.js";
import { patron } from "#lib/server/db/schema.js";
import { audit, type AuditActor } from "./audit.js";
import { PatronNotFoundError } from "./patrons.js";
import { encodeCropped, type ImageFormat } from "#lib/server/images/crop.js";
import {
	encodeUpload,
	IMAGE_SIZES,
	imageStore,
	type EncodedImage,
	type ImageSize,
} from "#lib/server/images/store.js";

export { ACCEPTED_FORMATS, MediaError, type MediaErrorCode } from "#lib/server/images/store.js";

export interface PhotoSettings {
	width: number;
	height: number;
	/** Stored format (step 3.11); JPEG when omitted. */
	format?: ImageFormat;
	quality: number;
	maxUploadBytes: number;
}

export const PHOTO_SIZES = IMAGE_SIZES;
export type PhotoSize = ImageSize;

const photos = imageStore({
	folder: "patrons",
	read: (db, id) =>
		db.select({ photoPath: patron.photoPath }).from(patron).where(eq(patron.id, id)).get()
			?.photoPath,
	clear: (db, id) => {
		db.update(patron)
			.set({ photoPath: null, updatedAt: new Date().toISOString() })
			.where(eq(patron.id, id))
			.run();
	},
	missing: (id) => new PatronNotFoundError(id),
});

/**
 * Re-encodes the upload in the configured format at exactly the configured size: the image is
 * scaled to cover it and cropped at the centre when the browser has not cropped it already
 * (Koha photos, files the browser cannot decode). Metadata is not carried over.
 */
export function encodePhoto(
	input: Uint8Array,
	settings: PhotoSettings,
	size: PhotoSize = "main",
): Promise<Uint8Array> {
	const divisor = PHOTO_SIZES[size];
	return encodeUpload(input, settings.maxUploadBytes, () =>
		encodeCropped(input, {
			width: Math.round(settings.width / divisor),
			height: Math.round(settings.height / divisor),
			format: settings.format ?? "webp",
			quality: settings.quality,
		}),
	);
}

export interface StoredPhoto {
	path: string;
	bytes: number;
}

/** Stores main + thumbnail and points the patron at the new main file; the old files are removed. */
export async function savePatronPhoto(
	db: Db,
	dataDir: string,
	patronId: number,
	sent: Uint8Array,
	settings: PhotoSettings,
	/** null for the command line (system actions). */
	actor: AuditActor | null,
): Promise<StoredPhoto> {
	// visitors of the public demo never put faces on a server everyone can see: the demo's
	// placeholder is stored instead (Q121)
	const input = await demoPicture(sent);
	const previous = photos.current(db, patronId);
	const [main, thumb] = await Promise.all([
		encodePhoto(input, settings, "main"),
		encodePhoto(input, settings, "thumb"),
	]);
	const mainPath = storeEncodedPhoto(db, dataDir, patronId, {
		main,
		thumb,
		format: settings.format ?? "webp",
		version: Date.now(),
		previous,
	});
	audit(db, actor, "patron.photo_upload", "patron", patronId, { bytes: main.byteLength });
	return { path: mainPath, bytes: main.byteLength };
}

/** Writes an encoded main + thumbnail pair under DATA_DIR and returns the main file's path. */
export const writePhotoFiles = photos.writeFiles;

/**
 * Writes an already encoded main + thumbnail pair, points the patron at it and removes the
 * previous files. No audit: `savePatronPhoto` records the upload, the demo data (seed) do not.
 */
export function storeEncodedPhoto(
	db: Db,
	dataDir: string,
	patronId: number,
	photo: EncodedImage & { previous?: string | null },
): string {
	return photos.replace(db, dataDir, patronId, photo, (mainPath) => {
		db.update(patron)
			.set({ photoPath: mainPath, updatedAt: new Date().toISOString() })
			.where(eq(patron.id, patronId))
			.run();
	});
}

export function deletePatronPhoto(
	db: Db,
	dataDir: string,
	patronId: number,
	actor: AuditActor,
): boolean {
	if (!photos.remove(db, dataDir, patronId)) {
		return false;
	}
	audit(db, actor, "patron.photo_delete", "patron", patronId);
	return true;
}

/** Removes the main file and its thumbnail (same version). */
export const removePhotoFiles = photos.removeFiles;

/** Absolute path of the requested size of a patron's photo, null when the patron has none. */
export function patronPhotoFile(
	db: Db,
	dataDir: string,
	patronId: number,
	size: PhotoSize,
): string | null {
	return photos.file(db, dataDir, patronId, size);
}
