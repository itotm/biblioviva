<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- One report (step 6.2): the parameter form generated from the definition (dates, numbers,
     choices from the configuration), the results in the grid (sortable, exported as CSV/ODS
     from the header with the parameters it ran with), the chart when the definition has one and
     the print view; the parameters live in the URL, so a link reopens the same report. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import { getReport, runReportQuery } from "#lib/remote/reports.remote.js";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import ExportMenu from "#lib/components/ExportMenu.svelte";
	import ReportChart from "#lib/components/reports/ReportChart.svelte";
	import { icons } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import QueryState from "#lib/ui/QueryState.svelte";

	const { data } = $props();
	const i18n = useI18n();
	const fmt = useFormat();
	const RunIcon = icons.renew;
	const PrintIcon = icons.print;

	const report = $derived(getReport(data.id));
	const urlParams = $derived(Object.fromEntries(page.url.searchParams));
	const result = $derived(runReportQuery({ id: data.id, params: urlParams }));
	let draft = $state<Record<string, string>>({});

	// the form shows the values the report ran with (defaults resolved on the server)
	$effect(() => {
		const r = result.current;
		if (r?.ok) {
			draft = { ...r.shown };
		}
	});

	const shown = $derived(result.current?.ok ? result.current.shown : urlParams);
	const query = (values: Record<string, string>): string =>
		Object.entries(values)
			.filter(([, v]) => v !== "")
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join("&");

	function run(e: SubmitEvent): void {
		e.preventDefault();
		void goto(resolve(`reports/${data.id}?${query(draft)}`), { reset: false });
	}

	/** Report values are SQLite scalars: text, numbers, or null. */
	const cellText = (value: unknown): string =>
		typeof value === "string" || typeof value === "number" || typeof value === "boolean"
			? String(value)
			: "";

	function display(type: string, value: unknown): string | number {
		if (value === null || value === undefined) {
			return "";
		}
		if (type === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
			return fmt.day(value.slice(0, 10), "medium");
		}
		if (type === "datetime" && typeof value === "string") {
			return fmt.dateTime(value);
		}
		if (type === "percent" && typeof value === "number") {
			return `${value} %`;
		}
		return typeof value === "number" ? value : cellText(value);
	}

	const NUMERIC = new Set(["int", "number", "percent"]);
	// the columns come with the run: a pivot table's columns are the values found (9.20)
	const shownColumns = $derived(result.current?.ok ? result.current.columns : []);
	const pivot = $derived(report.current?.pivot ?? false);
	const columns = $derived(
		shownColumns.map((c): GridColumn => ({
			id: c.key,
			header: c.label,
			width: NUMERIC.has(c.type) ? 120 : 200,
			flexgrow: NUMERIC.has(c.type) ? undefined : 1,
			// a pivot keeps its total row last: its order is the table's
			sort: !pivot,
		})),
	);
	const rows = $derived(
		result.current?.ok
			? result.current.rows.map((r, i) => {
					const row: Record<string, unknown> = { id: i + 1 };
					for (const c of shownColumns) {
						row[c.key] = display(c.type, r[c.key]);
					}
					return row;
				})
			: [],
	);
	const chartData = $derived(result.current?.ok ? result.current.chart : null);

	const errorText = $derived.by(() => {
		const r = result.current;
		if (!r || r.ok) {
			return null;
		}
		const base = (report.current?.params ?? []).find(
			(p) => p.name === r.param || `${p.name}From` === r.param || `${p.name}To` === r.param,
		);
		return i18n.t(`reports.errors.${r.code}`, { label: base?.label ?? r.param });
	});
</script>

