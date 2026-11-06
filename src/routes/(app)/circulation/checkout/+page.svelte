<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Checkout desk (step 4.3, Appendix I, 9.13 round 33): one field, in two steps. First the patron:
     the card scanned, or a part of the name typed (the list opens from the third letter); a book's
     code there only says to start from the card. Then the books, by their codes one after the other
     (no search by title). A patron already at the loan limit never reaches the second step: a
     dialog in the middle of the page says so, the open loans can still be renewed. Every anomaly is
     explained with what to do, never with a sound. "Annulla ultimo" undoes the last loan of the
     session, "Fine" closes it; after `ui.checkoutIdleSeconds` without activity the session closes
     by itself. A copy on loan read before a card is returned here and its borrower is chosen, as
     if the card had been read: a pupil brings a book back and borrows the next at once (9.52). -->
<script lang="ts">
	import DeskMessages from "#lib/components/circulation/DeskMessages.svelte";
	import { resolve } from "$app/paths";
	import DividedList from "#lib/ui/DividedList.svelte";
	import { onDestroy, tick } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { patronFullName } from "#lib/shared/patron-name.js";
	import { useCodeTable } from "#lib/scanner/context.js";
	import { codeExamples } from "#lib/shared/barcodes/table.js";
	import { deskTitles } from "#lib/shared/desk-titles.js";
	import {
		checkin,
		checkout,
		findPatronsAtDesk,
		getDeskPatron,
		scanAtDesk,
		undoLastCheckout,
	} from "#lib/remote/circulation.remote.js";
	import type { CheckedOut, CheckoutResult } from "#lib/server/services/circulation.js";
	import BarcodeInput from "#lib/components/BarcodeInput.svelte";
	import DeskMessage from "#lib/components/circulation/DeskMessage.svelte";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import OverrideDialog from "#lib/components/circulation/OverrideDialog.svelte";
	import PatronPanel from "#lib/components/circulation/PatronPanel.svelte";
	import PinnedNotes from "#lib/components/notes/PinnedNotes.svelte";
	import TodayActivity from "#lib/components/circulation/TodayActivity.svelte";
	import {
		checkoutRefusal,
		deskMessage,
		lentMessages,
		loanLimitMessage,
		noPatronSelected,
		scanFailure,
		withDeskScan,
		type CheckoutMessageContext,
		type DeskMessageData,
	} from "#lib/components/circulation/desk-message.js";
	import { Renewals } from "#lib/components/circulation/renewals.svelte.js";
	import { icons } from "#lib/ui/icons.js";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Row from "#lib/ui/Row.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	// what the codes of this library look like, for the "not found" message
	const codeTable = useCodeTable();
	const examples = $derived(codeExamples(codeTable, data.libraryYear));
	const UndoIcon = icons.back;
	const DoneIcon = icons.confirm;
	const PrintIcon = icons.print;

	// svelte-ignore state_referenced_locally
	let patronId = $state<number | null>(data.patronId);
	let session = $state<CheckedOut[]>([]);
	let messages = $state<DeskMessageData[]>([]);
	let busy = $state(false);
	let scanner = $state<{ focus: () => void }>();
	/** The copy waiting for the administrator's reason. */
	let overrideItem = $state<number | null>(null);
	const patron = $derived(patronId === null ? null : getDeskPatron(patronId));
	/** The patron's own limit is reached: the field for the books gives way to a notice. */
	const atLimit = $derived(
		patron?.current?.id === patronId && patron.current.loans.length >= patron.current.maxLoans,
	);
	/** A loan refused for the limit: shown in the middle of the page, never as a passing toast. */
	let limitPopup = $state<DeskMessageData | null>(null);
	/** Set when a patron is chosen: the limit is checked once their loans are known. */
	let checkLimitOf = $state<number | null>(null);

	const formatDate = (iso: string): string => fmt.day(iso, "medium");

	// --- idle reset
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	function touch(): void {
		clearTimeout(idleTimer);
		if (patronId === null) {
			return;
		}
		idleTimer = setTimeout(() => {
			const name = patron?.current ? patronFullName(patron.current) : "";
			finish();
			messages = [
				deskMessage(i18n.t, "session_idle_reset", {
					n: Math.max(1, Math.round(data.idleSeconds / 60)),
					name,
				}),
			];
		}, data.idleSeconds * 1000);
	}
	onDestroy(() => clearTimeout(idleTimer));

	function show(...list: DeskMessageData[]): void {
		messages = list;
		scanner?.focus();
	}

	const renewals = new Renewals({
		t: (key, params) => i18n.t(key, params),
		formatDate,
		canOverride: () => data.canOverride,
		show,
		patronId: () => patronId,
	});

	function selectPatron(id: number): void {
		if (id !== patronId) {
			session = [];
		}
		patronId = id;
		messages = [];
		checkLimitOf = id;
		touch();
		// the field of the books replaces the patron's: focus it once it is on the page
		void tick().then(() => scanner?.focus());
	}

	// a patron already at the limit when chosen: the dialog, with the loans that count
	$effect(() => {
		const current = patron?.current;
		if (checkLimitOf === null || current?.id !== checkLimitOf) {
			return;
		}
		checkLimitOf = null;
		if (current.loans.length >= current.maxLoans) {
			limitPopup = loanLimitMessage(i18n.t, {
				name: patronFullName(current),
				n: current.loans.length,
				titles: deskTitles(current.loans),
				max: current.maxLoans,
			});
		}
	});

	function closeLimit(): void {
		limitPopup = null;
		scanner?.focus();
	}

	function finish(): void {
		clearTimeout(idleTimer);
		patronId = null;
		session = [];
		messages = [];
		limitPopup = null;
		// the patron's field replaces the one of the books: focus it once it is on the page
		void tick().then(() => scanner?.focus());
	}

	// the desk opened again from its tab or the menu while on it (the page stays mounted): it starts
	// over, with the patron of the address if any ("Vai a Prestiti" from Returns)
	afterNavigate((nav) => {
		if (nav.type === "enter" || nav.from?.url.pathname !== nav.to?.url.pathname) {
			return;
		}
		if (data.patronId === null) {
			finish();
		} else {
			selectPatron(data.patronId);
		}
	});

	async function lend(
		itemId: number,
		code: string,
		withOverride?: { reason: string },
	): Promise<void> {
		if (patronId === null) {
			return;
		}
		const result: CheckoutResult = await checkout({ patronId, itemId, override: withOverride });
		const ctx: CheckoutMessageContext = {
			t: i18n.t,
			formatDate,
			patronId,
			patronName: patron?.current ? patronFullName(patron.current) : "",
			code,
			canClassify: data.canClassify,
			canOverride: data.canOverride,
			renew: (loanId) => renewals.one(loanId),
			dismiss: () => show(),
			override: () => {
				overrideItem = itemId;
			},
		};
		if (result.ok) {
			session = [result.loan, ...session];
			show(...lentMessages(result, ctx));
		} else if (result.reason === "loan_limit_reached") {
			limitPopup = checkoutRefusal(result, ctx);
		} else {
			show(checkoutRefusal(result, ctx));
		}
	}

	/**
	 * A copy read with no patron chosen (9.52): on loan, it is returned and its borrower becomes
	 * the patron of the desk, as after the card; otherwise the card comes first.
	 */
	async function returnThenLend(itemId: number, title: string): Promise<void> {
		const back = await checkin({ itemId });
		const found = (t: string): DeskMessageData[] =>
			back.kind !== "already_returned_today" && back.wasLost
				? [deskMessage(i18n.t, "was_lost_now_found", { title: t })]
				: [];
		if (back.kind === "returned") {
			const l = back.loan;
			selectPatron(l.patronId);
			show(
				deskMessage(i18n.t, "returned_now_lending", { title: l.title, name: l.name }),
				...(l.overdueDays > 0
					? [
							deskMessage(i18n.t, "returned_overdue", {
								title: l.title,
								days: l.overdueDays,
								due: formatDate(l.dueDate),
							}),
						]
					: []),
				...found(l.title),
			);
		} else if (back.kind === "already_returned_today") {
			show(
				deskMessage(i18n.t, "already_returned_today", {
					title: back.title,
					time: back.time,
				}),
			);
		} else {
			show(noPatronSelected(i18n.t, title), ...found(title));
		}
	}

	async function onScan(code: string): Promise<void> {
		await withDeskScan(
			(on) => {
				busy = on;
			},
			() => scanner?.focus(),
			async () => {
				touch();
				const target = await scanAtDesk({ code });
				switch (target.kind) {
					case "patron":
						selectPatron(target.patronId);
						return;
					case "item": {
						if (patronId === null) {
							await returnThenLend(target.itemId, target.title);
							return;
						}
						const already = session.find((l) => l.itemId === target.itemId);
						if (already) {
							show(deskMessage(i18n.t, "duplicate_scan", { title: already.title }));
							return;
						}
						await lend(target.itemId, target.code);
						return;
					}
					case "ambiguous":
						// an old number shared by a card and a copy: the step says which one is meant
						if (patronId === null) {
							selectPatron(target.patronId);
						} else {
							await lend(target.itemId, target.code);
						}
						return;
					case "badCheckDigit":
					case "unknown":
						show(scanFailure(target, { t: i18n.t, examples, retry: () => show() }));
				}
			},
		);
	}

	async function undo(): Promise<void> {
		const last = session[0];
		if (!last || patronId === null) {
			return;
		}
		const r = await undoLastCheckout({ loanId: last.loanId, patronId });
		session = session.slice(1);
		show(deskMessage(i18n.t, "undo_done", r));
	}

	async function confirmOverride(reason: string): Promise<void> {
		const itemId = overrideItem;
		overrideItem = null;
		if (itemId !== null) {
			await lend(itemId, "", { reason });
		}
	}
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("circulation.checkout.title")} icon="loan">
		{#snippet views()}
			<AreaTabs area="circulation" current="checkout" />
		{/snippet}
	</PageHeader>
	<PinnedNotes notes={data.pinnedNotes} compact />
	<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
		<div class="space-y-4 {patronId === null ? 'lg:col-span-2' : ''}">
			<!-- as wide as a code or a name needs, not the whole column (owner) -->
			<Card gap="3" as="section" class="max-w-lg" data-testid="desk-scan-card">
				{#if patronId === null}
					<BarcodeInput
						bind:this={scanner}
						label={i18n.t("circulation.checkout.scanPatron")}
						placeholder={i18n.t("circulation.checkout.scanPatronPlaceholder")}
						camera
						cameraAccept={(r) => r.kind === "card" || r.kind === "ambiguous"}
						autofocus
						disabled={busy}
						patrons={findPatronsAtDesk}
						onpatron={(p) => selectPatron(p.id)}
						onscan={(_kind, value) => void onScan(value)}
						oninvalid={(r) => void onScan(r.value)}
						testid="desk-scan"
					/>
				{:else if atLimit}
					<Alert tone="warning" padded live={false} data-testid="desk-limit">
						<div class="space-y-3">
							<p>
								{i18n.t("circulation.checkout.limitReached", {
									name: patron?.current ? patronFullName(patron.current) : "",
									max: patron?.current?.maxLoans ?? 0,
								})}
							</p>
							<Button size="sm" variant="primary" icon={DoneIcon} onclick={finish}
								>{i18n.t("circulation.checkout.finish")}</Button
							>
						</div>
					</Alert>
				{:else}
					<BarcodeInput
						bind:this={scanner}
						label={i18n.t("circulation.checkout.scanBook")}
						camera
						autofocus
						disabled={busy}
						onscan={(_kind, value) => void onScan(value)}
						oninvalid={(r) => void onScan(r.value)}
						testid="desk-scan"
					/>
					<Hint>{i18n.t("circulation.checkout.scanBookHint")}</Hint>
				{/if}
			</Card>
			<DeskMessages {messages} />
			{#if patronId !== null}
				<Card gap="3" as="section" data-testid="desk-session">
					<Row justify="between" align="center" as="h2" class="font-semibold">
						<span>{i18n.t("circulation.checkout.session")}</span>
						<Row gap="2">
							<Button
								size="sm"
								icon={UndoIcon}
								onclick={undo}
								disabled={session.length === 0}
								data-testid="desk-undo"
								>{i18n.t("circulation.checkout.undo")}</Button
							>
							{#if data.receipts}
								<Button
									size="sm"
									icon={PrintIcon}
									href={session.length > 0
										? resolve(
												`print/receipt?loans=${session
													.map((l) => l.loanId)
													.reverse()
													.join(",")}`,
											)
										: undefined}
									disabled={session.length === 0}
									target="_blank"
									rel="noopener"
									data-testid="desk-receipt"
									>{i18n.t("circulation.checkout.receipt")}</Button
								>
							{/if}
							<Button
								size="sm"
								variant="primary"
								icon={DoneIcon}
								onclick={finish}
								data-testid="desk-finish"
								>{i18n.t("circulation.checkout.finish")}</Button
							>
						</Row>
					</Row>
					{#if session.length === 0}
						<Hint>{i18n.t("circulation.checkout.sessionEmpty")}</Hint>
					{:else}
						<DividedList data-testid="desk-session-list">
							{#each session as l (l.loanId)}
								<Row as="li" justify="between" align="center" class="py-2">
									<span class="font-semibold">{l.title}</span>
									<Hint as="span"
										>{i18n.t("circulation.checkout.due", {
											date: formatDate(l.dueDate),
										})}</Hint
									>
								</Row>
							{/each}
						</DividedList>
					{/if}
				</Card>
			{:else}
				<!-- what was lent and returned today, side by side under the field (owner) -->
				<TodayActivity split />
			{/if}
		</div>
		{#if patron?.current}
			<div>
				<PatronPanel
					patron={patron.current}
					onrenew={(loanId) => {
						touch();
						void renewals.one(loanId);
					}}
					onrenewall={() => {
						touch();
						if (patronId !== null) {
							void renewals.all(patronId);
						}
					}}
				/>
			</div>
		{/if}
	</div>

	<Modal
		open={limitPopup !== null}
		title={i18n.t("circulation.checkout.limitTitle")}
		onclose={closeLimit}
		data-testid="desk-limit-dialog"
	>
		{#if limitPopup}
			<DeskMessage message={limitPopup} />
		{/if}
		<Row justify="end">
			<Button onclick={closeLimit} data-testid="desk-limit-close"
				>{i18n.t("common.actions.close")}</Button
			>
		</Row>
	</Modal>
	<OverrideDialog
		open={overrideItem !== null}
		title={i18n.t("circulation.checkout.override.title")}
		confirmLabel={i18n.t("circulation.checkout.override.confirm")}
		onconfirm={confirmOverride}
		oncancel={() => (overrideItem = null)}
	/>
	<OverrideDialog
		open={renewals.pending !== null}
		title={i18n.t("circulation.renewals.overrideTitle")}
		confirmLabel={i18n.t("circulation.renewals.overrideConfirm")}
		onconfirm={(reason) => renewals.force(reason)}
		oncancel={() => (renewals.pending = null)}
	/>
</Page>
