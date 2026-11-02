// SPDX-License-Identifier: GPL-3.0-or-later
// The catalogue of the guided reports (PLAN.md step 9.20, Q116): for each source the tables it
// reads, the dimensions (rows or columns of a report), the measures and the filters, each as a
// fixed SQL fragment. Loans read the class snapshots of the loan (history, Q95), copies and
// patrons the live data. A guided report can only combine these fragments: the SQL it compiles to
// is as safe as the fragments, and it still goes through the checks of `safety.ts`.
import type { QuerySource } from "./spec.js";

/** Texts of the catalogue, in the languages of the built-in reports. */
export interface Words {
	it: string;
	en: string;
}

/** Column types (see `definition.ts`): values, or codes shown as words. */
export type BuilderColumnType =
	| "int"
	| "number"
	| "text"
	| "classification"
	| "patronType"
	| "itemType"
	| "itemStatus"
	| "weekday"
	| "level"
	| "stage"
	| "kind"
	| "month"
	| "decade";

export interface Dimension {
	key: string;
	label: Words;
	type: BuilderColumnType;
	/** The value of a row (codes; `@teachers`, `@unclassified` for the special rows). */
	expr: string;
	/** The order of the values (the expression itself when absent). */
	order?: string;
}

export interface Measure {
	key: string;
	label: Words;
	type: "int" | "number";
	expr: string;
}

/** How an asked filter appears in the form, and how a value constrains the rows. */
export type FilterKind =
	| { kind: "period"; column: string }
	| { kind: "code"; param: "patronType" | "level" | "stage" | "itemType"; column: string }
	| { kind: "group"; column: string }
	| { kind: "choice"; options: { value: string; label: Words }[]; condition: string };

export interface Filter {
	key: string;
	label: Words;
	def: FilterKind;
}

export interface Source {
	label: Words;
	from: string;
	/** Conditions every row meets (active patrons, copies not withdrawn). */
	where: string[];
	dimensions: Dimension[];
	measures: Measure[];
	filters: Filter[];
}

const W = (it: string, en: string): Words => ({ it, en });

const TEACHERS_LAST = 9999;

const kindChoice: FilterKind = {
	kind: "choice",
	options: [
		{ value: "fiction", label: W("Narrativa", "Fiction") },
		{ value: "nonfiction", label: W("Saggistica", "Non-fiction") },
		{ value: "unclassified", label: W("Da classificare", "To classify") },
	],
	// `:value` is replaced by the bound parameter or the fixed literal
	condition:
		"((:value = 'unclassified' AND b.kind IS NULL) OR (:value <> 'unclassified' AND b.kind = :value))",
};

const classification = (book: string, item: string): Dimension[] => [
	{
		key: "classification",
		label: W("Genere o argomento", "Genre or subject"),
		type: "classification",
		expr: `COALESCE(${book}.genre_code, ${book}.class_code, '@unclassified')`,
		order: `CASE WHEN ${book}.kind IS NULL THEN 2 WHEN ${book}.kind = 'fiction' THEN 0 ELSE 1 END`,
	},
	{
		key: "kind",
		label: W("Narrativa o saggistica", "Fiction or non-fiction"),
		type: "kind",
		expr: `COALESCE(${book}.kind, '@unclassified')`,
		order: `CASE WHEN ${book}.kind IS NULL THEN 2 WHEN ${book}.kind = 'fiction' THEN 0 ELSE 1 END`,
	},
	{
		key: "readingLevel",
		label: W("Livello di lettura", "Reading level"),
		type: "text",
		// the label of the scale (`classification.readingLevels`, mirrored in `reading_level`)
		expr: `COALESCE((SELECT rl.label FROM reading_level rl WHERE rl.code = COALESCE(${item}.reading_level, ${book}.reading_level)), COALESCE(${item}.reading_level, ${book}.reading_level))`,
		order: `COALESCE((SELECT rl.position FROM reading_level rl WHERE rl.code = COALESCE(${item}.reading_level, ${book}.reading_level)), ${TEACHERS_LAST})`,
	},
	{
		key: "itemType",
		label: W("Materiale", "Material"),
		type: "itemType",
		// the record's (9.45)
		expr: `${book}.item_type`,
	},
];

