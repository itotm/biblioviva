// SPDX-License-Identifier: GPL-3.0-or-later
// Straightening a photo frame of a class picture on the server (PLAN.md step 13.2): the browser
// finds the frames and sends their corners; the server decodes the stored picture once and maps
// every frame onto an upright photo of exactly the configured size with a perspective transform
// (a homography) and bilinear sampling. Pure TypeScript on the RGB pixels of `crop.ts`, no
// dependency: the crop the operator sees and the photo the patron gets are the same file.
import { dist, type Point, type Quad } from "#lib/shared/geometry.js";
import { decodePng, encodeBmp, type RgbImage } from "./crop.js";

/** Top-left, top-right, bottom-right, bottom-left. */
export type Corners = Quad;

/**
 * The 3 × 3 homography (row-major, h[8] = 1) that maps the unit square's corners (0,0), (1,0),
 * (1,1), (0,1) onto `to`: the classic solution of the eight linear equations, by Gaussian
 * elimination with partial pivoting. Null for a degenerate quadrilateral.
 */
export function unitSquareTo(to: Corners): number[] | null {
	const from: Point[] = [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
		{ x: 0, y: 1 },
	];
	const rows: number[][] = [];
	for (let i = 0; i < 4; i++) {
		const { x, y } = from[i] ?? { x: 0, y: 0 };
		const { x: u, y: v } = to[i] ?? { x: 0, y: 0 };
		rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
		rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
	}
	const n = 8;
	for (let col = 0; col < n; col++) {
		let pivot = col;
		for (let r = col + 1; r < n; r++) {
			if (Math.abs(rows[r]?.[col] ?? 0) > Math.abs(rows[pivot]?.[col] ?? 0)) {
				pivot = r;
			}
		}
		const swap = rows[col] ?? [];
		rows[col] = rows[pivot] ?? [];
		rows[pivot] = swap;
		const p = rows[col]?.[col] ?? 0;
		if (Math.abs(p) < 1e-12) {
			return null;
		}
		const pivotRow = (rows[col] ?? []).map((value) => value / p);
		rows[col] = pivotRow;
		for (let r = 0; r < n; r++) {
			const row = rows[r] ?? [];
			const f = row[col] ?? 0;
			if (r !== col && f !== 0) {
				rows[r] = row.map((value, j) => value - f * (pivotRow[j] ?? 0));
			}
		}
	}
	return [...rows.map((row) => row[n] ?? 0), 1];
}

/** Applies a homography to a point. */
export function applyHomography(h: readonly number[], x: number, y: number): Point {
	const w = (h[6] ?? 0) * x + (h[7] ?? 0) * y + (h[8] ?? 1);
	return {
		x: ((h[0] ?? 0) * x + (h[1] ?? 0) * y + (h[2] ?? 0)) / w,
		y: ((h[3] ?? 0) * x + (h[4] ?? 0) * y + (h[5] ?? 0)) / w,
	};
}

/** The corners moved towards their centre by `fraction` of the way (the frame's border left out). */
export function insetCorners(corners: Corners, fraction: number): Corners {
	const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4;
	return corners.map((p) => ({
		x: p.x + (cx - p.x) * fraction,
		y: p.y + (cy - p.y) * fraction,
	})) as Corners;
}

/**
 * The upright photo of a frame at exactly `width × height`: the frame's own proportions (the
 * average of its opposite sides) are kept and the excess is cut evenly, at the sides when the frame
 * is wider than the photo, at top and bottom when it is taller; pixels sampled bilinearly. Null when
 * the corners do not make a quadrilateral.
 */
