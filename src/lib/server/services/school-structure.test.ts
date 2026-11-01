// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { classId, inClass } from "../../../../tests/helpers/school.js";
import { loadConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, classGroupLevel, loan, patron, staffUser } from "#lib/server/db/schema.js";
import { setUiTheme } from "../../../../tests/helpers/config.js";
import {
	planSchoolStructure,
	saveSchoolStructure,
	SchoolNotReadyError,
	type SchoolDraft,
} from "./school-structure.js";

let dir = "";
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "bv-school-structure-"));
	setUiTheme(dir, "ocean"); // config.json from the example (a primaria, years 1–5)
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function setup(): { db: Db; actor: { id: number }; pupils: number[] } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const pupils = (
		[
			[5, "A"],
			[5, "B"],
			[4, "A"],
		] as const
	).map(
		([level, name], i) =>
			db
				.insert(patron)
				.values({
					firstName: "Anna",
					lastName: `Rossi${i}`,
					patronType: "student",
					...inClass(db, level, name),
				})
				.returning({ id: patron.id })
				.get().id,
	);
	// an empty class of the fourth year hosting the fifth too: it must not host it twice
	db.insert(classGroupLevel)
		.values({ groupId: classId(db, "4", "B"), levelCode: "5" })
		.run();
	return { db, actor, pupils };
}

/** The example's years without the fifth. */
function withoutFifth(): SchoolDraft {
	const school = loadConfig(dir).config.school;
	return {
		preset: "custom",
		stages: school.stages,
		levels: school.levels.filter((l) => l.code !== "5"),
	};
}

describe("school structure", () => {
	it("plans the removed years in use with their pupils and classes", () => {
		const { db } = setup();
		const config = loadConfig(dir).config;
		const plan = planSchoolStructure(db, config, withoutFifth());
		expect(plan).toEqual({
			ready: false,
			removed: [
				{
					code: "5",
					name: "Quinta primaria",
					pupils: 2,
					classes: ["4-5 B", "5 A", "5 B"],
					replacement: null,
				},
			],
		});
		// a replacement that is not among the years kept does not count
		expect(planSchoolStructure(db, config, withoutFifth(), { 5: "5" }).ready).toBe(false);
		expect(planSchoolStructure(db, config, withoutFifth(), { 5: "4" }).ready).toBe(true);
		// a year nobody uses goes without questions
		const school = config.school;
		expect(
			planSchoolStructure(db, config, {
				preset: "custom",
				stages: school.stages,
				levels: school.levels.filter((l) => l.code !== "1"),
			}),
		).toEqual({ ready: true, removed: [] });
	});

	it("refuses without a replacement, then moves pupils and classes in the same change", () => {
		const { db, actor, pupils } = setup();
		const config = loadConfig(dir).config;
		expect(() =>
			saveSchoolStructure({ db, config, configDir: dir }, withoutFifth(), {}, actor),
		).toThrow(SchoolNotReadyError);
		expect(loadConfig(dir).config.school.levels).toHaveLength(5);

		const result = saveSchoolStructure(
			{ db, config, configDir: dir },
			withoutFifth(),
			{ 5: "4" },
			actor,
		);
		expect(result).toMatchObject({ pupils: 2, classes: 2 });
		expect(loadConfig(dir).config.school.levels.map((l) => l.code)).toEqual([
			"1",
			"2",
			"3",
			"4",
		]);
		const level = (id: number): string | null =>
			db.select().from(patron).where(eq(patron.id, id)).get()?.levelCode ?? null;
		expect(pupils.map(level)).toEqual(["4", "4", "4"]);
		// 5 A and 5 B now host the fourth year; 4-5 B kept the fourth only, once
		const hosted = db.select().from(classGroupLevel).all();
		expect(hosted.filter((h) => h.levelCode === "5")).toEqual([]);
		expect(hosted.filter((h) => h.groupId === classId(db, "4", "B"))).toHaveLength(1);
		expect(db.select().from(loan).all()).toEqual([]);
		const row = db.select().from(auditLog).where(eq(auditLog.action, "config.school")).get();
		expect(row?.details).toMatchObject({ movedLevels: ["5>4"] });
	});
});
