// SPDX-License-Identifier: GPL-3.0-or-later
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { openReportConnection } from "./connection.js";
import { parseReport } from "./loader.js";
import type { ReportDefinition } from "./definition.js";
import { ReportParamError, resolveParams, runReport, type ReportContext } from "./run.js";

let dir = "";
let conn: Database;
const ctx: ReportContext = {
	today: "2026-10-15",
	schoolYearStart: "2026-09-01",
	levels: ["1", "2", "3", "4", "5"],
	stages: ["primaria"],
	itemTypes: ["libro", "dvd"],
	classificationCodes: ["B", "590"],
};

function def(raw: Record<string, unknown>): ReportDefinition {
	const r = parseReport({ title: "T", category: "loans", ...raw });
	if ("problems" in r) {
		throw new Error(r.problems.join("; "));
	}
	return r.report;
}

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-report-run-"));
	const path = join(dir, "db.sqlite");
	const db = openDatabase(path);
	runMigrations(db);
	seedDatabase(db, { patrons: 40, teachers: 4, biblios: 30, items: 40, loans: 60 });
	db.$client.close();
	conn = openReportConnection(path);
});
afterAll(() => {
	conn.close();
	rmSync(dir, { recursive: true, force: true });
});

describe("report parameters", () => {
	const report = def({
		id: "p",
		params: [
			{
				name: "from",
				label: "Dal",
				type: "date",
				required: true,
				default: "schoolYearStart",
			},
			{ name: "to", label: "Al", type: "date", default: "today" },
			{ name: "level", label: "Classe", type: "level" },
			{ name: "stage", label: "Ordine", type: "stage" },
			{ name: "group", label: "Sezione", type: "group" },
			{ name: "patronType", label: "Tipo", type: "patronType" },
			{ name: "top", label: "Primi", type: "int", default: 10, min: 1, max: 100 },
			{
				name: "kind",
				label: "Tipo",
				type: "select",
				options: [
					{ value: "fiction", label: "Narrativa" },
					{ value: 2, label: "Due" },
				],
			},
			{ name: "period", label: "Periodo", type: "dateRange", default: "monthStart" },
			{ name: "item", label: "Materiale", type: "itemType" },
			{ name: "q", label: "Testo", type: "text" },
		],
		sql: "SELECT :from AS a, :to AS b, :level AS c, :stage AS d, :group AS l, :patronType AS e, :top AS f, :kind AS g, :periodFrom AS h, :periodTo AS i, :item AS j, :q AS k",
		columns: [{ key: "a", label: "A" }],
	});

	it("applies the defaults and coerces by type", () => {
		const { values, shown } = resolveParams(report, { level: "3", kind: "2" }, ctx);
		expect(values).toEqual({
			today: "2026-10-15",
			schoolYearStart: "2026-09-01",
			classificationCodes: '["B","590"]',
			from: "2026-09-01",
			to: "2026-10-15",
			level: "3",
			stage: null,
			group: null,
			patronType: null,
			top: 10,
			kind: 2,
			periodFrom: "2026-10-01",
			periodTo: "2026-10-01",
			item: null,
			q: null,
		});
		expect(shown.from).toBe("2026-09-01");
		expect(
			resolveParams(
				report,
				{ from: "yearStart", stage: "primaria", group: "12", item: "dvd", q: " x " },
				ctx,
			).values,
		).toMatchObject({
			from: "2026-01-01",
			stage: "primaria",
			group: 12,
			item: "dvd",
			q: "x",
		});
	});

	it("refuses values outside the library's data and missing required ones", () => {
		const code = (raw: Record<string, string>): string => {
			try {
				resolveParams(report, raw, ctx);
				return "ok";
			} catch (e) {
				return e instanceof ReportParamError ? `${e.param}:${e.code}` : String(e);
			}
		};
		expect(code({ level: "7" })).toBe("level:invalid");
		expect(code({ stage: "media" })).toBe("stage:invalid");
		expect(code({ group: "0" })).toBe("group:invalid");
		expect(code({ group: "A" })).toBe("group:invalid");
		expect(code({ top: "0" })).toBe("top:invalid");
		expect(code({ top: "1e3" })).toBe("top:invalid");
		expect(code({ kind: "nonfiction" })).toBe("kind:invalid");
		expect(code({ to: "2026-13-01" })).toBe("to:invalid");
		expect(code({ patronType: "admin" })).toBe("patronType:invalid");
		expect(code({ item: "vhs" })).toBe("item:invalid");
		expect(code({ q: "x".repeat(201) })).toBe("q:invalid");
		const required = def({
			id: "r",
			params: [{ name: "from", label: "Dal", type: "date", required: true }],
			sql: "SELECT :from AS a",
			columns: [{ key: "a", label: "A" }],
		});
		expect(() => resolveParams(required, {}, ctx)).toThrow(ReportParamError);
	});
});

