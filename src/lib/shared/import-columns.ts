// SPDX-License-Identifier: GPL-3.0-or-later
// The columns of every import file (PLAN.md step 9.19, Q115, ADR-032): one catalogue per import
// with the English header of each column — the only accepted spelling, compared without case and
// with spaces or hyphens read as `_` — and its group: required, key (left out: generated or
// replaced by another way of matching, which the wizard says) or optional. The template download
// and the column mapping of the wizards read the same catalogue.

export type ColumnGroup = "required" | "key" | "optional";

export interface ImportColumn<F extends string = string> {
	/** The field of the import (camelCase, as the services name it). */
	field: F;
	/** The header in a file (snake_case). */
	header: string;
	group: ColumnGroup;
}

export interface ImportSpec<F extends string = string> {
	columns: readonly ImportColumn<F>[];
	/**
	 * Required fields given in one of several ways (students: `class`, or `level` + `section`):
	 * every field of one alternative must be there, and only one alternative.
	 */
	alternatives?: readonly (readonly F[])[];
}

export const STUDENT_FIELDS = [
	"firstName",
	"lastName",
	"class",
	"level",
	"section",
	"cardNumber",
	"externalId",
	"email",
] as const;
export type StudentField = (typeof STUDENT_FIELDS)[number];

export const STUDENT_IMPORT: ImportSpec<StudentField> = {
	columns: [
		{ field: "firstName", header: "first_name", group: "required" },
		{ field: "lastName", header: "last_name", group: "required" },
		{ field: "class", header: "class", group: "required" },
		{ field: "level", header: "level", group: "required" },
		{ field: "section", header: "section", group: "required" },
		{ field: "cardNumber", header: "card_number", group: "key" },
		{ field: "externalId", header: "external_id", group: "key" },
		{ field: "email", header: "email", group: "optional" },
	],
	alternatives: [["class"], ["level", "section"]],
};

export const TEACHER_FIELDS = [
	"firstName",
	"lastName",
	"cardNumber",
	"externalId",
	"email",
	"group",
] as const;
export type TeacherField = (typeof TEACHER_FIELDS)[number];

export const TEACHER_IMPORT: ImportSpec<TeacherField> = {
	columns: [
		{ field: "firstName", header: "first_name", group: "required" },
		{ field: "lastName", header: "last_name", group: "required" },
		{ field: "cardNumber", header: "card_number", group: "key" },
		{ field: "externalId", header: "external_id", group: "key" },
		{ field: "email", header: "email", group: "optional" },
		{ field: "group", header: "group", group: "optional" },
	],
};

export const CATALOG_FIELDS = [
	"title",
	"author",
	"publisher",
	"biblioKey",
	"barcode",
	"classification",
	"readingLevel",
	"isbn",
	"issn",
	"ean",
	"subtitle",
	"originalTitle",
	"responsibility",
	"publicationPlace",
	"publicationYear",
	"physicalDescription",
	"series",
	"seriesNumber",
	"dewey",
	"subjects",
	"notes",
	"callNumber",
	"itemType",
	"enumeration",
	"status",
	"notForLoan",
	"acquisitionDate",
	"itemNotes",
	"inventoryNumber",
	"origin",
	"value",
] as const;
export type CatalogField = (typeof CATALOG_FIELDS)[number];

const optional = <F extends string>(field: F, header: string): ImportColumn<F> => ({
	field,
	header,
	group: "optional",
});

export const CATALOG_IMPORT: ImportSpec<CatalogField> = {
	columns: [
		{ field: "title", header: "title", group: "required" },
		{ field: "author", header: "author", group: "required" },
		{ field: "publisher", header: "publisher", group: "required" },
		{ field: "biblioKey", header: "biblio_key", group: "key" },
		{ field: "barcode", header: "barcode", group: "key" },
		optional("classification", "classification"),
		optional("readingLevel", "reading_level"),
		optional("isbn", "isbn"),
		optional("issn", "issn"),
		optional("ean", "ean"),
		optional("subtitle", "subtitle"),
		optional("originalTitle", "original_title"),
		optional("responsibility", "responsibility"),
		optional("publicationPlace", "publication_place"),
		optional("publicationYear", "publication_year"),
		optional("physicalDescription", "physical_description"),
		optional("series", "series"),
		optional("seriesNumber", "series_number"),
		optional("dewey", "dewey"),
		optional("subjects", "subjects"),
		optional("notes", "notes"),
		optional("callNumber", "call_number"),
		optional("itemType", "item_type"),
		optional("enumeration", "enumeration"),
		optional("status", "status"),
		optional("notForLoan", "not_for_loan"),
		optional("acquisitionDate", "acquisition_date"),
		optional("itemNotes", "item_notes"),
		// the school inventory (9.64)
		optional("inventoryNumber", "inventory_number"),
		optional("origin", "origin"),
		optional("value", "value"),
	],
};

export const LOAN_FIELDS = ["cardNumber", "barcode", "issuedOn", "dueOn"] as const;
export type LoanField = (typeof LOAN_FIELDS)[number];

