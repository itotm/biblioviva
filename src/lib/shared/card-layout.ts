// SPDX-License-Identifier: GPL-3.0-or-later
// Where the cards go on an A4 sheet (PLAN.md §3.12, steps 2.5 and 9.27, Q127): front and back side
// by side on one side of the sheet (folded on the short edge), or front and back on the two sides
// of the sheet — the fronts on one page, the backs on the next at the mirrored places, moved by the
// calibrated offset. Pure geometry in millimetres from the top-left corner of the paper.
import { PAPER_MM } from "./paper.js";

export const CARD_LAYOUTS = ["side-by-side", "duplex"] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];
/** How the printer turns the sheet for its second side: as a book (long edge) or a calendar. */
export const DUPLEX_FLIPS = ["long-edge", "short-edge"] as const;
export type DuplexFlip = (typeof DUPLEX_FLIPS)[number];

const A4 = PAPER_MM.A4;

export interface CardSheetSettings {
	cardW: number;
	cardH: number;
	/** Side by side: units one under the other on a sheet. */
	rows: number;
	marginMm: number;
	gapMm: number;
	flip: DuplexFlip;
	backOffsetMm: { x: number; y: number };
}

/** A place on a page, in mm from the paper's top-left corner. */
export interface Place {
	x: number;
	y: number;
}

/** The spacing of a sheet of cards a card size is checked against. */
export interface CardSheetSpacing {
	/** Side by side: the units asked on a page. */
	rows: number;
	marginMm: number;
	gapMm: number;
}

/** How a card size sits on an A4 sheet. */
export interface CardSheetFit {
	/**
	 * Front and back side by side fit inside the margins (and so does one card on each side of a
	 * sheet printed on both sides): the one rule a card size must keep.
	 */
	fits: boolean;
	/** Side by side: the units on a page, at most the rows asked (0 when the card does not fit). */
	rows: number;
	/** The rows asked fit the page. */
	rowsFit: boolean;
	/** The largest card that fits. */
	max: { width: number; height: number };
}

/**
 * The one check of a card size against the sheet (the configuration, the template editor, the
 * print jobs): front and back side by side inside the margins, and the rows of such units that
 * fit the page.
 */
export function cardSheetFit(
	card: { width: number; height: number },
	sheet: CardSheetSpacing,
): CardSheetFit {
	const round = (v: number): number => Math.round(v * 100) / 100;
	const max = {
		width: round((A4.width - 2 * sheet.marginMm) / 2),
		height: round(A4.height - 2 * sheet.marginMm),
	};
	const fits =
		card.width > 0 && card.height > 0 && card.width <= max.width && card.height <= max.height;
	const room = Math.floor(
		(A4.height - 2 * sheet.marginMm + sheet.gapMm) / (card.height + sheet.gapMm) + 1e-9,
	);
	return {
		fits,
		rows: fits ? Math.min(sheet.rows, room) : 0,
		rowsFit: fits && room >= sheet.rows,
		max,
	};
}

/** What is wrong with a card size that does not fit (configuration and template problems). */
export function cardFitProblem(card: { width: number; height: number }, fit: CardSheetFit): string {
	return `a card of ${card.width} × ${card.height} mm does not fit an A4 sheet (at most ${fit.max.width} × ${fit.max.height} mm)`;
}

/** The side-by-side unit (front and back) of every row of a sheet, centred across the paper. */
export function sideBySidePlaces(s: CardSheetSettings): Place[] {
	const x = (A4.width - 2 * s.cardW) / 2;
	return Array.from({ length: s.rows }, (_, row) => ({
		x,
		y: s.marginMm + row * (s.cardH + s.gapMm),
	}));
}

/** How many cards fit across and down a page printed on both sides, inside the margins. */
export function duplexGrid(s: CardSheetSettings): { columns: number; rows: number } {
	const fit = (room: number, size: number): number =>
		Math.max(0, Math.floor((room - 2 * s.marginMm + s.gapMm) / (size + s.gapMm)));
	return { columns: fit(A4.width, s.cardW), rows: fit(A4.height, s.cardH) };
}

/** The fronts of a page printed on both sides, in reading order, the grid centred across. */
export function duplexFronts(s: CardSheetSettings): Place[] {
	const { columns, rows } = duplexGrid(s);
	const x0 = (A4.width - (columns * s.cardW + (columns - 1) * s.gapMm)) / 2;
	const places: Place[] = [];
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			places.push({
				x: x0 + column * (s.cardW + s.gapMm),
				y: s.marginMm + row * (s.cardH + s.gapMm),
			});
		}
	}
	return places;
}

/**
 * Where the back of the card whose front is at `front` goes on the next page: the mirrored place
 * (the column for a sheet turned on its long edge, the row for one turned on its short edge),
 * moved by the calibrated offset. The face itself is never mirrored or turned.
 */
export function backOf(front: Place, s: CardSheetSettings): Place {
	const mirrored =
		s.flip === "long-edge"
			? { x: A4.width - front.x - s.cardW, y: front.y }
			: { x: front.x, y: A4.height - front.y - s.cardH };
	return { x: mirrored.x + s.backOffsetMm.x, y: mirrored.y + s.backOffsetMm.y };
}

/** The calibration card (9.27): large, so a millimetre is easy to read on its rulers. */
export const CALIBRATION_CARD = { width: 150, height: 100 } as const;
/** How far the calibration rulers reach either way, in mm. */
export const CALIBRATION_RANGE = 10;

