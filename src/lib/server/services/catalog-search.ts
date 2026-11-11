// SPDX-License-Identifier: GPL-3.0-or-later
// Reads of the catalogue (PLAN.md steps 3.1, 5.1): the grid with its filters and the approximate
// matches, the direct hit of a scanned code or ISBN, the series names, one record with its copies
// and one copy. Plain functions `(db, …)`.
import { lendableStatusesSql } from "#lib/server/db/conditions.js";
import { collatorFor } from "#lib/shared/collation.js";
import { patronSortName } from "#lib/shared/patron-name.js";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { SQLiteSelect } from "drizzle-orm/sqlite-core";
import { itemByBarcode } from "#lib/server/barcodes/lookup.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, loan, patron } from "#lib/server/db/schema.js";
import {
	biblioFts,
	ftsMatch,
	ftsRank,
	searchVocabulary,
	SIMILAR_COLUMNS,
} from "#lib/server/db/fts.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { recogniseIsbn, recogniseScan } from "#lib/shared/scan.js";
import type { BiblioFilters, BiblioKind, ItemStatus } from "#lib/shared/catalog-schema.js";
import { UNCLASSIFIED } from "#lib/shared/catalog-schema.js";
import {
	classCodesUnder,
	classificationOf,
	type ResolvedNode,
} from "#lib/shared/classification.js";
import { isoDateIn } from "#lib/shared/dates.js";
import {
	byCloseness,
	closeness,
	corrections,
	maxEdits,
	searchWords,
	SIMILAR_THRESHOLD,
	type Closeness,
} from "#lib/shared/fuzzy.js";
import { BiblioNotFoundError, type BiblioData, type CatalogRules } from "./catalog.js";

export type CatalogHit =
	/** A copy's barcode or a record's ISBN, unambiguous: the page opens the record. */
	| { kind: "open"; biblioId: number; itemId?: number }
	/** A plain number that is also a legacy copy barcode: offered, never opened by itself. */
	| { kind: "suggest"; biblioId: number; itemId: number; barcode: string; title: string };

/**
 * The direct hit of a search box text (step 5.1): a scanned or typed copy barcode
 * (`2026-01234`, legacy `2019-0042`) or an ISBN matching exactly one record opens it; a plain
 * number that is also a legacy copy barcode is only suggested, because it may be a title word
 * such as "1984".
 */
export function catalogDirectHit(db: DbOrTx, text: string, codes: CodeTable): CatalogHit | null {
	const q = text.trim();
	if (!q) {
		return null;
	}
	const isbn = recogniseIsbn(q);
	if (isbn) {
		const records = db
			.select({ id: biblio.id })
			.from(biblio)
			.where(eq(biblio.isbn, isbn))
			.limit(2)
			.all();
		return records.length === 1 && records[0]
			? { kind: "open", biblioId: records[0].id }
			: null;
	}
	const { result: code } = recogniseScan(q, codes);
	if (code.kind === "invalid") {
		return null;
	}
	const copy = itemByBarcode(db, code.value);
	if (!copy) {
		return null;
	}
	return code.kind === "item" || code.kind === "legacy_item"
		? { kind: "open", biblioId: copy.biblioId, itemId: copy.id }
		: {
				kind: "suggest",
				biblioId: copy.biblioId,
				itemId: copy.id,
				barcode: code.value,
				title: copy.title,
			};
}

/** The open loan of a copy, with its patron. */
export function openLoanOf(
	db: DbOrTx,
	itemId: number,
):
	| { loanId: number; patronId: number; dueDate: string; lastName: string; firstName: string }
	| undefined {
	return db
		.select({
			loanId: loan.id,
			patronId: loan.patronId,
			dueDate: loan.dueDate,
			lastName: patron.lastName,
			firstName: patron.firstName,
		})
		.from(loan)
		.innerJoin(patron, eq(patron.id, loan.patronId))
		.where(and(eq(loan.itemId, itemId), sql`${loan.returnedAt} is null`))
		.get();
}

// --- Reads -----------------------------------------------------------------------------------

export interface BiblioListRow {
	id: number;
	title: string;
	/** The title of the original work of a translation (step 9.23). */
	originalTitle: string | null;
	author: string;
	publicationYear: number | null;
	isbn: string | null;
	series: string | null;
	seriesNumber: string | null;
	kind: BiblioKind | null;
	genreCode: string | null;
	classCode: string | null;
	readingLevel: string | null;
	copiesTotal: number;
	copiesAvailable: number;
	hasCover: boolean;
	/** Distinct call numbers of the copies, joined with " · " (usually one). */
	callNumbers: string;
	/** Earliest acquisition date of the copies, else the day the record was created (`YYYY-MM-DD`). */
	acquiredAt: string;
	/** An approximate result, found by forgiving typing mistakes (step 9.24). */
	similar: boolean;
}

