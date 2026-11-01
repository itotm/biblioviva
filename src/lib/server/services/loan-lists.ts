// SPDX-License-Identifier: GPL-3.0-or-later
// Lists of loans (PLAN.md steps 4.6–4.7): every open loan with its patron, class and delay for the
// loans grid, the overdue ones for the notices, "Segna solleciti stampati" (`notice_printed`
// events), the loans of a checkout receipt, the loan history of a record and of a patron, and
// today's activity.
import { schoolYearLabel, type SchoolYearLabel } from "#lib/shared/school-year.js";
import { patronFullName } from "#lib/shared/patron-name.js";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, sql, type SQL } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, loan, loanEvent, patron, patronClass } from "#lib/server/db/schema.js";
import { daysBetween } from "#lib/shared/calendar-core.js";
import { dayRangeToUtc } from "#lib/shared/dates.js";
import { compareClassKeys, type ClassOrderKey, type GroupKind } from "#lib/shared/school.js";
import { escapeLike } from "#lib/shared/text.js";
import { audit, type AuditActor } from "./audit.js";
import type { OverdueSource } from "./overdues.js";
import { patronNameCondition } from "./patron-search.js";
import { PatronNotFoundError } from "./patrons.js";

export interface LoanListFilters {
	/** The patron's level now (Phase 12). */
	levelCode?: string;
	/** The patron's class (group) now. */
	groupId?: number;
	patronType?: "student" | "teacher";
	patronId?: number;
	overdueOnly?: boolean;
	/** A patron as the patron search finds them (name, card), or a barcode prefix. */
	q?: string;
}

export interface OpenLoanRow extends OverdueSource {
	itemId: number;
	biblioId: number;
	issuedAt: string;
	renewals: number;
	/** Calendar days past the due date, 0 when not overdue. */
	daysOverdue: number;
}

const lastNotice = sql<
	string | null
>`(SELECT MAX(e.at) FROM loan_event e WHERE e.loan_id = loan.id AND e.type = 'notice_printed')`;

/** Open loans, overdue first (oldest due date first), with the date of the last notice. */
export function openLoanRows(
	db: DbOrTx,
	today: string,
	filters: LoanListFilters = {},
): OpenLoanRow[] {
	const where: SQL[] = [isNull(loan.returnedAt)];
	if (filters.levelCode) {
		where.push(eq(patron.levelCode, filters.levelCode));
	}
	if (filters.groupId !== undefined) {
		where.push(eq(patron.classGroupId, filters.groupId));
	}
	if (filters.patronType) {
		where.push(eq(patron.patronType, filters.patronType));
	}
	if (filters.patronId !== undefined) {
		where.push(eq(patron.id, filters.patronId));
	}
	if (filters.overdueOnly) {
		where.push(lt(loan.dueDate, today));
	}
	const text = filters.q?.trim() ?? "";
	if (text) {
		// the patron as the patron search finds them, or the beginning of the copy's barcode
		const barcode = sql`${item.barcode} LIKE ${`${escapeLike(text)}%`} ESCAPE '\\'`;
		const name = patronNameCondition(text);
		where.push(name ? sql`(${name} OR ${barcode})` : barcode);
	}
	return db
		.select({
			loanId: loan.id,
			patronId: patron.id,
			firstName: patron.firstName,
			lastName: patron.lastName,
			patronType: patron.patronType,
			groupId: patron.classGroupId,
			groupName: patronClass.groupName,
			levelPosition: patronClass.levelPosition,
			classLabel: patronClass.classLabel,
			itemId: item.id,
			biblioId: biblio.id,
			title: biblio.title,
			author: biblio.author,
			barcode: item.barcode,
			issuedAt: loan.issuedAt,
			dueDate: loan.dueDate,
			renewals: loan.renewals,
			lastNoticeAt: lastNotice,
		})
		.from(loan)
		.innerJoin(patron, eq(patron.id, loan.patronId))
		.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(and(...where))
		.orderBy(asc(loan.dueDate), asc(patron.searchName), asc(loan.id))
		.all()
		.map((r) => ({ ...r, daysOverdue: Math.max(0, daysBetween(r.dueDate, today)) }));
}

/** How many loans are open (the open-loans page before its grid loads). */
export function openLoanCount(db: DbOrTx): number {
	return (
		db
			.select({ n: sql<number>`count(*)` })
			.from(loan)
			.innerJoin(patron, eq(patron.id, loan.patronId))
			.innerJoin(item, eq(item.id, loan.itemId))
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.where(isNull(loan.returnedAt))
			.get()?.n ?? 0
	);
}

