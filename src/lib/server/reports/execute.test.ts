// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { pivotRows, type ShownColumn } from "./execute.js";

const columns: ShownColumn[] = [
	{ key: "year", label: "Anno", type: "text" },
	{ key: "section", label: "Sezione", type: "text" },
	{ key: "_corder", label: "Ordine", type: "int" },
	{ key: "loans", label: "Prestiti", type: "int" },
];

describe("pivot tables (9.20)", () => {
	const rows = [
		{ year: "1", section: "B", _corder: 2, loans: 5 },
		{ year: "1", section: "A", _corder: 1, loans: 3 },
		{ year: "2", section: "C", _corder: 3, loans: 4 },
		{ year: "Docenti", section: null, _corder: null, loans: 2 },
	];

	it("makes one column per value in order, fills the gaps with 0 and adds both totals", () => {
		const out = pivotRows(
			{
				rows: ["year"],
				columns: "section",
				value: "loans",
				columnOrder: "_corder",
				totals: "both",
			},
			columns,
			rows,
			"Totale",
		);
		expect(out.columns.map((c) => c.label)).toEqual(["Anno", "A", "B", "C", "Totale"]);
		expect(out.rows).toEqual([
			{ year: "1", c0: 3, c1: 5, c2: 0, _total: 8 },
			{ year: "2", c0: 0, c1: 0, c2: 4, _total: 4 },
			// no section: counted in the row total only
			{ year: "Docenti", c0: 0, c1: 0, c2: 0, _total: 2 },
			{ year: "Totale", c0: 3, c1: 5, c2: 4, _total: 14 },
		]);
	});

	it("leaves out the totals not asked, and orders by first appearance without an order column", () => {
		const none = pivotRows(
			{ rows: ["year"], columns: "section", value: "loans", totals: "none" },
			columns,
			rows,
			"Totale",
		);
		expect(none.columns.map((c) => c.label)).toEqual(["Anno", "B", "A", "C"]);
		expect(none.rows).toHaveLength(3);
		expect(none.rows[0]).toEqual({ year: "1", c0: 5, c1: 3, c2: 0 });
		const rowsOnly = pivotRows(
			{ rows: ["year"], columns: "section", value: "loans", totals: "rows" },
			columns,
			rows,
			"Totale",
		);
		expect(rowsOnly.rows).toHaveLength(3);
		expect(rowsOnly.columns.at(-1)?.label).toBe("Totale");
		expect(
			pivotRows(
				{ rows: ["year"], columns: "section", value: "loans", totals: "columns" },
				columns,
				[],
				"Totale",
			).rows,
		).toEqual([{ year: "Totale" }]);
	});
});
