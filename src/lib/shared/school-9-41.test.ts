// SPDX-License-Identifier: GPL-3.0-or-later
// The school structure for the countries of the language packs (9.41): a class label per stage,
// paths that split, the card's class line, the order in the installation's language and the
// register files of other scripts.
import { describe, expect, it } from "vitest";
import {
	classLabel,
	classLabels,
	compareClassKeys,
	findClass,
	findLevel,
	groupLabel,
	nextChoices,
	nextLevel,
	renderCardClass,
	structureProblems,
	type ClassOrderKey,
	type SchoolStructure,
} from "./school.js";

/** A German Gymnasium: Sekundarstufe I with classes (`7b`), an Oberstufe of courses (`Q1`). */
const gymnasium: SchoolStructure = {
	stages: [
		{ code: "sek1", name: "Sekundarstufe I" },
		{ code: "sek2", name: "Oberstufe", classLabel: "{level}" },
	],
	levels: [
		{ code: "9", label: "9", name: "Klasse 9", stage: "sek1" },
		{ code: "10", label: "10", name: "Klasse 10", stage: "sek1" },
		{ code: "Q1", label: "Q1", name: "Qualifikationsphase 1", stage: "sek2" },
		{ code: "Q2", label: "Q2", name: "Qualifikationsphase 2", stage: "sek2", next: null },
	],
	classLabel: "{level}{group}",
	groupWord: "Klasse",
	cardClass: "{word} {class}",
	locale: "de",
	promotion: { withinStage: "keep", acrossStages: "ask" },
};

/** A Dutch secondary school: after the brugklas the pupils choose vmbo, havo or vwo. */
const dutch: SchoolStructure = {
	stages: [
		{ code: "bk", name: "Brugklas" },
		{ code: "vo", name: "Voortgezet", classLabel: "{level}{group}" },
	],
	levels: [
		{ code: "1", label: "1", name: "Brugklas", stage: "bk", next: ["H2", "M2", "V2"] },
		{ code: "M2", label: "m2", name: "Vmbo 2", stage: "vo", next: null },
		{ code: "H2", label: "h2", name: "Havo 2", stage: "vo", next: ["H3", null] },
		{ code: "H3", label: "h3", name: "Havo 3", stage: "vo", next: null },
		{ code: "V2", label: "v2", name: "Vwo 2", stage: "vo", next: null },
	],
	classLabel: "{level}{group}",
	groupWord: "Klas",
	cardClass: "{word} {group}",
	promotion: { withinStage: "keep", acrossStages: "ask" },
};

const students = (
	id: number,
	name: string,
	levels: string[],
): { id: number; kind: "students"; name: string; levels: string[]; archived: boolean } => ({
	id,
	kind: "students" as const,
	name,
	levels,
	archived: false,
});

describe("a class label per stage", () => {
	it("leaves the group out where the stage's template does", () => {
		expect(classLabel(gymnasium, { kind: "students", name: "b" }, "10")).toBe("10b");
		expect(classLabel(gymnasium, { kind: "students", name: "Kurs" }, "Q1")).toBe("Q1");
		expect(groupLabel(gymnasium, students(1, "Kurs", ["Q2"]))).toBe("Q2");
	});

	it("lets labels repeat across stages with templates of their own, never within one", () => {
		const china: SchoolStructure = {
			...gymnasium,
			stages: [
				{ code: "cz", name: "初中", classLabel: "初{level}({group})班" },
				{ code: "gz", name: "高中", classLabel: "高{level}({group})班" },
			],
			levels: [
				{ code: "7", label: "一", name: "初一", stage: "cz", aliases: ["初一"] },
				{
					code: "10",
					label: "一",
					name: "高一",
					stage: "gz",
					next: null,
					aliases: ["高一"],
				},
			],
		};
		expect(structureProblems(china)).toEqual([]);
		expect(classLabel(china, { kind: "students", name: "3" }, "7")).toBe("初一(3)班");
		expect(classLabel(china, { kind: "students", name: "3" }, "10")).toBe("高一(3)班");
		// a register cell with the label alone names two years: none is taken, the alias decides
		expect(findLevel(china, "一")).toBeNull();
		expect(findLevel(china, "高一")?.code).toBe("10");
		expect(findLevel(china, "7")?.code).toBe("7");
		// the same template on both: "一" would mean two classes
		expect(
			structureProblems({
				...china,
				stages: china.stages.map((s) => ({ ...s, classLabel: undefined })),
			}),
		).toContain("level labels must be unique");
	});
});

