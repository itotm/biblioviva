<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Open loans (step 4.6): every book on loan with the patron, class, due date, days late and the
     date of the last notice; filters by class, type and "overdue only", search by surname
     or barcode, renewal of the selected loans, export under the grid. A plain click opens the patron.
     As the catalogue (Q83), the grid loads only with a filter or 3 characters of search (9.13, round 15). -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import DeskMessages from "#lib/components/circulation/DeskMessages.svelte";
	import { resolve } from "$app/paths";
	import Hint from "#lib/ui/Hint.svelte";
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getOpenLoanOptions, getOpenLoans } from "#lib/remote/loans.remote.js";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import AreaTabs from "#lib/components/AreaTabs.svelte";
	import OverrideDialog from "#lib/components/circulation/OverrideDialog.svelte";
	import type { DeskMessageData } from "#lib/components/circulation/desk-message.js";
	import { Renewals } from "#lib/components/circulation/renewals.svelte.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import GridFooter from "#lib/ui/GridFooter.svelte";
	import ListToolbar from "#lib/ui/ListToolbar.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import FilterSelect from "#lib/ui/FilterSelect.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";
	import {
		DIGITS_AND_HYPHENS,
		hasFilter,
		ListFilters,
		searchText,
	} from "#lib/ui/list-filters.svelte.js";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const RenewIcon = icons.renew;
	const canOpenPatrons = $derived(hasPermission(data.user, "patrons"));
	const ClearIcon = icons.close;

	interface Filters {
		q: string;
		group: string;
		patronType: "" | "student" | "teacher";
		overdueOnly: boolean;
	}
	const filterState = new ListFilters<Filters>(
		{
			q: "",
			group: "",
			patronType: "",
			overdueOnly: false,
		},
		{},
		// Back finds the filters and the search as they were left
		"loan-filters",
	);
	const f = filterState.values;
	let selectedIds = $state<(string | number)[]>([]);
	let messages = $state<DeskMessageData[]>([]);

	// a code (digits, a copy barcode) searches at any length
	const query = $derived({
		q: searchText(f.q, DIGITS_AND_HYPHENS),
		group: f.group,
		patronType: f.patronType,
		overdue: f.overdueOnly ? ("1" as const) : ("" as const),
	});
	const filtered = $derived(hasFilter(query));
	const options = getOpenLoanOptions();
	const result = $derived(filtered ? getOpenLoans(query) : null);

	const renewals = new Renewals({
		t: (key, params) => i18n.t(key, params),
		formatDate: (iso) => fmt.day(iso, "medium"),
		canOverride: () => hasPermission(data.user, "admin"),
		show: (...list) => {
			messages = list;
		},
		patronId: () => null,
		after: () => {
			void result?.refresh();
			void options.refresh();
		},
	});

	const columns: GridColumn[] = [
		{
			id: "patron",
			header: i18n.t("circulation.loans.columns.patron"),
			width: 200,
			flexgrow: 1,
			sort: true,
		},
		{
			id: "classLabel",
			header: i18n.t("circulation.loans.columns.classLabel"),
			width: 90,
			sort: true,
		},
		{
			id: "title",
			header: i18n.t("circulation.loans.columns.title"),
			width: 240,
			flexgrow: 2,
			sort: true,
		},
		{ id: "barcode", header: i18n.t("circulation.loans.columns.barcode"), width: 120 },
		{ id: "due", header: i18n.t("circulation.loans.columns.dueDate"), width: 120 },
		{
			id: "late",
			header: i18n.t("circulation.loans.columns.daysOverdue"),
			width: 110,
			sort: true,
		},
		{ id: "renewals", header: i18n.t("circulation.loans.columns.renewals"), width: 90 },
		{ id: "notice", header: i18n.t("circulation.loans.columns.lastNoticeAt"), width: 150 },
	];

	const rows = $derived(
		(result?.current?.rows ?? []).map((r) => ({
			id: r.loanId,
			patronId: r.patronId,
			patron: patronSortName(r),
			classLabel:
				r.patronType === "teacher" && r.classLabel === ""
					? i18n.t("circulation.checkout.teacher")
					: r.classLabel,
			title: r.title,
			barcode: r.barcode,
			due: fmt.day(r.dueDate, "medium"),
			late:
				r.daysOverdue > 0 ? i18n.t("circulation.loans.days", { days: r.daysOverdue }) : "",
			renewals: r.renewals,
			notice: r.lastNoticeAt ? fmt.dateTime(r.lastNoticeAt) : "",
		})),
	);
