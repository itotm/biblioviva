// SPDX-License-Identifier: GPL-3.0-or-later
// The copies of a label job (PLAN.md §3.12, step 3.8): the selection (by id, record, acquisition
// date or labels still to print), the printed flags of each copy and the counts of the labels
// still to print. A copy whose record is still to classify gets no spine band yet (step 9.21).
import { inCollection } from "#lib/server/db/conditions.js";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item } from "#lib/server/db/schema.js";
import { audit, type AuditActor } from "./audit.js";
import type { LabelItem } from "./label-context.js";
import type { LabelKind } from "./label-templates.js";

export interface LabelSelection {
	/** Copies by id (printed in this order). */
	ids?: number[];
	/** Every copy of these records. */
	biblioIds?: number[];
	/** Copies whose labels of this kind were never printed. */
	pending?: LabelKind;
	/** Acquisition date range (ISO dates, inclusive). */
	from?: string;
	to?: string;
}

/** The copy's record is classified: its spine band can be printed (step 9.21). */
const classifiedSql = sql`exists (select 1 from biblio cb where cb.id = ${item.biblioId} and cb.kind is not null)`;

/**
 * SQL condition "labels of `kind` still to print" (a pair is pending when either label is); the
 * spine band of a copy whose record is still to classify is not pending yet (step 9.21).
 */
export function pendingCondition(kind: LabelKind): SQL {
	if (kind === "barcode") {
		return isNull(item.barcodeLabelPrintedAt);
	}
	const spine = and(isNull(item.spineLabelPrintedAt), classifiedSql);
	if (!spine) {
		throw new Error("unreachable: and() of two conditions");
	}
	if (kind === "spine") {
		return spine;
	}
	// `or` is typed as possibly undefined for an empty argument list; two conditions always give SQL
	const either = or(isNull(item.barcodeLabelPrintedAt), spine);
	if (!either) {
		throw new Error("unreachable: or() of two conditions");
	}
	return either;
}

const labelItemSelect = {
	id: item.id,
	barcode: item.barcode,
	callNumber: item.callNumber,
	callHead: item.callHead,
	itemType: biblio.itemType,
	readingLevel: item.readingLevel,
	biblioId: item.biblioId,
	title: biblio.title,
	author: biblio.author,
	publicationYear: biblio.publicationYear,
	series: biblio.series,
	seriesNumber: biblio.seriesNumber,
	kind: biblio.kind,
	genreCode: biblio.genreCode,
	classCode: biblio.classCode,
	biblioReadingLevel: biblio.readingLevel,
};

/**
 * Copies to print. With `ids` the given order is kept; otherwise copies come by acquisition date
 * and barcode. Lost and withdrawn copies are left out unless asked for by id.
 */
export function selectItemsForLabels(db: DbOrTx, selection: LabelSelection): LabelItem[] {
	const conditions: SQL[] = [];
	const explicit = (selection.ids?.length ?? 0) > 0 || (selection.biblioIds?.length ?? 0) > 0;
	if (selection.ids && selection.ids.length > 0) {
		conditions.push(inArray(item.id, selection.ids));
	}
	if (selection.biblioIds && selection.biblioIds.length > 0) {
		conditions.push(inArray(item.biblioId, selection.biblioIds));
	}
	if (selection.pending) {
		conditions.push(pendingCondition(selection.pending));
	}
	if (selection.from) {
		conditions.push(gte(item.acquisitionDate, selection.from));
	}
	if (selection.to) {
		conditions.push(lte(item.acquisitionDate, selection.to));
	}
	if (conditions.length === 0) {
		return [];
	}
	if (!explicit) {
		conditions.push(inCollection());
	}
	const rows = db
		.select(labelItemSelect)
		.from(item)
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(and(...conditions))
		.orderBy(asc(item.acquisitionDate), asc(item.barcode))
		.all();
	if (selection.ids && selection.ids.length > 0) {
		const rank = new Map(selection.ids.map((id, i) => [id, i]));
		return [...rows].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
	}
	return rows;
}

/** The item ids of every copy of the given records, by barcode. */
export function itemIdsOfBiblios(db: DbOrTx, biblioIds: number[]): number[] {
	if (biblioIds.length === 0) {
		return [];
	}
	return db
		.select({ id: item.id })
		.from(item)
		.where(inArray(item.biblioId, biblioIds))
		.orderBy(asc(item.barcode))
		.all()
		.map((r) => r.id);
}

/** "Segna come stampate": sets the flag(s) of `kind` (a pair sets both) on the given copies. */
export function markLabelsPrinted(
	db: DbOrTx,
	kind: LabelKind,
	ids: number[],
	now = new Date(),
): number {
	if (ids.length === 0) {
		return 0;
	}
	const stamp = now.toISOString();
	let changes = 0;
	if (kind === "pair" || kind === "barcode") {
		changes = db
			.update(item)
			.set({ barcodeLabelPrintedAt: stamp, updatedAt: stamp })
			.where(inArray(item.id, ids))
			.run().changes;
	}
	if (kind === "pair" || kind === "spine") {
		// no band was printed for a copy whose record is still to classify (step 9.21)
		const spines = db
			.update(item)
			.set({ spineLabelPrintedAt: stamp, updatedAt: stamp })
			.where(and(inArray(item.id, ids), classifiedSql))
			.run().changes;
		changes = kind === "spine" ? spines : changes;
	}
	return changes;
}

/**
 * "Segna come stampate" for copies chosen outside a print list (record page, print dialog): the
 * flags of `kind` and the audit row, in one transaction.
 */
export function markItemLabelsPrinted(
	db: Db,
	kind: LabelKind,
	ids: number[],
	actor: AuditActor,
	now = new Date(),
): number {
	return db.transaction((tx) => {
		const marked = markLabelsPrinted(tx, kind, ids, now);
		audit(tx, actor, "item.labels_printed", "item", null, { kind, count: marked }, now);
		return marked;
	});
}

/**
 * The copies of the pending sheet of `kind`, as the print page lists them (9.42): the dashboard's
 * dialog reads them when the sheet is opened and marks exactly those as printed.
 */
export function pendingLabelItemIds(db: DbOrTx, kind: LabelKind): number[] {
	return selectItemsForLabels(db, { pending: kind }).map((i) => i.id);
}

/** Copies with labels of each kind still to print (dashboard tile and quick filters). */
export function pendingLabelCounts(db: DbOrTx): Record<LabelKind, number> {
	const count = (kind: LabelKind): number =>
		db
			.select({ n: sql<number>`count(*)` })
			.from(item)
			.where(and(pendingCondition(kind), inCollection()))
			.get()?.n ?? 0;
	return { pair: count("pair"), barcode: count("barcode"), spine: count("spine") };
}

/** Copies (not lost or withdrawn) whose record is still to classify: no spine band yet (step 9.21). */
export function unclassifiedCopyCount(db: DbOrTx): number {
	return (
		db
			.select({ n: sql<number>`count(*)` })
			.from(item)
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.where(and(isNull(biblio.kind), inCollection()))
			.get()?.n ?? 0
	);
}
