// SPDX-License-Identifier: GPL-3.0-or-later
// Stored pictures (PLAN.md §3.10): book covers and patron photos are kept the same way. An upload
// is checked (not empty, not too large, an image of an accepted format) and re-encoded by the
// owner's encoder, at most `imageConcurrency` at once (step 9.28); the main picture and its
// thumbnail (a quarter of its size) are written atomically under `DATA_DIR/uploads/<folder>/<bucket>/`
// as `<id>-<size>-<version>.<ext>`, the owner's row points at the main file and the files of the
// previous version are removed.
import { ServiceError } from "#lib/server/errors.js";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "#lib/server/db/client.js";
import { writeAtomic } from "#lib/server/runtime/fs.js";
import { imageWork } from "#lib/server/runtime/limit.js";
import { IMAGE_EXTENSION, type ImageFormat } from "./crop.js";

export type MediaErrorCode = "too_large" | "not_an_image" | "unsupported_format" | "empty";

export class MediaError extends ServiceError {
	constructor(override readonly code: MediaErrorCode) {
		super(code, `media: ${code}`);
		this.name = "MediaError";
	}
}

/** The formats an upload may be in (whatever it is stored as). */
export const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "heic", "avif", "gif", "bmp"]);

/** The stored sizes: the divisor of the configured size. */
export const IMAGE_SIZES = { main: 1, thumb: 4 } as const;
export type ImageSize = keyof typeof IMAGE_SIZES;

/** Pixels a picture may have, decoded. */
const MAX_PIXELS = 40_000_000;

export interface ImageMeta {
	width: number;
	height: number;
	format: string;
}

/** Checks an upload: not empty, at most `maxBytes`, an image of one of the `accepted` formats. */
export async function checkUpload(
	input: Uint8Array,
	maxBytes: number,
	accepted: ReadonlySet<string> = ACCEPTED_FORMATS,
): Promise<ImageMeta> {
	if (input.byteLength === 0) {
		throw new MediaError("empty");
	}
	if (input.byteLength > maxBytes) {
		throw new MediaError("too_large");
	}
	let meta: ImageMeta;
	try {
		meta = await new Bun.Image(input, { maxPixels: MAX_PIXELS }).metadata();
	} catch {
		throw new MediaError("not_an_image");
	}
	if (!accepted.has(meta.format)) {
		throw new MediaError("unsupported_format");
	}
	return meta;
}

/**
 * Checks an upload and re-encodes it with `encode` (given the picture's measures and a decoder of
 * the input), under the image work limiter; an encoder that fails is `not_an_image`.
 */
export function encodeUpload(
	input: Uint8Array,
	maxBytes: number,
	encode: (meta: ImageMeta, image: () => Bun.Image) => Promise<Uint8Array>,
): Promise<Uint8Array> {
	// the image work of the profile, `imageConcurrency` jobs at once (step 9.28)
	return imageWork.run(async () => {
		const meta = await checkUpload(input, maxBytes);
		try {
			return await encode(meta, () => new Bun.Image(input, { maxPixels: MAX_PIXELS }));
		} catch {
			throw new MediaError("not_an_image");
		}
	});
}

/** An encoded main picture and its thumbnail, ready to be written. */
export interface EncodedImage {
	main: Uint8Array;
	thumb: Uint8Array;
	format: ImageFormat;
	version: number;
}

/** The row that owns a picture: where its main file's path is read and written. */
export interface ImageOwner {
	/** The folder under `DATA_DIR/uploads`. */
	folder: string;
	/** The stored main path; null when it has none, undefined when the row does not exist. */
	read: (db: Db, id: number) => string | null | undefined;
	/** The row pointed at no picture (and whatever goes with it). */
	clear: (db: Db, id: number) => void;
	/** The error of a row that does not exist. */
	missing: (id: number) => Error;
}

export interface ImageStore {
	/** Writes the main picture and its thumbnail; returns the main file's relative path. */
	writeFiles: (dataDir: string, id: number, image: EncodedImage) => string;
	/** Removes the main file and its thumbnail (same version). */
	removeFiles: (dataDir: string, mainPath: string) => void;
	/** The stored main path of an existing row (null: none); throws the owner's `missing`. */
	current: (db: Db, id: number) => string | null;
	/**
	 * Writes the files, points the row at them with `point` and removes the files of `previous`.
	 * Returns the main file's relative path.
	 */
	replace: (
		db: Db,
		dataDir: string,
		id: number,
		image: EncodedImage & { previous?: string | null },
		point: (mainPath: string) => void,
	) => string;
	/** Clears the row's picture and removes its files; false when it had none. */
	remove: (db: Db, dataDir: string, id: number) => boolean;
	/** Absolute path of the stored picture in the requested size, or null. */
	file: (db: Db, dataDir: string, id: number, size: ImageSize) => string | null;
}

const thumbOf = (mainPath: string): string => mainPath.replace("-main-", "-thumb-");

export function imageStore(owner: ImageOwner): ImageStore {
	// relative to DATA_DIR; two directory levels keep folders small
	const relativePath = (
		id: number,
		size: ImageSize,
		version: number,
		format: ImageFormat,
	): string =>
		join(
			"uploads",
			owner.folder,
			String(id % 100).padStart(2, "0"),
			`${id}-${size}-${version}.${IMAGE_EXTENSION[format]}`,
		);
	const writeFiles: ImageStore["writeFiles"] = (dataDir, id, image) => {
		const mainPath = relativePath(id, "main", image.version, image.format);
		writeAtomic(join(dataDir, mainPath), image.main);
		writeAtomic(
			join(dataDir, relativePath(id, "thumb", image.version, image.format)),
			image.thumb,
		);
		return mainPath;
	};
	const removeFiles: ImageStore["removeFiles"] = (dataDir, mainPath) => {
		for (const p of [mainPath, thumbOf(mainPath)]) {
			const abs = join(dataDir, p);
			if (existsSync(abs)) {
				rmSync(abs, { force: true });
			}
		}
	};
	const current: ImageStore["current"] = (db, id) => {
		const path = owner.read(db, id);
		if (path === undefined) {
			throw owner.missing(id);
		}
		return path;
	};
	return {
		writeFiles,
		removeFiles,
		current,
		replace: (db, dataDir, id, image, point) => {
			const mainPath = writeFiles(dataDir, id, image);
			point(mainPath);
			if (image.previous && image.previous !== mainPath) {
				removeFiles(dataDir, image.previous);
			}
			return mainPath;
		},
		remove: (db, dataDir, id) => {
			const path = current(db, id);
			if (!path) {
				return false;
			}
			owner.clear(db, id);
			removeFiles(dataDir, path);
			return true;
		},
		file: (db, dataDir, id, size) => {
			const path = owner.read(db, id);
			if (!path) {
				return null;
			}
			const abs = join(dataDir, size === "main" ? path : thumbOf(path));
			return existsSync(abs) ? abs : null;
		},
	};
}
