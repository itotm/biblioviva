// SPDX-License-Identifier: GPL-3.0-or-later
// Geometry of an adhesive label stock (PLAN.md §3.12, steps 3.8 and 11.6), shared by the print
// jobs, the configuration checks and the stock editor's drawing: how much of the page the labels
// take, whether they fit, where each cell and each unit of stacked cells goes, and how the units
// of a job are laid on pages. Pure: millimetres from the top-left corner of the paper.
import { PAPER_MM } from "./paper.js";

export interface StockShape {
	labelMm: { width: number; height: number };
	columns: number;
	rows: number;
	marginMm: { top: number; left: number };
	gapMm: { x: number; y: number };
}

/** Width and height, in mm, from the page corner to the far edge of the last label. */
export function stockExtent(s: StockShape): { width: number; height: number } {
	return {
		width: s.marginMm.left + s.columns * s.labelMm.width + (s.columns - 1) * s.gapMm.x,
		height: s.marginMm.top + s.rows * s.labelMm.height + (s.rows - 1) * s.gapMm.y,
	};
}

/** What does not fit on the page (A4): the labels go past its right or bottom edge. */
export function stockOverflow(
	s: StockShape,
	paper: { width: number; height: number } = PAPER_MM.A4,
): { x: boolean; y: boolean } {
	const e = stockExtent(s);
	return { x: e.width > paper.width + 0.01, y: e.height > paper.height + 0.01 };
}

/** Why a stock cannot print units of `cells` stacked labels, in the order they are reported. */
export type StockProblem =
	| { reason: "rowsNotMultiple"; rows: number; cells: number }
	| { reason: "overflowX"; usedMm: number; paperMm: number }
	| { reason: "overflowY"; usedMm: number; paperMm: number };

/** Every reason a stock cannot print units of `cells` stacked labels on its page (none: it can). */
export function stockProblems(
	s: StockShape,
	cells = 1,
	paper: { width: number; height: number } = PAPER_MM.A4,
): StockProblem[] {
	const problems: StockProblem[] = [];
	if (s.rows % cells !== 0) {
		problems.push({ reason: "rowsNotMultiple", rows: s.rows, cells });
	}
	const extent = stockExtent(s);
	const over = stockOverflow(s, paper);
	if (over.x) {
		problems.push({ reason: "overflowX", usedMm: extent.width, paperMm: paper.width });
	}
	if (over.y) {
		problems.push({ reason: "overflowY", usedMm: extent.height, paperMm: paper.height });
	}
	return problems;
}

/** The units of a stock: `cells` labels stacked in a column (1 for single labels, 2 for pairs). */
export interface UnitGrid {
	cells: number;
	unitRows: number;
	unitsPerPage: number;
	cellsPerPage: number;
	unitHeightMm: number;
}

/** The unit grid of a stock whose rows divide by `cells` (`stockProblems` tells first). */
export function unitGrid(s: StockShape, cells = 1): UnitGrid {
	const unitRows = Math.floor(s.rows / cells);
	return {
		cells,
		unitRows,
		unitsPerPage: unitRows * s.columns,
		cellsPerPage: s.rows * s.columns,
		unitHeightMm: cells * s.labelMm.height + (cells - 1) * s.gapMm.y,
	};
}

export interface CellPosition {
	column: number;
	row: number;
	xMm: number;
	yMm: number;
}

/** Position of cell `index` (0-based, row-major) on a page. */
export function cellPosition(s: StockShape, index: number): CellPosition {
	const column = index % s.columns;
	const row = Math.floor(index / s.columns);
	return {
		column,
		row,
		xMm: s.marginMm.left + column * (s.labelMm.width + s.gapMm.x),
		yMm: s.marginMm.top + row * (s.labelMm.height + s.gapMm.y),
	};
}

/** Every cell of a page in reading order, with whether it goes past the edge of the paper. */
export function stockCells(
	s: StockShape,
	paper: { width: number; height: number } = PAPER_MM.A4,
): (CellPosition & { over: boolean })[] {
	return Array.from({ length: s.rows * s.columns }, (_, i) => {
		const p = cellPosition(s, i);
		return {
			...p,
			over:
				p.xMm + s.labelMm.width > paper.width + 0.01 ||
				p.yMm + s.labelMm.height > paper.height + 0.01,
		};
	});
}

/** Position of unit `index` (0-based, row-major over the unit grid) and of each of its cells. */
export function unitPosition(
	geometry: { stock: StockShape; cells: number },
	index: number,
): CellPosition & { cells: CellPosition[] } {
	const { stock, cells } = geometry;
	const column = index % stock.columns;
	const unitRow = Math.floor(index / stock.columns);
	const first = cellPosition(stock, unitRow * cells * stock.columns + column);
	return {
		...first,
		cells: Array.from({ length: cells }, (_, k) =>
			cellPosition(stock, (unitRow * cells + k) * stock.columns + column),
		),
	};
}

export interface PlacedUnit {
	/** 0-based index in the job. */
	unit: number;
	page: number;
	/** 0-based position on the page. */
	slot: number;
}

/** A start position (1-based) that lies on the page of `unitsPerPage` units. */
export const startInRange = (start: number, unitsPerPage: number): boolean =>
	Number.isInteger(start) && start >= 1 && start <= unitsPerPage;

/**
 * Lays `count` units on pages from `start` (1-based position on the first page, to skip labels
 * already used on a partially printed sheet; `startInRange` tells it is on the page).
 */
export function placeUnits(unitsPerPage: number, count: number, start = 1): PlacedUnit[] {
	return Array.from({ length: count }, (_, i) => {
		const absolute = start - 1 + i;
		return {
			unit: i,
			page: Math.floor(absolute / unitsPerPage),
			slot: absolute % unitsPerPage,
		};
	});
}
