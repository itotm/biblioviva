// SPDX-License-Identifier: GPL-3.0-or-later
// Circulation desk (PLAN.md steps 4.3–4.5, Appendix I): the patron panel, checkout with the rules
// of 4.2 (one transaction per copy, `issue` event, override with a reason), the undo of the last
// checkout of a session, check-in (with lost copies found again) and renewals (also "Rinnova
// invece" right after a return). Plain functions `(db, input, actor)`; refusals come back as
// Appendix I reason codes with the parameters of their message. What a scanned code is lives
// beside the barcode lookups (`resolveScan`, `#lib/server/barcodes/lookup.ts`).
import { NotFoundError } from "#lib/server/errors.js";
import { classLabelOf } from "#lib/server/school/snapshot.js";
import { patronFullName } from "#lib/shared/patron-name.js";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { AppConfig } from "#lib/server/config/schema.js";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, loan, loanEvent, patron } from "#lib/server/db/schema.js";
import { daysBetween } from "#lib/shared/calendar-core.js";
import { zonedParts } from "#lib/shared/dates.js";
import { audit, type AuditActor } from "./audit.js";
import { demoText } from "#lib/server/demo/content.js";
import { setItemStatus } from "./catalog-items.js";
import { insertLoan } from "./loan-insert.js";
import { quickSearchPatrons, type QuickPatron } from "./patron-search.js";
import { calendarRules, libraryToday } from "./calendar.js";
import {
	canCheckout,
	canRenew,
	resolveRule,
	type CheckoutRefusal,
	type OpenLoanInfo,
	type RenewalRefusal,
} from "./circulation-rules.js";
import { deskTitles, shortTitle } from "#lib/shared/desk-titles.js";

// --- The patron panel ---------------------------------------------------------------------------

export interface DeskLoan {
	loanId: number;
	itemId: number;
	barcode: string;
	title: string;
	itemType: string;
	issuedAt: string;
	dueDate: string;
	renewals: number;
	overdue: boolean;
}

export interface DeskPatron {
	id: number;
	firstName: string;
	lastName: string;
	patronType: string;
	/** `3 B` or the teachers group's name (Phase 12). */
	classLabel: string;
	cardNumber: string | null;
	hasPhoto: boolean;
	status: string;
	circulationNote: string | null;
	loans: DeskLoan[];
	/** The patron type's loan limit. */
	maxLoans: number;
}

export class DeskNotFoundError extends NotFoundError {
	constructor(
		readonly what: "patron" | "item" | "loan",
		readonly id: number,
	) {
		super(what, `${what} ${id} not found`);
		this.name = "DeskNotFoundError";
	}
}

export function openLoansOf(db: DbOrTx, patronId: number, today: string): DeskLoan[] {
	return db
		.select({
			loanId: loan.id,
			itemId: item.id,
			barcode: item.barcode,
			title: biblio.title,
			itemType: item.itemType,
			issuedAt: loan.issuedAt,
			dueDate: loan.dueDate,
			renewals: loan.renewals,
		})
		.from(loan)
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(and(eq(loan.patronId, patronId), isNull(loan.returnedAt)))
		.orderBy(asc(loan.dueDate), asc(loan.id))
		.all()
		.map((l) => ({ ...l, overdue: l.dueDate < today }));
}

export function deskPatron(
	db: DbOrTx,
	config: AppConfig,
	patronId: number,
	today: string,
): DeskPatron {
	const p = db.select().from(patron).where(eq(patron.id, patronId)).get();
	if (!p) {
		throw new DeskNotFoundError("patron", patronId);
	}
	return {
		id: p.id,
		firstName: p.firstName,
		lastName: p.lastName,
		patronType: p.patronType,
		classLabel: classLabelOf(db, p.id),
		cardNumber: p.cardNumber,
		hasPhoto: p.photoPath !== null,
		status: p.status,
		circulationNote: p.circulationNote,
		loans: openLoansOf(db, p.id, today),
		maxLoans: resolveRule(config, p.patronType, "").maxLoans,
	};
}

/** Patrons by surname for the desk's autocomplete (step 5.2 search; anonymized ones never appear). */
export function findDeskPatrons(
	db: DbOrTx,
	q: string,
	/** The installation's language: the order of the closest names. */
	locale: string,
	limit = 8,
): QuickPatron[] {
	return quickSearchPatrons(db, q, { limit, locale });
}

// --- Checkout -----------------------------------------------------------------------------------

