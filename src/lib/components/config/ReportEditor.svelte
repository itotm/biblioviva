<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The report editor (step 9.20, Q116, ADR-033): the titles in both languages and the category,
     then two tabs over the same file — **Guidata** (source, rows, columns, measures, totals, filters
     fixed or asked, chart: no SQL) and **SQL** (the statement and the parts written as JSON; a
     guided report shows the SQL it compiles to, read-only, and "Modifica come SQL" turns it into an
     SQL report after a confirmation, never the other way); the preview runs the draft with the
     defaults of its parameters; saving checks it like an upload. -->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import DataGrid, { type GridColumn } from "#lib/components/DataGrid.svelte";
	import ReportChart from "#lib/components/reports/ReportChart.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getReportBuilder,
		previewReportDraft,
		saveReportDefinition,
	} from "#lib/remote/report-library.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Checkbox from "#lib/ui/Checkbox.svelte";
	import CodeArea from "#lib/ui/CodeArea.svelte";
	import ChoiceButtons from "#lib/ui/ChoiceButtons.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Grid from "#lib/ui/Grid.svelte";
	import GridFrame from "#lib/ui/GridFrame.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";

	type Words = Record<string, string>;
	interface Filter {
		field: string;
		value?: string | number;
		ask?: boolean;
	}
	interface Query {
		source: "loans" | "items" | "patrons";
		filters: Filter[];
		rows: string[];
		columns?: string;
		measures: string[];
		totals?: string;
		sort?: string;
		limit?: number;
		chart?: string | null;
	}
	interface Draft {
		id: string;
		title: string | Words;
		description?: string | Words;
		category: string;
		restricted?: boolean;
		query?: Query;
		sql?: string;
		params?: unknown;
		columns?: unknown;
		chart?: unknown;
		pivot?: unknown;
		[key: string]: unknown;
	}
	interface Props {
		/** The definition to edit (a built-in, a customised or added one, or a new draft). */
		initial: Record<string, unknown>;
		/** A new report: the id can be typed. */
		isNew: boolean;
	}

	const { initial, isNew }: Props = $props();
	const i18n = useI18n();
	const builder = getReportBuilder();
	const SaveIcon = icons.save;
	const PreviewIcon = icons.view;
	const CodeIcon = icons.code;
	const BackIcon = icons.back;

	// svelte-ignore state_referenced_locally
	let draft = $state<Draft>(structuredClone(initial) as Draft);
	// svelte-ignore state_referenced_locally
	let tab = $state<"guided" | "sql">(draft.query ? "guided" : "sql");
	let preview = $state<Awaited<ReturnType<typeof previewReportDraft>> | null>(null);
	let busy = $state(false);
	let convertOpen = $state(false);
	let saveProblems = $state<string[]>([]);
	// the JSON parts of an SQL report, edited as text and parsed on every change
	const jsonText = (value: unknown): string =>
		value === undefined ? "" : JSON.stringify(value, null, "\t");
	// svelte-ignore state_referenced_locally
	let jsonParts = $state<Record<"params" | "columns" | "chart" | "pivot", string>>({
		params: jsonText(draft.params ?? []),
		columns: jsonText(draft.columns ?? []),
		chart: jsonText(draft.chart),
		pivot: jsonText(draft.pivot),
	});
	let jsonErrors = $state<Record<string, string>>({});
	const without = <T extends Record<string, unknown>>(o: T, keys: readonly string[]): T =>
		Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k))) as T;

	const words = (value: string | Words | undefined, lang: string): string =>
		typeof value === "string" ? (lang === "it" ? value : "") : (value?.[lang] ?? "");
	function setWords(key: "title" | "description", lang: string, text: string): void {
		const current = draft[key];
		const base: Words = typeof current === "string" ? { it: current } : { ...(current ?? {}) };
		base[lang] = text;
		draft[key] = base;
	}

	const source = $derived(builder.current?.find((s) => s.key === draft.query?.source) ?? null);

	function setSource(key: Query["source"]): void {
		const next = builder.current?.find((s) => s.key === key);
		if (!draft.query || !next) {
			return;
		}
		draft.query = {
			source: key,
			filters: [],
			rows: [next.dimensions[0]?.key ?? ""],
			measures: [next.measures[0]?.key ?? ""],
			totals: "both",
			sort: "dimension",
			chart: draft.query.chart ?? null,
		};
	}

	function toggleMeasure(key: string, on: boolean): void {
		const q = draft.query;
		if (!q) {
			return;
		}
		if (q.columns) {
			q.measures = [key];
			return;
		}
		const next = on
			? [...q.measures.filter((m) => m !== key), key]
			: q.measures.filter((m) => m !== key);
		q.measures = next.length > 0 ? next.slice(0, 3) : q.measures;
	}

	function filterMode(field: string): "off" | "ask" | "fixed" {
		const f = draft.query?.filters.find((x) => x.field === field);
		return !f ? "off" : f.ask ? "ask" : "fixed";
	}
	function setFilter(field: string, mode: string, value?: string): void {
		const q = draft.query;
		if (!q) {
			return;
		}
		const others = q.filters.filter((x) => x.field !== field);
		if (mode === "off") {
			q.filters = others;
			return;
		}
		const previous = q.filters.find((x) => x.field === field)?.value;
		const v = value ?? (previous === undefined ? undefined : String(previous));
		q.filters = [
			...others,
			{
				field,
				ask: mode === "ask",
				...(v ? { value: field === "group" ? Number(v) : v } : {}),
			},
		];
	}
	const filterValue = (field: string): string => {
		const v = draft.query?.filters.find((x) => x.field === field)?.value;
		return v === undefined ? "" : String(v);
	};
	const periodPart = (i: 0 | 1): string => filterValue("period").split("..")[i] ?? "";
	function setPeriod(i: 0 | 1, date: string): void {
		const parts = [periodPart(0), periodPart(1)];
		parts[i] = date;
		setFilter("period", filterMode("period"), parts.every(Boolean) ? parts.join("..") : "");
	}

	function onJson(part: keyof typeof jsonParts, text: string): void {
		jsonParts[part] = text;
		if (text.trim() === "") {
			draft = without(draft, [part]);
			jsonErrors = without(jsonErrors, [part]);
			return;
		}
		try {
			draft[part] = JSON.parse(text) as unknown;
			jsonErrors = without(jsonErrors, [part]);
		} catch (e) {
			jsonErrors = { ...jsonErrors, [part]: (e as Error).message };
		}
	}

	/** The draft as it is sent: the JSON parts only for an SQL report. */
	function payload(): Record<string, unknown> {
		const out = $state.snapshot(draft) as Record<string, unknown>;
		return out.query ? without(out, ["sql", "params", "columns", "chart", "pivot"]) : out;
	}

	async function runPreview(): Promise<void> {
		busy = true;
		try {
			preview = await previewReportDraft(payload());
		} finally {
			busy = false;
		}
	}

	async function convertToSql(): Promise<void> {
		const p = preview ?? (await previewReportDraft(payload()));
		if (!p.ok) {
			preview = p;
			return;
		}
		const { query: _q, ...rest } = draft;
		draft = {
			...rest,
			sql: p.compiled.sql,
			params: p.compiled.params,
			columns: p.compiled.columns,
			...(p.compiled.chart ? { chart: p.compiled.chart } : {}),
			...(p.compiled.pivot ? { pivot: p.compiled.pivot } : {}),
		};
		jsonParts = {
			params: jsonText(draft.params ?? []),
			columns: jsonText(draft.columns ?? []),
			chart: jsonText(draft.chart),
			pivot: jsonText(draft.pivot),
		};
		tab = "sql";
		toaster.success({ title: i18n.t("config.reports.editor.converted") });
	}

	async function save(): Promise<void> {
		// a JSON part that does not parse is never sent: the field says what is wrong
		if (Object.keys(jsonErrors).length > 0) {
			saveProblems = [i18n.t("config.reports.editor.jsonInvalid")];
			return;
		}
		busy = true;
		saveProblems = [];
		try {
			const r = await saveReportDefinition(payload());
			if (!r.ok) {
				// what SQLite or the checks said, in the words of the library page
				saveProblems = [
					i18n.t(`config.reports.errors.${r.code}`, {
						details: r.problems.join("; "),
						maxKb: 256,
					}),
				];
				return;
			}
			toaster.success({ title: i18n.t("config.reports.editor.saved", { id: r.id }) });
			if (isNew) {
				await goto(resolve(`admin/config/reports/${r.id}`));
			}
		} finally {
			busy = false;
		}
	}

	const previewColumns = $derived(
		preview?.ok
			? preview.columns.map((c): GridColumn => ({
					id: c.key,
					header: c.label,
					flexgrow: 1,
					sort: false,
				}))
			: [],
	);
	const previewRows = $derived(
		preview?.ok ? preview.rows.map((r, i) => ({ id: i + 1, ...r })) : [],
	);
	const compiledSql = $derived(preview?.ok ? preview.compiled.sql : "");
	const CATEGORIES = ["loans", "books", "patrons", "ops"] as const;
