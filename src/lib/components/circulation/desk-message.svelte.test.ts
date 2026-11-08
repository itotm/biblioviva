// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import enCirculation from "#lib/i18n/en/circulation.json";
import itCirculation from "#lib/i18n/it/circulation.json";
import type { CheckoutResult } from "#lib/server/services/circulation.js";
import {
	cardOnCheckin,
	checkinPending,
	checkoutRefusal,
	deskCameraTakes,
	DESK_TONE,
	deskKey,
	deskMessage,
	lentMessages,
	loanLimitMessage,
	lendToAction,
	noPatronSelected,
	scanFailure,
	withDeskScan,
	type CheckoutMessageContext,
	type DeskMessageData,
	type DeskReason,
} from "./desk-message.js";

/** A translation that shows its key and parameters, so the tests see what was asked. */
const t = (key: string, params: Record<string, string | number> = {}): string =>
	Object.keys(params).length > 0 ? `${key} ${JSON.stringify(params)}` : key;

/** What the desk shows of the actions: their label, link, look and test id. */
const actionsOf = (m: DeskMessageData): unknown[] =>
	(m.actions ?? []).map((a) => ({
		label: a.label,
		href: a.href,
		variant: a.variant,
		testid: a.testid,
		newTab: a.newTab,
		callback: a.onclick !== undefined,
	}));

function lookup(dictionary: unknown, key: string): unknown {
	return key
		.split(".")
		.slice(1)
		.reduce<unknown>(
			(node, part) =>
				node && typeof node === "object"
					? (node as Record<string, unknown>)[part]
					: undefined,
			dictionary,
		);
}

describe("desk message table", () => {
	// Appendix I: every reason code and its weight at the desk
	const APPENDIX_I: Record<string, string> = {
		no_patron_selected: "warning",
		card_on_checkin: "warning",
		unknown_barcode: "error",
		bad_check_digit: "error",
		ambiguous_legacy: "warning",
		patron_anonymized: "error",
		loan_limit_reached: "error",
		item_on_loan_same_patron: "warning",
		item_on_loan_other_patron: "error",
		item_not_for_loan: "error",
		item_status_unavailable: "error",
		item_unclassified: "error",
		renewal_limit_reached: "error",
		renewal_overdue_blocked: "error",
		renewal_hard_due_date: "error",
		duplicate_scan: "info",
		not_on_loan: "info",
		already_returned_today: "info",
		returned_overdue: "warning",
		was_lost_now_found: "success",
		returned_now_lending: "success",
		patron_has_overdues: "warning",
		calendar_closed_due_date: "info",
		hard_due_date_applied: "info",
		session_idle_reset: "info",
		undo_done: "info",
	};

	it("gives every reason of Appendix I its key under circulation.msg and its tone", () => {
		for (const [reason, tone] of Object.entries(APPENDIX_I)) {
			expect(deskKey(reason as DeskReason), reason).toBe(`circulation.msg.${reason}`);
			expect(DESK_TONE[reason as DeskReason], reason).toBe(tone);
		}
		expect(Object.keys(enCirculation.msg).sort()).toEqual(Object.keys(APPENDIX_I).sort());
	});

	it("gives the confirmations their keys beside the desks", () => {
		expect(deskKey("lent")).toBe("circulation.checkout.lent");
		expect(deskKey("renewed")).toBe("circulation.checkout.renewed");
		expect(deskKey("renewed_all")).toBe("circulation.renewals.renewedAll");
		expect(deskKey("returned")).toBe("circulation.checkin.returned");
		expect(deskKey("renewed_instead")).toBe("circulation.checkin.renewedInstead");
		expect(deskKey("marked_damaged")).toBe("circulation.checkin.markedDamaged");
		expect(deskKey("checkin_pending")).toBe("circulation.checkin.pending");
		expect(DESK_TONE.marked_damaged).toBe("info");
		expect(DESK_TONE.checkin_pending).toBe("info");
		expect(DESK_TONE.lent).toBe("success");
	});

	it("has a text in both languages for every key", () => {
		for (const reason of Object.keys(DESK_TONE) as DeskReason[]) {
			expect(typeof lookup(enCirculation, deskKey(reason)), reason).toBe("string");
			expect(typeof lookup(itCirculation, deskKey(reason)), reason).toBe("string");
		}
	});

	it("builds a message with the table's tone, or the one given", () => {
		expect(deskMessage(t, "duplicate_scan", { title: "A" })).toEqual({
			code: "duplicate_scan",
			tone: "info",
			text: 'circulation.msg.duplicate_scan {"title":"A"}',
		});
		const actions = [{ label: "x" }];
		expect(deskMessage(t, "renewed_all", {}, actions, "warning")).toEqual({
			code: "renewed_all",
			tone: "warning",
			text: "circulation.renewals.renewedAll",
			actions,
		});
	});
});