const callNumbersSql = sql<
	string | null
>`(select group_concat(cn, ' · ') from (select distinct i.call_number as cn from item i where i.biblio_id = biblio.id and i.call_number is not null and i.status <> 'withdrawn' order by i.call_number))`;
const acquiredAtSql = sql<
	string | null
>`(select min(i.acquisition_date) from item i where i.biblio_id = biblio.id)`;
export const copiesTotalSql = sql<number>`(select count(*) from item i where i.biblio_id = biblio.id and i.status <> 'withdrawn')`;
/** A copy on the shelf that can go home today (available or worn, ADR-012; not on loan). */
const onShelfSql = sql`i.biblio_id = biblio.id and i.status in ${lendableStatusesSql}
	and i.not_for_loan = 0 and not exists (select 1 from loan l where l.item_id = i.id and l.returned_at is null)`;
const copiesAvailableSql = sql<number>`(select count(*) from item i where ${onShelfSql})`;

/**
 * Grid of records (steps 3.1, 5.1): full-text search over title, original title (9.23), subtitle,
 * author, responsibility, publisher, subjects, ISBN and series with FTS5 — every word a prefix,
 * diacritics ignored, ranked by bm25 with the titles and the author first —, an ISBN typed or scanned matches the record exactly; filters
 * (kind, genre, class with its children, associated class, item type, availability, year range,
 * withdrawn) and sort.
 */
