<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Audit log (step 1.7): grid with date, account and action filters. Rows never contain personal data. -->
<script lang="ts">
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getAudit, getAuditOptions } from "#lib/remote/audit.remote.js";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import EmptyState from "#lib/ui/EmptyState.svelte";
	import ExportMenu from "#lib/components/ExportMenu.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import Select from "#lib/ui/Select.svelte";
	import Field from "#lib/ui/Field.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const fmt = useFormat();

	let from = $state("");
	let to = $state("");
	let userId = $state("");
	let action = $state("");
	const filters = $derived({
		from: from || undefined,
		to: to || undefined,
		userId: userId ? Number(userId) : undefined,
		action: action || undefined,
	});
	const audit = $derived(getAudit(filters));

	const columns: GridColumn[] = [
		{ id: "when", header: i18n.t("admin.audit.columns.when"), width: 150 },
		{ id: "username", header: i18n.t("admin.audit.columns.user"), width: 130 },
		{ id: "action", header: i18n.t("admin.audit.columns.action"), width: 170 },
		{ id: "entity", header: i18n.t("admin.audit.columns.entity"), width: 130 },
		{ id: "entityId", header: i18n.t("admin.audit.columns.entityId"), width: 110 },
		{ id: "detailsText", header: i18n.t("admin.audit.columns.details"), flexgrow: 1 },
	];
</script>

<Page width="2xl">
	<PageHeader
		title={i18n.t("admin.audit.title")}
		icon="lists"
		backHref="/admin"
		backLabel={i18n.t("common.actions.back")}
	>
		{#snippet actions()}
			<ExportMenu table="audit" params={{ from, to, userId, action }} />
		{/snippet}
	</PageHeader>

	<form
		class="grid gap-3 md:grid-cols-4"
		onsubmit={(e) => e.preventDefault()}
		data-testid="audit-filters"
	>
		<Field label={i18n.t("admin.audit.filters.from")}
			><Input type="date" bind:value={from} /></Field
		>
		<Field label={i18n.t("admin.audit.filters.to")}><Input type="date" bind:value={to} /></Field
		>
		{#await getAuditOptions() then options}
			<Field label={i18n.t("admin.audit.filters.user")}
				><Select bind:value={userId} data-testid="audit-user">
					<option value="">{i18n.t("admin.audit.filters.all")}</option>
					{#each options.users as u (u.id)}<option value={String(u.id)}
							>{u.username}</option
						>{/each}
				</Select></Field
			>
			<Field label={i18n.t("admin.audit.filters.action")}
				><Select bind:value={action} data-testid="audit-action">
					<option value="">{i18n.t("admin.audit.filters.all")}</option>
					{#each options.actions as a (a)}<option value={a}>{a}</option>{/each}
				</Select></Field
			>
		{/await}
	</form>

	<QueryState query={audit}>
		{#snippet children(result)}
			<Hint data-testid="audit-count">
				{i18n.t("admin.audit.count", { shown: result.rows.length, total: result.total })}
			</Hint>
			{#if result.rows.length === 0}
				<EmptyState title={i18n.t("admin.audit.empty")} icon="lists" />
			{:else}
				<GridFrame>
					<DataGrid
						data={result.rows.map((r) => ({
							...r,
							when: fmt.dateTime(r.at),
							username: r.username ?? i18n.t("admin.audit.system"),
							detailsText: r.details ? JSON.stringify(r.details) : "",
						}))}
						{columns}
						height="60vh"
						select={false}
					/>
				</GridFrame>
			{/if}
		{/snippet}
	</QueryState>
</Page>