describe("scan failures (both desks)", () => {
	const examples = { item: "2026-A0123", card: "A000123" };

	it("explains a wrong check character, with Riprova", () => {
		const retry = vi.fn();
		const m = scanFailure(
			{ kind: "badCheckDigit", code: "2026-B0001" },
			{ t, examples, retry },
		);
		expect(m).toMatchObject({
			code: "bad_check_digit",
			tone: "error",
			text: 'circulation.msg.bad_check_digit {"code":"2026-B0001"}',
		});
		expect(actionsOf(m)).toEqual([{ label: "circulation.actions.retry", callback: true }]);
		void m.actions?.[0]?.onclick?.();
		expect(retry).toHaveBeenCalledOnce();
	});

	it("explains an unknown code with the library's examples, Riprova and Cerca per titolo", () => {
		const m = scanFailure({ kind: "unknown", code: "xyz" }, { t, examples, retry: vi.fn() });
		expect(m).toMatchObject({
			code: "unknown_barcode",
			tone: "error",
			text: 'circulation.msg.unknown_barcode {"code":"xyz","item":"2026-A0123","card":"A000123"}',
		});
		expect(actionsOf(m)).toEqual([
			{ label: "circulation.actions.retry", callback: true },
			{ label: "circulation.actions.searchTitle", href: "/catalog", callback: false },
		]);
	});
});

describe("the ways between the desks", () => {
	it("asks for the card first for a copy not on loan scanned before it (9.52)", () => {
		const m = noPatronSelected(t, "Il gatto");
		expect(m).toMatchObject({ code: "no_patron_selected", tone: "warning" });
		expect(m.text).toBe('circulation.msg.no_patron_selected {"title":"Il gatto"}');
		expect(actionsOf(m)).toEqual([]);
	});

	it("offers the Loans page with the borrower after a return (9.52)", () => {
		const m = deskMessage(t, "returned", { title: "A", name: "Anna" }, [
			lendToAction(t, 7, "Anna Rossi"),
		]);
		expect(actionsOf(m)).toEqual([
			{
				label: 'circulation.actions.lendTo {"name":"Anna Rossi"}',
				href: "/circulation/checkout?patron=7",
				variant: "primary",
				testid: "action-lend-to",
				callback: false,
			},
		]);
	});

	it("sends a card scanned at the check-in to the Loans page with that patron", () => {
		const m = cardOnCheckin(t, 7, "Anna Rossi");
		expect(m).toMatchObject({ code: "card_on_checkin", tone: "warning" });
		expect(actionsOf(m)).toEqual([
			{
				label: "circulation.actions.toCheckout",
				href: "/circulation/checkout?patron=7",
				variant: "primary",
				testid: "action-to-checkout",
				callback: false,
			},
		]);
	});

	it("blocks at the loan limit with only the way to the Returns page", () => {
		const m = loanLimitMessage(t, { name: "Anna", n: 1, titles: "«A»", max: 1 });
		expect(m).toMatchObject({ code: "loan_limit_reached", tone: "error" });
		expect(actionsOf(m)).toEqual([
			{
				label: "circulation.actions.toCheckin",
				href: "/circulation/checkin",
				variant: "primary",
				testid: "action-to-checkin",
				callback: false,
			},
		]);
	});
});

