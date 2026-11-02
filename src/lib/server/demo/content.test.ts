// SPDX-License-Identifier: GPL-3.0-or-later
// What a visitor of the public demo sends, replaced by an example (9.17, Q121): every kind of
// field, the values that stay, nothing changed outside the demo.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "#lib/server/env.js";
import { MOCK_RECORDS } from "#lib/server/metadata/mock.js";
import type { BiblioFormInput, ItemFormInput } from "#lib/shared/catalog-schema.js";
import type { PatronFormInput } from "#lib/shared/patron-schema.js";
import {
	demoBiblio,
	demoBlank,
	demoChoice,
	demoExample,
	demoGroupName,
	demoItem,
	demoPatron,
	demoPicture,
	demoText,
	demoWish,
	prepareDemoTexts,
	trackDemoRequest,
} from "./content.js";
import {
	PLACEHOLDER_HEIGHT,
	PLACEHOLDER_WIDTH,
	placeholderImage,
	placeholderStamp,
} from "./placeholder.js";

const saved = process.env.DEMO_PUBLIC;
const now = new Date("2026-10-18T17:40:00Z");
const special = { author: "AA. VV.", publisher: "s.n." };

const setDemo = (on: boolean): void => {
	if (on) {
		process.env.DEMO_PUBLIC = "1";
	} else {
		delete process.env.DEMO_PUBLIC;
	}
	resetEnvCache();
};

beforeAll(async () => {
	// the templates as the hook reads them, here without the dictionaries: "<kind> {{when}}"
	await prepareDemoTexts("it", "Europe/Rome", (key, params) =>
		Promise.resolve(`${key.split(".").pop() ?? ""} ${String(params.when)}`),
	);
});
beforeEach(() => setDemo(true));
afterEach(() => {
	if (saved === undefined) {
		delete process.env.DEMO_PUBLIC;
	} else {
		process.env.DEMO_PUBLIC = saved;
	}
	resetEnvCache();
});

const patronInput = (over: Partial<PatronFormInput> = {}): PatronFormInput => ({
	patronType: "student",
	firstName: "Parola",
	lastName: "Brutta",
	levelCode: "1",
	groupId: "3",
	groupName: "",
	cardNumber: "C000017",
	externalId: "CODICE",
	email: "qualcuno@example.org",
	circulationNote: "una nota",
	notes: "un'altra nota",
	...over,
});

const mock = MOCK_RECORDS[0];
const biblioInput = (over: Partial<BiblioFormInput> = {}): BiblioFormInput => ({
	title: "Un titolo qualsiasi",
	subtitle: "sottotitolo",
	originalTitle: "Any title at all",
	responsibility: "a cura di qualcuno",
	author: "Chiunque, Tizio",
	publisher: "Editore inventato",
	publicationPlace: "Ovunque",
	publicationYear: "2020",
	isbn: "9788804668237",
	issn: "",
	ean: "",
	physicalDescription: "100 p.",
	series: "Una serie",
	seriesNumber: "3",
	dewey: "823.912",
	kind: "fiction",
	genreCode: "A",
	classCode: "",
	readingLevel: "",
	subjects: "Qualcosa",
	notes: "nota del libro",
	...over,
});

