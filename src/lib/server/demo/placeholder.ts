// SPDX-License-Identifier: GPL-3.0-or-later
// The picture the public demo stores instead of the one a visitor sends (PLAN.md step 9.17, Q121,
// ADR-035): "DEMO" with the date and time of the save, drawn with a 5 × 7 bitmap font into an RGB
// image and handed to `Bun.Image` as a BMP, so no library draws text. Portrait 600 × 800: the
// photo, cover and pictogram pipelines crop or scale it like any upload.
import { zonedParts } from "#lib/shared/dates.js";
import { encodeBmp, type RgbImage } from "#lib/server/images/crop.js";

export const PLACEHOLDER_WIDTH = 600;
export const PLACEHOLDER_HEIGHT = 800;

/** The glyphs the placeholder needs, 5 columns × 7 rows. */
const FONT: Record<string, readonly string[]> = {
	"0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
	"1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
	"2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
	"3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
	"4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
	"5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
	"6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
	"7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
	"8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
	"9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
	D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
	E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
	M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
	O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
	"/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
	":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
	" ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

type Rgb = readonly [number, number, number];
const BACKGROUND: Rgb = [224, 242, 254];
const STRIPE: Rgb = [186, 230, 253];
const INK: Rgb = [12, 74, 110];

function fill(image: RgbImage, x: number, y: number, w: number, h: number, colour: Rgb): void {
	for (let row = Math.max(0, y); row < Math.min(image.height, y + h); row++) {
		for (let col = Math.max(0, x); col < Math.min(image.width, x + w); col++) {
			image.rgb.set(colour, (row * image.width + col) * 3);
		}
	}
}

/** The width of `text` at `scale` (one empty column between glyphs). */
function textWidth(text: string, scale: number): number {
	return text.length * 6 * scale - scale;
}

/** Draws `text` centred horizontally with its top at `y`. */
function drawText(image: RgbImage, text: string, y: number, scale: number): void {
	let x = Math.round((image.width - textWidth(text, scale)) / 2);
	for (const char of text) {
		const glyph = FONT[char] ?? FONT[" "] ?? [];
		glyph.forEach((row, gy) => {
			for (let gx = 0; gx < row.length; gx++) {
				if (row[gx] === "1") {
					fill(image, x + gx * scale, y + gy * scale, scale, scale, INK);
				}
			}
		});
		x += 6 * scale;
	}
}

/** `dd/MM/yyyy` and `HH:mm` on the library's clock. */
export function placeholderStamp(now: Date, timezone: string): { date: string; time: string } {
	const z = zonedParts(now, timezone);
	return {
		date: `${z.day}/${z.month}/${z.year}`,
		time: `${z.hour}:${z.minute}`,
	};
}

/** The placeholder as RGB: light stripes, a frame, "DEMO", the date and the time. */
export function placeholderImage(now: Date, timezone: string): RgbImage {
	const image: RgbImage = {
		width: PLACEHOLDER_WIDTH,
		height: PLACEHOLDER_HEIGHT,
		rgb: new Uint8Array(PLACEHOLDER_WIDTH * PLACEHOLDER_HEIGHT * 3),
	};
	for (let y = 0; y < image.height; y++) {
		for (let x = 0; x < image.width; x++) {
			image.rgb.set((x + y) % 80 < 40 ? BACKGROUND : STRIPE, (y * image.width + x) * 3);
		}
	}
	const frame = 14;
	fill(image, 0, 0, image.width, frame, INK);
	fill(image, 0, image.height - frame, image.width, frame, INK);
	fill(image, 0, 0, frame, image.height, INK);
	fill(image, image.width - frame, 0, frame, image.height, INK);
	const { date, time } = placeholderStamp(now, timezone);
	drawText(image, "DEMO", 190, 16);
	drawText(image, date, 440, 8);
	drawText(image, time, 540, 8);
	return image;
}

/** The placeholder as PNG, the format every picture pipeline accepts. */
export async function placeholderPng(now: Date, timezone: string): Promise<Uint8Array> {
	return new Bun.Image(encodeBmp(placeholderImage(now, timezone))).png().bytes();
}