export type DeskInfo =
	| { code: "calendar_closed_due_date"; due: string }
	| { code: "hard_due_date_applied"; due: string }
	| { code: "patron_has_overdues"; n: number; titles: string };

export interface CheckedOut {
	loanId: number;
	itemId: number;
	barcode: string;
	title: string;
	dueDate: string;
}

export type CheckoutResult =
	| { ok: true; loan: CheckedOut; infos: DeskInfo[] }
	| {
			ok: false;
			reason: CheckoutRefusal;
			overridable: boolean;
			params: Record<string, string | number>;
			/** For `item_on_loan_same_patron`: the loan that could be renewed. */
			loanId?: number;
			/** The record of the copy (the "Apri scheda copia" action). */
			biblioId: number;
	  };

/**
 * Lends a copy to a patron in one transaction (loan, `issue` event, snapshots of the patron's
 * type and class, school year). With `override` (administrators, overridable reasons only) the
 * reason is stored in an `override` event and in the audit log.
 */
export function checkoutItem(
	db: Db,
	config: AppConfig,
	input: { patronId: number; itemId: number; override?: { reason: string } },
	actor: AuditActor,
	now = new Date(),
): CheckoutResult {
	const today = libraryToday(config, now);
	const cal = calendarRules(config);
	return db.transaction((tx) => {
		const p = tx.select().from(patron).where(eq(patron.id, input.patronId)).get();
		if (!p) {
			throw new DeskNotFoundError("patron", input.patronId);
		}
		const it = tx
			.select({ i: item, title: biblio.title, kind: biblio.kind })
			.from(item)
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.where(eq(item.id, input.itemId))
			.get();
		if (!it) {
			throw new DeskNotFoundError("item", input.itemId);
		}
		const title = shortTitle(it.title);
		const patronLoans = openLoansOf(tx, p.id, today);
		const itemLoan = tx
			.select({ id: loan.id, patronId: loan.patronId, issuedAt: loan.issuedAt })
			.from(loan)
			.where(and(eq(loan.itemId, it.i.id), isNull(loan.returnedAt)))
			.get();
		const infos: OpenLoanInfo[] = patronLoans.map((l) => ({
			itemId: l.itemId,
			itemType: l.itemType,
			title: l.title,
			dueDate: l.dueDate,
		}));
		const decision = canCheckout(
			config,
			cal,
			{
				patron: { id: p.id, status: p.status, patronType: p.patronType },
				item: {
					id: it.i.id,
					status: it.i.status,
					notForLoan: it.i.notForLoan === 1,
					itemType: it.i.itemType,
					classified: it.kind !== null,
				},
				patronLoans: infos,
				itemLoan: itemLoan ?? null,
				today,
			},
			{ override: input.override !== undefined },
		);
		const name = patronFullName(p);
		if (!decision.ok) {
			const params: Record<string, string | number> = { title, name };
			if (
				decision.reason === "loan_limit_reached" ||
				decision.reason === "patron_has_overdues"
			) {
				params.n = decision.loans?.length ?? 0;
				params.titles = deskTitles(decision.loans ?? []);
				params.max = decision.max ?? 0;
			}
			if (decision.reason === "item_status_unavailable") {
				params.status = it.i.status;
			}
			if (itemLoan) {
				params.date = itemLoan.issuedAt.slice(0, 10);
				if (itemLoan.patronId !== p.id) {
					const other = tx
						.select({ firstName: patron.firstName, lastName: patron.lastName })
						.from(patron)
						.where(eq(patron.id, itemLoan.patronId))
						.get();
					params.other = other ? patronFullName(other) : "?";
				}
			}
			return {
				ok: false,
				reason: decision.reason,
				overridable: decision.overridable,
				params,
				loanId: decision.reason === "item_on_loan_same_patron" ? itemLoan?.id : undefined,
				biblioId: it.i.biblioId,
			};
		}
		const stamp = now.toISOString();
		const loanId = insertLoan(tx, {
			itemId: it.i.id,
			patronId: p.id,
			patronType: p.patronType,
			issuedAt: stamp,
			issuedOn: today,
			dueDate: decision.dueDate.due,
			schoolYearStart: config.library.schoolYearStart,
			byUserId: actor.id,
			createdAt: stamp,
		});
		if (input.override) {
			// the public demo stores its example reason (Q121)
			const overrideReason = demoText("reason", input.override.reason, null, now);
			tx.insert(loanEvent)
				.values({
					loanId,
					type: "override",
					at: stamp,
					byUserId: actor.id,
					details: { reason: overrideReason },
				})
				.run();
			audit(tx, actor, "loan.override", "loan", loanId, { reason: overrideReason }, now);
		}
		const result: DeskInfo[] = [];
		if (decision.dueDate.capped) {
			result.push({ code: "hard_due_date_applied", due: decision.dueDate.due });
		} else if (decision.dueDate.moved) {
			result.push({ code: "calendar_closed_due_date", due: decision.dueDate.due });
		}
		if (decision.overdue.length > 0) {
			result.push({
				code: "patron_has_overdues",
				n: decision.overdue.length,
				titles: deskTitles(decision.overdue),
			});
		}
		return {
			ok: true,
			loan: {
				loanId,
				itemId: it.i.id,
				barcode: it.i.barcode,
				title,
				dueDate: decision.dueDate.due,
			},
			infos: result,
		};
	});
}

