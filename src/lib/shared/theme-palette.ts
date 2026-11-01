// SPDX-License-Identifier: GPL-3.0-or-later
// Colour sets of the app (PLAN.md §3.18, step 2.3a): every theme is a pure palette — hues and
// chroma per tone — expanded here into the Skeleton colour tokens (shades 50…950 plus the contrast
// colour of every shade). Spacing, radius and typography live once in src/lib/theme.css, so
// switching a theme changes colours and nothing else. Status tones (success/warning/error) are the
// same in every set: a colour never changes meaning between themes.
import { contrastRatio, oklchToRgb, toHex, type Rgb } from "./color.js";

export const THEMES = [
	"ocean",
	"forest",
	"grape",
	"sunset",
	"cherry",
	"lagoon",
	"silver",
	"graphite",
	"apricot",
	// added with step 11.13 (owner request)
	"indigo",
	"mint",
	"rose",
	"sahara",
	"wintry",
	"olive",
] as const;
export type ThemeName = (typeof THEMES)[number];
export const DEFAULT_THEME: ThemeName = "ocean";

export interface Tone {
	/** OKLCH hue in degrees. */
	hue: number;
	/** OKLCH chroma of the 500 shade (≈ 0.12 soft … 0.22 vivid). */
	chroma: number;
	/** Lightness offset of the whole ramp (greens need to be a touch darker to carry white text). */
	shift?: number;
	/**
	 * Extra darkening that applies fully from shade 400 on and fades out over shades 300–200, leaving
	 * 50 and 100 untouched, so a charcoal accent keeps near-white tints for hover backgrounds and tiles.
	 */
	deep?: number;
	/** Explicit lightness of the eleven shades, replacing the shared ramp (light grey accents). */
	ramp?: readonly number[];
}

export interface Palette {
	primary: Tone;
	secondary: Tone;
	tertiary: Tone;
	/** Neutral surfaces get a faint tint of this hue. */
	surfaceHue: number;
}

export const STATUS_TONES = {
	success: { hue: 150, chroma: 0.16, shift: -0.03 },
	warning: { hue: 78, chroma: 0.15 },
	error: { hue: 30, chroma: 0.19 },
} as const satisfies Record<string, Tone>;

export const PALETTES: Record<ThemeName, Palette> = {
	ocean: {
		primary: { hue: 255, chroma: 0.19 },
		secondary: { hue: 55, chroma: 0.17 },
		tertiary: { hue: 195, chroma: 0.13 },
		surfaceHue: 250,
	},
	forest: {
		primary: { hue: 152, chroma: 0.15, shift: -0.03 },
		secondary: { hue: 62, chroma: 0.16 },
		tertiary: { hue: 250, chroma: 0.15 },
		surfaceHue: 145,
	},
	grape: {
		primary: { hue: 300, chroma: 0.19 },
		secondary: { hue: 350, chroma: 0.17 },
		tertiary: { hue: 200, chroma: 0.13 },
		surfaceHue: 300,
	},
	sunset: {
		primary: { hue: 45, chroma: 0.17 },
		secondary: { hue: 340, chroma: 0.16 },
		tertiary: { hue: 250, chroma: 0.15 },
		surfaceHue: 55,
	},
	cherry: {
		primary: { hue: 14, chroma: 0.19 },
		secondary: { hue: 82, chroma: 0.15 },
		tertiary: { hue: 250, chroma: 0.15 },
		surfaceHue: 10,
	},
	lagoon: {
		primary: { hue: 200, chroma: 0.14 },
		secondary: { hue: 32, chroma: 0.17 },
		tertiary: { hue: 280, chroma: 0.16 },
		surfaceHue: 200,
	},
	// Light grey: silver accents light enough to carry dark text, a soft blue and a muted teal.
	silver: {
		primary: {
			hue: 250,
			chroma: 0.02,
			ramp: [0.98, 0.95, 0.9, 0.83, 0.74, 0.63, 0.47, 0.41, 0.35, 0.29, 0.23],
		},
		secondary: { hue: 240, chroma: 0.12 },
		tertiary: { hue: 190, chroma: 0.09 },
		surfaceHue: 250,
	},
	// Dark grey: charcoal accents (still on light surfaces — there is no dark mode) with amber.
	graphite: {
		primary: { hue: 260, chroma: 0.015, deep: -0.15 },
		secondary: { hue: 70, chroma: 0.16 },
		tertiary: { hue: 240, chroma: 0.13 },
		surfaceHue: 60,
	},
	// Light orange: apricot accents with a sky blue and a rose beside them.
	apricot: {
		primary: { hue: 65, chroma: 0.15, shift: 0.02 },
		secondary: { hue: 225, chroma: 0.14, shift: -0.02 },
		tertiary: { hue: 345, chroma: 0.13 },
		surfaceHue: 70,
	},
	// Deep blue-violet with amber and teal.
	indigo: {
		primary: { hue: 277, chroma: 0.18 },
		secondary: { hue: 72, chroma: 0.15 },
		tertiary: { hue: 185, chroma: 0.12, shift: -0.03 },
		surfaceHue: 277,
	},
	// Fresh green-teal with coral and blue.
	mint: {
		primary: { hue: 172, chroma: 0.12, shift: -0.04 },
		secondary: { hue: 28, chroma: 0.16 },
		tertiary: { hue: 260, chroma: 0.14 },
		surfaceHue: 172,
	},
	// Rose pink with a leaf green and blue.
	rose: {
		primary: { hue: 358, chroma: 0.17 },
		secondary: { hue: 150, chroma: 0.13, shift: -0.03 },
		tertiary: { hue: 255, chroma: 0.14 },
		surfaceHue: 358,
	},
	// Warm ochre and sand with a desert blue and terracotta.
	sahara: {
		primary: { hue: 70, chroma: 0.12, shift: -0.03 },
		secondary: { hue: 215, chroma: 0.11 },
		tertiary: { hue: 35, chroma: 0.15 },
		surfaceHue: 80,
	},
	// Icy blue with lilac and aqua.
	wintry: {
		primary: { hue: 235, chroma: 0.13 },
		secondary: { hue: 300, chroma: 0.13 },
		tertiary: { hue: 190, chroma: 0.1 },
		surfaceHue: 235,
	},
	// Olive green with tangerine and slate blue.
	olive: {
		primary: { hue: 125, chroma: 0.11, shift: -0.05 },
		secondary: { hue: 50, chroma: 0.15 },
		tertiary: { hue: 245, chroma: 0.12 },
		surfaceHue: 110,
	},
};

