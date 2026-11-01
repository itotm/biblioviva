// SPDX-License-Identifier: GPL-3.0-or-later
// The data of the area colours reference page (docs/design/area-colors.html, step 9.16): the
// colours of every set exactly as the app generates them, with the Italian and English names from
// the dictionaries. `bun run themes:generate` writes it into the page between two markers, so the
// page needs no build and opens from the file system.
import { readFileSync } from "node:fs";
import { toHex, type Rgb } from "#lib/shared/color.js";
import {
	AREA_HUES,
	AREA_STYLES,
	AREAS,
	buildTokens,
	SHADES,
	STATUS_TONES,
	THEMES,
	toneShades,
} from "#lib/shared/theme-palette.js";

export const AREA_COLORS_PAGE = "docs/design/area-colors.html";
const START = "<!-- generated:start -->";
const END = "<!-- generated:end -->";
const LOCALES = ["it", "en"] as const;

type Dict = Record<string, unknown>;

function dictionary(locale: string, file: string): Dict {
	return JSON.parse(readFileSync(`src/lib/i18n/${locale}/${file}.json`, "utf8")) as Dict;
}

function pick(dict: Dict, path: string): Record<string, string> {
	let node: unknown = dict;
	for (const part of path.split(".")) {
		node = (node as Dict)[part];
	}
	return node as Record<string, string>;
}

function shade(shades: Rgb[], level: (typeof SHADES)[number]): string {
	const rgb = shades[SHADES.indexOf(level)];
	return rgb ? toHex(rgb) : "#000000";
}

export function areaColorsData(): unknown {
	const labels = Object.fromEntries(
		LOCALES.map((locale) => {
			const nav = dictionary(locale, "nav");
			return [
				locale,
				{
					areas: Object.fromEntries(
						["dashboard", ...AREAS].map((a) => [a, pick(nav, a) as unknown as string]),
					),
					styles: pick(dictionary(locale, "admin"), "appearance.areas.styles"),
					themes: pick(dictionary(locale, "setup"), "theme.names"),
				},
			];
		}),
	);
	const themes = Object.fromEntries(
		THEMES.map((name) => {
			const t = buildTokens(name);
			const primary = t.tones.primary ?? [];
			return [
				name,
				{
					primary: {
						100: shade(primary, 100),
						500: shade(primary, 500),
						700: shade(primary, 700),
						800: shade(primary, 800),
					},
					secondary: shade(t.tones.secondary ?? [], 500),
					surface: {
						50: shade(t.surface, 50),
						200: shade(t.surface, 200),
						800: shade(t.surface, 800),
						950: shade(t.surface, 950),
					},
					areas: Object.fromEntries(
						AREAS.map((a) => {
							const c = t.areas[a];
							return [
								a,
								{
									tint: toHex(c.tint),
									strong: toHex(c.strong),
									nav: toHex(c.nav),
									deep: toHex(c.deep),
									text: toHex(c.text),
								},
							];
						}),
					),
				},
			];
		}),
	);
	return {
		areas: AREAS,
		styles: AREA_STYLES,
		hues: AREA_HUES,
		status: Object.fromEntries(
			Object.entries(STATUS_TONES).map(([k, tone]) => [
				k,
				{ hue: tone.hue, color: shade(toneShades(tone), 500) },
			]),
		),
		labels,
		themes,
	};
}

/** The page with its generated block replaced by the current data. */
export function renderAreaColorsPage(page: string): string {
	const from = page.indexOf(START);
	const to = page.indexOf(END);
	if (from < 0 || to < from) {
		throw new Error(`${AREA_COLORS_PAGE}: generated markers not found`);
	}
	const json = JSON.stringify(areaColorsData(), null, "\t").replaceAll("</", "<\\/");
	const block = `${START}\n<script id="bv-data" type="application/json">\n${json}\n</script>\n`;
	return page.slice(0, from) + block + page.slice(to);
}
