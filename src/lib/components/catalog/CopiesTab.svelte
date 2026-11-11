<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The copies of a record (step 3.1, labels 3.8): each copy with its status, borrower and labels,
     and the copy actions with their dialogs (add copies, edit, change status with a reason,
     delete). The record page opens "add copies" from its header through `openAdd`. The segnatura
     is computed by the server (Q143): the dialogs show it, and edit only the copy's text when the
     scheme has one. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import {
		addItems,
		deleteItem,
		type getBiblioDetail,
		proposeInventoryNumber,
		setItemStatus,
		suggestCallNumber,
		updateItem,
	} from "#lib/remote/catalog.remote.js";
	import type { ClassificationOptions } from "#lib/server/services/catalog.js";
	import type { ItemFormInput, ItemStatus } from "#lib/shared/catalog-schema.js";
	import { isFreeScheme, schemeUses } from "#lib/shared/classification.js";
	import { labelStatus } from "#lib/shared/copy-status.js";
	import { euroInput, formatEuro } from "#lib/shared/school-inventory.js";
	import { useFormat } from "#lib/ui/format.js";
	import { icons } from "#lib/ui/icons.js";
	import { ITEM_STATUS, type StatusDef } from "#lib/ui/status.js";
	import { toaster } from "#lib/ui/toaster.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import CallNumberShown from "./CallNumberShown.svelte";
	import PrintedBadge from "#lib/components/print-lists/PrintedBadge.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import IconButton from "#lib/ui/IconButton.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Link from "#lib/ui/Link.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import StatusBadge from "#lib/ui/StatusBadge.svelte";
	import Table from "#lib/ui/Table.svelte";

	type Biblio = Awaited<ReturnType<typeof getBiblioDetail>>;
	type Copy = Biblio["items"][number];

	interface Props {
		biblio: Biblio;
		options: ClassificationOptions;
		canEdit: boolean;
		/** The borrower links to the patron page (the `patrons` permission). */
		canOpenPatrons: boolean;
		/** Prints the labels of these copies. */
		onlabels: (ids: number[]) => void;
	}

	const { biblio, options, canEdit, canOpenPatrons, onlabels }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const EditIcon = icons.edit;
	const DeleteIcon = icons.delete;
	const StatusIcon = icons.repair;
	const PrintIcon = icons.print;

	const perItemClass = $derived(
		options.classPerItem && options.fictionByClass && biblio.kind === "fiction",
	);
	// the school inventory (9.64): its fields and column only while it is on
	const inventoryOn = $derived(options.inventory.enabled);

	// --- add copies dialog
	let addOpen = $state(false);
	let copies = $state(1);
	const emptyItem = (): ItemFormInput => ({
		callText: "",
		readingLevel: "",
		enumeration: "",
		acquisitionDate: "",
		notes: "",
		notForLoan: false,
		...(inventoryOn ? { inventoryNumber: "", origin: "", value: "" } : {}),
	});
	let draft = $state<ItemFormInput>(emptyItem());
	let issues = $state<{ field: string; message: string }[]>([]);
	// the copy's own text of the segnatura, only where the scheme has it (Q143)
	const copyText = $derived(schemeUses({ callNumber: options.callNumber }, "copytext"));
	const freeScheme = $derived(isFreeScheme(options.callNumber));

	/** Opens the "add copies" dialog with an empty copy. */
	export function openAdd(): void {
		draft = emptyItem();
		copies = 1;
		issues = [];
		addOpen = true;
		// the next inventory number, proposed and editable (9.64)
		if (inventoryOn) {
			void proposeInventoryNumber().then((next) => {
				if (next !== null && draft.inventoryNumber === "") {
					draft.inventoryNumber = next;
				}
			});
		}
	}

	async function doAdd(): Promise<boolean> {
		const r = await addItems({
			biblioId: biblio.id,
			copies,
			item: draft,
		});
		if (!r.ok) {
			issues = r.issues;
			return false;
		}
		toaster.success({
			title: i18n.t("catalog.item.added", {
				count: r.ids.length,
				barcodes: r.barcodes.join(", "),
			}),
		});
		return true;
	}

	// --- edit copy dialog
	let editItem = $state<{ id: number; barcode: string } | null>(null);
	let editDraft = $state<ItemFormInput>(emptyItem());
	function openEdit(it: Copy): void {
		editDraft = {
			callText: it.callText ?? "",
			readingLevel: it.readingLevel ?? "",
			enumeration: it.enumeration ?? "",
			acquisitionDate: it.acquisitionDate ?? "",
			notes: it.notes ?? "",
			notForLoan: it.notForLoan,
			...(inventoryOn
				? {
						inventoryNumber: it.inventoryNumber ?? "",
						origin: it.origin ?? "",
						value: euroInput(it.valueCents, fmt.locale),
					}
				: {}),
		};
		issues = [];
		editItem = { id: it.id, barcode: it.barcode };
	}
	async function doEdit(): Promise<boolean> {
		if (!editItem) {
			return true;
		}
		const r = await updateItem({ itemId: editItem.id, biblioId: biblio.id, item: editDraft });
		if (!r.ok) {
			issues = r.issues;
			return false;
		}
		editItem = null;
		toaster.success({ title: i18n.t("catalog.item.saved") });
		return true;
	}

	// --- status dialog
	let statusItem = $state<{ id: number; barcode: string; status: ItemStatus } | null>(null);
	let newStatus = $state<ItemStatus>("available");
	let reason = $state("");
	function openStatus(it: { id: number; barcode: string; status: ItemStatus }): void {
		statusItem = it;
		newStatus = it.status;
		reason = "";
	}
	/** False keeps the dialog open: the copy is on loan, another status may still be chosen. */
	async function doStatus(): Promise<boolean> {
		if (!statusItem) {
			return true;
		}
		const r = await setItemStatus({
			itemId: statusItem.id,
			biblioId: biblio.id,
			status: newStatus,
			reason,
		});
		if (!r.ok) {
			toaster.error({ title: i18n.t("catalog.item.onLoan") });
			return false;
		}
		statusItem = null;
		toaster.success({ title: i18n.t("catalog.item.statusSaved") });
		return true;
	}

	// --- delete copy
	let deleteTarget = $state<{ id: number; barcode: string } | null>(null);
	async function doDeleteItem(): Promise<void> {
		if (!deleteTarget) {
			return;
		}
		const r = await deleteItem({ itemId: deleteTarget.id, biblioId: biblio.id });
		// refused or done, the dialog closes: its state too, or it would never open again
		deleteTarget = null;
		if (!r.ok) {
			toaster.error({ title: i18n.t("catalog.item.hasLoans") });
			return;
		}
		toaster.success({ title: i18n.t("catalog.item.deleted") });
	}

	const statusOf = (it: { status: ItemStatus; notForLoan: boolean; loan: unknown }): StatusDef =>
		it.loan
			? ITEM_STATUS.on_loan
			: it.status === "available" && it.notForLoan
				? ITEM_STATUS.not_for_loan
				: ITEM_STATUS[it.status];