describe("checkout", () => {
	function context(over: Partial<CheckoutMessageContext> = {}): CheckoutMessageContext {
		return {
			t,
			formatDate: (iso) => `day ${iso}`,
			patronId: 7,
			patronName: "Anna Rossi",
			code: "2026-A0001",
			canClassify: true,
			canOverride: true,
			renew: vi.fn(),
			dismiss: vi.fn(),
			override: vi.fn(),
			...over,
		};
	}
	type Refused = Extract<CheckoutResult, { ok: false }>;
	const refused = (reason: Refused["reason"], over: Partial<Refused> = {}): Refused => ({
		ok: false,
		reason,
		overridable: false,
		params: { title: "Il gatto" },
		biblioId: 3,
		...over,
	});
	const cancel = { label: "circulation.actions.cancel", callback: true };
	const force = {
		label: "circulation.actions.forceAdmin",
		variant: "error",
		testid: "action-override",
		callback: true,
	};

	it("confirms a loan, then its notices", () => {
		const messages = lentMessages(
			{
				ok: true,
				loan: {
					loanId: 1,
					itemId: 2,
					barcode: "B",
					title: "Il gatto",
					dueDate: "2026-10-09",
				},
				infos: [
					{ code: "calendar_closed_due_date", due: "2026-10-09" },
					{ code: "hard_due_date_applied", due: "2026-10-09" },
					{ code: "patron_has_overdues", n: 1, titles: "«A»" },
				],
			},
			context(),
		);
		expect(messages.map((m) => [m.code, m.tone, m.text])).toEqual([
			[
				"lent",
				"success",
				'circulation.checkout.lent {"title":"Il gatto","date":"day 2026-10-09"}',
			],
			[
				"calendar_closed_due_date",
				"info",
				'circulation.msg.calendar_closed_due_date {"due":"day 2026-10-09"}',
			],
			[
				"hard_due_date_applied",
				"info",
				'circulation.msg.hard_due_date_applied {"due":"day 2026-10-09"}',
			],
			[
				"patron_has_overdues",
				"warning",
				'circulation.msg.patron_has_overdues {"n":1,"titles":"«A»","name":"Anna Rossi"}',
			],
		]);
		expect(actionsOf(messages[3]!)).toEqual([
			{
				label: "circulation.actions.printReminder",
				href: "/print/overdues?patron=7",
				testid: "action-print-reminder",
				newTab: true,
				callback: false,
			},
		]);
		expect(messages[0]?.actions).toBeUndefined();
	});

	it("explains every refusal with its tone and actions", () => {
		const ctx = context();
		const cases: [Refused, string, unknown[]][] = [
			[
				refused("loan_limit_reached"),
				"error",
				[
					{
						label: "circulation.actions.toCheckin",
						href: "/circulation/checkin",
						variant: "primary",
						testid: "action-to-checkin",
						callback: false,
					},
				],
			],
			[
				refused("item_on_loan_other_patron"),
				"error",
				[
					{
						label: "circulation.actions.toCheckin",
						href: "/circulation/checkin?barcode=2026-A0001",
						variant: "primary",
						testid: "action-to-checkin",
						callback: false,
					},
				],
			],
			[
				refused("item_on_loan_same_patron", { loanId: 11 }),
				"warning",
				[
					{
						label: "circulation.actions.renew",
						variant: "primary",
						testid: "action-renew",
						callback: true,
					},
					cancel,
				],
			],
			[
				refused("item_unclassified"),
				"error",
				[
					{
						label: "circulation.actions.classify",
						href: "/catalog/to-classify/3",
						variant: "primary",
						testid: "action-classify",
						callback: false,
					},
				],
			],
			[refused("item_not_for_loan", { overridable: true }), "error", [cancel, force]],
			[
				refused("item_status_unavailable", { overridable: true }),
				"error",
				[
					{ label: "circulation.actions.openItem", href: "/catalog/3", callback: false },
					force,
				],
			],
			[refused("patron_anonymized"), "error", []],
			// blocking only with `blockIfOverdue`: an error, not the warning after a loan
			[refused("patron_has_overdues"), "error", []],
		];
		for (const [result, tone, actions] of cases) {
			const m = checkoutRefusal(result, ctx);
			expect(m.code, result.reason).toBe(result.reason);
			expect(m.tone, result.reason).toBe(tone);
			expect(m.text, result.reason).toBe(
				`circulation.msg.${result.reason} ${JSON.stringify(result.params)}`,
			);
			expect(actionsOf(m), result.reason).toEqual(actions);
		}
	});

	it("wires the buttons to the page", () => {
		const ctx = context();
		const same = checkoutRefusal(refused("item_on_loan_same_patron", { loanId: 11 }), ctx);
		void same.actions?.[0]?.onclick?.();
		void same.actions?.[1]?.onclick?.();
		expect(ctx.renew).toHaveBeenCalledWith(11);
		expect(ctx.dismiss).toHaveBeenCalledOnce();
		const forced = checkoutRefusal(refused("item_not_for_loan", { overridable: true }), ctx);
		void forced.actions?.[1]?.onclick?.();
		expect(ctx.override).toHaveBeenCalledOnce();
	});

	it("offers no override and no classification to whom may not, nor for a withdrawn copy", () => {
		const plain = context({ canOverride: false, canClassify: false });
		expect(
			actionsOf(checkoutRefusal(refused("item_not_for_loan", { overridable: true }), plain)),
		).toEqual([cancel]);
		expect(actionsOf(checkoutRefusal(refused("item_unclassified"), plain))).toEqual([]);
		// a withdrawn copy comes back not overridable
		expect(
			actionsOf(checkoutRefusal(refused("item_status_unavailable"), context())).map(
				(a) => (a as { label: string }).label,
			),
		).toEqual(["circulation.actions.openItem"]);
	});

	it("shows the dates and the copy's status in the operator's words", () => {
		const m = checkoutRefusal(
			refused("item_status_unavailable", {
				params: { title: "Il gatto", status: "in_repair", date: "2026-09-01" },
			}),
			context(),
		);
		expect(m.text).toBe(
			'circulation.msg.item_status_unavailable {"title":"Il gatto","status":"circulation.statuses.in_repair","date":"day 2026-09-01"}',
		);
	});
});

