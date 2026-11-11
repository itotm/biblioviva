// SPDX-License-Identifier: GPL-3.0-or-later
// Accessible books (PLAN.md step 9.66, Q157): the configured list, the formats of a record, the
// catalogue filter, the import column and the export.
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { configSchema as ConfigSchema } from "#lib/server/config/schema.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import {
	commitCatalogImport,
	detectCatalogFormat,
	validateCatalogImport,
} from "../imports/catalog.js";
import { readCsv, writeCsv } from "../imports/csv.js";
import { mapRows } from "../imports/pipeline.js";
import { CATALOG_FIELDS } from "#lib/shared/import-columns.js";
import {
	DEFAULT_ACCESSIBLE_FORMATS,
	joinFormats,
	matchFormats,
	splitFormats,
} from "#lib/shared/accessible-formats.js";
import type { BiblioFormInput } from "#lib/shared/catalog-schema.js";
import {
	catalogRules,
	CatalogValidationError,
	createBiblio,
	updateBiblio,
	type CatalogRules,
} from "./catalog.js";
import { getBiblio, searchBiblios } from "./catalog-search.js";
import { catalogCsv } from "./data-exports.js";

const config = parseConfig(exampleRaw()).config;
const rules = catalogRules(config);

const book = (title: string, accessibleFormats?: string): BiblioFormInput => ({
	title,
	subtitle: "",
	originalTitle: "",
	responsibility: "",
	author: "Rodari, Gianni",
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
	kind: "fiction",
	genreCode: "G",
	classCode: "",
	readingLevel: "",
	subjects: "",
	notes: "",
	...(accessibleFormats === undefined ? {} : { accessibleFormats }),
});