/**
 * The areas of the navigation that colour the top bar (step 9.16); the dashboard has none. Each
 * has a fixed hue, the same in every colour set so the colour of an area is learnt once, and a
 * lightness offset; the hues and offsets keep the areas apart from one another and from the status
 * colours (red 30, amber 78, green 150), chosen on the owner's proposals page; Catalogo
 * towards yellow and Utenti towards green at the owner's request, as far as the
 * distance from amber and green and the white text allow. Segnalazioni (9.18) took the hue left
 * with the most room, petrol blue.
 */
export const AREAS = [
	"circulation",
	"catalog",
	"patrons",
	"printing",
	"notes",
	"reports",
	"admin",
] as const;
export type AreaKey = (typeof AREAS)[number];

/** How the top bar shows the area (`ui.areaStyle`, step 9.16). */
export const AREA_STYLES = ["tinted", "filled", "accents", "none"] as const;
export type AreaStyle = (typeof AREA_STYLES)[number];

export const AREA_HUES: Readonly<Record<AreaKey, { hue: number; shift: number; chroma?: number }>> =
	{
		circulation: { hue: 270, shift: 0 },
		catalog: { hue: 105, shift: 0.06 },
		patrons: { hue: 175, shift: 0.03 },
		printing: { hue: 0, shift: -0.07 },
		notes: { hue: 210, shift: -0.06 },
		reports: { hue: 320, shift: 0.035 },
		// anthracite: told apart by being nearly grey and dark
		admin: { hue: 255, shift: -0.14, chroma: 0.03 },
	};

/**
 * The tone of an area in a colour set: its fixed hue, the intensity of the set (the primary
 * chroma × 0.9 within 0.10…0.17) and half of the set's lightness shift.
 */
export function areaTone(palette: Palette, area: AreaKey): Tone {
	const fixed = AREA_HUES[area];
	const chroma = fixed.chroma ?? Math.min(0.17, Math.max(0.1, palette.primary.chroma * 0.9));
	return { hue: fixed.hue, chroma, shift: fixed.shift + (palette.primary.shift ?? 0) * 0.5 };
}

export interface AreaColors {
	/** The light background of the bar (style `tinted`). */
	tint: Rgb;
	/** The band and the page icon. */
	strong: Rgb;
	/** The current item of the sidebar, white text on it. */
	nav: Rgb;
	/** The whole bar of the style `filled`, with white text. */
	deep: Rgb;
	/** Text of the area's colour on its tint (the phone's bottom bar). */
	text: Rgb;
}

export function areaColors(palette: Palette, area: AreaKey): AreaColors {
	const tone = areaTone(palette, area);
	const shades = toneShades(tone);
	const at = (i: number): Rgb => shades[i] ?? { r: 0, g: 0, b: 0 };
	return {
		tint: oklchToRgb(0.955, tone.chroma * 0.24, tone.hue),
		strong: at(5),
		nav: at(6),
		deep: at(7),
		text: at(8),
	};
}

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// Lightness ramp of the coloured tones and the chroma multiplier of each shade.
const TONE_L = [0.97, 0.93, 0.87, 0.79, 0.69, 0.55, 0.48, 0.42, 0.36, 0.3, 0.24];
const TONE_C = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 0.95, 0.85, 0.72, 0.58, 0.45];
// Surfaces: near-white page and cards, light borders, dark readable text.
const SURFACE_L = [0.995, 0.965, 0.92, 0.86, 0.72, 0.58, 0.48, 0.38, 0.3, 0.24, 0.16];
const SURFACE_C = [0.002, 0.005, 0.008, 0.01, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.01];

