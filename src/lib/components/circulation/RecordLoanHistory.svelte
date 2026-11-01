<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- "Storico prestiti" of a record (step 4.7): every loan of its copies, newest first, with the
     patron (a removed one keeps the anonymized name, e.g. "Studente Rimosso #123"), the class of
     the day, the dates and the outcome. A click opens the patron (with `patrons`). -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { useI18n } from "#lib/i18n/context.js";
	import { getRecordLoanHistory } from "#lib/remote/loans.remote.js";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import { useFormat } from "#lib/ui/format.js";
	import Hint from "#lib/ui/Hint.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	interface Props {
		biblioId: number;
		/** The patron opens on a click only for accounts that may open patron pages. */
		openPatrons?: boolean;
	}

	const { biblioId, openPatrons = false }: Props = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const history = $derived(getRecordLoanHistory(biblioId));
	const col = (id: string, width: number, flexgrow?: number): GridColumn => ({
		id,
		header: i18n.t(`circulation.history.columns.${id}`),
		width,
		flexgrow,
	});
	const columns: GridColumn[] = [
		col("issuedAt", 140),
		col("patron", 200, 1),
		col("classLabel", 80),
		col("barcode", 120),
		col("dueDate", 120),
		col("returnedAt", 140),
		col("outcome", 170),
		col("renewals", 80),
	];
	const rows = $derived(
		(history.current ?? []).map((h) => ({
			id: h.loanId,
			patronId: h.patronId,
			issuedAt: fmt.dateTime(h.issuedAt),
			patron: h.name,
			classLabel:
				h.patronType === "teacher" ? i18n.t("circulation.checkout.teacher") : h.classLabel,
			barcode: h.barcode,
			dueDate: fmt.day(h.dueDate.slice(0, 10), "medium"),
			returnedAt: h.returnedAt ? fmt.dateTime(h.returnedAt) : "",
			outcome: i18n.t(`patrons.detail.outcome.${h.outcome}`),
			renewals: h.renewals,
		})),
	);
</script>

<QueryState query={history} size="md" isEmpty={(h) => h.length === 0}>
	{#snippet empty()}
		<p class="opacity-70" data-testid="record-history-empty">
			{i18n.t("circulation.history.empty")}
		</p>
	{/snippet}
	<div class="space-y-2" data-testid="record-history">
		<Hint tone="primary">{i18n.t("circulation.history.count", { count: rows.length })}</Hint>
		<DataGrid
			data={rows}
			{columns}
			height="{Math.min(480, 56 + Math.max(rows.length, 2) * 40)}px"
			select={false}
			onrowclick={openPatrons
				? (row) => void goto(resolve(`patrons/${String(row.patronId)}`))
				: undefined}
		/>
	</div>
</QueryState>
