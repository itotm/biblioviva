<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Catalogue grid (steps 3.1, 5.1): title, author, year, ISBN, classification with its pictogram,
     copies on the shelf; full-text search (words in any order, prefixes, accents ignored, ranked),
     a scanned or typed copy barcode or ISBN opens the record, filters (classification, material,
     availability, years, withdrawn). `?q=` comes from the search box of the top bar. Ctrl/Shift
     clicks select records: print their labels or add every copy to a print list (step 3.8). -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { resolve } from "$app/paths";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import AvailabilityCell from "#lib/components/catalog/AvailabilityCell.svelte";
	import ClassificationCell from "#lib/components/catalog/ClassificationCell.svelte";
	import ResultCell from "#lib/components/ResultCell.svelte";
	import Alert from "#lib/ui/Alert.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Link from "#lib/ui/Link.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		getClassificationOptions,
		getSeriesNames,
		searchBiblios,
	} from "#lib/remote/catalog.remote.js";
	import { pictogramSrc } from "#lib/shared/classification.js";
	import { formatSeries } from "#lib/shared/series.js";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import AddToPrintList from "#lib/components/AddToPrintList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import ListToolbar from "#lib/ui/ListToolbar.svelte";
	import GridFooter from "#lib/ui/GridFooter.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Page from "#lib/ui/Page.svelte";
	import FilterSelect from "#lib/ui/FilterSelect.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import { DIGITS, hasFilter, ListFilters, searchText } from "#lib/ui/list-filters.svelte.js";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const AddIcon = icons.add;
	const ClearIcon = icons.close;
	const PrintIcon = icons.print;
	const EditIcon = icons.edit;
	const canEdit = $derived(hasPermission(data.user, "catalog"));
	const options = getClassificationOptions();

	interface Filters {
		q: string;
		available: boolean;
		yearFrom: string;
		yearTo: string;
		kind: "" | "fiction" | "nonfiction" | "unclassified";
		genreCode: string;
		classCode: string;
		readingLevel: string;
		itemType: string;
		series: string;
		withdrawn: boolean;
	}
	const filterState = new ListFilters<Filters>(
		{
			q: "",
			available: false,
			yearFrom: "",
			yearTo: "",
			kind: "",
			genreCode: "",
			classCode: "",
			readingLevel: "",
			itemType: "",
			series: "",
			withdrawn: false,
		},
		// the series link of a record page lands here with `?series=` (step 9.14)
		{
			q: page.url.searchParams.get("q") ?? "",
			series: page.url.searchParams.get("series") ?? "",
		},
		// Back finds the filters and the search as they were left
		"catalog-filters",
	);
	const f = filterState.values;
	const seriesNames = getSeriesNames();
	let selectedIds = $state<(string | number)[]>([]);
	let labelDialog = $state(false);
	let batchDialog = $state(false);
	let reclassifyDialog = $state(false);
	// Q83: the grid loads nothing until a filter is set; a code (digits, a barcode or an ISBN)
	// searches at any length
	const activeFilters = $derived({
		q: searchText(f.q, DIGITS),
		kind: f.kind,
		genreCode: f.genreCode,
		classCode: f.classCode,
		readingLevel: f.readingLevel,
		itemType: f.itemType,
		series: f.series,
		withdrawn: f.withdrawn ? ("1" as const) : ("" as const),
		available: f.available ? ("1" as const) : ("" as const),
		yearFrom: /^\d{4}$/.test(f.yearFrom) ? f.yearFrom : "",
		yearTo: /^\d{4}$/.test(f.yearTo) ? f.yearTo : "",
	});
	const filtered = $derived(hasFilter(activeFilters));
	const result = $derived(filtered ? searchBiblios(activeFilters) : null);
	// the top bar's search box lands here with `?q=`
	$effect(() => {
		const fromUrl = page.url.searchParams.get("q");
		if (fromUrl !== null) {
			f.q = fromUrl;
		}
	});
	// a copy's barcode or an ISBN opens the record (the search is cleared so "Back" lands on the grid)
	$effect(() => {
		const hit = result?.current?.hit;
		if (hit?.kind === "open") {
			f.q = "";
			void goto(resolve(`catalog/${hit.biblioId}`));
		}
	});
	const suggestion = $derived(
		result?.current?.hit?.kind === "suggest" ? result.current.hit : null,
	);
	const selectedCopies = $derived(
		(result?.current?.rows ?? [])
			.filter((r) => selectedIds.includes(r.id))
			.reduce((n, r) => n + r.copiesTotal, 0),
	);

	interface OptionNode {
		code: string;
		label: string;
		image: string | null;
		color: string | null;
	}
	const nodeOf = (row: {
		kind: string | null;
		genreCode: string | null;
		classCode: string | null;
	}): OptionNode | null => {
		const o = options.current;
		if (!o || row.kind === null) {
			return null;
		}
		if (row.kind === "fiction") {
			return o.genres.find((x) => x.code === row.genreCode) ?? null;
		}
		for (const n of o.nonfiction) {
			if (n.code === row.classCode) {
				return n;
			}
			const c = n.children.find((x) => x.code === row.classCode);
			if (c) {
				return c;
			}
		}
		return null;
	};
	const labelOf = (row: {
		kind: string | null;
		genreCode: string | null;
		classCode: string | null;
	}): string => {
		if (row.kind === null) {
			return i18n.t("catalog.toClassify.label");
		}
		const node = nodeOf(row);
		return node
			? `${node.code} · ${node.label}`
			: ((row.kind === "fiction" ? row.genreCode : row.classCode) ?? "");
	};
	const pictogramOf = (row: Parameters<typeof nodeOf>[0]): string => {
		const node = nodeOf(row);
		return node ? pictogramSrc(node) : "";
	};

	const columns: GridColumn[] = [
		{
			id: "title",
			header: i18n.t("catalog.list.columns.title"),
			width: 260,
			flexgrow: 2,
			sort: true,
			cell: ResultCell,
		},
		{
			id: "series",
			header: i18n.t("catalog.list.columns.series"),
			width: 160,
			sort: true,
		},
		{
			id: "author",
			header: i18n.t("catalog.list.columns.author"),
			width: 180,
			flexgrow: 1,
			sort: true,
		},
		{ id: "year", header: i18n.t("catalog.list.columns.year"), width: 80, sort: true },
		{
			id: "classification",
			header: i18n.t("catalog.list.columns.classification"),
			width: 220,
			cell: ClassificationCell,
		},
		{
			id: "callNumber",
			header: i18n.t("catalog.list.columns.callNumber"),
			width: 120,
			sort: true,
		},
		{ id: "isbn", header: i18n.t("catalog.list.columns.isbn"), width: 140 },
		{
			id: "acquiredAt",
			header: i18n.t("catalog.list.columns.acquiredAt"),
			width: 110,
			sort: true,
		},
		{
			id: "copies",
			header: i18n.t("catalog.list.columns.copies"),
			width: 170,
			cell: AvailabilityCell,
		},
	];
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("catalog.list.title")} icon="catalog">
		{#snippet actions()}
			{#if canEdit}
				<Button
					variant="primary"
					icon={AddIcon}
					href="/cataloging/new"
					data-testid="new-biblio">{i18n.t("catalog.list.new")}</Button
				>
			{/if}
		{/snippet}
		{#snippet views()}
			<AreaTabs area="catalog" current="catalog" />
		{/snippet}
	</PageHeader>

	<ListToolbar
		bind:search={f.q}
		searchPlaceholder={i18n.t("catalog.list.search")}
		selectedCount={selectedIds.length}
	>
		{#snippet selectionActions()}
			{#if canEdit}
				<Button
					size="sm"
					variant="primary"
					icon={PrintIcon}
					onclick={() => (labelDialog = true)}
					data-testid="print-selected-labels">{i18n.t("printing.labels.selected")}</Button
				>
				<AddToPrintList
					kind="items"
					biblioIds={selectedIds.map(Number)}
					label={i18n.t("printing.addTo.selected")}
					size="sm"
				/>
				<Button
					size="sm"
					icon={EditIcon}
					onclick={() => (batchDialog = true)}
					data-testid="batch-selected">{i18n.t("catalog.batch.selected")}</Button
				>
				<Button
					size="sm"
					onclick={() => (reclassifyDialog = true)}
					data-testid="reclassify-selected"
					>{i18n.t("catalog.batch.reclassify.button")}</Button
				>
			{/if}
		{/snippet}
		{#snippet filters()}
			{@const all = i18n.t("catalog.list.filters.all")}
			{@const allF = i18n.t("catalog.list.filters.allF")}
			<FilterSelect label={i18n.t("catalog.list.filters.kind")} {all} bind:value={f.kind}>
				<option value="fiction">{i18n.t("catalog.kinds.fiction")}</option>
				<option value="nonfiction">{i18n.t("catalog.kinds.nonfiction")}</option>
				<option value="unclassified">{i18n.t("catalog.toClassify.label")}</option>
			</FilterSelect>
			{#if f.kind !== "nonfiction" && f.kind !== "unclassified"}
				<FilterSelect
					label={i18n.t("catalog.list.filters.genre")}
					{all}
					bind:value={f.genreCode}
				>
					{#each options.current?.genres ?? [] as g (g.code)}
						<option value={g.code}>{g.code} · {g.label}</option>
					{/each}
				</FilterSelect>
			{/if}
			{#if f.kind !== "fiction" && f.kind !== "unclassified"}
				<FilterSelect
					label={i18n.t("catalog.list.filters.class")}
					all={allF}
					bind:value={f.classCode}
				>
					{#each options.current?.nonfiction ?? [] as n (n.code)}
						<option value={n.code}>{n.code} · {n.label}</option>
						{#each n.children as c (c.code)}
							<option value={c.code}>{c.code} · {c.label}</option>
						{/each}
					{/each}
				</FilterSelect>
			{/if}
			{#if options.current?.fictionByClass && f.kind !== "nonfiction" && f.kind !== "unclassified"}
				<FilterSelect
					label={i18n.t("catalog.list.filters.readingLevel")}
					all={allF}
					bind:value={f.readingLevel}
				>
					{#each options.current.readingLevels as l (l.code)}
						<option value={l.code}>{l.label}</option>
					{/each}
				</FilterSelect>
			{/if}
			<FilterSelect
				label={i18n.t("catalog.list.filters.itemType")}
				{all}
				bind:value={f.itemType}
			>
				{#each options.current?.itemTypes ?? [] as t (t.code)}
					<option value={t.code}>{t.label}</option>
				{/each}
			</FilterSelect>
			<Checkbox bind:checked={f.available} data-testid="only-available"
				>{i18n.t("catalog.search.available")}</Checkbox
			>
			<label class="inline-block w-28">
				<span class="sr-only">{i18n.t("catalog.search.yearFrom")}</span>
				<Input
					type="number"
					min={1000}
					max={2999}
					bind:value={f.yearFrom}
					placeholder={i18n.t("catalog.search.yearFrom")}
					aria-label={i18n.t("catalog.search.yearFrom")}
					data-testid="year-from"
				/>
			</label>
			<label class="inline-block w-28">
				<span class="sr-only">{i18n.t("catalog.search.yearTo")}</span>
				<Input
					type="number"
					min={1000}
					max={2999}
					bind:value={f.yearTo}
					placeholder={i18n.t("catalog.search.yearTo")}
					aria-label={i18n.t("catalog.search.yearTo")}
					data-testid="year-to"
				/>
			</label>
			{#if (seriesNames.current ?? []).length > 0 || f.series}
				<FilterSelect
					label={i18n.t("catalog.list.filters.series")}
					all={allF}
					bind:value={f.series}
					data-testid="filter-series"
				>
					{#if f.series && !(seriesNames.current ?? []).includes(f.series)}
						<option value={f.series}>{f.series}</option>
					{/if}
					{#each seriesNames.current ?? [] as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</FilterSelect>
			{/if}
			<Checkbox bind:checked={f.withdrawn} data-testid="show-withdrawn"
				>{i18n.t("catalog.list.filters.withdrawn")}</Checkbox
			>
			{#if filtered}
				<Button
					icon={ClearIcon}
					onclick={() => filterState.clear()}
					data-testid="clear-filters">{i18n.t("catalog.list.clearFilters")}</Button
				>
			{/if}
		{/snippet}
	</ListToolbar>

	{#if suggestion}
		<Alert tone="info" padded data-testid="barcode-suggestion">
			{i18n.t("catalog.search.suggest", {
				barcode: suggestion.barcode,
				title: suggestion.title,
			})}
			<Link class="ml-2 font-semibold" href="/catalog/{suggestion.biblioId}"
				>{i18n.t("catalog.search.openSuggest")}</Link
			>
		</Alert>
	{/if}

	<div class="space-y-2">
		{#if !result}
			<div data-testid="catalog-start">
				<EmptyState
					title={i18n.t("catalog.list.startTitle")}
					description={i18n.t("catalog.list.startHint")}
					icon="search"
				/>
			</div>
		{:else}
			<QueryState query={result}>
				{#snippet children(found)}
					<Hint tone="primary" data-testid="biblio-count" aria-live="polite">
						{i18n.t("catalog.list.countFiltered", { shown: found.total })}
						{#if found.similar > 0}
							· {i18n.t("common.similar.count", { count: found.similar })}
						{/if}
					</Hint>
					{#if found.rows.length === 0}
						<EmptyState title={i18n.t("catalog.list.empty")} icon="catalog" />
					{:else}
						<GridFrame>
							<DataGrid
								data={found.rows.map((r) => ({
									id: r.id,
									title: r.title,
									label: r.title,
									secondary: r.originalTitle ?? "",
									similar: r.similar,
									series: formatSeries(r.series, r.seriesNumber),
									author: r.author,
									year: r.publicationYear ?? "",
									classification:
										labelOf(r) + (r.readingLevel ? ` (${r.readingLevel})` : ""),
									pictogram: pictogramOf(r),
									isbn: r.isbn ?? "",
									callNumber: r.callNumbers,
									acquiredAt: fmt.day(r.acquiredAt),
									available: r.copiesAvailable,
									total: r.copiesTotal,
									copies:
										r.copiesTotal === 0
											? i18n.t("catalog.search.noCopies")
											: i18n.t("catalog.search.copiesAvailable", {
													available: r.copiesAvailable,
													total: r.copiesTotal,
												}),
								}))}
								{columns}
								height="62vh"
								multiselect
								onselectionchange={(ids) => (selectedIds = ids)}
								onrowclick={(row, modifier) => {
									// a plain click opens the record; Ctrl/Shift clicks build a selection
									if (!modifier && selectedIds.length <= 1) {
										void goto(resolve(`catalog/${row.id}`));
									}
								}}
							/>
						</GridFrame>
						<GridFooter exportTable="catalog" exportParams={activeFilters} />
					{/if}
				{/snippet}
			</QueryState>
		{/if}
	</div>
	<!-- the dialogs of the selection are loaded when opened: the page stays within its budget (§3.14) -->
	{#if labelDialog}
		{#await import("#lib/components/catalog/LabelPrintDialog.svelte") then { default: LabelPrintDialog }}
			<LabelPrintDialog
				bind:open={labelDialog}
				biblioIds={selectedIds.map(Number)}
				count={selectedCopies}
			/>
		{/await}
	{/if}
	{#if batchDialog}
		{#await import("#lib/components/catalog/BatchItemsDialog.svelte") then { default: BatchItemsDialog }}
			<BatchItemsDialog
				bind:open={batchDialog}
				source={{ biblioIds: selectedIds.map(Number) }}
				count={selectedCopies}
				onapplied={() => void result?.refresh()}
			/>
		{/await}
	{/if}
	{#if reclassifyDialog}
		{#await import("#lib/components/catalog/ReclassifyDialog.svelte") then { default: ReclassifyDialog }}
			<ReclassifyDialog
				bind:open={reclassifyDialog}
				biblioIds={selectedIds.map(Number)}
				onapplied={() => void result?.refresh()}
			/>
		{/await}
	{/if}
</Page>
