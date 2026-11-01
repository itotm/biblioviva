// SPDX-License-Identifier: GPL-3.0-or-later
// Pictures and fonts inlined into the printed documents as data URLs (PLAN.md §3.12): the assets of
// a template, the patron photo of a card, the pictogram of a spine band. One table of the file types
// served this way, one encoding.
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const MIME: Readonly<Record<string, string>> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".gif": "image/gif",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
};

/** The content type of a file by its extension, or undefined for a type that is not inlined. */
export function mimeOf(name: string): string | undefined {
	return MIME[extname(name).toLowerCase()];
}

/** The content type of a picture by its extension, or undefined for any other file. */
export function imageMimeOf(name: string): string | undefined {
	const mime = mimeOf(name);
	return mime?.startsWith("image/") ? mime : undefined;
}

/** A data URL of bytes, or of a text written as UTF-8 (an SVG). */
export function dataUrl(content: Uint8Array | string, mime: string): string {
	const bytes =
		typeof content === "string"
			? Buffer.from(content)
			: Buffer.from(content.buffer, content.byteOffset, content.byteLength);
	return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** A data URL of a file, its type taken from its extension unless given. */
export function fileDataUrl(
	path: string,
	mime = mimeOf(path) ?? "application/octet-stream",
): string {
	return dataUrl(readFileSync(path), mime);
}