export const LOAN_IMPORT: ImportSpec<LoanField> = {
	columns: [
		{ field: "cardNumber", header: "card_number", group: "required" },
		{ field: "barcode", header: "barcode", group: "required" },
		{ field: "issuedOn", header: "issued_on", group: "optional" },
		{ field: "dueOn", header: "due_on", group: "optional" },
	],
};

/** A header cell in its compared form: `First name`, `FIRST-NAME` and `first_name` are one. */
export function headerKey(cell: string): string {
	return cell
		.replace(/^\uFEFF/, "")
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
}

/** The field a header cell names, or null (an ignored column: no aliases, Q115). */
export function fieldOfHeader<F extends string>(spec: ImportSpec<F>, cell: string): F | null {
	const key = headerKey(cell);
	return spec.columns.find((c) => c.header === key)?.field ?? null;
}

/**
 * The mapping of a first row read as a header: one field per cell (a field named twice feeds its
 * first column only), or null when the row is not a header — fewer than two known names, unless
 * every cell of a one-column row is one.
 */
export function headerMapping<F extends string>(
	spec: ImportSpec<F>,
	row: readonly string[],
): (F | null)[] | null {
	const fields = row.map((cell) => fieldOfHeader(spec, cell));
	const known = fields.filter((f) => f !== null).length;
	if (known < Math.min(2, row.length) || known === 0) {
		return null;
	}
	return fields.map((f, i) => (f !== null && fields.indexOf(f) === i ? f : null));
}

export interface MissingColumns<F extends string> {
	/** Required fields outside the alternatives that no column feeds. */
	fields: F[];
	/** The alternatives, when none of them is complete (empty otherwise). */
	alternatives: F[][];
}

/** What a mapping still lacks: the wizard enables "Controlla" only when nothing is missing. */
export function missingColumns<F extends string>(
	spec: ImportSpec<F>,
	mapping: readonly (F | null)[],
): MissingColumns<F> {
	const inAlternatives = new Set((spec.alternatives ?? []).flat());
	const fields = spec.columns
		.filter((c) => c.group === "required" && !inAlternatives.has(c.field))
		.map((c) => c.field)
		.filter((f) => !mapping.includes(f));
	const alternatives = spec.alternatives ?? [];
	const complete = alternatives.some((alt) => alt.every((f) => mapping.includes(f)));
	return {
		fields,
		alternatives: alternatives.length === 0 || complete ? [] : alternatives.map((a) => [...a]),
	};
}

export const isComplete = <F extends string>(m: MissingColumns<F>): boolean =>
	m.fields.length === 0 && m.alternatives.length === 0;

/** The columns of a template when the operator chose nothing: the required ones (first alternative). */
export function defaultTemplate<F extends string>(spec: ImportSpec<F>): string[] {
	const [first = [], ...rest] = spec.alternatives ?? [];
	const others = new Set<F>(rest.flat().filter((f) => !first.includes(f)));
	return spec.columns
		.filter((c) => c.group === "required" && !others.has(c.field))
		.map((c) => c.header);
}

/**
 * The header of a generated template: the chosen headers in the catalogue's order, or null when
 * the choice is not valid (an unknown header, a required column missing, two alternatives mixed).
 */
export function templateHeader<F extends string>(
	spec: ImportSpec<F>,
	chosen: readonly string[],
): string[] | null {
	const wanted = new Set(chosen.map(headerKey));
	const columns = spec.columns.filter((c) => wanted.has(c.header));
	if (columns.length !== wanted.size) {
		return null;
	}
	const fields = columns.map((c) => c.field);
	const alternatives = spec.alternatives ?? [];
	const used = alternatives.filter((alt) => alt.some((f) => fields.includes(f)));
	if (used.length > 1) {
		return null;
	}
	const missing = missingColumns(spec, fields);
	return isComplete(missing) ? columns.map((c) => c.header) : null;
}

/** The header of a field (for messages that name the missing columns). */
export function headerOf<F extends string>(spec: ImportSpec<F>, field: F): string {
	return spec.columns.find((c) => c.field === field)?.header ?? field;
}

/** The headers of some fields in the order given: an export writes the columns its import reads. */
export function headersOf<F extends string>(spec: ImportSpec<F>, fields: readonly F[]): string[] {
	return fields.map((f) => headerOf(spec, f));
}

/**
 * The missing required columns by their headers for the "mapping incomplete" message
 * (`last_name, class | level + section`), or null when nothing is missing.
 */
export function missingHeaders<F extends string>(
	spec: ImportSpec<F>,
	mapping: readonly (F | null)[],
): string | null {
	const missing = missingColumns(spec, mapping);
	if (isComplete(missing)) {
		return null;
	}
	const alternatives = missing.alternatives
		.map((alt) => alt.map((f) => headerOf(spec, f)).join(" + "))
		.join(" | ");
	return [
		...missing.fields.map((f) => headerOf(spec, f)),
		...(alternatives ? [alternatives] : []),
	].join(", ");
}
