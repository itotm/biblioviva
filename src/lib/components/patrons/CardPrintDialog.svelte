<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Stampa tessere" (step 9.27, Q127): front and back side by side (cut and folded on the short
     edge, for any printer) or on the two sides of the sheet (a printer that prints both sides, ten
     cards per A4), with what to choose in the browser's print window; the print page opens in a new
     tab. `query` chooses the cards (`ids=1,2`, `group=3`, `list=4`…), without the layout. With
     `markGroupId` (Stampe → Classi) the dialog then offers "Segna come stampate" for that class
     (a list and the patron page mark through their own buttons). -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { useI18n } from "#lib/i18n/context.js";
	import { getCardPrintOptions } from "#lib/remote/cards.remote.js";
	import { markClassCardsPrinted } from "#lib/remote/print-lists.remote.js";
	import { toaster } from "#lib/ui/toaster.js";
	import type { CardLayout } from "#lib/shared/card-layout.js";
	import Legend from "#lib/ui/Legend.svelte";
	import BulletList from "#lib/ui/BulletList.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Link from "#lib/ui/Link.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import { icons } from "#lib/ui/icons.js";

	interface Props {
		open?: boolean;
		query: string;
		/** How many cards, when known. */
		count?: number;
		/** The class whose cards are printed: the print page is followed by "Segna come stampate". */
		markGroupId?: number;
	}

	let { open = $bindable(false), query, count, markGroupId }: Props = $props();
	const i18n = useI18n();
	const PrintIcon = icons.print;
	const CheckIcon = icons.confirm;
	let opened = $state(false);
	let busy = $state(false);
	const t = (key: string, params?: Record<string, unknown>): string =>
		i18n.t(`printing.cards.${key}`, params);
	const options = $derived(open ? getCardPrintOptions() : null);
	let chosen = $state<CardLayout | null>(null);
	// every opening starts from the configured layout, however the dialog was closed before
	let wasOpen = false;
	$effect(() => {
		if (open && !wasOpen) {
			chosen = null;
			opened = false;
		}
		wasOpen = open;
	});
	const layout = $derived<CardLayout>(chosen ?? options?.current?.layout ?? "side-by-side");
	const flip = $derived(options?.current?.flip ?? "long-edge");
	// what the sheet shows to cut along: the crop marks, a coloured outline or nothing
	const cut = $derived(options?.current?.cut ?? "marks");
	const isAdmin = $derived(hasPermission(page.data.user, "admin"));

	async function mark(): Promise<void> {
		if (markGroupId === undefined) {
			return;
		}
		busy = true;
		try {
			const r = await markClassCardsPrinted({ groupId: markGroupId });
			toaster.success({ title: i18n.t("printing.list.marked", { count: r.marked }) });
			open = false;
		} finally {
			busy = false;
		}
	}
	const target = $derived(resolve(`print/cards?${query ? `${query}&` : ""}layout=${layout}`));
</script>

<Modal
	bind:open
	title={t("title")}
	onclose={() => (chosen = null)}
	width="lg"
	data-testid="card-print-dialog"
>
	{#if count !== undefined}
		<Hint tone="primary">{t("count", { count })}</Hint>
	{/if}
	<fieldset>
		<Legend>{t("layout")}</Legend>
		<!-- two halves whose labels wrap: a phone keeps both inside the dialog -->
		<SegmentedGroup
			radio
			size="md"
			toggleClass="h-auto min-w-0 flex-1 basis-0 whitespace-normal"
			data-testid="card-layout"
			options={(["side-by-side", "duplex"] as const).map((l) => ({
				value: l,
				label: t(`layouts.${l}`),
				testid: `card-layout-${l}`,
			}))}
			value={layout}
			onselect={(l) => (chosen = l)}
		/>
	</fieldset>
	<div data-testid="card-print-steps">
		<p class="mb-1 font-semibold">{t("window")}</p>
		<BulletList>
			{#if layout === "duplex"}
				<li>{t(`steps.duplex.${flip}`)}</li>
			{/if}
			<li>{t("steps.scale")}</li>
			<li>{t("steps.margins")}</li>
			<li>{t(`steps.after.${layout}.${cut}`)}</li>
		</BulletList>
	</div>
	{#if layout === "duplex" && isAdmin}
		<Hint tone="soft" data-testid="card-print-calibrate">
			{t("calibrate")}
			<Link href="/admin/cards/calibration">{i18n.t("admin.calibration.open")}</Link>
		</Hint>
	{/if}
	{#if opened && markGroupId !== undefined}
		<Hint tone="soft" data-testid="card-after-print">{t("afterPrint")}</Hint>
	{/if}
	<Row justify="end" as="footer">
		<Button onclick={() => (open = false)} disabled={busy} data-testid="card-print-close"
			>{i18n.t("common.actions.close")}</Button
		>
		{#if opened && markGroupId !== undefined}
			<Button
				variant="success-tonal"
				icon={CheckIcon}
				onclick={mark}
				disabled={busy}
				data-testid="card-mark-printed">{i18n.t("printing.list.markPrinted")}</Button
			>
		{/if}
		<Button
			variant="primary"
			icon={PrintIcon}
			href={target}
			target="_blank"
			onclick={() => (opened = true)}
			data-testid="card-print">{t("print")}</Button
		>
	</Row>
</Modal>