</script>

<Card gap="4" as="section" data-testid="report-editor-head">
	<Grid cols="2" gap="3">
		<Field label={i18n.t("config.reports.editor.id")}>
			<Input
				bind:value={draft.id}
				disabled={!isNew}
				pattern="[a-z0-9][a-z0-9\-]*"
				data-testid="editor-id"
			/>
		</Field>
		<Field label={i18n.t("config.reports.editor.category")}>
			<Select bind:value={draft.category} data-testid="editor-category">
				{#each CATEGORIES as c (c)}
					<option value={c}>{i18n.t(`reports.categories.${c}`)}</option>
				{/each}
			</Select>
		</Field>
		{#each ["it", "en"] as lang (lang)}
			<Field label={i18n.t(`config.reports.editor.title.${lang}`)}>
				<Input
					value={words(draft.title, lang)}
					oninput={(e) => setWords("title", lang, e.currentTarget.value)}
					data-testid="editor-title-{lang}"
				/>
			</Field>
		{/each}
		{#each ["it", "en"] as lang (lang)}
			<Field label={i18n.t(`config.reports.editor.description.${lang}`)}>
				<Input
					value={words(draft.description, lang)}
					oninput={(e) => setWords("description", lang, e.currentTarget.value)}
				/>
			</Field>
		{/each}
	</Grid>
	<Checkbox bind:checked={draft.restricted}>{i18n.t("config.reports.editor.restricted")}</Checkbox
	>
</Card>

<ChoiceButtons
	choices={[
		{ key: "guided", label: i18n.t("config.reports.editor.tabs.guided") },
		{ key: "sql", label: i18n.t("config.reports.editor.tabs.sql"), icon: CodeIcon },
	]}
	current={tab}
	onselect={(k) => (tab = k)}
	label={i18n.t("config.reports.editor.tabs.label")}
	itemTestid="editor-tab-"
/>

{#if tab === "guided"}
	<Card gap="4" as="section" data-testid="editor-guided">
		{#if !draft.query}
			<Hint tone="soft">{i18n.t("config.reports.editor.sqlOnly")}</Hint>
		{:else if source}
			{@const q = draft.query}
			<Grid cols="2" gap="3">
				<Field label={i18n.t("config.reports.editor.source")}>
					<Select
						value={q.source}
						onchange={(e) => setSource(e.currentTarget.value as Query["source"])}
						data-testid="editor-source"
					>
						{#each builder.current ?? [] as s (s.key)}
							<option value={s.key}>{s.label}</option>
						{/each}
					</Select>
				</Field>
				<Field label={i18n.t("config.reports.editor.chart")}>
					<Select
						value={q.chart ?? ""}
						onchange={(e) => (q.chart = e.currentTarget.value || null)}
						data-testid="editor-chart"
					>
						<option value="">{i18n.t("config.reports.editor.none")}</option>
						{#each ["bar", "line", "doughnut"] as c (c)}
							<option value={c}>{i18n.t(`config.reports.editor.charts.${c}`)}</option>
						{/each}
					</Select>
				</Field>
				<Field label={i18n.t("config.reports.editor.rows")}>
					<Select bind:value={q.rows[0]} data-testid="editor-row-0">
						{#each source.dimensions as d (d.key)}
							<option value={d.key}>{d.label}</option>
						{/each}
					</Select>
				</Field>
				<Field label={i18n.t("config.reports.editor.rows2")}>
					<Select
						value={q.rows[1] ?? ""}
						onchange={(e) =>
							(q.rows = e.currentTarget.value
								? [q.rows[0] ?? "", e.currentTarget.value]
								: [q.rows[0] ?? ""])}
						data-testid="editor-row-1"
					>
						<option value="">{i18n.t("config.reports.editor.none")}</option>
						{#each source.dimensions.filter((d) => d.key !== q.rows[0]) as d (d.key)}
							<option value={d.key}>{d.label}</option>
						{/each}
					</Select>
				</Field>
				<Field
					label={i18n.t("config.reports.editor.columns")}
					hint={i18n.t("config.reports.editor.columnsHint")}
				>
					<Select
						value={q.columns ?? ""}
						onchange={(e) => {
							const v = e.currentTarget.value;
							q.columns = v || undefined;
							if (v) {
								q.measures = q.measures.slice(0, 1);
							}
						}}
						data-testid="editor-columns"
					>
						<option value="">{i18n.t("config.reports.editor.none")}</option>
						{#each source.dimensions.filter((d) => !q.rows.includes(d.key)) as d (d.key)}
							<option value={d.key}>{d.label}</option>
						{/each}
					</Select>
				</Field>
				{#if q.columns}
					<Field label={i18n.t("config.reports.editor.totals")}>
						<Select bind:value={q.totals} data-testid="editor-totals">
							{#each ["both", "rows", "columns", "none"] as t (t)}
								<option value={t}
									>{i18n.t(`config.reports.editor.totalsOptions.${t}`)}</option
								>
							{/each}
						</Select>
					</Field>
				{:else}
					<Field label={i18n.t("config.reports.editor.sort")}>
						<Select bind:value={q.sort} data-testid="editor-sort">
							<option value="dimension"
								>{i18n.t("config.reports.editor.sortDimension")}</option
							>
							<option value="measure"
								>{i18n.t("config.reports.editor.sortMeasure")}</option
							>
						</Select>
					</Field>
				{/if}
			</Grid>
			<fieldset class="space-y-1">
				<legend class="label-text">{i18n.t("config.reports.editor.measures")}</legend>
				{#each source.measures as m (m.key)}
					<Checkbox
						checked={q.measures.includes(m.key)}
						onchange={(e) => toggleMeasure(m.key, e.currentTarget.checked)}
						data-testid="editor-measure-{m.key}">{m.label}</Checkbox
					>
				{/each}
				{#if q.columns}
					<Hint>{i18n.t("config.reports.editor.oneMeasure")}</Hint>
				{/if}
			</fieldset>
			<fieldset class="space-y-2">
				<legend class="label-text">{i18n.t("config.reports.editor.filters")}</legend>
				{#each source.filters as f (f.key)}
					{@const mode = filterMode(f.key)}
					<Row align="end" gap="2" data-testid="editor-filter-{f.key}">
						<Field label={f.label} class="w-56">
							<Select
								value={mode}
								onchange={(e) => setFilter(f.key, e.currentTarget.value)}
								data-testid="editor-filter-mode-{f.key}"
							>
								<option value="off"
									>{i18n.t("config.reports.editor.filterModes.off")}</option
								>
								<option value="ask"
									>{i18n.t("config.reports.editor.filterModes.ask")}</option
								>
								<option value="fixed"
									>{i18n.t("config.reports.editor.filterModes.fixed")}</option
								>
							</Select>
						</Field>
						{#if mode === "fixed" && f.kind === "period"}
							<Field label={i18n.t("reports.from")} class="w-44">
								<Input
									type="date"
									value={periodPart(0)}
									oninput={(e) => setPeriod(0, e.currentTarget.value)}
								/>
							</Field>
							<Field label={i18n.t("reports.to")} class="w-44">
								<Input
									type="date"
									value={periodPart(1)}
									oninput={(e) => setPeriod(1, e.currentTarget.value)}
								/>
							</Field>
						{:else if mode === "fixed"}
							<Field label={i18n.t("config.reports.editor.value")} class="w-56">
								<Select
									value={filterValue(f.key)}
									onchange={(e) =>
										setFilter(f.key, "fixed", e.currentTarget.value)}
									data-testid="editor-filter-value-{f.key}"
								>
									<option value=""></option>
									{#if f.kind === "patronType"}
										<option value="student"
											>{i18n.t("reports.patronTypes.student")}</option
										>
										<option value="teacher"
											>{i18n.t("reports.patronTypes.teacher")}</option
										>
									{:else}
										{#each f.options as o (o.value)}
											<option value={o.value}>{o.label}</option>
										{/each}
									{/if}
								</Select>
							</Field>
						{/if}
					</Row>
				{/each}
			</fieldset>
		{/if}
	</Card>
{:else}
	<Card gap="4" as="section" data-testid="editor-sql">
		{#if draft.query}
			<Hint tone="soft">{i18n.t("config.reports.editor.compiledHint")}</Hint>
			<pre
				class="overflow-x-auto rounded-container bg-surface-100 p-3 font-mono text-xs whitespace-pre-wrap"
				data-testid="editor-compiled">{compiledSql ||
					i18n.t("config.reports.editor.previewFirst")}</pre>
			<div>
				<Button
					icon={CodeIcon}
					onclick={() => (convertOpen = true)}
					data-testid="editor-convert">{i18n.t("config.reports.editor.convert")}</Button
				>
			</div>
		{:else}
			<Field label="SQL" hint={i18n.t("config.reports.editor.sqlHint")}>
				<CodeArea rows={8} bind:value={draft.sql} data-testid="editor-sql-text" />
			</Field>
			{#each ["params", "columns", "chart", "pivot"] as const as part (part)}
				<Field
					label={i18n.t(`config.reports.editor.json.${part}`)}
					hint={i18n.t("config.reports.editor.jsonHint")}
				>
					<CodeArea
						small
						rows={part === "params" || part === "columns" ? 8 : 4}
						value={jsonParts[part]}
						oninput={(e) => onJson(part, e.currentTarget.value)}
						data-testid="editor-json-{part}"
					/>
				</Field>
				{#if jsonErrors[part]}
					<Hint tone="error" role="alert">{jsonErrors[part]}</Hint>
				{/if}
			{/each}
		{/if}
	</Card>
{/if}

<Card gap="3" as="section" data-testid="editor-preview">
	<Row justify="between" align="center">
		<h2 class="font-semibold">{i18n.t("config.reports.editor.preview")}</h2>
		<Button
			icon={PreviewIcon}
			onclick={runPreview}
			disabled={busy}
			data-testid="editor-run-preview">{i18n.t("config.reports.editor.runPreview")}</Button
		>
	</Row>
	{#if !preview}
		<Hint>{i18n.t("config.reports.editor.previewHint")}</Hint>
	{:else if !preview.ok}
		<Alert tone="error" as="div" padded data-testid="editor-problems">
			<ul class="list-disc pl-5">
				{#each preview.problems as p (p)}<li><Hint as="span" mono>{p}</Hint></li>{/each}
			</ul>
		</Alert>
	{:else}
		{#if preview.chart}
			<ReportChart {...preview.chart} ariaLabel={words(draft.title, "it")} />
		{/if}
		{#if previewRows.length === 0}
			<Hint>{i18n.t("reports.empty")}</Hint>
		{:else}
			<GridFrame>
				<DataGrid
					data={previewRows}
					columns={previewColumns}
					height="{Math.min(420, 56 + previewRows.length * 40)}px"
					select={false}
				/>
			</GridFrame>
		{/if}
	{/if}
</Card>

{#if saveProblems.length}
	<Alert tone="error" as="div" padded data-testid="editor-save-problems">
		<ul class="list-disc pl-5">
			{#each saveProblems as p (p)}<li><Hint as="span" mono>{p}</Hint></li>{/each}
		</ul>
	</Alert>
{/if}
<Row>
	<Button
		variant="primary"
		icon={SaveIcon}
		onclick={save}
		disabled={busy}
		data-testid="editor-save">{i18n.t("config.reports.editor.save")}</Button
	>
	<Button icon={BackIcon} href="/admin/config/reports"
		>{i18n.t("config.reports.editor.back")}</Button
	>
</Row>

<ConfirmDialog
	bind:open={convertOpen}
	title={i18n.t("config.reports.editor.convertTitle")}
	description={i18n.t("config.reports.editor.convertHint")}
	confirmLabel={i18n.t("config.reports.editor.convert")}
	onconfirm={convertToSql}
/>
