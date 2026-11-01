// SPDX-License-Identifier: GPL-3.0-or-later
// Cover straightening (PLAN.md step 3.7): find the cover in a photo, let the operator adjust the
// four corners and warp the quadrilateral to an upright rectangle. Detection: several
// passes (edges in grey, edges in colour, difference from the table's colour) propose convex
// quadrilaterals; each side of each one is snapped onto the colour step it follows; the largest one
// with a clear colour step along all four sides wins, and none at all is better than a quadrilateral
// drawn by the table's texture or closed by the border of the photo. The geometry and scoring
// helpers are pure TypeScript; the functions taking `cv` need the lazily loaded OpenCV.js module.
import { dist, type Point, type Quad } from "#lib/shared/geometry.js";
import type { CvModule } from "./loader.js";

// The constants of the OpenCV.js type package (`cv.MORPH_RECT`, `cv.RETR_LIST`, …) are typed `any`.
/* eslint-disable @typescript-eslint/no-unsafe-argument */

export type { Point, Quad };

/** Corner `i` of a quad, counted cyclically. */
const cornerOf = (quad: Quad, i: number): Point => quad[((i % 4) + 4) % 4] ?? quad[0];

/**
 * Orders any four points as top-left, top-right, bottom-right, bottom-left: clockwise on screen
 * (by angle around their centroid, y growing downwards), starting from the top-left corner, the
 * one with the smallest x + y (on a tie, the upper one). Walking the points around the centroid
 * always gives a simple polygon: sorting by x + y alone could pair two adjacent corners of a cover
 * rotated by about 45 degrees and return a self-intersecting ("bow-tie") quadrilateral.
 */
export function orderCorners(points: readonly Point[]): Quad {
	if (points.length !== 4) {
		throw new Error("four points expected");
	}
	const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
	const angle = (p: Point): number => Math.atan2(p.y - cy, p.x - cx);
	const ring = [...points].sort((a, b) => angle(a) - angle(b));
	const start = ring.reduce((best, p, i) => {
		const b = ring[best] ?? p;
		const sum = p.x + p.y;
		const bestSum = b.x + b.y;
		return sum < bestSum || (sum === bestSum && p.y < b.y) ? i : best;
	}, 0);
	return [0, 1, 2, 3].map((k) => ring[(start + k) % 4]) as Quad;
}

/** The default corners when nothing is detected: a rectangle inset by 10 % on each side. */
export function defaultQuad(width: number, height: number): Quad {
	const dx = width * 0.1;
	const dy = height * 0.1;
	return [
		{ x: dx, y: dy },
		{ x: width - dx, y: dy },
		{ x: width - dx, y: height - dy },
		{ x: dx, y: height - dy },
	];
}

/** Shoelace area of a polygon. */
export function polygonArea(points: readonly Point[]): number {
	let area = 0;
	points.forEach((a, i) => {
		const b = points[(i + 1) % points.length] ?? a;
		area += a.x * b.y - b.x * a.y;
	});
	return Math.abs(area) / 2;
}

/**
 * Output size of the straightened cover: the average of the opposite sides keeps the real aspect
 * ratio; the result is scaled to `targetWidth` pixels wide (600 for stored covers).
 */
export function outputSize(quad: Quad, targetWidth: number): { width: number; height: number } {
	const [tl, tr, br, bl] = quad;
	const w = (dist(tl, tr) + dist(bl, br)) / 2;
	const h = (dist(tl, bl) + dist(tr, br)) / 2;
	const ratio = w > 0 ? h / w : 1.5;
	return { width: targetWidth, height: Math.max(1, Math.round(targetWidth * ratio)) };
}

/** Scales a quad between the displayed canvas and the full-size source. */
export function scaleQuad(quad: Quad, factor: number): Quad {
	return quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as Quad;
}

export interface DetectOptions {
	/** Minimum area of the quadrilateral as a fraction of the image (default 0.15). */
	minAreaRatio?: number;
	/** Longest side the image is downscaled to before detection (speed on phones). */
	maxSide?: number;
	/**
	 * The maps that propose quadrilaterals (9.13, round 11): `standard` (grey, Canny
	 * 50/150) finds a cover that stands out; `color` looks for the edge in the colour channels and
	 * in the saturation, for a cover that differs from the table in colour more than in brightness;
	 * `background` models the table's colour from the border of the photo and keeps what differs
	 * from it, for a light cover on a light table and for textured tables (wood with plank seams,
	 * cloth); `equalized` stretches the contrast of the grey image first (not in the default list).
	 * Every pass runs; the candidates of all of them are scored together. Default: `DETECT_PASSES`.
	 */
	passes?: readonly DetectPass[];
	/** Told which pass found the cover (null: none did), for the diagnostic log. */
	report?: (pass: DetectPass | null) => void;
	/** Every scored candidate, in image coordinates (diagnostics and tests only). */
	inspect?: (candidates: readonly Candidate[]) => void;
}

