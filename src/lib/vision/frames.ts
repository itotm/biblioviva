// SPDX-License-Identifier: GPL-3.0-or-later
// The photo frames of a class picture (PLAN.md step 13.1): the sheet of portraits from the school
// photographer, the class's cards laid on a table, a page of ID photos. The passes and the scoring
// of the cover detection (`dewarp.ts`) propose and score every convex quadrilateral; here every good
// one is kept instead of the best: portrait-shaped, a clear colour step along all four sides, the
// duplicates of several passes merged, the photo kept rather than the card or grid cell around it,
// the sizes far from the others' dropped. Frames come back in reading order. No face detection
// (Q107): the frames are found by their edges. The pure helpers run anywhere; `detectFrames` needs
// the lazily loaded OpenCV.js module. The server straightens the frames (`#lib/server/images/warp.ts`).
import {
	DETECT_PASSES,
	edgeMap,
	orderCorners,
	polygonArea,
	quadCandidates,
	refineQuad,
	scaleQuad,
	sideContrasts,
	nestedIn,
	sharesCorner,
	type DetectPass,
	type Pixels,
} from "./dewarp.js";
import { dist, rectQuad, type Point, type Quad } from "#lib/shared/geometry.js";
import type { CvModule } from "./loader.js";

// The constants of the OpenCV.js type package (`cv.INTER_AREA`, …) are typed `any`.
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/** A frame found in the picture, in the picture's pixels. */
export interface Frame {
	quad: Quad;
	/** The colour step across each side (top, right, bottom, left), see `sideContrasts`. */
	sides: [number, number, number, number];
	/** Drawn by edge runs (`rectanglesFromRuns`): how full it is along its sides (`inkFill`). */
	fill?: number;
}

/**
 * How clearly a candidate is a photo: the second weakest of its side steps. Three clear sides are
 * enough: a white shirt at the bottom of a portrait printed on white paper leaves no edge there,
 * and the contour still closes around the coloured background (through its convex hull).
 */
export const frameScore = (f: Frame): number => [...f.sides].sort((a, b) => a - b)[1] ?? 0;

export interface FrameOptions {
	/** Height / width of a portrait frame (`photos.sheet.minAspect`, `maxAspect`, Q105). */
	minAspect?: number;
	maxAspect?: number;
	/** At most this many frames, the clearest ones (`photos.sheet.maxFrames`). */
	maxFrames?: number;
	/** Longest side the picture is scaled to before detection. */
	maxSide?: number;
	/** Smallest frame as a fraction of the picture. */
	minAreaRatio?: number;
	/** Colour step every side needs (as for the covers). */
	minContrast?: number;
	passes?: readonly DetectPass[];
	/**
	 * Also look for rectangles drawn by long straight edges (`rectanglesFromRuns`): the photos on
	 * the scan of a page of cards, whose pale border is crossed by stamps and touched by the
	 * card's ruled lines. Default true.
	 */
	lines?: boolean;
	/**
	 * With `lines`, also look at the picture turned by the angles of its long straight edges, at
	 * most this many (`scanAngles`): the cards of a scan laid askew, at any angle (9.26, Q126).
	 * 0 looks at the picture as it is only.
	 */
	turns?: number;
	/**
	 * With `passes`, look for the rectangles drawn by long straight edges only when the passes
	 * outlined fewer photos than this (a scan sent as a photo), and keep them when they are more.
	 * Default 5.
	 */
	linesBelow?: number;
	/**
	 * Every scored candidate, in picture pixels (diagnostics and tests): the quadrilaterals, then
	 * the rectangles drawn by edge runs when they are looked for.
	 */
	inspect?: (candidates: readonly (Frame & { cut: boolean })[]) => void;
}

export const FRAME_DEFAULTS = {
	minAspect: 1,
	maxAspect: 1.6,
	maxFrames: 60,
	maxSide: 1600,
	minAreaRatio: 0.002,
	minContrast: 8,
	lines: true,
	turns: 5,
	linesBelow: 5,
} as const;

/**
 * The detection of a scan (the photos lie flat, as rectangles turned by any angle, Q126): only the
 * rectangles drawn by long straight edges, looked for in the picture as it is and turned by the
 * angles of its cards (`turns`); the passes of a photo taken at an angle find trapezoids there,
 * and inside the photos details of hair and clothes. A photo of a scanned page covers half a
 * percent of the picture at least, even on a page laid askew in a corner of the glass: the
 * rectangles found inside a stamp's rings are smaller (calibrated on ten real scans of school
 * cards and the demo picture, 9.26).
 */
export const SCAN_DETECTION: FrameOptions = {
	passes: [],
	lines: true,
	turns: 5,
	minAreaRatio: 0.005,
};

/** Height / width of a quad: the average of the opposite sides. */
export function aspectOf(quad: Quad): number {
	const [tl, tr, br, bl] = quad;
	const w = (dist(tl, tr) + dist(bl, br)) / 2;
	const h = (dist(tl, bl) + dist(tr, br)) / 2;
	return w > 0 ? h / w : 0;
}

