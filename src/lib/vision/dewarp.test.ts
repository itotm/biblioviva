// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	defaultQuad,
	fitLine,
	foregroundMask,
	leastSquares,
	nestedIn,
	orderCorners,
	outputSize,
	pickCandidate,
	polygonArea,
	refineQuad,
	scaleQuad,
	sharesCorner,
	sideContrasts,
	type Candidate,
	type Pixels,
	type Point,
	type Quad,
} from "./dewarp.js";

/** The corners of a w × h rectangle centred on (cx, cy) and rotated clockwise on screen by `deg`. */
function rotatedRect(cx: number, cy: number, w: number, h: number, deg: number): Quad {
	const t = (deg * Math.PI) / 180;
	const corner = (dx: number, dy: number): Point => ({
		x: cx + dx * Math.cos(t) - dy * Math.sin(t),
		y: cy + dx * Math.sin(t) + dy * Math.cos(t),
	});
	return [
		corner(-w / 2, -h / 2),
		corner(w / 2, -h / 2),
		corner(w / 2, h / 2),
		corner(-w / 2, h / 2),
	];
}

/** Signed shoelace area: positive when the points go clockwise on screen (y downwards). */
function signedArea(q: readonly Point[]): number {
	return (
		q.reduce((sum, a, i) => {
			const b = q[(i + 1) % q.length] ?? a;
			return sum + a.x * b.y - b.x * a.y;
		}, 0) / 2
	);
}

/** True when the segments ab and cd cross at a point inside both. */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
	const side = (p: Point, q: Point, r: Point): number =>
		Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
	return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** A simple (not self-intersecting) quadrilateral going clockwise on screen. */
function expectSimpleClockwise(q: Quad): void {
	const [tl, tr, br, bl] = q;
	expect(crosses(tl, tr, br, bl), "top and bottom edges cross").toBe(false);
	expect(crosses(tr, br, bl, tl), "right and left edges cross").toBe(false);
	expect(signedArea(q)).toBeGreaterThan(0);
}

/** Deterministic shuffles (every rotation and its reverse) of four points. */
function orderings(q: readonly Point[]): Point[][] {
	const out: Point[][] = [];
	for (let k = 0; k < 4; k++) {
		const rotated = [...q.slice(k), ...q.slice(0, k)];
		out.push(rotated, [...rotated].reverse());
	}
	return out;
}