export type DetectPass = "standard" | "equalized" | "color" | "background";
/**
 * The default passes. `equalized` (round 11) is not one of them now that the candidates are
 * scored: on the benchmark photos it found no cover that `color` or `background` did
 * not, and it was the main source of frame-sized false quadrilaterals; it stays available.
 */
export const DETECT_PASSES: readonly DetectPass[] = ["standard", "color", "background"];

/** RGBA pixels, row by row (an `ImageData`, or the data of an OpenCV RGBA `Mat`). */
export interface Pixels {
	width: number;
	height: number;
	data: ArrayLike<number>;
}

/** A quadrilateral proposed by one pass, with the evidence that it is a cover. */
export interface Candidate {
	quad: Quad;
	pass: DetectPass;
	/** Area as a fraction of the image. */
	area: number;
	/** Found through the convex hull of an almost four-sided contour. */
	hull: boolean;
	/** Colour step across each side (top, right, bottom, left), see `sideContrasts`. */
	contrast: [number, number, number, number];
}

/**
 * The colour step across each side of `quad`: along every side (corners excluded), the mean
 * colour of a thin band just inside is compared with a band just outside, in six segments; the
 * side's value is the third smallest segment difference (Euclidean, RGB levels), so a finger or a
 * glare over a corner does not hide a real edge. A segment whose outer band leaves the image counts
 * as 0: the border of the photo is not the edge of a cover. The real cover changes colour along
 * all four sides; a quadrilateral drawn by table texture (plank seams, a check pattern) or closed
 * by the border of the photo has at least one side with the same surface on both sides.
 */
export function sideContrasts(
	px: Pixels,
	quad: Quad,
	gap = Math.max(2, Math.round(Math.max(px.width, px.height) / 300)),
): [number, number, number, number] {
	const cx = quad.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = quad.reduce((sum, p) => sum + p.y, 0) / 4;
	const segments = 6;
	const out: number[] = [];
	for (let side = 0; side < 4; side++) {
		const a = cornerOf(quad, side);
		const b = cornerOf(quad, (side + 1) % 4);
		const length = dist(a, b);
		if (length < 1) {
			out.push(0);
			continue;
		}
		const tx = (b.x - a.x) / length;
		const ty = (b.y - a.y) / length;
		// the normal pointing away from the centre
		let nx = -ty;
		let ny = tx;
		if (nx * ((a.x + b.x) / 2 - cx) + ny * ((a.y + b.y) / 2 - cy) < 0) {
			nx = -nx;
			ny = -ny;
		}
		const perSegment = Math.max(3, Math.round((length * 0.84) / segments / 2));
		const values: number[] = [];
		for (let k = 0; k < segments; k++) {
			const inside = [0, 0, 0];
			const outside = [0, 0, 0];
			let count = 0;
			let off = false;
			for (let j = 0; j < perSegment && !off; j++) {
				const t = 0.08 + (0.84 * (k + (j + 0.5) / perSegment)) / segments;
				const x = a.x + (b.x - a.x) * t;
				const y = a.y + (b.y - a.y) * t;
				for (let depth = gap; depth <= 3 * gap; depth += gap) {
					const inner = pixelIndex(px, x - nx * depth, y - ny * depth);
					const outer = pixelIndex(px, x + nx * depth, y + ny * depth);
					if (inner < 0 || outer < 0) {
						off = true;
						break;
					}
					for (let c = 0; c < 3; c++) {
						inside[c] = (inside[c] ?? 0) + (px.data[inner + c] ?? 0);
						outside[c] = (outside[c] ?? 0) + (px.data[outer + c] ?? 0);
					}
					count++;
				}
			}
			values.push(
				off || count === 0
					? 0
					: Math.hypot(
							...[0, 1, 2].map((c) => ((inside[c] ?? 0) - (outside[c] ?? 0)) / count),
						),
			);
		}
		values.sort((x, y) => x - y);
		out.push(values[2] ?? 0);
	}
	return out as [number, number, number, number];
}

