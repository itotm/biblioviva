// SPDX-License-Identifier: GPL-3.0-or-later
// The built-in report definitions (steps 6.3, 9.20): every file validates (a guided one
// compiles), passes the SQL checks and runs on the seed data through the read-only connection,
// pivot tables included.
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { openDatabase } from "#lib/server/db/client.js";
import { runMigrations } from "#lib/server/db/migrate.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { mirrorConfigTables } from "#lib/server/db/config-mirror.js";
import { seedOptionsFromConfig } from "#lib/server/db/seed-config.js";
import { loadSchoolPresets } from "#lib/server/school/presets.js";
import { openReportConnection } from "./connection.js";
import { reportContext } from "./context.js";
import type { Decorations } from "./decorate.js";
import { executeReport } from "./execute.js";
import { tryReport } from "./probe.js";
import { loadReports } from "./loader.js";
import { catalogRules } from "#lib/server/services/catalog.js";

const config = parseConfig(exampleRaw()).config;
const library = loadReports("/nonexistent-config-dir");
let dir = "";
let conn: Database;

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-builtin-reports-"));
	const path = join(dir, "db.sqlite");
	const db = openDatabase(path);
	runMigrations(db);
	seedDatabase(db, { today: "2026-09-25" });
	mirrorConfigTables(db, config);
	db.$client.close();
	conn = openReportConnection(path);
}, 60_000);
afterAll(() => {
	conn.close();
	rmSync(dir, { recursive: true, force: true });
});

// reports that may legitimately be empty on the seed data
const MAY_BE_EMPTY = new Set(["biblio-unknown-classification", "imports-history"]);
const decorations: Decorations = {
	locale: "it",
	scheme: catalogRules(config).scheme,
	itemTypes: { libro: "Libro" },
	patronTypes: { student: "Studente", teacher: "Docente" },
	itemStatuses: { available: "Disponibile" },
	levels: Object.fromEntries(config.school.levels.map((l) => [l.code, l.label])),
	stages: Object.fromEntries(config.school.stages.map((st) => [st.code, st.name])),
	kinds: { fiction: "Narrativa", nonfiction: "Saggistica" },
	teachers: "Docenti",
	unclassified: "Da classificare",
	total: "Totale",
	yes: "Sì",
	no: "No",
};

describe("built-in reports", () => {
	it("are all valid, bilingual and grouped in the four categories", () => {
		expect(library.problems).toEqual([]);
		expect(library.reports.length).toBe(21);
		// the reviews of 9.20 (Q116) and 9.13 round 24: the ones gone, reshaped and added
		const ids = library.reports.map((r) => r.id);
		for (const gone of [
			"loans-by-patron-type",
			"items-by-status",
			"reading-list-by-class",
			"patrons-without-loans",
			"active-loans",
			"pending-labels",
			"patrons-without-card-or-photo",
			"audit-summary",
			"renewals-stats",
			"loans-by-genre",
		]) {
			expect(ids).not.toContain(gone);
		}
		for (const added of [
			"reading-index-by-class",
			"loans-by-school-year",
			"classification-by-level",
			"collection-age",
			"loans-by-classification",
		]) {
			expect(ids).toContain(added);
		}
		for (const r of library.reports) {
			expect(typeof r.title === "object" && r.title.it && r.title.en, r.id).toBeTruthy();
			for (const c of r.columns) {
				expect(
					typeof c.label === "object" && c.label.it && c.label.en,
					`${r.id}.${c.key}`,
				).toBeTruthy();
			}
		}
		expect(new Set(library.reports.map((r) => r.category))).toEqual(
			new Set(["loans", "books", "patrons", "ops"]),
		);
		expect(library.reports.filter((r) => r.restricted).map((r) => r.id)).toEqual([
			"imports-history",
			"top-readers",
		]);
	});

	it.each(library.reports.map((r) => [r.id, r] as const))(
		"%s runs on the seed data",
		(id, report) => {
			const ctx = reportContext(config, new Date("2026-09-25T10:00:00Z"));
			const result = executeReport(
				conn,
				report,
				{ from: "2025-09-01", to: "2026-09-25" },
				ctx,
				decorations,
			);
			if (!MAY_BE_EMPTY.has(id)) {
				expect(result.rows.length, id).toBeGreaterThan(0);
			}
			expect(result.columns.length, id).toBeGreaterThan(0);
			// the trial run before a save (9.20) accepts every built-in, required parameters too
			expect(() => tryReport(conn, report, ctx), id).not.toThrow();
		},
	);
});

