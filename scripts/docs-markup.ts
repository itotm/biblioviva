// SPDX-License-Identifier: GPL-3.0-or-later
// The few pieces of Markdown handling that the documentation site's build (`site-build.ts`) and its
// check (`site-check.ts`, PLAN.md §3.23) must read the same way: HTML escaping, the text of a piece of
// HTML, the anchor GitHub makes from a heading and the figure marker.

export function esc(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function unesc(text: string): string {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&amp;/g, "&");
}

/** The text of a piece of HTML: tags dropped, entities decoded, white space collapsed. */
export function plain(html: string): string {
	return unesc(html.replace(/<[^>]+>/g, ""))
		.replace(/\s+/g, " ")
		.trim();
}

/** The anchor GitHub makes from a heading: lower case, punctuation dropped, spaces to hyphens. */
export function slug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
		.replace(/ /g, "-");
}

/**
 * A figure marker, `<!-- figure: name | caption -->` (or `screenshot:`, the same for a mock of another
 * program): groups are the kind, the name and the caption (missing: the name is the caption).
 */
export const FIGURE_MARKER_SOURCE = String.raw`<!--\s*(figure|screenshot):\s*([^|]*?)\s*(?:\|\s*([\s\S]*?))?\s*-->`;