/** The index in `px.data` of the pixel containing (x, y), or -1 outside the image. */
function pixelIndex(px: Pixels, x: number, y: number): number {
	const i = Math.floor(x);
	const j = Math.floor(y);
	return i < 0 || j < 0 || i >= px.width || j >= px.height ? -1 : (j * px.width + i) * 4;
}

/** A straight line through `p` along the unit vector `d`. */
interface Line {
	p: Point;
	d: Point;
}

/**
 * The line that fits the points best (total least squares) after dropping the outliers: three
 * rounds, each keeping the points within 2.5 times the median distance (at least 1 px). Null with
 * fewer than `minPoints` points left.
 */
export function fitLine(points: readonly Point[], minPoints = 5): Line | null {
	let kept = [...points];
	let line: Line | null = null;
	for (let round = 0; round < 3; round++) {
		if (kept.length < minPoints) {
			return null;
		}
		const mx = kept.reduce((sum, p) => sum + p.x, 0) / kept.length;
		const my = kept.reduce((sum, p) => sum + p.y, 0) / kept.length;
		let sxx = 0;
		let sxy = 0;
		let syy = 0;
		for (const p of kept) {
			sxx += (p.x - mx) ** 2;
			sxy += (p.x - mx) * (p.y - my);
			syy += (p.y - my) ** 2;
		}
		const angle = Math.atan2(2 * sxy, sxx - syy) / 2;
		line = { p: { x: mx, y: my }, d: { x: Math.cos(angle), y: Math.sin(angle) } };
		const current = line;
		const distances = kept.map((p) => distanceToLine(current, p));
		const sorted = [...distances].sort((a, b) => a - b);
		const limit = Math.max(1, 2.5 * (sorted[Math.floor(sorted.length / 2)] ?? 0));
		const next = kept.filter((_, i) => (distances[i] ?? 0) <= limit);
		if (next.length === kept.length) {
			break;
		}
		kept = next;
	}
	return kept.length >= minPoints ? line : null;
}

const distanceToLine = (line: Line, p: Point): number =>
	Math.abs((p.x - line.p.x) * line.d.y - (p.y - line.p.y) * line.d.x);

/** Where two lines cross, or null when they are (almost) parallel. */
function intersect(a: Line, b: Line): Point | null {
	const det = a.d.x * b.d.y - a.d.y * b.d.x;
	if (Math.abs(det) < 1e-6) {
		return null;
	}
	const t = ((b.p.x - a.p.x) * b.d.y - (b.p.y - a.p.y) * b.d.x) / det;
	return { x: a.p.x + a.d.x * t, y: a.p.y + a.d.y * t };
}

/** True when the quad turns the same way at every corner (convex and not self-intersecting). */
export function isConvex(quad: Quad): boolean {
	let sign = 0;
	for (let i = 0; i < 4; i++) {
		const a = cornerOf(quad, i);
		const b = cornerOf(quad, (i + 1) % 4);
		const c = cornerOf(quad, (i + 2) % 4);
		const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
		if (cross === 0 || (sign !== 0 && Math.sign(cross) !== sign)) {
			return false;
		}
		sign = Math.sign(cross);
	}
	return true;
}

/**
 * Moves each side of `quad` onto the colour step it follows. Along every side, the strongest step
 * across it within 8 px is located and a line is fitted to those points without the outliers (a
 * finger, a glare, an object across the edge); the search is repeated around the fitted line with
 * narrower reaches (6, 4, 3 px), so a side that started askew converges onto the edge. The corners
 * are where the fitted lines cross: this puts a corner that the contour cut short (a finger over
 * it) back where the two sides meet, and removes the pixel or two by which the dilated edge maps
 * widen a contour. A side without a clear step keeps its place; the whole quad is kept when the
 * result is not a plausible correction (not convex, or a corner moved farther than `maxShift`).
 */
