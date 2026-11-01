// SPDX-License-Identifier: GPL-3.0-or-later
// Anonymization (PLAN.md step 2.9, Q33/Q71): removing a patron erases the personal data at once
// and for good, keeping everything that serves statistics (type, class, section, loans and their
// snapshots). No timer, no `left` state, no scheduled job. Callers: the patron page, the grid
// selection, the student synchronisation of the import (2.6) and the class upgrade (7.1). Every
// caller that removes patrons outside a larger transaction covers their faces right after it
// (`coverRemovedFaces`); the class upgrade deletes the class pictures in its own transaction.
import { forgetWishRequester } from "./wishlist.js";
import { eraseFramesOfPatron, paintErasedFrames } from "./class-sheet-erasure.js";
import { and, eq, isNull } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { loan, patron } from "#lib/server/db/schema.js";
import { audit, type AuditActor } from "./audit.js";
import { removePhotoFiles } from "./media.js";
import { PatronNotFoundError, searchNameOf } from "./patrons.js";

export class PatronHasOpenLoansError extends Error {
	constructor(
		readonly id: number,
		readonly openLoans: number,
	) {
		super(`patron ${id} has ${openLoans} open loan(s)`);
		this.name = "PatronHasOpenLoansError";
	}
}

export interface RemoveManyResult {
	removed: number[];
	/** Patrons kept because they still have open loans (must be returned or marked lost first). */
	keptOpenLoans: number[];
	/** Already anonymized or unknown ids: nothing to do. */
	skipped: number[];
}

/**
 * "Rimuovi selezionati" from the patron grid: each patron is anonymized in its own savepoint so
 * one with open loans does not stop the others; the caller shows what was kept and why.
 */
export function anonymizePatrons(
	db: DbOrTx,
	dataDir: string,
	ids: readonly number[],
	actor: AuditActor | null,
	now = new Date(),
): RemoveManyResult {
	const result: RemoveManyResult = { removed: [], keptOpenLoans: [], skipped: [] };
	for (const id of new Set(ids)) {
		try {
			if (anonymizePatron(db, dataDir, id, actor, now)) {
				result.removed.push(id);
			} else {
				result.skipped.push(id);
			}
		} catch (e) {
			if (e instanceof PatronHasOpenLoansError) {
				result.keptOpenLoans.push(id);
			} else if (e instanceof PatronNotFoundError) {
				result.skipped.push(id);
			} else {
				throw e;
			}
		}
	}
	return result;
}

/**
 * After the transaction that removed patrons has committed: their faces painted over in the class
 * pictures (Phase 13, Q106; decoding and encoding a picture cannot run inside a transaction). A
 * failure is logged, never thrown: the picture route, the backups, the exports and the next start
 * paint again before a picture is read.
 */
export async function coverRemovedFaces(db: Db, dataDir: string): Promise<void> {
	try {
		await paintErasedFrames(db, dataDir);
	} catch (e) {
		console.error(`[census] covering removed faces failed: ${(e as Error).message}`);
	}
}

/** "Rimuovi studente/docente": one patron removed, their faces covered before the answer. */
export async function removePatronNow(
	db: Db,
	dataDir: string,
	id: number,
	actor: AuditActor | null,
	now = new Date(),
): Promise<boolean> {
	const removed = anonymizePatron(db, dataDir, id, actor, now);
	await coverRemovedFaces(db, dataDir);
	return removed;
}

/** "Rimuovi selezionati": `anonymizePatrons`, then the faces covered before the answer. */
export async function removePatronsNow(
	db: Db,
	dataDir: string,
	ids: readonly number[],
	actor: AuditActor | null,
	now = new Date(),
): Promise<RemoveManyResult> {
	const result = anonymizePatrons(db, dataDir, ids, actor, now);
	await coverRemovedFaces(db, dataDir);
	return result;
}

export function openLoanCount(db: DbOrTx, patronId: number): number {
	return db
		.select({ id: loan.id })
		.from(loan)
		.where(and(eq(loan.patronId, patronId), isNull(loan.returnedAt)))
		.all().length;
}

/**
 * Erases names, contacts, notes, external id, card number (retired: the sequence never reuses
 * it) and the photo; sets `status = 'anonymized'`. Refuses a patron with open loans (they must be
 * returned or marked lost first). Returns false when the patron was already anonymized.
 * Runs as a savepoint inside the caller's transaction when given one (the import commit).
 */
export function anonymizePatron(
	db: DbOrTx,
	dataDir: string,
	id: number,
	actor: AuditActor | null,
	now = new Date(),
): boolean {
	const run = (tx: DbOrTx): boolean => {
		const existing = tx
			.select({
				status: patron.status,
				patronType: patron.patronType,
				photoPath: patron.photoPath,
			})
			.from(patron)
			.where(eq(patron.id, id))
			.get();
		if (!existing) {
			throw new PatronNotFoundError(id);
		}
		if (existing.status === "anonymized") {
			return false;
		}
		const open = openLoanCount(tx, id);
		if (open > 0) {
			throw new PatronHasOpenLoansError(id, open);
		}
		const firstName = existing.patronType === "teacher" ? "Docente" : "Studente";
		const lastName = `Rimosso #${id}`;
		tx.update(patron)
			.set({
				firstName,
				lastName,
				searchName: searchNameOf(lastName, firstName),
				email: null,
				notes: null,
				circulationNote: null,
				externalId: null,
				cardNumber: null,
				cardPrintedAt: null,
				photoPath: null,
				status: "anonymized",
				anonymizedAt: now.toISOString(),
				updatedAt: now.toISOString(),
			})
			.where(eq(patron.id, id))
			.run();
		// the wishes the patron asked for stay, without the patron (step 9.15)
		forgetWishRequester(tx, id);
		// their frames in the class pictures are erased: photo files deleted now, the faces painted
		// over right after the transaction (`coverRemovedFaces`, Phase 13, Q106)
		const frames = eraseFramesOfPatron(tx, dataDir, id, now);
		if (existing.photoPath) {
			removePhotoFiles(dataDir, existing.photoPath);
		}
		audit(
			tx,
			actor,
			"patron.anonymize",
			"patron",
			id,
			{
				patronType: existing.patronType,
				...(frames > 0 ? { classSheetFrames: frames } : {}),
			},
			now,
		);
		return true;
	};
	// a nested call becomes a savepoint inside the caller's transaction
	return db.transaction((tx) => run(tx));
}
