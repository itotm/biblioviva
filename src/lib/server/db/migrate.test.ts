// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { refreshPatronSearchNames } from "./migrate.js";

function searchNames(db: ReturnType<typeof createTestDb>): string[] {
	return db.$client
		.query<{ search_name: string }, []>("SELECT search_name FROM patron ORDER BY id")
		.all()
		.map((r) => r.search_name);
}

describe("refreshPatronSearchNames", () => {
	it("recomputes the search names written by another fold and leaves the others", () => {
		const db = createTestDb();
		const insert = db.$client.query(
			"INSERT INTO patron (first_name, last_name, patron_type, search_name) VALUES (?1, ?2, 'student', ?3)",
		);
		// "ا براهيم" is what the fold made of a hamza before it kept the word whole
		insert.run("إبراهيم", "الحسن", "ال حسن ا براهيم");
		insert.run("Mario", "De Luca", "de luca mario");
		expect(refreshPatronSearchNames(db.$client)).toBe(1);
		expect(searchNames(db)).toEqual(["الحسن ابراهيم", "de luca mario"]);
		expect(refreshPatronSearchNames(db.$client)).toBe(0);
	});
});
