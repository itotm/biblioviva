// SPDX-License-Identifier: GPL-3.0-or-later
// The structure of the school (PLAN.md Phase 12, Q94–Q100): the ordered levels of the
// configuration (`school.levels`, grouped in stages), the classes as groups of the database
// (`class_group`), and what every screen needs from them — the class label built with the
// configured template, the order of the classes, the level of the next school year. One module, so
// that "3 B" reads the same on the desk, the cards, the notices, the exports and the reports.

import { collatorFor } from "./collation.js";

export interface SchoolStage {
	code: string;
	name: string;
	/**
	 * The class label of this stage's levels when it differs from `school.classLabel` (9.41); it may
	 * leave out `{group}`: the label is then the level alone (the German Oberstufe's `Q1`).
	 */
	classLabel?: string;
}

/** What follows a level: one level, `null` (the pupil leaves), or choices for a path that splits. */
export type NextLevel = string | null | (string | null)[];

export interface SchoolLevel {
	/** Stable code stored on the patrons (`3`, `P3`, `CM1`, `Y7`). */
	code: string;
	/** Short label in the class label (`3`, `CM1`, `Year 7`, `III`). */
	label: string;
	/** Full name (`Terza primaria`). */
	name: string;
	stage: string;
	/**
	 * The level of the next school year; `null` = the pupil leaves; absent = the following one; a
	 * list of choices (level codes, `null` = leaves) where the path splits, the first the default
	 * (9.41: the Dutch brugklas into vmbo, havo or vwo).
	 */
	next?: NextLevel;
	/** Other ways the register files write the level (`V` for `a V-a`, `三` for `3`; 9.41). */
	aliases?: string[];
}

export interface SchoolStructure {
	stages: SchoolStage[];
	levels: SchoolLevel[];
	/** Template of the class label: `{level}` and `{group}` (default `{level} {group}` → `3 B`). */
	classLabel: string;
	/** The name of the group field in the forms and filters, `{word}` of the card line (`Sezione`). */
	groupWord: string;
	/**
	 * The class line printed on the card (9.41): `{word}`, `{group}`, `{level}` and `{class}` (the
	 * class label); default `{word} {group}` → `Sezione B`.
	 */
	cardClass: string;
	/** The installation's language: the order of the names of classes (9.41; Italian if absent). */
	locale?: string;
	promotion: {
		/** Within a stage the group advances with its pupils, or the pupils are left without one. */
		withinStage: "keep" | "clear";
		/** Into another stage (5ª primaria → 1ª secondaria): keep, clear, or ask the operator. */
		acrossStages: "keep" | "clear" | "ask";
	};
}

export const GROUP_KIND_VALUES = ["students", "teachers"] as const;
export type GroupKind = (typeof GROUP_KIND_VALUES)[number];

/** A class (or a teachers group) as the screens see it. */
export interface ClassGroupInfo {
	id: number;
	kind: GroupKind;
	name: string;
	/** Codes of the levels a students group hosts, in the order of the scale. */
	levels: string[];
	stage: string | null;
	archived: boolean;
}

export const DEFAULT_CLASS_LABEL = "{level} {group}";
export const DEFAULT_CARD_CLASS = "{word} {group}";

/** The index of a level in the scale (-1 when the scale no longer has it). */
export function levelPosition(
	school: Pick<SchoolStructure, "levels">,
	code: string | null,
): number {
	return code === null ? -1 : school.levels.findIndex((l) => l.code === code);
}

export function levelOf(
	school: Pick<SchoolStructure, "levels">,
	code: string | null,
): SchoolLevel | null {
	return code === null ? null : (school.levels.find((l) => l.code === code) ?? null);
}

/** The level of the next school year, or null when the pupil leaves the school. */
export function nextLevel(school: Pick<SchoolStructure, "levels">, code: string): string | null {
	const i = levelPosition(school, code);
	const level = school.levels[i];
	if (!level) {
		return null;
	}
	if (level.next !== undefined) {
		return Array.isArray(level.next) ? (level.next[0] ?? null) : level.next;
	}
	return school.levels[i + 1]?.code ?? null;
}

