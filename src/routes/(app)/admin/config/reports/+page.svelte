<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- The reports library (steps 11.9, 9.20): every report with where it comes from (shipped with
     BiblioViva, customised, added), "Modifica" (the editor; a built-in becomes the school's
     customised copy), "Duplica" (a new report from it), "Prova" opening it with its parameters, the
     definition downloaded, "Nuovo report", a definition uploaded as JSON (checked and compiled before
     it is installed), a file of the configuration removed; the files that do not load with their
     problem. -->
<script lang="ts">
	import { resolve } from "$app/paths";
	import { submitFile } from "#lib/ui/submit-file.js";
	import ConfirmDialog from "#lib/components/ConfirmDialog.svelte";
	import { useI18n } from "#lib/i18n/context.js";
	import {
		getReportLibrary,
		removeReportDefinition,
		uploadReportDefinition,
	} from "#lib/remote/report-library.remote.js";
	import Alert from "#lib/ui/Alert.svelte";
	import Badge from "#lib/ui/Badge.svelte";
	import Button from "#lib/ui/Button.svelte";
	import Card from "#lib/ui/Card.svelte";
	import DividedList from "#lib/ui/DividedList.svelte";
	import Hint from "#lib/ui/Hint.svelte";
	import Page from "#lib/ui/Page.svelte";
	import PageHeader from "#lib/ui/PageHeader.svelte";
	import Row from "#lib/ui/Row.svelte";
	import { icons } from "#lib/ui/icons.js";
	import { toaster } from "#lib/ui/toaster.js";
	import QueryState from "#lib/ui/QueryState.svelte";

	const i18n = useI18n();
	const library = getReportLibrary();
	const UploadIcon = icons.upload;
	const DownloadIcon = icons.download;
	const RemoveIcon = icons.delete;
	const RunIcon = icons.reports;
	const EditIcon = icons.edit;
	const CopyIcon = icons.duplicate;
	const AddIcon = icons.add;

	let fileInput = $state<HTMLInputElement>();
	let picker = $state<HTMLInputElement>();
	let uploading = $state(false);
	let removeOpen = $state(false);
	let removing = $state<{ file: string; customised: boolean } | null>(null);
	const uploadError = $derived(uploadReportDefinition.fields.definition.issues()?.[0]?.message);

	async function onFile(e: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = "";
		if (!file || !fileInput) {
			return;
		}
		uploading = true;
		try {
			if (
				(await submitFile(uploadReportDefinition, fileInput, file)) &&
				uploadReportDefinition.result
			) {
				const r = uploadReportDefinition.result;
				toaster.success({
					title: i18n.t(
						r.replaced ? "config.reports.replaced" : "config.reports.installed",
						{ id: r.id },
					),
				});
			}
		} finally {
			uploading = false;
		}
	}

	async function remove(): Promise<void> {
		if (!removing) {
			return;
		}
		const result = await removeReportDefinition({ file: removing.file });
		if (result.ok) {
			toaster.success({ title: i18n.t("config.reports.removed") });
		} else {
			toaster.error({ title: i18n.t(`config.reports.errors.${result.code}`) });
		}
	}
</script>

