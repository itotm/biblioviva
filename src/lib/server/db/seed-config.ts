// SPDX-License-Identifier: GPL-3.0-or-later
// The demo data follow the installation (PLAN.md step 12.8): the seed takes its classes, levels,
// reading levels, item types, code formats and the language of the names from the configuration,
// so `bun run db:seed`, `dev:reset` and the first-run wizard generate the same kind of school the
// configuration describes. The classes are the preset's (pluriclassi included) unless the wizard
// passes the ones the operator chose.
import type { AppConfig } from "#lib/server/config/schema.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import { loadSchoolPresets, presetGroups } from "#lib/server/school/presets.js";
import { schoolOf } from "#lib/server/school/structure.js";
import type { SeedOptions } from "./seed.js";

/** The country whose names the demo patrons get, from the installation's language. */
const LOCALE_COUNTRY: Readonly<Record<string, string>> = {
	it: "IT",
	fr: "FR",
	de: "DE",
	es: "ES",
	pl: "PL",
	en: "GB",
};

export function seedOptionsFromConfig(
	config: AppConfig,
	choices: { groups?: { name: string; levels: string[] }[] } = {},
	builtinRoot?: string,
): SeedOptions {
	const school = schoolOf(config);
	const preset = loadSchoolPresets(builtinRoot).find((p) => p.id === config.school.preset);
	const known = new Set(school.levels.map((l) => l.code));
	// the preset's classes, kept only when they fit the levels of the configuration
	const fromPreset = preset
		? presetGroups(preset)
				.map((g) => ({ name: g.name, levels: g.levels.filter((l) => known.has(l)) }))
				.filter((g) => g.levels.length > 0)
		: [];
	return {
		codes: codeTable(config),
		school,
		groups: choices.groups ?? (fromPreset.length > 0 ? fromPreset : undefined),
		teacherGroupName: config.school.teacherGroupName,
		readingLevels: config.classification.readingLevels.map((l) => l.code),
		callNumber: config.classification.callNumber,
		classPerItem: config.classification.classPerItem,
		itemTypes: config.library.itemTypes.map((t) => ({
			code: t.code,
			notForLoan: t.notForLoan,
		})),
		country:
			preset?.country !== undefined && preset.country !== ""
				? preset.country
				: (LOCALE_COUNTRY[config.ui.locale.slice(0, 2)] ?? "GB"),
	};
}