function setup(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

const issues = (fn: () => unknown): string[] => {
	try {
		fn();
		return [];
	} catch (e) {
		if (e instanceof CatalogValidationError) {
			return e.issues.map((i) => `${i.field}:${i.code}`);
		}
		throw e;
	}
};

describe("the configured list", () => {
	it("has the five formats by default and can be emptied or changed", () => {
		expect(rules.accessibleFormats).toEqual([...DEFAULT_ACCESSIBLE_FORMATS]);
		const raw = exampleRaw() as { catalog: Record<string, unknown> };
		const own = v.parse(ConfigSchema, {
			...raw,
			catalog: { ...raw.catalog, accessibleFormats: [" Audiolibro ", "Braille"] },
		});
		expect(own.catalog.accessibleFormats).toEqual(["Audiolibro", "Braille"]);
		expect(
			v.safeParse(ConfigSchema, {
				...raw,
				catalog: { ...raw.catalog, accessibleFormats: [""] },
			}).success,
		).toBe(false);
	});

	it("matches what is typed in any case and accents, in the list's order", () => {
		expect(splitFormats("audiolibro; ALTA LEGGIBILITA\n|Tattile")).toEqual([
			"audiolibro",
			"ALTA LEGGIBILITA",
			"Tattile",
		]);
		expect(
			matchFormats(
				["tattile", "alta leggibilita", "Tattile", "Braille"],
				rules.accessibleFormats,
			),
		).toEqual({ formats: ["Alta leggibilità", "Tattile"], unknown: ["Braille"] });
		expect(joinFormats(["Audiolibro", "Tattile"])).toBe("Audiolibro|Tattile");
	});
});

describe("a record", () => {
	it("keeps the formats of the list and refuses the others", () => {
		const { db, actor } = setup();
		const id = createBiblio(
			db,
			book("Favole al telefono", "Audiolibro|alta leggibilità"),
			actor,
			rules,
		);
		expect(getBiblio(db, id, rules).accessibleFormats).toEqual([
			"Alta leggibilità",
			"Audiolibro",
		]);
		expect(issues(() => createBiblio(db, book("Altro", "Braille"), actor, rules))).toEqual([
			"accessibleFormats:accessibleFormatUnknown",
		]);
		// a form without the field keeps them, an empty one clears them
		updateBiblio(db, id, book("Favole al telefono"), actor, rules);
		expect(getBiblio(db, id, rules).accessibleFormats).toEqual([
			"Alta leggibilità",
			"Audiolibro",
		]);
		expect(updateBiblio(db, id, book("Favole al telefono", ""), actor, rules)).toEqual([
			"accessibleFormats",
		]);
		expect(getBiblio(db, id, rules).accessibleFormats).toEqual([]);
	});

	it("keeps a format taken off the list, which no other record can get", () => {
		const { db, actor } = setup();
		const id = createBiblio(db, book("Il gatto", "Tattile"), actor, rules);
		const fewer: CatalogRules = { ...rules, accessibleFormats: ["Audiolibro"] };
		expect(updateBiblio(db, id, book("Il gatto", "Tattile|Audiolibro"), actor, fewer)).toEqual([
			"accessibleFormats",
		]);
		expect(getBiblio(db, id, fewer).accessibleFormats).toEqual(["Audiolibro", "Tattile"]);
		expect(issues(() => createBiblio(db, book("Nuovo", "Tattile"), actor, fewer))).toEqual([
			"accessibleFormats:accessibleFormatUnknown",
		]);
	});
});

describe("the catalogue filter", () => {
	it("finds the books of one format, or of any", () => {
		const { db, actor } = setup();
		createBiblio(db, book("Uno", "Audiolibro"), actor, rules);
		createBiblio(db, book("Due", "Tattile|Audiolibro"), actor, rules);
		createBiblio(db, book("Tre"), actor, rules);
		const titles = (accessibleFormat: string): string[] =>
			searchBiblios(db, { accessibleFormat, sort: "title" }, rules).rows.map((r) => r.title);
		expect(titles("Audiolibro")).toEqual(["Due", "Uno"]);
		expect(titles("Tattile")).toEqual(["Due"]);
		expect(titles("*")).toEqual(["Due", "Uno"]);
		expect(titles("")).toEqual(["Due", "Tre", "Uno"]);
	});
});

describe("the import column and the export", () => {
	const inputsOf = (csv: string): ReturnType<typeof mapRows<(typeof CATALOG_FIELDS)[number]>> => {
		const parsed = readCsv(new TextEncoder().encode(csv));
		const detection = detectCatalogFormat(parsed.rows);
		return mapRows(
			parsed.rows,
			detection.mapping,
			detection.header,
			CATALOG_FIELDS,
			parsed.lines,
		);
	};
	const options = { rules, useSpecialValues: false, today: "2026-09-25" };

	it("reads accessible_formats, refuses a format not in the list, writes it back", () => {
		const { db, actor } = setup();
		const bad = inputsOf(
			writeCsv([
				["title", "author", "publisher", "classification", "accessible_formats"],
				["Uno", "A", "B", "G", "Audiolibro; Braille"],
			]),
		);
		expect(
			validateCatalogImport(db, bad, options).rows[0]?.reasons.map((r) => [r.code, r.params]),
		).toEqual([["accessibleFormatUnknown", { value: "Braille" }]]);

		const good = inputsOf(
			writeCsv([
				["title", "author", "publisher", "classification", "accessible_formats", "barcode"],
				["Uno", "A", "B", "G", "caratteri grandi; Audiolibro", ""],
			]),
		);
		commitCatalogImport(db, good, {
			...options,
			actor,
			filename: "catalogo.csv",
			storeFile: () => "imports/1/catalogo.csv",
		});
		const [row] = searchBiblios(db, { accessibleFormat: "*" }, rules).rows;
		expect(row?.accessibleFormats).toEqual(["Audiolibro", "Caratteri grandi"]);
		const lines = [...catalogCsv(db.$client)].join("");
		expect(lines).toContain("accessible_formats");
		expect(lines).toContain("Audiolibro; Caratteri grandi");
	});
});
