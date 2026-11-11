<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Catalogue import and migration from Koha (steps 3.9, 9.19): the steps of every import
     (`ImportShell`) with the special values, the class-per-copy question, the generated barcodes
     and the books to classify counted, and the shortcuts to labels and catalogue at the end. -->
<script lang="ts">
	import { hasPermission } from "#lib/shared/permissions.js";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { CATALOG_IMPORT, type CatalogField } from "#lib/shared/import-columns.js";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		commitCatalogCsv,
		uploadCatalogCsv,
		validateCatalogCsv,
	} from "#lib/remote/catalog-import.remote.js";
	import type { GridColumn } from "#lib/components/DataGrid.svelte";
	import LabelPrintDialog from "#lib/components/catalog/LabelPrintDialog.svelte";
	import ImportShell from "#lib/components/imports/ImportShell.svelte";
	import { ImportWizard } from "#lib/components/imports/import-wizard.svelte.js";
	import { icons } from "#lib/ui/icons.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Row from "#lib/ui/Row.svelte";
	import TitleHint from "#lib/ui/TitleHint.svelte";

	const { data } = $props();
	const canCatalog = $derived(hasPermission(page.data.user, "catalog"));
	const i18n = useI18n();
	const PrintIcon = icons.print;
	const CatalogIcon = icons.catalog;

	const KEY_MISSING: Partial<Record<CatalogField, string>> = {
		biblioKey: i18n.t("catalog.import.columns.biblioKey.missing"),
		barcode: i18n.t("catalog.import.columns.barcode.missing"),
		classification: i18n.t("catalog.import.columns.classification.missing"),
	};

	let useSpecialValues = $state(false);
	let enableClassPerItem = $state<boolean | undefined>(undefined);
	let useMajorityType = $state<boolean | undefined>(undefined);
	let useComputedCallNumbers = $state<boolean | undefined>(undefined);
	let labelDialog = $state(false);

	const wizard = new ImportWizard({
		upload: uploadCatalogCsv,
		validate: (run) => validateCatalogCsv(run),
		commit: (run) => commitCatalogCsv(run),
		spec: () => CATALOG_IMPORT,
		run: () => ({
			useSpecialValues,
			enableClassPerItem,
			useMajorityType,
			useComputedCallNumbers,
		}),
		doneTitle: () => i18n.t("catalog.import.done.title"),
		onUpload: () => {
			enableClassPerItem = undefined;
			useMajorityType = undefined;
			useComputedCallNumbers = undefined;
		},
	});

	async function answer(yes: boolean): Promise<void> {
		enableClassPerItem = yes;
		await wizard.validate();
	}

	/** The item-type question (Q139): the record takes the type of most of its copies. */
	async function answerType(yes: boolean): Promise<void> {
		useMajorityType = yes;
		await wizard.validate();
	}

	/** The segnatura question (Q143): the copies take the segnatura computed from the scheme. */
	async function answerCallNumbers(yes: boolean): Promise<void> {
		useComputedCallNumbers = yes;
		await wizard.validate();
	}

	const reasonText = (r: { code: string; params?: Record<string, string | number> }): string =>
		r.code.startsWith("catalog.")
			? i18n.t(`catalog.errors.${r.code.slice(8)}`, r.params ?? {})
			: i18n.t(`catalog.import.reasons.${r.code}`, r.params ?? {});

	const gridColumns: GridColumn[] = [
		{ id: "line", header: i18n.t("common.import.line"), width: 70 },
		{ id: "statusText", header: i18n.t("common.import.status"), width: 110 },
		{ id: "title", header: i18n.t("catalog.import.preview.columns.title"), width: 240 },
		{ id: "barcode", header: i18n.t("catalog.import.preview.columns.barcode"), width: 120 },
		{
			id: "classification",
			header: i18n.t("catalog.import.preview.columns.classification"),
			width: 110,
		},
		{ id: "reason", header: i18n.t("common.import.reason"), flexgrow: 1 },
	];
	const gridRows = $derived(
		wizard.visibleRows.map((r) => ({
			id: r.line,
			line: r.line,
			statusText: i18n.t(`common.import.statuses.${r.status}`),
			title: r.data.title,
			barcode: r.barcode,
			// a title without classification goes to "Da classificare" (9.21)
			classification: r.data.classification
				? [r.data.classification, r.data.readingLevel].filter(Boolean).join(" ")
				: i18n.t("catalog.toClassify.label"),
			reason: r.reasons.map(reasonText).join(" · "),
		})),
	);
</script>

{#snippet question(
	key: "typeQuestion" | "callNumberQuestion",
	testid: string,
	count: number,
	value: boolean | undefined,
	onanswer: (yes: boolean) => Promise<void>,
)}
	<Alert tone="warning" as="div" padded data-testid={testid} live={false}>
		<p class="font-semibold">{i18n.t(`catalog.import.preview.${key}.title`)}</p>
		<p class="mt-1">{i18n.t(`catalog.import.preview.${key}.text`, { count })}</p>
		<Row class="mt-3">
			<Button
				variant={value === true ? "primary" : "tonal"}
				onclick={() => onanswer(true)}
				disabled={wizard.busy}
				data-testid="{testid}-yes">{i18n.t(`catalog.import.preview.${key}.yes`)}</Button
			>
			<Button
				variant={value === false ? "error" : "tonal"}
				onclick={() => onanswer(false)}
				disabled={wizard.busy}
				data-testid="{testid}-no">{i18n.t(`catalog.import.preview.${key}.no`)}</Button
			>
		</Row>
	</Alert>
{/snippet}