/**
 * The choices after a level (9.41): one entry where the path does not split (the next level, or
 * `null` when the pupil leaves), every choice in order where it does, the default first.
 */
export function nextChoices(
	school: Pick<SchoolStructure, "levels">,
	code: string,
): (string | null)[] {
	const next = levelOf(school, code)?.next;
	return Array.isArray(next) ? [...next] : [nextLevel(school, code)];
}

/** The class label template of a level: its stage's, or the school's (9.41). */
export function templateOf(
	school: Pick<SchoolStructure, "levels" | "classLabel"> & {
		stages?: readonly SchoolStage[];
	},
	code: string | null,
): string {
	const stage = levelOf(school, code)?.stage;
	return school.stages?.find((st) => st.code === stage)?.classLabel || school.classLabel;
}

/**
 * The class label: the template with the level's label and the group's name (`3 B`); a teachers
 * group, or a group without a level, is its name alone; nothing without a group.
 */
export function classLabel(
	school: LabelSchool,
	group: { name: string; kind: GroupKind } | null,
	levelCode: string | null,
): string {
	if (!group) {
		return "";
	}
	const level = group.kind === "students" ? levelOf(school, levelCode) : null;
	return level ? render(templateOf(school, level.code), level.label, group.name) : group.name;
}

/** What the class labels need: the levels, the template, the stages' own templates. */
export type LabelSchool = Pick<SchoolStructure, "levels" | "classLabel"> & {
	stages?: readonly SchoolStage[];
};

