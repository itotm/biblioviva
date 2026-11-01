// SPDX-License-Identifier: GPL-3.0-or-later
// Colour maths used by the theme contrast test and by classification colours (WCAG 2.2).

export interface Rgb {
	r: number;
	g: number;
	b: number;
} // 0..1 linear-ish sRGB components (gamma encoded)

/** Parses `#rgb`, `#rrggbb`, `rgb(r g b)` / `rgb(r, g, b)` or `oklch(L C H)` into gamma-encoded sRGB 0..1. */
export function parseCssColor(input: string): Rgb | null {
	const value = input.trim().toLowerCase();
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
	if (hex) {
		const h = hex[1] ?? "";
		const full =
			h.length === 3
				? h
						.split("")
						.map((c) => c + c)
						.join("")
				: h;
		return {
			r: parseInt(full.slice(0, 2), 16) / 255,
			g: parseInt(full.slice(2, 4), 16) / 255,
			b: parseInt(full.slice(4, 6), 16) / 255,
		};
	}
	const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(value);
	if (rgb) {
		return { r: Number(rgb[1]) / 255, g: Number(rgb[2]) / 255, b: Number(rgb[3]) / 255 };
	}
	const oklch = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/.exec(value);
	if (oklch) {
		let l = Number(oklch[1]);
		if (value.includes("%")) {
			l /= 100;
		}
		return oklchToRgb(l, Number(oklch[2]), Number(oklch[3]));
	}
	return null;
}

/** OKLCH → gamma-encoded sRGB (clamped). */
export function oklchToRgb(L: number, C: number, H: number): Rgb {
	const hr = (H * Math.PI) / 180;
	const a = C * Math.cos(hr);
	const b = C * Math.sin(hr);
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;
	const l = l_ ** 3;
	const m = m_ ** 3;
	const s = s_ ** 3;
	const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
	const gamma = (c: number): number => {
		const x = Math.min(1, Math.max(0, c));
		return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
	};
	return { r: gamma(lr), g: gamma(lg), b: gamma(lb) };
}

/** WCAG relative luminance of a gamma-encoded sRGB colour. */
export function relativeLuminance({ r, g, b }: Rgb): number {
	const lin = (c: number): number =>
		c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21) between two colours. */
export function contrastRatio(a: Rgb, b: Rgb): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

export function toHex({ r, g, b }: Rgb): string {
	const h = (c: number): string =>
		Math.round(Math.min(1, Math.max(0, c)) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${h(r)}${h(g)}${h(b)}`;
}
