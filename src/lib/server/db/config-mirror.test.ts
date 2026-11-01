// SPDX-License-Identifier: GPL-3.0-or-later
import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { mirrorConfigTables } from "./config-mirror.js";
import { classId } from "../../../../tests/helpers/school.js";
import { patron, patronClass, readingLevel, schoolLevel, schoolSetting } from "./schema.js";

describe("mirrorConfigTables", () => {
	it("writes the reading levels in their order, replacing what was there", () => {
		const db = createTestDb();
		const config = parseConfig(exampleRaw()).config;
		mirrorConfigTables(db, config);
		const rows = (): { code: string; position: number; label: string }[] =>
			db.select().from(readingLevel).orderBy(asc(readingLevel.position)).all();
		expect(rows().map((r) => r.code)).toEqual(["1", "2", "3", "4", "5"]);
		expect(rows()[3]).toEqual({ code: "4", position: 3, label: "4ª" });
		mirrorConfigTables(db, {
			...config,
			classification: {
				...config.classification,
				readingLevels: [
					{ code: "P", label: "Piccoli" },
					{ code: "G", label: "Grandi" },
				],
			},
		});
		expect(rows().map((r) => [r.code, r.position])).toEqual([
			["P", 0],
			["G", 1],
		]);
	});

	it("gives each level its stage's template, and the view writes the class with it (9.41)", () => {
		const db = createTestDb();
		const base = parseConfig(exampleRaw()).config;
		const config = {
			...base,
			library: { ...base.library, schoolYearLabel: "start" as const },
			school: {
				...base.school,
				stages: [
					{ code: "sek1", name: "Sekundarstufe I" },
					{ code: "sek2", name: "Oberstufe", classLabel: "{level}" },
				],
				levels: [
					{
						code: "10",
						label: "10",
						name: "Klasse 10",
						stage: "sek1",
						next: ["Q1", null],
					},
					{ code: "Q1", label: "Q1", name: "Q1", stage: "sek2", next: null },
				],
				classLabel: "{level}{group}",
			},
		};
		mirrorConfigTables(db, config);
		const levels = db.select().from(schoolLevel).orderBy(asc(schoolLevel.position)).all();
		expect(levels.map((l) => [l.code, l.nextCode, l.classLabel])).toEqual([
			["10", "Q1", "{level}{group}"],
			["Q1", null, "{level}"],
		]);
		expect(
			db.select().from(schoolSetting).where(eq(schoolSetting.key, "school_year_label")).get()
				?.value,
		).toBe("start");
		const now = new Date().toISOString();
		const add = (level: string, group: number): number =>
			db
				.insert(patron)
				.values({
					patronType: "student",
					firstName: "Anna",
					lastName: level,
					searchName: level,
					levelCode: level,
					classGroupId: group,
					createdAt: now,
					updatedAt: now,
				})
				.returning({ id: patron.id })
				.get().id;
		const label = (id: number): string | null =>
			db.select().from(patronClass).where(eq(patronClass.patronId, id)).get()?.classLabel ??
			null;
		expect(label(add("10", classId(db, "10", "b")))).toBe("10b");
		expect(label(add("Q1", classId(db, "Q1", "Kurs")))).toBe("Q1");
	});
});
