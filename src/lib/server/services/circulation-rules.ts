// SPDX-License-Identifier: GPL-3.0-or-later
// Circulation rules (PLAN.md step 4.2, §3.8, Appendix I): which rule applies to a patron type and
// an item type, whether a copy can be lent or a loan renewed — with the reason code of the desk
// message when not — and the due date with the calendar. Pure functions over plain data, so the
// checkout, check-in and renewal services (4.3–4.5) share one set of decisions.
import type { AppConfig } from "#lib/server/config/schema.js";
import { LENDABLE_STATUSES } from "#lib/shared/copy-status.js";
import {
	addDays,
	computeDueDate,
	daysBetween,
	type CalendarRules,
} from "#lib/shared/calendar-core.js";

export interface LoanRule {
	loanDays: number;
	maxLoans: number;
	maxRenewals: number;
	renewalDays: number;
}

/** The patron type's rule with the item type's overrides (e.g. DVDs: 5 days, 1 renewal). */
export function resolveRule(config: AppConfig, patronType: string, itemType: string): LoanRule {
	const rules = config.circulation.rules;
	const base = patronType === "teacher" ? rules.teacher : rules.student;
	return { ...base, ...(config.circulation.itemTypeOverrides[itemType] ?? {}) };
}

/** Reason codes of Appendix I that the rules produce. */
export type CheckoutRefusal =
	| "patron_anonymized"
	| "item_on_loan_same_patron"
	| "item_on_loan_other_patron"
	| "item_unclassified"
	| "item_not_for_loan"
	| "item_status_unavailable"
	| "loan_limit_reached"
	| "patron_has_overdues";

export type RenewalRefusal =
	"renewal_limit_reached" | "renewal_overdue_blocked" | "renewal_hard_due_date";

/** Refusals an administrator may override with a reason (Appendix I); never the others. */
export const OVERRIDABLE: ReadonlySet<CheckoutRefusal> = new Set([
	"item_not_for_loan",
	"item_status_unavailable",
]);

/**
 * Renewal refusals an administrator may override with a reason (step 4.5); never the hard due
 * date, the last day of loans of the school year.
 */
export const RENEWAL_OVERRIDABLE: ReadonlySet<RenewalRefusal> = new Set([
	"renewal_limit_reached",
	"renewal_overdue_blocked",
]);

export interface OpenLoanInfo {
	itemId: number;
	itemType: string;
	title: string;
	dueDate: string;
}

export interface CheckoutInput {
	patron: { id: number; status: string; patronType: string };
	item: {
		id: number;
		status: string;
		notForLoan: boolean;
		itemType: string;
		/** The record is classified: a copy of a record still to classify is never lent (9.21). */
		classified: boolean;
	};
	/** The patron's open loans (for the limits and the overdue check). */
	patronLoans: readonly OpenLoanInfo[];
	/** The open loan of the copy, if any. */
	itemLoan: { patronId: number; issuedAt: string } | null;
	today: string;
}

export interface DueDate {
	due: string;
	/** The raw date fell on a closed day and was moved (message `calendar_closed_due_date`). */
	moved: boolean;
	/** The hard due date capped it (message `hard_due_date_applied`). */
	capped: boolean;
}

export type CheckoutDecision =
	| { ok: true; rule: LoanRule; dueDate: DueDate; overdue: OpenLoanInfo[] }
	| {
			ok: false;
			reason: CheckoutRefusal;
			overridable: boolean;
			/** Loans shown in the message (the ones at the limit, the overdue ones). */
			loans?: OpenLoanInfo[];
			max?: number;
	  };

/** The due date of a loan or renewal starting on `from`, with the calendar and the hard due date. */
export function dueDateFor(
	config: AppConfig,
	cal: CalendarRules,
	from: string,
	days: number,
): DueDate {
	const mode = config.circulation.dueDateMode;
	const hard = config.circulation.hardDueDate;
	const uncapped = computeDueDate(from, days, mode, cal, null);
	const due = hard !== null && hard < uncapped ? hard : uncapped;
	return {
		due,
		moved: mode === "datedue" && uncapped !== addDays(from, days),
		capped: due !== uncapped,
	};
}

/**
 * Can this copy be lent to this patron today? Refusals follow Appendix I, in the order the desk
 * explains them: an invalid card, a copy already out, a copy that does not circulate, the limits.
 */