/** The part of the convex polygon `subject` inside the convex polygon `clip` (Sutherland–Hodgman). */
function clipPolygon(subject: readonly Point[], clip: readonly Point[]): Point[] {
	// orient the clip polygon counter-clockwise in the maths sense (area > 0 with y down = clockwise)
	const signed = clip.reduce((sum, a, i) => {
		const b = clip[(i + 1) % clip.length] ?? a;
		return sum + (a.x * b.y - b.x * a.y);
	}, 0);
	const ring = signed < 0 ? [...clip].reverse() : [...clip];
	let output = [...subject];
	for (let i = 0; i < ring.length && output.length > 0; i++) {
		const a = ring[i] ?? { x: 0, y: 0 };
		const b = ring[(i + 1) % ring.length] ?? a;
		const side = (p: Point): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
		const inside = (p: Point): boolean => side(p) >= 0;
		// where the segment from p to q crosses the clip edge, from the two signed distances: it
		// stays on the segment even when the segment lies almost along the edge (two frames
		// sharing a side), where intersecting the two lines would throw the point far away
		const cross = (p: Point, q: Point): Point => {
			const dp = side(p);
			const dq = side(q);
			const t = dp === dq ? 0 : dp / (dp - dq);
			return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
		};
		const input = output;
		output = [];
		input.forEach((p, k) => {
			const q = input[(k + input.length - 1) % input.length] ?? p;
			if (inside(p)) {
				if (!inside(q)) {
					output.push(cross(q, p));
				}
				output.push(p);
			} else if (inside(q)) {
				output.push(cross(q, p));
			}
		});
	}
	return output;
}

/** The mean RGB of the pixels around (x, y) at the offsets `depths` along (nx, ny); null off the picture. */
function bandColour(
	px: Pixels,
	x: number,
	y: number,
	nx: number,
	ny: number,
	depths: readonly number[],
): [number, number, number] | null {
	const sum = [0, 0, 0];
	for (const d of depths) {
		const i = Math.floor(x + nx * d);
		const j = Math.floor(y + ny * d);
		if (i < 0 || j < 0 || i >= px.width || j >= px.height) {
			return null;
		}
		const k = (j * px.width + i) * 4;
		for (let c = 0; c < 3; c++) {
			sum[c] = (sum[c] ?? 0) + (px.data[k + c] ?? 0);
		}
	}
	return sum.map((v) => v / depths.length) as [number, number, number];
}

/**
 * True when the edge of a clear side goes on past one of its corners: the colour step across the
 * side's line, measured just beyond the corner (from 3 to 8 % of the side's length), is still at
 * least half the side's own step and twice `minStep`. A frame cut short (the coloured part above a
 * white shirt that meets white paper) has such a false corner where its strong sides stop; a real
 * corner opens onto the paper, or the gap between two photos, on both sides of the line. Only the
 * clear sides are followed (at least three times `minStep` and half the frame's sharpest side): past
 * the corners of a weak side, a printed white border around the photo would read as a step.
 */
export function continuesPastCorner(
	px: Pixels,
	quad: Quad,
	sides: readonly number[],
	minStep: number,
	gap = 2,
): boolean {
	const cx = quad.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = quad.reduce((sum, p) => sum + p.y, 0) / 4;
	const depths = [gap, 2 * gap, 3 * gap];
	const clear = Math.max(3 * minStep, 0.5 * Math.max(...sides));
	for (let side = 0; side < 4; side++) {
		const a = quad[side] ?? quad[0];
		const b = quad[(side + 1) % 4] ?? quad[0];
		const length = dist(a, b);
		if (length < 1) {
			continue;
		}
		const dx = (b.x - a.x) / length;
		const dy = (b.y - a.y) / length;
		let nx = -dy;
		let ny = dx;
		if (nx * ((a.x + b.x) / 2 - cx) + ny * ((a.y + b.y) / 2 - cy) < 0) {
			nx = -nx;
			ny = -ny;
		}
		const own = sides[side] ?? 0;
		if (own < clear) {
			continue;
		}
		for (const [corner, sign] of [
			[b, 1],
			[a, -1],
		] as const) {
			let total = 0;
			let count = 0;
			for (let t = 0.03; t <= 0.08 + 1e-9; t += 0.01) {
				const x = corner.x + dx * sign * t * length;
				const y = corner.y + dy * sign * t * length;
				const inner = bandColour(px, x, y, -nx, -ny, depths);
				const outer = bandColour(px, x, y, nx, ny, depths);
				if (!inner || !outer) {
					continue;
				}
				total += Math.hypot(inner[0] - outer[0], inner[1] - outer[1], inner[2] - outer[2]);
				count++;
			}
			const step = count > 0 ? total / count : 0;
			if (step >= 2 * minStep && step >= 0.5 * own) {
				return true;
			}
		}
	}
	return false;
}

/** The mean colour step across the four sides of a frame. */
const meanStep = (f: Frame): number => f.sides.reduce((sum, v) => sum + v, 0) / 4;