function render(template: string, level: string, group: string): string {
	return (template || DEFAULT_CLASS_LABEL)
		.replaceAll("{level}", level)
		.replaceAll("{group}", group)
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The class line of the card (9.41): `school.cardClass` filled in (`{word} {group}` → `Sezione B`);
 * `{class}` is the class label. A teachers group prints its name instead (`card-templates.ts`).
 */
export function renderCardClass(
	template: string,
	parts: { word: string; group: string; level: string; class: string },
): string {
	return (template || DEFAULT_CARD_CLASS)
		.replaceAll("{word}", parts.word)
		.replaceAll("{group}", parts.group)
		.replaceAll("{level}", parts.level)
		.replaceAll("{class}", parts.class)
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The label of a group as a choice: every level it hosts (`1-2 A` for a pluriclasse); a group
 * hosting every level of its stage (an infanzia section of mixed ages) is its name alone.
 */
export function groupLabel(
	school: LabelSchool,
	group: Pick<ClassGroupInfo, "kind" | "name" | "levels">,
): string {
	if (group.kind === "teachers" || group.levels.length === 0) {
		return group.name;
	}
	if (group.levels.length === 1) {
		return classLabel(school, group, group.levels[0] ?? null);
	}
	const stage = levelOf(school, group.levels[0] ?? null)?.stage;
	const ofStage = school.levels.filter((l) => l.stage === stage).map((l) => l.code);
	if (ofStage.every((code) => group.levels.includes(code))) {
		return group.name;
	}
	const labels = group.levels.map((code) => levelOf(school, code)?.label ?? code);
	return render(templateOf(school, group.levels[0] ?? null), labels.join("-"), group.name);
}

/** A class as its order sees it: the kind of group, the position of its level, its name or label. */
export interface ClassOrderKey {
	kind: GroupKind | null;
	position: number;
	name: string | null;
}

/**
 * The order of the classes: students by level, then by name; those without a class after them;
 * the teachers groups last.
 */
export function compareClassKeys(a: ClassOrderKey, b: ClassOrderKey, locale?: string): number {
	const rank = (x: ClassOrderKey): number =>
		x.kind === "students" ? 0 : x.kind === "teachers" ? 2 : 1;
	return (
		rank(a) - rank(b) ||
		a.position - b.position ||
		collatorFor(locale).compare(a.name ?? "", b.name ?? "")
	);
}

/** Order of the classes: students by level, then by group name; teachers groups after them. */
export function compareClass(
	school: Pick<SchoolStructure, "levels" | "locale">,
	a: { kind: GroupKind | null; levelCode: string | null; groupName: string | null },
	b: { kind: GroupKind | null; levelCode: string | null; groupName: string | null },
): number {
	const key = (x: typeof a): ClassOrderKey => ({
		kind: x.kind,
		position: levelPosition(school, x.levelCode),
		name: x.groupName,
	});
	return compareClassKeys(key(a), key(b), school.locale);
}

/** Order of the groups as choices: students groups by their first level and name, then teachers. */
export function compareGroups(
	school: Pick<SchoolStructure, "levels" | "locale">,
	a: Pick<ClassGroupInfo, "kind" | "name" | "levels">,
	b: Pick<ClassGroupInfo, "kind" | "name" | "levels">,
): number {
	return compareClass(
		school,
		{ kind: a.kind, levelCode: a.levels[0] ?? null, groupName: a.name },
		{ kind: b.kind, levelCode: b.levels[0] ?? null, groupName: b.name },
	);
}

/**
 * A text as the register files may write it (9.41): compatibility forms folded (NFKC: the
 * full-width digits of Japanese, Chinese and Korean registers), accents, ordinal marks, dots,
 * quotes and the Greek keraia left out, any case.
 */
const MARKS = /[ªº°^.«»"'“”„‘’‚΄ʹ]/g;
const fold = (s: string): string =>
	s
		// the ordinal marks first (NFKC would make `4ª` read `4a`), and again after it (the
		// full-width dot of a Japanese register becomes a dot)
		.replace(MARKS, "")
		.normalize("NFKC")
		.replace(MARKS, "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();

/** The ways a level can be written: its code, label, name and aliases. */
const namesOf = (l: SchoolLevel): string[] => [l.code, l.label, l.name, ...(l.aliases ?? [])];

/**
 * The level a register cell names: its code, label, name or one of its aliases, any case, with or
 * without `ª`, `º`, `°`, `^`, a dot or quotes (`3`, `3ª`, `terza primaria`, `P3`, `３`); null when
 * nothing matches, or when the text names two years (a label repeated across stages, 9.41: `一`
 * of 初中 and of 高中), so the import asks rather than guesses.
 */
export function findLevel(
	school: Pick<SchoolStructure, "levels">,
	text: string,
): SchoolLevel | null {
	const wanted = fold(text);
	if (wanted === "") {
		return null;
	}
	const ways: ((l: SchoolLevel) => string[])[] = [
		(l) => [l.code],
		(l) => [l.label],
		(l) => [l.name],
		(l) => l.aliases ?? [],
	];
	for (const way of ways) {
		const found = school.levels.filter((l) => way(l).some((n) => fold(n) === wanted));
		if (found.length > 0) {
			return found.length === 1 ? (found[0] ?? null) : null;
		}
	}
	return null;
}

/** Folded, without spaces and without `-` or `/` between the year and the group (`5-A`, `9/B`). */
const squash = (s: string): string => fold(s).replace(/[\s\-/]+/g, "");

type ClassGroupRef = Pick<ClassGroupInfo, "id" | "kind" | "name" | "levels" | "archived">;

/**
 * The class a register cell names in one piece (`3A`, `3 A`, `3ª A`, `terza primaria A`; step
 * 9.19, Q115): matched against the labels of the active classes — the class label of every group
 * and level, and the level's code, label or name followed by the group's name — ignoring case,
 * spaces and ordinal marks. Null when nothing matches, or when two classes would.
 */
export function findClass(
	school: LabelSchool,
	groups: readonly ClassGroupRef[],
	text: string,
): { groupId: number; levelCode: string } | null {
	const wanted = squash(text);
	if (wanted === "") {
		return null;
	}
	const found = new Map<string, { groupId: number; levelCode: string }>();
	for (const group of groups) {
		if (group.kind !== "students" || group.archived) {
			continue;
		}
		for (const code of group.levels) {
			const level = levelOf(school, code);
			const names = [
				classLabel(school, group, code),
				...(level ? namesOf(level) : [code]).map((l) => `${l} ${group.name}`),
			];
			if (names.some((n) => squash(n) === wanted)) {
				found.set(`${group.id}:${code}`, { groupId: group.id, levelCode: code });
			}
		}
	}
	return found.size === 1 ? ([...found.values()][0] ?? null) : null;
}

/**
 * The labels of the active classes (`1 A`, `1 B`, … in the order of the classes), of one level
 * when given: what an import error lists when a class is not found.
 */
export function classLabels(
	school: LabelSchool & Pick<SchoolStructure, "locale">,
	groups: readonly ClassGroupRef[],
	levelCode: string | null = null,
): string[] {
	const out: { label: string; position: number; name: string }[] = [];
	for (const group of groups) {
		if (group.kind !== "students" || group.archived) {
			continue;
		}
		for (const code of group.levels) {
			if (levelCode === null || code === levelCode) {
				out.push({
					label: classLabel(school, group, code),
					position: levelPosition(school, code),
					name: group.name,
				});
			}
		}
	}
	return out
		.sort(
			(a, b) => a.position - b.position || collatorFor(school.locale).compare(a.name, b.name),
		)
		.map((c) => c.label);
}

/** Problems of a school structure (the configuration validates them, the editor shows them). */
export function structureProblems(
	school: Pick<SchoolStructure, "stages" | "levels"> & { classLabel?: string },
): string[] {
	const problems: string[] = [];
	const stages = new Set(school.stages.map((s) => s.code));
	if (stages.size !== school.stages.length) {
		problems.push("stage codes must be unique");
	}
	const codes = school.levels.map((l) => l.code);
	if (new Set(codes).size !== codes.length) {
		problems.push("level codes must be unique");
	}
	// two levels of the same template printed alike would make "1 A" mean two classes; across
	// stages with templates of their own a label may repeat (中{level}年 and 高{level}年 around 1)
	const printed = school.levels.map(
		(l) =>
			`${templateOf({ ...school, classLabel: school.classLabel ?? "" }, l.code)}\u0000${fold(l.label)}`,
	);
	if (new Set(printed).size !== printed.length) {
		problems.push("level labels must be unique");
	}
	for (const l of school.levels) {
		if (!stages.has(l.stage)) {
			problems.push(`level "${l.code}": unknown stage "${l.stage}"`);
		}
		const choices = Array.isArray(l.next) ? l.next : l.next === undefined ? [] : [l.next];
		if (Array.isArray(l.next) && l.next.length < 2) {
			problems.push(`level "${l.code}": a list of next levels needs two choices at least`);
		}
		if (Array.isArray(l.next) && new Set(l.next).size !== l.next.length) {
			problems.push(`level "${l.code}": a next level is listed twice`);
		}
		for (const next of choices) {
			if (next !== null && !codes.includes(next)) {
				problems.push(`level "${l.code}": unknown next level "${next}"`);
			}
		}
	}
	// promotion must end: every path from any level, through every choice, leaves the school
	const state = new Map<string, "open" | "done">();
	const loops = (code: string): boolean => {
		if (state.get(code) === "done") {
			return false;
		}
		if (state.get(code) === "open") {
			return true;
		}
		state.set(code, "open");
		const found = nextChoices(school, code).some(
			(next) => next !== null && codes.includes(next) && loops(next),
		);
		state.set(code, "done");
		return found;
	};
	const circle = school.levels.find((l) => loops(l.code));
	if (circle) {
		problems.push(`level "${circle.code}": the next levels go round in a circle`);
	}
	return problems;
}
