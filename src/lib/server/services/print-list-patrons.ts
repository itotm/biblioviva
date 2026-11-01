// SPDX-License-Identifier: GPL-3.0-or-later
// Print lists of patrons (PLAN.md step 2.8): the quick filters that fill them (level, class, stage,
// type, cards never printed, no photo, an import, a creation date), the rows the list page shows
// and the scan mode by card number.
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { resolveScan } from "#lib/server/barcodes/lookup.js";
import { and, asc, eq, gt, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { patron, patronClass, printListEntry } from "#lib/server/db/schema.js";
import {
	createdIdsOfBatch,
	importBatches,
	type ImportBatchEntry,
} from "#lib/server/imports/pipeline.js";
import type { AuditActor } from "./audit.js";
import { stageCondition } from "./patron-search.js";
import { addEntries, assertPrintList, type AddResult } from "./print-lists.js";

export interface PatronQuickFilter {
	/** Every pupil of a level (Phase 12). */
	levelCode?: string;
	/** One class (or teachers group). */
	groupId?: number;
	/** A stage of the school (12.9). */
	stage?: string;
	patronType?: "student" | "teacher";
	/** Patrons whose card was never printed. */
	withoutPrintedCard?: boolean;
	withoutPhoto?: boolean;
	/** Patrons created by an import (`import_batch.summary.createdIds`). */
	importBatchId?: number;
	/** ISO date: patrons created on or after it. */
	createdAfter?: string;
}

/** Ids of the (non-anonymized) patrons matching a quick filter, in surname order. */
export function patronsByQuickFilter(db: DbOrTx, filter: PatronQuickFilter): number[] {
	const conditions: (SQL | undefined)[] = [ne(patron.status, "anonymized")];
	if (filter.levelCode) {
		conditions.push(eq(patron.levelCode, filter.levelCode));
	}
	if (filter.groupId !== undefined) {
		conditions.push(eq(patron.classGroupId, filter.groupId));
	}
	if (filter.stage) {
		conditions.push(stageCondition(filter.stage));
	}
	if (filter.patronType) {
		conditions.push(eq(patron.patronType, filter.patronType));
	}
	if (filter.withoutPrintedCard) {
		conditions.push(isNull(patron.cardPrintedAt));
	}
	if (filter.withoutPhoto) {
		conditions.push(isNull(patron.photoPath));
	}
	if (filter.createdAfter) {
		conditions.push(gt(patron.createdAt, `${filter.createdAfter}T00:00:00`));
	}
	if (filter.importBatchId !== undefined) {
		const created = createdIdsOfBatch(db, filter.importBatchId, "createdIds");
		if (created.length === 0) {
			return [];
		}
		conditions.push(inArray(patron.id, created));
	}
	if (conditions.length === 1) {
		return [];
	}
	return db
		.select({ id: patron.id })
		.from(patron)
		.where(and(...conditions))
		.orderBy(asc(patron.searchName))
		.all()
		.map((r) => r.id);
}

/** Import batches of patrons, newest first, for the quick filter. */
export function patronImportBatches(db: DbOrTx): ImportBatchEntry[] {
	return importBatches(db, "patrons", (summary) =>
		typeof summary.created === "number" ? summary.created : 0,
	);
}

export interface PatronListRow {
	entityId: number;
	position: number;
	lastName: string;
	firstName: string;
	patronType: string;
	/** `3 B`, or the teachers group's name (Phase 12). */
	classLabel: string;
	cardNumber: string | null;
	cardPrintedAt: string | null;
	hasPhoto: boolean;
	status: string;
}

/** The entries of a patron list with what the operator needs to see, in list order. */
export function patronListRows(db: DbOrTx, listId: number): PatronListRow[] {
	assertPrintList(db, listId);
	return db
		.select({
			entityId: printListEntry.entityId,
			position: printListEntry.position,
			lastName: patron.lastName,
			firstName: patron.firstName,
			patronType: patron.patronType,
			classLabel: sql<string>`coalesce(${patronClass.classLabel}, '')`,
			cardNumber: patron.cardNumber,
			cardPrintedAt: patron.cardPrintedAt,
			photoPath: patron.photoPath,
			status: patron.status,
		})
		.from(printListEntry)
		.innerJoin(patron, eq(patron.id, printListEntry.entityId))
		.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
		.where(eq(printListEntry.listId, listId))
		.orderBy(asc(printListEntry.position))
		.all()
		.map(({ photoPath, ...r }) => ({ ...r, hasPhoto: photoPath !== null }));
}

/** "Aggiungi" of the patron list page: the patrons of a quick filter, appended to a patron list. */
export function addPatronsByFilter(
	db: Db,
	listId: number,
	filter: PatronQuickFilter,
	actor: AuditActor,
	now = new Date(),
): AddResult & { found: number } {
	assertPrintList(db, listId, "patrons");
	const found = patronsByQuickFilter(db, filter);
	return { found: found.length, ...addEntries(db, listId, found, actor, now) };
}

/**
 * Scan mode of a patron list: the patron of a card number appended (`null` for an unknown card),
 * with its row and whether it was already there.
 */
export function addPatronByCard(
	db: Db,
	listId: number,
	scanned: string,
	codes: CodeTable,
	actor: AuditActor,
	now = new Date(),
): { patronId: number; duplicate: boolean; row: PatronListRow | null } | null {
	assertPrintList(db, listId, "patrons");
	// recognised as at the desk: a scanner's repairs, then the card (or a legacy number)
	const target = resolveScan(db, scanned, codes);
	const patronId =
		target.kind === "patron" || target.kind === "ambiguous" ? target.patronId : null;
	if (patronId === null) {
		return null;
	}
	const result = addEntries(db, listId, [patronId], actor, now);
	return {
		patronId,
		duplicate: result.added === 0,
		row: patronListRows(db, listId).find((r) => r.entityId === patronId) ?? null,
	};
}