/** The part of the convex quad `inner` that lies inside the convex quad `outer` (0–1). */
export function insideOf(inner: Quad, outer: Quad): number {
	const own = polygonArea(inner);
	return own > 0 ? polygonArea(clipPolygon(inner, outer)) / own : 0;
}

/** Intersection over union of two convex quads (0 apart, 1 identical). */
export function overlapOf(a: Quad, b: Quad): number {
	const common = polygonArea(clipPolygon(a, b));
	const union = polygonArea(a) + polygonArea(b) - common;
	return union > 0 ? common / union : 0;
}

/**
 * Chooses the frames among the scored candidates: portrait-shaped, at least three sides clear
 * (`frameScore`); a frame holding a smaller one of at least half its area, inset on every side (no
 * shared corner), gives way to it (the photo inside a card, the tile inside a grid cell, the
 * picture inside a printed white border); of the candidates that still outline the same frame
 * (several passes, the two sides of an edge line, or the frame cut short where a white shirt meets
 * white paper, which shares two corners with it) the largest; frames far from the median size (less than 0.4 or more
 * than 2.5 times it) are dropped: a detail inside a photo, a whole row of cards. At most
 * `maxFrames`, the clearest. Reading order.
 */
export function selectFrames(candidates: readonly Frame[], options: FrameOptions = {}): Frame[] {
	const o = { ...FRAME_DEFAULTS, ...options };
	const eligible = candidates.filter((c) => {
		const aspect = aspectOf(c.quad);
		return frameScore(c) >= o.minContrast && aspect >= o.minAspect && aspect <= o.maxAspect;
	});
	const area = new Map(eligible.map((c) => [c, polygonArea(c.quad)]));
	const innermost = eligible.filter(
		(outer) =>
			!eligible.some((c) => {
				const a = area.get(c) ?? 0;
				const b = area.get(outer) ?? 0;
				return (
					a < 0.97 * b &&
					a >= 0.5 * b &&
					nestedIn(c.quad, outer.quad) &&
					!sharesCorner(c.quad, outer.quad)
				);
			}),
	);
	const distinct: Frame[] = [];
	// the largest frame of each group of candidates outlining the same photo
	const leader = new Map<Frame, number>();
	const ranked = [...innermost].sort((a, b) => (area.get(b) ?? 0) - (area.get(a) ?? 0));
	for (const c of ranked) {
		const k = distinct.findIndex((d) => overlapOf(d.quad, c.quad) > 0.6);
		const d = distinct[k];
		if (!d) {
			distinct.push(c);
			leader.set(c, area.get(c) ?? 0);
		} else if (
			// two frames drawn by edge runs about the same size: the one with the sharper sides
			// hugs the photo, the other takes in a strip of the card beside it
			c.fill !== undefined &&
			d.fill !== undefined &&
			meanStep(c) > 1.2 * meanStep(d) &&
			(area.get(c) ?? 0) >= 0.8 * (leader.get(d) ?? 0)
		) {
			distinct[k] = c;
			leader.set(c, leader.get(d) ?? 0);
		}
	}
	const areas = distinct.map((f) => area.get(f) ?? 0).sort((a, b) => a - b);
	const median = areas[Math.floor(areas.length / 2)] ?? 0;
	const sized = distinct.filter((f) => {
		const a = area.get(f) ?? 0;
		return a >= 0.4 * median && a <= 2.5 * median;
	});
	// a frame lying almost wholly inside one at most 2.5 times its size is a detail of that photo
	// (a fringe, a collar); inside a much larger one it is the photo, and the other is not
	const whole = sized.filter(
		(f) =>
			!sized.some(
				(g) =>
					g !== f &&
					(area.get(g) ?? 0) > (area.get(f) ?? 0) &&
					(area.get(f) ?? 0) >= 0.4 * (area.get(g) ?? 0) &&
					insideOf(f.quad, g.quad) > 0.85,
			),
	);
	const kept = [...whole].sort((a, b) => frameScore(b) - frameScore(a)).slice(0, o.maxFrames);
	return readingOrder(kept);
}

/**
 * Rows from top to bottom (a frame joins a row when they overlap vertically by more than half the
 * smaller height), left to right inside a row: the order of the drop-downs.
 */
export function readingOrder<T extends { quad: Quad }>(frames: readonly T[]): T[] {
	const extent = (q: Quad): { top: number; bottom: number } => ({
		top: Math.min(...q.map((p) => p.y)),
		bottom: Math.max(...q.map((p) => p.y)),
	});
	const centre = (q: Quad, axis: "x" | "y"): number => q.reduce((sum, p) => sum + p[axis], 0) / 4;
	const rows: { top: number; bottom: number; items: T[] }[] = [];
	for (const f of [...frames].sort((a, b) => centre(a.quad, "y") - centre(b.quad, "y"))) {
		const { top, bottom } = extent(f.quad);
		const row = rows.find(
			(r) =>
				Math.min(bottom, r.bottom) - Math.max(top, r.top) >
				0.5 * Math.min(bottom - top, r.bottom - r.top),
		);
		if (row) {
			row.items.push(f);
		} else {
			rows.push({ top, bottom, items: [f] });
		}
	}
	return rows.flatMap((r) => r.items.sort((a, b) => centre(a.quad, "x") - centre(b.quad, "x")));
}

