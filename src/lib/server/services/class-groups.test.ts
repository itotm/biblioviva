// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { inClass, TEST_SCHOOL } from "../../../../tests/helpers/school.js";
import type { Db } from "#lib/server/db/client.js";
import { auditLog, patron, staffUser } from "#lib/server/db/schema.js";
import {
	archiveGroup,
	createGroups,
	defaultTeacherGroup,
	GroupError,
	listGroups,
	restoreGroup,
	updateGroup,
} from "./class-groups.js";

function setup(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "admin", passwordHash: "x", roles: ["admin"] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

const codeOf = (fn: () => unknown): string | null => {
	try {
		fn();
		return null;
	} catch (e) {
		if (e instanceof GroupError) {
			return e.code;
		}
		throw e;
	}
};

const student = (
	name: string,
	levels: string[],
): { kind: "students"; name: string; levels: string[] } => ({ kind: "students", name, levels });

describe("class groups", () => {
	it("creates many classes at once, all or none, and lists them in class order", () => {
		const { db, actor } = setup();
		const ids = createGroups(
			db,
			TEST_SCHOOL,
			[student(" B ", ["2"]), student("A", ["2"]), student("C", ["2", "1"])],
			actor,
		);
		expect(ids).toHaveLength(3);
		expect(
			codeOf(() =>
				createGroups(db, TEST_SCHOOL, [student("D", ["3"]), student("A", ["2"])], actor),
			),
		).toBe("nameTaken");
		// nothing of the refused batch was written
		expect(listGroups(db, TEST_SCHOOL).map((g) => [g.name, g.levels])).toEqual([
			["C", ["1", "2"]],
			["A", ["2"]],
			["B", ["2"]],
		]);
		// the same name for another level is another class
		createGroups(db, TEST_SCHOOL, [student("a", ["3"])], actor);
		expect(
			db
				.select()
				.from(auditLog)
				.all()
				.map((r) => r.action),
		).toEqual(["group.create", "group.create"]);
	});

	it("checks names and levels", () => {
		const { db, actor } = setup();
		const make = (input: Parameters<typeof createGroups>[2][number]): string | null =>
			codeOf(() => createGroups(db, TEST_SCHOOL, [input], actor));
		expect(make(student("  ", ["1"]))).toBe("nameRequired");
		expect(make(student("x".repeat(41), ["1"]))).toBe("nameLong");
		expect(make(student("A", []))).toBe("levelsRequired");
		expect(make(student("A", ["9"]))).toBe("levelUnknown");
		expect(make({ kind: "teachers", name: "Docenti", levels: ["1"] })).toBe(
			"levelsNotForTeachers",
		);
		expect(make({ kind: "teachers", name: "Docenti", levels: [], stage: "primaria" })).toBe(
			null,
		);
		expect(make({ kind: "teachers", name: "docenti", levels: [] })).toBe("nameTaken");
	});

	it("renames and re-levels, keeping the levels its pupils have", () => {
		const { db, actor } = setup();
		const pupil = inClass(db, 3, "A");
		db.insert(patron)
			.values({
				firstName: "Anna",
				lastName: "Rossi",
				patronType: "student",
				...pupil,
			})
			.run();
		updateGroup(db, TEST_SCHOOL, pupil.classGroupId, student("Api", ["3", "4"]), actor);
		const [row] = listGroups(db, TEST_SCHOOL);
		expect(row).toMatchObject({ name: "Api", levels: ["3", "4"], patrons: 1 });
		expect(
			codeOf(() =>
				updateGroup(db, TEST_SCHOOL, pupil.classGroupId, student("Api", ["4"]), actor),
			),
		).toBe("levelInUse");
		expect(codeOf(() => updateGroup(db, TEST_SCHOOL, 999, student("X", ["1"]), actor))).toBe(
			"notFound",
		);
	});

	it("archives only an empty class and brings it back", () => {
		const { db, actor } = setup();
		const pupil = inClass(db, 2, "B");
		const id = db
			.insert(patron)
			.values({ firstName: "Anna", lastName: "Rossi", patronType: "student", ...pupil })
			.returning({ id: patron.id })
			.get().id;
		expect(codeOf(() => archiveGroup(db, pupil.classGroupId, actor))).toBe("notEmpty");
		// an anonymized patron does not keep the class open
		db.update(patron).set({ status: "anonymized" }).where(eq(patron.id, id)).run();
		archiveGroup(db, pupil.classGroupId, actor);
		expect(listGroups(db, TEST_SCHOOL)).toEqual([]);
		expect(listGroups(db, TEST_SCHOOL, { archived: true })[0]?.archived).toBe(true);
		// a new 2 B made meanwhile blocks the restore
		const [other] = createGroups(db, TEST_SCHOOL, [student("B", ["2"])], actor);
		expect(codeOf(() => restoreGroup(db, TEST_SCHOOL, pupil.classGroupId, actor))).toBe(
			"nameTaken",
		);
		archiveGroup(db, other ?? 0, actor);
		restoreGroup(db, TEST_SCHOOL, pupil.classGroupId, actor);
		expect(listGroups(db, TEST_SCHOOL).map((g) => g.id)).toEqual([pupil.classGroupId]);
		expect(codeOf(() => archiveGroup(db, 999, actor))).toBe("notFound");
		expect(codeOf(() => restoreGroup(db, TEST_SCHOOL, 999, actor))).toBe("notFound");
	});

	it("makes the teachers group once", () => {
		const { db } = setup();
		const id = defaultTeacherGroup(db, "Docenti");
		expect(defaultTeacherGroup(db, "Insegnanti")).toBe(id);
		expect(listGroups(db, TEST_SCHOOL)).toMatchObject([
			{ id, kind: "teachers", name: "Docenti", levels: [] },
		]);
	});
});
