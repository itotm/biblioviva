// SPDX-License-Identifier: GPL-3.0-or-later
// The pictogram files of the classification taxonomy editor (PLAN.md step 11.1): the images of
// `CONFIG_DIR/classification/images/` the nodes can choose, and the uploads staged in
// `DATA_DIR/tmp/pictograms` (re-encoded as PNG, `draft:<token>` in the draft) until the taxonomy
// is saved (`saveTaxonomy`, taxonomy.ts).
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { demoPicture } from "#lib/server/demo/content.js";
import { encodePng } from "#lib/server/images/png.js";

export const IMAGES_DIR = "classification/images";
export const PICTOGRAM_MAX_SIDE = 512;
export const PICTOGRAM_MAX_BYTES = 5_000_000;
const STAGING_DIR = join("tmp", "pictograms");
const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN = /^[a-f0-9]{32}$/;
/** The files the pictogram route serves (§3.17). */
export const IMAGE_FILE = /^[\w.-]+\.(png|jpe?g|webp|svg|gif)$/i;

/** The image files of `classification/images/`, for the "choose an existing image" gallery. */
export function listPictogramFiles(configDir: string): string[] {
	const dir = join(configDir, IMAGES_DIR);
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.filter((f) => IMAGE_FILE.test(f))
		.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/** Absolute path of a staged upload, or null when the token is unknown or malformed. */
export function stagedPictogramPath(dataDir: string, token: string): string | null {
	if (!TOKEN.test(token)) {
		return null;
	}
	const path = join(dataDir, STAGING_DIR, `${token}.png`);
	return existsSync(path) ? path : null;
}

/**
 * Stores an uploaded pictogram (PNG, JPEG or WebP; re-encoded as PNG, longest side at most
 * 512 px) until the taxonomy is saved; returns its token. Staged files older than a day go.
 */
export async function stagePictogram(
	dataDir: string,
	input: Uint8Array,
	now = Date.now(),
): Promise<string> {
	// a staged picture is served to whoever has its address: in the public demo it is the
	// demo's placeholder, never the visitor's picture (Q121)
	const bytes = await encodePng(await demoPicture(input), {
		maxSide: PICTOGRAM_MAX_SIDE,
		maxBytes: PICTOGRAM_MAX_BYTES,
	});
	const dir = join(dataDir, STAGING_DIR);
	mkdirSync(dir, { recursive: true });
	for (const f of readdirSync(dir)) {
		const path = join(dir, f);
		if (now - statSync(path).mtimeMs > STAGING_TTL_MS) {
			rmSync(path, { force: true });
		}
	}
	const token = crypto.randomUUID().replaceAll("-", "");
	writeFileSync(join(dir, `${token}.png`), bytes);
	return token;
}
