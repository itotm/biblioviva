// SPDX-License-Identifier: GPL-3.0-or-later
// Print lists of copies (PLAN.md step 3.8): the quick filters that fill them (labels still to print,
// acquisition dates, genre or class, item type, an import), the rows the list page shows and the
// scan mode by barcode.
import { inCollection } from "#lib/server/db/conditions.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { resolveScan } from "#lib/server/barcodes/lookup.js";
import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, printListEntry } from "#lib/server/db/schema.js";
import {
	createdIdsOfBatch,
	importBatches,
	type ImportBatchEntry,
} from "#lib/server/imports/pipeline.js";
import { classCodesUnder, type ClassificationScheme } from "#lib/shared/classification.js";
import type { AuditActor } from "./audit.js";
import { pendingCondition } from "./label-items.js";
import type { LabelKind } from "./label-templates.js";
import { addEntries, assertPrintList, type AddResult } from "./print-lists.js";

export interface ItemQuickFilter {
	/** Copies whose labels of this kind were never printed. */
	pendingLabels?: LabelKind;
	/** Acquisition date range (ISO dates, inclusive). */
	acquiredFrom?: string;
	acquiredTo?: string;
	/** Fiction genre of the record. */
	genreCode?: string;
	/** Non-fiction classes of the record (a parent with its children: `addItemsByFilter` expands them). */
	classCodes?: string[];
	itemType?: string;
	/** Copies created by a catalogue import (`import_batch.summary.createdItemIds`, step 3.9). */
	importBatchId?: number;
}

/** Ids of the copies matching a quick filter, by acquisition date and barcode; lost and withdrawn copies excluded. */
export function itemsByQuickFilter(db: DbOrTx, filter: ItemQuickFilter): number[] {
	const conditions: SQL[] = [];
	if (filter.pendingLabels) {
		conditions.push(pendingCondition(filter.pendingLabels));
	}
	if (filter.acquiredFrom) {
		conditions.push(gte(item.acquisitionDate, filter.acquiredFrom));
	}
	if (filter.acquiredTo) {
		conditions.push(lte(item.acquisitionDate, filter.acquiredTo));
	}
	if (filter.genreCode) {
		conditions.push(eq(biblio.genreCode, filter.genreCode));
	}
	if (filter.classCodes && filter.classCodes.length > 0) {
		conditions.push(inArray(biblio.classCode, filter.classCodes));
	}
	if (filter.itemType) {
		conditions.push(eq(biblio.itemType, filter.itemType));
	}
	if (filter.importBatchId !== undefined) {
		const created = createdIdsOfBatch(db, filter.importBatchId, "createdItemIds");
		if (created.length === 0) {
			return [];
		}
		conditions.push(inArray(item.id, created));
	}
	if (conditions.length === 0) {
		return [];
	}
	conditions.push(inCollection());
	return db
		.select({ id: item.id })
		.from(item)
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(and(...conditions))
		.orderBy(asc(item.acquisitionDate), asc(item.barcode))
		.all()
		.map((r) => r.id);
}

/** Catalogue import batches, newest first, for the quick filter. */
export function itemImportBatches(db: DbOrTx): ImportBatchEntry[] {
	return importBatches(db, "catalog", (summary) =>
		Array.isArray(summary.createdItemIds) ? summary.createdItemIds.length : 0,
	);
}

export interface ItemListRow {
	entityId: number;
	position: number;
	biblioId: number;
	barcode: string;
	title: string;
	author: string;
	callNumber: string | null;
	status: string;
	barcodeLabelPrintedAt: string | null;
	spineLabelPrintedAt: string | null;
}

/** The entries of an item list with what the operator needs to see, in list order. */
export function itemListRows(db: DbOrTx, listId: number): ItemListRow[] {
	assertPrintList(db, listId);
	return db
		.select({
			entityId: printListEntry.entityId,
			position: printListEntry.position,
			biblioId: item.biblioId,
			barcode: item.barcode,
			title: biblio.title,
			author: biblio.author,
			callNumber: item.callNumber,
			status: item.status,
			barcodeLabelPrintedAt: item.barcodeLabelPrintedAt,
			spineLabelPrintedAt: item.spineLabelPrintedAt,
		})
		.from(printListEntry)
		.innerJoin(item, eq(item.id, printListEntry.entityId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(eq(printListEntry.listId, listId))
		.orderBy(asc(printListEntry.position))
		.all();
}

/**
 * "Aggiungi" of the item list page: the copies of a quick filter (a parent class with its
 * children), appended to an item list.
 */
export function addItemsByFilter(
	db: Db,
	scheme: ClassificationScheme,
	listId: number,
	filter: Omit<ItemQuickFilter, "classCodes"> & { classCode?: string },
	actor: AuditActor,
	now = new Date(),
): AddResult & { found: number } {
	assertPrintList(db, listId, "items");
	const { classCode, ...rest } = filter;
	const found = itemsByQuickFilter(db, {
		...rest,
		classCodes: classCode ? classCodesUnder(scheme, classCode) : undefined,
	});
	return { found: found.length, ...addEntries(db, listId, found, actor, now) };
}

/**
 * Scan mode of an item list: the copy of a barcode appended (`null` for an unknown barcode), with
 * its row and whether it was already there.
 */
export function addItemByBarcode(
	db: Db,
	listId: number,
	scanned: string,
	codes: CodeTable,
	actor: AuditActor,
	now = new Date(),
): { itemId: number; duplicate: boolean; row: ItemListRow | null } | null {
	assertPrintList(db, listId, "items");
	// recognised as at the desk: a scanner's repairs, then the copy (or a legacy number)
	const target = resolveScan(db, scanned, codes);
	const itemId = target.kind === "item" || target.kind === "ambiguous" ? target.itemId : null;
	if (itemId === null) {
		return null;
	}
	const result = addEntries(db, listId, [itemId], actor, now);
	return {
		itemId,
		duplicate: result.added === 0,
		row: itemListRows(db, listId).find((r) => r.entityId === itemId) ?? null,
	};
}
