// SPDX-License-Identifier: GPL-3.0-or-later
// Helpers of the generated settings forms (step 11.2): the checks shown inline before anything is
// sent (the server validates again with the configuration schema) and how values are compared
// and shown.
import type { getConfigSection } from "#lib/remote/config.remote.js";

export type SectionData = Awaited<ReturnType<typeof getConfigSection>>;
export type SettingField = SectionData["fields"][number];

export type FieldProblem = "required" | "pattern" | "number" | "range";

/** The inline problem of a value, or null. */
export function fieldProblem(field: SettingField, value: unknown): FieldProblem | null {
	if (value === null || value === undefined || value === "") {
		// an optional key left empty goes back to its default (see `settingsPatch`)
		if (field.nullable || field.optional || field.kind === "lines") {
			return null;
		}
		return field.kind === "text" && !field.pattern && !field.minLength ? null : "required";
	}
	if (field.kind === "integer" || field.kind === "number") {
		if (typeof value !== "number" || Number.isNaN(value)) {
			return "number";
		}
		if (field.kind === "integer" && !Number.isInteger(value)) {
			return "number";
		}
		if (
			(field.min !== undefined && value < field.min) ||
			(field.max !== undefined && value > field.max)
		) {
			return "range";
		}
		return null;
	}
	if (field.pattern) {
		const re = new RegExp(field.pattern);
		const values = Array.isArray(value) ? value : [value];
		if (values.some((v) => typeof v !== "string" || !re.test(v))) {
			return "pattern";
		}
	}
	return null;
}

export const sameValue = (a: unknown, b: unknown): boolean =>
	JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The parent key of a field (`circulation.rules.student`), or the section itself. */
export const groupOf = (path: string): string => path.split(".").slice(0, -1).join(".");

/**
 * The patch of a form: changed values to set, and the keys to take out of the file (asked with
 * "Torna al predefinito", or optional keys left empty).
 */
export function settingsPatch(
	fields: readonly SettingField[],
	values: Readonly<Record<string, unknown>>,
	resets: ReadonlySet<string>,
): { set: Record<string, unknown>; reset: string[] } {
	const set: Record<string, unknown> = {};
	const reset: string[] = [];
	for (const field of fields) {
		const value = values[field.path];
		const empty = value === "" || (value === null && !field.nullable);
		if (resets.has(field.path) || (field.optional && empty)) {
			if (field.defined) {
				reset.push(field.path);
			}
		} else if (!sameValue(value, field.value)) {
			set[field.path] = value;
		}
	}
	return { set, reset };
}
