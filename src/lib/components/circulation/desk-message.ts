// SPDX-License-Identifier: GPL-3.0-or-later
// The messages of the circulation desk (Appendix I): what happened, why, what to do, with the
// actions offered as buttons. Each reason code has its i18n key and its tone here, and the cases
// with fixed actions are built here too, for the checkout and check-in desks and the renewals;
// the pages add the actions that act on their own state. Rendered by `DeskMessage.svelte`.
import { tick } from "svelte";
import { resolve } from "$app/paths";
import type { ResolvedPathname } from "$app/types";
import type { ScanTarget } from "#lib/server/barcodes/lookup.js";
import type { ScanResult } from "#lib/shared/scan.js";
import type { CheckoutResult } from "#lib/server/services/circulation.js";

export type DeskTone = "error" | "warning" | "info" | "success";

export interface DeskAction {
	label: string;
	/** A link (e.g. to the Returns page) or a callback. */
	href?: ResolvedPathname;
	/** Open the link in a new tab (printable slips). */
	newTab?: boolean;
	onclick?: () => void | Promise<void>;
	variant?: "primary" | "tonal" | "error";
	testid?: string;
}

export interface DeskMessageData {
	/** The Appendix I reason code (kept for tests and for the log in the page). */
	code: string;
	tone: DeskTone;
	text: string;
	actions?: DeskAction[];
}

/** `i18n.t` of the page. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

type Params = Record<string, string | number>;

/**
 * The tone of every message the desks show: the reason codes of Appendix I, then the
 * confirmations, which are not anomalies.
 */
export const DESK_TONE = {
	no_patron_selected: "warning",
	card_on_checkin: "warning",
	unknown_barcode: "error",
	bad_check_digit: "error",
	ambiguous_legacy: "warning",
	patron_anonymized: "error",
	loan_limit_reached: "error",
	item_on_loan_same_patron: "warning",
	item_on_loan_other_patron: "error",
	item_unclassified: "error",
	item_not_for_loan: "error",
	item_status_unavailable: "error",
	renewal_limit_reached: "error",
	renewal_overdue_blocked: "error",
	renewal_hard_due_date: "error",
	duplicate_scan: "info",
	not_on_loan: "info",
	already_returned_today: "info",
	returned_overdue: "warning",
	was_lost_now_found: "success",
	// a copy on loan read at the checkout without a card: returned, its borrower chosen (9.52)
	returned_now_lending: "success",
	// a warning after a loan; the refusal, with `blockIfOverdue`, is an error
	patron_has_overdues: "warning",
	calendar_closed_due_date: "info",
	hard_due_date_applied: "info",
	session_idle_reset: "info",
	undo_done: "info",
	lent: "success",
	renewed: "success",
	// a warning when some of the loans were not renewed
	renewed_all: "success",
	returned: "success",
	renewed_instead: "success",
	marked_damaged: "info",
	checkin_pending: "info",
} as const satisfies Record<string, DeskTone>;

export type DeskReason = keyof typeof DESK_TONE;

/** The confirmations' keys; every reason code of Appendix I is `circulation.msg.<code>`. */
const CONFIRMATION_KEY: Partial<Record<DeskReason, string>> = {
	lent: "circulation.checkout.lent",
	renewed: "circulation.checkout.renewed",
	renewed_all: "circulation.renewals.renewedAll",
	returned: "circulation.checkin.returned",
	renewed_instead: "circulation.checkin.renewedInstead",
	marked_damaged: "circulation.checkin.markedDamaged",
	checkin_pending: "circulation.checkin.pending",
};

/** The i18n key of a desk message. */
export function deskKey(reason: DeskReason): string {
	return CONFIRMATION_KEY[reason] ?? `circulation.msg.${reason}`;
}

/**
 * A desk message: its text from the reason's key, its tone from `DESK_TONE`. `tone` is given only
 * where one reason has two weights (`patron_has_overdues` blocking, `renewed_all` with failures).
 */
