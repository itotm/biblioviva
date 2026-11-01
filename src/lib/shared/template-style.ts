// SPDX-License-Identifier: GPL-3.0-or-later
// The look of a designer element in its `style` attribute (PLAN.md steps 11.10, 11.16): lengths in
// millimetres, font sizes in points, colours, the font families offered, and the text style, fill
// and border read from the declarations and written back changing only what changed. Pure: used by
// the designer in the browser and by the tests.
import { styleValue, withStyle, type StyleDecl } from "./template-html.js";

export const FONTS = {
	sans: "Arial, Helvetica, 'Liberation Sans', 'DejaVu Sans', sans-serif",
	serif: "Georgia, 'DejaVu Serif', 'Liberation Serif', serif",
	mono: "'DejaVu Sans Mono', 'Liberation Mono', monospace",
} as const;
export type FontName = keyof typeof FONTS;
export type Align = "left" | "center" | "right";

/** The look of a text; `null`: not set on the element (it comes from `style.css` or the face). */
export interface DesignStyle {
	fontSizePt: number | null;
	bold: boolean | null;
	italic: boolean | null;
	uppercase: boolean | null;
	align: Align | null;
	font: FontName | null;
	color: string | null;
}

/** A border the designer edits: one solid line. */
export interface BorderStyle {
	color: string;
	widthMm: number;
}

export const round = (v: number): number => Math.round(v * 100) / 100;
export const mm = (v: number): string => `${round(v)}mm`;

const UNIT_MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, px: 25.4 / 96 };

function toMm(value: string | null): number | null {
	const m = /^(-?\d*\.?\d+)([a-z]*)$/i.exec(value?.trim() ?? "");
	if (!m) {
		return null;
	}
	const n = Number(m[1]);
	const unit = (m[2] ?? "").toLowerCase();
	if (unit === "") {
		return n === 0 ? 0 : null;
	}
	const k = UNIT_MM[unit];
	return k === undefined ? null : n * k;
}

/** A length in millimetres (mm, cm, in, pt, px or a bare 0), or null (percentages, auto…). */
export function lengthMm(value: string | null): number | null {
	const v = toMm(value);
	return v === null ? null : round(v);
}

/** A font size in points, or null. */
function sizePt(value: string | null): number | null {
	const v = toMm(value);
	return v === null || v <= 0 ? null : round((v * 72) / 25.4);
}

/** `#rgb` or `#rrggbb` as `#rrggbb`, or null. */
export function hexColor(value: string | null): string | null {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value?.trim() ?? "");
	if (!m?.[1]) {
		return null;
	}
	const h = m[1].toLowerCase();
	return h.length === 3 ? `#${h.replace(/./g, "$&$&")}` : `#${h}`;
}

/** The family a `font-family` list belongs to. */
export function fontOf(value: string): FontName {
	const families = value
		.toLowerCase()
		.split(",")
		.map((f) => f.trim().replace(/^["']|["']$/g, ""));
	if (families.some((f) => f.includes("mono") || f === "courier" || f === "courier new")) {
		return "mono";
	}
	if (
		families.some(
			(f) =>
				f === "serif" ||
				(f.includes("serif") && !f.includes("sans")) ||
				f === "georgia" ||
				f.startsWith("times"),
		)
	) {
		return "serif";
	}
	return "sans";
}

/** An image of `assets/` named in a value: `{{#asset}}file{{/asset}}`. */
export const ASSET = /\{\{#asset\}\}([\w.-]+)\{\{\/asset\}\}/;

export function readStyle(decls: StyleDecl[]): DesignStyle {
	const weight = styleValue(decls, "font-weight");
	const fontStyle = styleValue(decls, "font-style");
	const transform = styleValue(decls, "text-transform");
	const align = styleValue(decls, "text-align");
	const family = styleValue(decls, "font-family");
	return {
		fontSizePt: sizePt(styleValue(decls, "font-size")),
		bold:
			weight === null
				? null
				: weight === "bold" || weight === "bolder" || Number(weight) >= 600,
		italic: fontStyle === null ? null : fontStyle === "italic" || fontStyle === "oblique",
		uppercase: transform === null ? null : transform === "uppercase",
		align: align === "left" || align === "center" || align === "right" ? align : null,
		font: family === null ? null : fontOf(family),
		color: hexColor(styleValue(decls, "color")),
	};
}

/** The fill of a box or the colour of a face: `background-color`, or a `background` of one colour. */
export function readFill(decls: StyleDecl[]): string | null {
	return hexColor(styleValue(decls, "background-color") ?? styleValue(decls, "background"));
}

export function readBorder(decls: StyleDecl[]): BorderStyle | null {
	const m = /^(\d*\.?\d+mm)\s+solid\s+(#[0-9a-f]{3,6})$/i.exec(
		styleValue(decls, "border")?.trim() ?? "",
	);
	const width = lengthMm(m?.[1] ?? null);
	const color = hexColor(m?.[2] ?? null);
	return width === null || color === null ? null : { color, widthMm: width };
}

export function writeStyle(decls: StyleDecl[], now: DesignStyle, was: DesignStyle): StyleDecl[] {
	let out = decls;
	const set = <K extends keyof DesignStyle>(
		key: K,
		prop: string,
		value: (v: NonNullable<DesignStyle[K]>) => string,
	): void => {
		const v = now[key];
		if (v !== was[key]) {
			out = withStyle(out, prop, v === null ? null : value(v));
		}
	};
	set("font", "font-family", (f) => FONTS[f]);
	set("fontSizePt", "font-size", (v) => `${round(v)}pt`);
	set("bold", "font-weight", (b) => (b ? "700" : "400"));
	set("italic", "font-style", (b) => (b ? "italic" : "normal"));
	set("uppercase", "text-transform", (b) => (b ? "uppercase" : "none"));
	set("align", "text-align", (a) => a);
	set("color", "color", (c) => c);
	return out;
}

export function writeFill(
	decls: StyleDecl[],
	fill: string | null,
	was: string | null,
): StyleDecl[] {
	if (fill === was) {
		return decls;
	}
	// a `background` of one colour gives way to the longhand
	const lone = hexColor(styleValue(decls, "background")) !== null;
	return withStyle(lone ? withStyle(decls, "background", null) : decls, "background-color", fill);
}
