// SPDX-License-Identifier: GPL-3.0-or-later
// The copies of the catalogue (PLAN.md step 3.1): their validation, "Aggiungi copie" with barcodes
// from the per-year sequence and the suggested call number, edits, status changes (withdrawing a
// lent copy refused) and the deletion of a copy never lent. Plain functions `(db, …)`.
import { blankToNull } from "#lib/shared/text.js";
import { eq } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, loan, loanEvent } from "#lib/server/db/schema.js";
import { nextItemBarcode } from "#lib/server/barcodes/items.js";
import type {
	BiblioFormInput,
	BiblioKind,
	ItemFormInput,
	ItemStatus,
} from "#lib/shared/catalog-schema.js";
import { ITEM_STATUS_VALUES } from "#lib/shared/catalog-schema.js";
import { isoDateIn, zonedParts } from "#lib/shared/dates.js";
import { demoItem, demoText } from "#lib/server/demo/content.js";
import { audit, type AuditActor } from "./audit.js";
import {
	BiblioNotFoundError,
	type CatalogRules,
	CatalogValidationError,
	type CatalogIssue,
	ItemNotFoundError,
	ItemOnLoanError,
	suggestedCallNumber,
	updateBiblio,
} from "./catalog.js";
import { openLoanOf } from "./catalog-search.js";

export interface ItemData {
	itemType: string;
	callNumber: string | null;
	readingLevel: string | null;
	enumeration: string | null;
	acquisitionDate: string | null;
	notes: string | null;
	notForLoan: boolean;
}

export function validateItem(
	input: ItemFormInput,
	rules: CatalogRules,
	/** Null for a record still to classify (step 9.21). */
	biblioKind: BiblioKind | null,
): ItemData {
	const issues: CatalogIssue[] = [];
	const type = rules.itemTypes.find((t) => t.code === input.itemType);
	if (!type) {
		issues.push({ field: "itemType", code: "itemTypeUnknown" });
	}
	const readingLevel = blankToNull(input.readingLevel);
	if (readingLevel !== null) {
		if (
			!rules.scheme.classPerItem ||
			!rules.scheme.fictionByClass ||
			biblioKind !== "fiction"
		) {
			issues.push({ field: "readingLevel", code: "readingLevelNotAllowed" });
		} else if (!rules.scheme.readingLevels.some((l) => l.code === readingLevel)) {
			issues.push({ field: "readingLevel", code: "readingLevelOutOfRange" });
		}
	}
	const acquisitionDate = blankToNull(input.acquisitionDate);
	if (acquisitionDate && !/^\d{4}-\d{2}-\d{2}$/.test(acquisitionDate)) {
		issues.push({ field: "acquisitionDate", code: "acquisitionDateInvalid" });
	}
	if (issues.length > 0) {
		throw new CatalogValidationError(issues);
	}
	return {
		itemType: input.itemType,
		callNumber: blankToNull(input.callNumber),
		readingLevel,
		enumeration: blankToNull(input.enumeration),
		acquisitionDate,
		notes: blankToNull(input.notes),
		// the item type's rule (e.g. reference copies) unless the copy says otherwise
		notForLoan: input.notForLoan || (type?.notForLoan ?? false),
	};
}

/**
 * Adds `copies` items to a record in one transaction: barcodes in the configured format from this
 * year's sequence, the call number from the form or suggested, acquisition date today by default.
 */
export function addItems(
	db: DbOrTx,
	biblioId: number,
	input: ItemFormInput,
	copies: number,
	actor: AuditActor,
	rules: CatalogRules,
	now = new Date(),
): { ids: number[]; barcodes: string[] } {
	if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
		throw new CatalogValidationError([{ field: "copies", code: "copiesOutOfRange" }]);
	}
	return db.transaction((tx) => {
		const record = tx.select().from(biblio).where(eq(biblio.id, biblioId)).get();
		if (!record) {
			throw new BiblioNotFoundError(biblioId);
		}
		// the public demo: the suggested call number, no volume, its example note (Q121)
		const data = validateItem(
			demoItem(input, "", undefined, now),
			rules,
			record.kind as BiblioKind | null,
		);
		const today = isoDateIn(now, rules.timezone);
		const year = Number(zonedParts(now, rules.timezone).year);
		const callNumber =
			data.callNumber ?? (suggestedCallNumber(rules, record, data.readingLevel) || null);
		const ids: number[] = [];
		const barcodes: string[] = [];
		for (let i = 0; i < copies; i++) {
			const barcode = nextItemBarcode(tx, rules.codes, year);
			const row = tx
				.insert(item)
				.values({
					biblioId,
					barcode,
					callNumber,
					itemType: data.itemType,
					readingLevel: data.readingLevel,
					enumeration: data.enumeration,
					acquisitionDate: data.acquisitionDate ?? today,
					notes: data.notes,
					notForLoan: data.notForLoan ? 1 : 0,
					createdAt: now.toISOString(),
					updatedAt: now.toISOString(),
				})
				.returning({ id: item.id })
				.get();
			ids.push(row.id);
			barcodes.push(barcode);
		}
		audit(
			tx,
			actor,
			"item.create",
			"biblio",
			biblioId,
			{ copies, itemType: data.itemType },
			now,
		);
		return { ids, barcodes };
	});
}

const ITEM_TRACKED: (keyof ItemData)[] = [
	"itemType",
	"callNumber",
	"readingLevel",
	"enumeration",
	"acquisitionDate",
	"notes",
	"notForLoan",
];