export function deskMessage(
	t: Translate,
	reason: DeskReason,
	params: Params = {},
	actions?: DeskAction[],
	tone: DeskTone = DESK_TONE[reason],
): DeskMessageData {
	return {
		code: reason,
		tone,
		text: t(deskKey(reason), params),
		...(actions ? { actions } : {}),
	};
}

/** The Returns page, with the copy's barcode waiting in its field. */
export function checkinHref(code?: string): ResolvedPathname {
	return code
		? resolve(`circulation/checkin?barcode=${encodeURIComponent(code)}`)
		: resolve("circulation/checkin");
}

/**
 * A copy's code carried over from the Loans page: the return waits for Enter or for this
 * message's button (a phone or a mouse has no Enter at hand), never implicitly.
 */
export function checkinPending(t: Translate, code: string, confirm: () => void): DeskMessageData {
	return deskMessage(t, "checkin_pending", { code }, [
		{
			label: t("circulation.checkin.confirmReturn"),
			variant: "primary",
			testid: "action-confirm-return",
			onclick: confirm,
		},
	]);
}

/**
 * The camera reads the Loans page takes before a patron is chosen: a card, or a copy, which is
 * returned and its borrower chosen (9.52); an ISBN on the cover does not stop the scan.
 */
export function deskCameraTakes(result: ScanResult): boolean {
	return result.kind !== "isbn" && result.kind !== "invalid";
}

/** The Loans page with a patron already chosen. */
export function checkoutHref(patronId: number): ResolvedPathname {
	return resolve(`circulation/checkout?patron=${patronId}`);
}

/**
 * Runs the handling of a scan with the field disabled; afterwards the field is focused again, once
 * it is enabled on the page, so the next scan lands in it.
 */
export async function withDeskScan(
	setBusy: (busy: boolean) => void,
	focus: () => void,
	handle: () => Promise<void>,
): Promise<void> {
	setBusy(true);
	try {
		await handle();
	} finally {
		setBusy(false);
		await tick();
		focus();
	}
}

/** What both desks say of a code that is no card and no copy, or whose check is wrong. */
export function scanFailure(
	target: Extract<ScanTarget, { kind: "badCheckDigit" | "unknown" }>,
	ctx: {
		t: Translate;
		/** What the codes of this library look like. */
		examples: { item: string; card: string };
		/** "Riprova": the messages cleared, the field focused. */
		retry: () => void;
	},
): DeskMessageData {
	const { t, retry } = ctx;
	const again: DeskAction = { label: t("circulation.actions.retry"), onclick: retry };
	return target.kind === "badCheckDigit"
		? deskMessage(t, "bad_check_digit", { code: target.code }, [again])
		: deskMessage(t, "unknown_barcode", { code: target.code, ...ctx.examples }, [
				again,
				{ label: t("circulation.actions.searchTitle"), href: resolve("catalog") },
			]);
}

/**
 * A copy not on loan scanned at the checkout before a card: the card first. (A copy on loan is
 * returned there and its borrower chosen, 9.52.)
 */
export function noPatronSelected(t: Translate, title: string): DeskMessageData {
	return deskMessage(t, "no_patron_selected", { title });
}

/** After a return at the check-in: the way to the Loans page with its borrower (9.52). */
export function lendToAction(t: Translate, patronId: number, name: string): DeskAction {
	return {
		label: t("circulation.actions.lendTo", { name }),
		href: checkoutHref(patronId),
		variant: "primary",
		testid: "action-lend-to",
	};
}

/** A card scanned at the check-in: the way to the Loans page with that patron. */
export function cardOnCheckin(t: Translate, patronId: number, name: string): DeskMessageData {
	return deskMessage(t, "card_on_checkin", { name }, [
		{
			label: t("circulation.actions.toCheckout"),
			href: checkoutHref(patronId),
			variant: "primary",
			testid: "action-to-checkout",
		},
	]);
}

/** The loan limit (blocking): only the way to the Returns page, no shortcut and no override. */
export function loanLimitMessage(t: Translate, params: Params): DeskMessageData {
	return deskMessage(t, "loan_limit_reached", params, [
		{
			label: t("circulation.actions.toCheckin"),
			href: checkinHref(),
			variant: "primary",
			testid: "action-to-checkin",
		},
	]);
}

