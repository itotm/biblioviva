// SPDX-License-Identifier: GPL-3.0-or-later
// The school of the test configuration (tests/fixtures/config: an Italian primaria, years 1–5,
// "3 B" labels) and helpers to put patrons in classes: a class is made the first time a test needs
// it, so fixtures can keep saying "3 A" (PLAN.md Phase 12).
import { and, eq, isNull } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { classGroup, classGroupLevel, schoolLevel, schoolSetting } from "#lib/server/db/schema.js";
import type { PatronRules } from "#lib/server/services/patrons.js";
import { nextLevel, templateOf, type SchoolStructure } from "#lib/shared/school.js";
import { CARD_RULES } from "./codes.js";

const NAMES = ["Prima", "Seconda", "Terza", "Quarta", "Quinta"];

export const TEST_SCHOOL: SchoolStructure = {
	stages: [{ code: "primaria", name: "Primaria" }],
	levels: NAMES.map((n, i) => ({
		code: String(i + 1),
		label: String(i + 1),
		name: `${n} primaria`,
		stage: "primaria",
	})),
	classLabel: "{level} {group}",
	groupWord: "Sezione",
	cardClass: "{word} {group}",
	promotion: { withinStage: "keep", acrossStages: "ask" },
};

export const TEACHER_GROUP = "Docenti";

/** What the patron services need: the school, the teachers group, the card format. */
export const PATRON_RULES: PatronRules = {
	school: TEST_SCHOOL,
	teacherGroupName: TEACHER_GROUP,
	...CARD_RULES,
};

/** The mirror tables of the school (`config-mirror.ts`), as the server fills them at startup. */
export function mirrorTestSchool(db: DbOrTx, school: SchoolStructure = TEST_SCHOOL): void {
	db.delete(schoolLevel).run();
	school.levels.forEach((l, position) => {
		db.insert(schoolLevel)
			.values({
				code: l.code,
				position,
				label: l.label,
				name: l.name,
				stage: l.stage,
				nextCode: nextLevel(school, l.code),
				classLabel: templateOf(school, l.code),
			})
			.run();
	});
	db.delete(schoolSetting).run();
	db.insert(schoolSetting).values({ key: "class_label", value: school.classLabel }).run();
}

/** The id of the active students class `name` hosting `level`, made (with the mirrors) when missing. */
export function classId(db: DbOrTx, level: string, name: string): number {
	if (db.select().from(schoolLevel).all().length === 0) {
		mirrorTestSchool(db);
	}
	const found = db
		.select({ id: classGroup.id })
		.from(classGroup)
		.innerJoin(classGroupLevel, eq(classGroupLevel.groupId, classGroup.id))
		.where(
			and(
				eq(classGroup.kind, "students"),
				eq(classGroup.name, name),
				eq(classGroupLevel.levelCode, level),
				isNull(classGroup.archivedAt),
			),
		)
		.get();
	if (found) {
		return found.id;
	}
	const now = new Date().toISOString();
	const id = db
		.insert(classGroup)
		.values({ kind: "students", name, createdAt: now, updatedAt: now })
		.returning({ id: classGroup.id })
		.get().id;
	db.insert(classGroupLevel).values({ groupId: id, levelCode: level }).run();
	return id;
}

/** The teachers group, made when missing. */
export function teacherGroupId(db: DbOrTx): number {
	const found = db
		.select({ id: classGroup.id })
		.from(classGroup)
		.where(and(eq(classGroup.kind, "teachers"), isNull(classGroup.archivedAt)))
		.get();
	if (found) {
		return found.id;
	}
	const now = new Date().toISOString();
	return db
		.insert(classGroup)
		.values({ kind: "teachers", name: TEACHER_GROUP, createdAt: now, updatedAt: now })
		.returning({ id: classGroup.id })
		.get().id;
}

/**
 * The patron columns of a pupil of `3 A` (`inClass(db, "3", "A")`), to spread into an insert:
 * `{ classGroupId, levelCode }`.
 */
export function inClass(
	db: DbOrTx,
	level: string | number,
	name: string,
): { classGroupId: number; levelCode: string } {
	return { classGroupId: classId(db, String(level), name), levelCode: String(level) };
}

/** The patron columns of a teacher: the teachers group, no level. */
export function asTeacher(db: DbOrTx): { classGroupId: number; levelCode: null } {
	return { classGroupId: teacherGroupId(db), levelCode: null };
}