/**
 * A straight edge run, horizontal (`pos` is its y, it spans `a`–`b` in x) or vertical (`pos` is
 * its x, spanning `a`–`b` in y), in the pixels of the picture it was found in.
 */
export interface EdgeRun {
	pos: number;
	a: number;
	b: number;
}

interface EdgeLine {
	pos: number;
	runs: EdgeRun[];
}

/** The runs grouped into lines: runs whose positions lie within `tolerance` of the line's. */
function linesOf(runs: readonly EdgeRun[], tolerance: number): EdgeLine[] {
	const lines: EdgeLine[] = [];
	for (const run of [...runs].sort((x, y) => x.pos - y.pos)) {
		const last = lines.at(-1);
		if (last && run.pos - last.pos <= tolerance) {
			last.runs.push(run);
			last.pos = last.runs.reduce((sum, r) => sum + r.pos, 0) / last.runs.length;
		} else {
			lines.push({ pos: run.pos, runs: [run] });
		}
	}
	return lines;
}

/**
 * True when a line draws the side `a`–`b` of a frame: it covers most of it and does not go on
 * past both corners (the edge of a card or of a row of cards does; the border of a photo stops at
 * its corners, though a printed line beside it may carry on at one end); or, when the photo is
 * glued so close to the edge of its card or sleeve that both lie on one line, its own runs (those
 * that stop near the corners) cover most of it.
 */
function drawsSide(line: EdgeLine, a: number, b: number, minCover: number): boolean {
	const beyond = 0.25 * (b - a);
	if (
		coverOf(line, a, b) >= minCover &&
		(coverOf(line, a - beyond, a) < 0.5 || coverOf(line, b, b + beyond) < 0.5)
	) {
		return true;
	}
	const own = line.runs.filter((r) => r.a >= a - beyond && r.b <= b + beyond);
	return coverOf({ pos: line.pos, runs: own }, a, b) >= minCover;
}

/** How much of `a`–`b` the runs of a line cover (0–1). */
function coverOf(line: EdgeLine, a: number, b: number): number {
	const parts = line.runs
		.map((r) => [Math.max(a, r.a), Math.min(b, r.b)] as const)
		.filter(([x, y]) => y > x)
		.sort((x, y) => x[0] - y[0]);
	let covered = 0;
	let end = a;
	for (const [x, y] of parts) {
		if (y > end) {
			covered += y - Math.max(x, end);
			end = y;
		}
	}
	return b > a ? covered / (b - a) : 0;
}

export interface RunRectangleOptions {
	/** Runs this close (px) belong to one line. */
	tolerance: number;
	minWidth: number;
	maxWidth: number;
	/** Height / width. */
	minAspect: number;
	maxAspect: number;
	/** The part of every side the runs must cover. */
	minCover: number;
}

/**
 * The upright rectangles whose four sides are mostly covered by edge runs: a left and a right line
 * at a plausible width, a top and a bottom line that cover the span between them, at a portrait
 * proportion, and both upright lines covering the span between those. Whatever else touches the
 * sides (a stamp across a corner, the ruled lines of a card) does not matter, unlike a contour. The
 * runs may lean by a few pixels (a scan placed slightly askew): the frames' corners are refined
 * on the picture afterwards.
 */
export function rectanglesFromRuns(
	across: readonly EdgeRun[],
	down: readonly EdgeRun[],
	o: RunRectangleOptions,
): Quad[] {
	const rows = linesOf(across, o.tolerance);
	const columns = linesOf(down, o.tolerance);
	const out: Quad[] = [];
	for (let i = 0; i < columns.length; i++) {
		const left = columns[i];
		if (!left) {
			continue;
		}
		for (let j = i + 1; j < columns.length; j++) {
			const right = columns[j];
			if (!right) {
				continue;
			}
			const width = right.pos - left.pos;
			if (width < o.minWidth) {
				continue;
			}
			if (width > o.maxWidth) {
				break;
			}
			const sides = rows.filter((r) => drawsSide(r, left.pos, right.pos, o.minCover));
			for (let t = 0; t < sides.length; t++) {
				const top = sides[t];
				if (!top) {
					continue;
				}
				for (let k = t + 1; k < sides.length; k++) {
					const bottom = sides[k];
					if (!bottom) {
						continue;
					}
					const aspect = (bottom.pos - top.pos) / width;
					if (aspect < o.minAspect) {
						continue;
					}
					if (aspect > o.maxAspect) {
						break;
					}
					if (
						drawsSide(left, top.pos, bottom.pos, o.minCover) &&
						drawsSide(right, top.pos, bottom.pos, o.minCover)
					) {
						out.push(
							rectQuad({ x: left.pos, y: top.pos }, { x: right.pos, y: bottom.pos }),
						);
					}
				}
			}
		}
	}
	return out;
}

