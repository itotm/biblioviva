// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	classLabel,
	classLabels,
	compareClass,
	compareClassKeys,
	compareGroups,
	findClass,
	findLevel,
	groupLabel,
	levelPosition,
	nextLevel,
	structureProblems,
	type SchoolStructure,
} from "./school.js";

const school: SchoolStructure = {
	stages: [
		{ code: "primaria", name: "Primaria" },
		{ code: "media", name: "Secondaria" },
	],
	levels: [
		{ code: "P4", label: "4ª", name: "Quarta primaria", stage: "primaria" },
		{ code: "P5", label: "5ª", name: "Quinta primaria", stage: "primaria" },
		{ code: "S1", label: "1", name: "Prima secondaria", stage: "media" },
		{ code: "S2", label: "2", name: "Seconda secondaria", stage: "media", next: null },
	],
	classLabel: "{level} {group}",
	groupWord: "Sezione",
	cardClass: "{word} {group}",
	promotion: { withinStage: "keep", acrossStages: "ask" },
};

describe("school structure", () => {
	it("orders the levels and finds the next one", () => {
		expect(levelPosition(school, "S1")).toBe(2);
		expect(levelPosition(school, "X")).toBe(-1);
		expect(levelPosition(school, null)).toBe(-1);
		expect(nextLevel(school, "P5")).toBe("S1");
		expect(nextLevel(school, "S2")).toBeNull();
		expect(nextLevel({ ...school, levels: school.levels.slice(0, 2) }, "P5")).toBeNull();
	});

	it("writes the class with the template, teachers groups by name", () => {
		const b = { kind: "students" as const, name: "B" };
		expect(classLabel(school, b, "P4")).toBe("4ª B");
		expect(classLabel({ ...school, classLabel: "{level}{group}" }, b, "S1")).toBe("1B");
		expect(classLabel({ ...school, classLabel: "" }, b, "S1")).toBe("1 B");
		expect(classLabel(school, { kind: "teachers", name: "Docenti" }, null)).toBe("Docenti");
		expect(classLabel(school, b, null)).toBe("B");
		expect(classLabel(school, null, "P4")).toBe("");
		const third = { code: "P3", label: "3ª", name: "Terza primaria", stage: "primaria" };
		const wider = { ...school, levels: [third, ...school.levels] };
		expect(groupLabel(wider, { kind: "students", name: "C", levels: ["P4", "P5"] })).toBe(
			"4ª-5ª C",
		);
		expect(groupLabel(school, { kind: "students", name: "C", levels: [] })).toBe("C");
		// every level of its stage: the name alone
		expect(groupLabel(school, { kind: "students", name: "Api", levels: ["S2", "S1"] })).toBe(
			"Api",
		);
	});

	it("sorts students by level and name, teachers last", () => {
		const rows = [
			{ kind: "teachers" as const, levelCode: null, groupName: "Docenti" },
			{ kind: "students" as const, levelCode: "S1", groupName: "A" },
			{ kind: "students" as const, levelCode: "P4", groupName: "B10" },
			{ kind: "students" as const, levelCode: "P4", groupName: "B2" },
			{ kind: null, levelCode: null, groupName: null },
		];
		expect(rows.sort((a, b) => compareClass(school, a, b)).map((r) => r.groupName)).toEqual([
			"B2",
			"B10",
			"A",
			null,
			"Docenti",
		]);
		expect(
			compareGroups(
				school,
				{ kind: "students", name: "A", levels: ["S1"] },
				{ kind: "students", name: "Z", levels: ["P4"] },
			),
		).toBeGreaterThan(0);
	});

	it("orders classes known by their level's position (loan lists, overdue notices)", () => {
		const keys = [
			{ kind: "teachers" as const, position: 0, name: "Docenti" },
			{ kind: null, position: 0, name: "Senza classe" },
			{ kind: "students" as const, position: 1, name: "2 B" },
			{ kind: "students" as const, position: 0, name: "1 B" },
			{ kind: "students" as const, position: 0, name: "1 A" },
		];
		expect(keys.sort(compareClassKeys).map((k) => k.name)).toEqual([
			"1 A",
			"1 B",
			"2 B",
			"Senza classe",
			"Docenti",
		]);
	});

	it("reads the level of a register cell", () => {
		expect(findLevel(school, "S1")?.code).toBe("S1");
		expect(findLevel(school, "4ª")?.code).toBe("P4");
		expect(findLevel(school, "4^")?.code).toBe("P4");
		expect(findLevel(school, "  quinta   PRIMARIA ")?.code).toBe("P5");
		expect(findLevel(school, "")).toBeNull();
		expect(findLevel(school, "sesta")).toBeNull();
	});

	it("checks the structure", () => {
		expect(structureProblems(school)).toEqual([]);
		expect(
			structureProblems({
				stages: [...school.stages, { code: "media", name: "Doppio" }],
				levels: [
					...school.levels,
					{ code: "P4", label: "x", name: "x", stage: "nessuno", next: "Z" },
				],
			}),
		).toEqual([
			"stage codes must be unique",
			"level codes must be unique",
			'level "P4": unknown stage "nessuno"',
			'level "P4": unknown next level "Z"',
		]);
		expect(
			structureProblems({
				stages: school.stages,
				levels: school.levels.map((l) => (l.code === "S2" ? { ...l, label: "1." } : l)),
			}),
		).toEqual(["level labels must be unique"]);
		const circle = school.levels.map((l) => (l.code === "S2" ? { ...l, next: "P4" } : l));
		expect(structureProblems({ stages: school.stages, levels: circle })).toEqual([
			'level "P4": the next levels go round in a circle',
		]);
	});
});