export function searchBiblios(
	db: Db,
	filters: Partial<BiblioFilters>,
	rules: CatalogRules,
): { rows: BiblioListRow[]; total: number; similar: number } {
	// the filters other than the words, shared by the exact and the approximate results
	const conditions: (SQL | undefined)[] = [];
	const q = (filters.q ?? "").trim();
	let words: SQL | undefined;
	let match: string | null = null;
	if (q) {
		// an ISBN may be typed with hyphens or spaces
		const isbn = recogniseIsbn(q);
		if (isbn) {
			words = eq(biblio.isbn, isbn);
		} else {
			match = ftsMatch(q);
			if (match) {
				words = sql`biblio_fts MATCH ${match}`;
			}
		}
	}
	if (filters.available === "1") {
		conditions.push(sql`exists (select 1 from item i where ${onShelfSql})`);
	}
	if (filters.yearFrom) {
		conditions.push(gte(biblio.publicationYear, Number(filters.yearFrom)));
	}
	if (filters.yearTo) {
		conditions.push(lte(biblio.publicationYear, Number(filters.yearTo)));
	}
	if (filters.kind === UNCLASSIFIED) {
		conditions.push(isNull(biblio.kind));
	} else if (filters.kind) {
		conditions.push(eq(biblio.kind, filters.kind));
	}
	if (filters.genreCode) {
		conditions.push(eq(biblio.genreCode, filters.genreCode));
	}
	if (filters.classCode) {
		conditions.push(
			inArray(biblio.classCode, classCodesUnder(rules.scheme, filters.classCode)),
		);
	}
	if (filters.readingLevel) {
		const cls = filters.readingLevel;
		conditions.push(
			rules.scheme.classPerItem
				? sql`exists (select 1 from item i where i.biblio_id = biblio.id and i.reading_level = ${cls})`
				: eq(biblio.readingLevel, cls),
		);
	}
	if (filters.itemType) {
		conditions.push(eq(biblio.itemType, filters.itemType));
	}
	if (filters.series) {
		conditions.push(sql`${biblio.series} = ${filters.series} collate nocase`);
	}
	// withdrawn books leave the search results (step 4.8): a record whose copies are all
	// withdrawn shows up only when asked for; a record without copies stays visible
	if (filters.withdrawn !== "1") {
		conditions.push(
			sql`(not exists (select 1 from item i where i.biblio_id = biblio.id) or exists (select 1 from item i where i.biblio_id = biblio.id and i.status <> 'withdrawn'))`,
		);
	}
	const where = and(words, ...conditions);
	// the books of a series in their order: numbers as numbers (2 before 10), then as text (I, II)
	const bySeries = [
		sql`${biblio.series} is null`,
		sql`${biblio.series} collate nocase`,
		sql`${biblio.seriesNumber} is null`,
		sql`${biblio.seriesNumber} glob '[0-9]*' = 0`,
		sql`cast(${biblio.seriesNumber} as real)`,
		asc(biblio.seriesNumber),
		asc(biblio.title),
	];
	const order = {
		relevance: match
			? [asc(ftsRank), asc(biblio.title)]
			: filters.series
				? bySeries
				: [asc(biblio.title)],
		title: [asc(biblio.title)],
		author: [asc(biblio.author), asc(biblio.title)],
		year: [desc(biblio.publicationYear), asc(biblio.title)],
		created: [desc(biblio.createdAt)],
		series: bySeries,
	}[filters.sort ?? "relevance"];
	// MATCH needs the FTS table joined; without words to match it stays out of the query
	// (the join adds no selected column, so the query keeps its row type)
	const withFts = <T extends SQLiteSelect>(qb: T): T =>
		match ? (qb.innerJoin(biblioFts, eq(biblioFts.rowid, biblio.id)) as unknown as T) : qb;
	const columns = {
		id: biblio.id,
		title: biblio.title,
		originalTitle: biblio.originalTitle,
		author: biblio.author,
		publicationYear: biblio.publicationYear,
		isbn: biblio.isbn,
		series: biblio.series,
		seriesNumber: biblio.seriesNumber,
		kind: biblio.kind,
		genreCode: biblio.genreCode,
		classCode: biblio.classCode,
		readingLevel: biblio.readingLevel,
		coverPath: biblio.coverPath,
		createdAt: biblio.createdAt,
		copiesTotal: copiesTotalSql,
		copiesAvailable: copiesAvailableSql,
		callNumbers: callNumbersSql,
		acquiredAt: acquiredAtSql,
	};
	const rows = withFts(db.select(columns).from(biblio).$dynamic())
		.where(where)
		.orderBy(...order)
		.limit(filters.limit ?? 500)
		.offset(filters.offset ?? 0)
		.all();
	const total =
		withFts(
			db
				.select({ n: sql<number>`count(*)` })
				.from(biblio)
				.$dynamic(),
		)
			.where(where)
			.get()?.n ?? 0;
	// fewer than three books for the words: the closest titles follow, marked (9.24, Q124)
	let similar: typeof rows = [];
	if (match && total < SIMILAR_THRESHOLD && !filters.offset) {
		const exact = new Set(rows.map((r) => r.id));
		const ranked = similarBiblioIds(db, q, rules.locale).filter((id) => !exact.has(id));
		if (ranked.length > 0) {
			const position = new Map(ranked.map((id, i) => [id, i]));
			similar = db
				.select(columns)
				.from(biblio)
				.where(and(inArray(biblio.id, ranked), ...conditions))
				.all()
				.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
				.slice(0, Math.max(0, (filters.limit ?? 500) - rows.length));
		}
	}
	const shape = (
		{ coverPath, createdAt, ...r }: (typeof rows)[number],
		isSimilar: boolean,
	): BiblioListRow => ({
		...r,
		kind: r.kind as BiblioKind | null,
		hasCover: coverPath !== null,
		callNumbers: r.callNumbers ?? "",
		acquiredAt: r.acquiredAt ?? isoDateIn(new Date(createdAt), rules.timezone),
		similar: isSimilar,
	});
	return {
		rows: [...rows.map((r) => shape(r, false)), ...similar.map((r) => shape(r, true))],
		// the exact results; the approximate ones are counted apart
		total,
		similar: similar.length,
	};
}

/**
 * The records closest to a search with mistakes (step 9.24, Q124), the closest first: the words
 * of four letters or more are corrected against the words of titles, original titles and authors
 * in the FTS index; the records holding one of them are scored by `closeness` (every word before
 * some, then fewer mistakes, then the title in the installation's language). At most 100.
 */