/**
 * The long straight edge runs of a picture: the colour edges (Canny on R, G and B, low thresholds:
 * the border of a pale photo on a white card is faint), of which a morphological opening with a
 * long thin kernel keeps only what goes on straight for `LINE_RUN` of the picture, across and
 * down; each piece left is a run.
 */
function edgeRuns(
	cv: CvModule,
	blurred: InstanceType<CvModule["Mat"]>,
): { across: EdgeRun[]; down: EdgeRun[] } {
	const rgb = new cv.Mat();
	const edges = new cv.Mat();
	const open = new cv.Mat();
	const grow = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
	const length = Math.max(15, Math.round(LINE_RUN * Math.max(blurred.cols, blurred.rows)));
	try {
		cv.cvtColor(blurred, rgb, cv.COLOR_RGBA2RGB);
		cv.Canny(rgb, edges, 10, 30);
		cv.dilate(edges, edges, grow);
		const runsOf = (kernel: InstanceType<CvModule["Mat"]>, across: boolean): EdgeRun[] => {
			const contours = new cv.MatVector();
			const hierarchy = new cv.Mat();
			try {
				cv.morphologyEx(edges, open, cv.MORPH_OPEN, kernel);
				cv.findContours(
					open,
					contours,
					hierarchy,
					cv.RETR_EXTERNAL,
					cv.CHAIN_APPROX_SIMPLE,
				);
				const runs: EdgeRun[] = [];
				for (let i = 0; i < contours.size(); i++) {
					const contour = contours.get(i);
					try {
						const r = cv.boundingRect(contour);
						runs.push(
							across
								? { pos: r.y + r.height / 2, a: r.x, b: r.x + r.width }
								: { pos: r.x + r.width / 2, a: r.y, b: r.y + r.height },
						);
					} finally {
						contour.delete();
					}
				}
				return runs;
			} finally {
				contours.delete();
				hierarchy.delete();
				kernel.delete();
			}
		};
		return {
			across: runsOf(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(length, 1)), true),
			down: runsOf(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, length)), false),
		};
	} finally {
		for (const m of [rgb, edges, open, grow]) {
			m.delete();
		}
	}
}

/**
 * The paper of a picture: the grey level brighter than nine pixels in ten (a page of cards is
 * mostly paper), sampled on a grid.
 */
export function paperLevel(px: Pixels): number {
	const step = Math.max(1, Math.round(Math.sqrt((px.width * px.height) / 20_000)));
	const levels: number[] = [];
	for (let y = 0; y < px.height; y += step) {
		for (let x = 0; x < px.width; x += step) {
			const k = (y * px.width + x) * 4;
			levels.push(((px.data[k] ?? 0) + (px.data[k + 1] ?? 0) + (px.data[k + 2] ?? 0)) / 3);
		}
	}
	levels.sort((a, b) => a - b);
	return levels[Math.floor(levels.length * 0.9)] ?? 255;
}

/**
 * Along one side of an upright frame (0 top, 1 right, 2 bottom, 3 left), the part that is not
 * paper: darker or lighter than the paper by `PAPER_STEP` levels (a card in a plastic sleeve
 * scans grey, a photo's white background lighter), or coloured. `depths` are the bands sampled,
 * as fractions of the frame across from that side. Points off the picture are left out.
 */
function sideInk(
	px: Pixels,
	quad: Quad,
	paper: number,
	side: number,
	depths: readonly number[],
): number {
	const xs = quad.map((p) => p.x);
	const ys = quad.map((p) => p.y);
	const x0 = Math.min(...xs);
	const x1 = Math.max(...xs);
	const y0 = Math.min(...ys);
	const y1 = Math.max(...ys);
	const w = x1 - x0;
	const h = y1 - y0;
	// (along, across) → a point, `across` 0 on the side and 1 on the opposite one
	const at = [
		(u: number, v: number): [number, number] => [x0 + w * u, y0 + h * v],
		(u: number, v: number): [number, number] => [x1 - w * v, y0 + h * u],
		(u: number, v: number): [number, number] => [x0 + w * u, y1 - h * v],
		(u: number, v: number): [number, number] => [x0 + w * v, y0 + h * u],
	][side];
	if (!at) {
		return 0;
	}
	let ink = 0;
	let total = 0;
	for (let i = 0; i < 24; i++) {
		for (const v of depths) {
			const [x, y] = at(0.1 + (0.8 * (i + 0.5)) / 24, v).map(Math.floor) as [number, number];
			if (x < 0 || y < 0 || x >= px.width || y >= px.height) {
				continue;
			}
			total++;
			if (notPaper(px, x, y, paper)) {
				ink++;
			}
		}
	}
	return total > 0 ? ink / total : 0;
}

/**
 * How full a frame drawn by edge runs is along its sides: in a band just inside each side (3 to
 * 15 % of the frame across), the part that is not paper; the weakest side. A photo is full of
 * hair, faces, clothes and a grey or coloured background, even a pale one, right up to its
 * border (a print's white is not the card's); a rectangle that takes in the gap between
 * two cards, or a strip of the card beside the photo, has a side of paper.
 */
