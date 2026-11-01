// SPDX-License-Identifier: GPL-3.0-or-later
// The ready-made school structures (PLAN.md Phase 12, B4.4 of the study; 9.41): built-in JSON files
// read from the application's `config/school-presets/` (never copied, like the built-in reports),
// each one an ordinary `school` section once chosen, plus the classes the wizard and the demo data
// make, a proposal of reading levels and of the school year. Names in several languages, English
// the fallback; the presets of the installation's language come first.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "valibot";
import { nextLevelSchema } from "#lib/server/config/schema.js";
import { configCode as code, levelCode, localeCode } from "#lib/shared/input-schemas.js";
import { structureProblems } from "#lib/shared/school.js";
import { SCHOOL_YEAR_LABELS } from "#lib/shared/school-year.js";

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(120));

const presetSchema = v.object({
	id: code,
	/** The name by language code; English is the fallback. */
	name: v.pipe(
		v.record(localeCode, text),
		v.check((n) => typeof n.en === "string", "an English name is required"),
	),
	country: v.pipe(v.string(), v.maxLength(2)),
	/** The installation languages that list this preset first (`pt-BR` → Brazil, `de` → DE, AT, CH). */
	languages: v.optional(v.array(localeCode), []),
	/** The school year the country keeps: its first day and how it is named (9.41). */
	schoolYear: v.optional(
		v.object({
			start: v.pipe(v.string(), v.regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)),
			label: v.picklist(SCHOOL_YEAR_LABELS),
		}),
	),
	school: v.object({
		stages: v.pipe(
			v.array(
				v.object({
					code,
					name: text,
					classLabel: v.optional(
						v.pipe(v.string(), v.maxLength(40), v.includes("{level}")),
					),
				}),
			),
			v.minLength(1),
		),
		levels: v.pipe(
			v.array(
				v.object({
					code: levelCode,
					label: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
					name: text,
					stage: code,
					next: v.optional(nextLevelSchema),
					aliases: v.optional(
						v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(40))),
					),
				}),
			),
			v.minLength(1),
		),
		classLabel: v.pipe(v.string(), v.includes("{group}")),
		groupWord: text,
		cardClass: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(60))),
		promotionWithinStage: v.picklist(["keep", "clear"]),
		promotionAcrossStages: v.picklist(["keep", "clear", "ask"]),
	}),
	/** Names of the classes made for each level of a stage (`1 A`, `1 B`, …). */
	groups: v.record(code, v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(40)))),
	/** Classes hosting several levels (infanzia sections, pluriclassi). */
	mixedGroups: v.optional(
		v.array(
			v.object({
				name: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
				levels: v.array(levelCode),
			}),
		),
		[],
	),
	teacherGroup: text,
	readingLevels: v.array(v.object({ code: levelCode, label: text })),
});

export type SchoolPreset = v.InferOutput<typeof presetSchema>;

/** Every valid preset, by id; an invalid file is skipped with a warning. */
export function loadSchoolPresets(builtinRoot = "config"): SchoolPreset[] {
	const dir = join(builtinRoot, "school-presets");
	if (!existsSync(dir)) {
		return [];
	}
	const out: SchoolPreset[] = [];
	for (const file of readdirSync(dir)
		.filter((f) => f.endsWith(".json"))
		.sort()) {
		const parsed = v.safeParse(presetSchema, JSON.parse(readFileSync(join(dir, file), "utf8")));
		if (!parsed.success || structureProblems(parsed.output.school).length > 0) {
			console.warn(`[school] preset ${file} is not valid: skipped`);
			continue;
		}
		out.push(parsed.output);
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The presets in the order an installation in `locale` sees them: those of its exact language
 * first (`pt-BR` → Brazil), then those of its base language (`pt`), then the others; the generic
 * one last. Within each part by id.
 */
export function sortPresets(presets: readonly SchoolPreset[], locale: string): SchoolPreset[] {
	const base = locale.split("-")[0] ?? locale;
	const rank = (p: SchoolPreset): number =>
		p.languages.includes(locale)
			? 0
			: p.languages.some((l) => l === base || l.split("-")[0] === base)
				? 1
				: p.id === "generic"
					? 3
					: 2;
	return [...presets].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

/** The name of a preset in `locale`, its base language, or English. */
export function presetName(p: Pick<SchoolPreset, "name" | "id">, locale: string): string {
	return p.name[locale] ?? p.name[locale.split("-")[0] ?? ""] ?? p.name.en ?? p.id;
}

/** A translation function (`#lib/i18n/server.js` `serverTranslator`). */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * The generic preset in the installation's language (9.41): its stage, levels, group word and
 * teachers group come from the dictionary (`setup.generic.*`); the other presets as they are.
 */
export function localizePreset(p: SchoolPreset, t: Translate | undefined): SchoolPreset {
	if (p.id !== "generic" || !t) {
		return p;
	}
	return {
		...p,
		school: {
			...p.school,
			stages: p.school.stages.map((st) => ({ ...st, name: t("setup.generic.stage") })),
			levels: p.school.levels.map((l) => ({
				...l,
				name: t("setup.generic.level", { level: l.label }),
			})),
			groupWord: t("setup.generic.groupWord"),
		},
		teacherGroup: t("setup.generic.teacherGroup"),
	};
}

/** The classes a preset makes: one per level and name of its stages, then its mixed groups. */
export function presetGroups(preset: SchoolPreset): { name: string; levels: string[] }[] {
	const out: { name: string; levels: string[] }[] = [];
	for (const level of preset.school.levels) {
		for (const name of preset.groups[level.stage] ?? []) {
			out.push({ name, levels: [level.code] });
		}
	}
	return [...out, ...preset.mixedGroups];
}