export interface CheckoutMessageContext {
	t: Translate;
	formatDate: (iso: string) => string;
	/** The patron at the desk. */
	patronId: number;
	patronName: string;
	/** The barcode of the copy, carried to the Returns page. */
	code: string;
	canClassify: boolean;
	canOverride: boolean;
	/** "Rinnova" of a copy already lent to this patron. */
	renew: (loanId: number) => void | Promise<void>;
	/** "Annulla": the messages cleared, the field focused. */
	dismiss: () => void;
	/** "Forza (solo admin)": the administrator's reason is asked. */
	override: () => void;
}

/** The confirmation of a loan, then the notices that came with it. */
export function lentMessages(
	result: Extract<CheckoutResult, { ok: true }>,
	ctx: CheckoutMessageContext,
): DeskMessageData[] {
	const { t, formatDate } = ctx;
	return [
		deskMessage(t, "lent", {
			title: result.loan.title,
			date: formatDate(result.loan.dueDate),
		}),
		...result.infos.map((info) =>
			info.code === "patron_has_overdues"
				? deskMessage(
						t,
						info.code,
						{ n: info.n, titles: info.titles, name: ctx.patronName },
						[
							{
								label: t("circulation.actions.printReminder"),
								href: resolve(`print/overdues?patron=${String(ctx.patronId)}`),
								newTab: true,
								testid: "action-print-reminder",
							},
						],
					)
				: deskMessage(t, info.code, { due: formatDate(info.due) }),
		),
	];
}

/**
 * A refused loan explained, with what can be done about it (Appendix I). The loan limit is shown
 * by the page in the middle of the screen, never as a passing message.
 */
export function checkoutRefusal(
	result: Extract<CheckoutResult, { ok: false }>,
	ctx: CheckoutMessageContext,
): DeskMessageData {
	const { t } = ctx;
	const p = { ...result.params };
	if (typeof p.date === "string") {
		p.date = ctx.formatDate(p.date);
	}
	if (typeof p.status === "string") {
		p.status = t(`circulation.statuses.${p.status}`);
	}
	const cancel: DeskAction = { label: t("circulation.actions.cancel"), onclick: ctx.dismiss };
	const force: DeskAction[] =
		ctx.canOverride && result.overridable
			? [
					{
						label: t("circulation.actions.forceAdmin"),
						variant: "error",
						testid: "action-override",
						onclick: ctx.override,
					},
				]
			: [];
	switch (result.reason) {
		case "loan_limit_reached":
			return loanLimitMessage(t, p);
		case "item_on_loan_other_patron":
			return deskMessage(t, result.reason, p, [
				{
					label: t("circulation.actions.toCheckin"),
					href: checkinHref(ctx.code),
					variant: "primary",
					testid: "action-to-checkin",
				},
			]);
		case "item_on_loan_same_patron": {
			const loanId = result.loanId ?? 0;
			return deskMessage(t, result.reason, p, [
				{
					label: t("circulation.actions.renew"),
					variant: "primary",
					testid: "action-renew",
					onclick: () => ctx.renew(loanId),
				},
				cancel,
			]);
		}
		case "item_unclassified":
			return deskMessage(
				t,
				result.reason,
				p,
				ctx.canClassify
					? [
							{
								label: t("circulation.actions.classify"),
								href: resolve(`catalog/to-classify/${result.biblioId}`),
								variant: "primary",
								testid: "action-classify",
							},
						]
					: [],
			);
		case "item_not_for_loan":
			return deskMessage(t, result.reason, p, [cancel, ...force]);
		case "item_status_unavailable":
			return deskMessage(t, result.reason, p, [
				{
					label: t("circulation.actions.openItem"),
					href: resolve(`catalog/${result.biblioId}`),
				},
				...force,
			]);
		case "patron_anonymized":
			return deskMessage(t, result.reason, p);
		case "patron_has_overdues":
			// blocking only with `blockIfOverdue`
			return deskMessage(t, result.reason, p, undefined, "error");
	}
}
