// SPDX-License-Identifier: GPL-3.0-or-later
// MARC files (PLAN.md step 9.65): the writer and the reader of ISO 2709 and MARCXML, the
// recognition of the syntax and of the flavour, and a file of another system read into the rows
// of the catalogue import (a synthetic Koha export, a record recorded from OPAC SBN).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG_IMPORT } from "#lib/shared/import-columns.js";
import { marcToCatalogRows } from "./catalog-marc.js";
import { parseIso2709, type MarcRecord } from "./iso2709.js";
import { marcFlavour, parseMarcxml, readMarcFile } from "./read.js";
import { toIso2709, toMarcxml } from "./write.js";

const fixture = (name: string): Uint8Array =>
	new Uint8Array(readFileSync(`tests/fixtures/marc/${name}`));
const options = { specialAuthors: ["Anonimo", "AA. VV."], unknownPublisher: "s.n." };

const sample: MarcRecord = {
	leader: "00000nam a2200000 i 4500",
	fields: [
		{ tag: "001", value: "42" },
		{
			tag: "245",
			ind1: "1",
			ind2: "0",
			subfields: [
				{ code: "a", value: 'Città & <dintorni> "d\'Italia"' },
				{ code: "b", value: "un viaggio 🚂 in treno" },
			],
		},
		{ tag: "650", ind1: " ", ind2: "4", subfields: [{ code: "a", value: "Viaggi" }] },
	],
};

/** The rows as objects keyed by the import's header names. */
function objects(rows: string[][]): Record<string, string>[] {
	const [header = [], ...data] = rows;
	return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

describe("writer and reader", () => {
	it("write ISO 2709 that the parser reads back, lengths counted in bytes", () => {
		const bytes = toIso2709([sample, { ...sample, fields: sample.fields.slice(0, 1) }]);
		const back = parseIso2709(bytes);
		expect(back).toHaveLength(2);
		expect(back[0]?.fields).toEqual(sample.fields);
		// the leader holds the record's length in bytes and the base address
		const text = new TextDecoder().decode(bytes);
		const first = text.slice(0, text.indexOf("\x1d") + 1);
		expect(Number(first.slice(0, 5))).toBe(new TextEncoder().encode(first).length);
		expect(first.slice(20, 24)).toBe("4500");
	});

	it("write MARCXML that the reader reads back, with or without a prefix", () => {
		const xml = toMarcxml([sample]);
		expect(xml).toContain('xmlns="http://www.loc.gov/MARC21/slim"');
		expect(xml).toContain("Città &amp; &lt;dintorni&gt;");
		expect(parseMarcxml(xml)).toEqual([sample]);
		const prefixed = xml
			.replaceAll("<record", "<marc:record")
			.replaceAll("</record", "</marc:record")
			.replaceAll("<leader", "<marc:leader")
			.replaceAll("</leader", "</marc:leader");
		expect(parseMarcxml(prefixed)[0]?.leader).toBe(sample.leader);
	});

	it("recognise the syntax from the bytes and the flavour from the fields", () => {
		expect(readMarcFile(toIso2709([sample]))?.syntax).toBe("iso2709");
		expect(readMarcFile(new TextEncoder().encode(toMarcxml([sample])))?.syntax).toBe("marcxml");
		expect(readMarcFile(new TextEncoder().encode("title;author\nUno;Due\n"))).toBeNull();
		expect(marcFlavour([sample])).toBe("marc21");
		expect(marcFlavour(parseIso2709(fixture("1984-isbn13.mrc")))).toBe("unimarc");
	});
});

describe("another system's file as the rows of the catalogue import", () => {
	it("reads a Koha export in MARC 21: the copies from 952, the classification from ccode", () => {
		const file = readMarcFile(fixture("koha-marc21.xml"));
		expect(file?.syntax).toBe("marcxml");
		const records = file?.records ?? [];
		expect(marcFlavour(records)).toBe("marc21");
		const { rows, lines } = marcToCatalogRows(records, "marc21", options);
		// the header has the import's English names, so the columns map by themselves
		const headers = CATALOG_IMPORT.columns.map((c) => c.header);
		expect(rows[0]?.every((h) => headers.includes(h))).toBe(true);
		expect(lines).toEqual([0, 1, 2, 3]);
		const [a, b, c] = objects(rows);
		expect(a).toMatchObject({
			biblio_key: "101",
			title: "Il faro sull'isola",
			subtitle: "racconto d'estate",
			responsibility: "Marta Pellegrini ; illustrazioni di Ugo Neri",
			author: "Pellegrini, Marta",
			publisher: "Edizioni del Gabbiano",
			publication_place: "Milano",
			publication_year: "2019",
			isbn: "9788804719052",
			physical_description: "143 p",
			series: "I gabbiani",
			series_number: "4",
			subjects: "Mare - Narrativa per ragazzi",
			classification: "A",
			item_type: "libro",
			barcode: "2020-0101",
			call_number: "A PEL",
			acquisition_date: "2020-03-02",
			inventory_number: "4512",
			origin: "Dono",
			value: "12.50",
			status: "",
		});
		expect(b).toMatchObject({
			barcode: "2020-0102",
			status: "lost",
			item_notes: "Copertina strappata",
		});
		expect(c).toMatchObject({
			biblio_key: "102",
			title: "Atlante dei fiumi & dei laghi",
			author: "Società geografica scolastica",
			publisher: "Carte <Nuove>",
			publication_year: "2015",
			dewey: "551.48",
			classification: "900",
			not_for_loan: "1",
		});
	});

	it("reads a UNIMARC record of OPAC SBN without copies as one row", () => {
		const records = parseIso2709(fixture("1984-isbn13.mrc")).slice(0, 1);
		const { rows } = marcToCatalogRows(records, "unimarc", options);
		const [one, ...more] = objects(rows);
		expect(more).toEqual([]);
		expect(one?.title).toBe("1984");
		expect(one?.author).toMatch(/^Orwell, George/);
		expect(one?.barcode).toBe("");
		expect(one?.biblio_key).toMatch(/^IT\\ICCU\\/);
	});
});
