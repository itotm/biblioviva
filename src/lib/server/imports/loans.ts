// SPDX-License-Identifier: GPL-3.0-or-later
// Open loans import (PLAN.md steps 3.9, 9.19; Q31, Q115): used once at the switch from Koha so the
// books out on the day of the migration stay lent to the right patron with their original dates.
// Columns `card_number;barcode;issued_on;due_on` (the Koha query outputs them); the dates may be
// left out — today, and the due date of the loan rules as at the desk. Validate → commit in one
// transaction (§3.22).
import { patronSortName } from "#lib/shared/patron-name.js";
import { and, eq, isNull, ne } from "drizzle-orm";
import type { Db, DbOrTx } from "#lib/server/db/client.js";
import { biblio, item, loan, patron } from "#lib/server/db/schema.js";
import type { AuditActor } from "#lib/server/services/audit.js";
import { insertLoan } from "#lib/server/services/loan-insert.js";
import type { CodeTable } from "#lib/shared/barcodes/table.js";
import { normalizeScan } from "#lib/shared/scan.js";
import { LOAN_FIELDS, LOAN_IMPORT, type LoanField } from "#lib/shared/import-columns.js";
import { normalizeDate } from "./dates.js";
import {
	canCommit,
	countRows,
	detectFormat,
	ImportNotReadyError,
	type DetectedFormat,
	type ImportCounts,
	type ImportRow,
	type MappedRow,
	type RowReason,
	withImportBatch,
} from "./pipeline.js";

export type LoanImportColumn = LoanField;

export type LoanFormatDetection = DetectedFormat<LoanImportColumn>;

/**
 * With a header the names decide (the card and the copy are the columns every file needs, the
 * dates have defaults); without one, two to four columns are taken in the documented order.
 */
export function detectLoanFormat(rows: readonly string[][]): LoanFormatDetection {
	return detectFormat(LOAN_IMPORT, rows, (columns) =>
		columns >= 2 && columns <= 4 ? LOAN_FIELDS.slice(0, columns) : null,
	);
}

export type LoanImportInput = MappedRow<LoanImportColumn>;

export interface LoanImportRow extends ImportRow<LoanImportInput> {
	patronId: number | null;
	itemId: number | null;
	/** Shown in the preview so the operator recognises the loan (no card numbers logged elsewhere). */
	patronName: string;
	barcode: string;
	issuedOn: string;
	dueOn: string;
}

export interface LoanImportResult {
	rows: LoanImportRow[];
	counts: ImportCounts;
	/** Loans already overdue on the day of the import (information, not an error). */
	overdue: number;
	canCommit: boolean;
}

export interface LoanImportOptions {
	/** Today in the library's time zone. */
	today: string;
	schoolYearStart: string;
	/** The format table (barcodes as scanned in the file are normalised with it). */
	codes: CodeTable;
	/** The due date of a loan without `due_on`: the loan rules and the calendar, as at the desk. */
	dueOf: (patronType: string, itemType: string, issuedOn: string) => string;
}

/** Reasons that inform without blocking the import. */
const WARNINGS = new Set(["overdue", "itemUnclassified"]);