export function warpFrame(
	image: RgbImage,
	corners: Corners,
	width: number,
	height: number,
): RgbImage | null {
	const h = unitSquareTo(corners);
	if (!h) {
		return null;
	}
	const [tl, tr, br, bl] = corners;
	const frameW = (dist(tl, tr) + dist(bl, br)) / 2;
	const frameH = (dist(tl, bl) + dist(tr, br)) / 2;
	if (frameW < 1 || frameH < 1) {
		return null;
	}
	const frameAspect = frameH / frameW;
	const photoAspect = height / width;
	// the window of the unit square that has the photo's proportions
	let u0 = 0;
	let v0 = 0;
	let du = 1;
	let dv = 1;
	if (frameAspect > photoAspect) {
		dv = photoAspect / frameAspect;
		v0 = (1 - dv) / 2;
	} else {
		du = frameAspect / photoAspect;
		u0 = (1 - du) / 2;
	}
	const rgb = new Uint8Array(width * height * 3);
	const { width: sw, height: sh, rgb: src } = image;
	for (let j = 0; j < height; j++) {
		const v = v0 + (dv * (j + 0.5)) / height;
		for (let i = 0; i < width; i++) {
			const u = u0 + (du * (i + 0.5)) / width;
			const p = applyHomography(h, u, v);
			// pixel centres at +0.5: clamp inside the picture
			const fx = Math.min(Math.max(p.x - 0.5, 0), sw - 1);
			const fy = Math.min(Math.max(p.y - 0.5, 0), sh - 1);
			const x0 = Math.min(Math.floor(fx), sw - 2 < 0 ? 0 : sw - 2);
			const y0 = Math.min(Math.floor(fy), sh - 2 < 0 ? 0 : sh - 2);
			const x1 = Math.min(x0 + 1, sw - 1);
			const y1 = Math.min(y0 + 1, sh - 1);
			const tx = fx - x0;
			const ty = fy - y0;
			const k00 = (y0 * sw + x0) * 3;
			const k10 = (y0 * sw + x1) * 3;
			const k01 = (y1 * sw + x0) * 3;
			const k11 = (y1 * sw + x1) * 3;
			const out = (j * width + i) * 3;
			for (let c = 0; c < 3; c++) {
				const top = (src[k00 + c] ?? 0) * (1 - tx) + (src[k10 + c] ?? 0) * tx;
				const bottom = (src[k01 + c] ?? 0) * (1 - tx) + (src[k11 + c] ?? 0) * tx;
				rgb[out + c] = Math.round(top * (1 - ty) + bottom * ty);
			}
		}
	}
	return { width, height, rgb };
}

/**
 * Paints a convex quadrilateral of `image` with one colour, in place (Q106: the face of a removed
 * pupil covered in a class picture). `grow` enlarges it from its centre first, so the frame's border
 * and a little around it go too.
 */
export function fillCorners(
	image: RgbImage,
	corners: Corners,
	colour: readonly [number, number, number],
	grow = 0,
): void {
	const quad = grow === 0 ? corners : insetCorners(corners, -grow);
	// the sign of the cross product of every side with the point: the same for an inside point
	const side = (a: Point, b: Point, x: number, y: number): number =>
		(b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
	const orientation = Math.sign(side(quad[0], quad[1], quad[2].x, quad[2].y)) || 1;
	const x0 = Math.max(0, Math.floor(Math.min(...quad.map((p) => p.x))));
	const x1 = Math.min(image.width - 1, Math.ceil(Math.max(...quad.map((p) => p.x))));
	const y0 = Math.max(0, Math.floor(Math.min(...quad.map((p) => p.y))));
	const y1 = Math.min(image.height - 1, Math.ceil(Math.max(...quad.map((p) => p.y))));
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const cx = x + 0.5;
			const cy = y + 0.5;
			let inside = true;
			for (let i = 0; i < 4 && inside; i++) {
				const a = quad[i] ?? quad[0];
				const b = quad[(i + 1) % 4] ?? quad[0];
				inside = side(a, b, cx, cy) * orientation >= 0;
			}
			if (inside) {
				image.rgb.set(colour, (y * image.width + x) * 3);
			}
		}
	}
}

/** Decodes any image `Bun.Image` reads into RGB pixels (through an uncompressed PNG). */
export async function decodeRgb(bytes: Uint8Array, maxPixels = 40_000_000): Promise<RgbImage> {
	const png = await new Bun.Image(bytes, { maxPixels }).png({ compressionLevel: 0 }).bytes();
	return decodePng(png);
}

/** Encodes RGB pixels as JPEG or WebP. */
export async function encodeRgb(
	image: RgbImage,
	format: "jpeg" | "webp",
	quality: number,
): Promise<Uint8Array> {
	const bmp = new Bun.Image(encodeBmp(image));
	return (format === "jpeg" ? bmp.jpeg({ quality }) : bmp.webp({ quality })).bytes();
}