</script>

{#snippet itemFields(model: ItemFormInput, prefix: string)}
	{@const preview = suggestCallNumber({
		biblioId: biblio.id,
		readingLevel: model.readingLevel || null,
		copyText: model.callText || null,
	})}
	<Grid from="sm" gap="3">
		{#if copyText}
			<Field
				label={i18n.t(freeScheme ? "catalog.item.callNumber" : "catalog.item.callText")}
				hint={freeScheme ? undefined : i18n.t("catalog.item.callTextHint")}
				><Input
					mono
					bind:value={model.callText}
					maxlength={40}
					data-testid="{prefix}-call-text"
				/></Field
			>
		{/if}
		{#if !freeScheme}
			<CallNumberShown
				label={i18n.t("catalog.item.callNumber")}
				value={preview.current?.callNumber || "—"}
				hint={i18n.t("catalog.item.callNumberHint")}
				testid="{prefix}-call-number"
			/>
		{/if}
		{#if perItemClass}
			<Field label={i18n.t("catalog.item.readingLevel")}
				><Select bind:value={model.readingLevel} data-testid="{prefix}-reading-level">
					<option value="">{i18n.t("catalog.picker.anyClass")}</option>
					{#each options.readingLevels as l (l.code)}
						<option value={l.code}>{l.label}</option>
					{/each}
				</Select></Field
			>
		{/if}
		<Field label={i18n.t("catalog.item.enumeration")}
			><Input bind:value={model.enumeration} data-testid="{prefix}-enumeration" /></Field
		>
		<Field label={i18n.t("catalog.item.acquisitionDate")}
			><Input type="date" bind:value={model.acquisitionDate} /></Field
		>
		{#if inventoryOn}
			<Field
				label={i18n.t("catalog.item.inventoryNumber")}
				hint={prefix === "add" && copies > 1
					? i18n.t("catalog.item.inventoryNumberSeries")
					: undefined}
				><Input
					mono
					bind:value={model.inventoryNumber}
					maxlength={20}
					data-testid="{prefix}-inventory-number"
				/></Field
			>
			<Field label={i18n.t("catalog.item.origin")}
				><Select bind:value={model.origin} data-testid="{prefix}-origin">
					<option value="">—</option>
					{#each options.inventory.origins as o (o)}
						<option value={o}>{o}</option>
					{/each}
					{#if model.origin && !options.inventory.origins.includes(model.origin)}
						<option value={model.origin}>{model.origin}</option>
					{/if}
				</Select></Field
			>
			<Field label={i18n.t("catalog.item.value")} hint={i18n.t("catalog.item.valueHint")}
				><Input
					bind:value={model.value}
					inputmode="decimal"
					maxlength={16}
					data-testid="{prefix}-value"
				/></Field
			>
		{/if}
		<Field label={i18n.t("catalog.item.notes")} class="sm:col-span-2"
			><Input bind:value={model.notes} /></Field
		>
		<Row wrap={false} align="center" as="label" class="sm:col-span-2">
			<input type="checkbox" class="checkbox" bind:checked={model.notForLoan} />
			<span>{i18n.t("catalog.item.notForLoan")}</span>
		</Row>
	</Grid>
	{#each issues as issue (issue.field + issue.message)}
		<Hint tone="error" role="alert" data-testid="item-issue">{issue.message}</Hint>
	{/each}
{/snippet}

{#if biblio.items.length === 0}
	<p class="opacity-70" data-testid="no-copies">
		{i18n.t("catalog.detail.noCopies")}
	</p>
{:else}
	<div class="overflow-x-auto">
		<Table data-testid="items-table">
			<thead>
				<tr>
					<th>{i18n.t("catalog.detail.columns.barcode")}</th>
					{#if inventoryOn}<th>{i18n.t("catalog.detail.columns.inventory")}</th>{/if}
					<th>{i18n.t("catalog.detail.columns.callNumber")}</th>
					{#if perItemClass}<th>{i18n.t("catalog.detail.columns.readingLevel")}</th>{/if}
					<th>{i18n.t("catalog.detail.columns.status")}</th>
					<th>{i18n.t("catalog.detail.columns.borrower")}</th>
					<th>{i18n.t("catalog.detail.columns.labels")}</th>
					{#if canEdit}<th class="p-2"
							><span class="sr-only">{i18n.t("common.actions.edit")}</span></th
						>{/if}
				</tr>
			</thead>
			<tbody>
				{#each biblio.items as it (it.id)}
					{@const labels = labelStatus(it)}
					<tr class="border-t border-surface-200" data-testid="item-row-{it.barcode}">
						<td class="p-2 font-mono">{it.barcode}</td>
						{#if inventoryOn}
							<td class="p-2" data-testid="item-inventory-{it.barcode}">
								<span class="font-mono">{it.inventoryNumber ?? ""}</span>
								{#if it.origin || it.valueCents !== null}
									<Hint
										>{[it.origin, formatEuro(it.valueCents, fmt.locale)]
											.filter(Boolean)
											.join(" · ")}</Hint
									>
								{/if}
							</td>
						{/if}
						<td class="p-2 font-mono">{it.callNumber ?? ""}</td>
						{#if perItemClass}<td class="p-2">{it.readingLevel ?? ""}</td>{/if}
						<td class="p-2">
							<StatusBadge status={statusOf(it)} />
							{#if it.status === "withdrawn" && it.withdrawnOn}
								<Hint data-testid="item-withdrawn-{it.barcode}"
									>{i18n.t("catalog.item.withdrawnOn", {
										date: fmt.day(it.withdrawnOn, "medium"),
									})}{it.withdrawnReason ? ` · ${it.withdrawnReason}` : ""}</Hint
								>
							{/if}
						</td>
						<td class="p-2">
							{#if it.loan}
								{#if canOpenPatrons}
									<Link href="/patrons/{it.loan.patronId}"
										>{it.loan.patronName}</Link
									>
								{:else if it.loan.patronName}
									{it.loan.patronName}
								{:else}
									{i18n.t("catalog.detail.onLoan")}
								{/if}
								<span class="opacity-70"
									>· {i18n.t("catalog.detail.dueOn", {
										date: fmt.day(it.loan.dueDate, "medium"),
									})}</span
								>
							{/if}
						</td>
						<td class="p-2">
							<PrintedBadge status={labels} data-testid="item-labels-{it.barcode}"
								>{i18n.t(`printing.labels.status.${labels}`)}</PrintedBadge
							>
						</td>
						{#if canEdit}
							<td class="p-2">
								<Row wrap={false} justify="end" gap="1" as="span">
									<IconButton
										icon={PrintIcon}
										label={i18n.t("catalog.item.labelsTitle", {
											barcode: it.barcode,
										})}
										variant="tonal"
										size="sm"
										onclick={() => onlabels([it.id])}
										data-testid="labels-item-{it.barcode}"
									/>
									<IconButton
										icon={EditIcon}
										label={i18n.t("catalog.item.editTitle", {
											barcode: it.barcode,
										})}
										variant="tonal"
										size="sm"
										onclick={() => openEdit(it)}
										data-testid="edit-item-{it.barcode}"
									/>
									<IconButton
										icon={StatusIcon}
										label={i18n.t("catalog.item.statusTitle", {
											barcode: it.barcode,
										})}
										variant="tonal"
										size="sm"
										onclick={() => openStatus(it)}
										data-testid="status-item-{it.barcode}"
									/>
									<IconButton
										icon={DeleteIcon}
										label={i18n.t("catalog.item.deleteTitle", {
											barcode: it.barcode,
										})}
										variant="error"
										size="sm"
										onclick={() =>
											(deleteTarget = { id: it.id, barcode: it.barcode })}
										data-testid="delete-item-{it.barcode}"
									/>
								</Row>
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</Table>
	</div>
{/if}

<ConfirmDialog
	bind:open={addOpen}
	title={i18n.t("catalog.item.addTitle")}
	confirmLabel={i18n.t("catalog.item.add")}
	onconfirm={doAdd}
>
	<div class="space-y-3" data-testid="add-copies-dialog">
		<Field label={i18n.t("catalog.item.copies")} class="max-w-40"
			><Input
				type="number"
				min={1}
				max={100}
				bind:value={copies}
				data-testid="add-copies-count"
			/></Field
		>
		{@render itemFields(draft, "add")}
	</div>
</ConfirmDialog>
<ConfirmDialog
	open={editItem !== null}
	title={i18n.t("catalog.item.editTitle", { barcode: editItem?.barcode ?? "" })}
	confirmLabel={i18n.t("catalog.item.save")}
	onconfirm={doEdit}
	oncancel={() => (editItem = null)}
>
	<div class="space-y-3" data-testid="edit-item-dialog">
		{@render itemFields(editDraft, "edit")}
	</div>
</ConfirmDialog>
<ConfirmDialog
	open={statusItem !== null}
	title={i18n.t("catalog.item.statusTitle", { barcode: statusItem?.barcode ?? "" })}
	confirmLabel={i18n.t("catalog.item.status")}
	onconfirm={doStatus}
	oncancel={() => (statusItem = null)}
>
	<div class="space-y-3" data-testid="status-dialog">
		<Field label={i18n.t("catalog.item.newStatus")}
			><Select bind:value={newStatus} data-testid="status-select">
				{#each ["available", "lost", "damaged", "in_repair", "withdrawn"] as const as s (s)}
					<option value={s}>{i18n.t(`common.statuses.${ITEM_STATUS[s].key}`)}</option>
				{/each}
			</Select></Field
		>
		<Field label={i18n.t("catalog.item.reason")}
			><Input bind:value={reason} maxlength={200} data-testid="status-reason" /></Field
		>
	</div>
</ConfirmDialog>
<ConfirmDialog
	open={deleteTarget !== null}
	title={i18n.t("catalog.item.deleteTitle", { barcode: deleteTarget?.barcode ?? "" })}
	description={i18n.t("catalog.item.deleteDescription")}
	tone="error"
	confirmLabel={i18n.t("catalog.item.delete")}
	onconfirm={doDeleteItem}
	oncancel={() => (deleteTarget = null)}
/>
