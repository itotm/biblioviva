// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import type { Pixels, Quad } from "./dewarp.js";
import {
	aspectOf,
	continuesPastCorner,
	frameScore,
	inkFill,
	insideOf,
	overlapOf,
	paperLevel,
	rectanglesFromRuns,
	readingOrder,
	selectFrames,
	type Frame,
} from "./frames.js";
import { rectQuad } from "#lib/shared/geometry.js";

const rect = (x: number, y: number, w: number, h: number): Quad =>
	rectQuad({ x, y }, { x: x + w, y: y + h });

const frame = (quad: Quad, sides: [number, number, number, number] = [50, 50, 50, 50]): Frame => ({
	quad,
	sides,
});

/** An RGBA picture filled with `background` and the given coloured rectangles. */
function picture(
	width: number,
	height: number,
	background: [number, number, number],
	boxes: { quad: Quad; colour: [number, number, number] }[],
): Pixels {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const box = [...boxes]
				.reverse()
				.find(
					(b) =>
						x >= b.quad[0].x && x < b.quad[2].x && y >= b.quad[0].y && y < b.quad[2].y,
				);
			const c = box?.colour ?? background;
			data.set([...c, 255], (y * width + x) * 4);
		}
	}
	return { width, height, data };
}

describe("frame geometry", () => {
	it("measures the aspect and the overlap, draws rectangles", () => {
		expect(aspectOf(rect(0, 0, 30, 40))).toBeCloseTo(4 / 3);
		expect(aspectOf(rect(0, 0, 0, 0))).toBe(0);
		expect(overlapOf(rect(0, 0, 10, 10), rect(0, 0, 10, 10))).toBeCloseTo(1);
		expect(overlapOf(rect(0, 0, 10, 10), rect(5, 0, 10, 10))).toBeCloseTo(50 / 150);
		// two turned frames sharing their top side to a hundredth of a pixel (9.26): an edge of one
		// almost on an edge of the other must not throw a corner of the clip far away
		const turnedA: Quad = [
			{ x: 399.59910247768534, y: 1249.3457536144667 },
			{ x: 555.85635972716, y: 1176.7829333790692 },
			{ x: 638.9903523500943, y: 1355.5419763906004 },
			{ x: 483.0071765746893, y: 1428.9014468360251 },
		];
		const turnedB: Quad = [
			{ x: 399.56775221610303, y: 1249.3603120640107 },
			{ x: 555.860634049491, y: 1176.7809484672102 },
			{ x: 647.2924865110845, y: 1373.0163615785518 },
			{ x: 490.8402380594129, y: 1445.669385374265 },
		];
		expect(overlapOf(turnedA, turnedB)).toBeGreaterThan(0.9);
		expect(insideOf(turnedA, turnedB)).toBeGreaterThan(0.99);
		expect(overlapOf(rect(0, 0, 10, 10), rect(20, 0, 10, 10))).toBe(0);
		// either orientation of the clip polygon
		const reversed = [...rect(5, 0, 10, 10)].reverse() as Quad;
		expect(overlapOf(rect(0, 0, 10, 10), reversed)).toBeCloseTo(50 / 150);
		expect(frameScore(frame(rect(0, 0, 1, 1), [2, 90, 40, 70]))).toBe(40);
	});

	it("orders frames in rows, top to bottom and left to right", () => {
		const a = frame(rect(300, 10, 100, 130));
		const b = frame(rect(10, 30, 100, 130)); // lower but in the same row
		const c = frame(rect(160, 200, 100, 130));
		const d = frame(rect(20, 210, 100, 130));
		expect(readingOrder([c, a, d, b])).toEqual([b, a, d, c]);
	});
});

