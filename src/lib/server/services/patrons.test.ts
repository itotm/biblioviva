// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { todayIn } from "#lib/shared/dates.js";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { eq } from "drizzle-orm";
import {
	auditLog,
	biblio,
	classGroupLevel,
	item,
	loan,
	patron,
	staffUser,
} from "#lib/server/db/schema.js";
import type { PatronFormInput } from "#lib/shared/patron-schema.js";
import type { PatronData } from "./patrons.js";
import {
	createPatron,
	getPatron,
	PatronNotFoundError,
	PatronValidationError,
	searchNameOf,
	updatePatron,
	updatePatronNotes,
	validatePatron,
} from "./patrons.js";
import { searchPatrons } from "./patron-search.js";
import { censusGroups, classOptions } from "./patron-census.js";
import { setMembers } from "./patron-sets.js";
import { patronHistory } from "./loan-lists.js";
import type { Db } from "#lib/server/db/client.js";
import {
	classId,
	PATRON_RULES as rules,
	TEST_SCHOOL,
	teacherGroupId,
} from "../../../../tests/helpers/school.js";

const base: PatronFormInput = {
	patronType: "student",
	firstName: "Anna",
	lastName: "D'Angelo",
	levelCode: "3",
	groupId: "",
	groupName: "a",
	cardNumber: "",
	externalId: "",
	email: "",
	circulationNote: "",
	notes: "",
};
/** A fixed day for the reads that do not look at due dates. */
const TODAY = "2026-09-19";
const teacher: PatronFormInput = { ...base, patronType: "teacher", levelCode: "", groupName: "" };