export function updateItem(
	db: DbOrTx,
	id: number,
	input: ItemFormInput,
	actor: AuditActor,
	rules: CatalogRules,
	now = new Date(),
): string[] {
	return db.transaction((tx) => {
		const existing = tx.select().from(item).where(eq(item.id, id)).get();
		if (!existing) {
			throw new ItemNotFoundError(id);
		}
		const record = tx.select().from(biblio).where(eq(biblio.id, existing.biblioId)).get();
		const suggested = record
			? suggestedCallNumber(rules, record, input.readingLevel || existing.readingLevel)
			: "";
		const data = validateItem(
			demoItem(input, suggested, existing, now),
			rules,
			(record?.kind ?? null) as BiblioKind | null,
		);
		const current: ItemData = {
			itemType: existing.itemType,
			callNumber: existing.callNumber,
			readingLevel: existing.readingLevel,
			enumeration: existing.enumeration,
			acquisitionDate: existing.acquisitionDate,
			notes: existing.notes,
			notForLoan: existing.notForLoan === 1,
		};
		const changed = ITEM_TRACKED.filter((k) => (current[k] ?? null) !== (data[k] ?? null));
		if (changed.length === 0) {
			return [];
		}
		// a new segnatura is on the spine band and on the barcode label: both are to print again,
		// as after a reclassification (9.42)
		const relabel = changed.includes("callNumber")
			? { spineLabelPrintedAt: null, barcodeLabelPrintedAt: null }
			: {};
		tx.update(item)
			.set({
				...data,
				...relabel,
				notForLoan: data.notForLoan ? 1 : 0,
				updatedAt: now.toISOString(),
			})
			.where(eq(item.id, id))
			.run();
		audit(tx, actor, "item.update", "item", id, { changed }, now);
		return changed;
	});
}

/**
 * Record and its single copy saved together (the edit page shows the copy's fields when the
 * record has exactly one): both updates in one transaction, so a refused copy leaves the
 * record untouched too.
 */
export function updateBiblioWithItem(
	db: Db,
	id: number,
	input: BiblioFormInput,
	itemId: number,
	itemInput: ItemFormInput,
	actor: AuditActor,
	rules: CatalogRules,
	now = new Date(),
): { biblio: string[]; item: string[] } {
	return db.transaction((tx) => {
		const owner = tx
			.select({ biblioId: item.biblioId })
			.from(item)
			.where(eq(item.id, itemId))
			.get();
		if (owner?.biblioId !== id) {
			throw new ItemNotFoundError(itemId);
		}
		const changedBiblio = updateBiblio(tx, id, input, actor, rules, now);
		const changedItem = updateItem(tx, itemId, itemInput, actor, rules, now);
		return { biblio: changedBiblio, item: changedItem };
	});
}

/**
 * Status change with a reason (lost, damaged, in repair, withdrawn, back to available). A copy
 * on loan cannot be withdrawn; marking it lost closes its loan with a `lost` event (step 4.8), so
 * the patron no longer counts it among the open loans and the history says what happened.
 */
/** The reason the desk gives a copy returned damaged (not typed by the operator). */
export const CHECK_IN_REASON = "check-in";

export function setItemStatus(
	db: Db,
	id: number,
	status: ItemStatus,
	sentReason: string | null,
	actor: AuditActor,
	now = new Date(),
): void {
	if (!ITEM_STATUS_VALUES.includes(status)) {
		throw new CatalogValidationError([{ field: "status", code: "itemTypeUnknown" }]);
	}
	// the public demo stores its example reason (Q121)
	const reason =
		sentReason === CHECK_IN_REASON
			? sentReason
			: demoText("reason", sentReason ?? "", null, now);
	db.transaction((tx) => {
		const existing = tx
			.select({ id: item.id, status: item.status })
			.from(item)
			.where(eq(item.id, id))
			.get();
		if (!existing) {
			throw new ItemNotFoundError(id);
		}
		const open = openLoanOf(tx, id);
		if (status === "withdrawn" && open) {
			throw new ItemOnLoanError(id);
		}
		const stamp = now.toISOString();
		if (status === "lost" && open) {
			tx.update(loan)
				.set({ returnedAt: stamp, returnedBy: actor.id, updatedAt: stamp })
				.where(eq(loan.id, open.loanId))
				.run();
			tx.insert(loanEvent)
				.values({
					loanId: open.loanId,
					type: "lost",
					at: stamp,
					byUserId: actor.id,
					details: reason?.trim() ? { reason: reason.trim() } : null,
				})
				.run();
		}
		tx.update(item).set({ status, updatedAt: stamp }).where(eq(item.id, id)).run();
		audit(
			tx,
			actor,
			"item.status",
			"item",
			id,
			{ from: existing.status, to: status, reason: reason?.trim() || undefined },
			now,
		);
	});
}

/** Deleting a copy is allowed only while it was never lent (a mistake of cataloguing). */
export function deleteItem(db: Db, id: number, actor: AuditActor, now = new Date()): void {
	db.transaction((tx) => {
		const existing = tx.select({ id: item.id }).from(item).where(eq(item.id, id)).get();
		if (!existing) {
			throw new ItemNotFoundError(id);
		}
		const loans = tx.select({ id: loan.id }).from(loan).where(eq(loan.itemId, id)).all().length;
		if (loans > 0) {
			throw new ItemOnLoanError(id);
		}
		tx.delete(item).where(eq(item.id, id)).run();
		audit(tx, actor, "item.delete", "item", id, undefined, now);
	});
}