export function refineQuad(
	px: Pixels,
	quad: Quad,
	maxShift = Math.max(9, Math.round(0.05 * Math.max(px.width, px.height))),
): Quad {
	const lines: Line[] = [];
	for (let side = 0; side < 4; side++) {
		const a = cornerOf(quad, side);
		const b = cornerOf(quad, (side + 1) % 4);
		let line: Line = { p: a, d: unit(a, b) };
		const samples = Math.max(12, Math.min(60, Math.round(dist(a, b) / 6)));
		for (const range of [8, 6, 4, 3]) {
			const found = stepPoints(px, line, a, b, range, samples);
			const fitted = fitLine(found, Math.max(6, samples / 3));
			if (!fitted) {
				break;
			}
			line = fitted;
		}
		lines.push(line);
	}
	const corners: Point[] = [];
	for (let i = 0; i < 4; i++) {
		const previous = lines[(i + 3) % 4];
		const next = lines[i];
		const corner = previous && next ? intersect(previous, next) : null;
		const before = cornerOf(quad, i);
		if (!corner || dist(corner, before) > maxShift) {
			return quad;
		}
		corners.push(corner);
	}
	const refined = corners as Quad;
	return isConvex(refined) ? refined : quad;
}

const unit = (a: Point, b: Point): Point => {
	const length = dist(a, b) || 1;
	return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
};

/**
 * Along the segment ab (sampled every ~6 px, corners excluded), where the colour steps across
 * `line` within `range` px of it: the step at offset s is the colour difference between the image
 * 2 px before and 2 px after s along the normal (bilinear samples). The step's place is the
 * centroid of the response above half its peak, which stays centred on the edge although a 2 px
 * gap makes the response flat-topped. Weak steps (under 3 levels, or under a third of the median
 * peak) are dropped.
 */
function stepPoints(
	px: Pixels,
	line: Line,
	a: Point,
	b: Point,
	range: number,
	samples: number,
): Point[] {
	const n = { x: -line.d.y, y: line.d.x };
	const gap = 2;
	const found: { point: Point; strength: number }[] = [];
	const response: number[] = [];
	const inner = [0, 0, 0];
	const outer = [0, 0, 0];
	for (let k = 0; k < samples; k++) {
		const t = 0.06 + (0.88 * (k + 0.5)) / samples;
		// the sample's foot on the current line
		const along =
			(a.x - line.p.x + (b.x - a.x) * t) * line.d.x +
			(a.y - line.p.y + (b.y - a.y) * t) * line.d.y;
		const fx = line.p.x + line.d.x * along;
		const fy = line.p.y + line.d.y * along;
		response.length = 0;
		let best = 0;
		for (let s = -range; s <= range; s++) {
			const ok =
				bilinear(px, fx + n.x * (s - gap), fy + n.y * (s - gap), inner) &&
				bilinear(px, fx + n.x * (s + gap), fy + n.y * (s + gap), outer);
			const value = ok
				? Math.sqrt(
						((inner[0] ?? 0) - (outer[0] ?? 0)) ** 2 +
							((inner[1] ?? 0) - (outer[1] ?? 0)) ** 2 +
							((inner[2] ?? 0) - (outer[2] ?? 0)) ** 2,
					)
				: 0;
			response.push(value);
			if (value > (response[best] ?? 0)) {
				best = response.length - 1;
			}
		}
		const peak = response[best] ?? 0;
		if (peak < 3) {
			continue;
		}
		let lo = best;
		let hi = best;
		while (lo > 0 && (response[lo - 1] ?? 0) > peak / 2) {
			lo--;
		}
		while (hi < response.length - 1 && (response[hi + 1] ?? 0) > peak / 2) {
			hi++;
		}
		let weight = 0;
		let moment = 0;
		for (let i = lo; i <= hi; i++) {
			const w = (response[i] ?? 0) - peak / 2;
			weight += w;
			moment += w * i;
		}
		const offset = (weight > 0 ? moment / weight : best) - range;
		found.push({ point: { x: fx + n.x * offset, y: fy + n.y * offset }, strength: peak });
	}
	const strengths = found.map((f) => f.strength).sort((x, y) => x - y);
	const median = strengths[Math.floor(strengths.length / 2)] ?? 0;
	return found.filter((f) => f.strength >= median / 3).map((f) => f.point);
}

/**
 * The RGB at the continuous point (x, y), interpolated between the four nearest pixel centres,
 * into `out`; false (and `out` untouched) outside the image.
 */
