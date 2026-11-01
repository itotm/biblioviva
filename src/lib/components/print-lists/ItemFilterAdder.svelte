<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Adding copies to a print list by a quick filter (step 3.8): labels still to print, acquisition
     dates, genre, non-fiction class, item type, import batch. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import { addItemsByFilter, type getPrintListDetail } from "#lib/remote/print-lists.remote.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Select from "#lib/ui/Select.svelte";

	type Detail = Awaited<ReturnType<typeof getPrintListDetail>>;

	interface Props {
		listId: number;
		classification: NonNullable<Detail["classification"]>;
		batches: Detail["batches"];
		busy: boolean;
		/** Runs a change of the list, marking the page busy meanwhile. */
		run: <R>(fn: () => Promise<R>) => Promise<R | undefined>;
	}

	const { listId, classification: c, batches, busy, run }: Props = $props();
	const i18n = useI18n();
	let pending = $state<"" | "pair" | "barcode" | "spine">("");
	let from = $state("");
	let to = $state("");
	let genre = $state("");
	let classCode = $state("");
	let itemType = $state("");
	let batch = $state("");
	const active = $derived(
		pending !== "" ||
			from !== "" ||
			to !== "" ||
			genre !== "" ||
			classCode !== "" ||
			itemType !== "" ||
			batch !== "",
	);

	async function add(): Promise<void> {
		const r = await run(() =>
			addItemsByFilter({
				listId,
				filter: {
					pendingLabels: pending || undefined,
					acquiredFrom: from || undefined,
					acquiredTo: to || undefined,
					genreCode: genre || undefined,
					classCode: classCode || undefined,
					itemType: itemType || undefined,
					importBatchId: batch === "" ? undefined : Number(batch),
				},
			}),
		);
		if (!r) {
			return;
		}
		if (r.found === 0) {
			toaster.warning({ title: i18n.t("printing.list.quick.noneItems") });
		} else {
			toaster.success({
				title: i18n.t("printing.list.quick.addedItems", {
					added: r.added,
					skipped: r.skipped.length,
				}),
			});
		}
	}
</script>

<Field label={i18n.t("printing.list.quick.pendingLabels")}
	><Select bind:value={pending} data-testid="quick-pending">
		<option value="">{i18n.t("printing.list.quick.pendingAny")}</option>
		<option value="pair">{i18n.t("printing.labels.kinds.pair")}</option>
		<option value="barcode">{i18n.t("printing.labels.kinds.barcode")}</option>
		<option value="spine">{i18n.t("printing.labels.kinds.spine")}</option>
	</Select></Field
>
<Grid cols="2" from="sm" gap="2">
	<Field label={i18n.t("printing.list.quick.acquiredFrom")}
		><Input type="date" bind:value={from} data-testid="quick-from" /></Field
	>
	<Field label={i18n.t("printing.list.quick.acquiredTo")}
		><Input type="date" bind:value={to} /></Field
	>
</Grid>
<Field label={i18n.t("printing.list.quick.genre")}
	><Select bind:value={genre} data-testid="quick-genre">
		<option value="">{i18n.t("printing.list.quick.any")}</option>
		{#each c.genres as g (g.code)}
			<option value={g.code}>{g.code} · {g.label}</option>
		{/each}
	</Select></Field
>
<Field label={i18n.t("printing.list.quick.nonfictionClass")}
	><Select bind:value={classCode} data-testid="quick-nonfiction">
		<option value="">{i18n.t("printing.list.quick.any")}</option>
		{#each c.nonfiction as n (n.code)}
			<option value={n.code}>{n.code} · {n.label}</option>
			{#each n.children as ch (ch.code)}
				<option value={ch.code}>{ch.code} · {ch.label}</option>
			{/each}
		{/each}
	</Select></Field
>
<Field label={i18n.t("printing.list.quick.itemType")}
	><Select bind:value={itemType}>
		<option value="">{i18n.t("printing.list.quick.any")}</option>
		{#each c.itemTypes as t (t.code)}
			<option value={t.code}>{t.label}</option>
		{/each}
	</Select></Field
>
<Field label={i18n.t("printing.list.quick.importBatch")}
	><Select bind:value={batch}>
		<option value="">{i18n.t("printing.list.quick.anyBatch")}</option>
		{#each batches as b (b.id)}
			<option value={String(b.id)}>
				{i18n.t("printing.list.quick.batchLabelItems", {
					id: b.id,
					file: b.filename,
					created: b.created,
				})}
			</option>
		{/each}
	</Select></Field
>
<Button variant="primary" onclick={add} disabled={busy || !active} data-testid="quick-add"
	>{i18n.t("printing.list.quick.add")}</Button
>
