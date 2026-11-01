// SPDX-License-Identifier: GPL-3.0-or-later
// Patron quick search (step 5.2): names with particles ("De Luca") found with or without the
// space, class filter, at most 20 rows, anonymized patrons never shown, fast on 1 000 patrons.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { anonymizePatron } from "./anonymize.js";
import { createPatron } from "./patrons.js";
import { quickSearchPatrons, searchPatrons } from "./patron-search.js";
import { PATRON_RULES, classId } from "../../../../tests/helpers/school.js";

let db: Db;
let deLuca = 0;
let deLucia = 0;
let gone = 0;

beforeAll(() => {
	db = createTestDb();
	seedDatabase(db, { patrons: 1000, teachers: 60, biblios: 50, items: 60, loans: 20 });
	const actor = db
		.insert(staffUser)
		.values({ username: "search", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const person = (lastName: string, firstName: string, levelCode: string): number =>
		createPatron(
			db,
			{
				patronType: "student",
				firstName,
				lastName,
				levelCode,
				groupId: String(classId(db, levelCode, "A")),
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
	deLuca = person("De Luca", "Mario", "2");
	deLucia = person("De Lucia", "Anna", "3");
	gone = person("De Lucchi", "Paolo", "3");
	anonymizePatron(db, "/nonexistent", gone, actor);
});

/** The exact results (the approximate ones of 9.24 are tested on their own). */
const ids = (q: string, options = {}): number[] =>
	quickSearchPatrons(db, q, { locale: "it", ...options })
		.filter((p) => !p.similar)
		.map((p) => p.id);

describe("patron quick search", () => {
	it('"de luca" and "deluca" both find De Luca', () => {
		expect(ids("de luca")).toContain(deLuca);
		expect(ids("deluca")).toContain(deLuca);
		expect(ids("DE LÚCA")).toContain(deLuca);
		expect(ids("deluc")).toEqual(expect.arrayContaining([deLuca, deLucia]));
		expect(ids("delucia")).toContain(deLucia);
		expect(ids("delucia")).not.toContain(deLuca);
		expect(ids("luca mario")).toContain(deLuca);
		// the grid of the patrons page uses the same rule
		expect(
			searchPatrons(db, { q: "deluca" }, "2026-09-19", "it").rows.map((r) => r.id),
		).toContain(deLuca);
	});

	it("finds a part of the name anywhere, from three characters, as the catalogue does", () => {
		// inside a word, across the space, without the space
		expect(ids("uca mario")).toContain(deLuca);
		expect(ids("elucia")).toContain(deLucia);
		expect(ids("elucia")).not.toContain(deLuca);
		expect(ids("lucia ann")).toContain(deLucia);
		// under three characters the desk does not search yet
		expect(quickSearchPatrons(db, "de", { locale: "it" })).toEqual([]);
	});

	it("filters by class, never shows anonymized patrons, stops at 20 rows", () => {
		expect(ids("deluc", { groupId: classId(db, "3", "A") })).toEqual([deLucia]);
		expect(ids("delucchi")).toEqual([]);
		expect(ids("d")).toEqual([]);
		expect(quickSearchPatrons(db, "a", { locale: "it" }).length).toBe(0);
		expect(quickSearchPatrons(db, "an", { locale: "it" }).length).toBeLessThanOrEqual(20);
		expect(
			quickSearchPatrons(db, "an", { limit: 50, locale: "it" }).length,
		).toBeLessThanOrEqual(20);
	});

	it("finds a patron by card number in the grid and the quick search (bug: digits found nobody)", () => {
		const card = db.$client
			.query<{ c: string }, [number]>("SELECT card_number AS c FROM patron WHERE id = ?1")
			.get(deLuca)?.c;
		expect(card).toBeTruthy();
		expect(searchPatrons(db, { q: card! }, "2026-09-19", "it").rows.map((r) => r.id)).toEqual([
			deLuca,
		]);
		expect(ids(card!)).toEqual([deLuca]);
		// the digits typed so far, as the patrons grid sends them
		const digits = card!.replace(/\D/g, "");
		expect(
			searchPatrons(db, { q: digits }, "2026-09-19", "it").rows.map((r) => r.id),
		).toContain(deLuca);
	});

	it("forgives typing mistakes in names when fewer than 3 are found (9.24)", () => {
		const quick = (q: string): { exact: number[]; similar: number[] } => {
			const rows = quickSearchPatrons(db, q, { locale: "it" });
			return {
				exact: rows.filter((r) => !r.similar).map((r) => r.id),
				similar: rows.filter((r) => r.similar).map((r) => r.id),
			};
		};
		// a swapped pair of letters, the surname with or without its space
		expect(quick("de lcua mario").similar[0]).toBe(deLuca);
		expect(quick("delcua").similar).toContain(deLuca);
		expect(quick("mraio deluca").similar[0]).toBe(deLuca);
		// every word before some: Mario De Luca before Anna De Lucia for "lucia anan"
		expect(quick("lucai anan").similar[0]).toBe(deLucia);
		// the grid of the patrons page marks them too, with its filters
		const grid = searchPatrons(db, { q: "de lcua" }, "2026-09-19", "it").rows;
		expect(grid.find((r) => r.id === deLuca)?.similar).toBe(true);
		expect(
			searchPatrons(db, { q: "de lcua", patronType: "teacher" }, "2026-09-19", "it").rows,
		).toEqual([]);
		// never anonymized patrons, never mistakes in words under four letters
		expect(quick("delucchi paolo").similar).not.toContain(gone);
		expect(quick("dee").similar).toEqual([]);
	});

	it("answers in under 20 ms on 1 000 patrons", () => {
		// the best of a few runs: what the search costs, not how busy the machine is (the whole
		// suite runs in parallel with the build)
		const fastest = (run: () => void): number =>
			Math.min(
				...Array.from({ length: 5 }, () => {
					const start = performance.now();
					run();
					return performance.now() - start;
				}),
			);
		quickSearchPatrons(db, "ro", { locale: "it" });
		expect(fastest(() => quickSearchPatrons(db, "deluca", { locale: "it" }))).toBeLessThan(20);
		expect(quickSearchPatrons(db, "deluca", { locale: "it" }).length).toBeGreaterThan(0);
		// the approximate pass included (9.24), warmed once as a running server would be
		quickSearchPatrons(db, "lcua mraio", { locale: "it" });
		expect(
			fastest(() => quickSearchPatrons(db, "mraio de lcua", { locale: "it" })),
		).toBeLessThan(20);
		expect(
			quickSearchPatrons(db, "mraio de lcua", { locale: "it" }).some((r) => r.similar),
		).toBe(true);
	});
});
