// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { exampleRaw, parseConfig } from "#lib/server/config/load.js";
import type { AppConfig } from "#lib/server/config/schema.js";
import {
	canCheckout,
	canRenew,
	dueDateFor,
	OVERRIDABLE,
	RENEWAL_OVERRIDABLE,
	resolveRule,
	type CheckoutInput,
	type OpenLoanInfo,
} from "./circulation-rules.js";

const config = parseConfig(exampleRaw()).config;
const cal = config.calendar;
const TODAY = "2026-09-25"; // a Friday

const withCirculation = (patch: Partial<AppConfig["circulation"]>): AppConfig => ({
	...config,
	circulation: { ...config.circulation, ...patch },
});

const loan = (itemId: number, dueDate: string, itemType = "libro"): OpenLoanInfo => ({
	itemId,
	itemType,
	title: `Libro ${itemId}`,
	dueDate,
});

const input = (patch: Partial<CheckoutInput> = {}): CheckoutInput => ({
	patron: { id: 1, status: "active", patronType: "student" },
	item: { id: 10, status: "available", notForLoan: false, itemType: "libro", classified: true },
	patronLoans: [],
	itemLoan: null,
	today: TODAY,
	...patch,
});

describe("rules", () => {
	it("merges the patron type's rule with the item type's overrides", () => {
		expect(resolveRule(config, "student", "libro")).toEqual({
			loanDays: 15,
			maxLoans: 1,
			maxRenewals: 5,
			renewalDays: 15,
		});
		expect(resolveRule(config, "teacher", "libro").maxLoans).toBe(4);
		expect(resolveRule(config, "teacher", "dvd")).toEqual({
			loanDays: 5,
			maxLoans: 4,
			maxRenewals: 1,
			renewalDays: 5,
		});
	});

	it("computes the due date and says when the calendar moved or capped it", () => {
		expect(dueDateFor(config, cal, TODAY, 15)).toEqual({
			due: "2026-10-12",
			moved: true,
			capped: false,
		});
		expect(dueDateFor(config, cal, "2026-09-28", 15)).toEqual({
			due: "2026-10-13",
			moved: false,
			capped: false,
		});
		const hard = withCirculation({ hardDueDate: "2026-10-01" });
		expect(dueDateFor(hard, cal, TODAY, 15)).toEqual({
			due: "2026-10-01",
			moved: true,
			capped: true,
		});
		const days = withCirculation({ dueDateMode: "days" });
		expect(dueDateFor(days, cal, TODAY, 15)).toEqual({
			due: "2026-10-10",
			moved: false,
			capped: false,
		});
	});
});