export function inkFill(px: Pixels, quad: Quad, paper: number): number {
	return Math.min(...[0, 1, 2, 3].map((s) => sideInk(px, quad, paper, s, INSIDE)));
}

/**
 * How much a frame drawn by edge runs looks like a photo: `inkFill`, or, for a portrait on a white
 * background (the top band and the sides are paper there, the face and the clothes are not), the
 * fill of its middle when the bottom band is full and both sides half full; 0 otherwise.
 */
export function photoFill(px: Pixels, quad: Quad, paper: number): number {
	const fill = inkFill(px, quad, paper);
	if (fill >= MIN_FILL) {
		return fill;
	}
	const [, right, bottom, left] = [0, 1, 2, 3].map((s) => sideInk(px, quad, paper, s, INSIDE));
	const middle = middleInk(px, quad, paper);
	return middle >= MIN_MIDDLE &&
		(bottom ?? 0) >= MIN_BOTTOM &&
		Math.min(right ?? 0, left ?? 0) >= MIN_SIDE
		? middle
		: 0;
}

/** The part of the middle of an upright frame (30–70 % across and down: a face) that is not paper. */
export function middleInk(px: Pixels, quad: Quad, paper: number): number {
	const xs = quad.map((p) => p.x);
	const ys = quad.map((p) => p.y);
	const x0 = Math.min(...xs);
	const y0 = Math.min(...ys);
	const w = Math.max(...xs) - x0;
	const h = Math.max(...ys) - y0;
	let ink = 0;
	let total = 0;
	for (let i = 0; i < 12; i++) {
		for (let j = 0; j < 12; j++) {
			const x = Math.floor(x0 + w * (0.3 + (0.4 * (i + 0.5)) / 12));
			const y = Math.floor(y0 + h * (0.3 + (0.4 * (j + 0.5)) / 12));
			if (x < 0 || y < 0 || x >= px.width || y >= px.height) {
				continue;
			}
			total++;
			if (notPaper(px, x, y, paper)) {
				ink++;
			}
		}
	}
	return total > 0 ? ink / total : 0;
}

/** Darker or lighter than the paper by `PAPER_STEP` levels, or coloured. */
function notPaper(px: Pixels, x: number, y: number, paper: number): boolean {
	const k = (y * px.width + x) * 4;
	const r = px.data[k] ?? 0;
	const g = px.data[k + 1] ?? 0;
	const b = px.data[k + 2] ?? 0;
	return (
		Math.abs((r + g + b) / 3 - paper) > PAPER_STEP ||
		Math.max(r, g, b) - Math.min(r, g, b) > 2 * PAPER_STEP
	);
}

const INSIDE = [0.03, 0.07, 0.11, 0.15];

/** How far from the paper's grey, or how coloured, a pixel of a photo is at least. */
const PAPER_STEP = 12;
/** The part of a frame drawn by edge runs that must not be paper (`inkFill`). */
const MIN_FILL = 0.5;
/** A portrait on a white background (`photoFill`): its middle, its bottom band, its sides. */
const MIN_MIDDLE = 0.9;
const MIN_BOTTOM = 0.7;
const MIN_SIDE = 0.4;
/**
 * The part of every side of a frame that its line must draw: the border of a photo is a line from
 * corner to corner, the rectangles that strands of hair or a collar draw inside a photo are not.
 */
const MIN_COVER = 0.8;

/** The shortest straight edge run `edgeRuns` keeps, as a fraction of the picture's longest side. */
const LINE_RUN = 0.03;

/**
 * The angles (degrees, within ±45 and away from upright) of the long straight edges of a scan:
 * cards laid askew. Each angle gathers the length of its lines, with its neighbours half a degree
 * away (a card's edges spread over a degree); the strongest are kept, those carrying at least
 * `ANGLE_SHARE` of the first, at most `count`, a degree and a half apart.
 */
