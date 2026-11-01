// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { localize } from "./definition.js";
import { loadReports, parseReport } from "./loader.js";

const dirs: string[] = [];
const temp = (): string => {
	const d = mkdtempSync(join(tmpdir(), "bv-reports-"));
	dirs.push(d);
	return d;
};
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
});

const report = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
	id: "loans-count",
	title: { it: "Prestiti", en: "Loans" },
	category: "loans",
	params: [{ name: "from", label: "Dal", type: "date", default: "schoolYearStart" }],
	sql: "SELECT COUNT(*) AS n FROM loan WHERE date(issued_at) >= :from",
	columns: [{ key: "n", label: "Prestiti", type: "int" }],
	...patch,
});

function write(dir: string, name: string, content: unknown): void {
	mkdirSync(join(dir, "reports"), { recursive: true });
	writeFileSync(
		join(dir, "reports", name),
		typeof content === "string" ? content : JSON.stringify(content),
	);
}

describe("report library", () => {
	it("loads the built-ins, lets CONFIG_DIR replace one by id, reports the broken files", () => {
		const builtin = temp();
		const config = temp();
		write(builtin, "loans-count.json", report());
		write(builtin, "other.json", report({ id: "other", title: "Altro" }));
		write(config, "mine.json", report({ title: "Prestiti della scuola" }));
		write(config, "broken.json", "{ nope");
		write(config, "deleting.json", report({ id: "bad", sql: "DELETE FROM loan" }));
		write(
			config,
			"chart.json",
			report({ id: "chart", chart: { type: "pie", x: "n", y: "n" } }),
		);
		const lib = loadReports(config, builtin);
		expect(lib.reports.map((r) => [r.id, r.source, localize(r.title, "it")])).toEqual([
			["loans-count", "config", "Prestiti della scuola"],
			["other", "builtin", "Altro"],
		]);
		expect(lib.problems.map((p) => p.file)).toEqual([
			"broken.json",
			"chart.json",
			"deleting.json",
		]);
		expect(lib.problems.find((p) => p.file === "deleting.json")?.message).toMatch(
			/sql: not_select.*forbidden_keyword \(DELETE\)/,
		);
		expect(loadReports(temp(), temp())).toEqual({ reports: [], problems: [] });
	});

	it("checks names, options, chart columns and the parameters of a date range", () => {
		const problems = (patch: Record<string, unknown>): string[] => {
			const r = parseReport(report(patch));
			return "problems" in r ? r.problems : [];
		};
		expect(problems({})).toEqual([]);
		expect(problems({ id: "Bad Id" })[0]).toMatch(/^id:/);
		expect(
			problems({
				params: [{ name: "x", label: "X", type: "select" }],
				sql: "SELECT :x AS n",
			}),
		).toEqual(["a select parameter needs options"]);
		expect(problems({ chart: { type: "bar", x: "n", y: "missing" } })).toEqual([
			"chart and sort must name declared columns",
		]);
		expect(
			problems({
				params: [{ name: "period", label: "Periodo", type: "dateRange" }],
				sql: "SELECT :periodFrom AS n WHERE :periodTo IS NOT NULL",
			}),
		).toEqual([]);
		expect(localize({ de: "Ausleihen" }, "it")).toBe("Ausleihen");
		expect(localize({ it: "Prestiti", en: "Loans" }, "fr")).toBe("Loans");
	});
});

describe("guided report files (9.20)", () => {
	const guided = {
		id: "guided",
		title: { it: "Guidato", en: "Guided" },
		category: "loans",
		query: { source: "loans", rows: ["classYear"], columns: "section", measures: ["loans"] },
	};

	it("compiles a guided file and keeps its query", () => {
		const out = parseReport(guided);
		expect("report" in out).toBe(true);
		if ("report" in out) {
			expect(out.report.sql).toMatch(/^SELECT /);
			expect(out.report.pivot?.columns).toBe("section");
			expect(out.report.query?.source).toBe("loans");
		}
	});

	it("refuses a file with both sql and query, neither, or a bad query", () => {
		expect(
			parseReport({ ...guided, sql: "SELECT 1 AS n", columns: [{ key: "n", label: "N" }] }),
		).toEqual({
			problems: ["a report has either sql or query"],
		});
		const { query: _q, ...bare } = guided;
		expect(parseReport(bare)).toEqual({
			problems: ["a report has either sql or query", "an SQL report declares its columns"],
		});
		expect(parseReport({ ...guided, query: { ...guided.query, rows: ["nope"] } })).toEqual({
			problems: ['query: rows[0]: unknown dimension "nope" for loans'],
		});
	});

	it("checks that a pivot of an SQL report names declared columns", () => {
		expect(parseReport(report({ pivot: { rows: ["n"], columns: "x", value: "n" } }))).toEqual({
			problems: ["the pivot must name declared columns"],
		});
	});
});
