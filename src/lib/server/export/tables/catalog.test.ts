// SPDX-License-Identifier: GPL-3.0-or-later
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { staffUser } from "#lib/server/db/schema.js";
import { catalogRules, createBiblio } from "#lib/server/services/catalog.js";
import { addItems } from "#lib/server/services/catalog-items.js";
import { toCsv } from "../csv.js";
import { getExport } from "../registry.js";
import { catalogExportSchema, registerCatalogExport } from "./catalog.js";

describe("catalog export", () => {
	it("exports the filtered grid with classification, kind and copy counts", async () => {
		const db = createTestDb();
		const actor = db
			.insert(staffUser)
			.values({ username: "u", passwordHash: "x", roles: [] })
			.returning({ id: staffUser.id })
			.get();
		const rules = catalogRules(parseConfig(exampleRaw()).config);
		const base = {
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			publisher: "Mondadori",
			publicationPlace: "",
			isbn: "",
			issn: "",
			ean: "",
			physicalDescription: "",
			series: "",
			seriesNumber: "",
			dewey: "",
			classCode: "",
			subjects: "",
			notes: "",
		};
		const novel = createBiblio(
			db,
			{
				...base,
				title: "1984",
				author: "Orwell, George",
				publicationYear: "2016",
				kind: "fiction",
				genreCode: "A",
				readingLevel: "3",
			},
			actor,
			rules,
		);
		addItems(
			db,
			novel,
			{
				callNumber: "",
				readingLevel: "",
				enumeration: "",
				acquisitionDate: "",
				notes: "",
				notForLoan: false,
			},
			2,
			actor,
			rules,
		);
		createBiblio(
			db,
			{
				...base,
				title: "Animali",
				author: "Anonimo",
				publicationYear: "",
				kind: "nonfiction",
				genreCode: "",
				classCode: "590",
				readingLevel: "",
			},
			actor,
			rules,
		);
		registerCatalogExport(() => ({
			title: "Titolo",
			kind_fiction: "Narrativa",
			copiesTotal: "Copie",
		}));
		const definition = getExport("catalog")!;
		expect(definition.permission).toBeUndefined();
		const all = await definition.build(
			db,
			v.parse(catalogExportSchema, {}),
			{ id: actor.id } as never,
			"Europe/Rome",
		);
		const rows = [...all.rows];
		expect(rows).toHaveLength(2);
		const csv = toCsv(
			await definition.build(
				db,
				v.parse(catalogExportSchema, { kind: "fiction" }),
				{ id: actor.id } as never,
				"Europe/Rome",
			),
		);
		expect(csv).toContain("Titolo");
		expect(csv).toContain("1984");
		expect(csv).toContain("Narrativa");
		expect(csv).toContain("A Romanzi");
		expect(csv).not.toContain("Animali");
		const row = rows.find((r) => r.title === "1984");
		expect(row).toMatchObject({
			readingLevel: "3",
			copiesTotal: 2,
			copiesAvailable: 2,
			callNumber: "A 3 ORW",
		});
		expect(String(row?.acquiredAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		const nonfiction = rows.find((r) => r.title === "Animali");
		// no copies yet: the acquisition date falls back to the day the record was created
		expect(String(nonfiction?.acquiredAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(nonfiction?.callNumber).toBe("");
		expect(String(nonfiction?.classification)).toMatch(/^590 /);
	});
});
