// SPDX-License-Identifier: GPL-3.0-or-later
// Pictograms of the classification (step 11.14): the shipped symbols are generated, not copied from
// any library's own set. Each is a disc in the node's colour with a dark outline and a Lucide icon
// (ISC licence, already a dependency) drawn in white or near-black, whichever reads better on the
// colour, so it stays legible when the spine band is printed in black and white.
import { contrastRatio, parseCssColor } from "./color.js";

/** The Lucide icon of every genre and non-fiction top node of the shipped taxonomy. */
export const PICTOGRAM_ICONS: Readonly<Record<string, string>> = {
	// fiction genres
	A: "book-open",
	B: "castle",
	C: "case-upper",
	D: "compass",
	E: "wand-sparkles",
	F: "swords",
	G: "moon-star",
	H: "rocket",
	I: "search",
	L: "laugh",
	M: "message-circle",
	N: "dices",
	P: "languages",
	R: "drama",
	// non-fiction
	"000": "library",
	"100": "brain",
	"200": "church",
	"300": "users",
	"400": "message-square-text",
	"500": "flask-conical",
	"600": "cog",
	"700": "palette",
	"800": "feather",
	"900": "globe",
	MMM: "landmark",
};

/** One element of a Lucide icon: tag and attributes, on a 24 × 24 grid. */
export type IconNode = readonly (readonly [string, Readonly<Record<string, string | number>>])[];

const DARK = "#1c1917";
const LIGHT = "#ffffff";
const ALLOWED = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
// geometry only: nothing that could load, link or run
const ATTRIBUTES = new Set([
	"d",
	"cx",
	"cy",
	"r",
	"rx",
	"ry",
	"x",
	"y",
	"x1",
	"y1",
	"x2",
	"y2",
	"width",
	"height",
	"points",
]);

const escapeAttribute = (value: string | number): string =>
	String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** White or near-black, whichever reads better on the disc colour. */
export function symbolColour(fill: string): string {
	const background = parseCssColor(fill);
	if (!background) {
		return DARK;
	}
	const dark = parseCssColor(DARK);
	const light = parseCssColor(LIGHT);
	return dark && light && contrastRatio(light, background) >= contrastRatio(dark, background)
		? LIGHT
		: DARK;
}

/** The SVG of a pictogram: 100 × 100, a coloured disc, a dark outline and the icon in the middle. */
export function pictogramSvg(icon: IconNode, fill: string, title: string): string {
	const stroke = symbolColour(fill);
	const shapes = icon
		.filter(([tag]) => ALLOWED.has(tag))
		.map(([tag, attrs]) => {
			const list = Object.entries(attrs)
				.filter(([name]) => ATTRIBUTES.has(name))
				.map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
				.join(" ");
			return `<${tag} ${list}/>`;
		})
		.join("");
	const disc = `<circle cx="50" cy="50" r="46" fill="${escapeAttribute(fill)}" stroke="${DARK}" stroke-width="4"/>`;
	const group = `<g transform="translate(22 22) scale(2.333)" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><title>${escapeAttribute(title)}</title>${disc}${group}${shapes}</g></svg>\n`;
}
