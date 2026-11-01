<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Stampa etichette" (step 3.8): choose the label kind (pair by default), the adhesive stock and
     the start position on a partially used sheet, open the print page in a new tab, then confirm
     "Segna come stampate" for the copies that were printed. The source is a set of copies (`ids`),
     of records (`biblioIds`, every copy), a print list (`listId`) or the pending labels. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getItemIdsOfBiblio,
		getLabelOptions,
		getPendingLabelItemIds,
		markItemLabelsPrinted,
	} from "#lib/remote/labels.remote.js";
	import { canMarkPrinted } from "#lib/shared/label-mark.js";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Legend from "#lib/ui/Legend.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Modal from "#lib/ui/Modal.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import SegmentedGroup from "#lib/ui/SegmentedGroup.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Loading from "#lib/ui/Loading.svelte";

	type Kind = "pair" | "barcode" | "spine";

	interface Props {
		open?: boolean;
		ids?: number[];
		biblioIds?: number[];
		listId?: number;
		pending?: boolean;
		/** How many copies the source holds (for the sheet estimate); unknown when omitted. */
		count?: number;
		/** Called after "Segna come stampate" (lists mark through their own action instead). */
		onmarked?: (kind: Kind, marked: number) => void;
	}

	let {
		open = $bindable(false),
		ids = [],
		biblioIds = [],
		listId,
		pending = false,
		count,
		onmarked,
	}: Props = $props();

	const i18n = useI18n();
	const PrintIcon = icons.print;
	const CheckIcon = icons.confirm;
	const options = $derived(open ? getLabelOptions() : null);
	let kind = $state<Kind>("pair");
	let stock = $state("");
	let start = $state(1);
	let opened = $state(false);
	let busy = $state(false);
	let initialised = $state(false);
	/** The copies of the pending sheet, read when it is opened: exactly these are marked. */
	let pendingIds = $state<number[]>([]);

	const current = $derived(options?.current?.kinds.find((k) => k.kind === kind) ?? null);
	const stocks = $derived(
		(options?.current?.stocks ?? []).filter((s) => current?.unitsPerPage[s.id] !== undefined),
	);
	const unitsPerPage = $derived(current?.unitsPerPage[stock] ?? 0);
	const total = $derived(pending ? (options?.current?.pending[kind] ?? 0) : count);
	const pages = $derived(
		total !== undefined && unitsPerPage > 0
			? Math.ceil((total + start - 1) / unitsPerPage)
			: null,
	);
	const canMark = $derived(canMarkPrinted({ pending, listId, ids, biblioIds, pendingIds }));

	$effect(() => {
		const o = options?.current;
		if (!o || initialised) {
			return;
		}
		kind = o.defaultKind;
		initialised = true;
	});
	$effect(() => {
		// the configured stock of the kind, unless the operator already picked one that fits
		if (current && current.unitsPerPage[stock] === undefined) {
			stock = current.stock;
			start = 1;
		}
	});

	const href = $derived.by(() => {
		const q: string[] = [];
		if (listId !== undefined) {
			q.push(`list=${listId}`);
		} else if (pending) {
			q.push("pending=1");
		} else {
			if (ids.length > 0) {
				q.push(`ids=${ids.join(",")}`);
			}
			if (biblioIds.length > 0) {
				q.push(`biblios=${biblioIds.join(",")}`);
			}
		}
		if (stock) {
			q.push(`stock=${encodeURIComponent(stock)}`);
		}
		if (start > 1) {
			q.push(`start=${start}`);
		}
		return resolve(`print/labels/${kind}?${q.join("&")}`);
	});

	function close(): void {
		open = false;
		opened = false;
		initialised = false;
		pendingIds = [];
	}

	/** The print page lists what is pending at its own time: the copies are read first. */
	async function onPrint(): Promise<void> {
		opened = true;
		if (pending) {
			pendingIds = await getPendingLabelItemIds(kind);
		}
	}

	async function mark(): Promise<void> {
		busy = true;
		try {
			const r = await markItemLabelsPrinted({
				kind,
				ids: pending ? pendingIds : ids.length > 0 ? ids : await copiesOf(),
			});
			toaster.success({ title: i18n.t("printing.labels.marked", { count: r.marked }) });
			onmarked?.(kind, r.marked);
			close();
		} finally {
			busy = false;
		}
	}

	async function copiesOf(): Promise<number[]> {
		const all: number[] = [];
		for (const b of biblioIds) {
			all.push(...(await getItemIdsOfBiblio(b)).map((i) => i.id));
		}
		return all;
	}