describe("checkout", () => {
	it("lends a free copy with the due date and lists the overdue loans as information", () => {
		const teacher = input({
			patron: { id: 1, status: "active", patronType: "teacher" },
			patronLoans: [loan(2, "2026-09-01")],
		});
		const ok = canCheckout(config, cal, teacher);
		expect(ok).toMatchObject({ ok: true, dueDate: { due: "2026-10-12" } });
		expect(ok.ok && ok.overdue.map((l) => l.itemId)).toEqual([2]);
	});

	it("refuses with the Appendix I reason, in order", () => {
		expect(
			canCheckout(
				config,
				cal,
				input({ patron: { id: 1, status: "anonymized", patronType: "student" } }),
			),
		).toMatchObject({
			ok: false,
			reason: "patron_anonymized",
			overridable: false,
		});
		expect(
			canCheckout(config, cal, input({ itemLoan: { patronId: 1, issuedAt: "x" } })),
		).toMatchObject({
			reason: "item_on_loan_same_patron",
		});
		expect(
			canCheckout(config, cal, input({ itemLoan: { patronId: 2, issuedAt: "x" } })),
		).toMatchObject({
			reason: "item_on_loan_other_patron",
			overridable: false,
		});
		// a copy of a record still to classify is never lent, not even by an administrator (9.21)
		const unclassified = input({
			item: {
				id: 10,
				status: "available",
				notForLoan: false,
				itemType: "libro",
				classified: false,
			},
		});
		expect(canCheckout(config, cal, unclassified)).toMatchObject({
			reason: "item_unclassified",
			overridable: false,
		});
		expect(canCheckout(config, cal, unclassified, { override: true })).toMatchObject({
			reason: "item_unclassified",
		});
		const reference = input({
			item: {
				id: 10,
				status: "available",
				notForLoan: true,
				itemType: "consultazione",
				classified: true,
			},
		});
		expect(canCheckout(config, cal, reference)).toMatchObject({
			reason: "item_not_for_loan",
			overridable: true,
		});
		for (const status of ["lost", "in_repair"]) {
			expect(
				canCheckout(
					config,
					cal,
					input({
						item: {
							id: 10,
							status,
							notForLoan: false,
							itemType: "libro",
							classified: true,
						},
					}),
				),
			).toMatchObject({ reason: "item_status_unavailable", overridable: true });
		}
		// a worn (damaged) copy still circulates
		expect(
			canCheckout(
				config,
				cal,
				input({
					item: {
						id: 10,
						status: "damaged",
						notForLoan: false,
						itemType: "libro",
						classified: true,
					},
				}),
			).ok,
		).toBe(true);
	});

	it("blocks at the loan limit with the books still out, never overridable", () => {
		const atLimit = input({ patronLoans: [loan(3, "2026-10-01")] });
		expect(canCheckout(config, cal, atLimit)).toMatchObject({
			ok: false,
			reason: "loan_limit_reached",
			overridable: false,
			max: 1,
			loans: [{ itemId: 3 }],
		});
		expect(canCheckout(config, cal, atLimit, { override: true })).toMatchObject({
			reason: "loan_limit_reached",
		});
		// an item type with its own limit counts its copies only
		const dvdLimit = withCirculation({
			itemTypeOverrides: {
				dvd: { loanDays: 5, maxRenewals: 1, renewalDays: 5, maxLoans: 1 },
			},
		});
		const teacher = { id: 1, status: "active", patronType: "teacher" };
		const dvd = {
			id: 11,
			status: "available",
			notForLoan: false,
			itemType: "dvd",
			classified: true,
		};
		expect(
			canCheckout(
				dvdLimit,
				cal,
				input({ patron: teacher, item: dvd, patronLoans: [loan(4, "2026-10-01", "dvd")] }),
			),
		).toMatchObject({
			reason: "loan_limit_reached",
			max: 1,
		});
		expect(
			canCheckout(
				dvdLimit,
				cal,
				input({ patron: teacher, item: dvd, patronLoans: [loan(4, "2026-10-01")] }),
			).ok,
		).toBe(true);
	});

	it("blocks a patron with overdue loans only when configured", () => {
		const teacher = input({
			patron: { id: 1, status: "active", patronType: "teacher" },
			patronLoans: [loan(2, "2026-09-01")],
		});
		expect(canCheckout(withCirculation({ blockIfOverdue: true }), cal, teacher)).toMatchObject({
			reason: "patron_has_overdues",
			overridable: false,
			loans: [{ itemId: 2 }],
		});
	});

	it("an administrator's override passes only the overridable reasons", () => {
		const reference = input({
			item: {
				id: 10,
				status: "available",
				notForLoan: true,
				itemType: "libro",
				classified: true,
			},
		});
		expect(canCheckout(config, cal, reference, { override: true }).ok).toBe(true);
		const lost = input({
			item: {
				id: 10,
				status: "lost",
				notForLoan: false,
				itemType: "libro",
				classified: true,
			},
		});
		expect(canCheckout(config, cal, lost, { override: true }).ok).toBe(true);
		// a withdrawn copy never circulates
		const withdrawn = input({
			item: {
				id: 10,
				status: "withdrawn",
				notForLoan: false,
				itemType: "libro",
				classified: true,
			},
		});
		expect(canCheckout(config, cal, withdrawn)).toMatchObject({
			reason: "item_status_unavailable",
			overridable: false,
		});
		expect(canCheckout(config, cal, withdrawn, { override: true }).ok).toBe(false);
		expect(
			canCheckout(config, cal, input({ itemLoan: { patronId: 2, issuedAt: "x" } }), {
				override: true,
			}).ok,
		).toBe(false);
		expect([...OVERRIDABLE].sort()).toEqual(["item_not_for_loan", "item_status_unavailable"]);
	});
});