function bilinear(px: Pixels, x: number, y: number, out: number[]): boolean {
	if (x < 0 || y < 0 || x >= px.width || y >= px.height) {
		return false;
	}
	const fx = Math.min(Math.max(x - 0.5, 0), px.width - 1);
	const fy = Math.min(Math.max(y - 0.5, 0), px.height - 1);
	const i = Math.min(Math.floor(fx), px.width - 2);
	const j = Math.min(Math.floor(fy), px.height - 2);
	const tx = fx - i;
	const ty = fy - j;
	const k00 = (j * px.width + i) * 4;
	const k10 = k00 + 4;
	const k01 = k00 + px.width * 4;
	const k11 = k01 + 4;
	for (let c = 0; c < 3; c++) {
		const top = (px.data[k00 + c] ?? 0) * (1 - tx) + (px.data[k10 + c] ?? 0) * tx;
		const bottom = (px.data[k01 + c] ?? 0) * (1 - tx) + (px.data[k11 + c] ?? 0) * tx;
		out[c] = top * (1 - ty) + bottom * ty;
	}
	return true;
}

/**
 * What differs from the table: a smooth colour model of the table (per channel, a quadratic
 * surface in x and y, which follows uneven lighting and vignetting) is fitted to a band along the
 * border of the photo, where the cover never is (its corners are inside the frame); the fit is
 * repeated without the pixels it explains worst (a finger, a pen at the border). A pixel is
 * foreground (255) when its colour is farther from the model than the border band's own spread
 * (twice its 90th percentile, at least 4 levels). `px` holds `channels` values per pixel (RGB).
 */
export function foregroundMask(px: Pixels, channels = 3, band = 0.05): Uint8Array {
	const { width, height, data } = px;
	const bw = Math.max(2, Math.round(band * width));
	const bh = Math.max(2, Math.round(band * height));
	const step = Math.max(1, Math.round(Math.sqrt((2 * (bw * height + bh * width)) / 4000)));
	const samples: { u: number; v: number; c: number[] }[] = [];
	for (let y = 0; y < height; y += step) {
		for (let x = 0; x < width; x += step) {
			if (x >= bw && x < width - bw && y >= bh && y < height - bh) {
				continue;
			}
			const k = (y * width + x) * channels;
			samples.push({
				u: (2 * x) / width - 1,
				v: (2 * y) / height - 1,
				c: [data[k] ?? 0, data[k + 1] ?? 0, data[k + 2] ?? 0],
			});
		}
	}
	const terms = (u: number, v: number): number[] => [1, u, v, u * u, u * v, v * v];
	let kept = samples;
	let models: number[][] = [];
	let spread = 0;
	for (let round = 0; round < 2; round++) {
		models = [0, 1, 2].map((c) =>
			leastSquares(
				kept.map((s) => terms(s.u, s.v)),
				kept.map((s) => s.c[c] ?? 0),
			),
		);
		const residuals = kept.map((s) => colourResidual(models, terms(s.u, s.v), s.c));
		const sorted = [...residuals].sort((a, b) => a - b);
		spread = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
		const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
		kept = kept.filter((_, i) => (residuals[i] ?? 0) <= Math.max(3, 3 * median));
	}
	const threshold = Math.max(4, 2 * spread);
	const limit = threshold * threshold;
	const mask = new Uint8Array(width * height);
	const [m0, m1, m2] = models as [number[], number[], number[]];
	for (let y = 0; y < height; y++) {
		const v = (2 * y) / height - 1;
		// along a row the model is a quadratic in u: c0 + c1·u + c2·u²
		const row = [m0, m1, m2].map((m) => [
			(m[0] ?? 0) + (m[2] ?? 0) * v + (m[5] ?? 0) * v * v,
			(m[1] ?? 0) + (m[4] ?? 0) * v,
			m[3] ?? 0,
		]) as [number[], number[], number[]];
		for (let x = 0; x < width; x++) {
			const u = (2 * x) / width - 1;
			const k = (y * width + x) * channels;
			let sum = 0;
			for (let ch = 0; ch < 3; ch++) {
				const r = row[ch] ?? [];
				const d =
					(data[k + ch] ?? 0) - ((r[0] ?? 0) + (r[1] ?? 0) * u + (r[2] ?? 0) * u * u);
				sum += d * d;
			}
			if (sum > limit) {
				mask[y * width + x] = 255;
			}
		}
	}
	return mask;
}

function colourResidual(models: number[][], t: number[], c: number[]): number {
	let sum = 0;
	for (let ch = 0; ch < 3; ch++) {
		const model = models[ch] ?? [];
		let predicted = 0;
		for (let i = 0; i < t.length; i++) {
			predicted += (model[i] ?? 0) * (t[i] ?? 0);
		}
		sum += ((c[ch] ?? 0) - predicted) ** 2;
	}
	return Math.sqrt(sum);
}

