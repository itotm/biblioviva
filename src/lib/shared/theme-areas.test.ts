// SPDX-License-Identifier: GPL-3.0-or-later
// The colours of the areas in the top bar (step 9.16): told apart in every colour set, away from
// the status colours, readable in every style.
import { describe, expect, it } from "vitest";
import { contrastRatio, toHex, type Rgb } from "./color.js";
import {
	AREAS,
	areaColors,
	PALETTES,
	STATUS_TONES,
	surfaceShades,
	THEMES,
	toneShades,
} from "./theme-palette.js";

const WHITE: Rgb = { r: 1, g: 1, b: 1 };

/** The OKLab coordinates of a gamma-encoded sRGB colour: distances follow how different they look. */
function rgbToOklab({ r, g, b }: Rgb): [number, number, number] {
	const lin = (c: number): number =>
		c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	const [R, G, B] = [lin(r), lin(g), lin(b)];
	const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
	const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
	const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

/** The perceptual distance of two colours (OKLab, about 0.02 is the smallest visible step). */
function oklabDistance(a: Rgb, b: Rgb): number {
	const [l1, a1, b1] = rgbToOklab(a);
	const [l2, a2, b2] = rgbToOklab(b);
	return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
const statuses = Object.entries(STATUS_TONES).map(([name, tone]) => ({
	name,
	color: toneShades(tone)[5] ?? WHITE,
}));

describe.each(THEMES)("area colours: %s", (theme) => {
	const palette = PALETTES[theme];
	const colors = AREAS.map((area) => ({ area, ...areaColors(palette, area) }));

	it("keeps every pair of areas clearly apart", () => {
		for (let i = 0; i < colors.length; i++) {
			for (let j = i + 1; j < colors.length; j++) {
				const a = colors[i];
				const b = colors[j];
				if (a && b) {
					expect(
						oklabDistance(a.strong, b.strong),
						`${a.area}/${b.area}: ${toHex(a.strong)} ${toHex(b.strong)}`,
					).toBeGreaterThanOrEqual(0.08);
				}
			}
		}
	});

	it("keeps away from the status colours", () => {
		for (const c of colors) {
			for (const s of statuses) {
				expect(
					oklabDistance(c.strong, s.color),
					`${c.area}/${s.name}`,
				).toBeGreaterThanOrEqual(0.07);
			}
		}
	});

	it("stays readable in every style", () => {
		const ink = surfaceShades(palette.surfaceHue)[10] ?? { r: 0, g: 0, b: 0 };
		for (const c of colors) {
			// the white icon on the band colour (a graphic: 3:1), the white text of the filled bar
			expect(contrastRatio(WHITE, c.strong), `${c.area} icon`).toBeGreaterThanOrEqual(3);
			expect(contrastRatio(WHITE, c.deep), `${c.area} filled`).toBeGreaterThanOrEqual(4.5);
			// the white name of the current item of the sidebar
			expect(contrastRatio(WHITE, c.nav), `${c.area} menu`).toBeGreaterThanOrEqual(4.5);
			// the page title on the tinted bar, the area's text on its tint (phone bottom bar)
			expect(contrastRatio(ink, c.tint), `${c.area} tinted`).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(c.text, c.tint), `${c.area} text`).toBeGreaterThanOrEqual(4.5);
		}
	});
});
