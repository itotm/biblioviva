// SPDX-License-Identifier: GPL-3.0-or-later
// The figures of the documentation site (PLAN.md §3.23): the picture files of a figure (one for
// each window it was taken in), their size read from the files, and the markup of the figure with
// its Computer / Tablet / Telefono switch (radio buttons and labels, no script; the CSS in
// `site/assets/style.css` shows the picked window, and until one is picked the window closest to
// the reader's screen). Pure functions, so a unit test can check the markup without a build.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WINDOW_SIZES, WINDOWS, type Window } from "../docs/shot-windows.ts";

/** The pixel size of a WebP file (lossy, lossless or extended), `null` when it is not one. */
export function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
	const text = (from: number, to: number): string =>
		String.fromCharCode(...bytes.subarray(from, to));
	if (bytes.length < 30 || text(0, 4) !== "RIFF" || text(8, 12) !== "WEBP") {
		return null;
	}
	const at = (i: number): number => bytes[i] ?? 0;
	switch (text(12, 16)) {
		case "VP8 ":
			return {
				width: (at(26) | (at(27) << 8)) & 0x3fff,
				height: (at(28) | (at(29) << 8)) & 0x3fff,
			};
		case "VP8L": {
			const bits = (at(21) | (at(22) << 8) | (at(23) << 16) | (at(24) << 24)) >>> 0;
			return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
		}
		case "VP8X":
			return {
				width: 1 + (at(24) | (at(25) << 8) | (at(26) << 16)),
				height: 1 + (at(27) | (at(28) << 8) | (at(29) << 16)),
			};
		default:
			return null;
	}
}

/** One picture of a figure: its path on the site and its size in CSS pixels (pixels over scale). */
export interface FigurePicture {
	window: Window;
	src: string;
	width: number;
	height: number;
}

/**
 * The pictures of a figure for a language: the language's own pictures, or the Italian ones when
 * it has none (a figure is never half in one language and half in the other). Empty when the
 * figure has no picture at all.
 */
export function figurePictures(shotsDir: string, lang: string, name: string): FigurePicture[] {
	for (const l of lang === "it" ? ["it"] : [lang, "it"]) {
		const found: FigurePicture[] = [];
		for (const window of WINDOWS) {
			const file = join(shotsDir, l, `${name}.${window}.webp`);
			if (!existsSync(file)) {
				continue;
			}
			const size = webpSize(new Uint8Array(readFileSync(file)));
			if (!size) {
				throw new Error(`${file} is not a WebP picture`);
			}
			const { scale } = WINDOW_SIZES[window];
			found.push({
				window,
				src: `/shots/${l}/${name}.${window}.webp`,
				width: Math.round(size.width / scale),
				height: Math.round(size.height / scale),
			});
		}
		if (found.length > 0) {
			return found;
		}
	}
	return [];
}

/** The reader's screens a figure starts on: wide (a computer), medium (a tablet), narrow (a phone). */
export type Screen = "wide" | "medium" | "narrow";
const SCREENS: Screen[] = ["wide", "medium", "narrow"];
/** The window a screen would like; the figure falls back to the nearest one it has. */
const WANTED: Record<Screen, Window> = { wide: "computer", medium: "tablet", narrow: "phone" };

/** The window a figure shows on a screen before the reader picks one: the wanted one, else the nearest. */
export function startWindow(have: readonly Window[], screen: Screen): Window {
	const wanted = WINDOWS.indexOf(WANTED[screen]);
	const ranked = [...have].sort(
		(a, b) =>
			Math.abs(WINDOWS.indexOf(a) - wanted) - Math.abs(WINDOWS.indexOf(b) - wanted) ||
			// a tie goes towards the bigger window: a picture can be shrunk, not stretched
			WINDOWS.indexOf(a) - WINDOWS.indexOf(b),
	);
	const first = ranked[0];
	if (!first) {
		throw new Error("a figure without a window");
	}
	return first;
}

export interface FigureTexts {
	/** The switch's label for the group ("Schermo"). */
	group: string;
	/** The names of the windows ("Computer", "Tablet", "Telefono"). */
	windows: Record<Window, string>;
}

const ICONS: Record<Window, string> = {
	computer: "monitor",
	tablet: "tablet",
	phone: "smartphone",
};

const escape = (s: string): string =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The frames of a figure: the pictures, and for more than one window the switch above them.
 * `id` makes the radio buttons and labels of this figure unique on the page.
 */
export function figureFrames(
	id: string,
	label: string,
	pictures: readonly FigurePicture[],
	texts: FigureTexts,
): string {
	const alt = escape(label);
	const windows = pictures.map((p) => p.window);
	// the window the print page takes: the computer's, else the first
	const printed = windows.includes("computer") ? "computer" : windows[0];
	const starts = SCREENS.map((screen) => [screen, startWindow(windows, screen)] as const);
	const classesOf = (window: Window): string =>
		[
			...starts.filter(([, w]) => w === window).map(([screen]) => `fig-on-${screen}`),
			...(window === printed ? ["fig-print"] : []),
		].join(" ");
	const frames = pictures
		.map(
			(p) =>
				`<div class="fig-win fig-win-${p.window} ${classesOf(p.window)}"><img src="${p.src}" width="${String(p.width)}" height="${String(p.height)}" alt="${alt}" loading="lazy"></div>`,
		)
		.join("");
	if (pictures.length === 1) {
		return `<div class="fig-frames fig-single">${frames}</div>`;
	}
	const switchHtml = pictures
		.map(
			(p) =>
				`<input type="radio" class="fig-radio fig-radio-${p.window}" name="${id}" id="${id}-${p.window}" value="${p.window}"><label for="${id}-${p.window}" class="${classesOf(p.window)}">[[icon:${ICONS[p.window]}]] ${escape(texts.windows[p.window])}</label>`,
		)
		.join("");
	return `<div class="fig-switch" role="radiogroup" aria-label="${escape(texts.group)}">${switchHtml}</div><div class="fig-frames">${frames}</div>`;
}
