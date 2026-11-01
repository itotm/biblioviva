// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { byCompleteness, completeness } from "./score.js";
import type { BiblioDraft } from "./types.js";

const o = { specialAuthors: ["Anonimo", "AA. VV."], unknownPublisher: "s.n." };
const draft = (over: Partial<BiblioDraft>): BiblioDraft => ({
	title: "Harry Potter e il calice di fuoco",
	subtitle: null,
	originalTitle: null,
	responsibility: null,
	author: "Rowling, J. K.",
	publisher: "Salani",
	publicationPlace: "Milano",
	publicationYear: 2001,
	isbn: "9788884510495",
	issn: null,
	physicalDescription: "627 p. : ill. ; 22 cm",
	series: null,
	seriesNumber: null,
	dewey: null,
	subjects: [],
	sourceId: null,
	source: "sbn",
	...over,
});

describe("completeness", () => {
	it("gives more to a fuller record and less to placeholders and malformed fields", () => {
		const full = draft({
			dewey: "823.914",
			subjects: ["Maghi"],
			responsibility: "J. K. Rowling",
		});
		expect(completeness(full, o)).toBeGreaterThan(completeness(draft({}), o));
		expect(completeness(draft({ publicationYear: null }), o)).toBeLessThan(
			completeness(draft({}), o),
		);
		expect(completeness(draft({ author: "Anonimo" }), o)).toBeLessThan(
			completeness(draft({}), o),
		);
		expect(completeness(draft({ publisher: "s.n." }), o)).toBeLessThan(
			completeness(draft({}), o),
		);
		// SBN record VIA\0559777: "Nuova ed" in the place, the whole imprint in the description
		const broken = draft({
			publicationPlace: "Nuova ed",
			physicalDescription: "Milano : Salani , 2023. - 652 p; 21 cm and more text in here",
		});
		expect(completeness(broken, o)).toBeLessThan(completeness(draft({}), o));
		expect(completeness(draft({ series: "Harry Potter" }), o)).toBeGreaterThan(
			completeness(draft({}), o),
		);
		expect(completeness(draft({ subtitle: "romanzo", isbn: null }), o)).toBe(
			completeness(draft({}), o),
		);
	});

	it("orders the most complete first, then the most recent year, then the provider order", () => {
		const a = draft({ sourceId: "a", publicationYear: 2001 });
		const b = draft({ sourceId: "b", publicationYear: 2008 });
		const c = draft({ sourceId: "c", publicationYear: null });
		const d = draft({ sourceId: "d", dewey: "823" });
		const e = draft({ sourceId: "e", publicationYear: 2008 });
		expect(byCompleteness([a, b, c, d, e], o).map((x) => x.sourceId)).toEqual([
			"d",
			"b",
			"e",
			"a",
			"c",
		]);
		expect(byCompleteness([], o)).toEqual([]);
	});
});