export function scanAngles(
	cv: CvModule,
	blurred: InstanceType<CvModule["Mat"]>,
	count: number,
): number[] {
	const gray = new cv.Mat();
	const edges = new cv.Mat();
	const lines = new cv.Mat();
	try {
		cv.cvtColor(blurred, gray, cv.COLOR_RGBA2GRAY);
		cv.Canny(gray, edges, 15, 45);
		const side = Math.max(blurred.cols, blurred.rows);
		cv.HoughLinesP(
			edges,
			lines,
			1,
			Math.PI / 360,
			40,
			Math.round(0.05 * side),
			Math.round(0.006 * side),
		);
		const weight = new Map<number, number>();
		// one row of four coordinates per segment (OpenCV.js packs them in `data32S`)
		const segments = lines.data32S;
		for (let i = 0; i + 3 < segments.length; i += 4) {
			const dx = (segments[i + 2] ?? 0) - (segments[i] ?? 0);
			const dy = (segments[i + 3] ?? 0) - (segments[i + 1] ?? 0);
			let a = (Math.atan2(dy, dx) * 180) / Math.PI;
			while (a > 45) {
				a -= 90;
			}
			while (a <= -45) {
				a += 90;
			}
			const bin = Math.round(a * 2) / 2;
			weight.set(bin, (weight.get(bin) ?? 0) + Math.hypot(dx, dy));
		}
		const smooth = new Map<number, number>();
		for (const a of weight.keys()) {
			for (const b of [a - 0.5, a, a + 0.5]) {
				smooth.set(
					b,
					(weight.get(b - 0.5) ?? 0) + (weight.get(b) ?? 0) + (weight.get(b + 0.5) ?? 0),
				);
			}
		}
		const strongest = Math.max(0, ...smooth.values());
		const peaks: number[] = [];
		for (const [a, w] of [...smooth.entries()].sort((x, y) => y[1] - x[1])) {
			if (peaks.length >= count || w < ANGLE_SHARE * strongest) {
				break;
			}
			if (Math.abs(a) >= MIN_TURN && peaks.every((p) => Math.abs(p - a) >= 1.5)) {
				peaks.push(a);
			}
		}
		return peaks;
	} finally {
		gray.delete();
		edges.delete();
		lines.delete();
	}
}

/**
 * The frames drawn by edge runs in the picture turned by `angle` degrees (0: as it is), in the
 * coordinates of the picture: the picture is turned so that the cards laid at that angle stand
 * upright (onto a canvas large enough, its new corners copied from the edges), the upright
 * rectangles whose middle looks like a photo (`photoFill`) are found there and turned back.
 */
function runRectangles(
	cv: CvModule,
	small: InstanceType<CvModule["Mat"]>,
	blurred: InstanceType<CvModule["Mat"]>,
	angle: number,
	o: { minAreaRatio: number; minAspect: number; maxAspect: number },
): { points: Point[]; fill: number }[] {
	const w = blurred.cols;
	const h = blurred.rows;
	const rad = (angle * Math.PI) / 180;
	const width = Math.round(w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad)));
	const height = Math.round(w * Math.abs(Math.sin(rad)) + h * Math.abs(Math.cos(rad)));
	const m = cv.getRotationMatrix2D(new cv.Point(w / 2, h / 2), angle, 1);
	const turned = new cv.Mat();
	try {
		const a = [0, 1, 2].flatMap((c) => [m.doubleAt(0, c), m.doubleAt(1, c)]) as [
			number,
			number,
			number,
			number,
			number,
			number,
		];
		// [m00, m10, m01, m11, m02, m12]; the turned picture moved to the middle of its canvas
		const [m00, m10, m01, m11] = a;
		const m02 = a[4] + (width - w) / 2;
		const m12 = a[5] + (height - h) / 2;
		if (angle === 0) {
			blurred.copyTo(turned);
		} else {
			// the sharp picture is turned, then blurred like the upright one: a faint border
			// survives one interpolation, not two
			const map = cv.matFromArray(2, 3, cv.CV_64F, [m00, m01, m02, m10, m11, m12]);
			try {
				cv.warpAffine(
					small,
					turned,
					map,
					new cv.Size(width, height),
					cv.INTER_LINEAR,
					cv.BORDER_REPLICATE,
				);
				cv.GaussianBlur(turned, turned, new cv.Size(3, 3), 0);
			} finally {
				map.delete();
			}
		}
		const det = m00 * m11 - m01 * m10;
		const back = (p: Point): Point =>
			angle === 0
				? p
				: {
						x: (m11 * (p.x - m02) - m01 * (p.y - m12)) / det,
						y: (-m10 * (p.x - m02) + m00 * (p.y - m12)) / det,
					};
		const { across, down } = edgeRuns(cv, turned);
		const pixels: Pixels = { width: turned.cols, height: turned.rows, data: turned.data };
		const paper = paperLevel(pixels);
		const out: { points: Point[]; fill: number }[] = [];
		for (const q of rectanglesFromRuns(across, down, {
			tolerance: Math.max(3, Math.round(0.006 * Math.max(w, h))),
			minWidth: Math.sqrt((Math.max(o.minAreaRatio, RUN_MIN_AREA) * w * h) / o.maxAspect),
			maxWidth: turned.cols,
			minAspect: o.minAspect,
			maxAspect: o.maxAspect,
			minCover: MIN_COVER,
		})) {
			const fill = photoFill(pixels, q, paper);
			if (fill > 0) {
				out.push({ points: q.map(back), fill });
			}
		}
		return out;
	} finally {
		turned.delete();
		m.delete();
	}
}

/** The share of the strongest angle's lines another angle needs to be looked at (`scanAngles`). */
const ANGLE_SHARE = 0.15;
/**
 * The smallest frame drawn by edge runs, as a part of the picture: the rectangles found inside a
 * stamp's rings are smaller (calibrated on ten real scans, 9.26).
 */
const RUN_MIN_AREA = 0.005;

