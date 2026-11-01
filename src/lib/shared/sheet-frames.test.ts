// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	quadOf,
	rectOf,
	resizeCorner,
	rotateTowards,
	rotationHandle,
	squareQuad,
} from "./sheet-frames.js";
import type { Quad } from "./geometry.js";

const close = (q: Quad, expected: [number, number][]): void => {
	q.forEach((p, i) => {
		expect(p.x).toBeCloseTo(expected[i]?.[0] ?? NaN, 6);
		expect(p.y).toBeCloseTo(expected[i]?.[1] ?? NaN, 6);
	});
};

const upright: Quad = [
	{ x: 10, y: 20 },
	{ x: 50, y: 20 },
	{ x: 50, y: 80 },
	{ x: 10, y: 80 },
];

describe("frames of a scan", () => {
	it("keeps an upright rectangle as it is", () => {
		expect(rectOf(upright)).toEqual({
			centre: { x: 30, y: 50 },
			width: 40,
			height: 60,
			angle: 0,
		});
		close(squareQuad(upright), [
			[10, 20],
			[50, 20],
			[50, 80],
			[10, 80],
		]);
	});

	it("turns a frame seen in perspective into the closest turned rectangle", () => {
		// a rectangle 40 × 60 turned by 10°, then its corners pushed apart as a photo would
		const turned = quadOf({ centre: { x: 100, y: 100 }, width: 40, height: 60, angle: 0.1745 });
		const skewed: Quad = [
			{ x: turned[0].x - 3, y: turned[0].y },
			{ x: turned[1].x + 3, y: turned[1].y },
			{ x: turned[2].x - 3, y: turned[2].y },
			{ x: turned[3].x + 3, y: turned[3].y },
		];
		const r = rectOf(squareQuad(skewed));
		expect(r.angle).toBeCloseTo(0.1745, 1);
		expect(r.centre.x).toBeCloseTo(100, 6);
		expect(r.centre.y).toBeCloseTo(100, 6);
		const q = squareQuad(skewed);
		// right angles and equal opposite sides
		const side = (a: number, b: number): { x: number; y: number } => ({
			x: (q[b]?.x ?? 0) - (q[a]?.x ?? 0),
			y: (q[b]?.y ?? 0) - (q[a]?.y ?? 0),
		});
		const top = side(0, 1);
		const left = side(0, 3);
		expect(top.x * left.x + top.y * left.y).toBeCloseTo(0, 6);
		expect(Math.hypot(top.x, top.y)).toBeCloseTo(Math.hypot(side(3, 2).x, side(3, 2).y), 6);
	});

	it("drags a corner with the opposite one fixed and the angle kept", () => {
		close(resizeCorner(upright, 2, { x: 70, y: 90 }), [
			[10, 20],
			[70, 20],
			[70, 90],
			[10, 90],
		]);
		// past the opposite corner: still upright, never inside out
		close(resizeCorner(upright, 2, { x: 0, y: 0 }), [
			[0, 0],
			[10, 0],
			[10, 20],
			[0, 20],
		]);
		const turned = quadOf({
			centre: { x: 0, y: 0 },
			width: 20,
			height: 20,
			angle: Math.PI / 4,
		});
		const bigger = rectOf(resizeCorner(turned, 2, { x: 0, y: 30 }));
		expect(bigger.angle).toBeCloseTo(Math.PI / 4, 6);
	});

	it("turns about the centre towards the handle", () => {
		const handle = rotationHandle(upright, 10);
		expect(handle.x).toBeCloseTo(30, 6);
		expect(handle.y).toBeCloseTo(10, 6);
		// the handle pulled to the right of the centre: a quarter turn clockwise
		const r = rectOf(rotateTowards(upright, { x: 100, y: 50 }));
		expect(r.angle).toBeCloseTo(Math.PI / 2, 6);
		expect(r.width).toBeCloseTo(40, 6);
		expect(r.height).toBeCloseTo(60, 6);
		expect(r.centre).toEqual({ x: 30, y: 50 });
	});
});
