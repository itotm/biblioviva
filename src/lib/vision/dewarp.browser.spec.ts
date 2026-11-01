// SPDX-License-Identifier: GPL-3.0-or-later
// Runs in Chromium (vitest browser project): loads the vendored OpenCV.js once, detects the cover
// in the synthetic fixture photo and straightens it.
import { describe, expect, it } from "vitest";
import fixtureUrl from "../../../tests/fixtures/images/book-angled.jpg?url";
import fixture from "../../../tests/fixtures/images/book-angled.json";
import { detectQuad, warpQuad, type Quad } from "./dewarp.js";
import { isOpenCvLoaded, loadOpenCv } from "./loader.js";

async function loadImage(url: string): Promise<HTMLImageElement> {
	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error(`cannot load ${url}`));
		img.src = url;
	});
	return img;
}

function imageData(img: HTMLImageElement): ImageData {
	const canvas = document.createElement("canvas");
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("no 2d context");
	}
	ctx.drawImage(img, 0, 0);
	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function canvas(width: number, height: number): { ctx: CanvasRenderingContext2D } {
	const element = document.createElement("canvas");
	element.width = width;
	element.height = height;
	const ctx = element.getContext("2d");
	if (!ctx) {
		throw new Error("no 2d context");
	}
	return { ctx };
}

function fillQuad(ctx: CanvasRenderingContext2D, quad: Quad, color: string): void {
	ctx.fillStyle = color;
	ctx.beginPath();
	quad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
	ctx.closePath();
	ctx.fill();
}

/** A wooden table: planks of slightly different browns with grain, dark seams and joints. */
function drawPlanks(ctx: CanvasRenderingContext2D, width: number, height: number): void {
	const browns = [
		"rgb(150, 100, 62)",
		"rgb(163, 111, 70)",
		"rgb(141, 94, 57)",
		"rgb(157, 106, 66)",
	];
	const plank = 104;
	for (let k = 0; k * plank < width; k++) {
		const x0 = k * plank;
		ctx.fillStyle = browns[k % browns.length] ?? "rgb(150, 100, 62)";
		ctx.fillRect(x0, 0, plank, height);
		// grain: wavy darker and lighter lines along the plank
		for (let g = 0; g < 16; g++) {
			ctx.strokeStyle = g % 2 === 0 ? "rgba(90, 55, 30, 0.35)" : "rgba(200, 150, 100, 0.25)";
			ctx.lineWidth = 1 + (g % 3);
			ctx.beginPath();
			for (let y = 0; y <= height; y += 10) {
				const x = x0 + 4 + g * 6.3 + 3 * Math.sin(y / 37 + k * 1.7 + g);
				if (y === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}
			}
			ctx.stroke();
		}
		// the seam on the plank's left and a joint across it
		ctx.fillStyle = "rgb(52, 34, 22)";
		ctx.fillRect(x0, 0, 2, height);
		ctx.fillRect(x0, (k * 233 + 140) % height, plank, 2);
	}
}

function expectCorners(quad: Quad, expected: Quad, tolerance: number): void {
	quad.forEach((p, i) => {
		const e = expected[i] ?? { x: -1, y: -1 };
		expect(Math.hypot(p.x - e.x, p.y - e.y), `corner ${i}`).toBeLessThan(tolerance);
	});
}

