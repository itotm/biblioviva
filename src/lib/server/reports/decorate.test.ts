// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import { catalogRules } from "#lib/server/services/catalog.js";
import { decorateRows, type Decorations } from "./decorate.js";

const d: Decorations = {
	locale: "it",
	scheme: catalogRules(parseConfig(exampleRaw()).config).scheme,
	itemTypes: { libro: "Libro" },
	patronTypes: { student: "Studente", teacher: "Docente" },
	itemStatuses: { lost: "Smarrito" },
	levels: { "3": "3ª" },
	stages: { primaria: "Primaria" },
	kinds: { fiction: "Narrativa", nonfiction: "Saggistica" },
	teachers: "Docenti",
	unclassified: "Da classificare",
	total: "Totale",
	yes: "Sì",
	no: "No",
};

describe("report decorations", () => {
	it("turns codes into words and leaves the rest alone", () => {
		const rows = decorateRows(
			[
				{ key: "c", type: "classification" },
				{ key: "p", type: "patronType" },
				{ key: "i", type: "itemType" },
				{ key: "s", type: "itemStatus" },
				{ key: "w", type: "weekday" },
				{ key: "b", type: "boolean" },
				{ key: "n", type: "int" },
			],
			[
				{ c: "590", p: "teacher", i: "libro", s: "lost", w: 1, b: 0, n: 3 },
				{ c: "ZZZ", p: "other", i: "vhs", s: "odd", w: 9, b: 1, n: null },
				{ c: null, p: null, i: null, s: null, w: null, b: null, n: 1 },
			],
			d,
		);
		expect(rows[0]).toEqual({
			c: expect.stringMatching(/^590 · /) as unknown,
			p: "Docente",
			i: "Libro",
			s: "Smarrito",
			w: "lunedì",
			b: "No",
			n: 3,
		});
		expect(rows[1]).toEqual({
			c: "ZZZ",
			p: "other",
			i: "vhs",
			s: "odd",
			w: "9",
			b: "Sì",
			n: null,
		});
		expect(rows[2]?.c).toBeNull();
		expect(decorateRows([{ key: "n", type: "int" }], [{ n: 1 }], d)).toEqual([{ n: 1 }]);
	});

	it("names the levels, stages, kinds, months, decades and the special rows (9.20)", () => {
		const rows = decorateRows(
			[
				{ key: "l", type: "level" },
				{ key: "st", type: "stage" },
				{ key: "k", type: "kind" },
				{ key: "m", type: "month" },
				{ key: "d", type: "decade" },
				{ key: "c", type: "classification" },
			],
			[
				{ l: "3", st: "primaria", k: "fiction", m: "2026-09", d: 1990, c: "@unclassified" },
				{ l: "@teachers", st: "x", k: "@unclassified", m: "x", d: null, c: "590" },
			],
			d,
		);
		expect(rows[0]).toEqual({
			l: "3ª",
			st: "Primaria",
			k: "Narrativa",
			m: "settembre 2026",
			d: "1990–1999",
			c: "Da classificare",
		});
		expect(rows[1]).toMatchObject({
			l: "Docenti",
			st: "x",
			k: "Da classificare",
			m: "x",
			d: null,
		});
	});
});