export const SOURCES: Record<QuerySource, Source> = {
	loans: {
		label: W("Prestiti", "Loans"),
		from: "loan l JOIN item i ON i.id = l.item_id JOIN biblio b ON b.id = i.biblio_id",
		where: [],
		dimensions: [
			{
				key: "classYear",
				label: W("Classe (anno)", "Class (year)"),
				type: "level",
				expr: "CASE WHEN l.patron_type_snapshot = 'teacher' THEN '@teachers' ELSE l.level_snapshot END",
				order: `CASE WHEN l.patron_type_snapshot = 'teacher' THEN ${TEACHERS_LAST} ELSE COALESCE(l.level_position_snapshot, ${TEACHERS_LAST - 1}) END`,
			},
			{
				key: "section",
				label: W("Sezione", "Section"),
				type: "text",
				// teachers have no section: in a class year × section table they count in the totals
				expr: "CASE WHEN l.patron_type_snapshot = 'student' THEN l.group_snapshot END",
			},
			{
				key: "class",
				label: W("Classe", "Class"),
				type: "text",
				expr: "l.class_label_snapshot",
				order: `CASE WHEN l.patron_type_snapshot = 'teacher' THEN ${TEACHERS_LAST} ELSE COALESCE(l.level_position_snapshot, ${TEACHERS_LAST - 1}) END`,
			},
			{
				key: "stage",
				label: W("Ordine di scuola", "Stage"),
				type: "stage",
				expr: "l.stage_snapshot",
			},
			{
				key: "patronType",
				label: W("Tipo di utente", "Patron type"),
				type: "patronType",
				expr: "l.patron_type_snapshot",
			},
			{
				key: "month",
				label: W("Mese", "Month"),
				type: "month",
				expr: "strftime('%Y-%m', l.issued_at)",
			},
			{
				key: "weekday",
				label: W("Giorno della settimana", "Weekday"),
				type: "weekday",
				expr: "CAST(strftime('%w', l.issued_at) AS INTEGER)",
				order: "(CAST(strftime('%w', l.issued_at) AS INTEGER) + 6) % 7",
			},
			{
				key: "schoolYear",
				label: W("Anno scolastico", "School year"),
				type: "text",
				// named as the installation names it (9.41: `2026` where the year is its start)
				expr: "CASE (SELECT value FROM school_setting WHERE key = 'school_year_label') WHEN 'start' THEN substr(l.school_year, 1, 4) ELSE l.school_year END",
			},
			...classification("b", "i"),
		],
		measures: [
			{ key: "loans", label: W("Prestiti", "Loans"), type: "int", expr: "COUNT(*)" },
			{
				key: "readers",
				label: W("Lettori", "Readers"),
				type: "int",
				expr: "COUNT(DISTINCT l.patron_id)",
			},
			{
				key: "titles",
				label: W("Titoli", "Titles"),
				type: "int",
				expr: "COUNT(DISTINCT i.biblio_id)",
			},
			{
				key: "avgDays",
				label: W("Giorni in media", "Average days"),
				type: "number",
				expr: "ROUND(AVG(julianday(COALESCE(date(l.returned_at), :today)) - julianday(date(l.issued_at))), 1)",
			},
		],
		filters: [
			{
				key: "period",
				label: W("Periodo del prestito", "Loan period"),
				def: { kind: "period", column: "date(l.issued_at)" },
			},
			{
				key: "patronType",
				label: W("Tipo di utente", "Patron type"),
				def: { kind: "code", param: "patronType", column: "l.patron_type_snapshot" },
			},
			{
				key: "stage",
				label: W("Ordine di scuola", "Stage"),
				def: { kind: "code", param: "stage", column: "l.stage_snapshot" },
			},
			{
				key: "level",
				label: W("Classe (anno)", "Class (year)"),
				def: { kind: "code", param: "level", column: "l.level_snapshot" },
			},
			{
				key: "group",
				label: W("Classe", "Class"),
				def: { kind: "group", column: "l.group_id_snapshot" },
			},
			{
				key: "itemType",
				label: W("Materiale", "Material"),
				def: { kind: "code", param: "itemType", column: "b.item_type" },
			},
			{
				key: "kind",
				label: W("Narrativa o saggistica", "Fiction or non-fiction"),
				def: kindChoice,
			},
		],
	},
	items: {
		label: W("Copie", "Copies"),
		from: "item i JOIN biblio b ON b.id = i.biblio_id",
		where: ["i.status <> 'withdrawn'"],
		dimensions: [
			...classification("b", "i"),
			{
				key: "status",
				label: W("Stato", "Status"),
				type: "itemStatus",
				expr: "i.status",
			},
			{
				key: "acquisitionYear",
				label: W("Anno di acquisizione", "Acquisition year"),
				type: "text",
				expr: "substr(i.acquisition_date, 1, 4)",
			},
			{
				key: "decade",
				label: W("Decennio di pubblicazione", "Decade of publication"),
				type: "decade",
				expr: "(b.publication_year / 10) * 10",
				order: `COALESCE((b.publication_year / 10) * 10, ${TEACHERS_LAST})`,
			},
		],
		measures: [
			{ key: "copies", label: W("Copie", "Copies"), type: "int", expr: "COUNT(*)" },
			{
				key: "titles",
				label: W("Titoli", "Titles"),
				type: "int",
				expr: "COUNT(DISTINCT i.biblio_id)",
			},
		],
		filters: [
			{
				key: "period",
				label: W("Periodo di acquisizione", "Acquisition period"),
				def: { kind: "period", column: "i.acquisition_date" },
			},
			{
				key: "itemType",
				label: W("Materiale", "Material"),
				def: { kind: "code", param: "itemType", column: "b.item_type" },
			},
			{
				key: "kind",
				label: W("Narrativa o saggistica", "Fiction or non-fiction"),
				def: kindChoice,
			},
		],
	},
	patrons: {
		label: W("Utenti", "Patrons"),
		from: "patron p LEFT JOIN patron_class pc ON pc.patron_id = p.id",
		where: ["p.status = 'active'"],
		dimensions: [
			{
				key: "classYear",
				label: W("Classe (anno)", "Class (year)"),
				type: "level",
				expr: "CASE WHEN p.patron_type = 'teacher' THEN '@teachers' ELSE p.level_code END",
				order: `CASE WHEN p.patron_type = 'teacher' THEN ${TEACHERS_LAST} ELSE COALESCE(pc.level_position, ${TEACHERS_LAST - 1}) END`,
			},
			{
				key: "section",
				label: W("Sezione", "Section"),
				type: "text",
				expr: "CASE WHEN p.patron_type = 'student' THEN pc.group_name END",
			},
			{
				key: "class",
				label: W("Classe", "Class"),
				type: "text",
				expr: "pc.class_label",
				order: `CASE WHEN p.patron_type = 'teacher' THEN ${TEACHERS_LAST} ELSE COALESCE(pc.level_position, ${TEACHERS_LAST - 1}) END`,
			},
			{
				key: "stage",
				label: W("Ordine di scuola", "Stage"),
				type: "stage",
				expr: "pc.stage",
			},
			{
				key: "patronType",
				label: W("Tipo di utente", "Patron type"),
				type: "patronType",
				expr: "p.patron_type",
			},
		],
		measures: [
			{ key: "patrons", label: W("Utenti", "Patrons"), type: "int", expr: "COUNT(*)" },
			{
				key: "withPhoto",
				label: W("Con la foto", "With a photo"),
				type: "int",
				expr: "SUM(p.photo_path IS NOT NULL)",
			},
			{
				key: "withCard",
				label: W("Con la tessera stampata", "With a printed card"),
				type: "int",
				expr: "SUM(p.card_printed_at IS NOT NULL)",
			},
		],
		filters: [
			{
				key: "patronType",
				label: W("Tipo di utente", "Patron type"),
				def: { kind: "code", param: "patronType", column: "p.patron_type" },
			},
			{
				key: "stage",
				label: W("Ordine di scuola", "Stage"),
				def: { kind: "code", param: "stage", column: "pc.stage" },
			},
			{
				key: "level",
				label: W("Classe (anno)", "Class (year)"),
				def: { kind: "code", param: "level", column: "p.level_code" },
			},
			{
				key: "group",
				label: W("Classe", "Class"),
				def: { kind: "group", column: "p.class_group_id" },
			},
		],
	},
};
