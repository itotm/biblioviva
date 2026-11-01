// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	controlField,
	fieldsOf,
	parseIso2709,
	splitIso2709,
	subfield,
	type DataField,
} from "./iso2709.js";
import { mapUnimarc, type BiblioDraft, type MapOptions } from "./unimarc-map.js";

const fixture = (name: string): Uint8Array<ArrayBuffer> =>
	new Uint8Array(readFileSync(`tests/fixtures/marc/${name}`));
const options: MapOptions = { specialAuthors: ["Anonimo", "AA. VV."], unknownPublisher: "s.n." };

describe("iso2709", () => {
	it("splits and parses the records recorded from SBN", () => {
		const bytes = fixture("1984-isbn13.mrc");
		expect(splitIso2709(bytes).length).toBeGreaterThanOrEqual(3);
		const records = parseIso2709(bytes);
		expect(records.length).toBe(splitIso2709(bytes).length);
		const first = records[0]!;
		expect(controlField(first, "001")).toMatch(/^IT\\ICCU\\/);
		const title = fieldsOf(first, "200")[0]!;
		expect(subfield(title, "a")).toBe("1984");
		expect(title.ind1).toBe("1");
		expect(parseIso2709(new Uint8Array([1, 2, 3]))).toEqual([]);
		// a garbage chunk between terminators is skipped, the rest survives
		const broken = new Uint8Array([
			...new TextEncoder().encode("x".repeat(30)),
			0x1d,
			...bytes,
		]);
		expect(parseIso2709(broken).length).toBeGreaterThanOrEqual(3);
	});
});