/** Least-squares coefficients of `rows` × coefficients ≈ `values` (normal equations, a ridge of 1e-6). */
export function leastSquares(rows: readonly number[][], values: readonly number[]): number[] {
	const n = rows[0]?.length ?? 0;
	const w = n + 1;
	// the augmented normal equations [AᵀA | Aᵀb], row by row
	const m = new Float64Array(n * w);
	for (let i = 0; i < n; i++) {
		m[i * w + i] = 1e-6;
	}
	rows.forEach((row, r) => {
		for (let i = 0; i < n; i++) {
			const ri = row[i] ?? 0;
			for (let j = 0; j < n; j++) {
				m[i * w + j] = (m[i * w + j] ?? 0) + ri * (row[j] ?? 0);
			}
			m[i * w + n] = (m[i * w + n] ?? 0) + ri * (values[r] ?? 0);
		}
	});
	const at = (i: number, j: number): number => m[i * w + j] ?? 0;
	// Gauss-Jordan elimination with partial pivoting
	for (let col = 0; col < n; col++) {
		let pivot = col;
		for (let r = col + 1; r < n; r++) {
			if (Math.abs(at(r, col)) > Math.abs(at(pivot, col))) {
				pivot = r;
			}
		}
		for (let j = 0; j < w; j++) {
			const t = at(col, j);
			m[col * w + j] = at(pivot, j);
			m[pivot * w + j] = t;
		}
		const p = at(col, col);
		if (Math.abs(p) < 1e-12) {
			continue;
		}
		for (let j = col; j < w; j++) {
			m[col * w + j] = at(col, j) / p;
		}
		for (let r = 0; r < n; r++) {
			const f = at(r, col);
			if (r === col || f === 0) {
				continue;
			}
			for (let j = col; j < w; j++) {
				m[r * w + j] = at(r, j) - f * at(col, j);
			}
		}
	}
	return Array.from({ length: n }, (_, i) => at(i, n));
}

/** The weakest side of a candidate: how clearly it is the edge of something lying on the table. */
export const weakestSide = (c: Candidate): number => Math.min(...c.contrast);

/**
 * Chooses the cover among the candidates of every pass: the largest quadrilateral whose four
 * sides all show a colour step of at least `minContrast` levels. A larger quadrilateral wins
 * because the cover's own artwork (a frame, a picture) also draws well-marked quadrilaterals
 * inside it. One exception: a candidate nested in the winner, almost as large (at least 75 % of
 * its area) and sharing a corner with it replaces it when its weakest side is clearly sharper (1.5
 * times): the larger one then took in a soft shadow or a strip of table along one or two sides (a
 * frame printed on the cover is inset on all four sides and shares no corner). Null when no
 * candidate qualifies: the operator then places the corners.
 */
export function pickCandidate(candidates: readonly Candidate[], minContrast = 8): Candidate | null {
	const eligible = candidates
		.filter((c) => weakestSide(c) >= minContrast)
		.sort((a, b) => b.area - a.area);
	let best = eligible[0] ?? null;
	for (const c of eligible.slice(1)) {
		if (
			best &&
			c.area >= 0.75 * best.area &&
			weakestSide(c) >= 1.5 * weakestSide(best) &&
			nestedIn(c.quad, best.quad) &&
			sharesCorner(c.quad, best.quad)
		) {
			best = c;
		}
	}
	return best;
}

/** True when a corner of `a` is within 1.5 % of the size of `b` from a corner of `b`. */
export function sharesCorner(a: Quad, b: Quad): boolean {
	const tolerance = 0.015 * Math.sqrt(polygonArea(b));
	return a.some((p) => b.some((q) => dist(p, q) <= tolerance));
}

/** True when every corner of `inner` lies inside `outer` (convex), with a margin of 3 % of its size. */
export function nestedIn(inner: Quad, outer: Quad): boolean {
	const margin = 0.03 * Math.sqrt(polygonArea(outer));
	const cx = outer.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = outer.reduce((sum, p) => sum + p.y, 0) / 4;
	return inner.every((p) =>
		outer.every((a, i) => {
			const b = cornerOf(outer, (i + 1) % 4);
			const { x: dx, y: dy } = unit(a, b);
			// distance from the side, positive towards the centre of `outer`
			const side = (q: Point): number => (q.x - a.x) * dy - (q.y - a.y) * dx;
			return side(p) * Math.sign(side({ x: cx, y: cy })) >= -margin;
		}),
	);
}