/** The classes (groups) with open loans, in class order (the filter of the loans grid). */
export function openLoanFilterOptions(db: DbOrTx): { groups: { id: number; label: string }[] } {
	const rows = db
		.selectDistinct({
			id: patron.classGroupId,
			kind: patronClass.groupKind,
			name: patronClass.groupName,
			position: patronClass.levelPosition,
			label: patronClass.classLabel,
		})
		.from(loan)
		.innerJoin(patron, eq(patron.id, loan.patronId))
		.innerJoin(patronClass, eq(patronClass.patronId, patron.id))
		.where(and(isNull(loan.returnedAt), sql`${patron.classGroupId} IS NOT NULL`))
		.all();
	const groups = new Map<number, { id: number; label: string; key: ClassOrderKey }>();
	for (const r of rows) {
		if (r.id === null || groups.has(r.id)) {
			continue;
		}
		const label = r.kind === "students" ? (r.label ?? "") : (r.name ?? "");
		groups.set(r.id, {
			id: r.id,
			label,
			key: { kind: r.kind as GroupKind | null, position: r.position ?? 0, name: label },
		});
	}
	return {
		groups: [...groups.values()]
			.sort((a, b) => compareClassKeys(a.key, b.key))
			.map(({ id, label }) => ({ id, label })),
	};
}

/**
 * "Segna solleciti stampati": one `notice_printed` event per open loan among `loanIds`, so the
 * loans grid shows the date of the last notice. Returns how many loans were marked.
 */
export function markNoticesPrinted(
	db: Db,
	loanIds: readonly number[],
	actor: AuditActor,
	now = new Date(),
): number {
	if (loanIds.length === 0) {
		return 0;
	}
	return db.transaction((tx) => {
		const open = tx
			.select({ id: loan.id })
			.from(loan)
			.where(and(inArray(loan.id, [...loanIds]), isNull(loan.returnedAt)))
			.all();
		const stamp = now.toISOString();
		for (const l of open) {
			tx.insert(loanEvent)
				.values({ loanId: l.id, type: "notice_printed", at: stamp, byUserId: actor.id })
				.run();
		}
		audit(tx, actor, "loan.notices_printed", "loan", null, { count: open.length }, now);
		return open.length;
	});
}

export class ReceiptError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ReceiptError";
	}
}

export interface ReceiptData {
	patron: {
		firstName: string;
		lastName: string;
		patronType: string;
		classLabel: string;
	};
	rows: { title: string; author: string; barcode: string; dueDate: string }[];
}

/** The loans of one checkout session for the receipt, in the given order; one patron only. */
export function receiptData(db: DbOrTx, loanIds: readonly number[]): ReceiptData {
	const rows = db
		.select({
			loanId: loan.id,
			patronId: patron.id,
			firstName: patron.firstName,
			lastName: patron.lastName,
			patronType: patron.patronType,
			classLabel: patronClass.classLabel,
			title: biblio.title,
			author: biblio.author,
			barcode: item.barcode,
			dueDate: loan.dueDate,
		})
		.from(loan)
		.innerJoin(patron, eq(patron.id, loan.patronId))
		.leftJoin(patronClass, eq(patronClass.patronId, patron.id))
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(inArray(loan.id, [...loanIds]))
		.all();
	const first = rows[0];
	if (!first || rows.length !== new Set(loanIds).size) {
		throw new ReceiptError("loan not found");
	}
	if (rows.some((r) => r.patronId !== first.patronId)) {
		throw new ReceiptError("the loans belong to different patrons");
	}
	const order = new Map(loanIds.map((id, i) => [id, i]));
	rows.sort((a, b) => (order.get(a.loanId) ?? 0) - (order.get(b.loanId) ?? 0));
	return {
		patron: {
			firstName: first.firstName,
			lastName: first.lastName,
			patronType: first.patronType,
			classLabel: first.classLabel ?? "",
		},
		rows: rows.map(({ title, author, barcode, dueDate }) => ({
			title,
			author,
			barcode,
			dueDate,
		})),
	};
}

export interface RecordLoanRow {
	loanId: number;
	itemId: number;
	barcode: string;
	patronId: number;
	/** The patron's name now: a removed patron shows the anonymized one ("Studente Rimosso #12"). */
	name: string;
	patronStatus: string;
	patronType: string;
	/** The class when the book was lent (snapshot, Q95), empty for teachers. */
	classLabel: string;
	issuedAt: string;
	dueDate: string;
	returnedAt: string | null;
	renewals: number;
	outcome: PatronHistoryRow["outcome"];
}