</script>

<Page width="2xl">
	<PageHeader title={i18n.t("circulation.loans.title")} icon="lists">
		{#snippet views()}
			<AreaTabs area="circulation" current="loans" />
		{/snippet}
	</PageHeader>

	<ListToolbar
		bind:search={f.q}
		searchPlaceholder={i18n.t("circulation.loans.search")}
		selectedCount={selectedIds.length}
	>
		{#snippet selectionActions()}
			<Button
				size="sm"
				variant="primary"
				icon={RenewIcon}
				onclick={() => renewals.many(selectedIds.map(Number))}
				data-testid="renew-selected">{i18n.t("circulation.loans.renewSelected")}</Button
			>
		{/snippet}
		{#snippet filters()}
			<FilterSelect
				label={i18n.t("circulation.loans.type")}
				all={i18n.t("circulation.loans.all")}
				bind:value={f.patronType}
			>
				<option value="student">{i18n.t("circulation.loans.student")}</option>
				<option value="teacher">{i18n.t("circulation.loans.teacher")}</option>
			</FilterSelect>
			<FilterSelect
				label={i18n.t("circulation.loans.class")}
				all={i18n.t("circulation.loans.allF")}
				bind:value={f.group}
			>
				{#each options.current?.options.groups ?? [] as g (g.id)}<option
						value={String(g.id)}>{g.label}</option
					>{/each}
			</FilterSelect>
			<Checkbox bind:checked={f.overdueOnly} data-testid="overdue-only"
				>{i18n.t("circulation.loans.overdueOnly")}</Checkbox
			>
			{#if filtered}
				<Button
					icon={ClearIcon}
					onclick={() => filterState.clear()}
					data-testid="clear-filters">{i18n.t("circulation.loans.clearFilters")}</Button
				>
			{/if}
		{/snippet}
	</ListToolbar>

	{#if messages.length > 0}
		<DeskMessages {messages} />
	{/if}

	<div class="space-y-2">
		{#if !result}
			<div data-testid="loans-start">
				<EmptyState
					title={i18n.t("circulation.loans.startTitle")}
					description={i18n.t("circulation.loans.startHint", {
						count: options.current?.open ?? 0,
					})}
					icon="search"
				/>
			</div>
		{:else}
			<QueryState query={result}>
				{#snippet children(found)}
					<Hint tone="primary" data-testid="loans-count" aria-live="polite">
						{i18n.t("circulation.loans.countFiltered", { count: found.rows.length })}
					</Hint>
					{#if rows.length === 0}
						<EmptyState title={i18n.t("circulation.loans.empty")} icon="loan" />
					{:else}
						<GridFrame data-testid="loans-grid">
							<DataGrid
								data={rows}
								{columns}
								height="62vh"
								multiselect
								onselectionchange={(ids) => (selectedIds = ids)}
								onrowclick={(row, modifier) => {
									// the patron page needs `patrons` (9.13, round 16)
									if (!modifier && selectedIds.length <= 1 && canOpenPatrons) {
										void goto(resolve(`patrons/${String(row.patronId)}`));
									}
								}}
							/>
						</GridFrame>
						<GridFooter exportTable="open-loans" exportParams={query} />
					{/if}
				{/snippet}
			</QueryState>
		{/if}
	</div>

	<OverrideDialog
		open={renewals.pending !== null}
		title={i18n.t("circulation.renewals.overrideTitle")}
		confirmLabel={i18n.t("circulation.renewals.overrideConfirm")}
		onconfirm={(reason) => renewals.force(reason)}
		oncancel={() => (renewals.pending = null)}
	/>
</Page>