/**
 * Detects the cover in the image data: each pass proposes the convex quadrilaterals of its edge
 * map, each candidate is scored on the image (blurred a little) by the colour step across its
 * sides, and `pickCandidate` chooses. Returns the corners in the coordinates of `image`, or null
 * when no plausible quadrilateral exists.
 */
export function detectQuad(
	cv: CvModule,
	image: ImageData,
	options: DetectOptions = {},
): Quad | null {
	const minAreaRatio = options.minAreaRatio ?? 0.15;
	const maxSide = options.maxSide ?? 800;
	const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
	const src = cv.matFromImageData(image);
	const small = new cv.Mat();
	const blurred = new cv.Mat();
	try {
		if (scale < 1) {
			cv.resize(src, small, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
		} else {
			src.copyTo(small);
		}
		// the image the candidates are scored on (and the color pass's input)
		cv.GaussianBlur(small, blurred, new cv.Size(5, 5), 0);
		const found: { points: Point[]; pass: DetectPass; area: number; hull: boolean }[] = [];
		for (const pass of options.passes ?? DETECT_PASSES) {
			const { map, factor } = edgeMap(cv, small, blurred, pass);
			try {
				for (const q of quadCandidates(cv, map, minAreaRatio)) {
					found.push({
						...q,
						// pixel indices → continuous coordinates (the centre of the pixel)
						points: q.points.map((p) => ({
							x: (p.x + 0.5) * factor,
							y: (p.y + 0.5) * factor,
						})),
						pass,
					});
				}
			} finally {
				map.delete();
			}
		}
		// read the pixels only now: allocating Mats can grow the wasm heap and detach older views
		const px: Pixels = { width: blurred.cols, height: blurred.rows, data: blurred.data };
		// passes often propose the same outline: refine and score each one once
		const seen: { from: Quad; quad: Quad; contrast: Candidate["contrast"] }[] = [];
		const candidates: Candidate[] = found.map((f) => {
			const from = orderCorners(f.points);
			let done = seen.find((d) => d.from.every((p, i) => dist(p, cornerOf(from, i)) <= 1.5));
			if (!done) {
				const quad = refineQuad(px, from);
				done = { from, quad, contrast: sideContrasts(px, quad) };
				seen.push(done);
			}
			return {
				quad: scaleQuad(done.quad, 1 / scale),
				pass: f.pass,
				area: f.area,
				hull: f.hull,
				contrast: done.contrast,
			};
		});
		options.inspect?.(candidates);
		const best = pickCandidate(candidates);
		options.report?.(best?.pass ?? null);
		return best?.quad ?? null;
	} finally {
		src.delete();
		small.delete();
		blurred.delete();
	}
}

/**
 * The binary map of one pass, in which the cover should appear as a closed outline (or, for
 * `background`, as a filled region), and the factor from its pixels to those of `rgba`. Shared with
 * the frames of a class picture (`frames.ts`).
 */
export function edgeMap(
	cv: CvModule,
	rgba: InstanceType<CvModule["Mat"]>,
	blurred: InstanceType<CvModule["Mat"]>,
	pass: DetectPass,
): { map: InstanceType<CvModule["Mat"]>; factor: number } {
	const map = new cv.Mat();
	const work = new cv.Mat();
	const kernel = (size: number): InstanceType<CvModule["Mat"]> =>
		cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(size, size));
	const morph = (op: number, size: number): void => {
		const k = kernel(size);
		try {
			cv.morphologyEx(map, map, op, k);
		} finally {
			k.delete();
		}
	};
	try {
		if (pass === "background") {
			// a 3 × 3 median removes noise, fine grain and the thinnest seams but keeps the cover's edge
			cv.cvtColor(rgba, map, cv.COLOR_RGBA2RGB);
			cv.medianBlur(map, work, 3);
			const mask = foregroundMask({ width: work.cols, height: work.rows, data: work.data });
			map.create(work.rows, work.cols, cv.CV_8UC1);
			map.data.set(mask);
			morph(cv.MORPH_OPEN, 5);
			morph(cv.MORPH_CLOSE, 5);
			return { map, factor: 1 };
		}
		if (pass === "color") {
			// R, G, B (one Canny on the three channels: the strongest gradient of any of them) and
			// the saturation: a cover can be as bright as the table but not as coloured
			const one = new cv.Mat();
			const hsv = new cv.MatVector();
			try {
				cv.cvtColor(blurred, work, cv.COLOR_RGBA2RGB);
				cv.Canny(work, map, 15, 45);
				cv.cvtColor(work, work, cv.COLOR_RGB2HSV);
				cv.split(work, hsv);
				const saturation = hsv.get(1);
				try {
					cv.Canny(saturation, one, 15, 45);
				} finally {
					saturation.delete();
				}
				cv.bitwise_or(map, one, map);
			} finally {
				one.delete();
				hsv.delete();
			}
			morph(cv.MORPH_CLOSE, 5);
			return { map, factor: 1 };
		}
		cv.cvtColor(rgba, work, cv.COLOR_RGBA2GRAY);
		if (pass === "standard") {
			cv.GaussianBlur(work, work, new cv.Size(5, 5), 0);
			cv.Canny(work, map, 50, 150);
			morph(cv.MORPH_DILATE, 3);
			return { map, factor: 1 };
		}
		cv.equalizeHist(work, work);
		cv.GaussianBlur(work, work, new cv.Size(7, 7), 0);
		cv.Canny(work, map, 20, 60);
		morph(cv.MORPH_CLOSE, 5);
		return { map, factor: 1 };
	} catch (error) {
		map.delete();
		throw error;
	} finally {
		work.delete();
	}
}

