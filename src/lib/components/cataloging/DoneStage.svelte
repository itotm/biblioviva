<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Fast add, the confirmation (step 3.6, 9.13 round 11): what was saved with its cover, the
     barcodes of the new copies, the next book first, then labels, print list and the record. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import type { SavedBook } from "./fast-add.js";
	import AddToPrintList from "#lib/components/AddToPrintList.svelte";
	import LabelPrintDialog from "#lib/components/catalog/LabelPrintDialog.svelte";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";

	interface Props {
		saved: SavedBook;
		onanother: () => void;
	}

	const { saved, onanother }: Props = $props();
	const i18n = useI18n();
	const AddIcon = icons.add;
	const PrintIcon = icons.print;
	const CheckIcon = icons.available;
	let labelDialog = $state(false);
</script>

<Card padding="lg" gap="4" as="section" data-testid="stage-done">
	<Row wrap={false} align="center" gap="3">
		{#if saved.cover}
			<img
				src={saved.cover.dataUrl}
				alt={i18n.t("catalog.fastAdd.cover.alt")}
				class="h-24 w-auto max-w-16 shrink-0 rounded-base object-contain shadow"
				data-testid="done-cover-image"
			/>
		{:else}
			<span class="shrink-0 rounded-full bg-success-100 p-3 text-success-700">
				<CheckIcon size={ICON_SIZE.xl} aria-hidden="true" />
			</span>
		{/if}
		<div class="min-w-0">
			<h2 class="h4">{i18n.t("catalog.fastAdd.done.heading")}</h2>
			<p class="opacity-80" data-testid="done-summary">
				{saved.copiesOnly
					? i18n.t("catalog.fastAdd.done.summaryCopies", {
							count: saved.barcodes.length,
							title: saved.title,
						})
					: i18n.t("catalog.fastAdd.done.summary", {
							count: saved.barcodes.length,
							title: saved.title,
						})}
			</p>
			<!-- the cover's state is information, not an action: it stays with the summary -->
			{#if saved.cover}
				<Hint
					tone={saved.cover.state === "failed" ? "error" : "soft"}
					data-testid="done-cover-source"
				>
					{saved.cover.state === "saving"
						? i18n.t("catalog.fastAdd.cover.saving")
						: saved.cover.state === "failed"
							? i18n.t("catalog.fastAdd.cover.failed")
							: saved.cover.name
								? i18n.t("catalog.cover.downloaded", {
										provider: saved.cover.name,
									})
								: i18n.t("catalog.cover.saved")}
				</Hint>
			{/if}
		</div>
	</Row>
	<div>
		<p class="label-text">{i18n.t("catalog.fastAdd.done.barcodes")}</p>
		<Row as="ul" class="mt-1" data-testid="done-barcodes">
			{#each saved.barcodes as b (b)}
				<Badge as="li" class="font-mono text-base">{b}</Badge>
			{/each}
		</Row>
	</div>
	<!-- the next book first (9.13, round 11): the usual step after a save -->
	<Button
		variant="primary"
		full
		class="md:w-auto md:self-start"
		icon={AddIcon}
		onclick={onanother}
		autofocus
		data-testid="done-another">{i18n.t("catalog.fastAdd.done.another")}</Button
	>
	<Row>
		<Button icon={PrintIcon} onclick={() => (labelDialog = true)} data-testid="done-print"
			>{i18n.t("catalog.fastAdd.done.printLabels")}</Button
		>
		<AddToPrintList
			entityIds={saved.itemIds}
			kind="items"
			label={i18n.t("catalog.fastAdd.done.addToList")}
		/>
		<Button href="/catalog/{saved.biblioId}" data-testid="done-open"
			>{i18n.t("catalog.fastAdd.done.open")}</Button
		>
	</Row>
</Card>
<LabelPrintDialog bind:open={labelDialog} ids={saved.itemIds} count={saved.itemIds.length} />
