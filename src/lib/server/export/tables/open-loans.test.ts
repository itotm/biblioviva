// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { getConfig } from "#lib/server/config/index.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { openLoanRows } from "#lib/server/services/loan-lists.js";
import { loanFiltersSchema } from "#lib/shared/loan-filters.js";
import { getExport } from "../registry.js";
import type { TableExport } from "../types.js";
import { openLoansExportColumns, registerOpenLoansExport } from "./open-loans.js";
import { classId, mirrorTestSchool } from "../../../../../tests/helpers/school.js";

describe("open loans export", () => {
	it("exports the open loans with the grid's filters, patron and class in one column each", async () => {
		const db = createTestDb();
		seedDatabase(db, { patrons: 20, teachers: 4, biblios: 20, items: 40, loans: 60 });
		mirrorTestSchool(db);
		const all = openLoanRows(db, libraryToday(getConfig()));
		expect(all.some((r) => r.patronType === "teacher")).toBe(true);
		registerOpenLoansExport(() => ({ patron: "Utente", teacher: "Docente" }));
		const definition = getExport("open-loans");
		if (!definition) {
			throw new Error("open-loans export not registered");
		}
		expect(definition.permission).toBe("loans");
		const build = async (raw: Record<string, string>): Promise<TableExport> =>
			definition.build(
				db,
				v.parse(loanFiltersSchema, raw),
				{ id: 1 } as never,
				"Europe/Rome",
			);

		const table = await build({});
		expect(table.name).toBe("prestiti-in-corso");
		expect(table.columns[0]).toEqual({
			id: "patron",
			label: "Utente",
			type: "string",
			widthMm: 45,
		});
		const rows = [...table.rows];
		expect(rows).toHaveLength(all.length);
		for (const [i, row] of rows.entries()) {
			const source = all[i];
			expect(row.patron).toBe(`${source?.lastName} ${source?.firstName}`);
			expect(row.classLabel).toBe(
				source?.patronType === "teacher" ? "Docente" : source?.classLabel,
			);
		}

		// the class filter is a group id (Phase 12)
		const label = all.find((r) => r.patronType === "student")?.classLabel ?? "";
		const [level = "", name = ""] = label.split(" ");
		const ofClass = [...(await build({ group: String(classId(db, level, name)) })).rows];
		expect(ofClass.length).toBeGreaterThan(0);
		expect(ofClass).toHaveLength(all.filter((r) => r.classLabel === label).length);
		expect(ofClass.every((r) => r.classLabel === label)).toBe(true);

		const teachers = [...(await build({ patronType: "teacher" })).rows];
		expect(teachers.length).toBeGreaterThan(0);
		expect(teachers.every((r) => r.classLabel === "Docente")).toBe(true);
		const overdue = [...(await build({ overdue: "1" })).rows];
		expect(overdue.every((r) => Number(r.daysOverdue) > 0)).toBe(true);
	});

	it("leaves the class empty for a student without class or section", async () => {
		const db = createTestDb();
		seedDatabase(db, { patrons: 20, teachers: 4, biblios: 20, items: 40, loans: 60 });
		mirrorTestSchool(db);
		db.$client.run(
			"UPDATE patron SET patron_type = 'student', class_group_id = NULL, level_code = NULL",
		);
		registerOpenLoansExport(() => ({}));
		const table = await getExport("open-loans")?.build(
			db,
			v.parse(loanFiltersSchema, {}),
			{ id: 1 } as never,
			"Europe/Rome",
		);
		if (!table) {
			throw new Error("open-loans export not registered");
		}
		const rows = [...table.rows];
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((r) => r.classLabel === "")).toBe(true);
		expect(table.columns.map((c) => c.label)).toEqual(
			openLoansExportColumns({}).map((c) => c.id),
		);
	});
});
