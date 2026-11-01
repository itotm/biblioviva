<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The student or teacher import (steps 2.6, 9.19): the steps of every import (`ImportShell`)
     with the detected format, the mode and the duplicates policy, the homonyms picked by hand,
     the missing patrons listed, the generated cards counted, and the cards to print at the end. -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import CardPrintDialog from "#lib/components/patrons/CardPrintDialog.svelte";
	import type { GridColumn } from "#lib/components/DataGrid.svelte";
	import ImportShell from "#lib/components/imports/ImportShell.svelte";
	import { ImportWizard } from "#lib/components/imports/import-wizard.svelte.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { patronSortName } from "#lib/shared/patron-name.js";
	import { STUDENT_IMPORT, TEACHER_IMPORT, type ImportSpec } from "#lib/shared/import-columns.js";
	import {
		commitPatronCsv,
		uploadPatronCsv,
		validatePatronCsv,
	} from "#lib/remote/patron-import.remote.js";
	import type {
		DuplicatePolicy,
		ImportMode,
		PatronAudience,
		PatronImportColumn,
	} from "#lib/server/imports/patrons.js";
	import { icons } from "#lib/ui/icons.js";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Select from "#lib/ui/Select.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";
	import { photosOn } from "#lib/ui/features.js";

	interface Props {
		audience: PatronAudience;
		/** The operator holds `anonymize`: missing patrons may be removed. */
		canRemove: boolean;
	}

	const { audience, canRemove }: Props = $props();
	const spec: ImportSpec<PatronImportColumn> = $derived(
		audience === "students" ? STUDENT_IMPORT : TEACHER_IMPORT,
	);
	const canPatrons = $derived(hasPermission(page.data.user, "patrons"));
	const i18n = useI18n();
	const PrintIcon = icons.print;
	const CameraIcon = icons.camera;

	let cardDialog = $state(false);
	let mode = $state<ImportMode>("upsert");
	let duplicatePolicy = $state<DuplicatePolicy>("update");
	let resolutions = $state<Record<string, number | "create">>({});
	let removeMissing = $state(false);

	const wizard = new ImportWizard({
		upload: uploadPatronCsv,
		validate: (run) => validatePatronCsv(run),
		commit: (run) => commitPatronCsv({ ...run, removeMissing }),
		spec: () => spec,
		run: () => ({ audience, mode, duplicatePolicy, resolutions }),
		doneTitle: () => i18n.t("patrons.import.done.title"),
		onUpload: () => (resolutions = {}),
		onValidated: () => (removeMissing = false),
	});

	const keyMissing = (field: PatronImportColumn): string | undefined =>
		field === "cardNumber"
			? i18n.t("patrons.import.columns.cardNumber.missing")
			: field === "externalId"
				? i18n.t(`patrons.import.mapping.matchByName.${audience}`)
				: undefined;

	const groupOf = (r: { classLabel: string; patronType: string }): string =>
		r.patronType === "teacher" && r.classLabel === ""
			? i18n.t("patrons.types.teacher")
			: r.classLabel;

	const gridColumns: GridColumn[] = [
		{ id: "line", header: i18n.t("common.import.line"), width: 70 },
		{ id: "statusText", header: i18n.t("common.import.status"), width: 110 },
		{ id: "name", header: i18n.t("patrons.import.preview.columns.name"), width: 220 },
		{ id: "group", header: i18n.t("patrons.import.preview.columns.class"), width: 90 },
		{ id: "reason", header: i18n.t("common.import.reason"), flexgrow: 1 },
	];
	const gridRows = $derived(
		wizard.visibleRows.map((r) => ({
			id: r.line,
			line: r.line,
			statusText: i18n.t(`common.import.statuses.${r.status}`),
			name: patronSortName(r.data),
			group: r.classLabel,
			reason: [
				...r.reasons.map((x) => i18n.t(`patrons.import.reasons.${x.code}`, x.params ?? {})),
				...(r.changed.length
					? [
							i18n.t("patrons.import.preview.changed", {
								fields: r.changed
									.map((f) => i18n.t(`patrons.import.fields.${f}`))
									.join(", "),
							}),
						]
					: []),
			].join(" · "),
		})),
	);
	const homonyms = $derived((wizard.result?.rows ?? []).filter((r) => r.candidates?.length));