describe("selectFrames", () => {
	it("keeps portrait frames with three clear sides and drops the rest", () => {
		const good = frame(rect(0, 0, 100, 130));
		const whiteShirt = frame(rect(200, 0, 100, 130), [60, 60, 1, 60]);
		const twoWeak = frame(rect(400, 0, 100, 130), [60, 2, 1, 60]);
		const landscape = frame(rect(600, 0, 130, 100));
		const tooTall = frame(rect(800, 0, 50, 130));
		expect(selectFrames([good, whiteShirt, twoWeak, landscape, tooTall])).toEqual([
			good,
			whiteShirt,
		]);
		// the aspect window is configurable
		expect(selectFrames([landscape], { minAspect: 0.5, maxAspect: 0.9 })).toEqual([landscape]);
	});

	it("prefers the photo inside a card or a cell, and the whole frame over one cut short", () => {
		const cell = frame(rect(0, 0, 120, 150));
		const tile = frame(rect(10, 10, 100, 130));
		// the coloured part above a white shirt: same top corners, shorter
		const cut = frame(rect(10, 10, 100, 100));
		// the two contours of one edge line, a pixel apart
		const twin = frame(rect(11, 11, 99, 129));
		expect(selectFrames([cell, tile, cut, twin])).toEqual([tile]);
	});

	it("drops sizes far from the others and caps the count, keeping the clearest", () => {
		const row = Array.from({ length: 6 }, (_, i) =>
			frame(rect(i * 150, 0, 100, 130), [50 + i, 50 + i, 50 + i, 50 + i]),
		);
		const detail = frame(rect(20, 400, 30, 40));
		const huge = frame(rect(0, 600, 400, 520));
		expect(selectFrames([...row, detail, huge])).toEqual(row);
		const capped = selectFrames(row, { maxFrames: 2 });
		expect(capped).toEqual([row[4], row[5]]);
		expect(selectFrames([])).toEqual([]);
	});
});