/**
 * "Annulla ultimo": a checkout made by mistake is removed as if it never happened (the copy is
 * available again), only while it is still open and was made today; the audit keeps a trace.
 */
export function undoCheckout(
	db: Db,
	config: AppConfig,
	loanId: number,
	actor: AuditActor,
	now = new Date(),
): { title: string; name: string } {
	return db.transaction((tx) => {
		const row = tx
			.select({
				l: loan,
				title: biblio.title,
				firstName: patron.firstName,
				lastName: patron.lastName,
			})
			.from(loan)
			.innerJoin(item, eq(item.id, loan.itemId))
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.innerJoin(patron, eq(patron.id, loan.patronId))
			.where(eq(loan.id, loanId))
			.get();
		const today = libraryToday(config, now);
		if (!row) {
			throw new DeskNotFoundError("loan", loanId);
		}
		if (
			row.l.returnedAt !== null ||
			libraryToday(config, new Date(row.l.issuedAt)) !== today ||
			row.l.renewals > 0
		) {
			throw new DeskNotFoundError("loan", loanId);
		}
		tx.delete(loan).where(eq(loan.id, loanId)).run();
		audit(tx, actor, "loan.undo", "item", row.l.itemId, { patron: row.l.patronId }, now);
		return { title: shortTitle(row.title), name: patronFullName(row) };
	});
}

// --- Renewal ------------------------------------------------------------------------------------

export type RenewResult =
	| {
			ok: true;
			loanId: number;
			barcode: string;
			title: string;
			dueDate: string;
			renewals: number;
	  }
	| {
			ok: false;
			loanId: number;
			/** The copy's barcode (the "Restituisci" action carries it to the Returns page). */
			barcode: string;
			reason: RenewalRefusal;
			/** An administrator may force it with a reason (limit and overdue block only). */
			overridable: boolean;
			params: Record<string, string | number>;
	  };

/**
 * Renews an open loan with the rules of 4.2 (`renew` event, renewal count, new due date). With
 * `override` (administrators) the renewal limit and the overdue block are skipped and the reason
 * is stored in an `override` event and in the audit log.
 */
export function renewLoan(
	db: Db,
	config: AppConfig,
	input: { loanId: number; override?: { reason: string } },
	actor: AuditActor,
	now = new Date(),
): RenewResult {
	return db.transaction((tx) =>
		renewIn(tx, config, input.loanId, actor, now, false, input.override),
	);
}

/**
 * "Rinnova tutti" (step 4.5): every open loan of a patron, each with its own decision; the ones
 * the rules refuse come back with their reason, the others are renewed.
 */
export function renewAllLoans(
	db: Db,
	config: AppConfig,
	patronId: number,
	actor: AuditActor,
	now = new Date(),
): RenewResult[] {
	return db.transaction((tx) => {
		const exists = tx
			.select({ id: patron.id })
			.from(patron)
			.where(eq(patron.id, patronId))
			.get();
		if (!exists) {
			throw new DeskNotFoundError("patron", patronId);
		}
		return openLoansOf(tx, patronId, libraryToday(config, now)).map((l) =>
			renewIn(tx, config, l.loanId, actor, now, false),
		);
	});
}

/**
 * "Rinnova invece" at the check-in desk: a loan returned today by mistake (the pupil wanted to keep
 * the book) is reopened and renewed in one step. When the rules refuse the renewal, the return
 * stays registered.
 */
export function renewInsteadOfReturn(
	db: Db,
	config: AppConfig,
	loanId: number,
	actor: AuditActor,
	now = new Date(),
): RenewResult {
	return db.transaction((tx) => renewIn(tx, config, loanId, actor, now, true));
}

