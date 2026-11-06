// SPDX-License-Identifier: GPL-3.0-or-later
// Circulation desk (steps 4.3–4.5): scan resolution, the patron panel, checkout (with the
// administrator's override for the overridable reasons only), undo, check-in (with "Rinnova
// invece" and "Segna danneggiato") and renewal. Permission `loans`.
import { command, query } from "$app/server";
import { error } from "@sveltejs/kit";
import * as v from "valibot";
import { debugLog, maskCode } from "#lib/server/log/debug.js";
import { requireUser } from "#lib/server/auth/guard.js";
import { orNotFound } from "#lib/server/http/errors.js";
import { can } from "#lib/server/auth/rbac.js";
import { resolveScan } from "#lib/server/barcodes/lookup.js";
import { codeTable } from "#lib/server/barcodes/table.js";
import { getConfig } from "#lib/server/config/index.js";
import { getDb } from "#lib/server/db/index.js";
import { libraryToday } from "#lib/server/services/calendar.js";
import { CHECK_IN_REASON, setItemStatus } from "#lib/server/services/catalog-items.js";
import {
	checkinItem,
	checkoutItem,
	markLoanLost,
	deskPatron,
	findDeskPatrons,
	renewAllLoans,
	renewInsteadOfReturn,
	renewLoan,
	undoCheckout,
} from "#lib/server/services/circulation.js";
import { getTodayActivity } from "./loans.remote.js";

import { dbId as id, scannedCode } from "#lib/shared/input-schemas.js";

/** The administrator's reason for forcing a checkout or a renewal (Appendix I, step 4.5). */
const overrideReason = v.optional(
	v.object({ reason: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(200)) }),
);

/** What a scanned or typed code is: a card, a copy, both (legacy numbers), or nothing. */
export const scanAtDesk = command(v.object({ code: scannedCode }), ({ code }) => {
	requireUser("loans");
	const target = resolveScan(getDb(), code, codeTable(getConfig()));
	// a card number is personal: the log keeps the kind and the ids, never the card's digits
	debugLog("desk", "scan", {
		kind: target.kind,
		code: target.kind === "patron" ? maskCode("card", target.code) : target.code,
		patronId: "patronId" in target ? target.patronId : undefined,
		itemId: "itemId" in target ? target.itemId : undefined,
	});
	return target;
});

export const getDeskPatron = query(id, (patronId) => {
	requireUser("loans");
	const config = getConfig();
	return orNotFound(() => deskPatron(getDb(), config, patronId, libraryToday(config)));
});

export const findPatronsAtDesk = query(v.pipe(v.string(), v.maxLength(60)), (q) => {
	requireUser("loans");
	return findDeskPatrons(getDb(), q, getConfig().ui.locale);
});

export const checkout = command(
	v.object({
		patronId: id,
		itemId: id,
		override: overrideReason,
	}),
	(input) => {
		const user = requireUser("loans");
		if (input.override && !can(user, "admin")) {
			error(403, "only an administrator can override");
		}
		const result = orNotFound(() => checkoutItem(getDb(), getConfig(), input, user));
		debugLog("desk", "checkout", {
			patronId: input.patronId,
			itemId: input.itemId,
			override: input.override,
			...(result.ok
				? { ok: true, loanId: result.loan.loanId, infos: result.infos.map((i) => i.code) }
				: { ok: false, reason: result.reason, overridable: result.overridable }),
		});
		void getDeskPatron(input.patronId).refresh();
		void getTodayActivity().refresh();
		return result;
	},
);

export const undoLastCheckout = command(v.object({ loanId: id, patronId: id }), (input) => {
	const user = requireUser("loans");
	const result = orNotFound(() => undoCheckout(getDb(), getConfig(), input.loanId, user));
	void getDeskPatron(input.patronId).refresh();
	void getTodayActivity().refresh();
	return result;
});

export const renew = command(
	v.object({ loanId: id, patronId: v.optional(id), override: overrideReason }),
	(input) => {
		const user = requireUser("loans");
		if (input.override && !can(user, "admin")) {
			error(403, "only an administrator can override");
		}
		const result = orNotFound(() =>
			renewLoan(
				getDb(),
				getConfig(),
				{ loanId: input.loanId, override: input.override },
				user,
			),
		);
		debugLog("desk", "renew", {
			loanId: input.loanId,
			override: input.override,
			...(result.ok
				? { ok: true, dueDate: result.dueDate }
				: { ok: false, reason: result.reason }),
		});
		if (input.patronId) {
			void getDeskPatron(input.patronId).refresh();
		}
		return result;
	},
);

/** "Rinnova tutti": every open loan of the patron, each with its own decision. */
export const renewAll = command(v.object({ patronId: id }), ({ patronId }) => {
	const user = requireUser("loans");
	const results = orNotFound(() => renewAllLoans(getDb(), getConfig(), patronId, user));
	void getDeskPatron(patronId).refresh();
	return results;
});

export const checkin = command(v.object({ itemId: id }), ({ itemId }) => {
	const user = requireUser("loans");
	const result = orNotFound(() => checkinItem(getDb(), getConfig(), itemId, user));
	// the borrower may be chosen at the checkout right after (9.52): their loans as they are now
	if (result.kind === "returned") {
		void getDeskPatron(result.loan.patronId).refresh();
	}
	debugLog("desk", "checkin", {
		itemId,
		kind: result.kind,
		loanId: result.kind === "returned" ? result.loan.loanId : undefined,
		wasLost: "wasLost" in result ? result.wasLost : undefined,
	});
	return result;
});

export const renewInstead = command(v.object({ loanId: id }), ({ loanId }) => {
	const user = requireUser("loans");
	return orNotFound(() => renewInsteadOfReturn(getDb(), getConfig(), loanId, user));
});

/** "Segna danneggiato" on a copy just returned: it keeps circulating (ADR-012), flagged. */
export const markReturnedDamaged = command(v.object({ itemId: id }), ({ itemId }) => {
	const user = requireUser("loans");
	orNotFound(() => setItemStatus(getDb(), itemId, "damaged", CHECK_IN_REASON, user));
});

/** "Segna smarrito" on an open loan (patron page): closes the loan, the copy becomes lost. */
export const markLost = command(
	v.object({ loanId: id, reason: v.pipe(v.string(), v.trim(), v.maxLength(200)) }),
	({ loanId, reason }) => {
		const user = requireUser("loans");
		const r = orNotFound(() => markLoanLost(getDb(), loanId, reason || null, user));
		void getDeskPatron(r.patronId).refresh();
		return r;
	},
);
