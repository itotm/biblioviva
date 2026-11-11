// SPDX-License-Identifier: GPL-3.0-or-later
// Administrator exports (PLAN.md steps 7.3, 9.19): students, teachers, catalogue (one row per copy)
// and open loans in the very formats the imports read (2.6, 3.9, with the English columns of
// `#lib/shared/import-columns.ts`), so a file exported here goes back in unchanged;
// the whole loan history with its snapshots; a JSON dump of the library's data for a migration;
// and one patron's data for an access request. Everything is produced row by row (generators),
// so the routes stream it instead of building it in memory.
import type { Database } from "bun:sqlite";
import { CSV_BOM, CSV_SEPARATOR, csvField } from "#lib/server/export/csv.js";
import {
	CATALOG_IMPORT,
	headersOf,
	LOAN_IMPORT,
	STUDENT_IMPORT,
	TEACHER_IMPORT,
} from "#lib/shared/import-columns.js";

const line = (cells: readonly (string | number | null | undefined)[]): string =>
	`${cells
		.map((c) =>
			csvField(
				c === null || c === undefined ? "" : String(c),
				typeof c === "number" ? "number" : "text",
			),
		)
		.join(CSV_SEPARATOR)}\r\n`;

/** The student import's columns (`level` + `section` for the class). */
export const STUDENT_EXPORT_HEADER = headersOf(STUDENT_IMPORT, [
	"firstName",
	"lastName",
	"level",
	"section",
	"externalId",
	"cardNumber",
	"email",
]);

/** The teacher import's columns. */
export const TEACHER_EXPORT_HEADER = headersOf(TEACHER_IMPORT, [
	"firstName",
	"lastName",
	"group",
	"externalId",
	"cardNumber",
	"email",
]);

/** Active patrons of one type, in the format of its import (2.6, 9.19). */
function* patronsCsv(sqlite: Database, type: "student" | "teacher"): Generator<string> {
	yield CSV_BOM + line(type === "student" ? STUDENT_EXPORT_HEADER : TEACHER_EXPORT_HEADER);
	const rows = sqlite
		.query<Record<string, string | number | null>, [string]>(
			// the class as the import reads it back (Phase 12): the level's code and the class's name
			`SELECT p.first_name, p.last_name, p.level_code, pc.group_name, p.external_id,
				p.card_number, p.email
			FROM patron p LEFT JOIN patron_class pc ON pc.patron_id = p.id
			WHERE p.status = 'active' AND p.patron_type = ?
			ORDER BY pc.level_position, pc.group_name, p.search_name`,
		)
		.iterate(type);
	for (const r of rows) {
		yield line(
			type === "student"
				? [
						r.first_name,
						r.last_name,
						r.level_code,
						r.group_name,
						r.external_id,
						r.card_number,
						r.email,
					]
				: [r.first_name, r.last_name, r.group_name, r.external_id, r.card_number, r.email],
		);
	}
}

/** Active students, in the format of the student import. */
export function studentsCsv(sqlite: Database): Generator<string> {
	return patronsCsv(sqlite, "student");
}

/** Active teachers, in the format of the teacher import. */
export function teachersCsv(sqlite: Database): Generator<string> {
	return patronsCsv(sqlite, "teacher");
}

/** The catalogue import's columns (the SQL of the export names its columns the same way). */
export const CATALOG_EXPORT_HEADER = headersOf(CATALOG_IMPORT, [
	"biblioKey",
	"isbn",
	"issn",
	"ean",
	"title",
	"subtitle",
	"originalTitle",
	"responsibility",
	"author",
	"publisher",
	"publicationPlace",
	"publicationYear",
	"physicalDescription",
	"series",
	"seriesNumber",
	"dewey",
	"classification",
	"readingLevel",
	"subjects",
	"accessibleFormats",
	"notes",
	"barcode",
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
]);

/**
 * The catalogue, one row per copy (a record without copies gets one row without them), in the
 * format of the catalogue import (3.9); `biblio_key` keeps the copies of a record together.
 */
