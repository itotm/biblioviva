<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Check-in desk (step 4.4, Appendix I): scan the returned books one after the other, the field
     stays focused for piles of books. Each return shows the patron, the loan dates and the days
     late (information only, there are no fines); "Rinnova invece" reopens and renews a book the
     pupil wanted to keep, "Segna danneggiato" flags a worn copy. A code coming from the checkout
     desk (`?barcode=`) waits in the field: the return is confirmed here with Enter, never implicitly.
     After a return, "Presta a <nome>" opens the Loans page with its borrower (9.52). -->
<script lang="ts">
	import DeskMessages from "#lib/components/circulation/DeskMessages.svelte";
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { useCodeTable } from "#lib/scanner/context.js";
	import { codeExamples } from "#lib/shared/barcodes/table.js";
	import {
		checkin,
		markReturnedDamaged,
		renewInstead,
		scanAtDesk,
	} from "#lib/remote/circulation.remote.js";
	import type { CheckinResult, ReturnedLoan } from "#lib/server/services/circulation.js";
	import BarcodeInput from "#lib/components/BarcodeInput.svelte";
	import ClassBadge from "#lib/components/ClassBadge.svelte";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import {
		cardOnCheckin,
		deskMessage,
		lendToAction,
		scanFailure,
		withDeskScan,
		type DeskMessageData,
	} from "#lib/components/circulation/desk-message.js";
	import { icons } from "#lib/ui/icons.js";
	import { LOAN_STATUS, ITEM_STATUS } from "#lib/ui/status.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	// what the codes of this library look like, for the "not found" message
	const codeTable = useCodeTable();
	const examples = $derived(codeExamples(codeTable, data.libraryYear));
	const RenewIcon = icons.renew;
	const DamagedIcon = icons.damaged;
	const PrintIcon = icons.print;

	interface Returned {
		key: number;
		loan: ReturnedLoan;
		renewedUntil: string | null;
		damaged: boolean;
	}

	// svelte-ignore state_referenced_locally
	let code = $state(data.barcode);
	let returns = $state<Returned[]>([]);
	const pending = (barcode: string): DeskMessageData[] =>
		barcode ? [deskMessage(i18n.t, "checkin_pending", { code: barcode })] : [];
	// svelte-ignore state_referenced_locally
	let messages = $state<DeskMessageData[]>(pending(data.barcode));
	let busy = $state(false);
	let scanner = $state<{ focus: () => void }>();
	let nextKey = 0;

	const formatDate = (iso: string): string => fmt.day(iso, "medium");

	function show(...list: DeskMessageData[]): void {
		messages = list;
		scanner?.focus();
	}

	async function markDamaged(row: Returned): Promise<void> {
		await markReturnedDamaged({ itemId: row.loan.itemId });
		row.damaged = true;
		show(deskMessage(i18n.t, "marked_damaged", { title: row.loan.title }));
	}

	async function renewRow(row: Returned): Promise<void> {
		const r = await renewInstead({ loanId: row.loan.loanId });
		if (r.ok) {
			row.renewedUntil = r.dueDate;
			show(
				deskMessage(i18n.t, "renewed_instead", {
					title: r.title,
					date: formatDate(r.dueDate),
				}),
			);
		} else {
			show(
				deskMessage(i18n.t, r.reason, {
					...r.params,
					due: formatDate(String(r.params.due)),
				}),
			);
		}
	}

	function explain(result: CheckinResult): void {
		const found = (title: string): DeskMessageData =>
			deskMessage(i18n.t, "was_lost_now_found", { title }, [
				{
					label: i18n.t("circulation.actions.confirm"),
					testid: "action-confirm-found",
					onclick: () => {
						messages = messages.filter((m) => m.code !== "was_lost_now_found");
						scanner?.focus();
					},
				},
			]);
		switch (result.kind) {
			case "returned": {
				const row: Returned = {
					key: nextKey++,
					loan: result.loan,
					renewedUntil: null,
					damaged: false,
				};
				returns = [row, ...returns];
				const l = result.loan;
				const main =
					l.overdueDays > 0
						? deskMessage(
								i18n.t,
								"returned_overdue",
								{ title: l.title, days: l.overdueDays, due: formatDate(l.dueDate) },
								[
									lendToAction(i18n.t, l.patronId, l.name),
									{
										label: i18n.t("circulation.actions.markDamaged"),
										testid: "action-mark-damaged",
										onclick: () =>
											markDamaged(
												returns.find((r) => r.key === row.key) ?? row,
											),
									},
								],
							)
						: deskMessage(i18n.t, "returned", { title: l.title, name: l.name }, [
								lendToAction(i18n.t, l.patronId, l.name),
							]);
				show(main, ...(result.wasLost ? [found(l.title)] : []));
				return;
			}
			case "not_on_loan":
				show(
					result.wasLost
						? found(result.title)
						: deskMessage(i18n.t, "not_on_loan", { title: result.title }),
				);
				return;
			case "already_returned_today":
				show(
					deskMessage(i18n.t, "already_returned_today", {
						title: result.title,
						time: result.time,
					}),
				);
		}
	}

	async function returnItem(itemId: number): Promise<void> {
		explain(await checkin({ itemId }));
	}

	function cardHere(patronId: number, name: string): void {
		show(cardOnCheckin(i18n.t, patronId, name));
	}

	async function onScan(value: string): Promise<void> {
		await withDeskScan(
			(on) => {
				busy = on;
			},
			() => scanner?.focus(),
			async () => {
				const target = await scanAtDesk({ code: value });
				switch (target.kind) {
					case "item":
						await returnItem(target.itemId);
						return;
					case "patron":
						cardHere(target.patronId, target.name);
						return;
					case "ambiguous":
						show(
							deskMessage(
								i18n.t,
								"ambiguous_legacy",
								{ code: target.code, name: target.name, title: target.title },
								[
									{
										label: i18n.t("circulation.actions.card"),
										testid: "action-card",
										onclick: () => cardHere(target.patronId, target.name),
									},
									{
										label: i18n.t("circulation.actions.book"),
										testid: "action-book",
										onclick: () => returnItem(target.itemId),
									},
								],
							),
						);
						return;
					case "badCheckDigit":
					case "unknown":
						show(scanFailure(target, { t: i18n.t, examples, retry: () => show() }));
				}
			},
		);
	}
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("circulation.checkin.title")} icon="return">
		{#snippet views()}
			<AreaTabs area="circulation" current="checkin" />
		{/snippet}
	</PageHeader>
	<div class="space-y-4">
		<Card gap="3" as="section">
			<BarcodeInput
				bind:this={scanner}
				bind:value={code}
				label={i18n.t("circulation.checkin.scan")}
				camera
				autofocus
				disabled={busy}
				onscan={(_kind, value) => void onScan(value)}
				oninvalid={(r) => void onScan(r.value)}
			/>
			<Hint>{i18n.t("circulation.checkin.scanHint")}</Hint>
		</Card>
		<DeskMessages {messages} />
		<Card gap="3" as="section" data-testid="checkin-session">
			<h2 class="font-semibold">{i18n.t("circulation.checkin.session")}</h2>
			{#if returns.length === 0}
				<Hint>{i18n.t("circulation.checkin.sessionEmpty")}</Hint>
			{:else}
				<DividedList data-testid="checkin-list">
					{#each returns as row (row.key)}
						{@const l = row.loan}
						<Row
							as="li"
							justify="between"
							align="center"
							class="py-3"
							data-testid="checkin-row"
						>
							<div class="min-w-0 space-y-1">
								<TitleHint title={l.title} truncate mono>{l.barcode}</TitleHint>
								<Row gap="2" align="center">
									<span class="font-medium">{l.name}</span>
									<ClassBadge
										label={l.classLabel}
										fallback={i18n.t("circulation.checkout.teacher")}
									/>
									<Hint as="span"
										>{i18n.t("circulation.checkin.lentOn", {
											date: formatDate(l.issuedOn),
										})} · {i18n.t("circulation.checkin.dueOn", {
											date: formatDate(l.dueDate),
										})}</Hint
									>
								</Row>
								<Row gap="2">
									{#if row.renewedUntil}
										<StatusBadge
											size="sm"
											status={LOAN_STATUS.open}
											detail={i18n.t("circulation.checkin.renewedBadge", {
												date: formatDate(row.renewedUntil),
											})}
										/>
									{:else if l.overdueDays > 0}
										<StatusBadge
											size="sm"
											status={LOAN_STATUS.overdue}
											detail={i18n.t("circulation.checkin.late", {
												days: l.overdueDays,
											})}
										/>
									{:else}
										<StatusBadge
											size="sm"
											status={LOAN_STATUS.returned}
											detail={i18n.t("circulation.checkin.onTime")}
										/>
									{/if}
									{#if row.damaged}
										<StatusBadge size="sm" status={ITEM_STATUS.damaged} />
									{/if}
								</Row>
							</div>
							{#if !row.renewedUntil}
								<Row gap="2">
									{#if l.patronOverdue > 0}
										<Button
											size="sm"
											icon={PrintIcon}
											href={resolve(`print/overdues?patron=${l.patronId}`)}
											target="_blank"
											rel="noopener"
											data-testid="checkin-reminder"
											>{i18n.t("circulation.actions.printReminder")}</Button
										>
									{/if}
									<Button
										size="sm"
										icon={RenewIcon}
										onclick={() => renewRow(row)}
										data-testid="checkin-renew"
										>{i18n.t("circulation.checkin.renewInstead")}</Button
									>
									{#if !row.damaged}
										<Button
											size="sm"
											icon={DamagedIcon}
											onclick={() => markDamaged(row)}
											data-testid="checkin-damaged"
											>{i18n.t("circulation.actions.markDamaged")}</Button
										>
									{/if}
								</Row>
							{/if}
						</Row>
					{/each}
				</DividedList>
			{/if}
		</Card>
	</div>
</Page>
