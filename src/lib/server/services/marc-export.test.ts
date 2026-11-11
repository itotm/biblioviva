// SPDX-License-Identifier: GPL-3.0-or-later
// The MARC export and import (PLAN.md step 9.65): a catalogue written in each of the four formats
// and imported into an empty one comes back with every field the catalogue has; a list of copies
// gives its titles with those copies only.
import { describe, expect, it } from "vitest";
import { createTestDb } from "../../../../tests/helpers/db.js";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { Db } from "#lib/server/db/client.js";
import { staffUser } from "#lib/server/db/schema.js";
import {
	commitCatalogImport,
	detectCatalogFormat,
	validateCatalogImport,
} from "../imports/catalog.js";
import { mapRows } from "../imports/pipeline.js";
import { marcToCatalogRows } from "#lib/server/marc/catalog-marc.js";
import { marcFlavour, readMarcFile } from "#lib/server/marc/read.js";
import { CATALOG_FIELDS } from "#lib/shared/import-columns.js";
import type { BiblioFormInput, ItemFormInput } from "#lib/shared/catalog-schema.js";
import { catalogRules, createBiblio, type CatalogRules } from "./catalog.js";
import { addItems, setItemStatus } from "./catalog-items.js";
import { getBiblio } from "./catalog-search.js";
import { MARC_FORMATS, marcFile, marcTitles } from "./marc-export.js";

const config = parseConfig(exampleRaw()).config;
const base = catalogRules(config);
const rules: CatalogRules = { ...base, inventory: { ...base.inventory, enabled: true } };
const options = { unknownAuthor: "Anonimo", locale: "it", timezone: "Europe/Rome" };

function setup(): { db: Db; actor: { id: number } } {
	const db = createTestDb();
	const actor = db
		.insert(staffUser)
		.values({ username: "u", passwordHash: "x", roles: [] })
		.returning({ id: staffUser.id })
		.get();
	return { db, actor };
}

const record = (over: Partial<BiblioFormInput>): BiblioFormInput => ({
	title: "",
	subtitle: "",
	originalTitle: "",
	responsibility: "",
	author: "",
	publisher: "",
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
	...over,
});
const copy = (over: Partial<ItemFormInput>): ItemFormInput => ({
	readingLevel: "",
	enumeration: "",
	acquisitionDate: "",
	notes: "",
	notForLoan: false,
	...over,
});

/** A small catalogue with every field the catalogue has, and the ids of its copies. */
function catalogue(db: Db, actor: { id: number }): number[] {
	const full = createBiblio(
		db,
		record({
			title: "Il barone rampante",
			subtitle: "romanzo & altro <racconto>",
			originalTitle: "The baron in the trees",
			responsibility: "Italo Calvino ; postfazione di Anna Neri",
			author: "Calvino, Italo",
			publisher: "Einaudi",
			publicationPlace: "Torino",
			publicationYear: "1957",
			isbn: "9788804668237",
			issn: "1234-5679",
			ean: "4006381333931",
			physicalDescription: "282 p. : ill. ; 21 cm.",
			series: "I nostri antenati",
			seriesNumber: "2",
			dewey: "853.914",
			readingLevel: "3",
			subjects: "Alberi\nLiguria - Storia",
			accessibleFormats: "Alta leggibilità|Audiolibro",
			notes: "Prima riga della nota\nSeconda riga",
		}),
		actor,
		rules,
	);
	const a = addItems(
		db,
		full,
		copy({
			enumeration: "vol. 1",
			acquisitionDate: "2024-10-01",
			notes: "Dorso rinforzato\nDono della 3 B",
			inventoryNumber: "000120",
			origin: "Dono",
			value: "12,50",
		}),
		2,
		actor,
		rules,
	);
	setItemStatus(db, a.ids[1] ?? 0, "withdrawn", "usurato", actor);
	const many = createBiblio(
		db,
		record({
			title: "Atlante dei fiumi",
			author: "AA. VV.",
			publisher: "s.n.",
			publicationPlace: "s.l.",
			kind: "nonfiction",
			genreCode: "",
			classCode: "900",
		}),
		actor,
		rules,
	);
	const b = addItems(db, many, copy({ notForLoan: true }), 1, actor, rules);
	const anonymous = createBiblio(
		db,
		record({ title: "Fiabe popolari", author: "Anonimo", publisher: "Sellerio" }),
		actor,
		rules,
	);
	const c = addItems(db, anonymous, copy({}), 1, actor, rules);
	return [...a.ids, ...b.ids, ...c.ids];
}

