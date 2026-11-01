// SPDX-License-Identifier: GPL-3.0-or-later
// Renewals from every entry point (step 4.5): the checkout desk, the patron page, the loans list.
// One loan or all the loans of a patron; refusals are explained with the Appendix I messages,
// "Restituisci" leads to the Returns page with the barcode, an administrator may force the
// overridable ones with a reason (`OverrideDialog`, driven by `pending`).
import { renew, renewAll } from "#lib/remote/circulation.remote.js";
import type { RenewResult } from "#lib/server/services/circulation.js";
import { checkinHref, deskMessage, type DeskMessageData, type Translate } from "./desk-message.js";

export interface RenewalContext {
	/** `i18n.t` of the page. */
	t: Translate;
	formatDate: (iso: string) => string;
	canOverride: () => boolean;
	/** Shows the messages in the page (replacing the previous ones). */
	show: (...messages: DeskMessageData[]) => void;
	/** The patron whose desk panel must be refreshed, if any. */
	patronId: () => number | null;
	/** Called after every renewal attempt (e.g. to reload the patron page). */
	after?: () => void;
}

export class Renewals {
	/** The loan waiting for the administrator's reason. */
	pending = $state<number | null>(null);
	readonly #ctx: RenewalContext;

	constructor(ctx: RenewalContext) {
		this.#ctx = ctx;
	}

	message(r: RenewResult): DeskMessageData {
		const { t, formatDate } = this.#ctx;
		if (r.ok) {
			return deskMessage(t, "renewed", { title: r.title, date: formatDate(r.dueDate) });
		}
		return deskMessage(t, r.reason, { ...r.params, due: formatDate(String(r.params.due)) }, [
			{
				label: t("circulation.actions.return"),
				href: checkinHref(r.barcode),
				testid: "action-return",
			},
			...(r.overridable && this.#ctx.canOverride()
				? [
						{
							label: t("circulation.actions.forceAdmin"),
							variant: "error" as const,
							testid: "action-override-renewal",
							onclick: () => {
								this.pending = r.loanId;
							},
						},
					]
				: []),
		]);
	}

	async one(loanId: number, override?: { reason: string }): Promise<void> {
		const r = await renew({ loanId, patronId: this.#ctx.patronId() ?? undefined, override });
		this.#ctx.show(this.message(r));
		this.#ctx.after?.();
	}

	async all(patronId: number): Promise<void> {
		this.#summary(await renewAll({ patronId }));
	}

	/** Several loans (the selection of the loans grid), one after the other. */
	async many(loanIds: readonly number[]): Promise<void> {
		const results: RenewResult[] = [];
		for (const loanId of loanIds) {
			results.push(await renew({ loanId }));
		}
		this.#summary(results);
	}

	#summary(results: RenewResult[]): void {
		const renewed = results.filter((r) => r.ok).length;
		this.#ctx.show(
			deskMessage(
				this.#ctx.t,
				"renewed_all",
				{ n: renewed, total: results.length },
				undefined,
				renewed === results.length ? "success" : "warning",
			),
			...results.filter((r) => !r.ok).map((r) => this.message(r)),
		);
		this.#ctx.after?.();
	}

	/** Confirms the override dialog. */
	async force(reason: string): Promise<void> {
		const loanId = this.pending;
		this.pending = null;
		if (loanId !== null) {
			await this.one(loanId, { reason });
		}
	}
}