/**
 * The convex four-sided contours of an edge map that are large enough. A contour that is almost a
 * quadrilateral (a corner hidden by a finger, an edge that frays) gets a second chance through its
 * convex hull with a looser approximation; one that fills the whole picture is the frame, not a
 * cover.
 */
export function quadCandidates(
	cv: CvModule,
	edges: InstanceType<CvModule["Mat"]>,
	minAreaRatio: number,
): { points: Point[]; area: number; hull: boolean }[] {
	const imageArea = edges.rows * edges.cols;
	const contours = new cv.MatVector();
	const hierarchy = new cv.Mat();
	const approx = new cv.Mat();
	const hull = new cv.Mat();
	const out: { points: Point[]; area: number; hull: boolean }[] = [];
	try {
		cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
		const minArea = imageArea * minAreaRatio;
		for (let i = 0; i < contours.size(); i++) {
			const contour = contours.get(i);
			try {
				const area = cv.contourArea(contour);
				if (area < minArea || area > imageArea * 0.97) {
					continue;
				}
				let viaHull = false;
				const perimeter = cv.arcLength(contour, true);
				cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
				if (approx.rows !== 4 || !cv.isContourConvex(approx)) {
					cv.convexHull(contour, hull, false, true);
					cv.approxPolyDP(hull, approx, 0.04 * cv.arcLength(hull, true), true);
					if (approx.rows !== 4 || !cv.isContourConvex(approx)) {
						continue;
					}
					viaHull = true;
				}
				const data = approx.data32S;
				const points: Point[] = [];
				for (let k = 0; k < 4; k++) {
					points.push({ x: data[k * 2] ?? 0, y: data[k * 2 + 1] ?? 0 });
				}
				out.push({ points, area: polygonArea(points) / imageArea, hull: viaHull });
			} finally {
				contour.delete();
			}
		}
		return out;
	} finally {
		for (const m of [hierarchy, approx, hull]) {
			m.delete();
		}
		contours.delete();
	}
}

/**
 * Warps the quadrilateral of `source` to an upright rectangle `targetWidth` pixels wide and
 * returns it as a canvas (the caller encodes it to WebP).
 */
export function warpQuad(
	cv: CvModule,
	source: HTMLCanvasElement | HTMLImageElement,
	quad: Quad,
	targetWidth: number,
): HTMLCanvasElement {
	const { width, height } = outputSize(quad, targetWidth);
	const src = cv.imread(source);
	const dst = new cv.Mat();
	const from = cv.matFromArray(
		4,
		1,
		cv.CV_32FC2,
		quad.flatMap((p) => [p.x, p.y]),
	);
	const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
	const matrix = cv.getPerspectiveTransform(from, to);
	const out = document.createElement("canvas");
	out.width = width;
	out.height = height;
	try {
		cv.warpPerspective(src, dst, matrix, new cv.Size(width, height), cv.INTER_LINEAR);
		cv.imshow(out, dst);
	} finally {
		for (const m of [src, dst, from, to, matrix]) {
			m.delete();
		}
	}
	return out;
}
