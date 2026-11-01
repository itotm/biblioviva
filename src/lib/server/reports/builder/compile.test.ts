// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { SOURCES } from "./catalogue.js";
import { COLUMN_ORDER_KEY, compileQuery, QueryCompileError } from "./compile.js";
import type { ReportQuery } from "./spec.js";

const q = (patch: Partial<ReportQuery>): ReportQuery => ({
	source: "loans",
	filters: [],
	rows: ["classYear"],
	measures: ["loans"],
	totals: "both",
	sort: "dimension",
	chart: null,
	...patch,
});

const problems = (query: ReportQuery): string[] => {
	try {
		compileQuery(query);
		return [];
	} catch (e) {
		if (e instanceof QueryCompileError) {
			return e.problems;
		}
		throw e;
	}
};

describe("guided reports (9.20)", () => {
	it("compiles rows, measures, an asked period and the chart", () => {
		const out = compileQuery(
			q({
				filters: [{ field: "period", ask: true }],
				measures: ["loans", "readers"],
				chart: "bar",
			}),
		);
		expect(out.sql).toMatch(
			/^SELECT .* AS classYear, COUNT\(\*\) AS loans, COUNT\(DISTINCT l\.patron_id\) AS readers FROM loan l /,
		);
		expect(out.sql).toContain("date(l.issued_at) BETWEEN :from AND :to");
		expect(out.params.map((p) => [p.name, p.type, p.default])).toEqual([
			["from", "date", "schoolYearStart"],
			["to", "date", "today"],
		]);
		expect(out.columns.map((c) => c.key)).toEqual(["classYear", "loans", "readers"]);
		expect(out.chart).toEqual({ type: "bar", x: ["classYear"], y: ["loans", "readers"] });
		expect(out.pivot).toBeUndefined();
	});

	it("makes a pivot of a column dimension with one measure and its hidden order", () => {
		const out = compileQuery(q({ columns: "section", totals: "rows" }));
		expect(out.pivot).toEqual({
			rows: ["classYear"],
			columns: "section",
			value: "loans",
			columnOrder: COLUMN_ORDER_KEY,
			totals: "rows",
		});
		expect(out.columns.find((c) => c.key === COLUMN_ORDER_KEY)?.hidden).toBe(true);
		expect(problems(q({ columns: "section", measures: ["loans", "readers"] }))).toEqual([
			"a pivot table (columns) has exactly one measure",
		]);
	});

	it("turns fixed filters into checked literals and asked ones into optional parameters", () => {
		const out = compileQuery(
			q({
				filters: [
					{ field: "period", value: "2025-09-01..2026-06-30", ask: false },
					{ field: "patronType", value: "student", ask: false },
					{ field: "level", ask: true },
					{ field: "group", value: 7, ask: false },
					{ field: "kind", value: "unclassified", ask: false },
				],
			}),
		);
		expect(out.sql).toContain("date(l.issued_at) BETWEEN '2025-09-01' AND '2026-06-30'");
		expect(out.sql).toContain("l.patron_type_snapshot = 'student'");
		expect(out.sql).toContain("(:level IS NULL OR l.level_snapshot = :level)");
		expect(out.sql).toContain("l.group_id_snapshot = 7");
		expect(out.sql).toContain("('unclassified' = 'unclassified' AND b.kind IS NULL)");
		expect(out.params).toEqual([
			expect.objectContaining({ name: "level", type: "level", required: false }),
		]);
		// nothing but the shapes of the catalogue becomes SQL
		expect(
			problems(q({ filters: [{ field: "patronType", value: "x' OR 1=1 --", ask: false }] })),
		).toEqual([`filters.patronType: invalid value "x' OR 1=1 --"`]);
		expect(problems(q({ filters: [{ field: "period", value: "ieri", ask: false }] }))).toEqual([
			"filters.period: a period is YYYY-MM-DD..YYYY-MM-DD",
		]);
		expect(problems(q({ filters: [{ field: "level", ask: false }] }))).toEqual([
			"filters.level: a fixed filter needs a value",
		]);
		expect(problems(q({ filters: [{ field: "kind", value: "poesia", ask: false }] }))).toEqual([
			'filters.kind: invalid value "poesia"',
		]);
	});

	it("refuses names that are not in the catalogue of the source", () => {
		expect(
			problems(
				q({
					source: "items",
					rows: ["classYear"],
					measures: ["loans"],
					filters: [{ field: "patronType", ask: true }],
				}),
			),
		).toEqual([
			'rows[0]: unknown dimension "classYear" for items',
			'measures[0]: unknown measure "loans" for items',
			'filters[0]: unknown filter "patronType" for items',
		]);
		expect(problems(q({ rows: ["classYear", "classYear"] }))).toEqual([
			"a dimension or a measure is used twice",
		]);
	});

	it("sorts by the measure and limits a top list", () => {
		const out = compileQuery(q({ rows: ["itemType"], sort: "measure", limit: 5 }));
		expect(out.sql).toMatch(/ORDER BY loans DESC, i\.item_type LIMIT 5$/);
	});

	it("every dimension and measure of every source has both languages", () => {
		for (const source of Object.values(SOURCES)) {
			for (const x of [...source.dimensions, ...source.measures, ...source.filters]) {
				expect(x.label.it && x.label.en, x.key).toBeTruthy();
			}
		}
	});
});