describe("running reports", () => {
	it("binds parameters by name and returns the declared columns", () => {
		const report = def({
			id: "by-type",
			params: [{ name: "patronType", label: "Tipo", type: "patronType" }],
			sql: "SELECT patron_type AS type, COUNT(*) AS n, 'extra' AS dropped FROM patron WHERE (:patronType IS NULL OR patron_type = :patronType) GROUP BY 1 ORDER BY 1",
			columns: [
				{ key: "type", label: "Tipo" },
				{ key: "n", label: "N", type: "int" },
			],
		});
		const all = runReport(conn, report, resolveParams(report, {}, ctx).values);
		expect(all.rows.map((r) => r.type)).toEqual(["student", "teacher"]);
		expect(Object.keys(all.rows[0] ?? {})).toEqual(["type", "n"]);
		const teachers = runReport(
			conn,
			report,
			resolveParams(report, { patronType: "teacher" }, ctx).values,
		);
		expect(teachers.rows).toEqual([{ type: "teacher", n: 4 }]);
		expect(teachers.truncated).toBe(false);
		expect(teachers.ms).toBeGreaterThanOrEqual(0);
	});

	it("stops at the row cap and says so", () => {
		const report = def({
			id: "cap",
			sql: "SELECT id FROM patron ORDER BY id",
			columns: [{ key: "id", label: "Id", type: "int" }],
			rowLimit: 5,
		});
		const r = runReport(conn, report, {});
		expect(r.rows).toHaveLength(5);
		expect(r.truncated).toBe(true);
	});

	it("the connection is read-only even for a statement that slipped past the checks", () => {
		expect(conn.query("PRAGMA query_only").get()).toEqual({ query_only: 1 });
		expect(() => conn.run("DELETE FROM loan")).toThrow(/readonly|read-only/i);
		expect(() =>
			conn.query("INSERT INTO sequence(name, value) VALUES ('x', 1) RETURNING name").all(),
		).toThrow();
	});
});

describe("injection attempts", () => {
	it("binds a text value as data and the connection refuses writes anyway", () => {
		const report = def({
			id: "search",
			params: [{ name: "q", label: "Titolo", type: "text" }],
			sql: "SELECT COUNT(*) AS n FROM biblio WHERE title LIKE '%' || :q || '%'",
			columns: [{ key: "n", label: "N", type: "int" }],
		});
		const before = conn.query("SELECT COUNT(*) AS n FROM loan").get() as { n: number };
		const { values } = resolveParams(report, { q: "x'); DELETE FROM loan; --" }, ctx);
		expect(runReport(conn, report, values).rows).toEqual([{ n: 0 }]);
		expect(conn.query("SELECT COUNT(*) AS n FROM loan").get()).toEqual(before);
		expect(() => conn.run("DELETE FROM loan")).toThrow();
		expect(() => conn.run("PRAGMA query_only = 0; DELETE FROM loan")).toThrow();
	});
});