describe("the examples of the public demo", () => {
	it("say what they are and when", () => {
		const text = demoExample("book", now);
		expect(text).toMatch(/^book /);
		expect(text).toContain("19:40");
		expect(text).toContain("18/10/26");
	});

	it("replace a free text, keep an empty one and the stored one", () => {
		expect(demoText("note", "parolaccia", null, now)).toBe(demoExample("note", now));
		expect(demoText("note", "   ", null, now)).toBe("   ");
		expect(demoText("printList", "Lista di ottobre", "Lista di ottobre", now)).toBe(
			"Lista di ottobre",
		);
		expect(demoBlank("qualcosa", null)).toBe("");
		expect(demoBlank("uguale", "uguale")).toBe("uguale");
	});

	it("mark the request that had something replaced, only that one", async () => {
		const changed = await trackDemoRequest(() =>
			Promise.resolve(demoText("reason", "perché sì", null, now)),
		);
		expect(changed.replaced).toBe(true);
		const same = await trackDemoRequest(() => Promise.resolve(demoBlank("x", "x")));
		expect(same).toEqual({ result: "x", replaced: false });
	});

	it("give a new patron fake names and no contacts", () => {
		const out = demoPatron(patronInput(), undefined, now);
		expect(out.firstName).not.toBe("Parola");
		expect(out.lastName).not.toBe("Brutta");
		expect(out.firstName.length).toBeGreaterThan(1);
		expect(out).toMatchObject({
			email: "",
			externalId: "",
			// codes stay: the class, the level, the card validated by the format table
			groupId: "3",
			levelCode: "1",
			cardNumber: "C000017",
			circulationNote: demoExample("comment", now),
			notes: demoExample("comment", now),
		});
	});

	it("keep what a patron already had when other fields change", () => {
		const stored = {
			firstName: "Anna",
			lastName: "Blu",
			email: "anna@scuola.example",
			externalId: "S001",
			circulationNote: null,
			notes: "allergica alla polvere",
		};
		const out = demoPatron(
			patronInput({
				firstName: "Anna",
				lastName: "Blu",
				email: "anna@scuola.example",
				externalId: "S001",
				circulationNote: "",
				notes: "allergica alla polvere",
				levelCode: "2",
			}),
			stored,
			now,
		);
		expect(out).toMatchObject({
			firstName: "Anna",
			lastName: "Blu",
			email: "anna@scuola.example",
			externalId: "S001",
			notes: "allergica alla polvere",
			levelCode: "2",
		});
	});

	it("store an example record, the mock provider's data and the codes kept", () => {
		const own = demoBiblio(biblioInput(), special, undefined, now);
		expect(own).toMatchObject({
			title: demoExample("book", now),
			subtitle: "",
			originalTitle: "",
			responsibility: "",
			author: "AA. VV.",
			publisher: "s.n.",
			publicationPlace: "",
			physicalDescription: "",
			series: "",
			subjects: "",
			notes: demoExample("comment", now),
			// numbers and codes of their shape stay
			publicationYear: "2020",
			seriesNumber: "3",
			dewey: "823.912",
			isbn: "9788804668237",
			genreCode: "A",
		});
		expect(
			demoBiblio(biblioInput({ publicationYear: "duemila" }), special).publicationYear,
		).toBe("");
		const fromLookup = demoBiblio(
			biblioInput({
				title: mock?.title,
				responsibility: mock?.responsibility ?? "",
				author: mock?.author,
				publisher: mock?.publisher,
				publicationPlace: mock?.publicationPlace ?? "",
				physicalDescription: mock?.physicalDescription ?? "",
				subtitle: "",
				originalTitle: mock?.originalTitle ?? "",
				series: "",
				subjects: mock?.subjects.join("\n"),
				notes: "",
			}),
			special,
			undefined,
			now,
		);
		expect(mock?.originalTitle).toBe("Nineteen eighty-four");
		expect(fromLookup).toMatchObject({
			title: mock?.title,
			originalTitle: mock?.originalTitle,
			author: mock?.author,
			publisher: mock?.publisher,
			publicationPlace: mock?.publicationPlace,
			subjects: mock?.subjects.join("\n"),
		});
	});

	it("keep the stored fields of a record edited for something else", () => {
		const stored = {
			title: "Il giardino segreto",
			author: "Burnett, Frances",
			publisher: "Mondadori",
			subtitle: null,
			subjects: ["Amicizia", "Natura"],
			notes: null,
		};
		const out = demoBiblio(
			biblioInput({
				title: "Il giardino segreto",
				author: "Burnett, Frances",
				publisher: "Mondadori",
				subtitle: "",
				originalTitle: "",
				subjects: "Amicizia\nNatura",
				notes: "",
				genreCode: "B",
			}),
			special,
			stored,
			now,
		);
		expect(out).toMatchObject({
			title: "Il giardino segreto",
			author: "Burnett, Frances",
			publisher: "Mondadori",
			subjects: "Amicizia\nNatura",
			genreCode: "B",
		});
	});

	it("give a copy the call number of the format, no volume, an example note", () => {
		const input: ItemFormInput = {
			callNumber: "PAROLACCIA",
			readingLevel: "",
			enumeration: "vol. qualcosa",
			acquisitionDate: "2026-10-01",
			notes: "copia rovinata da Mario",
			notForLoan: false,
		};
		expect(demoItem(input, "B 4 DEL", undefined, now)).toMatchObject({
			callNumber: "B 4 DEL",
			enumeration: "",
			acquisitionDate: "2026-10-01",
			notes: demoExample("comment", now),
		});
		expect(demoItem({ ...input, callNumber: "B 4 DEL" }, "B 4 DEL").callNumber).toBe("B 4 DEL");
		// a new copy: empty, the service suggests it
		expect(demoItem(input, "").callNumber).toBe("");
	});

	it("keep a class section and replace any other group name, numbered in a batch", () => {
		expect(demoGroupName("A", null, now)).toBe("A");
		expect(demoGroupName("B2", null, now)).toBe("B2");
		expect(demoGroupName("Classe dei somari", null, now)).toBe(demoExample("class", now));
		expect(demoGroupName("Altro nome", null, now, 2)).toBe(`${demoExample("class", now)} 2`);
		expect(demoGroupName("Docenti", "Docenti", now)).toBe("Docenti");
	});

	it("keep a shelf of the catalogue only", () => {
		expect(demoChoice("B", ["A", "B"])).toBe("B");
		expect(demoChoice("PAROLA", ["A", "B"])).toBeNull();
		expect(demoChoice(null, ["A"])).toBeNull();
	});

	it("store an example wish, a title even when only an author was asked", () => {
		const wish = { title: "", author: "Chiunque", series: "", seriesNumber: "x", note: "" };
		expect(demoWish(wish, undefined, now)).toMatchObject({
			title: demoExample("wish", now),
			author: "",
			seriesNumber: "",
		});
		expect(
			demoWish(
				{ ...wish, title: mock?.title ?? "", author: mock?.author ?? "" },
				undefined,
				now,
			),
		).toMatchObject({ title: mock?.title, author: mock?.author });
	});

	it("drop the bytes of a picture for the placeholder with the date and time", async () => {
		const sent = new Uint8Array([1, 2, 3]);
		const stored = await demoPicture(sent, now);
		const meta = await new Bun.Image(stored).metadata();
		expect(meta).toMatchObject({
			format: "png",
			width: PLACEHOLDER_WIDTH,
			height: PLACEHOLDER_HEIGHT,
		});
		expect(placeholderStamp(now, "Europe/Rome")).toEqual({ date: "18/10/2026", time: "19:40" });
		// the ink of "DEMO" where its first glyph begins (the left column of the D)
		const image = placeholderImage(now, "Europe/Rome");
		const x = Math.round((PLACEHOLDER_WIDTH - (4 * 6 * 16 - 16)) / 2) + 8;
		const at = (200 * PLACEHOLDER_WIDTH + x) * 3;
		expect([...image.rgb.subarray(at, at + 3)]).toEqual([12, 74, 110]);
	});

	it("change nothing outside the demo", async () => {
		setDemo(false);
		const patron = patronInput();
		expect(demoPatron(patron)).toBe(patron);
		const record = biblioInput();
		expect(demoBiblio(record, special)).toBe(record);
		expect(demoText("note", "testo libero")).toBe("testo libero");
		expect(demoGroupName("Nome lungo")).toBe("Nome lungo");
		expect(demoChoice("PAROLA", [])).toBe("PAROLA");
		const sent = new Uint8Array([1, 2, 3]);
		expect(await demoPicture(sent)).toBe(sent);
	});
});
