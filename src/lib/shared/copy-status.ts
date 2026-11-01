// SPDX-License-Identifier: GPL-3.0-or-later
// Rules about a copy's state shared by the server and the pages: which statuses can go home
// (circulation, the record page's count) and how far its labels have been printed.

/** Statuses of a copy that can be lent: a worn (damaged) copy still goes home (ADR-012). */
export const LENDABLE_STATUS_LIST = ["available", "damaged"] as const;
export const LENDABLE_STATUSES: ReadonlySet<string> = new Set(LENDABLE_STATUS_LIST);

/** Statuses that take a copy out of the collection: no labels, no lists, never set while lent. */
export const LEAVING_STATUS_LIST = ["lost", "withdrawn"] as const;
export const LEAVING_STATUSES: ReadonlySet<string> = new Set(LEAVING_STATUS_LIST);

/** On the shelf and lendable: a lendable status, not marked "not for loan", not out on loan. */
export function isOnShelfLendable(copy: {
	status: string;
	notForLoan: boolean;
	loan: unknown;
}): boolean {
	return LENDABLE_STATUSES.has(copy.status) && !copy.notForLoan && !copy.loan;
}

export type LabelStatus = "printed" | "partial" | "pending";

/** Both labels of a copy printed, one of the two, or none. */
export function labelStatus(copy: {
	barcodeLabelPrintedAt: string | null;
	spineLabelPrintedAt: string | null;
}): LabelStatus {
	if (copy.barcodeLabelPrintedAt && copy.spineLabelPrintedAt) {
		return "printed";
	}
	return copy.barcodeLabelPrintedAt || copy.spineLabelPrintedAt ? "partial" : "pending";
}