/** Small seeded generator (mulberry32) for the property checks. */
function random(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

describe("dewarp geometry", () => {
	it("orders four points clockwise from the top-left whatever the input order", () => {
		const quad = orderCorners([
			{ x: 700, y: 600 },
			{ x: 190, y: 580 },
			{ x: 640, y: 60 },
			{ x: 230, y: 90 },
		]);
		expect(quad).toEqual([
			{ x: 230, y: 90 },
			{ x: 640, y: 60 },
			{ x: 700, y: 600 },
			{ x: 190, y: 580 },
		]);
		expect(() => orderCorners([{ x: 0, y: 0 }])).toThrow(/four/);
	});

	it("keeps the order of upright and slightly rotated covers", () => {
		const upright = rotatedRect(400, 300, 200, 300, 0);
		const tilted = rotatedRect(400, 300, 200, 300, 8);
		const back = rotatedRect(400, 300, 200, 300, -12);
		for (const q of [upright, tilted, back]) {
			for (const input of orderings(q)) {
				expect(orderCorners(input)).toEqual(q);
			}
		}
	});

	it("orders a diamond (a cover at exactly 45 degrees) from its top corner", () => {
		const top = { x: 50, y: 0 };
		const right = { x: 100, y: 50 };
		const bottom = { x: 50, y: 100 };
		const left = { x: 0, y: 50 };
		// top and left tie on x + y: the upper one is the top-left
		for (const input of orderings([left, bottom, right, top])) {
			expect(orderCorners(input)).toEqual([top, right, bottom, left]);
		}
	});

	it("never returns a bow-tie for covers rotated about 45 degrees either way", () => {
		for (const deg of [-46, -45.5, -44.5, -44, 44, 44.5, 45.5, 46]) {
			const q = rotatedRect(500, 400, 300, 420, deg);
			for (const input of orderings(q)) {
				const ordered = orderCorners(input);
				expectSimpleClockwise(ordered);
				// the first corner is the one nearest the top-left of the picture
				const sums = ordered.map((p) => p.x + p.y);
				expect(Math.min(...sums)).toBe(sums[0]);
			}
		}
		// x + y used to take two adjacent corners (left: 396, bottom: 804) as top-left and
		// bottom-right and return left, right, bottom, top: a bow-tie
		const top = { x: 300, y: 100 };
		const right = { x: 500, y: 292 };
		const bottom = { x: 304, y: 500 };
		const left = { x: 100, y: 296 };
		for (const input of orderings([top, right, bottom, left])) {
			expect(orderCorners(input)).toEqual([left, top, right, bottom]);
		}
	});

	it("always returns a simple clockwise quadrilateral starting at the smallest x + y", () => {
		const next = random(20261003);
		for (let n = 0; n < 2000; n++) {
			// a cover at any rotation, foreshortened by a random perspective-like skew
			const q = rotatedRect(
				400 + next() * 400,
				300 + next() * 300,
				50 + next() * 400,
				50 + next() * 600,
				next() * 360 - 180,
			).map((p) => ({ x: p.x + (next() - 0.5) * 40, y: p.y + (next() - 0.5) * 40 })) as Quad;
			const ordered = orderCorners(orderings(q)[n % 8] ?? q);
			expect(new Set(ordered)).toEqual(new Set(q));
			expectSimpleClockwise(ordered);
			const sums = ordered.map((p) => p.x + p.y);
			expect(Math.min(...sums)).toBe(sums[0]);
		}
	});

	it("computes areas, scaled quads, the default inset and the output size", () => {
		const square = defaultQuad(100, 200);
		expect(square).toEqual([
			{ x: 10, y: 20 },
			{ x: 90, y: 20 },
			{ x: 90, y: 180 },
			{ x: 10, y: 180 },
		]);
		expect(polygonArea(square)).toBe(80 * 160);
		expect(scaleQuad(square, 2)[2]).toEqual({ x: 180, y: 360 });
		// a 2:3 cover keeps its ratio at the target width
		expect(outputSize(square, 600)).toEqual({ width: 600, height: 1200 });
		expect(
			outputSize(
				[
					{ x: 0, y: 0 },
					{ x: 0, y: 0 },
					{ x: 0, y: 0 },
					{ x: 0, y: 0 },
				],
				10,
			),
		).toEqual({
			width: 10,
			height: 15,
		});
	});
});

/** True when (x, y) lies inside the convex quad (either winding). */
function inside(q: Quad, x: number, y: number): boolean {
	let sign = 0;
	for (let i = 0; i < 4; i++) {
		const a = q[i] ?? q[0];
		const b = q[(i + 1) % 4] ?? q[0];
		const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
		if (cross !== 0) {
			if (sign !== 0 && Math.sign(cross) !== sign) {
				return false;
			}
			sign = Math.sign(cross);
		}
	}
	return true;
}

/**
 * A `channels`-per-pixel picture: `table(x, y)` everywhere, `cover` inside `quad` (sampled at the
 * pixel centres, 4 × 4 per pixel on the edges so the edge is anti-aliased like a photo).
 */
function picture(
	width: number,
	height: number,
	quad: Quad | null,
	cover: readonly number[],
	table: (x: number, y: number) => readonly number[],
	channels = 4,
): Pixels {
	const data = new Uint8ClampedArray(width * height * channels);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const t = table(x, y);
			let share = 0;
			if (quad) {
				for (let sy = 0; sy < 4; sy++) {
					for (let sx = 0; sx < 4; sx++) {
						share += inside(quad, x + (sx + 0.5) / 4, y + (sy + 0.5) / 4) ? 1 / 16 : 0;
					}
				}
			}
			for (let c = 0; c < channels; c++) {
				data[(y * width + x) * channels + c] =
					c === 3 ? 255 : (cover[c] ?? 0) * share + (t[c] ?? 0) * (1 - share);
			}
		}
	}
	return { width, height, data };
}

const COVER: Quad = [
	{ x: 62.5, y: 48.25 },
	{ x: 231.75, y: 61.5 },
	{ x: 220.25, y: 300.5 },
	{ x: 48.5, y: 286.75 },
];

/** `q` scaled by `f` about its centre. */
function shrink(q: Quad, f: number): Quad {
	const cx = q.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = q.reduce((sum, p) => sum + p.y, 0) / 4;
	return q.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f })) as Quad;
}

function maxCornerError(a: Quad, b: Quad): number {
	return Math.max(...a.map((p, i) => Math.hypot(p.x - (b[i] ?? p).x, p.y - (b[i] ?? p).y)));
}

function candidate(quad: Quad, area: number, contrast: Candidate["contrast"]): Candidate {
	return { quad, area, contrast, pass: "standard", hull: false };
}