<ImportShell
	{wizard}
	title={i18n.t("catalog.import.title")}
	current="catalog"
	upload={uploadCatalogCsv}
	accept=".csv,.tsv,.txt,.mrc,.marc,.iso,.xml,text/csv,text/tab-separated-values,text/plain,application/marc,application/xml,text/xml"
	texts={{
		uploadHint: i18n.t("catalog.import.upload.hint"),
		file: i18n.t("catalog.import.upload.file"),
		upload: i18n.t("catalog.import.upload.submit"),
		uncertain: i18n.t("catalog.import.mapping.uncertain"),
		validate: i18n.t("catalog.import.mapping.validate"),
		again: i18n.t("catalog.import.done.again"),
		ready: i18n.t("catalog.import.preview.ready"),
		blocked: (result) =>
			result.counts.error === 0 && result.counts.new === 0
				? i18n.t("catalog.import.preview.nothing")
				: i18n.t("catalog.import.preview.blocked"),
		commit: i18n.t("catalog.import.preview.commit"),
		back: i18n.t("catalog.import.preview.back"),
		doneTitle: i18n.t("catalog.import.done.title"),
		doneSummary: (summary) => i18n.t("catalog.import.done.summary", summary),
		doneBatch: (summary) => i18n.t("catalog.import.done.batch", { id: summary.batchId }),
		field: (field) => i18n.t(`catalog.import.fields.${field}`),
	}}
	columns={CATALOG_IMPORT.columns}
	template={{
		hint: (field) => i18n.t(`catalog.import.columns.${field}.hint`),
		missing: (field) => KEY_MISSING[field],
		href: (headers) => resolve(`admin/imports/catalog/template.csv?columns=${headers}`),
		storageKey: "bv-template-catalog",
	}}
	statuses={["new", "unchanged"]}
	{gridColumns}
	{gridRows}
>
	{#snippet mappingInfo()}
		{#if wizard.remembered}
			<Hint tone="primary" data-testid="mapping-remembered"
				>{i18n.t("catalog.import.mapping.remembered")}</Hint
			>
		{/if}
	{/snippet}
	{#snippet mappingOptions()}
		{#each ["biblioKey", "barcode", "classification"] as const as key (key)}
			{#if !wizard.mapping.includes(key)}
				<Hint data-testid="missing-key-{key}"
					>{i18n.t(`catalog.import.mapping.without.${key}`)}</Hint
				>
			{/if}
		{/each}
		<Row wrap={false} align="start" as="label">
			<input
				type="checkbox"
				class="mt-1 checkbox"
				bind:checked={useSpecialValues}
				data-testid="special-values"
			/>
			<TitleHint
				title={i18n.t("catalog.import.mapping.specialValues", {
					author: data.specialAuthor,
					publisher: data.unknownPublisher,
				})}>{i18n.t("catalog.import.mapping.specialValuesHint")}</TitleHint
			>
		</Row>
	{/snippet}
	{#snippet previewInfo(result)}
		<Hint tone="primary" data-testid="titles-count">
			{i18n.t("catalog.import.preview.titles", result.titles)}
		</Hint>
		{#if result.generatedBarcodes > 0}
			<Hint tone="primary" data-testid="generated-barcodes">
				{i18n.t("catalog.import.preview.generatedBarcodes", {
					count: result.generatedBarcodes,
				})}
			</Hint>
		{/if}
		{#if result.toClassify > 0}
			<Hint tone="primary" data-testid="to-classify">
				{i18n.t("catalog.import.preview.toClassify", { count: result.toClassify })}
			</Hint>
		{/if}
		{#if result.classPerItemQuestion > 0}
			<Alert tone="warning" as="div" padded data-testid="class-question" live={false}>
				<p class="font-semibold">{i18n.t("catalog.import.preview.question.title")}</p>
				<p class="mt-1">
					{i18n.t("catalog.import.preview.question.text", {
						count: result.classPerItemQuestion,
					})}
				</p>
				<Row class="mt-3">
					<Button
						variant={enableClassPerItem === true ? "primary" : "tonal"}
						onclick={() => answer(true)}
						disabled={wizard.busy}
						data-testid="class-question-yes"
						>{i18n.t("catalog.import.preview.question.yes")}</Button
					>
					<Button
						variant={enableClassPerItem === false ? "error" : "tonal"}
						onclick={() => answer(false)}
						disabled={wizard.busy}
						data-testid="class-question-no"
						>{i18n.t("catalog.import.preview.question.no")}</Button
					>
				</Row>
			</Alert>
		{/if}
		{#if result.typeQuestion > 0}
			{@render question(
				"typeQuestion",
				"type-question",
				result.typeQuestion,
				useMajorityType,
				answerType,
			)}
		{/if}
		{#if result.callNumberQuestion > 0}
			{@render question(
				"callNumberQuestion",
				"call-number-question",
				result.callNumberQuestion,
				useComputedCallNumbers,
				answerCallNumbers,
			)}
		{/if}
	{/snippet}
	{#snippet doneInfo(summary)}
		{#if summary.classPerItemEnabled}
			<Hint tone="primary" data-testid="done-class-per-item"
				>{i18n.t("catalog.import.done.classPerItem")}</Hint
			>
		{/if}
	{/snippet}
	{#snippet doneActions(summary)}
		<!-- the labels need `catalog`: an import-only account does not get them -->
		{#if summary.generatedItemIds.length > 0 && canCatalog}
			<Button
				variant="primary"
				icon={PrintIcon}
				onclick={() => (labelDialog = true)}
				data-testid="done-labels">{i18n.t("catalog.import.done.labels")}</Button
			>
		{/if}
		<Button icon={CatalogIcon} href="/catalog" data-testid="done-open"
			>{i18n.t("catalog.import.done.open")}</Button
		>
		<LabelPrintDialog
			bind:open={labelDialog}
			ids={summary.generatedItemIds}
			count={summary.generatedItemIds.length}
		/>
	{/snippet}
</ImportShell>