function renewIn(
	tx: DbOrTx,
	config: AppConfig,
	loanId: number,
	actor: AuditActor,
	now: Date,
	reopen: boolean,
	override?: { reason: string },
): RenewResult {
	const today = libraryToday(config, now);
	const row = tx
		.select({
			l: loan,
			title: biblio.title,
			barcode: item.barcode,
			itemType: item.itemType,
			patronType: patron.patronType,
		})
		.from(loan)
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.innerJoin(patron, eq(patron.id, loan.patronId))
		.where(eq(loan.id, loanId))
		.get();
	if (!row) {
		throw new DeskNotFoundError("loan", loanId);
	}
	if (reopen) {
		const returnedToday =
			row.l.returnedAt !== null && libraryToday(config, new Date(row.l.returnedAt)) === today;
		if (!returnedToday || openLoanIdOf(tx, row.l.itemId) !== null) {
			throw new DeskNotFoundError("loan", loanId);
		}
	} else if (row.l.returnedAt !== null) {
		throw new DeskNotFoundError("loan", loanId);
	}
	const title = shortTitle(row.title);
	const decision = canRenew(
		config,
		calendarRules(config),
		{
			patronType: row.patronType,
			itemType: row.itemType,
			dueDate: row.l.dueDate,
			renewals: row.l.renewals,
			today,
		},
		{ override: override !== undefined },
	);
	if (!decision.ok) {
		return {
			ok: false,
			loanId,
			barcode: row.barcode,
			reason: decision.reason,
			overridable: decision.overridable,
			params: {
				title,
				n: row.l.renewals,
				days: decision.days ?? 0,
				due: row.l.dueDate,
			},
		};
	}
	const stamp = now.toISOString();
	if (reopen) {
		tx.delete(loanEvent)
			.where(and(eq(loanEvent.loanId, loanId), eq(loanEvent.type, "return")))
			.run();
		tx.update(loan)
			.set({ returnedAt: null, returnedBy: null, updatedAt: stamp })
			.where(eq(loan.id, loanId))
			.run();
	}
	// a renewal that would not move the due date is not counted (on the day of the loan
	// "Rinnova invece" simply takes the return back)
	if (decision.unchanged) {
		return {
			ok: true,
			loanId,
			barcode: row.barcode,
			title,
			dueDate: row.l.dueDate,
			renewals: row.l.renewals,
		};
	}
	tx.update(loan)
		.set({
			dueDate: decision.dueDate.due,
			renewals: row.l.renewals + 1,
			lastRenewedAt: stamp,
			updatedAt: stamp,
		})
		.where(eq(loan.id, loanId))
		.run();
	tx.insert(loanEvent)
		.values({
			loanId,
			type: "renew",
			at: stamp,
			byUserId: actor.id,
			details: { from: row.l.dueDate, to: decision.dueDate.due },
		})
		.run();
	if (override) {
		const reason = demoText("reason", override.reason, null, now);
		tx.insert(loanEvent)
			.values({
				loanId,
				type: "override",
				at: stamp,
				byUserId: actor.id,
				details: { reason, renewal: true },
			})
			.run();
		audit(tx, actor, "loan.override", "loan", loanId, { reason }, now);
	}
	return {
		ok: true,
		loanId,
		barcode: row.barcode,
		title,
		dueDate: decision.dueDate.due,
		renewals: row.l.renewals + 1,
	};
}

// --- Check-in -----------------------------------------------------------------------------------

function openLoanIdOf(tx: DbOrTx, itemId: number): number | null {
	return (
		tx
			.select({ id: loan.id })
			.from(loan)
			.where(and(eq(loan.itemId, itemId), isNull(loan.returnedAt)))
			.get()?.id ?? null
	);
}

export interface ReturnedLoan {
	loanId: number;
	itemId: number;
	barcode: string;
	title: string;
	biblioId: number;
	patronId: number;
	name: string;
	patronType: string;
	classLabel: string;
	/** Local date of the loan (`YYYY-MM-DD`). */
	issuedOn: string;
	dueDate: string;
	/** Calendar days past the due date (0 when on time): information only, there are no fines. */
	overdueDays: number;
	renewals: number;
	/** The patron's loans still overdue after this return ("Stampa promemoria"). */
	patronOverdue: number;
}

export type CheckinResult =
	| { kind: "returned"; loan: ReturnedLoan; wasLost: boolean }
	| {
			kind: "not_on_loan";
			itemId: number;
			title: string;
			biblioId: number;
			/** The copy was marked lost and is available again (`was_lost_now_found`). */
			wasLost: boolean;
	  }
	| { kind: "already_returned_today"; itemId: number; title: string; time: string };

