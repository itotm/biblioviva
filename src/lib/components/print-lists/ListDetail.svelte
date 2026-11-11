<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One list of Stampe (step 2.8): rename, quick-filter and scanner adders, ordered entries with
     drag or arrow reordering and removal, empty, delete. It prints cards (patron lists) or labels
     (item lists, step 3.8) and marks them as printed; nothing else (the copies change in bulk from
     the catalogue's selection only, owner). -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		clearList,
		deleteList,
		getPrintListDetail,
		markListPrinted,
		renameList,
	} from "#lib/remote/print-lists.remote.js";
	import LabelPrintDialog from "#lib/components/catalog/LabelPrintDialog.svelte";
	import CardPrintDialog from "#lib/components/patrons/CardPrintDialog.svelte";
	import ItemEntry from "#lib/components/print-lists/ItemEntry.svelte";
	import ItemFilterAdder from "#lib/components/print-lists/ItemFilterAdder.svelte";
	import PatronEntry from "#lib/components/print-lists/PatronEntry.svelte";
	import PatronFilterAdder from "#lib/components/print-lists/PatronFilterAdder.svelte";
	import PrintListEntries from "#lib/components/print-lists/PrintListEntries.svelte";
	import ScanAdder from "#lib/components/print-lists/ScanAdder.svelte";
	import GridFooter from "#lib/ui/GridFooter.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { useFormat } from "#lib/ui/format.js";
	import { ICON_SIZE, icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import PageActions from "#lib/ui/PageActions.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Field from "#lib/ui/Field.svelte";

	interface Props {
		id: number;
		photosRequired: boolean;
	}

	const { id, photosRequired }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const detail = $derived(getPrintListDetail(id));
	const index = "/print-lists";
	const PrintIcon = icons.print;
	const CheckIcon = icons.confirm;
	const EditIcon = icons.edit;
	const DeleteIcon = icons.delete;
	const ClearIcon = icons.close;
	const FilterIcon = icons.filter;

	let busy = $state(false);
	let renaming = $state(false);
	let nameDraft = $state("");
	let clearAfter = $state(false);
	let confirmClear = $state(false);
	let confirmDelete = $state(false);
	let labelDialog = $state(false);
	let cardDialog = $state(false);
	let labelKind = $state<"pair" | "barcode" | "spine">("pair");
	const isItems = $derived(detail.current?.list.kind === "items");

	async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
		busy = true;
		try {
			return await fn();
		} finally {
			busy = false;
		}
	}

	async function saveName(): Promise<void> {
		const r = await run(() => renameList({ id, name: nameDraft }));
		if (r?.ok) {
			renaming = false;
			toaster.success({ title: i18n.t("printing.list.renamed") });
		}
	}

	async function markPrinted(): Promise<void> {
		const r = await run(() =>
			markListPrinted({
				listId: id,
				clear: clearAfter,
				labelKind: isItems ? labelKind : undefined,
			}),
		);
		if (r?.ok) {
			toaster.success({
				title: i18n.t(isItems ? "printing.list.markedItems" : "printing.list.marked", {
					count: r.marked,
				}),
			});
		}
	}

	async function clear(): Promise<void> {
		await run(() => clearList({ listId: id }));
		toaster.success({ title: i18n.t("printing.list.cleared") });
	}

	async function remove_list(): Promise<void> {
		await run(() => deleteList({ id }));
		toaster.success({ title: i18n.t("printing.lists.deleted") });
		await goto(resolve("print-lists"));
	}
</script>

<svelte:head>
	<title
		>{detail.current?.list.name ?? i18n.t("printing.lists.title")} · {i18n.t(
			"common.app.name",
		)}</title
	>
</svelte:head>

