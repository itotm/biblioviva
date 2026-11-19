// SPDX-License-Identifier: GPL-3.0-or-later
// The address of a pictogram, in a module of its own: the pages that show one (the catalogue list)
// do not load the rest of the classification code with it.

/**
 * The URL of a genre's or class's pictogram (§3.17), versioned by its image file and colour so a
 * change made in the classification editor shows at once despite the browser cache.
 */
export function pictogramSrc(node: {
	code: string;
	image?: string | null;
	color?: string | null;
}): string {
	const version = node.image ?? node.color ?? "";
	return `/media/classification/${encodeURIComponent(node.code)}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}
