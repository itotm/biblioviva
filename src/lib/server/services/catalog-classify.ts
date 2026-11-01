// SPDX-License-Identifier: GPL-3.0-or-later
// The books to classify (step 9.21, Q117): the records saved without classification, oldest
// first, the next one of the flow, the call number a classification would give, and the
// classification itself. Plain functions `(db, …)`.
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "#lib/server/db/client.js";
import { biblio } from "#lib/server/db/schema.js";
import type { BiblioKind } from "#lib/shared/catalog-schema.js";
import type { AuditActor } from "./audit.js";
import {
	BiblioNotFoundError,
	type CatalogRules,
	suggestedCallNumber,
	updateBiblio,
} from "./catalog.js";
import { copiesTotalSql } from "./catalog-search.js";

/** The classification the flow of the books to classify gives a record (step 9.21). */
export interface Classification {
	kind: BiblioKind;
	genreCode: string;
	classCode: string;
	readingLevel: string;
}

/**
 * Classifies a record of the list "Da classificare" (step 9.21): the record keeps every other
 * field; the rules of §3.17 apply as in the form, and its copies get their call numbers.
 */
export function classifyBiblio(
	db: DbOrTx,
	id: number,
	classification: Classification,
	actor: AuditActor,
	rules: CatalogRules,
	now = new Date(),
): string[] {
	const b = db.select().from(biblio).where(eq(biblio.id, id)).get();
	if (!b) {
		throw new BiblioNotFoundError(id);
	}
	return updateBiblio(
		db,
		id,
		{
			title: b.title,
			subtitle: b.subtitle ?? "",
			originalTitle: b.originalTitle ?? "",
			responsibility: b.responsibility ?? "",
			author: b.author,
			publisher: b.publisher,
			publicationPlace: b.publicationPlace ?? "",
			publicationYear: b.publicationYear === null ? "" : String(b.publicationYear),
			isbn: b.isbn ?? "",
			issn: b.issn ?? "",
			ean: b.ean ?? "",
			physicalDescription: b.physicalDescription ?? "",
			series: b.series ?? "",
			seriesNumber: b.seriesNumber ?? "",
			dewey: b.dewey ?? "",
			...classification,
			subjects: b.subjects.join("\n"),
			notes: b.notes ?? "",
		},
		actor,
		rules,
		now,
	);
}

/**
 * The call number the copies of a record would get with this classification (shown before
 * saving); empty when the record is gone.
 */
export function classifiedCallNumber(
	db: DbOrTx,
	id: number,
	classification: Classification,
	rules: CatalogRules,
): string {
	const record = db
		.select({ author: biblio.author, title: biblio.title })
		.from(biblio)
		.where(eq(biblio.id, id))
		.get();
	return record
		? suggestedCallNumber(rules, {
				...record,
				kind: classification.kind,
				genreCode: classification.genreCode || null,
				classCode: classification.classCode || null,
				readingLevel: classification.readingLevel || null,
			})
		: "";
}

/** One record of the list "Da classificare" (step 9.21). */
export interface UnclassifiedRow {
	id: number;
	title: string;
	author: string;
	publisher: string;
	publicationYear: number | null;
	isbn: string | null;
	dewey: string | null;
	copies: number;
	createdAt: string;
}

/** The records still to classify, the oldest first (the order the flow proposes them in). */
export function listUnclassified(db: DbOrTx): UnclassifiedRow[] {
	return db
		.select({
			id: biblio.id,
			title: biblio.title,
			author: biblio.author,
			publisher: biblio.publisher,
			publicationYear: biblio.publicationYear,
			isbn: biblio.isbn,
			dewey: biblio.dewey,
			copies: copiesTotalSql,
			createdAt: biblio.createdAt,
		})
		.from(biblio)
		.where(isNull(biblio.kind))
		.orderBy(asc(biblio.createdAt), asc(biblio.id))
		.all();
}

/**
 * The record still to classify that follows `afterId` in the order of the list (the oldest first),
 * or null at the end: "Salta" and "Salva e avanti" go on with it, so a skipped record comes back
 * only when the list is opened again.
 */
export function nextUnclassified(db: DbOrTx, afterId: number): number | null {
	const current = db
		.select({ createdAt: biblio.createdAt })
		.from(biblio)
		.where(eq(biblio.id, afterId))
		.get();
	if (!current) {
		return null;
	}
	return (
		db
			.select({ id: biblio.id })
			.from(biblio)
			.where(
				and(
					isNull(biblio.kind),
					sql`(${biblio.createdAt}, ${biblio.id}) > (${current.createdAt}, ${afterId})`,
				),
			)
			.orderBy(asc(biblio.createdAt), asc(biblio.id))
			.limit(1)
			.get()?.id ?? null
	);
}

/** How many records wait to be classified (the tab and the dashboard tile). */
export function unclassifiedCount(db: DbOrTx): number {
	return (
		db
			.select({ n: sql<number>`count(*)` })
			.from(biblio)
			.where(isNull(biblio.kind))
			.get()?.n ?? 0
	);
}