/** The smallest angle (degrees) the picture is turned by. */
const MIN_TURN = 1.5;

/**
 * Snaps the candidates onto their edges and scores them, in the coordinates of the picture: a
 * quadrilateral comes as its corners, a rectangle drawn by edge runs with its `fill` (its four
 * sides checked already, see `rectanglesFromRuns`).
 */
function scoreFrames(
	blurred: InstanceType<CvModule["Mat"]>,
	scale: number,
	found: readonly (Point[] | { points: Point[]; fill: number })[],
	o: FrameOptions & { minContrast: number },
): Frame[] {
	// read the pixels only now: allocating Mats can grow the wasm heap and detach older views
	const px: Pixels = { width: blurred.cols, height: blurred.rows, data: blurred.data };
	const maxShift = Math.max(4, Math.round(0.01 * Math.max(px.width, px.height)));
	const scored: { from: Quad; frame: Frame; cut: boolean }[] = [];
	for (const candidate of found) {
		const fill = Array.isArray(candidate) ? undefined : candidate.fill;
		// a frame drawn by edge runs comes in its own order (top left first, turned with its
		// card): sorting the corners again would start a card laid at 40° on another corner
		const from = Array.isArray(candidate)
			? orderCorners(candidate)
			: (candidate.points as Quad);
		if (scored.some((d) => d.from.every((p, i) => dist(p, from[i] ?? p) <= 1.5))) {
			continue;
		}
		const quad = refineQuad(px, from, maxShift);
		const sides = sideContrasts(px, quad, 2);
		scored.push({
			from,
			frame: {
				quad: scaleQuad(quad, 1 / scale),
				sides,
				...(fill === undefined ? {} : { fill }),
			},
			// a stamp or a printed line carries on past a photo's corner on a card: the corners
			// of a frame drawn by edge runs are where its four lines end, not a false corner
			cut: fill === undefined && continuesPastCorner(px, quad, sides, o.minContrast),
		});
	}
	o.inspect?.(scored.map((s) => ({ ...s.frame, cut: s.cut })));
	return scored.filter((s) => !s.cut).map((s) => s.frame);
}

/**
 * Finds the photo frames of a class picture: each pass of the cover detection proposes the convex
 * quadrilaterals of its edge map, each is snapped onto its edges and scored, `selectFrames` keeps
 * the frames. When they are fewer than `linesBelow` (a scan, or a photo of one), the rectangles
 * drawn by long straight edges are looked for too, and replace them when they find more photos:
 * the same picture gives the same frames as a photo and as a scan. Corners in the coordinates of
 * `image`.
 */
export function detectFrames(cv: CvModule, image: ImageData, options: FrameOptions = {}): Frame[] {
	const o = { ...FRAME_DEFAULTS, ...options };
	const scale = Math.min(1, o.maxSide / Math.max(image.width, image.height));
	const src = cv.matFromImageData(image);
	const small = new cv.Mat();
	const blurred = new cv.Mat();
	try {
		if (scale < 1) {
			cv.resize(src, small, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
		} else {
			src.copyTo(small);
		}
		cv.GaussianBlur(small, blurred, new cv.Size(3, 3), 0);
		const outlined: Point[][] = [];
		for (const pass of o.passes ?? DETECT_PASSES) {
			const { map, factor } = edgeMap(cv, small, blurred, pass);
			try {
				for (const q of quadCandidates(cv, map, o.minAreaRatio)) {
					outlined.push(
						q.points.map((p) => ({ x: (p.x + 0.5) * factor, y: (p.y + 0.5) * factor })),
					);
				}
			} finally {
				map.delete();
			}
		}
		const quads = selectFrames(scoreFrames(blurred, scale, outlined, o), o);
		// a scan sent as a photo: its flat photos are outlined by few quadrilaterals (the passes of
		// a photo find whole cards and details of faces there), and better drawn by edge runs
		if (!o.lines || quads.length >= o.linesBelow) {
			return quads;
		}
		// the picture as it is first; a turn adds only the photos it did not outline (a turn
		// close to a card's own angle outlines it a little wide)
		const upright = runRectangles(cv, small, blurred, 0, o);
		const drawn = [...upright];
		for (const angle of o.turns > 0 ? scanAngles(cv, blurred, o.turns) : []) {
			for (const r of runRectangles(cv, small, blurred, angle, o)) {
				const quad = orderCorners(r.points);
				if (!upright.some((u) => overlapOf(orderCorners(u.points), quad) > 0.3)) {
					drawn.push(r);
				}
			}
		}
		// the rectangles replace the quadrilaterals when they find more photos, some of them not
		// outlined by any quadrilateral: on a photo in perspective they find the same photos, a
		// little off
		const rectangles = selectFrames(scoreFrames(blurred, scale, drawn, o), o);
		const more = rectangles.filter((r) => !quads.some((q) => overlapOf(q.quad, r.quad) > 0.5));
		return rectangles.length > quads.length && more.length > 0 ? rectangles : quads;
	} finally {
		src.delete();
		small.delete();
		blurred.delete();
	}
}