// A generator streams its rows between other requests: it iterates a statement of its own
// (`prepare`), never the cached one of `query`, which a second download at the same time would
// run again and break (the load test of 9.29).
export function* catalogCsv(sqlite: Database): Generator<string> {
	yield CSV_BOM + line(CATALOG_EXPORT_HEADER);
	const rows = sqlite
		.prepare<Record<string, string | number | null>, []>(
			`SELECT b.id AS biblio_key, b.isbn, b.issn, b.ean, b.title, b.subtitle, b.original_title, b.responsibility, b.author,
				b.publisher, b.publication_place, b.publication_year, b.physical_description, b.series, b.series_number, b.dewey,
				COALESCE(b.genre_code, b.class_code) AS classification,
				COALESCE(i.reading_level, b.reading_level) AS reading_level,
				b.subjects, b.accessible_formats, b.notes, i.barcode, i.call_number, b.item_type, i.enumeration, i.status,
				i.not_for_loan, i.acquisition_date, i.notes AS item_notes, i.inventory_number, i.origin,
				i.value_cents
			FROM biblio b LEFT JOIN item i ON i.biblio_id = b.id ORDER BY b.id, i.id`,
		)
		.iterate();
	for (const r of rows) {
		const list = (json: string | number | null | undefined): string => {
			try {
				return (JSON.parse(String(json ?? "[]")) as string[]).join("; ");
			} catch {
				return "";
			}
		};
		const subjects = list(r.subjects);
		yield line(
			CATALOG_EXPORT_HEADER.map((key) => {
				if (key === "subjects") {
					return subjects;
				}
				if (key === "accessible_formats") {
					return list(r.accessible_formats);
				}
				if (key === "not_for_loan") {
					return r.barcode === null ? "" : r.not_for_loan ? "1" : "0";
				}
				if (key === "value") {
					// euro with a point, as the import reads it back (9.64)
					return r.value_cents === null ? "" : (Number(r.value_cents) / 100).toFixed(2);
				}
				return r[key];
			}),
		);
	}
}

/** The open-loans import's columns: card, copy, lent on, due. */
export const OPEN_LOANS_EXPORT_HEADER = headersOf(LOAN_IMPORT, [
	"cardNumber",
	"barcode",
	"issuedOn",
	"dueOn",
]);

/** Open loans in the format of the open-loans import (3.9). */
export function* openLoansCsv(sqlite: Database): Generator<string> {
	yield CSV_BOM + line(OPEN_LOANS_EXPORT_HEADER);
	const rows = sqlite
		.prepare<Record<string, string | null>, []>(
			`SELECT p.card_number, i.barcode, substr(l.issued_at, 1, 10) AS issued, l.due_date
			FROM loan l JOIN patron p ON p.id = l.patron_id JOIN item i ON i.id = l.item_id
			WHERE l.returned_at IS NULL ORDER BY l.issued_at, l.id`,
		)
		.iterate();
	for (const r of rows) {
		yield line([r.card_number, r.barcode, r.issued, r.due_date]);
	}
}

export const LOANS_HISTORY_HEADER = [
	"loan",
	"card_number",
	"patron",
	"patron_type",
	"class",
	"school_year",
	"barcode",
	"title",
	"issued_at",
	"due_on",
	"returned_at",
	"renewals",
	"lost",
] as const;

