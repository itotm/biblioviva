// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
	cropCentre,
	decodePng,
	encodeBmp,
	encodeCropped,
	ImageDecodeError,
	imageMimeOf,
	type RgbImage,
} from "./crop.js";

/** A PNG built by hand: every row with the given filter (the decoder does not check the CRCs). */
function png(
	width: number,
	height: number,
	colourType: number,
	channels: number,
	filter: number,
	pixel: (x: number, y: number) => number[],
): Uint8Array {
	const rows: number[] = [];
	const raw: number[][] = [];
	for (let y = 0; y < height; y++) {
		const row: number[] = [];
		for (let x = 0; x < width; x++) {
			row.push(...pixel(x, y));
		}
		raw.push(row);
	}
	for (let y = 0; y < height; y++) {
		const row = raw[y] ?? [];
		const prev = raw[y - 1];
		rows.push(filter);
		row.forEach((v, i) => {
			const left = i >= channels ? (row[i - channels] ?? 0) : 0;
			const up = prev ? (prev[i] ?? 0) : 0;
			const upLeft = prev && i >= channels ? (prev[i - channels] ?? 0) : 0;
			const p = left + up - upLeft;
			const pred =
				filter === 0
					? 0
					: filter === 1
						? left
						: filter === 2
							? up
							: filter === 3
								? Math.floor((left + up) / 2)
								: Math.abs(p - left) <= Math.abs(p - up) &&
									  Math.abs(p - left) <= Math.abs(p - upLeft)
									? left
									: Math.abs(p - up) <= Math.abs(p - upLeft)
										? up
										: upLeft;
			rows.push((v - pred) & 0xff);
		});
	}
	const chunk = (type: string, data: Uint8Array): Uint8Array => {
		const out = new Uint8Array(12 + data.length);
		const view = new DataView(out.buffer);
		view.setUint32(0, data.length);
		out.set(new TextEncoder().encode(type), 4);
		out.set(data, 8);
		return out;
	};
	const ihdr = new Uint8Array(13);
	const v = new DataView(ihdr.buffer);
	v.setUint32(0, width);
	v.setUint32(4, height);
	ihdr[8] = 8;
	ihdr[9] = colourType;
	const parts = [
		new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", ihdr),
		chunk("IDAT", new Uint8Array(deflateSync(new Uint8Array(rows)))),
		chunk("IEND", new Uint8Array()),
	];
	return new Uint8Array(Buffer.concat(parts));
}

const colour = (x: number, y: number): number[] => [
	(x * 40) & 0xff,
	(y * 60) & 0xff,
	(x * y * 7) & 0xff,
];

describe("PNG decoding", () => {
	it("reverses the five row filters", () => {
		for (const filter of [0, 1, 2, 3, 4]) {
			const img = decodePng(png(5, 4, 2, 3, filter, colour));
			expect(img).toMatchObject({ width: 5, height: 4 });
			for (let y = 0; y < 4; y++) {
				for (let x = 0; x < 5; x++) {
					expect([...img.rgb.subarray((y * 5 + x) * 3, (y * 5 + x) * 3 + 3)]).toEqual(
						colour(x, y),
					);
				}
			}
		}
	});

	it("expands greyscale and puts transparent pixels on white", () => {
		const grey = decodePng(png(2, 1, 0, 1, 1, (x) => [x * 100]));
		expect([...grey.rgb]).toEqual([0, 0, 0, 100, 100, 100]);
		const greyAlpha = decodePng(png(1, 1, 4, 2, 0, () => [0, 0]));
		expect([...greyAlpha.rgb]).toEqual([255, 255, 255]);
		const rgba = decodePng(
			png(2, 1, 6, 4, 4, (x) => (x === 0 ? [255, 0, 0, 255] : [0, 0, 0, 128])),
		);
		expect([...rgba.rgb.subarray(0, 3)]).toEqual([255, 0, 0]);
		expect(rgba.rgb[3]).toBe(127);
	});

	it("refuses what it does not read", () => {
		expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow(ImageDecodeError);
		const palette = png(1, 1, 3, 1, 0, () => [0]);
		expect(() => decodePng(palette)).toThrow(/colour type 3/);
		// filter byte 9 does not exist
		const idat = png(1, 1, 2, 3, 0, () => [1, 2, 3]);
		const raw = new Uint8Array([9, 1, 2, 3]);
		const patched = Buffer.concat([
			idat.subarray(0, 33),
			(() => {
				const d = new Uint8Array(deflateSync(raw));
				const c = new Uint8Array(12 + d.length);
				new DataView(c.buffer).setUint32(0, d.length);
				c.set(new TextEncoder().encode("IDAT"), 4);
				c.set(d, 8);
				return c;
			})(),
		]);
		expect(() => decodePng(new Uint8Array(patched))).toThrow(/filter 9/);
	});
});

