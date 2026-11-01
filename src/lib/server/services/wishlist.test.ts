// SPDX-License-Identifier: GPL-3.0-or-later
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { auditLog, staffUser, wish } from "#lib/server/db/schema.js";
import { anonymizePatrons } from "./anonymize.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { createPatron } from "./patrons.js";
import {
	addWishRequests,
	createWish,
	deleteWishes,
	fulfilWish,
	getWish,
	listWishes,
	similarToWish,
	updateWish,
	validateWish,
	WishNotFoundError,
	WishValidationError,
	type WishInput,
} from "./wishlist.js";
import { PATRON_RULES, classId } from "../../../../tests/helpers/school.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);
const blank: WishInput = {
	title: "",
	author: "",
	series: "",
	seriesNumber: "",
	note: "",
	patronId: null,
};

function setup(): { db: ReturnType<typeof createTestDb>; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "banco", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

describe("wishlist", () => {
	it("needs a title, an author or a series; drops a number without a series", () => {
		expect(() => validateWish(blank)).toThrow(WishValidationError);
		expect(() => validateWish({ ...blank, note: "solo una nota" })).toThrow("empty");
		expect(() => validateWish({ ...blank, title: "x".repeat(301) })).toThrow("tooLong");
		expect(validateWish({ ...blank, author: "  Rowling,  J. K. ", seriesNumber: "3" })).toEqual(
			{
				title: null,
				author: "Rowling, J. K.",
				series: null,
				seriesNumber: null,
				note: null,
				patronId: null,
			},
		);
		expect(validateWish({ ...blank, series: "Pepe Lampo", seriesNumber: "2" })).toMatchObject({
			series: "Pepe Lampo",
			seriesNumber: "2",
		});
	});

	it("adds, counts the same book again, edits, searches, sorts and deletes", () => {
		const { db, actor } = setup();
		const first = createWish(
			db,
			{ ...blank, title: "Il GGG", author: "Dahl, Roald", note: "4 B" },
			actor,
			new Date("2026-09-20T10:00:00Z"),
		);
		expect(first.merged).toBe(false);
		// the same book, typed differently: one more request, the first note kept
		const again = createWish(
			db,
			{ ...blank, title: "il ggg!", author: "DAHL, roald", note: "5 A" },
			actor,
			new Date("2026-09-21T10:00:00Z"),
		);
		expect(again).toEqual({ id: first.id, merged: true });
		expect(getWish(db, first.id)).toMatchObject({ requests: 2, note: "4 B" });
		const series = createWish(
			db,
			{ ...blank, series: "Pepe Lampo", seriesNumber: "3" },
			actor,
			new Date("2026-09-22T10:00:00Z"),
		);
		expect(listWishes(db).map((w) => w.id)).toEqual([series.id, first.id]);
		expect(listWishes(db, { sort: "requests" })[0]?.id).toBe(first.id);
		expect(listWishes(db, { sort: "title" }).map((w) => w.id)).toEqual([first.id, series.id]);
		expect(listWishes(db, { q: "dahl" }).map((w) => w.id)).toEqual([first.id]);
		expect(listWishes(db, { q: "lampo" }).map((w) => w.id)).toEqual([series.id]);

		updateWish(db, series.id, { ...blank, series: "Pepe Lampo", seriesNumber: "4" }, actor);
		expect(getWish(db, series.id).seriesNumber).toBe("4");
		expect(() => updateWish(db, 999, { ...blank, title: "x" }, actor)).toThrow(
			WishNotFoundError,
		);
		expect(() => getWish(db, 999)).toThrow(WishNotFoundError);

		expect(addWishRequests(db, [first.id, series.id], actor)).toBe(2);
		expect(getWish(db, first.id).requests).toBe(3);
		expect(addWishRequests(db, [], actor)).toBe(0);
		expect(deleteWishes(db, [series.id], actor)).toBe(1);
		expect(deleteWishes(db, [], actor)).toBe(0);
		expect(listWishes(db)).toHaveLength(1);
		// the audit names no book and no patron
		const details = db
			.select({ action: auditLog.action, details: auditLog.details })
			.from(auditLog)
			.all()
			.filter((r) => r.action.startsWith("wish."));
		expect(details.map((r) => r.action)).toEqual([
			"wish.create",
			"wish.request",
			"wish.create",
			"wish.update",
			"wish.request",
			"wish.delete",
		]);
		expect(JSON.stringify(details)).not.toContain("Dahl");
	});

	it("keeps the requester, forgets it when the patron is removed, ends with the record", () => {
		const { db, actor } = setup();
		const student = createPatron(
			db,
			{
				patronType: "student",
				firstName: "Anna",
				lastName: "Rossi",
				levelCode: "3",
				groupId: String(classId(db, "3", "A")),
				groupName: "",
				cardNumber: "",
				externalId: "",
				email: "",
				circulationNote: "",
				notes: "",
			},
			actor,
			PATRON_RULES,
		);
		const w = createWish(db, { ...blank, title: "Matilde", patronId: student }, actor);
		expect(getWish(db, w.id)).toMatchObject({ patronId: student, patronName: "Rossi Anna" });
		anonymizePatrons(db, "/tmp/none", [student], actor);
		expect(getWish(db, w.id)).toMatchObject({ patronId: null, patronName: null });

		const biblioId = createBiblio(
			db,
			{
				title: "Matilde",
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Dahl, Roald",
				publisher: "Salani",
				publicationPlace: "",
				publicationYear: "2020",
				isbn: "",
				issn: "",
				ean: "",
				physicalDescription: "",
				series: "",
				seriesNumber: "",
				dewey: "",
				kind: "fiction",
				genreCode: "G",
				classCode: "",
				readingLevel: "",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
		expect(fulfilWish(db, w.id, biblioId, actor)).toBe(true);
		expect(fulfilWish(db, w.id, biblioId, actor)).toBe(false);
		expect(db.select().from(wish).where(eq(wish.id, w.id)).get()).toBeUndefined();
	});

	it("finds what the catalogue and the list already have", () => {
		const { db, actor } = setup();
		const record = createBiblio(
			db,
			{
				title: "Il piccolo principe",
				subtitle: "",
				originalTitle: "",
				responsibility: "",
				author: "Saint-Exupéry, Antoine de",
				publisher: "Bompiani",
				publicationPlace: "",
				publicationYear: "2015",
				isbn: "",
				issn: "",
				ean: "",
				physicalDescription: "",
				series: "Classici",
				seriesNumber: "1",
				dewey: "",
				kind: "fiction",
				genreCode: "G",
				classCode: "",
				readingLevel: "",
				subjects: "",
				notes: "",
			},
			actor,
			rules,
		);
		const wished = createWish(db, { ...blank, title: "Il piccolo principe illustrato" }, actor);
		const byTitle = similarToWish(
			db,
			{ title: "piccolo principe", author: "", series: "" },
			rules,
		);
		expect(byTitle.catalog.map((r) => r.id)).toEqual([record]);
		expect(byTitle.wishes.map((w) => w.id)).toEqual([wished.id]);
		expect(
			similarToWish(db, { title: "", author: "", series: "classici" }, rules).catalog,
		).toHaveLength(1);
		// too short to mean anything
		expect(similarToWish(db, { title: "il", author: "", series: "" }, rules)).toEqual({
			catalog: [],
			wishes: [],
		});
	});
});