describe("the pivot of loans by class year and section (the owner's example)", () => {
	it("has a column per section, a teachers row counted in the total only, and the totals", () => {
		const report = library.reports.find((r) => r.id === "loans-by-class-section");
		expect(report?.pivot).toBeTruthy();
		const ctx = reportContext(config, new Date("2026-09-25T10:00:00Z"));
		const result = executeReport(
			conn,
			report!,
			{ from: "2025-09-01", to: "2026-09-25" },
			ctx,
			decorations,
		);
		const labels = result.columns.map((c) => c.label);
		expect(labels[0]).toBe("Classe (anno)");
		expect(labels).toContain("A");
		expect(labels.at(-1)).toBe("Totale");
		const first = result.rows.map((r) => r.classYear);
		expect(first.at(-1)).toBe("Totale");
		expect(first).toContain("Docenti");
		const teachers = result.rows.find((r) => r.classYear === "Docenti");
		const cells = result.columns.filter((c) => /^c\d+$/.test(c.key));
		// teachers have no section: every section cell is 0, their loans are in the row total
		expect(cells.every((c) => teachers?.[c.key] === 0)).toBe(true);
		expect(Number(teachers?._total)).toBeGreaterThan(0);
		// the grand total is the sum of the row totals, and of the column totals plus the teachers
		const body = result.rows.slice(0, -1);
		const total = result.rows.at(-1)!;
		const sum = body.reduce((n, r) => n + Number(r._total), 0);
		expect(total._total).toBe(sum);
		const columnSum = cells.reduce((n, c) => n + Number(total[c.key]), 0);
		expect(columnSum + Number(teachers?._total)).toBe(sum);
		expect(result.chart?.stacked).toBe(true);
		expect(result.chart?.labels).not.toContain("Totale");
	});
});

// step 12.8 (left from 12.7): the same reports on a generated istituto comprensivo — three
// stages, infanzia sections hosting every age, letter labels (`3ª A`, `1ª media B`)
describe("built-in reports on a seeded comprensivo", () => {
	const preset = loadSchoolPresets().find((p) => p.id === "it-comprensivo");
	const comprensivo = {
		...config,
		school: {
			...config.school,
			...(preset?.school ?? config.school),
			preset: "it-comprensivo",
			teacherGroupName: preset?.teacherGroup ?? "Docenti",
		},
		classification: {
			...config.classification,
			readingLevels: preset?.readingLevels ?? config.classification.readingLevels,
		},
	};
	let dirC = "";
	let connC: Database;

	beforeAll(() => {
		dirC = mkdtempSync(join(tmpdir(), "bv-builtin-comprensivo-"));
		const path = join(dirC, "db.sqlite");
		const db = openDatabase(path);
		runMigrations(db);
		mirrorConfigTables(db, comprensivo);
		seedDatabase(db, { ...seedOptionsFromConfig(comprensivo), today: "2026-09-25" });
		db.$client.close();
		connC = openReportConnection(path);
	}, 60_000);
	afterAll(() => {
		connC.close();
		rmSync(dirC, { recursive: true, force: true });
	});

	it.each(library.reports.map((r) => [r.id, r] as const))("%s runs", (id, report) => {
		const ctx = reportContext(comprensivo, new Date("2026-09-25T10:00:00Z"));
		const result = executeReport(
			connC,
			report,
			{ from: "2025-09-01", to: "2026-09-25" },
			ctx,
			decorations,
		);
		expect(Array.isArray(result.rows)).toBe(true);
		if (!MAY_BE_EMPTY.has(id)) {
			expect(result.rows.length, id).toBeGreaterThan(0);
		}
	});

	it("labels the classes of every stage", () => {
		const labels = connC
			.query<{ l: string }, []>(
				"SELECT DISTINCT class_label AS l FROM patron_class WHERE group_kind = 'students'",
			)
			.all()
			.map((r) => r.l);
		expect(labels).toContain("3ª A");
		expect(labels).toContain("2ª media B");
		expect(labels).toContain("4 anni Infanzia A");
	});
});