describe("crop and BMP", () => {
	const image: RgbImage = { width: 4, height: 2, rgb: new Uint8Array([...Array(24).keys()]) };

	it("cuts the centre", () => {
		const c = cropCentre(image, 2, 2);
		expect(c).toMatchObject({ width: 2, height: 2 });
		expect([...c.rgb]).toEqual([3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 20]);
		expect(cropCentre(image, 10, 10)).toMatchObject({ width: 4, height: 2 });
	});

	it("writes a BMP that Bun.Image reads back", async () => {
		const bmp = encodeBmp({ width: 3, height: 2, rgb: new Uint8Array(18).fill(200) });
		expect(String.fromCharCode(bmp[0] ?? 0, bmp[1] ?? 0)).toBe("BM");
		expect(await new Bun.Image(bmp).metadata()).toMatchObject({ width: 3, height: 2 });
	});
});

describe("encodeCropped", () => {
	it("gives exactly the requested size whatever the input shape", async () => {
		const landscape = new Uint8Array(readFileSync("tests/fixtures/images/landscape.jpg"));
		for (const [w, h] of [
			[480, 640],
			[300, 300],
			[640, 200],
			[1, 1],
		] as const) {
			const out = await encodeCropped(landscape, {
				width: w,
				height: h,
				format: "jpeg",
				quality: 80,
			});
			expect(await new Bun.Image(out).metadata()).toMatchObject({
				width: w,
				height: h,
				format: "jpeg",
			});
		}
		const webp = await encodeCropped(landscape, {
			width: 60,
			height: 80,
			format: "webp",
			quality: 80,
		});
		expect(await new Bun.Image(webp).metadata()).toMatchObject({
			width: 60,
			height: 80,
			format: "webp",
		});
	});

	it("keeps the centre of the picture", async () => {
		// left half red, right half blue: the centre crop of a wide image is half and half
		const wide = png(40, 10, 2, 3, 0, (x) => (x < 20 ? [255, 0, 0] : [0, 0, 255]));
		const out = await encodeCropped(wide, {
			width: 10,
			height: 10,
			format: "webp",
			quality: 100,
		});
		const back = decodePng(await new Bun.Image(out).png({ compressionLevel: 0 }).bytes());
		const left = back.rgb.subarray((5 * 10 + 1) * 3, (5 * 10 + 1) * 3 + 3);
		const right = back.rgb.subarray((5 * 10 + 8) * 3, (5 * 10 + 8) * 3 + 3);
		expect(left[0]).toBeGreaterThan(200);
		expect(right[2]).toBeGreaterThan(200);
	});

	it("names the type of stored files", () => {
		expect(imageMimeOf("a/1-main-2.jpg")).toBe("image/jpeg");
		expect(imageMimeOf("a/1-main-2.JPEG")).toBe("image/jpeg");
		expect(imageMimeOf("a/1-main-2.webp")).toBe("image/webp");
		expect(imageMimeOf("x.png")).toBe("image/png");
	});
});