/** The validate phase: every row gets a status and reasons; nothing is written. */
export function validateLoanImport(
	db: DbOrTx,
	inputs: readonly LoanImportInput[],
	options: LoanImportOptions,
): LoanImportResult {
	const patrons = new Map<string, { id: number; name: string; patronType: string }>();
	for (const p of db
		.select({
			id: patron.id,
			cardNumber: patron.cardNumber,
			firstName: patron.firstName,
			lastName: patron.lastName,
			patronType: patron.patronType,
		})
		.from(patron)
		.where(ne(patron.status, "anonymized"))
		.all()) {
		if (p.cardNumber) {
			patrons.set(p.cardNumber, {
				id: p.id,
				name: patronSortName(p),
				patronType: p.patronType,
			});
		}
	}
	const items = new Map<
		string,
		{ id: number; status: string; itemType: string; classified: boolean }
	>();
	for (const i of db
		.select({
			id: item.id,
			barcode: item.barcode,
			status: item.status,
			itemType: biblio.itemType,
			kind: biblio.kind,
		})
		.from(item)
		.innerJoin(biblio, eq(biblio.id, item.biblioId))
		.all()) {
		items.set(i.barcode, {
			id: i.id,
			status: i.status,
			itemType: i.itemType,
			classified: i.kind !== null,
		});
	}
	const onLoan = new Set(
		db
			.select({ itemId: loan.itemId })
			.from(loan)
			.where(isNull(loan.returnedAt))
			.all()
			.map((l) => l.itemId),
	);
	const seen = new Map<string, number>();
	let overdue = 0;
	const rows = inputs.map((input): LoanImportRow => {
		const reasons: RowReason[] = [];
		const card = input.cardNumber.replace(/\s/g, "");
		const barcode = input.barcode === "" ? "" : normalizeScan(input.barcode, options.codes);
		const p = patrons.get(card);
		const it = items.get(barcode);
		if (card === "") {
			reasons.push({ code: "cardMissing" });
		} else if (!p) {
			reasons.push({ code: "cardUnknown", params: { value: card } });
		}
		if (barcode === "") {
			reasons.push({ code: "barcodeMissing" });
		} else if (!it) {
			reasons.push({ code: "barcodeUnknown", params: { value: barcode } });
		} else {
			if (onLoan.has(it.id)) {
				reasons.push({ code: "alreadyOnLoan", params: { value: barcode } });
			}
			if (it.status === "withdrawn") {
				reasons.push({ code: "itemWithdrawn", params: { value: barcode } });
			}
			const first = seen.get(barcode);
			if (first !== undefined) {
				reasons.push({ code: "duplicateInFile", params: { line: first } });
			} else {
				seen.set(barcode, input.line);
			}
		}
		// a date left out: lent today, due as at the desk (step 9.19)
		const issuedOn = input.issuedOn === "" ? options.today : normalizeDate(input.issuedOn);
		const dueOn =
			input.dueOn === ""
				? issuedOn && p && it
					? options.dueOf(p.patronType, it.itemType, issuedOn)
					: null
				: normalizeDate(input.dueOn);
		if (!issuedOn) {
			reasons.push({ code: "issueDateInvalid", params: { value: input.issuedOn } });
		} else if (issuedOn > options.today) {
			reasons.push({ code: "issueDateFuture", params: { value: issuedOn } });
		}
		if (!dueOn) {
			if (input.dueOn !== "") {
				reasons.push({ code: "dueDateInvalid", params: { value: input.dueOn } });
			}
		} else if (issuedOn && dueOn < issuedOn) {
			reasons.push({ code: "dueBeforeIssue" });
		}
		if (reasons.length === 0 && dueOn && dueOn < options.today) {
			overdue++;
			reasons.push({ code: "overdue", params: { date: dueOn } });
		}
		// the loan exists already: a copy still to classify is accepted, only the desk refuses it
		if (it && !it.classified) {
			reasons.push({ code: "itemUnclassified", params: { value: barcode } });
		}
		const blocking = reasons.some((r) => !WARNINGS.has(r.code));
		return {
			line: input.line,
			status: blocking ? "error" : "new",
			data: input,
			reasons,
			patronId: p?.id ?? null,
			itemId: it?.id ?? null,
			patronName: p?.name ?? "",
			barcode,
			issuedOn: issuedOn ?? "",
			dueOn: dueOn ?? "",
		};
	});
	const counts = countRows(rows);
	return { rows, counts, overdue, canCommit: canCommit(counts) };
}

export interface LoanImportSummary {
	batchId: number;
	created: number;
	overdue: number;
}

export interface LoanCommitOptions extends LoanImportOptions {
	actor: AuditActor;
	filename: string;
	storeFile: (batchId: number) => string | null;
	now?: Date;
}

/** The commit phase: one loan and one `issue` event per row, the original dates kept. */
export function commitLoanImport(
	db: Db,
	inputs: readonly LoanImportInput[],
	options: LoanCommitOptions,
): LoanImportSummary {
	const now = options.now ?? new Date();
	return db.transaction((tx) => {
		const result = validateLoanImport(tx, inputs, options);
		if (!result.canCommit) {
			throw new ImportNotReadyError();
		}
		return withImportBatch(tx, { ...options, kind: "loans", now }, (batchId) => {
			let created = 0;
			for (const row of result.rows) {
				if (row.patronId === null || row.itemId === null) {
					throw new ImportNotReadyError();
				}
				const who = tx
					.select({ patronType: patron.patronType })
					.from(patron)
					.where(and(eq(patron.id, row.patronId), ne(patron.status, "anonymized")))
					.get();
				if (!who) {
					throw new ImportNotReadyError();
				}
				insertLoan(tx, {
					itemId: row.itemId,
					patronId: row.patronId,
					patronType: who.patronType,
					issuedAt: `${row.issuedOn}T12:00:00.000Z`,
					issuedOn: row.issuedOn,
					dueDate: row.dueOn,
					schoolYearStart: options.schoolYearStart,
					byUserId: options.actor.id,
					createdAt: now.toISOString(),
					details: { imported: batchId },
				});
				created++;
			}
			return { created, overdue: result.overdue };
		});
	});
}