<Page width="2xl">
	<QueryState query={detail} mode="notFound" back={index}>
		{#snippet children(d)}
			{@const entries = d.list.kind === "items" ? d.itemRows.length : d.rows.length}
			{@const entriesLabel = i18n.t(
				d.list.kind === "items" ? "printing.list.entriesItems" : "printing.list.entries",
				{ count: entries },
			)}
			<PageHeader
				title={d.list.name}
				subtitle={d.list.lastPrintedAt
					? i18n.t("printing.lists.lastPrinted", {
							when: fmt.dateTime(d.list.lastPrintedAt),
						})
					: i18n.t("printing.lists.neverPrinted")}
				icon="lists"
				backHref={index}
				backLabel={i18n.t("common.actions.back")}
			>
				{#snippet actions()}
					<!-- the main action first; the rest in the menu when the row does not fit (9.13,
				     rounds 21–22) -->
					{@const rename = {
						key: "rename",
						label: i18n.t("printing.list.rename"),
						icon: EditIcon,
						onclick: () => {
							nameDraft = d.list.name;
							renaming = true;
						},
						testid: "rename-list",
					}}
					<PageActions
						actions={d.list.kind === "items"
							? [
									{
										key: "labels",
										label: i18n.t("printing.list.printLabels"),
										icon: PrintIcon,
										disabled: d.list.count === 0,
										onclick: () => (labelDialog = true),
										primary: true,
										testid: "print-list-labels",
									},
									rename,
								]
							: [
									{
										key: "cards",
										label: i18n.t("printing.list.print"),
										icon: PrintIcon,
										disabled: d.list.count === 0,
										onclick: () => (cardDialog = true),
										primary: true,
										testid: "print-list-cards",
									},
									rename,
								]}
					/>
				{/snippet}
			</PageHeader>

			{#if renaming}
				<Row
					align="end"
					as="form"
					onsubmit={(e) => {
						e.preventDefault();
						if (nameDraft.trim()) {
							void saveName();
						}
					}}
					data-testid="rename-form"
				>
					<Field label={i18n.t("printing.lists.name")} class="max-w-md grow"
						><Input
							bind:value={nameDraft}
							maxlength={80}
							data-testid="rename-input"
						/></Field
					>
					<!-- an empty name is refused before it reaches the server -->
					<Button variant="primary" type="submit" disabled={busy || !nameDraft.trim()}
						>{i18n.t("common.actions.save")}</Button
					>
					<Button onclick={() => (renaming = false)}
						>{i18n.t("common.actions.cancel")}</Button
					>
				</Row>
			{/if}

			<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<!-- Entries -->
				<Card gap="3" as="section" aria-label={entriesLabel}>
					<Row align="center">
						<Hint tone="primary" data-testid="list-count">{entriesLabel}</Hint>
						{#if d.list.kind === "items"}
							<Select
								auto
								bind:value={labelKind}
								aria-label={i18n.t("printing.list.markPrintedKind")}
								class="ml-auto"
								data-testid="mark-kind"
							>
								<option value="pair">{i18n.t("printing.labels.kinds.pair")}</option>
								<option value="barcode"
									>{i18n.t("printing.labels.kinds.barcode")}</option
								>
								<option value="spine"
									>{i18n.t("printing.labels.kinds.spine")}</option
								>
							</Select>
						{/if}
						<Row
							wrap={false}
							align="center"
							as="label"
							class="{d.list.kind === 'items' ? '' : 'ml-auto'} text-sm"
						>
							<input
								type="checkbox"
								class="checkbox"
								bind:checked={clearAfter}
								data-testid="clear-after"
							/>
							{i18n.t("printing.list.clearAfter")}
						</Row>
						<Button
							variant="success-tonal"
							icon={CheckIcon}
							onclick={markPrinted}
							disabled={busy || entries === 0}
							data-testid="mark-printed">{i18n.t("printing.list.markPrinted")}</Button
						>
					</Row>
					{#if entries === 0}
						<EmptyState
							title={i18n.t(
								d.list.kind === "items"
									? "printing.list.emptyItems"
									: "printing.list.empty",
							)}
							icon="lists"
						/>
					{:else if d.list.kind === "items"}
						<PrintListEntries listId={d.list.id} rows={d.itemRows} {busy} {run}>
							{#snippet entry(r)}<ItemEntry row={r} />{/snippet}
						</PrintListEntries>
						<GridFooter
							exportTable="list-items"
							exportParams={{ list: d.list.id }}
							exportMarc={d.list.kind === "items"}
						/>
					{:else}
						<PrintListEntries listId={d.list.id} rows={d.rows} {busy} {run}>
							{#snippet entry(r)}<PatronEntry row={r} />{/snippet}
						</PrintListEntries>
					{/if}
					<Row divided>
						<Button
							variant="tonal"
							icon={ClearIcon}
							onclick={() => (confirmClear = true)}
							disabled={busy || entries === 0}
							data-testid="clear-list">{i18n.t("printing.list.clear")}</Button
						>
						<Button
							variant="error-tonal"
							icon={DeleteIcon}
							onclick={() => (confirmDelete = true)}
							disabled={busy}
							data-testid="delete-list">{i18n.t("printing.list.delete")}</Button
						>
					</Row>
				</Card>

				<!-- Adders -->
				<div class="space-y-6">
					<ScanAdder listId={d.list.id} kind={d.list.kind} {busy} {run} />

					<Card gap="3" as="section" data-testid="quick-panel">
						<Row as="h2" align="center" wrap={false} class="font-semibold">
							<FilterIcon size={ICON_SIZE.md} aria-hidden="true" />
							{i18n.t("printing.list.quick.title")}
						</Row>
						<Hint>{i18n.t("printing.list.quick.hint")}</Hint>
						{#if d.list.kind === "items" && d.classification}
							<ItemFilterAdder
								listId={d.list.id}
								classification={d.classification}
								batches={d.batches}
								{busy}
								{run}
							/>
						{:else}
							<PatronFilterAdder
								listId={d.list.id}
								options={d.options}
								batches={d.batches}
								{photosRequired}
								{busy}
								{run}
							/>
						{/if}
					</Card>
				</div>
			</div>

			<ConfirmDialog
				bind:open={confirmClear}
				title={i18n.t("printing.list.clearTitle")}
				description={i18n.t(
					d.list.kind === "items"
						? "printing.list.clearDescriptionItems"
						: "printing.list.clearDescription",
				)}
				tone="error"
				confirmLabel={i18n.t("printing.list.clear")}
				onconfirm={clear}
			/>
			<ConfirmDialog
				bind:open={confirmDelete}
				title={i18n.t("printing.lists.deleteTitle", { name: d.list.name })}
				description={i18n.t("printing.lists.deleteDescription")}
				tone="error"
				confirmLabel={i18n.t("common.actions.delete")}
				onconfirm={remove_list}
			/>
			{#if d.list.kind === "items"}
				<LabelPrintDialog bind:open={labelDialog} listId={d.list.id} count={d.list.count} />
			{:else}
				<CardPrintDialog
					bind:open={cardDialog}
					query={`list=${d.list.id}`}
					count={d.list.count}
				/>
			{/if}
		{/snippet}
	</QueryState>
</Page>