/** The calibration card's front, centred on the page. */
export function calibrationFront(): Place {
	return {
		x: (A4.width - CALIBRATION_CARD.width) / 2,
		y: (A4.height - CALIBRATION_CARD.height) / 2,
	};
}

/**
 * Where, on the back page, the cut edges of the calibration card's front should fall: the
 * horizontal ruler crosses the edge that is the front's left one, the vertical ruler the front's
 * top one. A value read on a ruler where the cut edge really falls is added to the offset.
 */
export function calibrationEdges(s: Pick<CardSheetSettings, "flip" | "backOffsetMm">): {
	/** The x of the front's left edge on the back page (the horizontal ruler's 0). */
	leftX: number;
	/** The y of the front's top edge on the back page (the vertical ruler's 0). */
	topY: number;
	/** The back's place, as `backOf` gives it. */
	back: Place;
} {
	const front = calibrationFront();
	const back = backOf(front, {
		cardW: CALIBRATION_CARD.width,
		cardH: CALIBRATION_CARD.height,
		rows: 1,
		marginMm: 0,
		gapMm: 0,
		...s,
	});
	return {
		leftX: s.flip === "long-edge" ? back.x + CALIBRATION_CARD.width : back.x,
		topY: s.flip === "long-edge" ? back.y : back.y + CALIBRATION_CARD.height,
		back,
	};
}

/** The offset after a calibration: the values read on the rulers added to the one in use. */
export function calibratedOffset(
	current: { x: number; y: number },
	read: { x: number; y: number },
): { x: number; y: number } {
	const clamp = (v: number): number =>
		Math.max(-CALIBRATION_RANGE, Math.min(CALIBRATION_RANGE, Math.round(v * 10) / 10));
	return { x: clamp(current.x + read.x), y: clamp(current.y + read.y) };
}

/** A box on a page, in mm from the paper's top-left corner. */
export interface Rect extends Place {
	w: number;
	h: number;
}

/** A short line of the crop marks, in mm from the paper's top-left corner. */
export interface MarkLine {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	/** The fold of a side-by-side unit (drawn dashed), not a cut. */
	fold?: boolean;
}

/** How far a mark stays from the card it points at, and how long it is at most. */
const MARK_GAP = 1;
const MARK_LENGTH = 5;

/**
 * The crop marks of a page (step 11.17): every cut line of the boxes is extended outside them by a
 * short line in the free space it crosses — the margins of the paper and the gaps between the
 * boxes —, never over a card, so a ruler laid on two marks cuts along the edge with a cutter.
 * `folds` adds the fold of each side-by-side unit (the x of the line) in the same way.
 */
export function cropMarks(rects: readonly Rect[], folds: readonly number[] = []): MarkLine[] {
	const lines: MarkLine[] = [];
	const round = (v: number): number => Math.round(v * 100) / 100;
	/** The free stretches along a line crossing `[0, size]`, given the spans the boxes cover. */
	const free = (covered: [number, number][], size: number): [number, number][] => {
		const spans = [...covered].sort((a, b) => a[0] - b[0]);
		const out: [number, number][] = [];
		let at = 0;
		for (const [from, to] of spans) {
			if (from > at) {
				out.push([at, from]);
			}
			at = Math.max(at, to);
		}
		if (at < size) {
			out.push([at, size]);
		}
		return out;
	};
	/** The marks in a free stretch: next to the box edges that bound it, at most 5 mm long. */
	const marks = (from: number, to: number, size: number): [number, number][] => {
		const afterBox = from > 0;
		const beforeBox = to < size;
		const room = to - from;
		if (afterBox && beforeBox && room <= 2 * (MARK_GAP + MARK_LENGTH)) {
			// a gap between two boxes: one mark across it, clear of both
			return room > 2 * MARK_GAP ? [[from + MARK_GAP / 2, to - MARK_GAP / 2]] : [];
		}
		const out: [number, number][] = [];
		if (afterBox) {
			out.push([from + MARK_GAP, Math.min(to, from + MARK_GAP + MARK_LENGTH)]);
		}
		if (beforeBox) {
			out.push([Math.max(from, to - MARK_GAP - MARK_LENGTH), to - MARK_GAP]);
		}
		return out.filter(([a, b]) => b - a > 0.5);
	};
	const xs = new Map<number, boolean>();
	const ys = new Set<number>();
	for (const r of rects) {
		xs.set(round(r.x), false).set(round(r.x + r.w), false);
		ys.add(round(r.y)).add(round(r.y + r.h));
	}
	for (const f of folds) {
		xs.set(round(f), true);
	}
	for (const [x, fold] of xs) {
		const covered = rects
			.filter((r) => x > r.x - 0.01 && x < r.x + r.w + 0.01)
			.map((r): [number, number] => [r.y, r.y + r.h]);
		for (const [from, to] of free(covered, A4.height)) {
			for (const [a, b] of marks(from, to, A4.height)) {
				lines.push({ x1: x, y1: round(a), x2: x, y2: round(b), ...(fold ? { fold } : {}) });
			}
		}
	}
	for (const y of ys) {
		const covered = rects
			.filter((r) => y > r.y - 0.01 && y < r.y + r.h + 0.01)
			.map((r): [number, number] => [r.x, r.x + r.w]);
		for (const [from, to] of free(covered, A4.width)) {
			for (const [a, b] of marks(from, to, A4.width)) {
				lines.push({ x1: round(a), y1: y, x2: round(b), y2: y });
			}
		}
	}
	return lines;
}