/** Every loan with the patron's type and class of the day (snapshots, Q95). */
export function* loansHistoryCsv(sqlite: Database): Generator<string> {
	yield CSV_BOM + line(LOANS_HISTORY_HEADER);
	const rows = sqlite
		.prepare<Record<string, string | number | null>, []>(
			`SELECT l.id, p.card_number, p.last_name || ' ' || p.first_name AS patron, l.patron_type_snapshot,
				l.class_label_snapshot, l.school_year, i.barcode, b.title, l.issued_at,
				l.due_date, l.returned_at, l.renewals,
				EXISTS (SELECT 1 FROM loan_event e WHERE e.loan_id = l.id AND e.type = 'lost') AS lost
			FROM loan l JOIN patron p ON p.id = l.patron_id JOIN item i ON i.id = l.item_id
			JOIN biblio b ON b.id = i.biblio_id ORDER BY l.issued_at, l.id`,
		)
		.iterate();
	for (const r of rows) {
		yield line([
			r.id,
			r.card_number,
			r.patron,
			r.patron_type_snapshot,
			r.class_label_snapshot,
			r.school_year,
			r.barcode,
			r.title,
			r.issued_at,
			r.due_date,
			r.returned_at,
			r.renewals,
			r.lost ? "1" : "0",
		]);
	}
}

/**
 * Tables of the JSON dump, with the columns left out: sessions, staff accounts (defined in the
 * configuration, with password hashes), the metadata cache and the audit log stay out.
 */
export const DUMP_TABLES: Record<string, readonly string[]> = {
	patron: [],
	biblio: [],
	item: [],
	loan: [],
	loan_event: [],
	print_list: [],
	print_list_entry: [],
	import_batch: ["stored_path"],
	sequence: [],
};

/** A JSON document `{ format, version, exportedAt, tables: { name: [rows] } }`, streamed. */
export function* databaseDump(
	sqlite: Database,
	meta: { version: string; now?: Date },
): Generator<string> {
	yield `{"format":"biblioviva-dump","version":${JSON.stringify(meta.version)},"exportedAt":${JSON.stringify(
		(meta.now ?? new Date()).toISOString(),
	)},"tables":{`;
	let firstTable = true;
	for (const [table, omit] of Object.entries(DUMP_TABLES)) {
		yield `${firstTable ? "" : ","}${JSON.stringify(table)}:[`;
		firstTable = false;
		let first = true;
		for (const row of sqlite
			.prepare<Record<string, unknown>, []>(`SELECT * FROM ${table}`)
			.iterate()) {
			const kept = Object.fromEntries(Object.entries(row).filter(([k]) => !omit.includes(k)));
			yield `${first ? "" : ","}\n${JSON.stringify(kept)}`;
			first = false;
		}
		yield "]";
	}
	yield "}}\n";
}

/** Everything the library holds about one patron (access request): record, loans, events. */
export function patronDataExport(
	sqlite: Database,
	patronId: number,
): Record<string, unknown> | null {
	const patron = sqlite
		.query<Record<string, unknown>, [number]>(
			`SELECT p.id, p.card_number, p.external_id, p.first_name, p.last_name, p.patron_type,
				pc.class_label, p.level_code, pc.group_name, p.email,
				p.photo_path IS NOT NULL AS has_photo, p.card_printed_at, p.status, p.circulation_note,
				p.notes, p.anonymized_at, p.created_at, p.updated_at
			FROM patron p LEFT JOIN patron_class pc ON pc.patron_id = p.id WHERE p.id = ?1`,
		)
		.get(patronId);
	if (!patron) {
		return null;
	}
	const loans = sqlite
		.query<Record<string, unknown>, [number]>(
			`SELECT l.id, b.title, b.author, i.barcode, l.issued_at, l.due_date, l.returned_at, l.renewals,
				l.patron_type_snapshot, l.class_label_snapshot, l.level_snapshot, l.group_snapshot,
				l.school_year
			FROM loan l JOIN item i ON i.id = l.item_id JOIN biblio b ON b.id = i.biblio_id
			WHERE l.patron_id = ?1 ORDER BY l.issued_at`,
		)
		.all(patronId);
	const events = sqlite
		.query<Record<string, unknown>, [number]>(
			"SELECT e.loan_id, e.type, e.at, e.details FROM loan_event e JOIN loan l ON l.id = e.loan_id WHERE l.patron_id = ?1 ORDER BY e.at",
		)
		.all(patronId);
	return { format: "biblioviva-patron", patron, loans, loanEvents: events };
}
