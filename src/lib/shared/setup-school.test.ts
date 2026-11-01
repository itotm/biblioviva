// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import {
	classLabelChoices,
	layoutForLocale,
	stageChoices,
	wizardCodeFormats,
	wizardGroups,
	wizardReadingLevels,
	type WizardPreset,
} from "./setup-school.js";

const comprensivo: WizardPreset = {
	id: "it-comprensivo",
	name: "Istituto comprensivo",
	country: "IT",
	stages: [
		{ code: "infanzia", name: "Infanzia" },
		{ code: "primaria", name: "Primaria" },
		{ code: "media", name: "Media" },
	],
	levels: [
		{ code: "I3", label: "3 anni", name: "3 anni", stage: "infanzia" },
		{ code: "I4", label: "4 anni", name: "4 anni", stage: "infanzia" },
		{ code: "P1", label: "1ª", name: "Prima", stage: "primaria" },
		{ code: "P2", label: "2ª", name: "Seconda", stage: "primaria" },
		{ code: "S1", label: "1ª media", name: "Prima media", stage: "media" },
	],
	classLabel: "{level} {group}",
	groupWord: "Sezione",
	groups: { primaria: ["A", "B"] },
	mixedGroups: [{ name: "Infanzia A", levels: ["I3", "I4"] }],
	teacherGroup: "Docenti",
	readingLevels: [
		{ code: "1", label: "1ª" },
		{ code: "2", label: "2ª" },
	],
	schoolYear: { start: "09-01", label: "span" },
};

describe("wizard school choices", () => {
	it("proposes the classes of every stage", () => {
		expect(stageChoices(comprensivo)).toEqual([
			{ code: "infanzia", mode: "mixed", names: ["Infanzia A"] },
			{ code: "primaria", mode: "perLevel", names: ["A", "B"] },
			{ code: "media", mode: "perLevel", names: ["A"] },
		]);
	});

	it("makes one class per level and name, then the mixed ones", () => {
		const stages = stageChoices(comprensivo);
		expect(wizardGroups(comprensivo.levels, stages)).toEqual([
			{ name: "A", levels: ["P1"] },
			{ name: "B", levels: ["P1"] },
			{ name: "A", levels: ["P2"] },
			{ name: "B", levels: ["P2"] },
			{ name: "A", levels: ["S1"] },
			{ name: "Infanzia A", levels: ["I3", "I4"] },
		]);
		expect(
			wizardGroups(comprensivo.levels, [{ code: "primaria", mode: "perLevel", names: [] }]),
		).toEqual([]);
	});

	it("proposes the reading levels, or one per level, or none", () => {
		expect(wizardReadingLevels(comprensivo, true).map((l) => l.code)).toEqual(["1", "2"]);
		expect(
			wizardReadingLevels({ ...comprensivo, readingLevels: [] }, true).map((l) => l.code),
		).toEqual(["I3", "I4", "P1", "P2", "S1"]);
		expect(wizardReadingLevels(comprensivo, false)).toEqual([]);
	});

	it("offers the preset's class label first, without repeats", () => {
		expect(classLabelChoices({ classLabel: "{level}{group}" })).toEqual([
			"{level}{group}",
			"{level} {group}",
			"{level}-{group}",
		]);
	});
});

describe("wizard code formats", () => {
	it("builds the formats of a preset and a check, keeping compatible legacy shapes", () => {
		const legacy = {
			item: [{ pattern: "YYYY-NNNN", check: "none" as const }],
			card: [{ pattern: "NNNNNNNNNN", check: "none" as const }],
		};
		const standard = wizardCodeFormats(
			{ item: "standard", card: "standard", check: "mod23", layout: "it" },
			legacy,
			9,
		);
		expect(standard.issues).toEqual([]);
		expect(standard.formats.item.current).toEqual({ pattern: "YYYY-CNNNN", check: "mod23" });
		expect(standard.formats.item.legacy).toEqual(legacy.item);
		expect(standard.formats.plainMaxLength).toBe(9);
		// copies of ten digits would read as cards of the classic format: the legacy shapes go
		const clash = { item: [{ pattern: "NNNNNNNNNN", check: "none" as const }], card: [] };
		const classic = wizardCodeFormats(
			{ item: "classic", card: "classic", check: "luhn", layout: "fr" },
			clash,
		);
		expect(classic.issues).toEqual([]);
		expect(classic.formats.item.legacy).toEqual([]);
		expect(classic.formats.layout).toBe("fr");
	});

	it("lets the copies and the cards take formats of different presets", () => {
		const mixed = wizardCodeFormats({
			item: "prefix",
			card: "standard",
			check: "mod23",
			layout: "it",
		});
		expect(mixed.issues).toEqual([]);
		expect(mixed.formats.item.current).toEqual({ pattern: "'L'-YYNNNNC", check: "mod23" });
		expect(mixed.formats.card.current).toEqual({ pattern: "CNNNNNN", check: "mod23" });
		const other = wizardCodeFormats({
			item: "standard",
			card: "classic",
			check: "luhn",
			layout: "it",
		});
		expect(other.formats.item.current).toEqual({ pattern: "YYYY-CNNNN", check: "luhn" });
		expect(other.formats.card.current).toEqual({ pattern: "NNNNNNNNNC", check: "luhn" });
	});

	it("picks the keyboard layout of the language", () => {
		expect(layoutForLocale("it")).toBe("it");
		expect(layoutForLocale("de")).toBe("de");
		expect(layoutForLocale("en-US")).toBe("us");
		expect(layoutForLocale("en")).toBe("uk");
		expect(layoutForLocale("pl")).toBe("uk");
	});
});
