// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { groupLabel, structureProblems } from "#lib/shared/school.js";
import {
	loadSchoolPresets,
	localizePreset,
	presetGroups,
	presetName,
	sortPresets,
} from "./presets.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) {
		rmSync(d, { recursive: true, force: true });
	}
	vi.restoreAllMocks();
});

describe("school presets", () => {
	it("ships valid presets, those of the installation's language first", () => {
		const presets = loadSchoolPresets();
		expect(presets.length).toBeGreaterThanOrEqual(50);
		for (const p of presets) {
			expect(structureProblems(p.school), p.id).toEqual([]);
			expect(p.name.en, p.id).toBeTruthy();
			// the reading levels and the classes name existing codes
			for (const g of presetGroups(p)) {
				expect(
					g.levels.every((code) => p.school.levels.some((l) => l.code === code)),
					p.id,
				).toBe(true);
			}
		}
		expect(presets.map((p) => p.id)).toContain("it-primaria");
		const countries = (locale: string, n: number): string[] =>
			sortPresets(presets, locale)
				.slice(0, n)
				.map((p) => p.country);
		const italian = sortPresets(presets, "it");
		const firstForeign = italian.findIndex((p) => p.country !== "IT");
		expect(firstForeign).toBeGreaterThan(0);
		expect(italian.slice(firstForeign).every((p) => p.country !== "IT")).toBe(true);
		expect(italian.at(-1)?.id).toBe("generic");
		// pt-BR: Brazil, then Portugal (the same base language), then the others
		expect(countries("pt-BR", 3)).toEqual(["BR", "BR", "PT"]);
		expect(new Set(countries("de", 6))).toEqual(new Set(["DE", "AT", "CH"]));
		expect(sortPresets(presets, "ca")[0]?.id).toMatch(/^ca-/);
	});

	it("names a preset in the installation's language, English otherwise", () => {
		const p = { id: "x", name: { en: "Primary", it: "Primaria", "pt-BR": "Fundamental" } };
		expect(presetName(p, "it")).toBe("Primaria");
		expect(presetName(p, "pt-BR")).toBe("Fundamental");
		expect(presetName(p, "it-CH")).toBe("Primaria");
		expect(presetName(p, "sv")).toBe("Primary");
	});

	it("words the generic preset from the dictionary", () => {
		const generic = loadSchoolPresets().find((p) => p.id === "generic");
		expect(generic).toBeDefined();
		if (!generic) {
			return;
		}
		const t = (key: string, params?: Record<string, unknown>): string =>
			`${key}${params ? `:${String(params.level)}` : ""}`;
		const local = localizePreset(generic, t);
		expect(local.school.stages[0]?.name).toBe("setup.generic.stage");
		expect(local.school.levels[2]?.name).toBe("setup.generic.level:3");
		expect(local.school.groupWord).toBe("setup.generic.groupWord");
		expect(local.teacherGroup).toBe("setup.generic.teacherGroup");
		// the others stay as they are, and so does the generic one without a dictionary
		const primaria = loadSchoolPresets().find((p) => p.id === "it-primaria");
		expect(primaria && localizePreset(primaria, t)).toBe(primaria);
		expect(localizePreset(generic, undefined)).toBe(generic);
	});

	it("makes one class per level and name, then the mixed ones", () => {
		const primaria = loadSchoolPresets().find((p) => p.id === "it-primaria");
		expect(primaria).toBeDefined();
		if (!primaria) {
			return;
		}
		const groups = presetGroups(primaria);
		expect(groups[0]).toEqual({ name: primaria.groups.primaria?.[0], levels: ["1"] });
		expect(groups.length).toBe(
			5 * (primaria.groups.primaria?.length ?? 0) + primaria.mixedGroups.length,
		);
	});

	it("writes the classes the way each country does", () => {
		const presets = new Map(loadSchoolPresets().map((p) => [p.id, p]));
		const labels = (id: string): string[] => {
			const p = presets.get(id);
			return p
				? presetGroups(p).map((g) => groupLabel(p.school, { kind: "students", ...g }))
				: [];
		};
		expect(labels("it-primaria").slice(0, 2)).toEqual(["1 A", "1 B"]);
		expect(labels("fr-elementaire").slice(0, 3)).toEqual(["CP A", "CP B", "CE1 A"]);
		expect(labels("de-grundschule").slice(0, 2)).toEqual(["1a", "1b"]);
		expect(labels("pl-podstawowa").at(-1)).toBe("VIIIc");
		expect(labels("uk-primary")[0]).toBe("Reception A");
		// the infanzia sections of a comprensivo host every age: their name alone
		expect(labels("it-comprensivo").slice(-2)).toEqual(["Infanzia A", "Infanzia B"]);
		expect(labels("it-comprensivo")).toContain("1ª media D");
		// the countries of the language packs (9.41)
		expect(labels("pt-basico")).toContain("7.º B");
		expect(labels("ro-gimnaziala")).toContain("a V-a B");
		expect(labels("gr-gymnasio")).toContain("Β2");
		expect(labels("ru-shkola")).toContain("5А");
		expect(labels("cn-zhongxue")).toContain("初一(3)班");
		expect(labels("cn-zhongxue")).toContain("高一(3)班");
		expect(labels("jp-shogakko")).toContain("1年2組");
		expect(labels("kr-chodeung")).toContain("1학년 2반");
	});

	it("skips an invalid file with a warning, and a missing folder", () => {
		const root = mkdtempSync(join(tmpdir(), "bv-presets-"));
		dirs.push(root);
		expect(loadSchoolPresets(root)).toEqual([]);
		mkdirSync(join(root, "school-presets"));
		writeFileSync(join(root, "school-presets", "bad.json"), JSON.stringify({ id: "bad" }));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		expect(loadSchoolPresets(root)).toEqual([]);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("bad.json"));
	});
});
