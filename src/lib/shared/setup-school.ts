// SPDX-License-Identifier: GPL-3.0-or-later
// The "Scuola" and "Codici" steps of the first-run wizard (PLAN.md step 12.8): from a preset to the
// classes to make, the reading levels and the code formats, the same in the browser (preview) and
// on the server (what is written). Pure functions.
import { buildCodeTable, type CodeFormats } from "./barcodes/table.js";
import { checkCodeTable, type FormatIssue } from "./barcodes/compare.js";
import type { CheckAlgorithm } from "./barcodes/check.js";
import type { KeyboardLayout } from "./barcodes/layouts.js";
import { DEFAULT_CODE_FORMATS, kindFormat, type CodePreset } from "./barcodes/presets.js";
import type { SchoolLevel, SchoolStage } from "./school.js";

/** What the wizard knows of a preset (`config/school-presets/<id>.json`). */
export interface WizardPreset {
	id: string;
	name: string;
	country: string;
	stages: SchoolStage[];
	levels: SchoolLevel[];
	classLabel: string;
	groupWord: string;
	/** Names of the classes made for each level of a stage. */
	groups: Record<string, string[]>;
	/** Classes hosting several levels (infanzia sections, pluriclassi). */
	mixedGroups: { name: string; levels: string[] }[];
	teacherGroup: string;
	readingLevels: { code: string; label: string }[];
	/** The school year the preset proposes (9.41): its first day and its name. */
	schoolYear: { start: string; label: "span" | "start" };
}

/**
 * How the classes of a stage are made: `perLevel` — one class per level and name (`1 A`, `2 A`);
 * `mixed` — one class per name hosting every level of the stage (an infanzia section).
 */
export interface StageChoice {
	code: string;
	mode: "perLevel" | "mixed";
	names: string[];
}

/** The class names a preset proposes for each of its stages. */
export function stageChoices(preset: WizardPreset): StageChoice[] {
	return preset.stages.map((stage) => {
		const perLevel = preset.groups[stage.code];
		if (perLevel) {
			return { code: stage.code, mode: "perLevel", names: [...perLevel] };
		}
		const ofStage = new Set(
			preset.levels.filter((l) => l.stage === stage.code).map((l) => l.code),
		);
		const mixed = preset.mixedGroups.filter((g) => g.levels.every((l) => ofStage.has(l)));
		return mixed.length > 0
			? { code: stage.code, mode: "mixed", names: mixed.map((g) => g.name) }
			: { code: stage.code, mode: "perLevel", names: ["A"] };
	});
}

/** The classes to make: per level and name in the order of the levels, then the mixed ones. */
export function wizardGroups(
	levels: readonly SchoolLevel[],
	stages: readonly StageChoice[],
): { name: string; levels: string[] }[] {
	const perLevel: { name: string; levels: string[] }[] = [];
	const mixed: { name: string; levels: string[] }[] = [];
	for (const level of levels) {
		const stage = stages.find((s) => s.code === level.stage);
		if (stage?.mode === "perLevel") {
			for (const name of stage.names) {
				perLevel.push({ name, levels: [level.code] });
			}
		}
	}
	for (const stage of stages) {
		if (stage.mode === "mixed") {
			const ofStage = levels.filter((l) => l.stage === stage.code).map((l) => l.code);
			for (const name of stage.names) {
				mixed.push({ name, levels: ofStage });
			}
		}
	}
	return [...perLevel, ...mixed];
}

/**
 * The reading levels of fiction (Q96): the preset's proposal, or one per level of the school when
 * the preset has none and the library wants them; none when fiction is not shelved by level.
 */
export function wizardReadingLevels(
	preset: Pick<WizardPreset, "readingLevels" | "levels">,
	byLevel: boolean,
): { code: string; label: string }[] {
	if (!byLevel) {
		return [];
	}
	return preset.readingLevels.length > 0
		? preset.readingLevels
		: preset.levels.map((l) => ({ code: l.code, label: l.label }));
}

/** The class label templates offered (the preset's first), with `{level}` and `{group}`. */
export function classLabelChoices(preset: Pick<WizardPreset, "classLabel">): string[] {
	return [
		...new Set([preset.classLabel, "{level} {group}", "{level}{group}", "{level}-{group}"]),
	];
}

export interface CodeChoice {
	/** The ready-made format of the copies and the one of the cards, chosen apart. */
	item: CodePreset;
	card: CodePreset;
	check: CheckAlgorithm;
	layout: KeyboardLayout;
}

/**
 * The code formats of the choice, keeping the legacy shapes of the configuration when they cannot
 * be confused with the new formats (a fresh installation of this library keeps its Koha codes);
 * `issues` lists what still breaks the rule that copies and cards are never confused (Q90).
 */
export function wizardCodeFormats(
	choice: CodeChoice,
	legacy: { item: CodeFormats["item"]["legacy"]; card: CodeFormats["card"]["legacy"] } = {
		item: [],
		card: [],
	},
	plainMaxLength = 0,
): { formats: CodeFormats; issues: FormatIssue[] } {
	const item = kindFormat("item", choice.item, choice.check);
	const card = kindFormat("card", choice.card, choice.check);
	const bare: CodeFormats = {
		...DEFAULT_CODE_FORMATS,
		item: { current: item, retired: [], legacy: [] },
		card: { current: card, retired: [], legacy: [] },
		layout: choice.layout,
	};
	const withLegacy: CodeFormats = {
		...bare,
		item: { ...bare.item, legacy: legacy.item },
		card: { ...bare.card, legacy: legacy.card },
		plainMaxLength,
	};
	const errors = (f: CodeFormats): FormatIssue[] =>
		checkCodeTable(buildCodeTable(f)).filter((i) => i.severity === "error");
	if (errors(withLegacy).length === 0) {
		return { formats: withLegacy, issues: [] };
	}
	return { formats: bare, issues: errors(bare) };
}

/** The keyboard layout the scanners of a country type into. */
export function layoutForLocale(locale: string): KeyboardLayout {
	const lang = locale.slice(0, 2);
	return lang === "it" || lang === "es" || lang === "de" || lang === "fr"
		? lang
		: locale.endsWith("US")
			? "us"
			: "uk";
}
