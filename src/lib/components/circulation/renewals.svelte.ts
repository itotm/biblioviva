// SPDX-License-Identifier: GPL-3.0-or-later
// Renewals from every entry point (step 4.5): the checkout desk, the patron page, the loans list.
// One loan or all the loans of a patron; refusals are explained with the Appendix I messages,
// "Restituisci" leads to the Returns page with the barcode, an administrator may force the
// overridable ones with a reason (`OverrideDialog`, driven by `pending`). A renewal before half of
// the loan period has passed waits for the operator's answer in the middle of the page
// (`EarlyRenewalAsk`, shown by `EarlyRenewalDialog`): "Rinnova comunque" renews, "Annulla" changes
// nothing.
import { tick } from "svelte";
import { renew, renewAll, renewMany } from "#lib/remote/circulation.remote.js";
import type {
	RenewFailure,
	RenewManyResult,
	RenewResult,
} from "#lib/server/services/circulation.js";
import { checkinHref, deskMessage, type DeskMessageData, type Translate } from "./desk-message.js";

/** What the early-renewal dialog shows: one loan's message, or the list of a bulk renewal. */
export type EarlyAsking =
	| { kind: "one"; message: DeskMessageData }
	| { kind: "many"; intro: string; lines: string[]; outro: string };

/**
 * The warning of an early renewal (`renewal_early`) waiting for the operator: `run` is the same
 * renewal again, now confirmed. Any account with `loans` may confirm; "Annulla" closes and the
 * focus goes back to the scan field.
 */
export class EarlyRenewalAsk {
	current = $state<EarlyAsking | null>(null);
	#run: (() => Promise<void>) | null = null;
	readonly #t: Translate;
	readonly #formatDate: (iso: string) => string;
	readonly #focus: (() => void) | undefined;

	constructor(ctx: { t: Translate; formatDate: (iso: string) => string; focus?: () => void }) {
		this.#t = ctx.t;
		this.#formatDate = ctx.formatDate;
		this.#focus = ctx.focus;
	}

	#params(r: RenewFailure): Record<string, string | number> {
		return {
			...r.params,
			due: this.#formatDate(String(r.params.due)),
			newDue: this.#formatDate(String(r.params.newDue)),
		};
	}

	/** Opens the dialog for the early renewals `early` of one request. */
	ask(early: RenewFailure[], run: () => Promise<void>, many: boolean): void {
		const t = this.#t;
		this.#run = run;
		const [first] = early;
		this.current =
			!many && first
				? { kind: "one", message: deskMessage(t, "renewal_early", this.#params(first)) }
				: {
						kind: "many",
						intro: t("circulation.renewals.early.manyIntro"),
						lines: early.map((r) =>
							t("circulation.renewals.early.manyLine", this.#params(r)),
						),
						outro: t("circulation.renewals.early.manyOutro"),
					};
	}

	async confirm(): Promise<void> {
		const run = this.#run;
		this.current = null;
		this.#run = null;
		await run?.();
	}

	cancel(): void {
		this.current = null;
		this.#run = null;
		// the dialog gives the focus back to the button that opened it as it closes: the scan
		// field takes it after that
		void tick().then(() => requestAnimationFrame(() => this.#focus?.()));
	}
}

export interface RenewalContext {
	/** `i18n.t` of the page. */
	t: Translate;
	formatDate: (iso: string) => string;
	canOverride: () => boolean;
	/** Shows the messages in the page (replacing the previous ones). */
	show: (...messages: DeskMessageData[]) => void;
	/** Puts the focus back in the scan field (a desk), when the early-renewal warning is cancelled. */
	focus?: () => void;
	/** The patron whose desk panel must be refreshed, if any. */
	patronId: () => number | null;
	/** Called after every renewal attempt (e.g. to reload the patron page). */
	after?: () => void;
}

export class Renewals {
	/** The loan waiting for the administrator's reason. */
	pending = $state<number | null>(null);
	/** The warning of an early renewal, shown by `EarlyRenewalDialog`. */
	readonly early: EarlyRenewalAsk;
	readonly #ctx: RenewalContext;

	constructor(ctx: RenewalContext) {
		this.#ctx = ctx;
		this.early = new EarlyRenewalAsk({
			t: ctx.t,
			formatDate: ctx.formatDate,
			focus: ctx.focus,
		});
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

	async one(
		loanId: number,
		override?: { reason: string },
		confirmEarly?: boolean,
	): Promise<void> {
		const r = await renew({
			loanId,
			patronId: this.#ctx.patronId() ?? undefined,
			override,
			confirmEarly,
		});
		if (!r.ok && r.reason === "renewal_early") {
			this.early.ask([r], () => this.one(loanId, override, true), false);
			return;
		}
		this.#ctx.show(this.message(r));
		this.#ctx.after?.();
	}

	async all(patronId: number, confirmEarly?: boolean): Promise<void> {
		this.#many(await renewAll({ patronId, confirmEarly }), () => this.all(patronId, true));
	}

	/** Several loans (the selection of the loans grid), decided together. */
	async many(loanIds: readonly number[], confirmEarly?: boolean): Promise<void> {
		this.#many(await renewMany({ loanIds: [...loanIds], confirmEarly }), () =>
			this.many(loanIds, true),
		);
	}

	/** A bulk renewal either done, or, with early renewals in it, asking before doing anything. */
	#many(r: RenewManyResult, confirmed: () => Promise<void>): void {
		if (r.kind === "early") {
			this.early.ask(r.early, confirmed, true);
		} else {
			this.#summary(r.results);
		}
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