export function canCheckout(
	config: AppConfig,
	cal: CalendarRules,
	input: CheckoutInput,
	options: { override?: boolean } = {},
): CheckoutDecision {
	const refuse = (
		reason: CheckoutRefusal,
		extra: { loans?: OpenLoanInfo[]; max?: number } = {},
	): CheckoutDecision => ({
		ok: false,
		reason,
		// a withdrawn copy has left the collection: never lent, not even by an administrator
		overridable: OVERRIDABLE.has(reason) && input.item.status !== "withdrawn",
		...extra,
	});
	if (input.patron.status === "anonymized") {
		return refuse("patron_anonymized");
	}
	if (input.itemLoan) {
		return refuse(
			input.itemLoan.patronId === input.patron.id
				? "item_on_loan_same_patron"
				: "item_on_loan_other_patron",
		);
	}
	if (!input.item.classified) {
		return refuse("item_unclassified");
	}
	if (input.item.notForLoan && !options.override) {
		return refuse("item_not_for_loan");
	}
	if (
		!LENDABLE_STATUSES.has(input.item.status) &&
		(!options.override || input.item.status === "withdrawn")
	) {
		return refuse("item_status_unavailable");
	}
	const rule = resolveRule(config, input.patron.patronType, input.item.itemType);
	const base = resolveRule(config, input.patron.patronType, "");
	// the patron's own limit counts every loan; an item type with its own limit counts its copies
	if (input.patronLoans.length >= base.maxLoans) {
		return refuse("loan_limit_reached", { loans: [...input.patronLoans], max: base.maxLoans });
	}
	const typeLimit = config.circulation.itemTypeOverrides[input.item.itemType]?.maxLoans;
	if (typeLimit !== undefined) {
		const sameType = input.patronLoans.filter((l) => l.itemType === input.item.itemType);
		if (sameType.length >= typeLimit) {
			return refuse("loan_limit_reached", { loans: sameType, max: typeLimit });
		}
	}
	const overdue = input.patronLoans.filter((l) => l.dueDate < input.today);
	if (overdue.length > 0 && config.circulation.blockIfOverdue) {
		return refuse("patron_has_overdues", { loans: overdue });
	}
	return {
		ok: true,
		rule,
		dueDate: dueDateFor(config, cal, input.today, rule.loanDays),
		overdue,
	};
}

export interface RenewalInput {
	patronType: string;
	itemType: string;
	dueDate: string;
	renewals: number;
	today: string;
}

export type RenewalDecision =
	| {
			ok: true;
			rule: LoanRule;
			dueDate: DueDate;
			/** The renewal would not move the due date (e.g. on the day of the loan): nothing to do. */
			unchanged: boolean;
	  }
	| { ok: false; reason: RenewalRefusal; overridable: boolean; max?: number; days?: number };

/**
 * Can the loan be renewed today, and until when (`circulation.renewFrom`: today or the due date).
 * With `override` (administrators) the renewal limit and the overdue block are skipped.
 */
export function canRenew(
	config: AppConfig,
	cal: CalendarRules,
	input: RenewalInput,
	options: { override?: boolean } = {},
): RenewalDecision {
	const refuse = (
		reason: RenewalRefusal,
		extra: { max?: number; days?: number } = {},
	): RenewalDecision => ({
		ok: false,
		reason,
		overridable: RENEWAL_OVERRIDABLE.has(reason),
		...extra,
	});
	const rule = resolveRule(config, input.patronType, input.itemType);
	if (input.renewals >= rule.maxRenewals && !options.override) {
		return refuse("renewal_limit_reached", { max: rule.maxRenewals });
	}
	const late = daysBetween(input.dueDate, input.today);
	if (late > 0 && !config.circulation.allowRenewalWhenOverdue && !options.override) {
		return refuse("renewal_overdue_blocked", { days: late });
	}
	const from =
		config.circulation.renewFrom === "dueDate" && late <= 0 ? input.dueDate : input.today;
	const dueDate = dueDateFor(config, cal, from, rule.renewalDays);
	// a renewal never shortens a loan: at the hard due date there is nothing to renew, and a
	// renewal asked too early (the day of the loan) leaves the due date as it is
	if (dueDate.due <= input.dueDate) {
		if (dueDate.capped) {
			return refuse("renewal_hard_due_date");
		}
		return {
			ok: true,
			rule,
			dueDate: { due: input.dueDate, moved: false, capped: false },
			unchanged: true,
		};
	}
	return { ok: true, rule, dueDate, unchanged: false };
}
