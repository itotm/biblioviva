// SPDX-License-Identifier: GPL-3.0-or-later
// The one way a loan is born, at the desk (checkout) and from a loans import: the loan row with
// the snapshots of the patron's type and class (Q95: never rewritten afterwards) and its school
// year, and the `issue` event.
import type { DbOrTx } from "#lib/server/db/client.js";
import { loan, loanEvent } from "#lib/server/db/schema.js";
import { classSnapshot } from "#lib/server/school/snapshot.js";
import { schoolYearFor } from "#lib/shared/school-year.js";

export interface NewLoan {
	itemId: number;
	patronId: number;
	/** The patron's type now, kept on the loan. */
	patronType: (typeof loan.$inferInsert)["patronTypeSnapshot"];
	/** The instant of the loan (ISO), also the instant of its `issue` event. */
	issuedAt: string;
	/** The library's day of the loan (`YYYY-MM-DD`): it decides the school year. */
	issuedOn: string;
	dueDate: string;
	/** `library.schoolYearStart` (`MM-DD`). */
	schoolYearStart: string;
	/** The staff account that lends (or imports) the copy. */
	byUserId: number;
	/** When the row is written (ISO). */
	createdAt: string;
	/** What the `issue` event records besides (the import batch). */
	details?: Record<string, unknown>;
}

/** Writes a loan and its `issue` event; returns the loan's id. */
export function insertLoan(tx: DbOrTx, l: NewLoan): number {
	const created = tx
		.insert(loan)
		.values({
			itemId: l.itemId,
			patronId: l.patronId,
			issuedAt: l.issuedAt,
			dueDate: l.dueDate,
			issuedBy: l.byUserId,
			patronTypeSnapshot: l.patronType,
			...classSnapshot(tx, l.patronId),
			schoolYear: schoolYearFor(l.issuedOn, l.schoolYearStart),
			createdAt: l.createdAt,
			updatedAt: l.createdAt,
		})
		.returning({ id: loan.id })
		.get();
	tx.insert(loanEvent)
		.values({
			loanId: created.id,
			type: "issue",
			at: l.issuedAt,
			byUserId: l.byUserId,
			...(l.details ? { details: l.details } : {}),
		})
		.run();
	return created.id;
}
