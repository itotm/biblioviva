// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import { biblio, patron, staffUser } from "#lib/server/db/schema.js";
import { catalogRules, createBiblio } from "./catalog.js";
import { addItems } from "./catalog-items.js";
import { ConfigInUseError, referenceProblems } from "./config-references.js";
import { classId, inClass } from "../../../../tests/helpers/school.js";

const config = parseConfig(exampleRaw()).config;

function fixture(): ReturnType<typeof createTestDb> {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	const rules = catalogRules(config);
	const id = createBiblio(
		db,
		{
			title: "Il gatto",
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "Perrault, Charles",
			publisher: "Einaudi",
			publicationPlace: "",
			publicationYear: "",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
			itemType: "dvd",
			kind: "fiction",
			genreCode: "B",
			classCode: "",
			readingLevel: "",
			subjects: "",
			notes: "",
		},
		actor,
		rules,
	);
	addItems(
		db,
		id,
		{
			callNumber: "",
			readingLevel: "",
			enumeration: "",
			acquisitionDate: "2020-01-01",
			notes: "",
			notForLoan: false,
		},
		2,
		actor,
		rules,
	);
	for (const [level, name] of [
		["5", "A"],
		["4", "C"],
	] as const) {
		db.insert(patron)
			.values({
				patronType: "student",
				firstName: "Anna",
				lastName: "Rossi",
				searchName: "rossi anna",
				...inClass(db, level, name),
			})
			.run();
	}
	db.update(biblio).set({ readingLevel: "3" }).run();
	// an active class hosting a level with no pupils yet
	classId(db, "2", "B");
	return db;
}

const change = (mutate: (c: AppConfig) => void): AppConfig => {
	const copy = structuredClone(config);
	mutate(copy);
	return copy;
};

describe("reference guard", () => {
	it("reports genres, item types, levels and reading levels a change takes away while in use", () => {
		const db = fixture();
		expect(referenceProblems(db, config, config)).toEqual([]);
		const after = change((c) => {
			c.classification.genres = c.classification.genres.filter((g) => g.code !== "B");
			c.library.itemTypes = c.library.itemTypes.filter((t) => t.code !== "dvd");
			c.school.levels = c.school.levels.filter((l) => !["2", "5"].includes(l.code));
			c.classification.readingLevels = c.classification.readingLevels.filter(
				(l) => l.code !== "3",
			);
		});
		expect(referenceProblems(db, config, after)).toEqual([
			{ kind: "classification", code: "B", count: 1 },
			{ kind: "itemType", code: "dvd", count: 1 },
			{ kind: "level", code: "5", count: 1 },
			{ kind: "level", code: "2", count: 0 },
			{ kind: "readingLevel", code: "3", count: 1 },
		]);
		expect(new ConfigInUseError(referenceProblems(db, config, after)).message).toContain(
			"itemType dvd (1)",
		);
	});

	it("does not block a change for a problem that was already there", () => {
		const db = fixture();
		db.update(biblio).set({ genreCode: "Q" }).run();
		const unrelated = change((c) => {
			c.privacy.auditRetentionMonths = 12;
		});
		expect(referenceProblems(db, config, unrelated)).toEqual([]);
	});
});