describe("cover detection scoring (pure helpers)", () => {
	const plain = (): number[] => [200, 190, 170];
	const light = picture(300, 360, COVER, [214, 206, 180], plain);

	it("measures the colour step across each side of a quadrilateral", () => {
		const step = Math.hypot(14, 16, 10);
		for (const value of sideContrasts(light, COVER)) {
			expect(value).toBeGreaterThan(step * 0.9);
			expect(value).toBeLessThan(step * 1.1);
		}
		// a quadrilateral lying on the table: no step on any side
		const onTable = scaleQuad(COVER, 0.2);
		expect(Math.max(...sideContrasts(light, onTable))).toBeLessThan(1);
		// sides along the border of the photo count as no edge at all
		const frame: Quad = [
			{ x: 1, y: 1 },
			{ x: 299, y: 1 },
			{ x: 299, y: 359 },
			{ x: 1, y: 359 },
		];
		expect(sideContrasts(light, frame)).toEqual([0, 0, 0, 0]);
	});

	it("snaps a rough or finger-cut quadrilateral onto the cover's edges", () => {
		const rough = COVER.map((p, i) => ({
			x: p.x + ([3, -2, 2.5, -3][i] ?? 0),
			y: p.y + ([2, 3, -2, -2.5][i] ?? 0),
		})) as Quad;
		expect(maxCornerError(refineQuad(light, rough), COVER)).toBeLessThan(0.5);
		// a finger over the top-right corner: the contour cut it short by 18 px
		const cut = [...COVER] as Quad;
		cut[1] = { x: COVER[1].x - 14, y: COVER[1].y + 11 };
		expect(maxCornerError(refineQuad(light, cut), COVER)).toBeLessThan(0.5);
		// nothing to snap to on a flat picture: the quadrilateral is kept
		const flat = picture(300, 360, null, [0, 0, 0], plain);
		expect(maxCornerError(refineQuad(flat, rough), rough)).toBeLessThan(1e-9);
	});

	it("fits a line through points despite outliers", () => {
		const points = Array.from({ length: 30 }, (_, i) => ({ x: i * 4, y: 10 + i * 2 }));
		points.push({ x: 20, y: 80 }, { x: 60, y: -30 }, { x: 90, y: 5 });
		const line = fitLine(points);
		if (!line) {
			throw new Error("no line");
		}
		expect(Math.abs(line.d.y / line.d.x - 0.5)).toBeLessThan(1e-9);
		expect(fitLine(points.slice(0, 3))).toBeNull();
	});

	it("solves least squares and models the table under uneven light", () => {
		const coefficients = leastSquares(
			[
				[1, 0],
				[1, 1],
				[1, 2],
				[1, 3],
			],
			[1, 3, 5, 7],
		);
		expect(coefficients[0]).toBeCloseTo(1, 4);
		expect(coefficients[1]).toBeCloseTo(2, 4);
		// a light cover 12 levels brighter than a table lit from the left (from 230 down to 150)
		const lit = (x: number): number[] => [230 - x / 4, 220 - x / 4, 200 - x / 4];
		// the cover takes the table's light plus 12 levels
		const shaded = picture(
			320,
			360,
			null,
			[],
			(x, y) => lit(x).map((v) => v + (inside(COVER, x + 0.5, y + 0.5) ? 12 : 0)),
			3,
		);
		const mask = foregroundMask(shaded);
		let hits = 0;
		let wrong = 0;
		for (let y = 0; y < shaded.height; y++) {
			for (let x = 0; x < shaded.width; x++) {
				const on = (mask[y * shaded.width + x] ?? 0) > 0;
				const truth = inside(COVER, x + 0.5, y + 0.5);
				hits += on && truth ? 1 : 0;
				wrong += on !== truth ? 1 : 0;
			}
		}
		expect(hits / polygonArea(COVER)).toBeGreaterThan(0.97);
		expect(wrong / (shaded.width * shaded.height)).toBeLessThan(0.01);
	});

	it("chooses the largest quadrilateral with a colour step along all four sides", () => {
		const inner = shrink(COVER, 0.8);
		const frame = defaultQuad(300, 360);
		const cover = candidate(COVER, 0.38, [30, 28, 25, 31]);
		const art = candidate(inner, 0.24, [120, 110, 130, 125]);
		const texture = candidate(frame, 0.9, [60, 0, 0, 12]);
		expect(pickCandidate([art, texture, cover])).toBe(cover);
		expect(pickCandidate([texture])).toBeNull();
		expect(pickCandidate([])).toBeNull();
		// a printed frame inset on all four sides does not replace the cover
		const printed = candidate(shrink(COVER, 0.94), 0.36, [90, 90, 90, 90]);
		expect(sharesCorner(printed.quad, COVER)).toBe(false);
		expect(pickCandidate([cover, printed])).toBe(cover);
		// a soft shadow along the right side widened the outline: the sharper one inside wins
		const withShadow: Quad = [COVER[0], { x: 241, y: 62 }, { x: 229, y: 301 }, COVER[3]];
		const shadowed = candidate(withShadow, 0.4, [30, 9, 25, 31]);
		expect(nestedIn(COVER, withShadow)).toBe(true);
		expect(nestedIn(withShadow, COVER)).toBe(false);
		expect(pickCandidate([shadowed, cover])).toBe(cover);
	});
});