</script>

<Modal
	bind:open
	title={i18n.t("printing.labels.title")}
	onclose={close}
	width="lg"
	data-testid="label-print-dialog"
>
	{#if !options?.current}
		<Loading size="md" />
	{:else}
		<fieldset>
			<Legend>{i18n.t("printing.labels.kind")}</Legend>
			<SegmentedGroup
				radio
				size="md"
				toggleClass="grow"
				data-testid="label-kind"
				options={options.current.kinds.map((k) => ({
					value: k.kind,
					label: i18n.t(`printing.labels.kinds.${k.kind}`),
					testid: `label-kind-${k.kind}`,
				}))}
				value={kind}
				onselect={(k) => {
					kind = k;
					if (pending) {
						// the sheet read for the other kind is not this one
						pendingIds = [];
						opened = false;
					}
				}}
			/>
			<Hint class="mt-1">{i18n.t(`printing.labels.kindHints.${kind}`)}</Hint>
		</fieldset>
		<Grid cols="2" from="sm" gap="3">
			<Field label={i18n.t("printing.labels.stock")}>
				<Select bind:value={stock} data-testid="label-stock">
					{#each stocks as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</Select>
			</Field>
			<Field
				label={i18n.t("printing.labels.start")}
				hint={i18n.t("printing.labels.startHint", { max: unitsPerPage })}
			>
				<Input
					type="number"
					min="1"
					max={unitsPerPage || 1}
					bind:value={start}
					data-testid="label-start"
				/>
			</Field>
		</Grid>
		<Hint tone="primary" data-testid="label-estimate">
			{#if pending}
				{i18n.t("printing.labels.pendingCount", { count: total ?? 0 })}
			{:else if total !== undefined}
				{i18n.t("printing.labels.count", { count: total })}
			{/if}
			{#if pages !== null}
				· {i18n.t("printing.labels.pages", {
					pages,
					perPage: unitsPerPage,
				})}
			{/if}
		</Hint>
		{#if kind !== "barcode" && (options.current.unclassified ?? 0) > 0}
			<!-- the spine band waits for the classification (step 9.21) -->
			<Hint tone="soft" data-testid="label-unclassified">
				{i18n.t("printing.labels.unclassified", {
					count: options.current.unclassified,
				})}
			</Hint>
		{/if}
		{#if opened}
			<Hint tone="soft" data-testid="label-after-print">
				{i18n.t("printing.labels.afterPrint")}
			</Hint>
		{/if}
		<Row justify="end" as="footer">
			<Button onclick={close} disabled={busy} data-testid="label-close"
				>{i18n.t("common.actions.close")}</Button
			>
			{#if opened && canMark}
				<Button
					variant="success-tonal"
					icon={CheckIcon}
					onclick={mark}
					disabled={busy}
					data-testid="label-mark-printed">{i18n.t("printing.labels.markPrinted")}</Button
				>
			{/if}
			<Button
				variant="primary"
				icon={PrintIcon}
				{href}
				target="_blank"
				rel="noopener"
				onclick={onPrint}
				class={(total ?? 1) === 0 || !stock ? "pointer-events-none opacity-50" : ""}
				aria-disabled={(total ?? 1) === 0 || !stock}
				data-testid="label-print">{i18n.t("printing.labels.print")}</Button
			>
		</Row>
	{/if}
</Modal>
