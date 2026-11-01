// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { RgbImage } from "./crop.js";
import {
	applyHomography,
	decodeRgb,
	encodeRgb,
	fillCorners,
	insetCorners,
	unitSquareTo,
	warpFrame,
	type Corners,
} from "./warp.js";

/** A grey picture with a blue rectangle (rotated by `deg` around its centre) and a red mark top-left inside it. */
function picture(deg: number): { image: RgbImage; corners: Corners } {
	const width = 400;
	const height = 400;
	const rgb = new Uint8Array(width * height * 3).fill(200);
	const t = (deg * Math.PI) / 180;
	const cx = 200;
	const cy = 200;
	const w = 150;
	const h = 200;
	const toLocal = (x: number, y: number): { u: number; v: number } => {
		const dx = x - cx;
		const dy = y - cy;
		return { u: dx * Math.cos(t) + dy * Math.sin(t), v: -dx * Math.sin(t) + dy * Math.cos(t) };
	};
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const { u, v } = toLocal(x + 0.5, y + 0.5);
			if (Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2) {
				const k = (y * width + x) * 3;
				const red = u < -w / 2 + 30 && v < -h / 2 + 30;
				rgb.set(red ? [220, 30, 30] : [30, 60, 200], k);
			}
		}
	}
	const corner = (u: number, v: number): { x: number; y: number } => ({
		x: cx + u * Math.cos(t) - v * Math.sin(t),
		y: cy + u * Math.sin(t) + v * Math.cos(t),
	});
	return {
		image: { width, height, rgb },
		corners: [
			corner(-w / 2, -h / 2),
			corner(w / 2, -h / 2),
			corner(w / 2, h / 2),
			corner(-w / 2, h / 2),
		],
	};
}

const pixel = (image: RgbImage, x: number, y: number): number[] => {
	const k = (y * image.width + x) * 3;
	return [image.rgb[k] ?? 0, image.rgb[k + 1] ?? 0, image.rgb[k + 2] ?? 0];
};

describe("homography", () => {
	it("maps the unit square onto the corners", () => {
		const corners: Corners = [
			{ x: 10, y: 20 },
			{ x: 110, y: 30 },
			{ x: 100, y: 160 },
			{ x: 5, y: 150 },
		];
		const h = unitSquareTo(corners);
		expect(h).not.toBeNull();
		const at = (u: number, v: number): { x: number; y: number } =>
			applyHomography(h ?? [], u, v);
		expect(at(0, 0).x).toBeCloseTo(10);
		expect(at(1, 0).y).toBeCloseTo(30);
		expect(at(1, 1).x).toBeCloseTo(100);
		expect(at(0, 1).y).toBeCloseTo(150);
		// three points on a line make no quadrilateral
		expect(
			unitSquareTo([
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
				{ x: 3, y: 3 },
			]),
		).toBeNull();
	});

	it("insets corners towards the centre", () => {
		const inset = insetCorners(
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 100 },
				{ x: 0, y: 100 },
			],
			0.1,
		);
		expect(inset[0]).toEqual({ x: 5, y: 5 });
		expect(inset[2]).toEqual({ x: 95, y: 95 });
	});
});

describe("warpFrame", () => {
	it("straightens a rotated frame at exactly the photo size, the mark top-left", () => {
		const { image, corners } = picture(12);
		const out = warpFrame(image, insetCorners(corners, 0.02), 60, 80);
		expect(out).not.toBeNull();
		if (!out) {
			return;
		}
		expect([out.width, out.height]).toEqual([60, 80]);
		expect(pixel(out, 3, 3)[0]).toBeGreaterThan(150); // red mark
		expect(pixel(out, 56, 76)[2]).toBeGreaterThan(150); // blue body
		// no grey of the picture inside the photo
		expect(pixel(out, 56, 3)[2]).toBeGreaterThan(150);
	});

	it("cuts a frame wider than the photo at the sides and a taller one at top and bottom", () => {
		const { image, corners } = picture(0);
		// the frame is 150 × 200 (3:4): a square photo cuts top and bottom, the mark disappears
		const square = warpFrame(image, corners, 50, 50);
		expect(square && pixel(square, 2, 2)[2]).toBeGreaterThan(150);
		// a very tall photo cuts the sides: the mark (left 30 px of 150) is gone too
		const tall = warpFrame(image, corners, 20, 80);
		expect(tall && pixel(tall, 1, 1)[2]).toBeGreaterThan(150);
	});

	it("refuses degenerate corners", () => {
		const { image } = picture(0);
		const flat: Corners = [
			{ x: 10, y: 10 },
			{ x: 10, y: 10 },
			{ x: 10, y: 10 },
			{ x: 10, y: 10 },
		];
		expect(warpFrame(image, flat, 30, 40)).toBeNull();
	});
});

describe("decodeRgb / encodeRgb", () => {
	it("round-trips pixels through WebP and JPEG", async () => {
		const { image } = picture(0);
		for (const format of ["webp", "jpeg"] as const) {
			const bytes = await encodeRgb(image, format, 90);
			const back = await decodeRgb(bytes);
			expect([back.width, back.height]).toEqual([400, 400]);
			expect(pixel(back, 200, 200)[2]).toBeGreaterThan(150);
		}
	});
});

describe("fillCorners", () => {
	it("paints a rotated frame and a margin around it, nothing else", () => {
		const { image, corners } = picture(12);
		fillCorners(image, corners, [128, 128, 128], 0.05);
		// the red mark and the blue body are gone
		const out = warpFrame(image, corners, 60, 80);
		expect(out && pixel(out, 3, 3)).toEqual([128, 128, 128]);
		expect(out && pixel(out, 30, 40)).toEqual([128, 128, 128]);
		// far from the frame the picture is as it was
		expect(pixel(image, 2, 2)).toEqual([200, 200, 200]);
	});
});