describe("unimarc mapping (Appendix D)", () => {
	it("maps a novel with ISBN-13, translator statement, Dewey and subjects", () => {
		const drafts = parseIso2709(fixture("1984-isbn13.mrc")).map((r) => mapUnimarc(r, options));
		const d = drafts[0]!;
		expect(d).toMatchObject({
			title: "1984",
			author: "Orwell, George",
			isbn: "9788804668237",
			publicationYear: 2019,
			source: "sbn",
		});
		expect(d.sourceId).toMatch(/^IT\\ICCU\\RMB\\/);
		expect(d.responsibility).toContain("George Orwell");
		expect(d.responsibility).toContain("traduzione di Stefano Manferlotti");
		expect(d.publisher).toBeTruthy();
		expect(d.physicalDescription).toMatch(/p\./);
		expect(d.dewey === null || /^\d{1,3}(\.\d+)?$/.test(d.dewey)).toBe(true);
		expect(Array.isArray(d.subjects)).toBe(true);
	});

	it("falls back to the special author when no 700/701/710 exists and keeps multi-volume descriptions", () => {
		const drafts = parseIso2709(fixture("mille-e-una-notte-no700.mrc")).map((r) =>
			mapUnimarc(r, options),
		);
		expect(drafts.length).toBeGreaterThanOrEqual(3);
		const withoutPerson = drafts.filter((d) => d.author === "Anonimo");
		expect(withoutPerson.length).toBeGreaterThan(0);
		expect(drafts.some((d) => d.physicalDescription?.startsWith("v."))).toBe(true);
		expect(drafts.every((d) => d.title.toLowerCase().includes("mille e una notte"))).toBe(true);
	});

	it("keeps the surname, forename shape of SBN names and the open date of a series", () => {
		const drafts = parseIso2709(fixture("harry-potter-multivolume.mrc")).map((r) =>
			mapUnimarc(r, options),
		);
		expect(drafts[0]).toMatchObject({ author: "Rowling, J. K.", publicationYear: 2015 });
		expect(drafts[0]?.physicalDescription).toBe("volumi : ill. ; 28 cm");
		expect(drafts[0]?.dewey).toBe("823.914");
		expect(drafts[0]?.publicationPlace).toBe("New York");
	});

	it("joins repeated publishers, strips brackets, prefers 214 over 210, counts many authors", () => {
		const stilton = parseIso2709(fixture("geronimo-stilton-2024.mrc")).map((r) =>
			mapUnimarc(r, options),
		);
		expect(stilton[0]?.publisher).toBe("Atlantyca ; 21st Century Publishing Group");
		expect(stilton[0]?.publicationPlace).toBe("Milano");
		expect(stilton[0]?.publicationYear).toBe(2024);

		const record = parseIso2709(fixture("1984-isbn13.mrc"))[0]!;
		const modern = {
			...record,
			fields: [
				...record.fields.filter((f) => f.tag !== "210"),
				{
					tag: "214",
					ind1: " ",
					ind2: " ",
					subfields: [
						{ code: "a", value: "Roma" },
						{ code: "c", value: "Nuova Casa" },
						{ code: "d", value: "©2023" },
					],
				},
				{ tag: "701", ind1: " ", ind2: "1", subfields: [{ code: "a", value: "Bianchi" }] },
				{ tag: "701", ind1: " ", ind2: "1", subfields: [{ code: "a", value: "Verdi" }] },
			],
		};
		const d = mapUnimarc(modern, options);
		expect(d).toMatchObject({
			publisher: "Nuova Casa",
			publicationPlace: "Roma",
			publicationYear: 2023,
			author: "AA. VV.",
		});

		// ISO 6630 sorting markers and other control characters inside SBN titles are dropped
		const marked = {
			...record,
			fields: record.fields.map((f) =>
				f.tag === "200"
					? {
							...f,
							subfields: [
								{ code: "a", value: "L'\u0088eco\u0089vandalo\u001f" },
								{ code: "f", value: "Anna \u0007Rossi" },
							],
						}
					: f,
			),
		};
		expect(mapUnimarc(marked, options)).toMatchObject({
			title: "L'ecovandalo",
			responsibility: "Anna Rossi",
		});

		const corporate = {
			leader: record.leader,
			fields: [
				{ tag: "200", ind1: "1", ind2: " ", subfields: [{ code: "a", value: "Atti" }] },
				{
					tag: "710",
					ind1: "0",
					ind2: "2",
					subfields: [{ code: "a", value: "Comune di Bologna" }],
				},
			],
		};
		expect(mapUnimarc(corporate, options)).toMatchObject({
			author: "Comune di Bologna",
			publisher: "s.n.",
			isbn: null,
			publicationYear: null,
			physicalDescription: null,
		});
	});

	it("takes the series from the 461 set and never from the 225/410 collana (Q84)", () => {
		const record = parseIso2709(fixture("1984-isbn13.mrc"))[0]!;
		const field = (tag: string, subfields: [string, string][]): DataField => ({
			tag,
			ind1: " ",
			ind2: "1",
			subfields: subfields.map(([code, value]) => ({ code, value })),
		});
		const base = record.fields.filter((f) => !["225", "410", "461"].includes(f.tag));
		const collana = {
			...record,
			fields: [
				...base,
				field("225", [
					["a", "Il battello a vapore. Serie azzurra"],
					["v", "45"],
				]),
				field("410", [
					["1", "001IT\\ICCU\\RAV\\1397608"],
					["a", "Il battello a vapore"],
					["v", "45"],
				]),
			],
		};
		expect(mapUnimarc(collana, options)).toMatchObject({ series: null, seriesNumber: null });
		const set = {
			...record,
			fields: [
				...base,
				field("461", [
					["1", "001IT\\ICCU\\UBO\\2595198"],
					["a", "Il Signore degli anelli"],
					["v", "2"],
				]),
			],
		};
		expect(mapUnimarc(set, options)).toMatchObject({
			series: "Il Signore degli anelli",
			seriesNumber: "2",
		});
		expect(mapUnimarc({ ...record, fields: base }, options).series).toBeNull();
	});

	it("takes the original title from 500 only for a translation (Q123)", () => {
		const map = (name: string): BiblioDraft[] =>
			parseIso2709(fixture(name)).map((r) => mapUnimarc(r, options));
		// Italian text, English original
		expect(map("1984-isbn13.mrc").map((d) => d.originalTitle)).toEqual([
			"Nineteen eighty-four",
			"Nineteen eighty-four",
			"Nineteen eighty-four",
		]);
		// Italian text, Arabic original (SBN's uniform title of the work); the other two records
		// give no original language
		expect(map("mille-e-una-notte-no700.mrc").map((d) => d.originalTitle)).toEqual([
			null,
			"Le mille e una notte",
			null,
		]);
		// the English editions carry a 500 too, but they are no translation; the Polish one is
		const potter = parseIso2709(fixture("harry-potter-multivolume.mrc"));
		const byLanguage = potter.map((r) => ({
			language: subfield(fieldsOf(r, "101")[0]!, "a"),
			original: mapUnimarc(r, options).originalTitle,
		}));
		expect(byLanguage.filter((b) => b.language === "eng").map((b) => b.original)).toEqual(
			byLanguage.filter((b) => b.language === "eng").map(() => null),
		);
		expect(byLanguage.find((b) => b.language === "pol")?.original).toBe(
			"Harry Potter and the philosopherʼs stone",
		);
		// no 500 at all
		expect(map("geronimo-stilton-2024.mrc").every((d) => d.originalTitle === null)).toBe(true);
	});
});