export function similarBiblioIds(db: Db, text: string, locale: string): number[] {
	const words = searchWords(text);
	const long = words.filter((w) => maxEdits(w) > 0);
	if (long.length === 0) {
		return [];
	}
	const vocabulary = searchVocabulary(db.$client);
	const candidates = new Set<number>();
	for (const word of long) {
		const terms = [`"${word}"*`, ...corrections(word, vocabulary).map((c) => `"${c.term}"`)];
		const expression = `{${SIMILAR_COLUMNS.join(" ")}} : (${terms.join(" OR ")})`;
		for (const r of db.$client
			.query<{ id: number }, [string]>(
				"SELECT rowid AS id FROM biblio_fts WHERE biblio_fts MATCH ?1 LIMIT 5000",
			)
			.all(expression)) {
			candidates.add(r.id);
		}
	}
	const scored: { id: number; title: string; close: Closeness }[] = [];
	const ids = [...candidates];
	for (let i = 0; i < ids.length; i += 500) {
		const chunk = ids.slice(i, i + 500);
		const rows = db
			.select({
				id: biblio.id,
				title: biblio.title,
				originalTitle: biblio.originalTitle,
				author: biblio.author,
			})
			.from(biblio)
			.where(inArray(biblio.id, chunk))
			.all();
		for (const r of rows) {
			const close = closeness(
				words,
				searchWords(`${r.title} ${r.originalTitle ?? ""} ${r.author}`),
			);
			if (close) {
				scored.push({ id: r.id, title: r.title, close });
			}
		}
	}
	const titles = collatorFor(locale);
	return scored
		.sort((a, b) => byCloseness(a.close, b.close) || titles.compare(a.title, b.title))
		.slice(0, 100)
		.map((s) => s.id);
}

/**
 * The series already in the catalogue, for the suggestions of the record form and the filter of
 * the list (step 9.14): one name per series whatever the case it was typed in.
 */
export function seriesNames(db: DbOrTx): string[] {
	return db
		.select({ series: sql<string>`min(${biblio.series})` })
		.from(biblio)
		.where(sql`${biblio.series} is not null`)
		.groupBy(sql`${biblio.series} collate nocase`)
		.orderBy(sql`${biblio.series} collate nocase`)
		.all()
		.map((r) => r.series);
}

export interface ItemRow {
	id: number;
	barcode: string;
	/** The segnatura computed by the server (Q143). */
	callNumber: string | null;
	/** The copy's written part of it, `{{copytext}}`. */
	callText: string | null;
	readingLevel: string | null;
	enumeration: string | null;
	status: ItemStatus;
	notForLoan: boolean;
	acquisitionDate: string | null;
	notes: string | null;
	barcodeLabelPrintedAt: string | null;
	spineLabelPrintedAt: string | null;
	/** The school inventory (9.64). */
	inventoryNumber: string | null;
	origin: string | null;
	valueCents: number | null;
	withdrawnOn: string | null;
	withdrawnReason: string | null;
	/** The open loan, when the copy is out. */
	loan: { loanId: number; patronId: number; patronName: string; dueDate: string } | null;
}

export interface BiblioDetail extends BiblioData {
	id: number;
	hasCover: boolean;
	coverSource: string | null;
	source: string;
	sourceId: string | null;
	createdAt: string;
	updatedAt: string;
	classification: ResolvedNode | null;
	items: ItemRow[];
}

export function getBiblio(db: Db, id: number, rules: CatalogRules): BiblioDetail {
	const row = db.select().from(biblio).where(eq(biblio.id, id)).get();
	if (!row) {
		throw new BiblioNotFoundError(id);
	}
	const items = db
		.select()
		.from(item)
		.where(eq(item.biblioId, id))
		.orderBy(asc(item.barcode))
		.all()
		.map<ItemRow>((i) => {
			const open = openLoanOf(db, i.id);
			return {
				id: i.id,
				barcode: i.barcode,
				callNumber: i.callNumber,
				callText: i.callText,
				readingLevel: i.readingLevel,
				enumeration: i.enumeration,
				status: i.status as ItemStatus,
				notForLoan: i.notForLoan === 1,
				acquisitionDate: i.acquisitionDate,
				notes: i.notes,
				barcodeLabelPrintedAt: i.barcodeLabelPrintedAt,
				spineLabelPrintedAt: i.spineLabelPrintedAt,
				inventoryNumber: i.inventoryNumber,
				origin: i.origin,
				valueCents: i.valueCents,
				withdrawnOn: i.withdrawnOn,
				withdrawnReason: i.withdrawnReason,
				loan: open
					? {
							loanId: open.loanId,
							patronId: open.patronId,
							patronName: patronSortName(open),
							dueDate: open.dueDate,
						}
					: null,
			};
		});
	const { coverPath, createdBy: _c, updatedBy: _u, ...rest } = row;
	return {
		...rest,
		kind: rest.kind as BiblioKind | null,
		hasCover: coverPath !== null,
		classification: classificationOf(rules.scheme, rest),
		items,
	};
}