/** A database with the classes 3 A, 3 B, 2 B and a 1-2 C pluriclasse, and a staff account. */
function setup(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	classId(db, "3", "A");
	classId(db, "3", "B");
	classId(db, "2", "B");
	const mixed = classId(db, "1", "C");
	db.insert(classGroupLevel).values({ groupId: mixed, levelCode: "2" }).run();
	const actor = db
		.insert(staffUser)
		.values({ username: "tessere", passwordHash: "x", roles: ["membership"] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

const codes = (fn: () => unknown): string[] => {
	try {
		fn();
		return [];
	} catch (e) {
		if (e instanceof PatronValidationError) {
			return e.issues.map((i) => `${i.field}:${i.code}`);
		}
		throw e;
	}
};

describe("patron validation", () => {
	it("normalises names for search (apostrophes, accents)", () => {
		expect(searchNameOf("D'Angelo", "Anna")).toBe("d angelo anna");
		expect(searchNameOf("Müller", "Zoë")).toBe("muller zoe");
	});

	it("students need an existing class hosting their level", () => {
		const { db } = setup();
		const v = (input: Partial<PatronFormInput>): PatronData =>
			validatePatron(db, { ...base, ...input }, rules);
		expect(codes(() => v({ groupName: "" }))).toEqual(["groupId:groupRequired"]);
		expect(codes(() => v({ groupName: "Z" }))).toEqual(["groupId:groupUnknown"]);
		expect(codes(() => v({ levelCode: "7" }))).toEqual([
			"levelCode:levelUnknown",
			"groupId:groupUnknown",
		]);
		// the class by id: a level it does not host is refused, its only level is taken
		const threeA = String(classId(db, "3", "A"));
		expect(codes(() => v({ groupId: threeA, groupName: "", levelCode: "2" }))).toEqual([
			"levelCode:levelNotInGroup",
		]);
		expect(v({ groupId: threeA, groupName: "", levelCode: "" })).toMatchObject({
			classGroupId: Number(threeA),
			levelCode: "3",
		});
		// by name (any case) and level; a pluriclasse needs the level
		expect(v({})).toMatchObject({
			classGroupId: Number(threeA),
			levelCode: "3",
			cardNumber: null,
			email: null,
		});
		const mixed = String(classId(db, "1", "C"));
		expect(codes(() => v({ groupId: mixed, groupName: "", levelCode: "" }))).toEqual([
			"levelCode:levelRequired",
		]);
		expect(v({ groupId: mixed, groupName: "", levelCode: "2" })).toMatchObject({
			levelCode: "2",
		});
		expect(v({ groupName: "C", levelCode: "2" }).classGroupId).toBe(Number(mixed));
	});

	it("teachers have no level and may name a teachers group; contacts are checked", () => {
		const { db } = setup();
		expect(codes(() => validatePatron(db, { ...teacher, levelCode: "3" }, rules))).toEqual([
			"levelCode:levelNotForTeachers",
		]);
		expect(validatePatron(db, teacher, rules)).toMatchObject({
			classGroupId: null,
			levelCode: null,
		});
		expect(
			codes(() => validatePatron(db, { ...teacher, groupName: "Nessuno" }, rules)),
		).toEqual(["groupId:groupUnknown"]);
		const group = teacherGroupId(db);
		expect(validatePatron(db, { ...teacher, groupId: String(group) }, rules).classGroupId).toBe(
			group,
		);
		// a students class is not a teachers group
		expect(
			codes(() =>
				validatePatron(db, { ...teacher, groupId: String(classId(db, "3", "A")) }, rules),
			),
		).toEqual(["groupId:groupUnknown"]);
		expect(codes(() => validatePatron(db, { ...base, email: "nope" }, rules))).toEqual([
			"email:emailInvalid",
		]);
		expect(codes(() => validatePatron(db, { ...base, cardNumber: "12a" }, rules))).toEqual([
			"cardNumber:cardNumberInvalid",
		]);
	});
});

describe("patron service", () => {
	it("creates, reads, updates (tracking changed fields) and audits without names", () => {
		const { db, actor } = setup();
		const id = createPatron(
			db,
			{ ...base, cardNumber: "0000001240", email: "anna.dangelo@scuola.example" },
			actor,
			rules,
		);
		const detail = getPatron(db, id, TODAY);
		expect(detail).toMatchObject({
			lastName: "D'Angelo",
			email: "anna.dangelo@scuola.example",
			classLabel: "3 A",
			levelCode: "3",
			status: "active",
			openLoans: [],
			totalLoans: 0,
		});

		expect(
			updatePatron(
				db,
				id,
				{ ...base, cardNumber: "0000001240", groupName: "B", notes: "x" },
				actor,
				rules,
			),
		).toEqual(["classGroupId", "email", "notes"]);
		expect(getPatron(db, id, TODAY).email).toBeNull();
		expect(
			updatePatron(
				db,
				id,
				{ ...base, cardNumber: "0000001240", groupName: "B", notes: "x" },
				actor,
				rules,
			),
		).toEqual([]);
		expect(getPatron(db, id, TODAY).classLabel).toBe("3 B");

		// uniqueness of card number and external id
		expect(
			codes(() => createPatron(db, { ...base, cardNumber: "0000001240" }, actor, rules)),
		).toEqual(["cardNumber:cardNumberTaken"]);
		const other = createPatron(db, { ...base, externalId: "M1" }, actor, rules);
		expect(
			codes(() =>
				updatePatron(db, other, { ...base, cardNumber: "0000001240" }, actor, rules),
			),
		).toEqual(["cardNumber:cardNumberTaken"]);
		expect(codes(() => createPatron(db, { ...base, externalId: "M1" }, actor, rules))).toEqual([
			"externalId:externalIdTaken",
		]);

		expect(() => updatePatron(db, 999, base, actor, rules)).toThrow(PatronNotFoundError);
		expect(() => getPatron(db, 999, TODAY)).toThrow(PatronNotFoundError);

		const rows = db.select().from(auditLog).all();
		expect(rows.map((r) => r.action)).toEqual([
			"patron.create",
			"patron.update",
			"patron.create",
		]);
		expect(JSON.stringify(rows)).not.toMatch(/Angelo|Anna/);
		expect(rows[1]?.details).toEqual({ changed: ["classGroupId", "email", "notes"] });
	});

	it("lists the loan history newest first with outcomes, and edits the notes", () => {
		const { db, actor } = setup();
		const id = createPatron(db, base, actor, rules);
		const b = db
			.insert(biblio)
			.values({ title: "Il libro", author: "Autore", publisher: "P", kind: "fiction" })
			.returning({ id: biblio.id })
			.get();
		const copies = ["2026-00011", "2026-00029", "2026-00037"].map(
			(barcode) =>
				db.insert(item).values({ biblioId: b.id, barcode }).returning({ id: item.id }).get()
					.id,
		);
		const loans = [
			{
				itemId: copies[0]!,
				issuedAt: "2026-09-01T08:00:00.000Z",
				dueDate: "2026-09-15",
				returnedAt: "2026-09-10T08:00:00.000Z",
			},
			{
				itemId: copies[1]!,
				issuedAt: "2026-09-02T08:00:00.000Z",
				dueDate: "2026-09-16",
				returnedAt: "2026-09-20T08:00:00.000Z",
			},
			{
				itemId: copies[2]!,
				issuedAt: "2026-09-03T08:00:00.000Z",
				dueDate: "2026-09-17",
				returnedAt: null,
			},
		];
		for (const l of loans) {
			db.insert(loan)
				.values({
					...l,
					patronId: id,
					patronTypeSnapshot: "student",
					schoolYear: "2026/2027",
				})
				.run();
		}
		const rows = patronHistory(db, id, "2026-09-18");
		expect(rows.map((r) => [r.barcode, r.outcome])).toEqual([
			["2026-00037", "overdue"],
			["2026-00029", "returnedLate"],
			["2026-00011", "returned"],
		]);
		expect(patronHistory(db, id, "2026-09-10")[0]?.outcome).toBe("open");
		expect(rows[0]).toMatchObject({
			title: "Il libro",
			author: "Autore",
			schoolYear: "2026/2027",
		});
		expect(() => patronHistory(db, 999, TODAY)).toThrow(PatronNotFoundError);

		expect(
			updatePatronNotes(db, id, { circulationNote: " Attenzione ", notes: "" }, actor),
		).toEqual(["circulationNote"]);
		expect(getPatron(db, id, TODAY)).toMatchObject({
			circulationNote: "Attenzione",
			notes: null,
		});
		expect(
			updatePatronNotes(db, id, { circulationNote: "Attenzione", notes: "" }, actor),
		).toEqual([]);
		expect(() => updatePatronNotes(db, 999, { circulationNote: "", notes: "" }, actor)).toThrow(
			PatronNotFoundError,
		);
	});

	it("searches by accent-insensitive prefix on any word and filters the grid", () => {
		const { db, actor } = setup();
		createPatron(db, base, actor, rules); // D'Angelo Anna 3 A
		createPatron(
			db,
			{ ...base, firstName: "Luca", lastName: "Müller", levelCode: "2", groupName: "B" },
			actor,
			rules,
		);
		createPatron(db, { ...teacher, firstName: "Sara", lastName: "Angeli" }, actor, rules);

		expect(searchPatrons(db, { q: "d'ang" }, TODAY, "it").rows.map((r) => r.lastName)).toEqual([
			"D'Angelo",
		]);
		expect(searchPatrons(db, { q: "mul" }, TODAY, "it").rows.map((r) => r.lastName)).toEqual([
			"Müller",
		]);
		expect(searchPatrons(db, { q: "ANNA" }, TODAY, "it").rows.map((r) => r.lastName)).toEqual([
			"D'Angelo",
		]);
		expect(searchPatrons(db, { q: "ang" }, TODAY, "it").rows.map((r) => r.lastName)).toEqual([
			"Angeli",
			"D'Angelo",
		]);
		expect(
			searchPatrons(db, { patronType: "teacher" }, TODAY, "it").rows.map((r) => r.lastName),
		).toEqual(["Angeli"]);
		expect(
			searchPatrons(db, { groupId: String(classId(db, "2", "B")) }, TODAY, "it").total,
		).toBe(1);
		expect(searchPatrons(db, { levelCode: "3" }, TODAY, "it").total).toBe(1);
		// the stage of the school (12.9): its pupils; the teachers group has none here
		expect(searchPatrons(db, { stage: "primaria" }, TODAY, "it").total).toBe(2);
		expect(searchPatrons(db, { stage: "media" }, TODAY, "it").total).toBe(0);
		expect(searchPatrons(db, { status: "anonymized" }, TODAY, "it").total).toBe(0);
		expect(
			searchPatrons(db, { sort: "class" }, TODAY, "it").rows.map((r) => r.classLabel),
		).toEqual(["2 B", "3 A", "Docenti"]);
		expect(searchPatrons(db, { limit: 1, offset: 1 }, TODAY, "it").rows).toHaveLength(1);
		const options = classOptions(db, TEST_SCHOOL);
		expect(options.levels.map((l) => l.code)).toEqual(["1", "2", "3", "4", "5"]);
		expect(options.groups.map((g) => g.label)).toEqual([
			"1-2 C",
			"2 B",
			"3 A",
			"3 B",
			"Docenti",
		]);
		expect(options.groupWord).toBe("Sezione");
	});

	it("lists 1 000 patrons with loan counts in less than 300 ms", () => {
		const db = createTestDb();
		seedDatabase(db, {
			patrons: 970,
			teachers: 30,
			biblios: 300,
			items: 400,
			loans: 600,
			today: "2026-09-19",
		});
		const started = performance.now();
		const result = searchPatrons(db, { limit: 1000 }, "2026-09-19", "it");
		const elapsed = performance.now() - started;
		expect(result.rows).toHaveLength(1000);
		expect(result.total).toBe(1000);
		expect(result.rows.some((r) => r.openLoans > 0)).toBe(true);
		expect(result.rows.some((r) => r.overdueLoans > 0)).toBe(true);
		expect(elapsed).toBeLessThan(300);
		const withLoan = result.rows.find((r) => r.openLoans > 0)!;
		const detail = getPatron(db, withLoan.id, "2026-09-19");
		expect(detail.openLoans.length).toBe(withLoan.openLoans);
		expect(detail.openLoans[0]).toMatchObject({
			barcode: expect.any(String),
			title: expect.any(String),
		});
	});
});

describe("today is the library's day", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("counts a loan due yesterday in the library as overdue just after its midnight", () => {
		// 23:30 UTC on 25 October is 00:30 of the 26th in Rome: the loan due on the 25th is late
		vi.useFakeTimers({ now: new Date("2026-10-25T23:30:00Z"), toFake: ["Date"] });
		const { db, actor } = setup();
		const id = createPatron(db, base, actor, rules);
		const b = db
			.insert(biblio)
			.values({ title: "Il libro", author: "Autore", publisher: "P", kind: "fiction" })
			.returning({ id: biblio.id })
			.get();
		const copy = db
			.insert(item)
			.values({ biblioId: b.id, barcode: "2026-00011" })
			.returning({ id: item.id })
			.get();
		db.insert(loan)
			.values({
				itemId: copy.id,
				patronId: id,
				issuedAt: "2026-10-11T08:00:00.000Z",
				dueDate: "2026-10-25",
				patronTypeSnapshot: "student",
				schoolYear: "2026/2027",
			})
			.run();
		const today = todayIn("Europe/Rome");
		expect(getPatron(db, id, today).openLoans[0]?.overdue).toBe(true);
		expect(patronHistory(db, id, today)[0]?.outcome).toBe("overdue");
		expect(searchPatrons(db, { q: "angelo" }, today, "it").rows[0]?.overdueLoans).toBe(1);
		// no caller can fall back to the host's clock: the library's day is a required argument
		expectTypeOf(getPatron).parameter(2).toEqualTypeOf<string>();
		expectTypeOf(patronHistory).parameter(2).toEqualTypeOf<string>();
		expectTypeOf(searchPatrons).parameter(2).toEqualTypeOf<string>();
	});
});

describe("census", () => {
	it("lists every class (empty ones too) with photo progress, those without photo first", () => {
		const { db, actor } = setup();
		const a = createPatron(db, { ...base, lastName: "Bianchi" }, actor, rules); // 3 A
		const b = createPatron(db, { ...base, lastName: "Alfieri" }, actor, rules); // 3 A
		createPatron(
			db,
			{ ...base, lastName: "Verdi", levelCode: "2", groupName: "B" },
			actor,
			rules,
		);
		createPatron(db, { ...teacher, lastName: "Neri" }, actor, rules);
		db.update(patron).set({ photoPath: "uploads/x.webp" }).where(eq(patron.id, b)).run();
		// a pupil the class upgrade left without a class
		const loose = createPatron(db, { ...base, lastName: "Gialli" }, actor, rules);
		db.update(patron).set({ classGroupId: null }).where(eq(patron.id, loose)).run();

		const groups = censusGroups(db, TEST_SCHOOL);
		expect(groups.map((g) => [g.label, g.kind, g.total, g.withPhoto])).toEqual([
			["1-2 C", "students", 0, 0],
			["2 B", "students", 1, 0],
			["3 A", "students", 2, 1],
			["3 B", "students", 0, 0],
			["Docenti", "teachers", 1, 0],
			["", null, 1, 0],
		]);
		const threeA = classId(db, "3", "A");
		expect(setMembers(db, { group: threeA }).map((p) => [p.id, p.hasPhoto])).toEqual([
			[a, false],
			[b, true],
		]);
		expect(setMembers(db, { group: teacherGroupId(db) }).map((p) => p.lastName)).toEqual([
			"Neri",
		]);
		expect(setMembers(db, { group: null }).map((p) => p.id)).toEqual([loose]);
		// anonymized patrons never appear
		db.update(patron).set({ status: "anonymized" }).where(eq(patron.id, a)).run();
		expect(censusGroups(db, TEST_SCHOOL).find((g) => g.groupId === threeA)?.total).toBe(1);
	});
});