describe("cover detection with OpenCV.js", () => {
	it("loads OpenCV once with progress, finds the four corners within tolerance and warps", async () => {
		const progress: number[] = [];
		const cv = await loadOpenCv((p) => progress.push(p.loaded));
		expect(isOpenCvLoaded()).toBe(true);
		expect(progress.length).toBeGreaterThan(1);
		expect(progress.at(-1)).toBeGreaterThan(5_000_000);
		// a second call returns the same module without fetching again
		expect(await loadOpenCv()).toBe(cv);

		const img = await loadImage(fixtureUrl);
		expect(img.naturalWidth).toBe(fixture.width);
		const quad = detectQuad(cv, imageData(img));
		if (!quad) {
			throw new Error("no quadrilateral detected");
		}
		const expected: { x: number; y: number }[] = fixture.corners;
		quad.forEach((p, i) => {
			const e = expected[i] ?? { x: -1, y: -1 };
			expect(Math.hypot(p.x - e.x, p.y - e.y), `corner ${i}`).toBeLessThan(12);
		});

		const out = warpQuad(cv, img, quad, 300);
		expect(out.width).toBe(300);
		// portrait output: the height follows the average of the opposite sides of the quadrilateral
		// (the fixture's projection is synthetic, so the exact 2:3 ratio of the cover is not expected)
		expect(out.height).toBeGreaterThan(300);
		expect(out.height).toBeLessThan(450);
		// the corners of the result are cover (light) pixels, not table (brown) ones
		const ctx = out.getContext("2d");
		const px = (x: number, y: number): number[] =>
			Array.from(ctx?.getImageData(x, y, 1, 1).data ?? []);
		for (const [x, y] of [
			[6, 6],
			[out.width - 7, 6],
			[6, out.height - 7],
			[out.width - 7, out.height - 7],
		] as const) {
			const [r, g, b] = px(x, y);
			expect((r ?? 0) + (g ?? 0) + (b ?? 0), `pixel ${x},${y}`).toBeGreaterThan(500);
		}
	}, 60_000);

	it("finds a cover that barely stands out from the table (9.13, round 11)", async () => {
		const cv = await loadOpenCv();
		// a light cream cover, slightly rotated, on a light beige table: 8 grey levels apart
		const canvas = document.createElement("canvas");
		canvas.width = 600;
		canvas.height = 800;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("no 2d context");
		}
		ctx.fillStyle = "rgb(214, 206, 192)";
		ctx.fillRect(0, 0, 600, 800);
		// a faint wood grain on the table
		for (let y = 0; y < 800; y += 9) {
			ctx.fillStyle = y % 18 === 0 ? "rgb(210, 202, 188)" : "rgb(217, 209, 195)";
			ctx.fillRect(0, y, 600, 4);
		}
		const corners: Quad = [
			{ x: 118, y: 96 },
			{ x: 492, y: 128 },
			{ x: 470, y: 690 },
			{ x: 90, y: 664 },
		];
		ctx.fillStyle = "rgb(226, 220, 196)";
		ctx.beginPath();
		corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.closePath();
		ctx.fill();
		// the title and an illustration on the cover
		ctx.fillStyle = "rgb(60, 60, 90)";
		ctx.fillRect(170, 200, 240, 30);
		ctx.fillStyle = "rgb(180, 120, 90)";
		ctx.fillRect(190, 320, 200, 220);
		const data = ctx.getImageData(0, 0, 600, 800);

		// the standard pass alone misses it; the sensitive ones find it
		expect(detectQuad(cv, data, { passes: ["standard"] })).toBeNull();
		const quad = detectQuad(cv, data);
		if (!quad) {
			throw new Error("no quadrilateral detected");
		}
		quad.forEach((p, i) => {
			const e = corners[i] ?? { x: -1, y: -1 };
			expect(Math.hypot(p.x - e.x, p.y - e.y), `corner ${i}`).toBeLessThan(12);
		});
	});

	it("finds a light cover whose large illustration stands out more than its edge", async () => {
		const cv = await loadOpenCv();
		const { ctx } = canvas(600, 800);
		// a light beige table with a faint grain, and a cream cover 7 grey levels lighter
		ctx.fillStyle = "rgb(210, 202, 186)";
		ctx.fillRect(0, 0, 600, 800);
		for (let y = 0; y < 800; y += 7) {
			ctx.fillStyle = y % 14 === 0 ? "rgb(206, 198, 182)" : "rgb(213, 205, 189)";
			ctx.fillRect(0, y, 600, 3);
		}
		const corners: Quad = [
			{ x: 96, y: 88 },
			{ x: 508, y: 112 },
			{ x: 492, y: 716 },
			{ x: 74, y: 694 },
		];
		fillQuad(ctx, corners, "rgb(219, 211, 192)");
		// a dark picture over a third of the cover: the clearest quadrilateral in the photo
		fillQuad(
			ctx,
			[
				{ x: 150, y: 300 },
				{ x: 450, y: 316 },
				{ x: 440, y: 600 },
				{ x: 134, y: 584 },
			],
			"rgb(70, 60, 90)",
		);
		ctx.fillStyle = "rgb(120, 50, 40)";
		ctx.fillRect(170, 170, 260, 40);
		const data = ctx.getImageData(0, 0, 600, 800);
		const quad = detectQuad(cv, data);
		if (!quad) {
			throw new Error("no quadrilateral detected");
		}
		expectCorners(quad, corners, 6);
	});

	it("finds a cover on a wooden table with plank seams, and nothing on the bare table", async () => {
		const cv = await loadOpenCv();
		const { ctx } = canvas(800, 600);
		drawPlanks(ctx, 800, 600);
		const bare = ctx.getImageData(0, 0, 800, 600);
		const corners: Quad = [
			{ x: 268, y: 92 },
			{ x: 566, y: 128 },
			{ x: 532, y: 528 },
			{ x: 232, y: 494 },
		];
		fillQuad(ctx, corners, "rgb(196, 206, 212)");
		ctx.fillStyle = "rgb(40, 60, 110)";
		ctx.fillRect(300, 170, 220, 34);
		ctx.fillStyle = "rgb(200, 120, 60)";
		ctx.beginPath();
		ctx.arc(400, 340, 80, 0, Math.PI * 2);
		ctx.fill();
		const quad = detectQuad(cv, ctx.getImageData(0, 0, 800, 600));
		if (!quad) {
			throw new Error("no quadrilateral detected");
		}
		expectCorners(quad, corners, 6);
		// planks, seams and joints alone are not a cover: no corners rather than a wrong frame
		let pass: string | null = "not reported";
		expect(detectQuad(cv, bare, { report: (p) => (pass = p) })).toBeNull();
		expect(pass).toBeNull();
	});

	it("returns null on a flat image", async () => {
		const cv = await loadOpenCv();
		const data = new ImageData(200, 200);
		data.data.fill(128);
		expect(detectQuad(cv, data)).toBeNull();
	});
});