describe("withDeskScan", () => {
	it("keeps the field disabled while the scan is handled and focuses it afterwards", async () => {
		const steps: string[] = [];
		await withDeskScan(
			(busy) => steps.push(`busy ${String(busy)}`),
			() => steps.push("focus"),
			async () => {
				steps.push("handle");
				await Promise.resolve();
			},
		);
		expect(steps).toEqual(["busy true", "handle", "busy false", "focus"]);
	});

	it("gives the field back when the handling fails", async () => {
		const steps: string[] = [];
		await expect(
			withDeskScan(
				(busy) => steps.push(`busy ${String(busy)}`),
				() => steps.push("focus"),
				() => Promise.reject(new Error("offline")),
			),
		).rejects.toThrow("offline");
		expect(steps).toEqual(["busy true", "busy false", "focus"]);
	});
});

describe("the camera of the Prestito desk before the patron (9.52)", () => {
	it("takes a card or a copy, which is returned and its borrower chosen; never an ISBN", () => {
		const take = deskCameraTakes;
		expect(take({ kind: "card", value: "C0000017" })).toBe(true);
		expect(take({ kind: "ambiguous", value: "1240" })).toBe(true);
		expect(take({ kind: "item", value: "2026-A0001" })).toBe(true);
		expect(take({ kind: "legacy_item", value: "2026-0042" })).toBe(true);
		expect(take({ kind: "isbn", value: "9788804668237" })).toBe(false);
		expect(take({ kind: "invalid", value: "x", reason: "unrecognised" })).toBe(false);
	});
});

describe("a return carried over from the Prestito desk", () => {
	it("waits for Enter or for its button, never implicitly", () => {
		const confirm = vi.fn();
		const m = checkinPending(t, "2026-A0001", confirm);
		expect(m).toMatchObject({ code: "checkin_pending", tone: "info" });
		expect(m.text).toBe('circulation.checkin.pending {"code":"2026-A0001"}');
		expect(actionsOf(m)).toEqual([
			{
				label: "circulation.checkin.confirmReturn",
				href: undefined,
				variant: "primary",
				testid: "action-confirm-return",
				newTab: undefined,
				callback: true,
			},
		]);
		void m.actions?.[0]?.onclick?.();
		expect(confirm).toHaveBeenCalledOnce();
	});
});
