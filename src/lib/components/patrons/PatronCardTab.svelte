<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The patron page's card (steps 2.5, 9.27): the number and its barcode, when it was printed,
     printing it, marking it printed and giving the patron a new number. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { markCardsPrinted, reassignCard } from "#lib/remote/patrons.remote.js";
	import type { getPatronDetail } from "#lib/remote/patrons.remote.js";
	import { useFormat } from "#lib/ui/format.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import ConfirmDialog from "../ConfirmDialog.svelte";
	import CardPrintDialog from "./CardPrintDialog.svelte";

	type Patron = Awaited<ReturnType<typeof getPatronDetail>>;

	interface Props {
		patron: Patron;
	}

	const { patron: p }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const PrintIcon = icons.print;
	const CheckIcon = icons.confirm;
	const CardIcon = icons.card;
	let busy = $state(false);
	let confirmReassign = $state(false);
	/** "Stampa tessera": the dialog of side by side or both sides (9.27). */
	let cardDialog = $state(false);

	async function doMarkPrinted(): Promise<void> {
		busy = true;
		try {
			await markCardsPrinted({ ids: [p.id] });
			toaster.success({ title: i18n.t("patrons.detail.cardMarkedPrinted") });
		} finally {
			busy = false;
		}
	}

	async function doReassign(): Promise<void> {
		const result = await reassignCard({ id: p.id });
		toaster.success({
			title: i18n.t("patrons.detail.cardReassigned", { number: result.cardNumber }),
		});
	}
</script>

{#if p.cardNumber}
	<p class="font-semibold">
		{i18n.t("patrons.detail.card", { number: p.cardNumber })}
	</p>
	<img
		src="/media/barcode/{p.cardNumber}.svg"
		alt={i18n.t("patrons.detail.barcodeAlt", { number: p.cardNumber })}
		class="h-20 rounded-base bg-white p-1 ring-1 ring-surface-200"
		data-testid="card-barcode"
	/>
	<Hint>
		{p.cardPrintedAt
			? i18n.t("patrons.detail.cardPrinted", {
					when: fmt.date(p.cardPrintedAt, "medium"),
				})
			: i18n.t("patrons.detail.cardNotPrinted")}
	</Hint>
{:else}
	<p>{i18n.t("patrons.fields.noCard")}</p>
{/if}
{#if p.status !== "anonymized" && p.cardNumber}
	<Row>
		<Button
			variant="primary"
			icon={PrintIcon}
			onclick={() => (cardDialog = true)}
			data-testid="print-card">{i18n.t("patrons.detail.printCard")}</Button
		>
		<Button
			icon={CheckIcon}
			onclick={doMarkPrinted}
			disabled={busy}
			data-testid="mark-card-printed">{i18n.t("patrons.detail.markCardPrinted")}</Button
		>
	</Row>
{/if}
{#if p.status !== "anonymized"}
	<Button
		icon={CardIcon}
		onclick={() => (confirmReassign = true)}
		disabled={busy}
		data-testid="reassign-card">{i18n.t("patrons.detail.reassignCard")}</Button
	>
{/if}

<ConfirmDialog
	bind:open={confirmReassign}
	title={i18n.t("patrons.detail.reassignTitle")}
	description={i18n.t("patrons.detail.reassignDescription")}
	confirmLabel={i18n.t("patrons.detail.reassignCard")}
	onconfirm={doReassign}
/>
<CardPrintDialog bind:open={cardDialog} query={`ids=${p.id}`} />