</script>

<ImportShell
	{wizard}
	title={i18n.t(`patrons.import.titles.${audience}`)}
	current={audience}
	upload={uploadPatronCsv}
	accept=".csv,.txt,text/csv,text/plain"
	texts={{
		uploadHint: i18n.t(`patrons.import.upload.hints.${audience}`),
		file: i18n.t("patrons.import.upload.file"),
		upload: i18n.t("patrons.import.upload.submit"),
		uncertain: i18n.t("patrons.import.mapping.uncertain"),
		validate: i18n.t("patrons.import.mapping.validate"),
		again: i18n.t("patrons.import.done.again"),
		ready: i18n.t("patrons.import.preview.ready"),
		blocked: () => i18n.t("patrons.import.preview.blocked"),
		commit: i18n.t("patrons.import.preview.commit"),
		back: i18n.t("patrons.import.preview.back"),
		doneTitle: i18n.t("patrons.import.done.title"),
		doneSummary: (summary) => i18n.t("patrons.import.done.summary", summary),
		doneBatch: (summary) => i18n.t("patrons.import.done.batch", { id: summary.batchId }),
		field: (field) => i18n.t(`patrons.import.fields.${field}`),
	}}
	columns={spec.columns}
	template={{
		hint: (field) => i18n.t(`patrons.import.columns.${field}.hint`),
		missing: keyMissing,
		alternatives:
			audience === "students"
				? [
						{ fields: ["class"], label: i18n.t("patrons.import.classForm.class") },
						{
							fields: ["level", "section"],
							label: i18n.t("patrons.import.classForm.levelSection"),
						},
					]
				: [],
		alternativesLabel: i18n.t("patrons.import.classForm.label"),
		href: (headers) => resolve(`admin/imports/${audience}/template.csv?columns=${headers}`),
		storageKey: `bv-template-${audience}`,
	}}
	{gridColumns}
	{gridRows}