describe("a class in one cell (9.19, Q115)", () => {
	const groups = [
		{ id: 1, kind: "students" as const, name: "A", levels: ["P4"], archived: false },
		{ id: 2, kind: "students" as const, name: "B", levels: ["P4", "P5"], archived: false },
		{ id: 3, kind: "students" as const, name: "A", levels: ["S1"], archived: false },
		{ id: 4, kind: "students" as const, name: "C", levels: ["S1"], archived: true },
		{ id: 5, kind: "teachers" as const, name: "Docenti", levels: [], archived: false },
	];

	it("matches the label, the code, the label or the name of the level with the group", () => {
		expect(findClass(school, groups, "4ª A")).toEqual({ groupId: 1, levelCode: "P4" });
		// the ordinal mark is optional: "4a" is "4ª A"
		expect(findClass(school, groups, "4a")).toEqual({ groupId: 1, levelCode: "P4" });
		expect(findClass(school, groups, "P4A")).toEqual({ groupId: 1, levelCode: "P4" });
		expect(findClass(school, groups, "4 a")).toEqual({ groupId: 1, levelCode: "P4" });
		expect(findClass(school, groups, "quinta primaria b")).toEqual({
			groupId: 2,
			levelCode: "P5",
		});
		expect(findClass(school, groups, "1A")).toEqual({ groupId: 3, levelCode: "S1" });
		// an archived class and a teachers group are not classes of the import
		expect(findClass(school, groups, "1C")).toBeNull();
		expect(findClass(school, groups, "Docenti")).toBeNull();
		expect(findClass(school, groups, "")).toBeNull();
	});

	it("is ambiguous when two classes read the same", () => {
		const twin = [
			{ id: 1, kind: "students" as const, name: "1", levels: ["S1"], archived: false },
			{ id: 2, kind: "students" as const, name: "11", levels: ["S1"], archived: false },
			{ id: 3, kind: "students" as const, name: "1", levels: ["S2"], archived: false },
		];
		// "S11" is "S1" + "1" only; "111" would be "1" + "11" or "11" + "1" (two readings)
		expect(findClass(school, twin, "S11")).toEqual({ groupId: 1, levelCode: "S1" });
		expect(
			findClass(
				{
					...school,
					levels: [
						{ ...school.levels[2]!, code: "1" },
						{ ...school.levels[3]!, code: "11", label: "11" },
					],
				},
				twin,
				"111",
			),
		).toBeNull();
	});

	it("lists the active classes in order, of one level when asked", () => {
		expect(classLabels(school, groups)).toEqual(["4ª A", "4ª B", "5ª B", "1 A"]);
		expect(classLabels(school, groups, "P4")).toEqual(["4ª A", "4ª B"]);
	});
});
