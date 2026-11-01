<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The patron page's loan history (step 2.7): a grid of every loan with its outcome, exportable. -->
<script lang="ts">
	import { useI18n } from "#lib/i18n/context.js";
	import type { getPatronHistory } from "#lib/remote/patrons.remote.js";
	import { useFormat } from "#lib/ui/format.js";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import DataGrid, { type GridColumn } from "../DataGrid.svelte";
	import ExportMenu from "../ExportMenu.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	interface Props {
		patronId: number;
		/** The history query: the page refreshes it when a loan of the patron ends. */
		history: ReturnType<typeof getPatronHistory>;
	}

	const { patronId, history }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const columns: GridColumn[] = [
		{ id: "issued", header: i18n.t("patrons.detail.historyColumns.issuedAt"), width: 120 },
		{ id: "due", header: i18n.t("patrons.detail.historyColumns.dueDate"), width: 110 },
		{ id: "returned", header: i18n.t("patrons.detail.historyColumns.returnedAt"), width: 120 },
		{ id: "outcomeText", header: i18n.t("patrons.detail.historyColumns.outcome"), width: 150 },
		{ id: "title", header: i18n.t("patrons.detail.historyColumns.title"), flexgrow: 1 },
		{ id: "barcode", header: i18n.t("patrons.detail.historyColumns.barcode"), width: 120 },
		{ id: "renewals", header: i18n.t("patrons.detail.historyColumns.renewals"), width: 80 },
	];
	const rows = $derived(
		(history.current?.rows ?? []).map((l) => ({
			id: l.loanId,
			issued: fmt.date(l.issuedAt, "medium"),
			due: fmt.day(l.dueDate, "medium"),
			returned: l.returnedAt ? fmt.date(l.returnedAt, "medium") : "",
			outcomeText: i18n.t(`patrons.detail.outcome.${l.outcome}`),
			title: l.title,
			barcode: l.barcode,
			renewals: l.renewals,
		})),
	);
</script>

<QueryState query={history} isEmpty={(h) => h.rows.length === 0}>
	{#snippet empty()}
		<p class="opacity-70" data-testid="history-empty">
			{i18n.t("patrons.detail.historyEmpty")}
		</p>
	{/snippet}
	{#snippet children(h)}
		<Row align="center">
			<Hint tone="primary" data-testid="history-count">
				{i18n.t("patrons.detail.historyCount", {
					count: h.rows.length,
				})}
			</Hint>
			<ExportMenu table="patron-loans" params={{ patron: patronId }} class="ml-auto" />
		</Row>
		<DataGrid
			data={rows}
			{columns}
			height="{Math.min(480, 56 + Math.max(rows.length, 2) * 40)}px"
			select={false}
		/>
	{/snippet}
</QueryState>
