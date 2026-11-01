// SPDX-License-Identifier: GPL-3.0-or-later
// The kind of a class picture of the photo census and the geometry of its frames (PLAN.md step
// 13.3), shared by the browser (`SheetPicture`) and the server (`services/class-sheets.ts`). A
// photo is taken at an angle, so a frame is any convex quadrilateral (its corners follow the
// perspective); on a scan the photos lie flat, so a frame is a rectangle that can only be turned.
// Corners are top-left, top-right, bottom-right, bottom-left in the frame's own sense, in the
// picture's pixels (y downwards).
import type { Point, Quad } from "./geometry.js";

export const SHEET_KINDS = ["photo", "scan"] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

/** A turned rectangle: its centre, its sides and the angle of its top side (radians). */
export interface RotatedRect {
	centre: Point;
	width: number;
	height: number;
	angle: number;
}

const turn = (p: Point, angle: number): Point => ({
	x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
	y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/**
 * The rectangle closest to a frame: its centre, the mean direction of its top and bottom sides
 * (and of its left and right sides turned by a quarter), the mean of its widths and heights.
 */
export function rectOf(q: Quad): RotatedRect {
	const [tl, tr, br, bl] = q;
	const top = minus(tr, tl);
	const bottom = minus(br, bl);
	const left = minus(bl, tl);
	const right = minus(br, tr);
	// a side going down, turned a quarter back, points along the top side
	const sum = {
		x: top.x + bottom.x + left.y + right.y,
		y: top.y + bottom.y - left.x - right.x,
	};
	const angle = Math.atan2(sum.y, sum.x);
	const u = { x: Math.cos(angle), y: Math.sin(angle) };
	const v = { x: -u.y, y: u.x };
	const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
	return {
		centre: {
			x: (tl.x + tr.x + br.x + bl.x) / 4,
			y: (tl.y + tr.y + br.y + bl.y) / 4,
		},
		width: Math.abs(dot(top, u) + dot(bottom, u)) / 2,
		height: Math.abs(dot(left, v) + dot(right, v)) / 2,
		angle,
	};
}

/** The corners of a turned rectangle. */
export function quadOf(r: RotatedRect): Quad {
	const w = r.width / 2;
	const h = r.height / 2;
	const at = (x: number, y: number): Point => {
		const p = turn({ x, y }, r.angle);
		return { x: r.centre.x + p.x, y: r.centre.y + p.y };
	};
	return [at(-w, -h), at(w, -h), at(w, h), at(-w, h)];
}

/** A frame as a rectangle that is only turned (a scan): the closest one. */
export const squareQuad = (q: Quad): Quad => quadOf(rectOf(q));

/**
 * A corner of a turned rectangle dragged to `to`: the opposite corner stays, the angle stays, the
 * sides follow (dragged past the opposite corner, the rectangle turns over and stays upright).
 */
export function resizeCorner(q: Quad, index: number, to: Point): Quad {
	const r = rectOf(q);
	const local = (p: Point): Point => turn(minus(p, r.centre), -r.angle);
	const fixed = local(q[(index + 2) % 4] ?? q[0]);
	const moved = local(to);
	const x0 = Math.min(fixed.x, moved.x);
	const x1 = Math.max(fixed.x, moved.x);
	const y0 = Math.min(fixed.y, moved.y);
	const y1 = Math.max(fixed.y, moved.y);
	const mid = turn({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, r.angle);
	return quadOf({
		centre: { x: r.centre.x + mid.x, y: r.centre.y + mid.y },
		width: x1 - x0,
		height: y1 - y0,
		angle: r.angle,
	});
}

/** Where the handle that turns a rectangle sits: above the middle of its top side. */
export function rotationHandle(q: Quad, distance: number): Point {
	const r = rectOf(q);
	const p = turn({ x: 0, y: -r.height / 2 - distance }, r.angle);
	return { x: r.centre.x + p.x, y: r.centre.y + p.y };
}

/** The rectangle turned about its centre so that its handle points at `towards`. */
export function rotateTowards(q: Quad, towards: Point): Quad {
	const r = rectOf(q);
	// the handle is a quarter turn back from the top side's direction
	const angle = Math.atan2(towards.y - r.centre.y, towards.x - r.centre.x) + Math.PI / 2;
	return quadOf({ ...r, angle });
}
