// SPDX-License-Identifier: GPL-3.0-or-later
// Book covers (PLAN.md step 3.7, §3.10): the straightened photo (or a downloaded image, 3.7b)
// re-encoded with Bun.Image at `covers.width` (600 px) plus a 150 px thumbnail, written under
// DATA_DIR/uploads/covers (the stored-image module), with the provenance in `biblio.cover_source`.
import { demoPicture } from "#lib/server/demo/content.js";
import { eq } from "drizzle-orm";
import type { Db } from "#lib/server/db/client.js";
import { biblio } from "#lib/server/db/schema.js";
import { audit, type AuditActor } from "./audit.js";
import { BiblioNotFoundError } from "./catalog.js";
import type { ImageFormat } from "#lib/server/images/crop.js";
import { encodeUpload, IMAGE_SIZES, imageStore, type ImageSize } from "#lib/server/images/store.js";

export interface CoverSettings {
	width: number;
	/** Optional cap on the height (step 3.11). */
	maxHeight?: number | null;
	/** Stored format (step 3.11); WebP when omitted. */
	format?: ImageFormat;
	quality: number;
	maxUploadBytes: number;
}

export const COVER_SIZES = IMAGE_SIZES;
export type CoverSize = ImageSize;
export type CoverSource = "photo" | "upload" | "googlebooks" | "amazon" | "openlibrary" | "mock";

const covers = imageStore({
	folder: "covers",
	read: (db, id) =>
		db.select({ coverPath: biblio.coverPath }).from(biblio).where(eq(biblio.id, id)).get()
			?.coverPath,
	clear: (db, id) => {
		db.update(biblio)
			.set({ coverPath: null, coverSource: null, updatedAt: new Date().toISOString() })
			.where(eq(biblio.id, id))
			.run();
	},
	missing: (id) => new BiblioNotFoundError(id),
});

/**
 * Re-encodes the image in the configured format at the configured width, the height following
 * the proportions (covers are never cropped) and capped by `maxHeight` when set.
 */
export function encodeCover(
	input: Uint8Array,
	settings: CoverSettings,
	size: CoverSize = "main",
): Promise<Uint8Array> {
	return encodeUpload(input, settings.maxUploadBytes, async (meta, image) => {
		let width = Math.round(settings.width / COVER_SIZES[size]);
		let height = Math.max(1, Math.round((width * meta.height) / meta.width));
		const maxHeight = settings.maxHeight
			? Math.round(settings.maxHeight / COVER_SIZES[size])
			: null;
		if (maxHeight !== null && height > maxHeight) {
			height = maxHeight;
			width = Math.max(1, Math.round((height * meta.width) / meta.height));
		}
		const resized = image().resize(width, height, { fit: "fill" });
		return await (
			settings.format === "jpeg"
				? resized.jpeg({ quality: settings.quality })
				: resized.webp({ quality: settings.quality })
		).bytes();
	});
}

/** Stores main + thumbnail, points the record at the new file and removes the previous one. */
export async function saveCover(
	db: Db,
	dataDir: string,
	biblioId: number,
	sent: Uint8Array,
	settings: CoverSettings,
	actor: AuditActor,
	source: CoverSource = "photo",
	/**
	 * `fetched`: the server downloaded the bytes from a provider itself; `sent`: they came from the
	 * browser, whatever `source` it names (a browser can name any provider).
	 */
	origin: "fetched" | "sent" = "sent",
): Promise<{ path: string; bytes: number }> {
	// in the public demo only the covers the server fetched (from the mock provider) are kept;
	// a picture the browser sent becomes the demo's placeholder (Q121)
	const input = origin === "sent" ? await demoPicture(sent) : sent;
	const previous = covers.current(db, biblioId);
	const [main, thumb] = await Promise.all([
		encodeCover(input, settings, "main"),
		encodeCover(input, settings, "thumb"),
	]);
	const format = settings.format ?? "webp";
	const mainPath = covers.replace(
		db,
		dataDir,
		biblioId,
		{ main, thumb, format, version: Date.now(), previous },
		(path) => {
			db.update(biblio)
				.set({ coverPath: path, coverSource: source, updatedAt: new Date().toISOString() })
				.where(eq(biblio.id, biblioId))
				.run();
		},
	);
	audit(db, actor, "biblio.cover_upload", "biblio", biblioId, { bytes: main.byteLength, source });
	return { path: mainPath, bytes: main.byteLength };
}

export function deleteCover(db: Db, dataDir: string, biblioId: number, actor: AuditActor): boolean {
	if (!covers.remove(db, dataDir, biblioId)) {
		return false;
	}
	audit(db, actor, "biblio.cover_delete", "biblio", biblioId);
	return true;
}

/** Absolute path of the stored cover in the requested size, or null. */
export function coverFile(
	db: Db,
	dataDir: string,
	biblioId: number,
	size: CoverSize,
): string | null {
	return covers.file(db, dataDir, biblioId, size);
}