/** A record and its copies as the comparison reads them (ids and times left out). */
function shown(db: Db, id: number): unknown {
	const {
		id: _id,
		createdAt: _c,
		updatedAt: _u,
		source: _s,
		sourceId: _si,
		hasCover: _h,
		items,
		...rest
	} = getBiblio(db, id, rules);
	return {
		...rest,
		items: items.map((i) => ({
			barcode: i.barcode,
			callNumber: i.callNumber,
			readingLevel: i.readingLevel,
			enumeration: i.enumeration,
			status: i.status,
			notForLoan: i.notForLoan,
			acquisitionDate: i.acquisitionDate,
			notes: i.notes,
			inventoryNumber: i.inventoryNumber,
			origin: i.origin,
			valueCents: i.valueCents,
		})),
	};
}

function importInto(db: Db, actor: { id: number }, bytes: Uint8Array): void {
	const file = readMarcFile(bytes);
	if (!file) {
		throw new Error("not a MARC file");
	}
	const { rows, lines } = marcToCatalogRows(file.records, marcFlavour(file.records), {
		specialAuthors: config.catalog.specialAuthors,
		unknownPublisher: config.catalog.unknownPublisher,
	});
	const detection = detectCatalogFormat(rows);
	expect(detection.certain).toBe(true);
	const inputs = mapRows(rows, detection.mapping, detection.header, CATALOG_FIELDS, lines);
	const importOptions = { rules, useSpecialValues: false, today: "2026-11-11" };
	const result = validateCatalogImport(db, inputs, importOptions);
	expect(result.rows.flatMap((r) => r.reasons.map((x) => x.code))).toEqual([]);
	commitCatalogImport(db, inputs, {
		...importOptions,
		actor,
		filename: "catalogo.mrc",
		storeFile: () => "imports/1/catalogo.mrc",
	});
}

describe("MARC round trip", () => {
	for (const format of MARC_FORMATS) {
		it(`keeps every field of the catalogue in ${format}`, () => {
			const from = setup();
			catalogue(from.db, from.actor);
			const ids = getBiblioIds(from.db);
			const file = marcFile(from.db, { biblioIds: ids }, format, options);
			const to = setup();
			importInto(to.db, to.actor, file.body);
			const back = getBiblioIds(to.db);
			expect(back).toHaveLength(ids.length);
			const byTitle = (db: Db, list: number[]): Map<string, unknown> =>
				new Map(list.map((id) => [getBiblio(db, id, rules).title, shown(db, id)]));
			expect(Object.fromEntries(byTitle(to.db, back))).toEqual(
				Object.fromEntries(byTitle(from.db, ids)),
			);
			// the comparison is not between two empty records
			expect(byTitle(to.db, back).get("Il barone rampante")).toMatchObject({
				originalTitle: "The baron in the trees",
				subjects: ["Alberi", "Liguria - Storia"],
				accessibleFormats: ["Alta leggibilità", "Audiolibro"],
				notes: "Prima riga della nota\nSeconda riga",
				readingLevel: "3",
				items: [
					{ inventoryNumber: "000120", valueCents: 1250, status: "available" },
					{ inventoryNumber: "000121", status: "withdrawn" },
				],
			});
			expect(byTitle(to.db, back).get("Atlante dei fiumi")).toMatchObject({
				author: "AA. VV.",
				classCode: "900",
				items: [{ notForLoan: true }],
			});
		});
	}

	it("gives a list of copies its titles with those copies only", () => {
		const { db, actor } = setup();
		const itemIds = catalogue(db, actor);
		const titles = marcTitles(db, { itemIds: [itemIds[0] ?? 0, itemIds[3] ?? 0] }, "UTC");
		expect(titles.map((t) => [t.title, t.copies.length])).toEqual([
			["Il barone rampante", 1],
			["Fiabe popolari", 1],
		]);
		expect(marcFile(db, { itemIds: [] }, "marc21-xml", options).extension).toBe("xml");
	});
});

function getBiblioIds(db: Db): number[] {
	return db.$client
		.query<{ id: number }, []>("SELECT id FROM biblio ORDER BY id")
		.all()
		.map((r) => r.id);
}
