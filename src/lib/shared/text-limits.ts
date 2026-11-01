// SPDX-License-Identifier: GPL-3.0-or-later
// The length caps of the text fields read from the Valibot schemas of the forms, so that the
// paths that do not go through a form (the CSV imports) apply the same caps without a second
// copy of the numbers.
import type * as v from "valibot";

interface Inspectable {
	type: string;
	wrapped?: Inspectable;
	pipe?: readonly { type: string; requirement?: unknown }[];
}

/** The `maxLength` of a string schema (plain, piped, optional or nullable); null without one. */
export function maxLengthOf(schema: v.GenericSchema): number | null {
	let s = schema as unknown as Inspectable;
	while (s.wrapped) {
		s = s.wrapped;
	}
	const action = s.pipe?.find((a) => a.type === "max_length");
	return typeof action?.requirement === "number" ? action.requirement : null;
}

/** The caps of several fields, keyed like the schemas given; fields without a cap are left out. */
export function maxLengths<F extends string>(
	schemas: Readonly<Partial<Record<F, v.GenericSchema>>>,
): Partial<Record<F, number>> {
	const out: Partial<Record<F, number>> = {};
	for (const [field, schema] of Object.entries(schemas) as [F, v.GenericSchema][]) {
		const max = maxLengthOf(schema);
		if (max !== null) {
			out[field] = max;
		}
	}
	return out;
}
