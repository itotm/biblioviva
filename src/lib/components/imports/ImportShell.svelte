<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The page of every CSV import (steps 2.6, 3.9, 9.19, §3.22): the template with the chosen columns
     → upload → columns → check (zero errors before "Importa") → one-transaction commit → summary.
     The state is an `ImportWizard`; what an import asks or says besides (the class question of the
     catalogue, the mode and the homonyms of the patrons…) comes in the snippets. -->
<script
	lang="ts"
	generics="F extends string, D extends WizardDetection<F>, E extends object, V extends WizardValidation, S extends WizardSummary"
>
	import type { Snippet } from "svelte";
	import type { ResolvedPathname } from "$app/types";
	import AreaTabs, { type AreaKey } from "#lib/components/AreaTabs.svelte";
	import DataGrid, { type GridColumn, type GridRow } from "#lib/components/DataGrid.svelte";
	import ColumnMapper from "#lib/components/imports/ColumnMapper.svelte";
	import ImportVerdict from "#lib/components/imports/ImportVerdict.svelte";
	import TemplateBuilder from "#lib/components/imports/TemplateBuilder.svelte";
	import {
		IMPORT_STEPS,
		type ImportWizard,
		type WizardDetection,
		type WizardSummary,
		type WizardValidation,
	} from "#lib/components/imports/import-wizard.svelte.js";
	import { useI18n } from "#lib/i18n/context.js";
	import type { ColumnGroup } from "#lib/shared/import-columns.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import Field from "#lib/ui/Field.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Input from "#lib/ui/Input.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import Steps from "#lib/ui/Steps.svelte";
	import { icons } from "#lib/ui/icons.js";

	/** What the shell uses of the import's upload form. */
	interface UploadForm {
		[attachment: symbol]: (node: HTMLFormElement) => void;
		readonly pending: number;
		readonly fields: {
			file: {
				as(type: "file"): Record<string, unknown>;
				issues(): { message: string }[] | undefined;
			};
		};
	}

	/** The texts that name what is imported. */
	interface Texts {
		uploadHint: string;
		file: string;
		upload: string;
		uncertain: string;
		validate: string;
		again: string;
		ready: string;
		/** Why the import cannot go on (the check's result tells which reason). */
		blocked: (result: V) => string;
		commit: string;
		back: string;
		doneTitle: string;
		doneSummary: (summary: S) => string;
		doneBatch: (summary: S) => string;
		/** The name of a field (columns and template). */
		field: (field: F) => string;
	}

	interface Props {
		wizard: ImportWizard<F, D, E, V, S>;
		title: string;
		/** The tab of the imports area. */
		current: AreaKey<"imports">;
		upload: UploadForm;
		/** The file types the file field offers. */
		accept: string;
		texts: Texts;
		columns: readonly { field: F; header: string; group: ColumnGroup }[];
		template: {
			hint: (field: F) => string;
			/** For a key: what happens when the file leaves it out. */
			missing?: (field: F) => string | undefined;
			alternatives?: readonly { fields: readonly F[]; label: string }[];
			alternativesLabel?: string;
			href: (headers: string) => ResolvedPathname;
			storageKey: string;
		};
		/** Statuses the import produces (the verdict counts). */
		statuses?: ("new" | "update" | "unchanged")[];
		gridColumns: GridColumn[];
		gridRows: GridRow[];
		/** More fields of the upload form (the patrons' audience). */
		uploadFields?: Snippet;
		/** Under the file's description: what was detected or remembered. */
		mappingInfo?: Snippet;
		/** Under the columns: what happens without a key, the questions of the import. */
		mappingOptions?: Snippet;
		/** Over the rows of the check. */
		previewInfo?: Snippet<[V]>;
		/** Under the rows of the check. */
		previewMore?: Snippet<[V]>;
		/** Under the summary. */
		doneInfo?: Snippet<[S]>;
		/** Actions before "Importa un altro file". */
		doneActions?: Snippet<[S]>;
	}

	const {
		wizard,
		title,
		current,
		upload,
		accept,
		texts,
		columns,
		template,
		statuses,
		gridColumns,
		gridRows,
		uploadFields,
		mappingInfo,
		mappingOptions,
		previewInfo,
		previewMore,
		doneInfo,
		doneActions,
	}: Props = $props();
	const i18n = useI18n();
	const BackIcon = icons.back;

	const templateColumns = $derived(
		columns.map((c) => ({
			...c,
			label: texts.field(c.field),
			hint: template.hint(c.field),
			missing: template.missing?.(c.field),
		})),
	);
	const mapperFields = $derived(
		columns.map((c) => ({ value: c.field, label: texts.field(c.field), group: c.group })),
	);
</script>

