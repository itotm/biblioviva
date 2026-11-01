// SPDX-License-Identifier: GPL-3.0-or-later
// Catalogue search on a full-size catalogue (step 5.1 acceptance): 10 000 records, a query in
// under 50 ms, words in any order, accents ignored; typing mistakes forgiven (9.24).
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import { seedDatabase } from "#lib/server/db/seed.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { searchBiblios } from "./catalog-search.js";

const rules = catalogRules(parseConfig(exampleRaw()).config);
let db: Db;
let calvino = 0;
let citta = 0;
const zefiro: number[] = [];

const record = {
	subtitle: "",
	originalTitle: "",
	responsibility: "",
	publisher: "Mondadori",
	publicationPlace: "Milano",
	publicationYear: "1965",
	isbn: "",
	issn: "",
	ean: "",
	physicalDescription: "",
	series: "",
	seriesNumber: "",
	dewey: "",
	kind: "fiction" as const,
	genreCode: "G",
	classCode: "",
	readingLevel: "",
	subjects: "",
	notes: "",
};

beforeAll(() => {
	db = createTestDb();
	seedDatabase(db, { patrons: 50, teachers: 5, biblios: 10_000, items: 10_500, loans: 100 });
	const actor = db
		.insert(staffUser)
		.values({ username: "perf", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	calvino = createBiblio(
		db,
		{ ...record, title: "Le cosmicomiche", author: "Calvino, Italo" },
		actor,
		rules,
	);
	citta = createBiblio(
		db,
		{ ...record, title: "La città e le stelle", author: "Clarke, Arthur C." },
		actor,
		rules,
	);
	for (const title of [
		"Zefiro Barbagianni e la pietra lunare",
		"Zefiro Barbagianni e la camera nascosta",
		"Zefiro Barbagianni e il prigioniero del faro",
	]) {
		zefiro.push(
			createBiblio(db, { ...record, title, author: "Ruggeri, Ottavia" }, actor, rules),
		);
	}
}, 120_000);

/** The exact results, then the approximate ones (9.24). */
const found = (q: string): { exact: number[]; similar: number[] } => {
	const rows = searchBiblios(db, { q }, rules).rows;
	return {
		exact: rows.filter((r) => !r.similar).map((r) => r.id),
		similar: rows.filter((r) => r.similar).map((r) => r.id),
	};
};

const timed = <T>(fn: () => T): { value: T; ms: number } => {
	const start = performance.now();
	const value = fn();
	return { value, ms: performance.now() - start };
};

describe("catalogue search on 10 000 records", () => {
	it("finds Calvino's Cosmicomiche in under 50 ms", () => {
		// warm the statement cache once, as a running server would be
		searchBiblios(db, { q: "calvino" }, rules);
		// the best of three runs: a machine busy with other work (the build of `bun run ci`) must
		// not decide the measure, the search itself does
		const runs = [1, 2, 3].map(() =>
			timed(() => searchBiblios(db, { q: "calvino cosmicomiche" }, rules)),
		);
		const value = runs[0]?.value;
		expect(value?.rows.filter((r) => !r.similar).map((r) => r.id)).toEqual([calvino]);
		expect(Math.min(...runs.map((r) => r.ms))).toBeLessThan(50);
		expect(searchBiblios(db, { q: "cosmic calv" }, rules).rows[0]?.id).toBe(calvino);
	});

	it("treats Città and citta alike", () => {
		const accented = found("Città stelle").exact;
		expect(accented).toEqual([citta]);
		expect(found("citta stelle").exact).toEqual(accented);
	});

	it("forgives typing mistakes in titles, original titles and authors (9.24)", () => {
		const prince = db.$client
			.query<{ id: number }, []>("SELECT id FROM biblio WHERE title = 'Il piccolo principe'")
			.get()?.id;
		const piccolo = found("piccolo principie");
		expect(piccolo.exact).toEqual([]);
		expect(piccolo.similar[0]).toBe(prince);
		expect(found("petit prinse").similar[0]).toBe(prince);
		expect(found("calvno cosmicomice").similar[0]).toBe(calvino);
		// every word before some: the three words first, then the books with two of them
		const zef = found("zefrio barbagiani pietra");
		expect(zef.exact).toEqual([]);
		// all three words, then two of them by title ("e il prigioniero" before "e la camera")
		expect(zef.similar.slice(0, 3)).toEqual([zefiro[0], zefiro[2], zefiro[1]]);
		// the author's surname is forgiven too
		expect(found("rugeri barbagiani").similar.slice(0, 3).sort()).toEqual([...zefiro].sort());
		// mistakes are never forgiven in words under four letters
		expect(found("zef").similar).toEqual([]);
	});

	it("adds approximate results only when fewer than 3 books are found", () => {
		// three exact results: nothing approximate
		const three = found("zefiro barbagianni");
		expect(three.exact.sort()).toEqual([...zefiro].sort());
		expect(three.similar).toEqual([]);
		// one exact result: the closest titles follow
		const one = found("barbagianni camera");
		expect(one.exact).toEqual([zefiro[1]]);
		expect(one.similar.slice(0, 2)).toEqual([zefiro[2], zefiro[0]]);
		// filters apply to the approximate results too
		expect(
			searchBiblios(db, { q: "zefrio barbagiani", kind: "nonfiction" }, rules).rows,
		).toHaveLength(0);
	});

	it("finds the approximate results in under 50 ms", () => {
		found("zefrio barbagiani");
		const { value, ms } = timed(() => searchBiblios(db, { q: "picolo principie" }, rules));
		expect(value.rows.some((r) => r.similar)).toBe(true);
		expect(ms).toBeLessThan(50);
	});

	it("a broad prefix stays fast with the grid's page of results", () => {
		const { value, ms } = timed(() => searchBiblios(db, { q: "the" }, rules));
		expect(value.total).toBeGreaterThan(0);
		expect(ms).toBeLessThan(200);
	});
});

describe("approximate results in the installation's language", () => {
	it("orders titles equally close as the language does (Ö after Z in Swedish)", () => {
		const small = createTestDb();
		const actor = small
			.insert(staffUser)
			.values({ username: "admin", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const odla = createBiblio(
			small,
			{ ...record, title: "Ödla gattopardo", author: "Rossi, Anna" },
			actor,
			rules,
		);
		const zebra = createBiblio(
			small,
			{ ...record, title: "Zebra gattopardo", author: "Rossi, Anna" },
			actor,
			rules,
		);
		const similar = (locale: string): number[] =>
			searchBiblios(small, { q: "gatopardo" }, { ...rules, locale })
				.rows.filter((r) => r.similar)
				.map((r) => r.id);
		expect(similar("sv")).toEqual([zebra, odla]);
		expect(similar("it")).toEqual([odla, zebra]);
	});
});
