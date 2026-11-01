<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Patron list (step 2.1): grid with type/level/class/status filters, prefix search, export.
     As the catalogue (Q83), it loads nothing until a filter is set or the search has 3 letters (a
     card number at any length); a status column shows loans, overdue loans and a missing photo
     when photos are required (9.13, round 3). -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { resolve } from "$app/paths";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import CardPrintDialog from "#lib/components/patrons/CardPrintDialog.svelte";
	import ResultCell from "#lib/components/ResultCell.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { getPatronFilterOptions, searchPatrons } from "#lib/remote/patrons.remote.js";
	import PatronStatusCell from "#lib/components/patrons/PatronStatusCell.svelte";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import ListToolbar from "#lib/ui/ListToolbar.svelte";
	import GridFooter from "#lib/ui/GridFooter.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import { icons } from "#lib/ui/icons.js";
	import AddToPrintList from "#lib/components/AddToPrintList.svelte";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { removePatrons } from "#lib/remote/patrons.remote.js";
	import { toaster } from "#lib/ui/toaster.js";
	import Button from "#lib/ui/Button.svelte";
	import Page from "#lib/ui/Page.svelte";
	import FilterSelect from "#lib/ui/FilterSelect.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import { DIGITS, hasFilter, ListFilters, searchText } from "#lib/ui/list-filters.svelte.js";

	const { data } = $props();
	const i18n = useI18n();
	const AddIcon = icons.add;
	const canRemove = $derived(hasPermission(data.user, "anonymize"));
	const RemoveIcon = icons.delete;
	let confirmRemove = $state(false);

	async function removeSelected(): Promise<void> {
		const r = await removePatrons({ ids: selectedIds.map(Number) });
		toaster.success({
			title: i18n.t("patrons.list.removed", {
				removed: r.removed.length,
				kept: r.keptOpenLoans.length,
			}),
		});
		selectedIds = [];
		await result?.refresh();
	}

	interface Filters {
		q: string;
		patronType: "" | "student" | "teacher";
		stage: string;
		levelCode: string;
		groupId: string;
		status: "" | "active" | "anonymized";
	}
	const filterState = new ListFilters<Filters>(
		{
			q: "",
			patronType: "",
			stage: "",
			levelCode: "",
			groupId: "",
			status: "",
		},
		{},
		// Back finds the filters and the search as they were left
		"patron-filters",
	);
	const f = filterState.values;
	let selectedIds = $state<(string | number)[]>([]);
	const PrintIcon = icons.print;
	// the cards of the class chosen, or of the rows selected (the print dialog adds the layout)
	const printQuery = $derived(
		f.groupId && selectedIds.length === 0
			? `group=${f.groupId}`
			: `ids=${selectedIds.join(",")}`,
	);
	let cardDialog = $state(false);
	const activeFilters = $derived({ ...f, q: searchText(f.q, DIGITS) });
	const filtered = $derived(hasFilter(activeFilters));
	const options = getPatronFilterOptions();
	// a school of several stages (a comprensivo) filters by stage first (12.9)
	const stageOf = (code: string): string | undefined =>
		options.current?.levels.find((l) => l.code === code)?.stage;
	const levelChoices = $derived(
		(options.current?.levels ?? []).filter((l) => f.stage === "" || l.stage === f.stage),
	);
	// the classes offered: those hosting the chosen level, or a level of the chosen stage (Phase 12)
	const groupChoices = $derived(
		(options.current?.groups ?? []).filter(
			(g) =>
				(f.levelCode === "" || g.levels.includes(f.levelCode)) &&
				(f.stage === "" ||
					g.levels.some((l) => stageOf(l) === f.stage) ||
					g.stage === f.stage),
		),
	);
	const chosenGroup = $derived(
		(options.current?.groups ?? []).find((g) => String(g.id) === f.groupId),
	);
	const ClearIcon = icons.close;
	const result = $derived(filtered ? searchPatrons(activeFilters) : null);

	const columns: GridColumn[] = [
		{
			id: "name",
			header: i18n.t("patrons.list.columns.name"),
			width: 220,
			flexgrow: 2,
			sort: true,
			cell: ResultCell,
		},
		{ id: "typeLabel", header: i18n.t("patrons.list.columns.type"), width: 110, sort: true },
		{ id: "classLabel", header: i18n.t("patrons.list.columns.class"), width: 90, sort: true },
		{ id: "card", header: i18n.t("patrons.list.columns.card"), width: 130 },
		{
			id: "status",
			header: i18n.t("patrons.list.status.title"),
			width: 260,
			cell: PatronStatusCell,
		},
	];
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("patrons.list.title")} icon="patrons">
		{#snippet actions()}
			<Button variant="primary" icon={AddIcon} href="/patrons/new" data-testid="new-patron"
				>{i18n.t("patrons.list.new")}</Button
			>
		{/snippet}
		{#snippet views()}
			<AreaTabs area="patrons" current="patrons" />
		{/snippet}
	</PageHeader>

	<ListToolbar
		bind:search={f.q}
		searchPlaceholder={i18n.t("patrons.list.search")}
		selectedCount={selectedIds.length}
	>
		{#snippet selectionActions()}
			<Button
				size="sm"
				variant="primary"
				icon={PrintIcon}
				onclick={() => (cardDialog = true)}
				data-testid="print-selected-cards">{i18n.t("patrons.list.printCards")}</Button
			>
			<AddToPrintList
				entityIds={selectedIds.map(Number)}
				label={i18n.t("printing.addTo.selected")}
				size="sm"
			/>
			{#if canRemove}
				<Button
					size="sm"
					variant="error-tonal"
					icon={RemoveIcon}
					onclick={() => (confirmRemove = true)}
					data-testid="remove-selected">{i18n.t("patrons.list.removeSelected")}</Button
				>
			{/if}
		{/snippet}
		{#snippet actions()}
			{#if chosenGroup}
				<Button
					icon={PrintIcon}
					onclick={() => (cardDialog = true)}
					data-testid="print-class-cards"
					>{i18n.t("patrons.list.printClassCards", {
						classLabel: chosenGroup.label,
					})}</Button
				>
			{/if}
		{/snippet}
		{#snippet filters()}
			{@const all = i18n.t("patrons.list.filters.all")}
			{@const stageLabel = i18n.t("patrons.list.filters.stage")}
			{@const levelLabel = i18n.t("patrons.list.filters.level")}
			{@const groupWord = options.current?.groupWord ?? ""}
			<FilterSelect
				label={i18n.t("patrons.list.filters.type")}
				{all}
				bind:value={f.patronType}
			>
				<option value="student">{i18n.t("patrons.types.student")}</option>
				<option value="teacher">{i18n.t("patrons.types.teacher")}</option>
			</FilterSelect>
			{#if (options.current?.stages.length ?? 0) > 1}
				<FilterSelect
					label={stageLabel}
					{all}
					bind:value={f.stage}
					onchange={() => {
						f.levelCode = "";
						f.groupId = "";
					}}
					data-testid="filter-stage"
				>
					{#each options.current?.stages ?? [] as st (st.code)}<option value={st.code}
							>{stageLabel}: {st.name}</option
						>{/each}
				</FilterSelect>
			{/if}
			<FilterSelect
				label={levelLabel}
				{all}
				bind:value={f.levelCode}
				onchange={() => (f.groupId = "")}
			>
				{#each levelChoices as l (l.code)}<option value={l.code}
						>{levelLabel}: {l.label}</option
					>{/each}
			</FilterSelect>
			<FilterSelect
				label={groupWord}
				all={i18n.t("patrons.list.filters.allF")}
				bind:value={f.groupId}
			>
				{#each groupChoices as g (g.id)}<option value={String(g.id)}
						>{groupWord}: {f.levelCode !== "" && g.levels.length === 1
							? g.name
							: g.label}</option
					>{/each}
			</FilterSelect>
			<FilterSelect label={i18n.t("patrons.list.filters.status")} {all} bind:value={f.status}>
				<option value="active">{i18n.t("common.statuses.patron.active")}</option>
				<option value="anonymized">{i18n.t("common.statuses.patron.anonymized")}</option>
			</FilterSelect>
			{#if filtered}
				<Button
					icon={ClearIcon}
					onclick={() => filterState.clear()}
					data-testid="clear-filters">{i18n.t("patrons.list.clearFilters")}</Button
				>
			{/if}
		{/snippet}
	</ListToolbar>

	<div class="space-y-2">
		{#if !result}
			<div data-testid="patrons-start">
				<EmptyState
					title={i18n.t("patrons.list.startTitle")}
					description={i18n.t("patrons.list.startHint")}
					icon="search"
				/>
			</div>
		{:else}
			<QueryState query={result}>
				{#snippet children(found)}
					<Hint tone="primary" data-testid="patron-count" aria-live="polite">
						{i18n.t("patrons.list.countFiltered", { shown: found.total })}
						{#if found.similar > 0}
							· {i18n.t("common.similar.count", { count: found.similar })}
						{/if}
					</Hint>
					{#if found.rows.length === 0}
						<EmptyState title={i18n.t("patrons.list.empty")} icon="patrons" />
					{:else}
						<GridFrame>
							<DataGrid
								data={found.rows.map((r) => ({
									id: r.id,
									name: patronSortName(r),
									label: patronSortName(r),
									similar: r.similar,
									typeLabel: i18n.t(`patrons.types.${r.patronType}`),
									classLabel: r.classLabel,
									card: r.cardNumber ?? "",
									openLoans: r.openLoans,
									overdueLoans: r.overdueLoans,
									noPhoto: data.photosRequired && !r.hasPhoto,
								}))}
								{columns}
								height="62vh"
								multiselect
								onselectionchange={(ids) => (selectedIds = ids)}
								onrowclick={(row, modifier) => {
									// a plain click opens the patron; Ctrl/Shift clicks build a selection
									if (!modifier && selectedIds.length <= 1) {
										void goto(resolve(`patrons/${row.id}`));
									}
								}}
							/>
						</GridFrame>
						<GridFooter exportTable="patrons" exportParams={activeFilters} />
					{/if}
				{/snippet}
			</QueryState>
		{/if}
	</div>
	<ConfirmDialog
		bind:open={confirmRemove}
		title={i18n.t("patrons.list.removeTitle", { count: selectedIds.length })}
		description={i18n.t("patrons.list.removeDescription")}
		tone="error"
		confirmLabel={i18n.t("patrons.list.removeSelected")}
		onconfirm={removeSelected}
	/>
</Page>

<CardPrintDialog bind:open={cardDialog} query={printQuery} />
