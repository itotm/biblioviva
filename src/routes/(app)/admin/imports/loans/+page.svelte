<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Open loans import (steps 3.9, 9.19): the steps of every import (`ImportShell`), with the
     overdue loans and the copies still to classify listed as information. Used once, at the
     switch from Koha. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { LOAN_IMPORT } from "#lib/shared/import-columns.js";
	import { useI18n } from "#lib/i18n/context.js";
	import { useFormat } from "#lib/ui/format.js";
	import {
		commitLoanCsv,
		uploadLoanCsv,
		validateLoanCsv,
	} from "#lib/remote/loan-import.remote.js";
	import type { GridColumn } from "#lib/components/DataGrid.svelte";
	import ImportShell from "#lib/components/imports/ImportShell.svelte";
	import { ImportWizard } from "#lib/components/imports/import-wizard.svelte.js";
	import Hint from "#lib/ui/Hint.svelte";

	const i18n = useI18n();
	const fmt = useFormat();

	const wizard = new ImportWizard({
		upload: uploadLoanCsv,
		validate: (run) => validateLoanCsv(run),
		commit: (run) => commitLoanCsv(run),
		spec: () => LOAN_IMPORT,
		run: () => ({}),
		doneTitle: () => i18n.t("admin.loansImport.done.title"),
	});

	const gridColumns: GridColumn[] = [
		{ id: "line", header: i18n.t("common.import.line"), width: 70 },
		{ id: "statusText", header: i18n.t("common.import.status"), width: 110 },
		{ id: "patron", header: i18n.t("admin.loansImport.preview.columns.patron"), width: 200 },
		{ id: "barcode", header: i18n.t("admin.loansImport.preview.columns.barcode"), width: 120 },
		{ id: "issued", header: i18n.t("admin.loansImport.preview.columns.issued"), width: 100 },
		{ id: "due", header: i18n.t("admin.loansImport.preview.columns.due"), width: 100 },
		{ id: "reason", header: i18n.t("common.import.reason"), flexgrow: 1 },
	];
	const gridRows = $derived(
		wizard.visibleRows.map((r) => ({
			id: r.line,
			line: r.line,
			statusText: i18n.t(`common.import.statuses.${r.status}`),
			patron: r.patronName || r.data.cardNumber,
			barcode: r.barcode,
			issued: r.issuedOn ? fmt.day(r.issuedOn) : "",
			due: r.dueOn ? fmt.day(r.dueOn) : "",
			reason: r.reasons
				.map((x) => i18n.t(`admin.loansImport.reasons.${x.code}`, x.params ?? {}))
				.join(" · "),
		})),
	);
</script>

<ImportShell
	{wizard}
	title={i18n.t("admin.loansImport.title")}
	current="loans"
	upload={uploadLoanCsv}
	accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
	texts={{
		uploadHint: i18n.t("admin.loansImport.upload.hint"),
		file: i18n.t("catalog.import.upload.file"),
		upload: i18n.t("admin.loansImport.upload.submit"),
		uncertain: i18n.t("admin.loansImport.mapping.uncertain"),
		validate: i18n.t("admin.loansImport.mapping.validate"),
		again: i18n.t("admin.loansImport.done.again"),
		ready: i18n.t("admin.loansImport.preview.ready"),
		blocked: () => i18n.t("admin.loansImport.preview.blocked"),
		commit: i18n.t("admin.loansImport.preview.commit"),
		back: i18n.t("admin.loansImport.preview.back"),
		doneTitle: i18n.t("admin.loansImport.done.title"),
		doneSummary: (summary) => i18n.t("admin.loansImport.done.summary", summary),
		doneBatch: (summary) => i18n.t("admin.loansImport.done.batch", { id: summary.batchId }),
		field: (field) => i18n.t(`admin.loansImport.fields.${field}`),
	}}
	columns={LOAN_IMPORT.columns}
	template={{
		hint: (field) => i18n.t(`admin.loansImport.columns.${field}`),
		href: (headers) => resolve(`admin/imports/loans/template.csv?columns=${headers}`),
		storageKey: "bv-template-loans",
	}}
	statuses={["new"]}
	{gridColumns}
	{gridRows}
>
	{#snippet mappingOptions()}
		{#each ["issuedOn", "dueOn"] as const as key (key)}
			{#if !wizard.mapping.includes(key)}
				<Hint data-testid="missing-{key}"
					>{i18n.t(`admin.loansImport.mapping.without.${key}`)}</Hint
				>
			{/if}
		{/each}
	{/snippet}
	{#snippet previewInfo(result)}
		{#if result.overdue > 0}
			<Hint tone="primary" data-testid="overdue-count"
				>{i18n.t("admin.loansImport.preview.overdue", { count: result.overdue })}</Hint
			>
		{/if}
	{/snippet}
</ImportShell>
