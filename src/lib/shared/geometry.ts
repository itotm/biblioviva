// SPDX-License-Identifier: GPL-3.0-or-later
// The plane geometry shared by the picture tools (cover straightening, the frames of class
// pictures in the browser and on the server): points and quadrilaterals in a picture's pixels
// (y downwards). Small on purpose, so a component that only draws a frame does not load the
// detection code.

export interface Point {
	x: number;
	y: number;
}

/** Four corners in the order top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/** The distance between two points. */
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** An upright rectangle as a quad, from any two opposite corners (a frame the operator draws). */
export function rectQuad(a: Point, b: Point): Quad {
	const x0 = Math.min(a.x, b.x);
	const x1 = Math.max(a.x, b.x);
	const y0 = Math.min(a.y, b.y);
	const y1 = Math.max(a.y, b.y);
	return [
		{ x: x0, y: y0 },
		{ x: x1, y: y0 },
		{ x: x1, y: y1 },
		{ x: x0, y: y1 },
	];
}