<Page width="lg">
	<PageHeader
		title={i18n.t("config.reports.title")}
		icon="reports"
		backHref="/admin/config"
		backLabel={i18n.t("admin.home.sections.config.title")}
	>
		{#snippet actions()}
			<Button
				variant="primary"
				icon={AddIcon}
				href="/admin/config/reports/new"
				data-testid="report-new">{i18n.t("config.reports.new")}</Button
			>
			<Button
				icon={UploadIcon}
				onclick={() => picker?.click()}
				disabled={uploading}
				data-testid="report-upload">{i18n.t("config.reports.upload")}</Button
			>
		{/snippet}
	</PageHeader>
	<Hint>{i18n.t("config.reports.hint")}</Hint>
	<form
		{...uploadReportDefinition}
		enctype="multipart/form-data"
		class="hidden"
		aria-hidden="true"
	>
		<input {...uploadReportDefinition.fields.definition.as("file")} bind:this={fileInput} />
	</form>
	<input
		type="file"
		class="hidden"
		aria-hidden="true"
		tabindex="-1"
		accept=".json,application/json"
		bind:this={picker}
		onchange={onFile}
		data-testid="report-input"
	/>
	{#if uploadError}
		<Alert data-testid="report-upload-error">{uploadError}</Alert>
	{/if}

	<QueryState query={library}>
		{#snippet children(view)}
			{#if view.problems.length > 0}
				<Alert as="div" tone="warning" padded data-testid="report-problems">
					<p class="font-semibold">{i18n.t("config.reports.problems")}</p>
					<DividedList>
						{#each view.problems as p (`${p.source}/${p.file}`)}
							<li class="py-2">
								<Row justify="between" align="center">
									<div class="min-w-0">
										<p class="font-mono break-all">{p.file}</p>
										<Hint as="span" class="block break-words">{p.message}</Hint>
									</div>
									{#if p.source === "config"}
										<Button
											size="sm"
											variant="error-outlined"
											icon={RemoveIcon}
											onclick={() => {
												removing = { file: p.file, customised: false };
												removeOpen = true;
											}}
											data-testid="problem-remove"
											>{i18n.t("common.actions.delete")}</Button
										>
									{/if}
								</Row>
							</li>
						{/each}
					</DividedList>
				</Alert>
			{/if}
			<Card gap="2" as="section">
				<DividedList>
					{#each view.reports as r (r.id)}
						<li class="py-3" data-testid="report-{r.id}">
							<Row justify="between" align="center">
								<div class="min-w-0">
									<p class="font-semibold">{r.title}</p>
									<Row gap="1">
										<Hint as="span" mono>{r.id}</Hint>
										<Badge>{i18n.t(`reports.categories.${r.category}`)}</Badge>
										<Badge
											tone={r.origin === "builtin"
												? "neutral"
												: r.origin === "customised"
													? "secondary"
													: "success"}
											data-testid="report-origin"
											>{i18n.t(`config.reports.origin.${r.origin}`)}</Badge
										>
										{#if r.restricted}
											<Badge tone="warning"
												>{i18n.t("reports.restricted")}</Badge
											>
										{/if}
									</Row>
								</div>
								<Row gap="2">
									<Button
										size="sm"
										variant="primary"
										icon={EditIcon}
										href={resolve(`admin/config/reports/${r.id}`)}
										data-testid="report-edit"
										>{i18n.t("config.reports.edit")}</Button
									>
									<Button
										size="sm"
										icon={CopyIcon}
										href={resolve(`admin/config/reports/new?from=${r.id}`)}
										data-testid="report-duplicate"
										>{i18n.t("config.reports.duplicate")}</Button
									>
									<Button size="sm" icon={RunIcon} href="/reports/{r.id}"
										>{i18n.t("config.reports.try")}</Button
									>
									<Button
										size="sm"
										icon={DownloadIcon}
										href={resolve(`admin/config/reports/${r.id}/file.json`)}
										download>{i18n.t("config.reports.download")}</Button
									>
									{#if r.file}
										{@const file = r.file}
										<Button
											size="sm"
											variant="error-outlined"
											icon={RemoveIcon}
											onclick={() => {
												removing = {
													file,
													customised: r.origin === "customised",
												};
												removeOpen = true;
											}}
											data-testid="report-remove"
											>{i18n.t(
												r.origin === "customised"
													? "config.templates.restore"
													: "common.actions.delete",
											)}</Button
										>
									{/if}
								</Row>
							</Row>
						</li>
					{/each}
				</DividedList>
			</Card>
		{/snippet}
	</QueryState>
</Page>

<ConfirmDialog
	bind:open={removeOpen}
	title={i18n.t("config.reports.removeTitle", { file: removing?.file ?? "" })}
	description={i18n.t(
		removing?.customised ? "config.reports.restoreHint" : "config.reports.removeHint",
	)}
	tone="error"
	confirmLabel={i18n.t("common.actions.delete")}
	onconfirm={remove}
/>
