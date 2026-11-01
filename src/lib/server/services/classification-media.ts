// SPDX-License-Identifier: GPL-3.0-or-later
// Pictograms of the classification (PLAN.md §3.17): the configured image file of a genre or
// class (children inherit the parent's) from `CONFIG_DIR/classification/images/`, or a generated
// placeholder disc with the node's colour and code when the file is missing (the shipped set is
// generated, step 11.14; a library's own pictograms arrive from the classification editor or with
// `bun run classification:import-images`, step 3.8).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dataUrl, fileDataUrl, imageMimeOf } from "#lib/server/templates/data-url.js";
import { escapeHtml } from "#lib/server/templates/engine.js";
import {
	classOf,
	genreOf,
	type ClassificationScheme,
	type ResolvedNode,
} from "#lib/shared/classification.js";

/** The content type of a pictogram file, or undefined for an extension that is not served. */
export function pictogramMime(name: string): string | undefined {
	return imageMimeOf(name);
}

export interface ClassificationImage {
	node: ResolvedNode;
	/** Absolute path of the file, or null when the placeholder is used. */
	path: string | null;
	mime: string;
}

export function nodeByCode(scheme: ClassificationScheme, code: string): ResolvedNode | null {
	return genreOf(scheme, code) ?? classOf(scheme, code);
}

/** The image to serve for a code, or null when the code is unknown. */
export function classificationImage(
	scheme: ClassificationScheme,
	configDir: string,
	code: string,
): ClassificationImage | null {
	const node = nodeByCode(scheme, code);
	if (!node) {
		return null;
	}
	if (node.image && /^[\w.-]+$/.test(node.image)) {
		const path = join(configDir, "classification", "images", node.image);
		const mime = pictogramMime(node.image);
		if (mime && existsSync(path)) {
			return { node, path, mime };
		}
	}
	return { node, path: null, mime: "image/svg+xml" };
}

/** A round pictogram with the node's colour and its code, legible in black and white too. */
export function placeholderPictogram(node: ResolvedNode): string {
	const color = node.color ?? "#64748b";
	const size = node.code.length > 2 ? 30 : 44;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
		`<circle cx="50" cy="50" r="46" fill="${escapeHtml(color)}" stroke="#1f2937" stroke-width="3"/>` +
		`<text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${size}" fill="#ffffff" stroke="#1f2937" stroke-width="1.2" paint-order="stroke">${escapeHtml(node.code)}</text>` +
		`</svg>`
	);
}

/** A pictogram as a data URL for the printouts: its file, or the node's placeholder. */
export function pictogramUrl(
	node: ResolvedNode,
	file: { path: string; mime: string } | null,
): string {
	return file
		? fileDataUrl(file.path, file.mime)
		: dataUrl(placeholderPictogram(node), "image/svg+xml");
}