/**
 * Registers the return of a copy (Appendix I): closes its open loan (`return` event), reports the
 * days late, puts a copy marked lost back to available (`found` event on its last loan, audit).
 * A copy with no open loan is explained (`not_on_loan`, `already_returned_today`).
 */
export function checkinItem(
	db: Db,
	config: AppConfig,
	itemId: number,
	actor: AuditActor,
	now = new Date(),
): CheckinResult {
	const today = libraryToday(config, now);
	const stamp = now.toISOString();
	return db.transaction((tx) => {
		const it = tx
			.select({ i: item, title: biblio.title })
			.from(item)
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.where(eq(item.id, itemId))
			.get();
		if (!it) {
			throw new DeskNotFoundError("item", itemId);
		}
		const title = shortTitle(it.title);
		const open = tx
			.select({ l: loan, p: patron })
			.from(loan)
			.innerJoin(patron, eq(patron.id, loan.patronId))
			.where(and(eq(loan.itemId, itemId), isNull(loan.returnedAt)))
			.get();
		const wasLost = it.i.status === "lost";
		if (wasLost) {
			const last =
				open?.l.id ??
				tx
					.select({ id: loan.id })
					.from(loan)
					.where(eq(loan.itemId, itemId))
					.orderBy(desc(loan.issuedAt))
					.get()?.id;
			tx.update(item)
				.set({ status: "available", updatedAt: stamp })
				.where(eq(item.id, itemId))
				.run();
			if (last !== undefined) {
				tx.insert(loanEvent)
					.values({ loanId: last, type: "found", at: stamp, byUserId: actor.id })
					.run();
			}
			audit(
				tx,
				actor,
				"item.status",
				"item",
				itemId,
				{ from: "lost", to: "available", reason: "check-in" },
				now,
			);
		}
		if (open) {
			tx.update(loan)
				.set({ returnedAt: stamp, returnedBy: actor.id, updatedAt: stamp })
				.where(eq(loan.id, open.l.id))
				.run();
			tx.insert(loanEvent)
				.values({ loanId: open.l.id, type: "return", at: stamp, byUserId: actor.id })
				.run();
			return {
				kind: "returned",
				wasLost,
				loan: {
					loanId: open.l.id,
					itemId,
					barcode: it.i.barcode,
					title,
					biblioId: it.i.biblioId,
					patronId: open.p.id,
					name: patronFullName(open.p),
					patronType: open.p.patronType,
					classLabel: classLabelOf(tx, open.p.id),
					issuedOn: libraryToday(config, new Date(open.l.issuedAt)),
					dueDate: open.l.dueDate,
					overdueDays: Math.max(0, daysBetween(open.l.dueDate, today)),
					renewals: open.l.renewals,
					patronOverdue: openLoansOf(tx, open.p.id, today).filter((l) => l.overdue)
						.length,
				},
			};
		}
		const lastReturn = tx
			.select({ at: loan.returnedAt })
			.from(loan)
			.where(eq(loan.itemId, itemId))
			.orderBy(desc(loan.returnedAt))
			.get()?.at;
		if (!wasLost && lastReturn && libraryToday(config, new Date(lastReturn)) === today) {
			return {
				kind: "already_returned_today",
				itemId,
				title,
				time: timeIn(new Date(lastReturn), config.library.timezone),
			};
		}
		return { kind: "not_on_loan", itemId, title, biblioId: it.i.biblioId, wasLost };
	});
}

/** `HH:mm` of an instant in the library's time zone. */
function timeIn(instant: Date, timezone: string): string {
	const { hour, minute } = zonedParts(instant, timezone);
	return `${hour}:${minute}`;
}

/**
 * "Segna smarrito" on an open loan (step 4.8): the copy becomes `lost` and the loan closes with a
 * `lost` event (`setItemStatus`); scanning the copy at the returns desk makes it available again.
 */
export function markLoanLost(
	db: Db,
	loanId: number,
	reason: string | null,
	actor: AuditActor,
	now = new Date(),
): { title: string; patronId: number } {
	const row = db
		.select({ itemId: loan.itemId, patronId: loan.patronId, title: biblio.title })
		.from(loan)
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(and(eq(loan.id, loanId), isNull(loan.returnedAt)))
		.get();
	if (!row) {
		throw new DeskNotFoundError("loan", loanId);
	}
	setItemStatus(db, row.itemId, "lost", reason, actor, now);
	return { title: shortTitle(row.title), patronId: row.patronId };
}