<Page width="2xl">
	<PageHeader
		{title}
		icon="upload"
		backHref="/admin/imports"
		backLabel={i18n.t("common.actions.back")}
	>
		{#snippet views()}
			<AreaTabs area="imports" {current} />
		{/snippet}
	</PageHeader>

	<Steps
		steps={IMPORT_STEPS.map((key) => ({ key, label: i18n.t(`common.import.steps.${key}`) }))}
		current={IMPORT_STEPS.indexOf(wizard.step)}
		label={title}
		testid="import-steps"
	/>

	{#if wizard.step === "upload"}
		<Card padding="lg" gap="4" as="section">
			<Hint tone="soft">{texts.uploadHint}</Hint>
			<form
				{...upload}
				enctype="multipart/form-data"
				class="space-y-4"
				data-testid="upload-form"
			>
				{@render uploadFields?.()}
				<Field label={texts.file} class="max-w-lg"
					><Input
						{...upload.fields.file.as("file")}
						{accept}
						required
						data-testid="csv-file"
					/></Field
				>
				{#if upload.fields.file.issues()?.length}
					<Hint tone="error" role="alert" data-testid="upload-error">
						{upload.fields.file.issues()?.[0]?.message}
					</Hint>
				{/if}
				<Row>
					<Button
						variant="primary"
						type="submit"
						disabled={upload.pending > 0}
						data-testid="upload-submit"
						>{upload.pending > 0
							? i18n.t("common.status.loading")
							: texts.upload}</Button
					>
				</Row>
			</form>
		</Card>
		<TemplateBuilder
			columns={templateColumns}
			alternatives={template.alternatives}
			alternativesLabel={template.alternativesLabel}
			href={template.href}
			storageKey={template.storageKey}
		/>
	{:else if wizard.step === "mapping" && wizard.detection}
		<Card padding="lg" gap="4" as="section" data-testid="mapping-step">
			<Hint tone="soft" data-testid="upload-info">
				<strong>{wizard.filename}</strong> —
				{wizard.info.format
					? i18n.t("common.import.infoMarc", wizard.info)
					: i18n.t("common.import.info", wizard.info)}
			</Hint>
			{@render mappingInfo?.()}
			{#if !wizard.detection.certain}
				<Alert tone="warning" role="status">{texts.uncertain}</Alert>
			{/if}
			<ColumnMapper
				bind:mapping={wizard.mapping}
				bind:header={wizard.header}
				sample={wizard.sample}
				fields={mapperFields}
			/>
			{#if !wizard.mappingComplete}
				<Hint tone="error" role="alert" data-testid="mapping-incomplete"
					>{i18n.t("common.import.errors.mappingIncomplete", {
						columns: wizard.missingText,
					})}</Hint
				>
			{/if}
			{@render mappingOptions?.()}
			<Row>
				<Button
					variant="primary"
					onclick={wizard.validate}
					disabled={wizard.busy || !wizard.mappingComplete}
					data-testid="validate"
					>{wizard.busy ? i18n.t("common.status.loading") : texts.validate}</Button
				>
				<Button onclick={wizard.restart}>{texts.again}</Button>
			</Row>
		</Card>
	{:else if wizard.step === "preview" && wizard.result}
		{@const result = wizard.result}
		<section class="space-y-4" data-testid="preview-step">
			<ImportVerdict
				counts={result.counts}
				bind:onlyErrors={wizard.onlyErrors}
				canCommit={result.canCommit}
				{statuses}
				ready={texts.ready}
				blocked={texts.blocked(result)}
			/>
			{@render previewInfo?.(result)}
			<div class="card p-2">
				<DataGrid
					data={gridRows}
					columns={gridColumns}
					height="{Math.min(480, 56 + Math.max(gridRows.length, 2) * 40)}px"
					select={false}
				/>
			</div>
			{@render previewMore?.(result)}
			<Row>
				<Button
					variant="primary"
					onclick={wizard.commit}
					disabled={wizard.busy || !result.canCommit}
					data-testid="commit"
					>{wizard.busy ? i18n.t("common.status.loading") : texts.commit}</Button
				>
				<Button icon={BackIcon} onclick={() => (wizard.step = "mapping")}
					>{texts.back}</Button
				>
			</Row>
		</section>
	{:else if wizard.step === "done" && wizard.summary}
		{@const summary = wizard.summary}
		<Card padding="lg" gap="4" as="section" data-testid="done-step">
			<h2 class="title-lg">{texts.doneTitle}</h2>
			<p data-testid="done-summary">{texts.doneSummary(summary)}</p>
			{@render doneInfo?.(summary)}
			<Hint>{texts.doneBatch(summary)}</Hint>
			<Row>
				{@render doneActions?.(summary)}
				<Button onclick={wizard.restart} data-testid="import-again">{texts.again}</Button>
			</Row>
		</Card>
	{/if}
</Page>