describe("paths that split", () => {
	it("takes the first choice as the next level and lists every choice", () => {
		expect(structureProblems(dutch)).toEqual([]);
		expect(nextLevel(dutch, "1")).toBe("H2");
		expect(nextChoices(dutch, "1")).toEqual(["H2", "M2", "V2"]);
		expect(nextChoices(dutch, "H2")).toEqual(["H3", null]);
		expect(nextChoices(dutch, "H3")).toEqual([null]);
		expect(nextChoices(gymnasium, "9")).toEqual(["10"]);
	});

	it("checks every choice and finds a circle on any branch", () => {
		const levels = dutch.levels.map((l) =>
			l.code === "V2" ? { ...l, next: ["X9", null] } : l,
		);
		expect(structureProblems({ ...dutch, levels })).toContain(
			'level "V2": unknown next level "X9"',
		);
		const circle = dutch.levels.map((l) => (l.code === "M2" ? { ...l, next: ["1", null] } : l));
		expect(structureProblems({ ...dutch, levels: circle }).join()).toContain("circle");
		const one = dutch.levels.map((l) => (l.code === "1" ? { ...l, next: ["H2"] } : l));
		expect(structureProblems({ ...dutch, levels: one }).join()).toContain("two choices");
	});
});

describe("the class line of the card", () => {
	it("fills the word, the group, the level and the class", () => {
		const parts = { word: "Klasse", group: "b", level: "10", class: "10b" };
		expect(renderCardClass("{word} {class}", parts)).toBe("Klasse 10b");
		expect(renderCardClass("{word} {group}", parts)).toBe("Klasse b");
		expect(renderCardClass("{level}年{group}組", parts)).toBe("10年b組");
		// an empty template is the default one
		expect(renderCardClass("", parts)).toBe("Klasse b");
	});
});

describe("order in the installation's language", () => {
	it("puts Å, Ä and Ö after Z in Swedish, as Italian does not", () => {
		const key = (name: string): ClassOrderKey => ({ kind: "students", position: 0, name });
		const sorted = (locale: string): string[] =>
			["Å", "Z", "B"]
				.map(key)
				.sort((a, b) => compareClassKeys(a, b, locale))
				.map((k) => k.name ?? "");
		expect(sorted("sv")).toEqual(["B", "Z", "Å"]);
		expect(sorted("it")).toEqual(["Å", "B", "Z"]);
		const swedish = { ...gymnasium, locale: "sv" };
		expect(classLabels(swedish, [students(1, "ö", ["9"]), students(2, "z", ["9"])])).toEqual([
			"9z",
			"9ö",
		]);
	});
});

describe("register files of other countries", () => {
	const japan: SchoolStructure = {
		...gymnasium,
		stages: [{ code: "sho", name: "小学校" }],
		levels: [
			{ code: "1", label: "1年", name: "1年生", stage: "sho" },
			{ code: "3", label: "3年", name: "3年生", stage: "sho", aliases: ["三年"] },
		],
		classLabel: "{level}{group}組",
	};
	const groups = [students(1, "2", ["1"]), students(2, "2", ["3"])];

	it("reads full-width digits, more marks and the aliases of a level", () => {
		expect(findClass(japan, groups, "１年２組")).toEqual({ groupId: 1, levelCode: "1" });
		expect(findLevel(japan, "三年")?.code).toBe("3");
		expect(findLevel(japan, "«3年»")?.code).toBe("3");
		const turkey = { ...gymnasium, classLabel: "{level}-{group}" };
		const turkish = [students(5, "A", ["9"])];
		expect(findClass(turkey, turkish, "9-A")).toEqual({ groupId: 5, levelCode: "9" });
		expect(findClass(turkey, turkish, "9/A")).toEqual({ groupId: 5, levelCode: "9" });
		expect(findClass(turkey, turkish, "9 A")).toEqual({ groupId: 5, levelCode: "9" });
	});

	it("still refuses a text two classes would match", () => {
		const twins = {
			...japan,
			levels: [...japan.levels, { code: "x", label: "x", name: "三年", stage: "sho" }],
		};
		expect(findLevel(twins, "三年")?.code).toBe("x");
		expect(
			findClass(twins, [students(1, "2", ["3"]), students(2, "2", ["x"])], "三年2"),
		).toBeNull();
	});
});