/** Every loan of the copies of a record, newest first ("Storico prestiti", step 4.7). */
export function recordLoanHistory(db: DbOrTx, biblioId: number, today: string): RecordLoanRow[] {
	return db
		.select({
			loanId: loan.id,
			itemId: item.id,
			barcode: item.barcode,
			patronId: patron.id,
			firstName: patron.firstName,
			lastName: patron.lastName,
			patronStatus: patron.status,
			patronType: loan.patronTypeSnapshot,
			classLabel: loan.classLabelSnapshot,
			issuedAt: loan.issuedAt,
			dueDate: loan.dueDate,
			returnedAt: loan.returnedAt,
			renewals: loan.renewals,
			lost: lostSql,
		})
		.from(loan)
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(patron, eq(patron.id, loan.patronId))
		.where(eq(item.biblioId, biblioId))
		.orderBy(desc(loan.issuedAt), desc(loan.id))
		.all()
		.map(({ firstName, lastName, classLabel, lost, ...r }) => ({
			...r,
			name: patronFullName({ firstName, lastName }),
			classLabel: r.patronType !== "teacher" ? (classLabel ?? "") : "",
			outcome: loanOutcome(r.returnedAt, r.dueDate, today, lost === 1),
		}));
}

export interface TodayActivityRow {
	loanId: number;
	patronId: number;
	name: string;
	title: string;
	barcode: string;
	/** Instant of the checkout or of the return. */
	at: string;
}

/** Today's checkouts and returns in the library's zone, newest first ("Prestiti di oggi"). */
export function todayActivity(
	db: DbOrTx,
	today: string,
	timezone: string,
	limit = 50,
): { issued: TodayActivityRow[]; returned: TodayActivityRow[] } {
	const { fromIso = "", toIso = "" } = dayRangeToUtc(today, today, timezone);
	const rows = (column: typeof loan.issuedAt | typeof loan.returnedAt): TodayActivityRow[] =>
		db
			.select({
				loanId: loan.id,
				patronId: patron.id,
				firstName: patron.firstName,
				lastName: patron.lastName,
				title: biblio.title,
				barcode: item.barcode,
				at: sql<string>`${column}`,
			})
			.from(loan)
			.innerJoin(patron, eq(patron.id, loan.patronId))
			.innerJoin(item, eq(item.id, loan.itemId))
			.innerJoin(biblio, eq(biblio.id, item.biblioId))
			.where(and(gte(column, fromIso), lte(column, toIso)))
			.orderBy(desc(column), desc(loan.id))
			.limit(limit)
			.all()
			.map(({ firstName, lastName, ...r }) => ({
				...r,
				name: patronFullName({ firstName, lastName }),
			}));
	return { issued: rows(loan.issuedAt), returned: rows(loan.returnedAt) };
}

/** 1 when the loan was closed because the copy was marked lost. */
export const lostSql = sql<number>`exists (select 1 from loan_event e where e.loan_id = loan.id and e.type = 'lost')`;

export interface PatronHistoryRow {
	loanId: number;
	itemId: number;
	barcode: string;
	title: string;
	author: string;
	issuedAt: string;
	dueDate: string;
	returnedAt: string | null;
	renewals: number;
	lastRenewedAt: string | null;
	schoolYear: string;
	/** `open`, `overdue` (still out and past due), `returned`, `returnedLate` or `lost`. */
	outcome: "open" | "overdue" | "returned" | "returnedLate" | "lost";
}

/** Every loan of the patron, newest first (history tab and its export). */
export function patronHistory(
	db: Db,
	id: number,
	/** Today in the library's time zone (`libraryToday`): decides which loans are overdue. */
	today: string,
	/** How the school year is named (`library.schoolYearLabel`, 9.41). */
	yearLabel: SchoolYearLabel = "span",
): PatronHistoryRow[] {
	if (!db.select({ id: patron.id }).from(patron).where(eq(patron.id, id)).get()) {
		throw new PatronNotFoundError(id);
	}
	return db
		.select({
			loanId: loan.id,
			itemId: item.id,
			barcode: item.barcode,
			title: biblio.title,
			author: biblio.author,
			issuedAt: loan.issuedAt,
			dueDate: loan.dueDate,
			returnedAt: loan.returnedAt,
			renewals: loan.renewals,
			lastRenewedAt: loan.lastRenewedAt,
			schoolYear: loan.schoolYear,
			lost: lostSql,
		})
		.from(loan)
		.innerJoin(item, eq(item.id, loan.itemId))
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.where(eq(loan.patronId, id))
		.orderBy(desc(loan.issuedAt), desc(loan.id))
		.all()
		.map(({ lost, ...l }) => ({
			...l,
			schoolYear: schoolYearLabel(l.schoolYear, yearLabel),
			outcome: loanOutcome(l.returnedAt, l.dueDate, today, lost === 1),
		}));
}

/**
 * What became of a loan: still `open`, `overdue`, `returned` on time, `returnedLate`, or closed
 * because the copy was marked `lost` (step 4.8).
 */
export function loanOutcome(
	returnedAt: string | null,
	dueDate: string,
	today: string,
	lost = false,
): PatronHistoryRow["outcome"] {
	if (lost) {
		return "lost";
	}
	if (returnedAt) {
		return returnedAt.slice(0, 10) > dueDate ? "returnedLate" : "returned";
	}
	return dueDate < today ? "overdue" : "open";
}