const WHITE: Rgb = { r: 1, g: 1, b: 1 };

export function toneShades(tone: Tone): Rgb[] {
	return (tone.ramp ?? TONE_L).map((L, i) =>
		oklchToRgb(
			L + (tone.shift ?? 0) + (tone.deep ?? 0) * Math.min(1, Math.max(0, (i - 1) / 3)),
			tone.chroma * (TONE_C[i] ?? 1),
			tone.hue,
		),
	);
}

export function surfaceShades(hue: number): Rgb[] {
	return SURFACE_L.map((L, i) => oklchToRgb(L, SURFACE_C[i] ?? 0.01, hue));
}

/** White or the darkest surface, whichever reads better on the given colour. */
export function contrastOn(background: Rgb, dark: Rgb): { value: string; ratio: number } {
	const white = contrastRatio(WHITE, background);
	const darkRatio = contrastRatio(dark, background);
	return white >= darkRatio
		? { value: "#ffffff", ratio: white }
		: { value: "var(--color-surface-950)", ratio: darkRatio };
}

export interface ThemeTokens {
	name: ThemeName;
	tones: Record<string, Rgb[]>;
	surface: Rgb[];
	areas: Record<AreaKey, AreaColors>;
}

export function buildTokens(name: ThemeName): ThemeTokens {
	const p = PALETTES[name];
	return {
		name,
		surface: surfaceShades(p.surfaceHue),
		areas: Object.fromEntries(AREAS.map((a) => [a, areaColors(p, a)])) as Record<
			AreaKey,
			AreaColors
		>,
		tones: {
			primary: toneShades(p.primary),
			secondary: toneShades(p.secondary),
			tertiary: toneShades(p.tertiary),
			success: toneShades(STATUS_TONES.success),
			warning: toneShades(STATUS_TONES.warning),
			error: toneShades(STATUS_TONES.error),
		},
	};
}

/** The `[data-theme='name'] { … }` block with colour tokens only. */
export function buildThemeCss(name: ThemeName): string {
	const t = buildTokens(name);
	const dark = t.surface[10] ?? { r: 0, g: 0, b: 0 };
	const lines: string[] = [
		`/* SPDX-License-Identifier: GPL-3.0-or-later */`,
		`/* Generated by scripts/generate-themes.ts from src/lib/shared/theme-palette.ts — do not edit. */`,
		`[data-theme="${name}"] {`,
	];
	for (const [tone, shades] of Object.entries(t.tones)) {
		shades.forEach((rgb, i) => lines.push(`\t--color-${tone}-${SHADES[i]}: ${toHex(rgb)};`));
		lines.push(`\t--color-${tone}-contrast-dark: var(--color-surface-950);`);
		lines.push(`\t--color-${tone}-contrast-light: #ffffff;`);
		shades.forEach((rgb, i) =>
			lines.push(`\t--color-${tone}-contrast-${SHADES[i]}: ${contrastOn(rgb, dark).value};`),
		);
	}
	t.surface.forEach((rgb, i) => lines.push(`\t--color-surface-${SHADES[i]}: ${toHex(rgb)};`));
	lines.push(`\t--color-surface-contrast-dark: var(--color-surface-950);`);
	lines.push(`\t--color-surface-contrast-light: var(--color-surface-50);`);
	t.surface.forEach((rgb, i) =>
		lines.push(`\t--color-surface-contrast-${SHADES[i]}: ${contrastOn(rgb, dark).value};`),
	);
	// the colours of the areas in the top bar (step 9.16)
	for (const area of AREAS) {
		const c = t.areas[area];
		lines.push(`\t--bv-area-${area}-tint: ${toHex(c.tint)};`);
		lines.push(`\t--bv-area-${area}-strong: ${toHex(c.strong)};`);
		lines.push(`\t--bv-area-${area}-nav: ${toHex(c.nav)};`);
		lines.push(`\t--bv-area-${area}-deep: ${toHex(c.deep)};`);
		lines.push(`\t--bv-area-${area}-text: ${toHex(c.text)};`);
	}
	lines.push("}", "");
	return lines.join("\n");
}

/** The colour of the browser's title bar for a set (web app manifest, `theme-color`): primary 500. */
export function themeColor(name: ThemeName): string {
	const shade = buildTokens(name).tones.primary?.[SHADES.indexOf(500)];
	return shade ? toHex(shade) : "#ffffff";
}

/** The page background of a set (surface 50), for the splash screen of the installed app. */
export function backgroundColor(name: ThemeName): string {
	const shade = buildTokens(name).surface[0];
	return shade ? toHex(shade) : "#ffffff";
}