describe("frames drawn by edge runs (a scan)", () => {
	const options = {
		tolerance: 4,
		minWidth: 20,
		maxWidth: 1000,
		minAspect: 1,
		maxAspect: 1.6,
		minCover: 0.5,
	};
	// the photo 100 × 130 at (50, 40): its four sides, the left one broken by a stamp
	const photo = {
		across: [
			{ pos: 40, a: 50, b: 150 },
			{ pos: 170, a: 50, b: 150 },
		],
		down: [
			{ pos: 50, a: 40, b: 90 },
			{ pos: 51, a: 110, b: 170 },
			{ pos: 150, a: 40, b: 170 },
		],
	};

	it("finds the rectangle whose four sides are drawn, whatever touches them", () => {
		// a ruled line of the card starting at the photo's right side, and text strokes
		const across = [...photo.across, { pos: 100, a: 150, b: 400 }, { pos: 60, a: 160, b: 190 }];
		expect(rectanglesFromRuns(across, photo.down, options)).toEqual([
			rect(50.5, 40, 99.5, 130),
		]);
	});

	it("needs every side mostly drawn, and not a line that runs on past both corners", () => {
		const half = { ...options, minCover: 0.9 };
		// the left side covers 110 of 130: not enough at 90 %
		expect(rectanglesFromRuns(photo.across, photo.down, half)).toEqual([]);
		// the top is the edge of a row of cards, on well past both corners
		const row = [{ pos: 40, a: 0, b: 400 }, photo.across[1]!];
		expect(rectanglesFromRuns(row, photo.down, options)).toEqual([]);
		// on past one corner only: a printed line beside the photo
		const beside = [{ pos: 40, a: 50, b: 400 }, photo.across[1]!];
		expect(rectanglesFromRuns(beside, photo.down, options)).toHaveLength(1);
		// the photo glued against the edge of its card: both on one line, the photo's own run
		// stops at its corners
		const glued = [{ pos: 38, a: 0, b: 400 }, { pos: 41, a: 50, b: 150 }, photo.across[1]!];
		expect(rectanglesFromRuns(glued, photo.down, options)).toHaveLength(1);
		// a landscape rectangle is not a photo
		expect(
			rectanglesFromRuns(photo.across, photo.down, { ...options, maxAspect: 1.2 }),
		).toEqual([]);
	});

	it("counts a photo's white background as full on a card that scans grey (a sleeve)", () => {
		// the photo is a small part of the page, as on a real one: the paper is the card's grey
		const px = picture(
			400,
			400,
			[238, 238, 238],
			[{ quad: rect(50, 40, 100, 130), colour: [252, 252, 252] }],
		);
		expect(inkFill(px, rect(50, 40, 100, 130), paperLevel(px))).toBe(1);
	});

	it("tells a photo on its card from the gap between cards", () => {
		const paperWhite: [number, number, number] = [250, 250, 250];
		const px = picture(300, 300, paperWhite, [
			{ quad: rect(50, 40, 100, 130), colour: [200, 190, 180] },
		]);
		const paper = paperLevel(px);
		expect(paper).toBe(250);
		// the photo: full along every side
		expect(inkFill(px, rect(50, 40, 100, 130), paper)).toBe(1);
		// a strip of the card taken in on the right: one side of paper
		expect(inkFill(px, rect(50, 40, 140, 130), paper)).toBe(0);
	});

	it("drops a frame that lies inside a larger one, as a detail of that photo", () => {
		expect(insideOf(rect(10, 10, 20, 20), rect(0, 0, 100, 100))).toBeCloseTo(1);
		expect(insideOf(rect(90, 0, 20, 20), rect(0, 0, 100, 100))).toBeCloseTo(0.5);
		const whole = frame(rect(0, 0, 100, 130));
		// shares a corner with the photo, so not the photo inside a card: a fringe of hair
		const fringe = frame(rect(0, 0, 80, 80 * 1.2));
		const other = frame(rect(200, 0, 100, 130));
		expect(selectFrames([whole, fringe, other])).toEqual([whole, other]);
	});

	it("prefers, of two frames drawn by edge runs about the same size, the one with sharper sides", () => {
		const wide = { ...frame(rect(0, 0, 100, 150), [40, 40, 10, 40]), fill: 0.8 };
		const tight = { ...frame(rect(0, 0, 100, 130), [40, 40, 120, 40]), fill: 0.9 };
		expect(selectFrames([wide, tight])).toEqual([tight]);
		// contours of a photo (no `fill`): the largest stays, as for a white shirt
		expect(selectFrames([frame(rect(0, 0, 100, 150)), frame(rect(0, 0, 100, 130))])).toEqual([
			frame(rect(0, 0, 100, 150)),
		]);
	});
});

describe("continuesPastCorner", () => {
	const paper: [number, number, number] = [245, 245, 245];
	const blue: [number, number, number] = [40, 90, 200];

	it("is false at the real corners of a photo on paper", () => {
		const tile = rect(40, 40, 100, 130);
		const px = picture(220, 240, paper, [{ quad: tile, colour: blue }]);
		expect(continuesPastCorner(px, tile, [200, 200, 200, 200], 8)).toBe(false);
	});

	it("is true for a frame cut short inside a larger coloured region", () => {
		const tile = rect(40, 40, 100, 130);
		const px = picture(220, 240, paper, [{ quad: tile, colour: blue }]);
		// the upper part of the tile only: its left and right edges go on below its bottom corners
		const cut = rect(40, 40, 100, 90);
		expect(continuesPastCorner(px, cut, [200, 200, 3, 200], 8)).toBe(true);
	});

	it("does not follow weak sides (a white border around the photo)", () => {
		const tile = rect(40, 40, 100, 130);
		const px = picture(
			220,
			240,
			[230, 225, 210],
			[
				{ quad: rect(34, 34, 112, 142), colour: [255, 255, 255] },
				{ quad: tile, colour: blue },
			],
		);
		expect(continuesPastCorner(px, tile, [200, 200, 30, 200], 8)).toBe(false);
	});
});
