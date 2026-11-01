// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	backOf,
	CALIBRATION_CARD,
	calibratedOffset,
	calibrationEdges,
	calibrationFront,
	cardSheetFit,
	cropMarks,
	duplexFronts,
	duplexGrid,
	sideBySidePlaces,
	type CardSheetSettings,
} from "./card-layout.js";

const cr80: CardSheetSettings = {
	cardW: 85.6,
	cardH: 53.98,
	rows: 4,
	marginMm: 6,
	gapMm: 3,
	flip: "long-edge",
	backOffsetMm: { x: 0, y: 0 },
};

describe("card layout (9.27)", () => {
	it("places the side-by-side units centred, one row under the other", () => {
		const places = sideBySidePlaces(cr80);
		expect(places).toHaveLength(4);
		expect(places[0]?.x).toBeCloseTo((210 - 171.2) / 2);
		expect(places[0]?.y).toBe(6);
		expect(places[1]?.y).toBeCloseTo(6 + 53.98 + 3);
	});

	it("fits ten cards on a sheet printed on both sides, the grid centred", () => {
		expect(duplexGrid(cr80)).toEqual({ columns: 2, rows: 5 });
		const fronts = duplexFronts(cr80);
		expect(fronts).toHaveLength(10);
		const left = (210 - (2 * 85.6 + 3)) / 2;
		expect(fronts[0]).toEqual({ x: left, y: 6 });
		expect(fronts[1]?.x).toBeCloseTo(left + 88.6);
		expect(fronts[2]).toEqual({ x: left, y: 6 + 56.98 });
		// a card too large for the page fits nowhere
		expect(duplexGrid({ ...cr80, cardW: 250 })).toEqual({ columns: 0, rows: 5 });
	});

	it("puts each back at the mirrored place of its front, the face never turned", () => {
		const [first] = duplexFronts(cr80);
		// a sheet turned on its long edge mirrors the columns
		const long = backOf(first!, cr80);
		expect(long.x).toBeCloseTo(210 - first!.x - 85.6);
		expect(long.y).toBe(first!.y);
		// on its short edge, the rows
		const short = backOf(first!, { ...cr80, flip: "short-edge" });
		expect(short.x).toBe(first!.x);
		expect(short.y).toBeCloseTo(297 - first!.y - 53.98);
		// the calibrated offset moves the backs only
		const moved = backOf(first!, { ...cr80, backOffsetMm: { x: 1.5, y: -0.5 } });
		expect(moved.x).toBeCloseTo(long.x + 1.5);
		expect(moved.y).toBeCloseTo(long.y - 0.5);
	});

	it("draws the calibration rulers where the cut edges should fall, and adds what is read", () => {
		const front = calibrationFront();
		expect(front).toEqual({ x: 30, y: 98.5 });
		// long edge: the front's left edge is the back's right edge; the top stays the top
		const long = calibrationEdges({ flip: "long-edge", backOffsetMm: { x: 0, y: 0 } });
		expect(long.leftX).toBeCloseTo(210 - front.x);
		expect(long.topY).toBeCloseTo(front.y);
		// short edge: the front's top edge is the back's bottom edge; the left stays the left
		const short = calibrationEdges({ flip: "short-edge", backOffsetMm: { x: 0, y: 0 } });
		expect(short.leftX).toBeCloseTo(front.x);
		expect(short.topY).toBeCloseTo(297 - front.y);
		// the rulers follow the offset in use, so a second print shows 0 at the edges
		const moved = calibrationEdges({ flip: "long-edge", backOffsetMm: { x: 2, y: -1 } });
		expect(moved.leftX).toBeCloseTo(long.leftX + 2);
		expect(moved.topY).toBeCloseTo(long.topY - 1);
		expect(moved.back.x + CALIBRATION_CARD.width).toBeCloseTo(moved.leftX);
		expect(calibratedOffset({ x: 2, y: -1 }, { x: 1.5, y: 0.5 })).toEqual({ x: 3.5, y: -0.5 });
		expect(calibratedOffset({ x: 9, y: 0 }, { x: 4, y: -12 })).toEqual({ x: 10, y: -10 });
	});
});

describe("crop marks (step 11.17)", () => {
	it("extends every cut line into the margins and the gaps, never over a card", () => {
		const units = sideBySidePlaces(cr80)
			.slice(0, 2)
			.map((p) => ({ ...p, w: 2 * cr80.cardW, h: cr80.cardH }));
		const [first, second] = units;
		if (!first || !second) {
			throw new Error("units");
		}
		const folds = units.map((u) => u.x + cr80.cardW);
		const lines = cropMarks(units, folds);
		const r = (v: number): number => Math.round(v * 100) / 100;
		const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;
		const overCard = (x: number, y: number): boolean =>
			units.some(
				(u) =>
					x > u.x + 0.01 &&
					x < u.x + u.w - 0.01 &&
					y > u.y + 0.01 &&
					y < u.y + u.h - 0.01,
			);
		for (const l of lines) {
			expect(overCard((l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2), JSON.stringify(l)).toBe(false);
		}
		// the left edge: above the first unit, across the gap, under the second
		const left = lines.filter((l) => near(l.x1, first.x) && near(l.x2, first.x) && !l.fold);
		expect(left.map((l) => [l.y1, l.y2])).toEqual(
			[
				[Math.max(0, first.y - 6), first.y - 1],
				[first.y + cr80.cardH + 0.5, second.y - 0.5],
				[second.y + cr80.cardH + 1, second.y + cr80.cardH + 6],
			].map((p) => p.map(r)),
		);
		// the top edge of the first unit: in the left and right margins, 5 mm long, 1 mm away
		const top = lines.filter((l) => near(l.y1, first.y) && near(l.y2, first.y));
		expect(top.map((l) => [l.x1, l.x2])).toEqual(
			[
				[first.x - 6, first.x - 1],
				[first.x + first.w + 1, first.x + first.w + 6],
			].map((p) => p.map(r)),
		);
		// the fold, dashed, in the same places as a cut
		expect(lines.filter((l) => l.fold && near(l.x1, folds[0] ?? 0)).length).toBe(3);
	});

	it("tells whether a card size fits the sheet, and how many rows of it", () => {
		const sheet = { rows: 4, marginMm: 6, gapMm: 3 };
		expect(cardSheetFit({ width: 85.6, height: 53.98 }, sheet)).toEqual({
			fits: true,
			rows: 4,
			rowsFit: true,
			max: { width: 99, height: 285 },
		});
		// a portrait card: the rows that fit the page, fewer than asked
		expect(cardSheetFit({ width: 53.98, height: 85.6 }, { ...sheet, rows: 5 })).toMatchObject({
			fits: true,
			rows: 3,
			rowsFit: false,
		});
		// front and back side by side are twice as wide as the card, inside the margins
		expect(cardSheetFit({ width: 99, height: 50 }, sheet).fits).toBe(true);
		expect(cardSheetFit({ width: 99.1, height: 50 }, sheet)).toMatchObject({
			fits: false,
			rows: 0,
		});
		expect(cardSheetFit({ width: 50, height: 286 }, sheet).fits).toBe(false);
		expect(cardSheetFit({ width: 50, height: 285 }, sheet)).toMatchObject({
			fits: true,
			rows: 1,
		});
	});
});
