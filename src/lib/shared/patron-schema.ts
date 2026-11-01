// SPDX-License-Identifier: GPL-3.0-or-later
// Patron form input (PLAN.md step 2.1). Values arrive as strings from the form; the service turns
// them into typed data and applies the rules that depend on the configuration (levels) and on the
// classes of the database (groups, Phase 12).
import * as v from "valibot";
import { configCodeOrEmpty, levelCodeOrEmpty, textId } from "#lib/shared/input-schemas.js";

const optionalText = (
	max: number,
): v.OptionalSchema<
	v.SchemaWithPipe<
		readonly [
			v.StringSchema<undefined>,
			v.TrimAction,
			v.MaxLengthAction<string, number, undefined>,
		]
	>,
	""
> => v.optional(v.pipe(v.string(), v.trim(), v.maxLength(max)), "");

export const PATRON_TYPE_VALUES = ["student", "teacher"] as const;
export type PatronType = (typeof PATRON_TYPE_VALUES)[number];

export const patronFormSchema = v.object({
	patronType: v.picklist(PATRON_TYPE_VALUES),
	firstName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
	lastName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
	/** The pupil's level: a code of `school.levels` (`''` for teachers). */
	levelCode: optionalText(8),
	/** The class (a students group hosting the level) or the teachers group: its id, or `''`. */
	groupId: v.optional(v.pipe(v.string(), v.regex(/^\d{0,9}$/)), ""),
	/** The class by its name when no id is given (the register import: `level;section`). */
	groupName: optionalText(40),
	cardNumber: optionalText(20),
	externalId: optionalText(40),
	email: optionalText(120),
	circulationNote: optionalText(500),
	notes: optionalText(2000),
});

export type PatronFormInput = v.InferOutput<typeof patronFormSchema>;

export const patronEditSchema = v.object({
	id: textId,
	...patronFormSchema.entries,
});

export const PATRON_SORTS = ["name", "class", "card", "status"] as const;

export const patronFiltersSchema = v.object({
	q: v.optional(v.pipe(v.string(), v.maxLength(80)), ""),
	patronType: v.optional(v.union([v.picklist(PATRON_TYPE_VALUES), v.literal("")]), ""),
	levelCode: v.optional(levelCodeOrEmpty, ""),
	groupId: v.optional(v.pipe(v.string(), v.regex(/^\d{0,9}$/)), ""),
	/** A stage of the school (a comprensivo: infanzia, primaria, secondaria; 12.9). */
	stage: v.optional(configCodeOrEmpty, ""),
	status: v.optional(v.union([v.picklist(["active", "anonymized"]), v.literal("")]), ""),
	sort: v.optional(v.picklist(PATRON_SORTS), "name"),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2000)), 500),
	offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
});

export type PatronFilters = v.InferOutput<typeof patronFiltersSchema>;