describe("renewal", () => {
	const base = {
		patronType: "student",
		itemType: "libro",
		dueDate: "2026-09-30",
		renewals: 0,
		today: TODAY,
	};

	it("renews from today by default, from the due date when configured", () => {
		expect(canRenew(config, cal, base)).toMatchObject({
			ok: true,
			dueDate: { due: "2026-10-12" },
		});
		const fromDue = withCirculation({ renewFrom: "dueDate" });
		// 30 September + 15 = 15 October
		expect(canRenew(fromDue, cal, base)).toMatchObject({
			ok: true,
			dueDate: { due: "2026-10-15" },
		});
		// an overdue loan renews from today even with renewFrom = dueDate
		expect(canRenew(fromDue, cal, { ...base, dueDate: "2026-09-20" })).toMatchObject({
			ok: true,
			dueDate: { due: "2026-10-12" },
		});
	});

	it("stops at the renewal limit, on overdue loans when configured, and at the hard due date", () => {
		expect(canRenew(config, cal, { ...base, renewals: 5 })).toEqual({
			ok: false,
			reason: "renewal_limit_reached",
			overridable: true,
			max: 5,
		});
		expect(canRenew(config, cal, { ...base, itemType: "dvd", renewals: 1 })).toMatchObject({
			reason: "renewal_limit_reached",
			max: 1,
		});
		const strict = withCirculation({ allowRenewalWhenOverdue: false });
		expect(canRenew(strict, cal, { ...base, dueDate: "2026-09-20" })).toEqual({
			ok: false,
			reason: "renewal_overdue_blocked",
			overridable: true,
			days: 5,
		});
		expect(canRenew(config, cal, { ...base, dueDate: "2026-09-20" }).ok).toBe(true);
		const hard = withCirculation({ hardDueDate: "2026-09-30" });
		expect(canRenew(hard, cal, base)).toEqual({
			ok: false,
			reason: "renewal_hard_due_date",
			overridable: false,
		});
		// asked on the day of the loan: the same due date, nothing changes
		expect(canRenew(config, cal, { ...base, dueDate: "2026-10-12" })).toMatchObject({
			ok: true,
			unchanged: true,
			dueDate: { due: "2026-10-12", capped: false },
		});
		expect(canRenew(config, cal, base)).toMatchObject({ unchanged: false });
		const later = withCirculation({ hardDueDate: "2026-10-05" });
		expect(canRenew(later, cal, base)).toMatchObject({
			ok: true,
			dueDate: { due: "2026-10-05", capped: true },
		});
	});

	it("an administrator's override passes the limit and the overdue block, never the hard due date", () => {
		const strict = withCirculation({ allowRenewalWhenOverdue: false });
		expect(
			canRenew(
				strict,
				cal,
				{ ...base, renewals: 5, dueDate: "2026-09-20" },
				{ override: true },
			),
		).toMatchObject({ ok: true, dueDate: { due: "2026-10-12" } });
		const hard = withCirculation({ hardDueDate: "2026-09-30" });
		expect(canRenew(hard, cal, base, { override: true })).toMatchObject({
			reason: "renewal_hard_due_date",
		});
		expect([...RENEWAL_OVERRIDABLE].sort()).toEqual([
			"renewal_limit_reached",
			"renewal_overdue_blocked",
		]);
	});
});