>
	{#snippet uploadFields()}
		<input {...uploadPatronCsv.fields.audience.as("hidden", audience)} />
	{/snippet}
	{#snippet mappingInfo()}
		<p class="text-sm">
			{i18n.t("patrons.import.mapping.format")}:
			<strong data-testid="detected-format"
				>{i18n.t(`patrons.import.mapping.formats.${wizard.detection?.format}`)}</strong
			>
			{#if wizard.remembered}
				<span class="block text-sm text-primary-700" data-testid="mapping-remembered"
					>{i18n.t("patrons.import.mapping.remembered")}</span
				>
			{/if}
		</p>
	{/snippet}
	{#snippet mappingOptions()}
		{#if !wizard.mapping.includes("externalId")}
			<Hint data-testid="match-by-name">
				{i18n.t(`patrons.import.mapping.matchByName.${audience}`)}
			</Hint>
		{/if}

		<fieldset class="space-y-2">
			<legend class="label-text">{i18n.t("patrons.import.mapping.mode")}</legend>
			{#each ["upsert", "sync"] as m (m)}
				<Row wrap={false} align="start" as="label">
					<input
						type="radio"
						class="mt-1 radio"
						name="mode"
						value={m}
						bind:group={mode}
						data-testid="mode-{m}"
					/>
					<TitleHint
						title={m === "sync"
							? i18n.t(`patrons.import.mapping.modes.sync.${audience}`)
							: i18n.t("patrons.import.mapping.modes.upsert")}
						>{m === "sync"
							? i18n.t(`patrons.import.mapping.modes.syncHint.${audience}`)
							: i18n.t("patrons.import.mapping.modes.upsertHint")}</TitleHint
					>
				</Row>
			{/each}
		</fieldset>
		<Field label={i18n.t("patrons.import.mapping.duplicates")} class="max-w-xs"
			><Select bind:value={duplicatePolicy} data-testid="duplicate-policy">
				{#each ["update", "skip", "create"] as p (p)}
					<option value={p}>{i18n.t(`patrons.import.mapping.policies.${p}`)}</option>
				{/each}
			</Select></Field
		>
	{/snippet}
	{#snippet previewInfo(result)}
		{#if result.generatedCards > 0}
			<Hint tone="primary" data-testid="generated-cards">
				{i18n.t("patrons.import.preview.generatedCards", {
					count: result.generatedCards,
				})}
			</Hint>
		{/if}
	{/snippet}
	{#snippet previewMore(result)}
		{#if homonyms.length}
			<Card gap="3" data-testid="homonyms">
				<h2 class="font-semibold">{i18n.t("patrons.import.preview.homonym.title")}</h2>
				{#each homonyms as row (row.line)}
					<Field
						label="{i18n.t('common.import.line')}
							{row.line}: {patronSortName(row.data)} ({row.classLabel})"
						><Select
							class="max-w-md"
							value={resolutions[String(row.line)] ?? ""}
							onchange={(e) => {
								const value = e.currentTarget.value;
								resolutions = {
									...resolutions,
									[String(row.line)]:
										value === "create" ? "create" : Number(value),
								};
							}}
							data-testid="homonym-{row.line}"
						>
							<option value="">{i18n.t("patrons.import.preview.homonym.pick")}</option
							>
							{#each row.candidates ?? [] as c (c.id)}
								<option value={c.id}>
									{i18n.t("patrons.import.preview.homonym.candidate", {
										name: patronSortName(c),
										group: groupOf(c),
									})}
								</option>
							{/each}
							<option value="create"
								>{i18n.t("patrons.import.preview.homonym.create")}</option
							>
						</Select></Field
					>
				{/each}
				<Button onclick={wizard.validate} disabled={wizard.busy}
					>{i18n.t("patrons.import.mapping.validate")}</Button
				>
			</Card>
		{/if}

		{#if result.missing.length}
			<Card gap="3" data-testid="missing-patrons">
				<h2 class="font-semibold">
					{i18n.t(`patrons.import.preview.missing.${audience}.title`, {
						count: result.missing.length,
					})}
				</h2>
				<Hint tone="soft">
					{i18n.t("patrons.import.preview.missing.hint")}
				</Hint>
				<ul class="max-h-60 divide-y divide-surface-200 overflow-y-auto text-sm">
					{#each result.missing as m (m.id)}
						<Row as="li" class="py-1">
							<span class="font-semibold">{patronSortName(m)}</span>
							<span class="opacity-70">{groupOf(m)}</span>
							{#if m.openLoans > 0}
								<span class="text-warning-800"
									>{i18n.t("patrons.import.preview.missing.openLoans", {
										count: m.openLoans,
									})}</span
								>
							{/if}
						</Row>
					{/each}
				</ul>
				{#if result.offerRemoval && canRemove}
					<Row wrap={false} align="start" as="label">
						<input
							type="checkbox"
							class="mt-1 checkbox"
							bind:checked={removeMissing}
							data-testid="remove-missing"
						/>
						<span class="font-semibold text-error-800"
							>{i18n.t(`patrons.import.preview.missing.${audience}.remove`)}</span
						>
					</Row>
				{:else}
					<Hint>
						{i18n.t(`patrons.import.preview.missing.${audience}.noPermission`)}
					</Hint>
				{/if}
			</Card>
		{/if}
	{/snippet}
	{#snippet doneInfo(summary)}
		{#if summary.notRemoved.length}
			<p class="text-warning-800">
				{i18n.t(`patrons.import.preview.missing.${audience}.notRemoved`, {
					count: summary.notRemoved.length,
				})}
			</p>
		{/if}
	{/snippet}
	{#snippet doneActions(summary)}
		<!-- the cards and the census need `patrons`: an import-only account does not get them -->
		{#if summary.createdIds.length && canPatrons}
			<Button
				variant="primary"
				icon={PrintIcon}
				onclick={() => (cardDialog = true)}
				data-testid="print-new">{i18n.t("patrons.import.done.printNew")}</Button
			>
			<CardPrintDialog
				bind:open={cardDialog}
				query={`ids=${summary.createdIds.join(",")}`}
				count={summary.createdIds.length}
			/>
		{/if}
		{#if canPatrons && photosOn()}
			<Button icon={CameraIcon} href="/census">{i18n.t("patrons.import.done.census")}</Button>
		{/if}
	{/snippet}
</ImportShell>
