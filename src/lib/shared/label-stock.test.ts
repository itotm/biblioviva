// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	cellPosition,
	placeUnits,
	startInRange,
	stockCells,
	stockExtent,
	stockOverflow,
	stockProblems,
	unitGrid,
	unitPosition,
} from "./label-stock.js";

const stock = {
	labelMm: { width: 70, height: 48 },
	columns: 3,
	rows: 6,
	marginMm: { top: 4, left: 0 },
	gapMm: { x: 0, y: 0 },
};

describe("label stock geometry", () => {
	it("measures the labels and tells when they go past the page", () => {
		expect(stockExtent(stock)).toEqual({ width: 210, height: 292 });
		expect(stockOverflow(stock)).toEqual({ x: false, y: false });
		expect(stockOverflow({ ...stock, gapMm: { x: 1, y: 2 } })).toEqual({ x: true, y: true });
		expect(stockOverflow(stock, { width: 148, height: 210 })).toEqual({ x: true, y: true });
	});

	it("reports every reason a stock cannot print a unit, in order", () => {
		expect(stockProblems(stock, 2)).toEqual([]);
		expect(stockProblems({ ...stock, rows: 5, gapMm: { x: 1, y: 2 } }, 2)).toEqual([
			{ reason: "rowsNotMultiple", rows: 5, cells: 2 },
			{ reason: "overflowX", usedMm: 212, paperMm: 210 },
		]);
		expect(stockProblems({ ...stock, rows: 7 }).map((p) => p.reason)).toEqual(["overflowY"]);
	});

	it("places cells, units of stacked cells and the units of a job from a start", () => {
		const grid = unitGrid(stock, 2);
		expect(grid).toEqual({
			cells: 2,
			unitRows: 3,
			unitsPerPage: 9,
			cellsPerPage: 18,
			unitHeightMm: 96,
		});
		expect(cellPosition(stock, 4)).toEqual({ column: 1, row: 1, xMm: 70, yMm: 52 });
		const unit = unitPosition({ stock, cells: 2 }, 4);
		expect(unit).toMatchObject({ column: 1, row: 2, xMm: 70, yMm: 100 });
		expect(unit.cells.map((c) => c.yMm)).toEqual([100, 148]);
		expect(startInRange(9, grid.unitsPerPage)).toBe(true);
		expect(startInRange(10, grid.unitsPerPage)).toBe(false);
		expect(startInRange(1.5, grid.unitsPerPage)).toBe(false);
		expect(placeUnits(grid.unitsPerPage, 3, 8)).toEqual([
			{ unit: 0, page: 0, slot: 7 },
			{ unit: 1, page: 0, slot: 8 },
			{ unit: 2, page: 1, slot: 0 },
		]);
	});

	it("draws the cells of the page with the ones past its edge", () => {
		const cells = stockCells({ ...stock, columns: 4 });
		expect(cells).toHaveLength(24);
		expect(cells.filter((c) => c.over).map((c) => c.column)).toEqual([3, 3, 3, 3, 3, 3]);
	});
});
