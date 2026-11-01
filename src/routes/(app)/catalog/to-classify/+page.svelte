<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Books to classify (step 9.21, Q117): the records saved without classification, the oldest
     first; "Inizia a classificare" opens the flow on the first one, a row opens it on that book. -->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getUnclassified } from "#lib/remote/classify.remote.js";
	import Button from "#lib/ui/Button.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import { icons } from "#lib/ui/icons.js";

	const i18n = useI18n();
	const fmt = useFormat();
	const list = getUnclassified();
	const StartIcon = icons.classification;

	const columns: GridColumn[] = [
		{ id: "title", header: i18n.t("catalog.toClassify.columns.title"), flexgrow: 2 },
		{ id: "author", header: i18n.t("catalog.toClassify.columns.author"), flexgrow: 1 },
		{ id: "publisher", header: i18n.t("catalog.toClassify.columns.publisher"), width: 160 },
		{ id: "year", header: i18n.t("catalog.toClassify.columns.year"), width: 70 },
		{ id: "isbn", header: i18n.t("catalog.toClassify.columns.isbn"), width: 140 },
		{ id: "copies", header: i18n.t("catalog.toClassify.columns.copies"), width: 70 },
		{ id: "enteredOn", header: i18n.t("catalog.toClassify.columns.enteredOn"), width: 110 },
	];
	const rows = $derived(list.current ?? []);
	const first = $derived(rows[0]?.id ?? null);
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("catalog.toClassify.title")} icon="toClassify">
		{#snippet actions()}
			{#if first !== null}
				<Button
					variant="primary"
					icon={StartIcon}
					href={resolve(`catalog/to-classify/${first}`)}
					data-testid="classify-start">{i18n.t("catalog.toClassify.start")}</Button
				>
			{/if}
		{/snippet}
		{#snippet views()}
			<AreaTabs area="catalog" current="toClassify" />
		{/snippet}
	</PageHeader>

	{#if list.current}
		{#if rows.length === 0}
			<EmptyState
				title={i18n.t("catalog.toClassify.empty")}
				description={i18n.t("catalog.toClassify.emptyHint")}
				icon="toClassify"
			/>
		{:else}
			<Hint tone="primary" data-testid="to-classify-count">
				{i18n.t("catalog.toClassify.count", { count: rows.length })} —
				{i18n.t("catalog.toClassify.intro")}
			</Hint>
			<GridFrame>
				<DataGrid
					data={rows.map((r) => ({
						id: r.id,
						title: r.title,
						author: r.author,
						publisher: r.publisher,
						year: r.publicationYear ?? "",
						isbn: r.isbn ?? "",
						copies: r.copies,
						enteredOn: fmt.date(r.createdAt),
					}))}
					{columns}
					height="62vh"
					onrowclick={(row) => void goto(resolve(`catalog/to-classify/${row.id}`))}
				/>
			</GridFrame>
		{/if}
	{/if}
</Page>
