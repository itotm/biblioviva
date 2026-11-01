// SPDX-License-Identifier: GPL-3.0-or-later
// Status triples (colour + icon + text, PLAN.md §3.18): one definition per status, used by
// StatusBadge everywhere so a status always looks the same.
import type { IconName } from "./icons.js";

export type StatusTone = "success" | "warning" | "error" | "tertiary" | "neutral" | "primary";

export interface StatusDef {
	tone: StatusTone;
	icon: IconName;
	/** i18n key under `common.statuses` */
	key: string;
}

export const ITEM_STATUS = {
	available: { tone: "success", icon: "available", key: "item.available" },
	on_loan: { tone: "primary", icon: "loan", key: "item.onLoan" },
	lost: { tone: "error", icon: "lost", key: "item.lost" },
	damaged: { tone: "warning", icon: "damaged", key: "item.damaged" },
	in_repair: { tone: "warning", icon: "repair", key: "item.inRepair" },
	withdrawn: { tone: "neutral", icon: "withdrawn", key: "item.withdrawn" },
	not_for_loan: { tone: "tertiary", icon: "book", key: "item.notForLoan" },
} as const satisfies Record<string, StatusDef>;

export const LOAN_STATUS = {
	open: { tone: "primary", icon: "loan", key: "loan.open" },
	due_soon: { tone: "warning", icon: "dueSoon", key: "loan.dueSoon" },
	overdue: { tone: "error", icon: "overdue", key: "loan.overdue" },
	returned: { tone: "success", icon: "return", key: "loan.returned" },
} as const satisfies Record<string, StatusDef>;

export const PATRON_STATUS = {
	active: { tone: "success", icon: "available", key: "patron.active" },
	anonymized: { tone: "neutral", icon: "withdrawn", key: "patron.anonymized" },
} as const satisfies Record<string, StatusDef>;

export const PRINT_STATUS = {
	pending: { tone: "warning", icon: "pending", key: "print.pending" },
	printed: { tone: "success", icon: "print", key: "print.printed" },
} as const satisfies Record<string, StatusDef>;

/** Colour and icon of a state whose text the caller writes (a sentence, a count). */
export type StatusLook = Omit<StatusDef, "key">;

/** How far the labels of a copy (or a patron's card) are printed: tonal badges of print lists. */
export const PRINT_LOOK = {
	printed: { tone: "success", icon: PRINT_STATUS.printed.icon },
	// one label of the pair printed: the label icon, half way between printed and pending
	partial: { tone: "warning", icon: "label" },
	pending: { tone: "neutral", icon: PRINT_STATUS.pending.icon },
} as const satisfies Record<"printed" | "partial" | "pending", StatusLook>;

/** Outcomes of a stocktaking scan (step 9.8); the text says what happened. */
export const INVENTORY_LOOK = {
	seen: { tone: "success", icon: "available" },
	again: { tone: "neutral", icon: "info" },
	misplaced: { tone: "warning", icon: "damaged" },
	found: { tone: "success", icon: "confirm" },
	onLoan: { tone: "primary", icon: "loan" },
	withdrawn: { tone: "neutral", icon: "withdrawn" },
	unknown: { tone: "error", icon: "help" },
} as const satisfies Record<string, StatusLook>;

/** The look of a stocktaking outcome; an outcome without one of its own looks unknown. */
export function inventoryLook(kind: string): StatusLook {
	return Object.hasOwn(INVENTORY_LOOK, kind)
		? INVENTORY_LOOK[kind as keyof typeof INVENTORY_LOOK]
		: INVENTORY_LOOK.unknown;
}

/** Tailwind/Skeleton classes per tone: filled badge, always with an icon and a label next to it. */
export const TONE_CLASS: Record<StatusTone, string> = {
	success: "preset-filled-success-500",
	warning: "preset-filled-warning-500",
	error: "preset-filled-error-500",
	tertiary: "preset-filled-tertiary-500",
	neutral: "preset-filled-surface-500",
	primary: "preset-filled-primary-500",
};
