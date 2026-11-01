// SPDX-License-Identifier: GPL-3.0-or-later
// The configuration schema described for the editors (PLAN.md step 11.2): every leaf key with the
// input a generated form can offer for it — text, number, yes/no, a choice, a list — or none when
// the key sits in a list of objects, a map or an optional group (those need a dedicated editor).
// Read from the Valibot schema itself, so a new key shows up here (and in the coverage map test)
// without being listed by hand.
import type { GenericSchema } from "valibot";
import { configSchema } from "./schema.js";

export type FieldKind =
	| "text"
	| "email"
	| "date"
	| "integer"
	| "number"
	| "boolean"
	| "choice"
	| "choices"
	| "lines"
	| "fixed";

/** What a generated form needs to edit one key. */
export interface FieldSpec {
	/** Dotted key path, e.g. `circulation.rules.student.loanDays`. */
	path: string;
	kind: FieldKind;
	/** `choice` and `choices`. */
	options?: string[];
	min?: number;
	max?: number;
	/** Regular expression source the text (or each line) must match. */
	pattern?: string;
	minLength?: number;
	maxLength?: number;
	/** `null` is a value: "automatic" or "none". */
	nullable: boolean;
	/** The key may be left out: the default applies. */
	optional: boolean;
	default?: unknown;
	/** The only value a `fixed` key accepts. */
	fixed?: unknown;
}

export interface SchemaLeaf {
	/** Dotted path; `[]` marks the items of a list, `*` the entries of a map. */
	path: string;
	/** Null when no generated form can edit it (inside a list, a map or an optional group). */
	field: FieldSpec | null;
}

interface Node {
	type: string;
	wrapped?: Node;
	default?: unknown;
	pipe?: Node[];
	entries?: Record<string, Node>;
	item?: Node;
	value?: Node;
	options?: unknown[];
	literal?: unknown;
	kind?: string;
	requirement?: unknown;
}

function unwrap(schema: Node): {
	inner: Node;
	optional: boolean;
	nullable: boolean;
	default?: unknown;
} {
	let inner = schema;
	let optional = false;
	let nullable = false;
	let fallback: unknown;
	while ((inner.type === "optional" || inner.type === "nullable") && inner.wrapped) {
		if (inner.type === "optional") {
			optional = true;
		} else {
			nullable = true;
		}
		if (inner.default !== undefined && fallback === undefined) {
			fallback = typeof inner.default === "function" ? undefined : inner.default;
		}
		inner = inner.wrapped;
	}
	return { inner, optional, nullable, default: fallback };
}

const actions = (schema: Node): Node[] => (schema.pipe ?? []).slice(1);
const action = (schema: Node, type: string): Node | undefined =>
	actions(schema).find((a) => a.type === type);
const numeric = (a: Node | undefined): number | undefined =>
	typeof a?.requirement === "number" ? a.requirement : undefined;
const pattern = (schema: Node): string | undefined => {
	const r = action(schema, "regex")?.requirement;
	return r instanceof RegExp ? r.source : undefined;
};

/** The input for a leaf schema, or null when it is not a simple value. */
function fieldOf(path: string, schema: Node): FieldSpec | null {
	const { inner, optional, nullable, default: fallback } = unwrap(schema);
	const base = { path, nullable, optional, default: fallback };
	switch (inner.type) {
		case "string": {
			const choice = actions(inner).find((a) => a.type === "picklist");
			if (choice) {
				return { ...base, kind: "choice", options: (choice.options ?? []).map(String) };
			}
			if (action(inner, "iso_date")) {
				return { ...base, kind: "date" };
			}
			if (action(inner, "email")) {
				return { ...base, kind: "email" };
			}
			return {
				...base,
				kind: "text",
				pattern: pattern(inner),
				minLength: numeric(action(inner, "min_length")),
				maxLength: numeric(action(inner, "max_length")),
			};
		}
		case "number":
			return {
				...base,
				kind: action(inner, "integer") ? "integer" : "number",
				min: numeric(action(inner, "min_value")),
				max: numeric(action(inner, "max_value")),
			};
		case "boolean":
			return { ...base, kind: "boolean" };
		case "picklist":
			return { ...base, kind: "choice", options: (inner.options ?? []).map(String) };
		case "literal":
			return { ...base, kind: "fixed", fixed: inner.literal };
		case "array": {
			const item = inner.item ? unwrap(inner.item).inner : null;
			if (item?.type === "picklist") {
				return { ...base, kind: "choices", options: (item.options ?? []).map(String) };
			}
			if (item?.type === "string" && !actions(item).some((a) => a.kind === "schema")) {
				return { ...base, kind: "lines", pattern: pattern(item) };
			}
			return null;
		}
		default:
			return null;
	}
}

function walk(path: string, schema: Node, simple: boolean, out: SchemaLeaf[]): void {
	const { inner, nullable } = unwrap(schema);
	if (inner.type === "object" && inner.entries) {
		// a group that can be null (e.g. `cards.sheet.cutLines`) needs its own editor
		const stillSimple = simple && !nullable;
		for (const [key, entry] of Object.entries(inner.entries)) {
			walk(path ? `${path}.${key}` : key, entry, stillSimple, out);
		}
		return;
	}
	if (inner.type === "array" && inner.item && unwrap(inner.item).inner.type === "object") {
		walk(`${path}[]`, inner.item, false, out);
		return;
	}
	if (inner.type === "record" && inner.value) {
		walk(`${path}.*`, inner.value, false, out);
		return;
	}
	out.push({ path, field: simple ? fieldOf(path, schema) : null });
}

/** Every leaf key of the configuration schema, in schema order. */
export function schemaLeaves(schema: GenericSchema = configSchema): SchemaLeaf[] {
	const out: SchemaLeaf[] = [];
	walk("", schema, true, out);
	return out;
}

/** The top-level sections, in schema order. */
export function schemaSections(schema: GenericSchema = configSchema): string[] {
	return Object.keys((schema as unknown as Node).entries ?? {});
}