<Page width="2xl">
	<PageHeader
		title={report.current?.title ?? i18n.t("reports.title")}
		subtitle={report.current?.description}
		icon="reports"
		backHref="/reports"
		backLabel={i18n.t("reports.back")}
	>
		{#snippet actions()}
			<Button
				icon={PrintIcon}
				href="/print/reports/{data.id}?{query(shown)}"
				target="_blank"
				rel="noopener"
				data-testid="report-print">{i18n.t("reports.print")}</Button
			>
			<ExportMenu table="report" params={{ id: data.id, ...shown }} />
		{/snippet}
	</PageHeader>

	<QueryState query={report}>
		{#snippet children(def)}
			<Card gap="3" as="section" data-testid="report-params">
				<h2 class="font-semibold">{i18n.t("reports.params")}</h2>
				{#if def.params.length === 0}
					<Hint>{i18n.t("reports.noParams")}</Hint>
				{:else}
					<form onsubmit={run} class="flex flex-wrap items-end gap-3">
						{#each def.params as p (p.name)}
							{#if p.type === "date"}
								<Field label={p.label} class="w-44">
									<Input
										type="date"
										bind:value={draft[p.name]}
										data-testid="param-{p.name}"
									/>
								</Field>
							{:else if p.type === "dateRange"}
								<Field label="{p.label} ({i18n.t('reports.from')})" class="w-44">
									<Input
										type="date"
										bind:value={draft[`${p.name}From`]}
										data-testid="param-{p.name}From"
									/>
								</Field>
								<Field label="{p.label} ({i18n.t('reports.to')})" class="w-44">
									<Input
										type="date"
										bind:value={draft[`${p.name}To`]}
										data-testid="param-{p.name}To"
									/>
								</Field>
							{:else if p.type === "int"}
								<Field label={p.label} class="w-32">
									<Input
										type="number"
										min={p.min}
										max={p.max}
										value={draft[p.name] ?? ""}
										oninput={(e) => (draft[p.name] = e.currentTarget.value)}
										data-testid="param-{p.name}"
									/>
								</Field>
							{:else if p.type === "text"}
								<Field label={p.label} class="w-56">
									<Input
										bind:value={draft[p.name]}
										data-testid="param-{p.name}"
									/>
								</Field>
							{:else}
								<Field label={p.label} class="w-48">
									<Select bind:value={draft[p.name]} data-testid="param-{p.name}">
										{#if !p.required}
											<option value="">{i18n.t("reports.all")}</option>
										{/if}
										{#if p.type === "patronType"}
											<option value="student"
												>{i18n.t("reports.patronTypes.student")}</option
											>
											<option value="teacher"
												>{i18n.t("reports.patronTypes.teacher")}</option
											>
										{:else}
											{#each p.options as o (o.value)}
												<option value={o.value}>{o.label}</option>
											{/each}
										{/if}
									</Select>
								</Field>
							{/if}
						{/each}
						<Button
							type="submit"
							variant="primary"
							icon={RunIcon}
							data-testid="report-run">{i18n.t("reports.run")}</Button
						>
					</form>
				{/if}
			</Card>

			{#if errorText}
				<Alert tone="error" padded data-testid="report-error">{errorText}</Alert>
			{:else}
				<QueryState query={result}>
					{#snippet children(r)}
						{#if r.ok}
							<Row align="center" gap="2">
								<p
									class="text-sm font-semibold text-primary-700"
									data-testid="report-count"
									aria-live="polite"
								>
									{i18n.t("reports.rows", { count: r.rows.length })}
								</p>
								<Hint as="span">{i18n.t("reports.ms", { ms: r.ms })}</Hint>
							</Row>
							{#if r.truncated}
								<Alert tone="warning" padded data-testid="report-truncated"
									>{i18n.t("reports.truncated", { count: r.rows.length })}</Alert
								>
							{/if}
							{#if chartData}
								<Card as="section" gap="3">
									<ReportChart {...chartData} ariaLabel={def.title} />
								</Card>
							{/if}
							{#if rows.length === 0}
								<Hint data-testid="report-empty">{i18n.t("reports.empty")}</Hint>
							{:else}
								<GridFrame>
									<DataGrid
										data={rows}
										{columns}
										height="{Math.min(
											560,
											56 + Math.max(rows.length, 2) * 40,
										)}px"
										select={false}
									/>
								</GridFrame>
							{/if}
						{/if}
					{/snippet}
				</QueryState>
			{/if}
		{/snippet}
	</QueryState>
</Page>
