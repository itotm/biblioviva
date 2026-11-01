// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { dist, rectQuad } from "./geometry.js";

describe("geometry", () => {
	it("measures the distance between two points", () => {
		expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
		expect(dist({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
	});

	it("turns two opposite corners into an upright quad, in corner order", () => {
		const quad = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 20 },
			{ x: 0, y: 20 },
		];
		expect(rectQuad({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual(quad);
		expect(rectQuad({ x: 10, y: 20 }, { x: 0, y: 0 })).toEqual(quad);
		expect(rectQuad({ x: 10, y: 0 }, { x: 0, y: 20 })).toEqual(quad);
	});
});
